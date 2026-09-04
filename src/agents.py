from crewai import LLM, Agent, Crew, Process, Task
from crewai.mcp import MCPServerStdio
from langfuse import propagate_attributes

from src.events import publish
from src.llm import get_llm

_mcp = MCPServerStdio(command="uv", args=["run", "python", "-m", "src.mcp_server"])

llm: LLM = get_llm()

policy_agent = Agent(
    role="Policy Verification Agent",
    goal="Determine whether the billed procedure is covered under the patient's policy",
    backstory=(
        "You NEVER know coverage details from memory — you have no access to policy data "
        "except through the check_coverage tool. You MUST call it with the claim's policy_id "
        "and procedure_code before answering. Report coverage status, deductible status, and "
        "any exclusion, quoting the tool's output — never invent or paraphrase it."
    ),
    mcps=[_mcp],
    llm=llm,
)

medical_history_agent = Agent(
    role="Medical History Agent",
    goal="Check whether the claim is consistent with the patient's medical history",
    backstory=(
        "You NEVER know a patient's history from memory — you have no access except through "
        "the lookup_medical_history tool. You MUST call it with the claim's patient_id before "
        "answering. Report whether the procedure is consistent with prior diagnoses/procedures, "
        "quoting the tool's output — never invent or paraphrase it."
    ),
    mcps=[_mcp],
    llm=llm,
)

fraud_agent = Agent(
    role="Fraud/Exception Agent",
    goal="Assess fraud risk for the claim based on billing and prior-claim signals",
    backstory=(
        "You NEVER know fraud signals from memory — you have no access except through the "
        "fraud_score tool. You MUST call it with the claim's claim_id before answering. Report "
        "the billed-vs-typical-cost ratio and prior-claim flags, quoting the tool's output — "
        "never invent or paraphrase it."
    ),
    mcps=[_mcp],
    llm=llm,
)


def _decision_gate(coverage: dict, history_conflict: bool, fraud: dict) -> tuple[str, str]:
    """Deterministic — the decision that pays or denies money should not depend on
    an LLM's phrasing that day. Agents produce findings; this applies the policy."""
    if not coverage.get("covered", False):
        reason = coverage.get("exclusion") or "procedure not covered under policy"
        return "denied", f"Coverage denied: {reason}"
    if fraud.get("billed_vs_typical_ratio", 1.0) >= 3.0 or fraud.get("prior_claim_flags", 0) >= 2:
        return "human_review", "Fraud signals above threshold — routed to adjuster"
    if history_conflict:
        return "human_review", "Medical history conflict — routed to adjuster"
    return "approved", "Coverage confirmed, no fraud or history flags"


def _step(claim_id: str, agent: str, note: str):
    """Publishes a micro-progress annotation (for live SSE) and persists it
    (so the pipeline console still renders after the claim is done — a page
    reload shouldn't lose the record of what the agents did)."""
    publish(claim_id, {"type": "step", "agent": agent, "note": note})

    from src.db import get_conn

    with get_conn() as conn:
        conn.execute(
            "INSERT INTO claim_activity (claim_id, agent, note) VALUES (?, ?, ?)",
            (claim_id, agent, note),
        )


def run_claim(claim_id: str, claim: dict) -> dict:
    """Runs the sequential claims pipeline for one claim, publishing SSE events
    and grouping all spans under one Langfuse session (session_id=claim_id,
    user_id=patient_id) so the whole pipeline is reviewable as one unit."""
    publish(claim_id, {"type": "stage", "agent": "policy", "status": "running"})
    _step(claim_id, "policy", "Reading claim details")

    with propagate_attributes(session_id=claim_id, user_id=claim["patient_id"]):
        _step(claim_id, "policy", "Calling check_coverage via MCP")
        policy_task = Task(
            description=(
                f"Check coverage for policy_id={claim['policy_id']}, "
                f"procedure_code={claim['procedure_code']}."
            ),
            expected_output="Coverage status, deductible status, exclusion (if any).",
            agent=policy_agent,
        )
        policy_result = Crew(
            agents=[policy_agent], tasks=[policy_task], process=Process.sequential, verbose=True
        ).kickoff()
        _step(claim_id, "policy", "Coverage finding recorded")
        publish(claim_id, {"type": "stage", "agent": "policy", "status": "done"})

        publish(claim_id, {"type": "stage", "agent": "medical_history", "status": "running"})
        _step(claim_id, "medical_history", "Calling lookup_medical_history via MCP")
        history_task = Task(
            description=(
                f"Check medical history for patient_id={claim['patient_id']}. "
                f"This claim is for procedure_code={claim['procedure_code']} — "
                f"assess consistency against that specific procedure, not any other "
                f"procedure that happens to appear in the patient's history."
            ),
            expected_output="Prior diagnoses/procedures and whether they're consistent with this claim's procedure.",
            agent=medical_history_agent,
        )
        history_result = Crew(
            agents=[medical_history_agent],
            tasks=[history_task],
            process=Process.sequential,
            verbose=True,
        ).kickoff()
        _step(claim_id, "medical_history", "Consistency check recorded")
        publish(claim_id, {"type": "stage", "agent": "medical_history", "status": "done"})

        publish(claim_id, {"type": "stage", "agent": "fraud", "status": "running"})
        _step(claim_id, "fraud", "Calling fraud_score via MCP")
        fraud_task = Task(
            description=f"Get fraud signals for claim_id={claim_id}.",
            expected_output="Billed-vs-typical ratio and prior-claim flags.",
            agent=fraud_agent,
        )
        fraud_result = Crew(
            agents=[fraud_agent], tasks=[fraud_task], process=Process.sequential, verbose=True
        ).kickoff()
        _step(claim_id, "fraud", "Fraud signal recorded")
        publish(claim_id, {"type": "stage", "agent": "fraud", "status": "done"})

    from src.mcp_server import check_coverage, fraud_score, lookup_medical_history
    from src.tracing import judge_groundedness

    _step(claim_id, "decision", "Applying decision policy")
    coverage = check_coverage(claim["policy_id"], claim["procedure_code"])
    history = lookup_medical_history(claim["patient_id"])
    fraud = fraud_score(claim_id)
    history_conflict = "conflict" in str(history_result).lower()
    decision, reason = _decision_gate(coverage, history_conflict, fraud)

    publish(claim_id, {"type": "decision", "decision": decision, "reason": reason})

    _step(claim_id, "policy", "Scoring groundedness")
    judge_groundedness(claim_id, str(coverage), str(policy_result))
    _step(claim_id, "medical_history", "Scoring groundedness")
    judge_groundedness(claim_id, str(history), str(history_result))
    _step(claim_id, "fraud", "Scoring groundedness")
    judge_groundedness(claim_id, str(fraud), str(fraud_result))

    publish(claim_id, {"type": "done"})

    return {
        "findings": {
            "policy": str(policy_result),
            "medical_history": str(history_result),
            "fraud": str(fraud_result),
        },
        "decision": decision,
        "decision_reason": reason,
    }
