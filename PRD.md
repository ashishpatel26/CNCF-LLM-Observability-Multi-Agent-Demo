# PRD: ClaimsPilot — Multi-Agent Health Insurance Claims Adjudication (with Agents Studio Observability)

## 0. Pivot note

This project started as a generic 3-agent chat demo for a CNCF observability talk. Pivoted to a concrete industry use case — **health insurance claims adjudication** — because a real domain gives the multi-agent story actual stakes (auditability, regulatory scrutiny, fraud cost) instead of toy examples. Pattern modeled on real-world "MediSuite-AI-Agent"-style systems: multiple backend agents check hospital bills against payer policy, cross-reference patient medical history, and route exceptions — see industry research below. The observability/Langfuse/Studio-frontend infrastructure built for the original demo carries over unchanged; only the agents, tools, data model, and frontend content change.

**Sources informing this pivot:**
- Enterprise multi-agent orchestration production patterns (Salesforce Agentforce, JPMorgan LLM Suite) — claims processing and compliance review named as common regulated-industry use cases.
- AI-for-claims-processing research: FNOL (First Notice of Loss) intake → policy/eligibility verification → damage/cost assessment → fraud scoring (cross-checked against external databases + historical patterns) → case summarization → auto-approve or route to human adjuster. Carriers report FNOL-to-triage time dropping from 4–8 hours to under 5 minutes with agentic workflows.

## 1. Purpose

Build a small but real multi-agent claims-adjudication pipeline, instrumented end-to-end, that also serves as the live demo for the talk "From AI Agent to Production Multi-Agent System — and where observability fits." A claim goes in, three specialist agents each add findings in sequence, a deterministic decision gate approves/denies/escalates — and every step is traced, so a presenter (or a real reviewer) can reconstruct exactly why a claim landed where it did.

## 2. Audience

Two audiences share this build:
1. **Product audience:** a claims-ops or engineering team evaluating whether agentic adjudication is trustworthy enough to pilot — they care about auditability and correctness.
2. **Talk audience:** beginner-to-intermediate engineers new to agents — the claims domain gives them a concrete, high-stakes example instead of an abstract one.

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

### 4.1 Agents — sequential claims pipeline

Every claim runs through all three specialist agents **in order** (pipeline, not router) — this is the key architectural shift from the original demo, and it matches how real claims adjudication works: each agent adds findings, nobody skips a step.

1. **FNOL Intake** (not an LLM agent — deterministic parsing) — normalizes the incoming claim into structured fields: `claim_id`, `patient_id`, `policy_id`, `procedure_code`, `billed_amount`, `provider`.
2. **Policy Verification Agent** — tool: `check_coverage(policy_id, procedure_code)`. Confirms the procedure is covered, checks deductible/limits, flags exclusions.
3. **Medical History Agent** — tool: `lookup_medical_history(patient_id)`. Cross-references the claim against the patient's prior treatments/conditions for consistency (e.g. procedure matches a known diagnosis).
4. **Fraud/Exception Agent** — tool: `fraud_score(claim_id)`. Compares billed amount against typical cost for the procedure, checks prior claim patterns, flags conflicts surfaced by the earlier two agents.
5. **Decision Gate** (deterministic, not an LLM call) — combines the three agents' findings: coverage denied → **deny**; fraud score above threshold OR medical-history conflict → **route to human review**; otherwise → **auto-approve**. Kept deterministic on purpose — the decision that actually pays or denies money should not depend on an LLM's phrasing that day; the agents produce *findings*, the gate applies the *policy*.

Each agent: claim + prior findings in → LLM decides what to check → tool call → structured finding out → next agent in the pipeline.

**Framework: CrewAI** — declarative Agent/Task/Crew definitions are easy for a beginner audience to read; CrewAI's built-in LLM param accepts any OpenAI-compatible base_url, so it points at the Ollama→OpenRouter fallback chain in [llm.py](../src/llm.py). Langfuse instruments via CrewAI's LiteLLM callback hooks (CrewAI uses LiteLLM under the hood) so spans still capture per-agent/tool/LLM detail despite the framework layer. `Process.sequential` (already CrewAI's mechanism from the original build) maps directly onto the claims pipeline — no framework change needed, only agent/task content.

### 4.2 Tools

Tool data is served by a small **local MCP server** (`src/mcp_server.py`, stdio transport) rather than plain Python functions called in-process — this demonstrates MCP as the tool-integration layer between agents and backend systems, which is itself a relevant observability surface (an MCP call is a span, same as any other tool call). CrewAI agents consume it via CrewAI's MCP tool adapter.

- `check_coverage(policy_id, procedure_code)` — small mock policy table: coverage status, deductible, exclusions.
- `lookup_medical_history(patient_id)` — mock patient history: prior diagnoses/procedures, used for consistency checks.
- `fraud_score(claim_id)` — mock fraud-signal table: billed-amount-vs-typical-cost ratio, prior-claim-pattern flags.

Replaces the original demo's `vector_search`/`k8s_status`/`ticket_lookup` mocks — same "stub returns canned structured data" pattern, new domain, now MCP-served instead of direct function calls.

### 4.3 Observability plane — full Langfuse feature set (not tracing alone)

Core product principle: this app exists to make Langfuse's value legible on a real workload, so it deliberately uses more than bare tracing.

- **Backend:** Langfuse Cloud (free tier) — hosted, no local infra/container runtime needed (this machine has no docker/podman).
- **Tracing:** every agent step, LLM call, and MCP tool call is a nested span; single trace ID threads through the pipeline for one claim.
- **Sessions:** one Langfuse **Session** per claim, grouping that claim's entire pipeline trace (all 3 agent spans + decision) — lets a reviewer open one claim and see everything that happened, not one span at a time.
- **Users:** each trace tagged with the claim's `patient_id` as the Langfuse user identifier — enables cost/usage/latency breakdown by patient, and models how a real multi-tenant claims system would attribute spend.
- **Datasets:** the eval set (5-10 sample claims with known-correct decisions) is a real **Langfuse Dataset**, not a SQLite table — items are `{claim, expected_decision}` pairs.
- **Dataset Runs:** each eval run is a Langfuse **Dataset Run**, linking every sample claim to the trace it produced — before/after comparison for the seeded-failure-fix story uses two named runs.
- **Scores:** every claim gets a Langfuse **Score** — `decision_correct` (boolean, against the eval dataset's expected outcome) recorded on its trace.
- **LLM-as-judge (app-managed):** Langfuse's server-side LLM-as-judge evaluator/rule engine is API/UI-configured and its exact request schema wasn't verifiable at build time without risking a broken integration — so this is implemented as an in-app judge call (a small LLM prompt comparing each agent's finding against its own tool output) that writes a real Langfuse **Score** (`groundedness`) via the SDK's `create_score`. Same observability value (a continuous groundedness signal visible in Langfuse), different execution location (our app, not Langfuse's evaluator infra). Migrating to Langfuse's native evaluator rules is a clean follow-up once the API schema is confirmed against the live account.
- **Access:** Langfuse project API keys (public/secret) via env vars; presenter/reviewer views traces, sessions, datasets, and scores live in Langfuse Cloud UI.
- **Metrics captured, by category** (mirrors deck's 4-category split — now backed by real Langfuse objects, not just described):
  - System: latency, error rate per span (Tracing)
  - LLM: tokens in/out, latency, model, cost estimate, by patient (Tracing + Users)
  - Agent: tool chosen, # steps, per-claim grouping (Tracing + Sessions)
  - Quality: `decision_correct` score, LLM-as-judge groundedness score (Scores + LLM-as-judge)

### 4.4 Eval loop

- Eval set: 5-10 sample claims with known-correct expected decisions, stored as a **Langfuse Dataset** (see 4.3) — not a local SQLite table.
- Each eval pass is a **Langfuse Dataset Run**: every sample claim runs through the real pipeline, producing a trace linked back to its dataset item.
- A `decision_correct` **Score** is recorded per run item; the portal's eval dashboard reads pass/fail from Langfuse (via API), not a local cache, so the dashboard is a real view onto Langfuse data.
- One deliberately-seeded failure case demonstrates the full loop: trace shows an agent missed a policy exclusion or medical-history conflict → claim added to the Langfuse Dataset → agent prompt/tool logic fixed → a second named Dataset Run re-scores green → portal shows the before/after comparison.
- LLM-as-judge groundedness scores (see 4.3) run continuously on every claim, not just the eval set — this is the "quality signal in production," distinct from the eval set's "quality signal before shipping a change."

### 4.5 Tech stack (confirmed/decided)

**Backend**
- Python 3.12, managed via `uv` (no system Python) — `uv add`, `uv run`.
- **CrewAI** — agent framework (Agent/Task/Crew, sequential process; see 4.1).
- **FastAPI** — HTTP API layer wrapping the crew runtime for the Studio frontend.
- **LLM:** Ollama (local, `qwen2.5:7b`, runs on RTX 3060 6GB) primary, OpenRouter (free tier) fallback — both via CrewAI's LiteLLM-backed `LLM` class ([llm.py](../src/llm.py)). Flipped from the original OpenRouter-primary plan after testing showed the free OpenRouter model (Nemotron Super) hallucinated tool-output details (invented ticket descriptions/priorities) despite calling the tool correctly, while local qwen2.5:7b returned tool output verbatim every time.
- **SQLite** — local app database (file-based, zero setup, inspectable with any SQLite browser/CLI). Stores:
  - `claims` — submitted claims, current status, final decision.
  - `claim_findings` — one row per agent per claim (Policy/Medical History/Fraud), the structured finding it produced, and its Langfuse trace ID/URL, so the portal can render a claim's audit trail without re-querying Langfuse.
  - Local eval dataset/scenarios + cached before/after run results, mirroring what's authoritative in Langfuse Datasets, for fast Studio dashboard reads.
- **Langfuse Python SDK** — trace/span instrumentation via LiteLLM callback (CrewAI runs on LiteLLM under the hood).
- **No Docker/Podman required** — every component is a plain Python process or a hosted service (OpenRouter, Langfuse Cloud). Podman is available on this machine if ever needed but not part of the required path.

**Frontend — "ClaimsPilot" portal**
- **Next.js** + **shadcn/ui** — a claims-ops portal, not a chat app: a claims queue, a claim detail/audit-trail view, and an eval dashboard.
- Talks to FastAPI backend via REST (`/claims`, `/claims/{id}`, `/evals`) + **SSE** for the live in-flight pipeline event stream while a claim is being adjudicated (Langfuse ingestion is async/batched — too slow for real-time UI, so live view is sourced from in-process backend events; Langfuse stays system of record for after-the-fact trace detail).

**Backend API surface (FastAPI):**
- `POST /claims` — submit a new claim (FNOL fields), runs the pipeline, persists findings + decision to SQLite.
- `GET /claims` — the claims queue: id, patient, procedure, status, decision, submitted-at.
- `GET /claims/{id}` — one claim's full audit trail: FNOL data + each agent's finding + decision + Langfuse trace links.
- `GET /claims/{id}/events` (SSE) — live step feed while a claim is being adjudicated, drives the portal's pipeline-progress view.
- `GET /evals` — eval dataset + before/after results (SQLite cache, backed by Langfuse Datasets as source of truth).

**Frontend pages (v1):**
1. **Claims queue** — table of submitted claims: patient, procedure, billed amount, status (processing/approved/denied/needs review), submitted-at. Click through to detail.
2. **New claim** — a form modeled on FNOL intake fields (patient, policy, procedure, provider, billed amount) instead of a free-text chat box — this is a claims system, not a chatbot.
3. **Claim detail / audit trail** — the claim's data at top, then a timeline of the three agents' findings in order (Policy Verification → Medical History → Fraud/Exception), each with a **"View trace ↗"** link to its Langfuse span, then the final decision with the reason it was reached.
4. **Eval dashboard** — pass/fail table + before/after comparison for the seeded-failure-fix story (Slide 8), each row linking to its Langfuse trace.

**Explicitly out of scope for portal v1:** auth/login, multi-user accounts, real document/photo upload (FNOL fields are structured text only), mobile layout polish.

### 4.6 Architecture diagram

```
┌──────────────────────────┐   REST /claims, /claims/{id}, /evals   ┌───────────────────────────┐
│  ClaimsPilot (Next.js    │ ─────────────────────────────────────► │   FastAPI backend (uv)    │
│  + shadcn/ui)            │ ◄───────────────────────────────────── │                           │
│  - Claims queue          │        SSE /claims/{id}/events         │  - runs the claims         │
│  - New claim (FNOL form) │                                        │    pipeline sequentially   │
│  - Claim detail / audit  │                                        │  - persists claims +       │
│    trail                 │                                        │    findings to SQLite      │
│  - Eval dashboard        │                                        └─────────────┬─────────────┘
└──────────────────────────┘                                                      │
                                                                                   ▼
                                        ┌───────────────────────────────────────────────────────────────────┐
                                        │                    CrewAI Crew (sequential)                        │
                                        │  Policy Verification → Medical History → Fraud/Exception → Decision│
                                        │  (check_coverage)      (lookup_medical_    (fraud_score)    Gate    │
                                        │                          history)                          (deterministic)│
                                        └────────┬─────────────────────┬──────────────────┬──────────────────┘
                                                 │                     │                  │
                                                 ▼                     ▼                  ▼
                                          mock policy table   mock patient history   mock fraud-signal table
                                                 │
                    LLM calls (LiteLLM) ────────┼──────────────────────────────────────┐
                                                 ▼                                       ▼
                                     Ollama local (primary, qwen2.5:7b)      OpenRouter (free tier, fallback)
                                                 │
                                                 ▼
                                    Langfuse Cloud (traces/spans/evals,
                                    via LiteLLM callback)
```

SQLite and Langfuse are deliberately separate: SQLite is the app's own operational store (the claims queue and audit trail the portal reads directly), Langfuse is the observability/eval system of record (what every "View trace ↗" link ultimately points back to).

## 5. Demo narrative mapping (drives what UI must show on screen)

| Deck moment | Platform must show |
|---|---|
| Slide 1: single LLM → agent → tools → multi-agent | Submit a claim, watch the pipeline progress from FNOL intake through all three agents to a decision |
| Slide 2: HTTP 200 ≠ correct | Real, observed example: an agent calls its tool correctly but still misses a policy exclusion or medical-history conflict — the claim "succeeds" (a decision was reached) but the decision is wrong. Caught by eval, not visible from the claim status alone. |
| Slide 3: trace anatomy | "View trace ↗" on a claim's audit-trail entry opens Langfuse nested spans: agent → LLM → tool call |
| Slide 4: multi-agent trace + failure propagation | A claim where the Fraud/Exception agent's tool call fails — the pipeline still reaches a decision, but the audit trail shows the missing finding |
| Slide 5: 4 metric categories | Langfuse trace view (linked from the portal) split into System/LLM/Agent/Quality |
| Slide 6: tool landscape layers | (Slide-only, no platform requirement) |
| Slide 7: full architecture | Portal's pipeline stages match the boxes-and-arrows diagram exactly (naming parity) |
| Slide 8: improvement loop | Eval dashboard: before/after dataset run rows for sample claims, each linking to its trace |

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
