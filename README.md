# Agents Studio — Multi-Agent Observability Demo

A small multi-agent system (CrewAI) with a chat UI ("Agents Studio"), built to teach how agent observability works — live for a talk on AI agent → multi-agent → observability. Full design/rationale: [PRD.md](PRD.md).

## Stack

- **Backend:** Python 3.12 (`uv`), CrewAI, FastAPI, SQLite, Chroma (vector store)
- **LLM:** Ollama (local, `qwen2.5:7b`) primary, OpenRouter (free tier) fallback
- **Observability:** Langfuse Cloud
- **Frontend:** Next.js + shadcn/ui

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python package/venv manager)
- [Ollama](https://ollama.com) installed and running, with `qwen2.5:7b` pulled:
  ```
  ollama pull qwen2.5:7b
  ```
- Node.js + npm (for the frontend)
- A [Langfuse Cloud](https://cloud.langfuse.com) project (free tier) for trace/eval keys
- An [OpenRouter](https://openrouter.ai/keys) API key (free tier fallback)

## Setup

1. Copy `.env.example` to `.env` and fill in your Langfuse and OpenRouter keys:
   ```
   cp .env.example .env
   ```
2. Install backend dependencies:
   ```
   uv sync
   ```
3. Seed the eval dataset:
   ```
   uv run python -m src.seed_evals
   ```
4. Install frontend dependencies:
   ```
   cd frontend && npm install
   ```

## Running

**Backend (FastAPI, port 8000):**

```
uv run uvicorn src.api:app --port 8000
```

**Frontend (Next.js, port 3000):**

```
cd frontend && npm run dev
```

Open http://localhost:3000 — chat with the agents at `/`, eval dashboard at `/evals`.

**CLI (no frontend needed):**

```
uv run python main.py "Is checkout-service healthy?"
```

**Run the eval suite:**

```
uv run python -m src.run_evals <label>
```

## Project layout

```
src/
  agents.py       CrewAI agents (Research/Infra/Support) + supervisor routing
  llm.py          Ollama-primary / OpenRouter-fallback LLM config
  tracing.py      Langfuse instrumentation (via LiteLLM callback)
  db.py           SQLite schema/connection (runs + eval history)
  events.py       In-process pub/sub for live run events (SSE)
  api.py          FastAPI app (/chat, /runs, /evals)
  seed_evals.py   Seeds the fixed eval dataset
  run_evals.py    Runs the eval suite, records pass/fail
  tools/          Mocked tools: vector_search, k8s_status, ticket_lookup
frontend/         Next.js + shadcn/ui "Agents Studio"
main.py           CLI entrypoint
PRD.md            Full product/architecture doc
```

## Notes

- Every chat response links to its Langfuse trace ("View trace ↗") so you can see the actual spans (agent → LLM → tool) behind any answer.
- The eval dashboard (`/evals`) shows routing pass/fail per seeded test case, each linking to its trace.
- No Docker/Podman required — everything runs as a plain process or a hosted free-tier service.
