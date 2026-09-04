# PRD: Agents Studio — Multi-Agent Observability Demo Platform

## 1. Purpose

Build small but real multi-agent system, instrumented end-to-end, used as live demo for talk "From AI Agent to Production Multi-Agent System — and where observability fits." Demo must let presenter show, not just tell: single agent loop, jump to multi-agent, then reveal trace/metrics/eval overlay.

## 2. Audience

Beginner-to-intermediate engineers new to agents. Demo must work as teaching tool first, production-realism second.

## 3. Goals

- Show agent = LLM + control loop + tools + state, live.
- Show multi-agent (supervisor + specialist agents) handoff and failure propagation.
- Show full trace tree (agent → LLM call → retrieval → tool call) reconstructable after the fact.
- Show system/LLM/agent/quality metrics categories with real numbers, not mockups.
- Show one failure caught via trace, turned into eval dataset, fixed, regression-tested.

## Non-goals

- Not a production-grade agent framework.
- Not multi-tenant, not auth-hardened, not horizontally scaled.
- Not rebuilding Langfuse's trace UI — Studio deep-links out to Langfuse for full trace detail rather than re-rendering spans itself.

## 4. System design

### 4.1 Agents

- **Supervisor Agent** — receives user request, routes to specialist(s), aggregates results.
- **Research Agent** — vector DB retrieval + LLM synthesis.
- **Infra Agent** — calls mock/local "Kubernetes API" tool (stub, returns canned JSON).
- **Support Agent** — calls mock ticketing/API tool.
- **Critic Agent** (optional, stretch) — reviews supervisor's draft answer before returning.

Each agent: goal in → LLM decides action → tool call or finish → observation → loop.

**Framework: CrewAI** — declarative Agent/Task/Crew definitions are easy for a beginner audience to read (matches Slide 6's "who does what" story); CrewAI's built-in LLM param accepts any OpenAI-compatible base_url, so it points at the Ollama→OpenRouter fallback chain in [llm.py](../src/llm.py). Langfuse instruments via CrewAI's LiteLLM callback hooks (CrewAI uses LiteLLM under the hood) so spans still capture per-agent/tool/LLM detail despite the framework layer.

### 4.2 Tools (stubbed, deterministic where possible for demo repeatability)

- Vector DB search (small local embedding store, e.g. Chroma/SQLite+embeddings)
- Mock "K8s" API (returns canned pod/deployment status)
- Mock external API (returns canned ticket/data)

### 4.3 Observability plane

- **Backend:** Langfuse Cloud (free tier) — hosted, no local infra/container runtime needed (this machine has no docker/podman).
- **Instrumentation:** Langfuse Python SDK (`@observe` decorator + `langfuse.openai`/native integration or manual `trace`/`span` calls) wraps every agent step, LLM call, tool call, retrieval call as a nested span; single trace ID threads through supervisor → sub-agents.
- **Access:** Langfuse project API keys (public/secret) via env vars; presenter views traces live in Langfuse Cloud UI during demo.
- **Metrics captured, by category** (mirrors deck's 4-category split):
  - System: latency, error rate per service call
  - LLM: tokens in/out, latency, model, cost estimate
  - Agent: tool chosen, # steps, loop count, handoff count, final state
  - Quality: pass/fail on a small eval set (correctness/groundedness check)
- Cost/token/latency shown natively in Langfuse per-trace and per-session; no separate metrics store needed for v1.

### 4.4 Eval loop

- Small fixed eval dataset (5-10 prompts w/ expected behavior/tool choice), stored as a Langfuse Dataset.
- Langfuse Dataset Runs (or local script scoring against Langfuse traces) flags mismatches.
- One deliberately-seeded failure case demonstrates: trace shows wrong tool call in Langfuse UI → prompt added to Langfuse dataset → agent prompt/logic fixed → dataset run re-scored green.
- Optional: Langfuse Scores (manual or LLM-as-judge) attached to traces for groundedness/correctness.

### 4.5 Tech stack (confirmed/decided)

**Backend**
- Python 3.12, managed via `uv` (no system Python) — `uv add`, `uv run`.
- **CrewAI** — agent framework (Agent/Task/Crew, sequential process; see 4.1).
- **FastAPI** — HTTP API layer wrapping the crew runtime for the Studio frontend.
- **LLM:** Ollama (local, `qwen2.5:7b`, runs on RTX 3060 6GB) primary, OpenRouter (free tier) fallback — both via CrewAI's LiteLLM-backed `LLM` class ([llm.py](../src/llm.py)). Flipped from the original OpenRouter-primary plan after testing showed the free OpenRouter model (Nemotron Super) hallucinated tool-output details (invented ticket descriptions/priorities) despite calling the tool correctly, while local qwen2.5:7b returned tool output verbatim every time.
- **Vector store:** Chroma, in-process, no server — backs the `vector_search` tool ([vector_search.py](../src/tools/vector_search.py)).
- **SQLite** — local app database (file-based, zero setup, inspectable with any SQLite browser/CLI). Stores:
  - Chat sessions/messages + per-run metadata (agent used, status, Langfuse trace ID/URL) so Studio can list past runs without re-querying Langfuse.
  - Local eval dataset/scenarios + cached before/after run results, mirroring what's authoritative in Langfuse Datasets, for fast Studio dashboard reads.
- **Langfuse Python SDK** — trace/span instrumentation via LiteLLM callback (CrewAI runs on LiteLLM under the hood).
- **No Docker/Podman required** — every component is a plain Python process or a hosted service (OpenRouter, Langfuse Cloud). Podman is available on this machine if ever needed but not part of the required path.

**Frontend — "Agents Studio"**
- **Next.js** + **shadcn/ui** — chat UI, live agent graph, eval dashboard.
- Talks to FastAPI backend via REST (`/chat`, `/runs`, `/evals`) + **SSE** for the live in-flight agent-graph event stream (Langfuse ingestion is async/batched — too slow for real-time UI, so live view is sourced from in-process backend events; Langfuse stays system of record for after-the-fact trace detail).

**Backend API surface (FastAPI):**
- `POST /chat` — send message, returns response + run metadata (agent used, Langfuse trace ID/URL); persists to SQLite.
- `GET /runs` / `GET /runs/{id}` — past run history from SQLite, with trace links.
- `GET /runs/{id}/events` (SSE) — live step feed for an in-flight run, drives the Studio agent graph.
- `GET /evals` — eval dataset + before/after results (SQLite cache, backed by Langfuse Datasets as source of truth).

**Frontend pages (v1):**
1. **Chat** — shadcn `Card`/`ScrollArea`/`Input`; each assistant turn shows a compact "ran: Supervisor → Research Agent → Vector DB search" summary chip plus a **"View trace ↗"** link to the Langfuse Cloud trace URL.
2. **Live agent graph** — animates the supervisor→agents→tools graph (nodes/edges matching Slide 7's diagram) as each step completes, off the SSE event stream.
3. **Eval dashboard** — pass/fail table + before/after comparison for the seeded-failure-fix story (Slide 8), each row linking to its Langfuse trace.

**Explicitly out of scope for Studio v1:** auth/login, multi-user accounts, mobile layout polish.

### 4.6 Architecture diagram

```
┌──────────────────────────┐        REST /chat, /runs, /evals       ┌───────────────────────────┐
│   Agents Studio (Next.js │ ─────────────────────────────────────► │   FastAPI backend (uv)    │
│   + shadcn/ui)           │ ◄───────────────────────────────────── │                           │
│   - Chat                 │        SSE /runs/{id}/events           │  - routes user request to │
│   - Live agent graph     │                                        │    a specialist agent     │
│   - Eval dashboard       │                                        │  - persists sessions/runs │
└──────────────────────────┘                                        │    to SQLite              │
                                                                     └─────────────┬─────────────┘
                                                                                   │
                                                                                   ▼
                                                        ┌──────────────────────────────────────────┐
                                                        │              CrewAI Crew                  │
                                                        │  Research Agent │ Infra Agent │ Support    │
                                                        │  (vector_search)│ (k8s_status) │ (ticket_   │
                                                        │                 │              │  lookup)   │
                                                        └───────┬─────────────────┬──────────────┬───┘
                                                                │                 │              │
                                                                ▼                 ▼              ▼
                                                          Chroma (local)   mock K8s API    mock ticket API
                                                                │
                    LLM calls (LiteLLM) ───────────────────────┼──────────────────────────────────────┐
                                                                ▼                                       ▼
                                                     Ollama local (primary, qwen2.5:7b)      OpenRouter (free tier, fallback)
                                                                │
                                                                ▼
                                                    Langfuse Cloud (traces/spans/evals,
                                                    via LiteLLM callback)
```

SQLite and Langfuse are deliberately separate: SQLite is the app's own operational store (fast local reads for Studio), Langfuse is the observability/eval system of record (what the demo's trace links and eval dashboard ultimately point back to).

## 5. Demo narrative mapping (drives what UI must show on screen)

| Deck moment | Platform must show |
|---|---|
| Slide 1: single LLM → agent → tools → multi-agent | Studio chat: send one request, watch live graph go from 1 node to supervisor+3 sub-agents |
| Slide 2: HTTP 200 ≠ correct | Real, observed example: refund-policy query returns confident but embellished answer (model paraphrases beyond the seed doc) — trace shows tool WAS called correctly, but output still drifted from ground truth. Studio flags via eval, not visible from chat alone. |
| Slide 3: trace anatomy | "View trace ↗" from Studio opens Langfuse nested spans: agent → LLM → retrieval → tool |
| Slide 4: multi-agent trace + failure propagation | Live graph shows Research Agent node fail (red), Supervisor node still completes (degraded) |
| Slide 5: 4 metric categories | Langfuse trace view (linked from Studio) split into System/LLM/Agent/Quality |
| Slide 6: tool landscape layers | (Slide-only, no platform requirement) |
| Slide 7: full architecture | Studio's live graph nodes match the boxes-and-arrows diagram exactly (naming parity) |
| Slide 8: improvement loop | Studio eval dashboard: before/after dataset run rows, each linking to its trace |

## 6. Success criteria

- Presenter can run one command to start backend + one to start Studio frontend, locally, no Docker/Podman required.
- Live demo completes in under 5 minutes without network flakiness (mock external tool calls; LLM calls to local Ollama).
- Studio chat + live graph clearly reflect real run state (no fake/canned animation).
- Every "View trace ↗" link opens the correct Langfuse trace for that exact run.
- At least one real induced failure is caught by eval, visible in Studio's eval dashboard, not just narrated.
- Every box in the Slide 7 architecture diagram has a corresponding real component (no diagram-only fiction) and a corresponding node in Studio's live graph.

## 7. Open questions

- LLM provider: **Ollama (local, `qwen2.5:7b`) primary, OpenRouter (free tier) fallback** — decided, see 4.5. Model slugs set via `OLLAMA_MODEL`/`OPENROUTER_MODEL` env vars.
- Whether Critic Agent is in scope for v1 or stretch.
- Live graph transport: SSE vs WebSocket for backend→Studio event stream — pick based on FastAPI ergonomics.
- Whether local vector DB needs a container (Podman available but presenter prefers it off/closed for memory) — default to pure-Python in-process store to avoid needing it running during demo.

## 8. Milestones

1. `uv`-managed backend scaffolded; single agent + tool call instrumented with Langfuse, trace visible in Langfuse Cloud UI, running against local Ollama.
2. Supervisor + 2 specialist agents, trace correlation across agents (nested spans, one trace ID).
3. FastAPI backend exposes `/chat` + run-event stream; Next.js+shadcn Studio chat UI wired to it, each turn shows "View trace ↗".
4. Studio live agent graph animates in real time off the event stream, matching Slide 7 diagram.
5. Langfuse Dataset + induced failure + fix loop scripted; Studio eval dashboard renders before/after dataset run results with trace links.
6. Dry run full demo script end-to-end (Studio-driven), timed, confirm no dependency on Docker/Podman being up.
