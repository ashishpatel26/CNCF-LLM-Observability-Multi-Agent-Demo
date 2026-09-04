import os
import uuid

from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")

from fastapi import BackgroundTasks, FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402
from sse_starlette.sse import EventSourceResponse  # noqa: E402

from src.db import get_conn, init_db  # noqa: E402
from src.events import close_stream, create_stream, subscribe, subscribe_global, unsubscribe_global  # noqa: E402
from src.tracing import setup_tracing  # noqa: E402

setup_tracing()
init_db()

from src.agents import run_claim  # noqa: E402
from src.mcp_server import ADJUSTERS, PATIENTS, PROVIDERS  # noqa: E402

app = FastAPI(title="Meridian Claims API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ClaimRequest(BaseModel):
    patient_id: str
    policy_id: str
    provider_id: str
    procedure_code: str
    billed_amount: float
    claim_id: str | None = None


def _process_claim(claim_id: str, claim: dict):
    result = run_claim(claim_id, claim)
    trace_url = os.environ.get("LANGFUSE_HOST")

    with get_conn() as conn:
        conn.execute(
            "UPDATE claims SET status='done', decision=?, decision_reason=?, langfuse_session_url=? WHERE id=?",
            (result["decision"], result["decision_reason"], trace_url, claim_id),
        )
        for agent, finding in result["findings"].items():
            conn.execute(
                "INSERT INTO claim_findings (claim_id, agent, finding, trace_url) VALUES (?, ?, ?, ?)",
                (claim_id, agent, finding, trace_url),
            )

    close_stream(claim_id)


@app.post("/claims")
def submit_claim(req: ClaimRequest, background_tasks: BackgroundTasks):
    claim_id = req.claim_id or f"CLM-{uuid.uuid4().hex[:6].upper()}"
    create_stream(claim_id)

    with get_conn() as conn:
        conn.execute(
            """INSERT INTO claims
               (id, patient_id, policy_id, provider_id, procedure_code, billed_amount, status)
               VALUES (?, ?, ?, ?, ?, ?, 'processing')""",
            (claim_id, req.patient_id, req.policy_id, req.provider_id, req.procedure_code, req.billed_amount),
        )

    claim = req.model_dump()
    background_tasks.add_task(_process_claim, claim_id, claim)
    return {"claim_id": claim_id, "status": "processing"}


@app.get("/claims")
def list_claims():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM claims ORDER BY created_at DESC LIMIT 100").fetchall()
        claims = [dict(r) for r in rows]
        for c in claims:
            c["patient_name"] = PATIENTS.get(c["patient_id"], {}).get("name", c["patient_id"])
            c["provider_name"] = PROVIDERS.get(c["provider_id"], {}).get("name", c["provider_id"])
        return claims


@app.get("/claims/{claim_id}")
def get_claim(claim_id: str):
    with get_conn() as conn:
        claim = conn.execute("SELECT * FROM claims WHERE id=?", (claim_id,)).fetchone()
        if not claim:
            return {"error": "not found"}
        findings = conn.execute(
            "SELECT * FROM claim_findings WHERE claim_id=? ORDER BY created_at", (claim_id,)
        ).fetchall()
        activity = conn.execute(
            "SELECT * FROM claim_activity WHERE claim_id=? ORDER BY created_at", (claim_id,)
        ).fetchall()
        claim_dict = dict(claim)
        claim_dict["patient"] = PATIENTS.get(claim_dict["patient_id"])
        claim_dict["provider"] = PROVIDERS.get(claim_dict["provider_id"])
        claim_dict["findings"] = [dict(f) for f in findings]
        claim_dict["activity"] = [dict(a) for a in activity]
        return claim_dict


@app.get("/claims/{claim_id}/events")
async def claim_events(claim_id: str):
    import asyncio
    import json

    q = subscribe(claim_id)

    async def event_gen():
        loop = asyncio.get_event_loop()
        while True:
            event = await loop.run_in_executor(None, q.get)
            yield {"data": json.dumps(event)}
            if event.get("type") == "done":
                break

    return EventSourceResponse(event_gen())


@app.get("/activity/stream")
async def global_activity_stream():
    """System-wide live activity feed across every claim being processed
    right now — for the sidebar activity drawer."""
    import asyncio
    import json

    q = subscribe_global()

    async def event_gen():
        loop = asyncio.get_event_loop()
        try:
            while True:
                event = await loop.run_in_executor(None, q.get)
                yield {"data": json.dumps(event)}
        finally:
            unsubscribe_global(q)

    return EventSourceResponse(event_gen())


@app.get("/activity/recent")
def recent_activity(limit: int = 50):
    """Last N activity entries across all claims, for the drawer's initial
    (pre-connection) contents."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM claim_activity ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows][::-1]


@app.get("/reference/patients")
def reference_patients():
    return PATIENTS


@app.get("/reference/providers")
def reference_providers():
    return PROVIDERS


@app.get("/reference/adjusters")
def reference_adjusters():
    return ADJUSTERS


@app.get("/evals")
def list_evals():
    """Eval cases come from the Langfuse Dataset (source of truth for what
    should be tested); pass/fail results are read from SQLite, written by
    run_evals.py alongside the Langfuse Score it also records — Langfuse's
    score-query API doesn't return the session_id needed to join back to a
    claim, so SQLite is the read path for the dashboard's own use."""
    from src.seed_evals import DATASET_NAME
    from src.tracing import langfuse

    dataset = langfuse.get_dataset(DATASET_NAME)
    cases = [
        {"id": item.id, "claim_id": item.input["claim_id"], "expected_decision": item.expected_output["decision"]}
        for item in dataset.items
    ]

    with get_conn() as conn:
        results = conn.execute("SELECT * FROM eval_results ORDER BY created_at DESC").fetchall()
        return {"cases": cases, "results": [dict(r) for r in results]}
