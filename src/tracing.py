from langfuse import get_client
from openinference.instrumentation.crewai import CrewAIInstrumentor

langfuse = get_client()
_instrumented = False


def setup_tracing():
    """Instrument CrewAI via OpenInference -> OTel -> Langfuse v4."""
    global _instrumented
    if _instrumented:
        return
    CrewAIInstrumentor().instrument(skip_dep_check=True)
    _instrumented = True


def score_decision(claim_id: str, correct: bool):
    """Records a Langfuse Score on the claim's session (session_id == claim_id,
    see propagate_attributes in agents.run_claim)."""
    langfuse.create_score(
        name="decision_correct",
        value=correct,
        data_type="BOOLEAN",
        session_id=claim_id,
    )


def judge_groundedness(claim_id: str, tool_output: str, agent_finding: str) -> float:
    """App-managed LLM-as-judge: does the agent's finding stick to what its tool
    actually returned? Writes a 0-1 'groundedness' Score to the claim's session.
    See PRD 4.3 for why this isn't Langfuse's native evaluator rule engine.
    """
    from src.llm import get_llm

    judge_prompt = (
        "Tool output (ground truth):\n"
        f"{tool_output}\n\n"
        "Agent's finding based on that tool output:\n"
        f"{agent_finding}\n\n"
        "Does the finding stick strictly to what the tool output contains, with no "
        "invented or omitted details? Reply with only a number from 0.0 (not grounded) "
        "to 1.0 (fully grounded)."
    )
    llm = get_llm()
    response = llm.call([{"role": "user", "content": judge_prompt}])
    try:
        score = float(str(response).strip().split()[0])
        score = max(0.0, min(1.0, score))
    except (ValueError, IndexError):
        score = 0.5

    langfuse.create_score(
        name="groundedness",
        value=score,
        data_type="NUMERIC",
        session_id=claim_id,
    )
    return score
