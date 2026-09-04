import os
import uuid

from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402
from sse_starlette.sse import EventSourceResponse  # noqa: E402

from src.db import get_conn, init_db  # noqa: E402
from src.events import close_stream, create_stream, subscribe  # noqa: E402
from src.tracing import setup_tracing  # noqa: E402

setup_tracing()
init_db()

from src.agents import run_request  # noqa: E402

app = FastAPI(title="Agents Studio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    run_id: str
    agent: str
    response: str
    trace_url: str | None


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    run_id = str(uuid.uuid4())
    create_stream(run_id)

    with get_conn() as conn:
        conn.execute(
            "INSERT INTO runs (id, request, agent, status) VALUES (?, ?, ?, 'running')",
            (run_id, req.message, "pending"),
        )

    result = run_request(run_id, req.message)
    trace_url = os.environ.get("LANGFUSE_HOST")

    with get_conn() as conn:
        conn.execute(
            "UPDATE runs SET agent=?, response=?, status='done', trace_url=? WHERE id=?",
            (result["agent"], result["response"], trace_url, run_id),
        )

    close_stream(run_id)
    return ChatResponse(
        run_id=run_id, agent=result["agent"], response=result["response"], trace_url=trace_url
    )


@app.get("/runs")
def list_runs():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM runs ORDER BY created_at DESC LIMIT 50").fetchall()
        return [dict(r) for r in rows]


@app.get("/runs/{run_id}")
def get_run(run_id: str):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM runs WHERE id=?", (run_id,)).fetchone()
        return dict(row) if row else {"error": "not found"}


@app.get("/runs/{run_id}/events")
async def run_events(run_id: str):
    import asyncio

    q = subscribe(run_id)

    async def event_gen():
        loop = asyncio.get_event_loop()
        while True:
            event = await loop.run_in_executor(None, q.get)
            yield {"event": event.get("type", "message"), "data": str(event)}
            if event.get("type") == "done":
                break

    return EventSourceResponse(event_gen())


@app.get("/evals")
def list_evals():
    with get_conn() as conn:
        cases = conn.execute("SELECT * FROM eval_cases").fetchall()
        results = conn.execute(
            "SELECT * FROM eval_results ORDER BY created_at DESC"
        ).fetchall()
        return {"cases": [dict(c) for c in cases], "results": [dict(r) for r in results]}
