# Presentation Review

**Talk:** From AI Agent to Production Multi-Agent System — and where observability fits
**Event:** Cloud Native Day Gandhinagar, Sept 5 2026 · 45-min technical session · Advanced DevOps & Infrastructure track
**Reviewed:** `presentation.html` against the original brief (progressive-reveal Slide 1, one master diagram reused across slides, four-lens observability, layered tool landscape, production architecture, improvement loop) and against the actual project built this session (**Meridian Claims** — a health-insurance claims-adjudication multi-agent system with CrewAI, MCP, Langfuse, FastAPI, Next.js).

---

## Overall verdict

The deck is genuinely well-built and matches the brief closely — better than most conference decks I'd expect from a spec like this. It correctly:

- Opens with "how does an agent work" before "here's observability" (brief's core sequencing request).
- Uses **one master SVG diagram** (`masterSVG()`) cropped/staged/highlighted differently per slide instead of eight unrelated diagrams — this was the brief's single most specific ask ("Next step" section) and it's implemented exactly as described, via a parametric `stage` + `hide`/`fade` system.
- Implements the 5-stage progressive reveal on Slide 1 (LLM → +loop → +tools/memory → +agents → +observe) with real interactive stepper buttons, not just static bullets.
- Covers all 8 conceptual slides from the brief (mental model, HTTP-200 problem, trace anatomy, multi-agent failure, four lenses, tool landscape, production architecture, improvement loop) plus a title slide and closing slide — 11 total.
- The engineering is unusually careful for a slide deck: single fixed 1280×720 stage scaled to viewport (consistent on any projector), keyboard nav, touch swipe, auto-cycling animations (Slide 4 failure replay, Slide 8 ring), a `core` one-liner per slide that states the takeaway explicitly.

This is a strong deck. The review below is about **content alignment with the actual project**, a few structural risks for a live 45-minute talk, and small execution gaps — not a rebuild request.

---

## 1. Biggest gap: the deck doesn't reflect the project you actually built

This is the main finding. The brief (and the deck) describe a **generic** 3-agent system: Research/Infra/Support agents, vector DB / Kubernetes / external APIs, LangSmith + OTel + gateway. That's exactly what we started with early in this session — but the project was deliberately **pivoted mid-session** to something more concrete and higher-stakes: **Meridian Claims**, a health-insurance claims-adjudication pipeline (Policy Verification → Medical History → Fraud/Exception agents, MCP-served tools, CrewAI sequential pipeline, Langfuse Sessions/Users/Datasets/Scores, a full Next.js portal with live SSE agent activity).

None of that pivot is reflected in the deck:

- Slide 1's diagram still says "Research Agent / Infra Agent / Support Agent" with "vector db / kubernetes / external apis" — the generic pre-pivot shape.
- Slide 4's live-replaying failure scenario is a generic `tool.k8s_api → HTTP 500` story, not a claims scenario (e.g., "Fraud/Exception agent's tool call times out — the pipeline still reaches a decision, but the audit trail shows the missing finding," which is literally what's documented in `PRD.md` §5 as the intended Slide 4 narrative).
- Slide 7's production architecture shows "Research/Infra/Support → Vector DB/K8s/APIs" instead of the real running system: FastAPI + CrewAI + MCP server (stdio) + Ollama-primary/OpenRouter-fallback + Langfuse Cloud, which is what's actually deployed and demonstrable right now.
- There's no mention anywhere in the deck of **MCP** as the tool-integration layer, despite that being a real, working, and fairly novel part of what was built (agents call tools via `MCPServerStdio`, not direct function calls) — this is a legitimate differentiator for an "advanced DevOps & infrastructure" track audience and costs nothing to add since it already works.
- Slide 6 (tool landscape) name-checks LangSmith/Langfuse/Arize Phoenix/LiteLLM generically, but doesn't mention that **Langfuse specifically** — Sessions, Users, Datasets, Dataset Runs, Scores, and an app-managed LLM-as-judge — is the system actually wired into the demo. If the plan is to live-demo Meridian Claims (recommended — see §3), the deck should set up the exact tool the audience is about to watch, not a generic vendor list.

**Recommendation:** decide explicitly whether this talk demos Meridian Claims live, or stays conceptual/generic. If it demos live (strongly recommended — a working claims-adjudication portal with real MCP tool calls and a real Langfuse trace behind every "View trace ↗" link is a genuinely rare thing to show at a conference), the deck's diagrams (Slides 1, 4, 7) should be re-skinned with the claims domain: Policy Verification / Medical History / Fraud agents, MCP tool calls, and a claim-decision failure scenario instead of a Kubernetes-API failure. The `masterSVG()` function's `col()`/`res()` helpers (lines defining `RESEARCH AGENT`/`INFRA AGENT`/`SUPPORT AGENT` and `vector db`/`kubernetes`/`external apis`) are the only place this needs to change — the architecture is already parametric, so this is a content edit, not a rebuild.

---

## 2. Slide-by-slide notes

### Slide 00 — Title / root span
Strong. The "session boot" typed-terminal conceit (root span opens, speaker metadata prints like log lines) is a clean way to establish the trace/span vocabulary before the audience has seen a single technical slide. The `talk.preview` bar showing the whole 45-minute session as one trace with clickable segments is a nice touch that pays off the "everything is a trace" thesis before it's even been stated.

One risk: the QR code fallback (`fallback()` in the script) draws a **fake-looking QR pattern** (sine/cosine noise, not a real scannable code) if the `qrcode-generator` CDN fails to load. If this talk is delivered from a venue with unreliable/filtered wifi, that fallback will render a QR code that looks real but doesn't scan — worse than no QR code, since the audience won't know it's broken until they've tried. Recommend testing the venue's network beforehand, or replacing the fallback with a plain text URL rendered large instead of a fake-looking QR.

### Slide 01 — The Mental Model
This is the deck's centerpiece and it's well executed — the progressive reveal (`setStage()`, 5 stages, `CAPS` array of one-liner captions per stage) matches the brief's explicit request almost line-for-line, including the suggested narration ("before we talk about observability, let's understand what we're observing" → ... → "we no longer have a chatbot, we have a distributed system").

Gap: as noted in §1, the multi-agent stage (stage 4) shows Research/Infra/Support — generic. If re-skinned to Policy/Medical History/Fraud, the narration also needs a one-line adjustment (the brief's script says "imagine replacing one agent with five specialized agents" — Meridian Claims has three, which is fine, just say three, not five, to avoid a live discrepancy with what's about to be demoed).

### Slide 02 — Why Traditional Observability Isn't Enough
Matches the brief closely (Traditional Service → HTTP 500 vs Agent → confident HTTP 200). The overlay stamps ("wrong reasoning", "wrong tool", "wrong answer — confident, useless") land the point visually rather than just verbally, which is good for a technical-but-visual audience.

This slide is where the deck could use the **real, observed example** already documented in this project's own PRD (§5, Slide 2 row): "an agent calls its tool correctly but still misses a policy exclusion or medical-history conflict — the claim 'succeeds' but the decision is wrong." That's a stronger, truer claim than a generic illustration, because it's a bug we actually found and fixed during this build (the CLM-9004 seed-data issue, and the medical-history agent drifting onto an unrelated prior procedure code before the prompt was tightened). Real "it happened to us" anecdotes land better live than illustrative diagrams.

### Slide 03 — Anatomy of an Agent Trace
Good trace/span vocabulary slide. The hover-to-highlight interaction (mousing over a trace row dims everything in the diagram except the matching system component) is a genuinely good teaching device — it's the kind of interaction that makes people go "oh, I get it" in a live room.

Minor: the trace shown (`llm.think`, `retrieval.search`, `tool.api_code`, `memory.update`, `eval.groundedness`) is generic/illustrative. Since Meridian Claims produces **real Langfuse traces** right now with real span names (agent LLM calls, MCP tool calls, groundedness scores), consider swapping in an actual trace ID and real span names/durations pulled from a real run — it's a small change that upgrades "illustrative" to "this is what I'm about to show you live."

### Slide 04 — Multi-Agent: Where Failure Is Born
The auto-replaying failure scenario (supervisor → infra → k8s HTTP 500 → critic rejects → supervisor replans → research recovers) is a strong dramatic beat and the animation (highlighting nodes, streaming a live-looking log) is well done technically.

As in §1: this is the slide most worth re-skinning if Meridian Claims is demoed live, because the deck's PRD already specifies almost exactly this beat for the claims domain ("a claim where the Fraud/Exception agent's tool call fails — the pipeline still reaches a decision, but the audit trail shows the missing finding"). Using the invented k8s/critic-agent story right before switching to a live demo of a system that has neither a critic agent nor a Kubernetes tool risks a jarring "wait, that's not what we're about to see" moment for an attentive audience.

### Slide 05 — What Should We Observe?
This is the deck's most information-dense slide (four lenses × their sub-metrics, plus a zone-mapped diagram, plus the "traditional + LLM + agent + evals = AI observability" equation) and it's handled well — the zone overlay on the shared master diagram (`zones:true`) visually answers "where does each lens actually look" rather than just listing categories in isolation, which is exactly what the brief asked for.

No changes needed here — this slide doesn't depend on which agent domain is used, and it's conceptually the strongest "beginner gets it" slide in the deck.

### Slide 06 — The Tool Landscape
Clean five-layer treatment matching the brief's layered (not vendor-comparison-first) request. As noted in §1, this is a natural place to add a **Langfuse-specific** callout since the actual project deliberately wired up more than bare tracing (Sessions, Users, Datasets, Dataset Runs, Scores, app-managed LLM-as-judge) — worth one extra chip or a sentence distinguishing "tracing" from "the fuller observability surface," since that distinction is one of this project's real, hard-won lessons (documented explicitly in `PRD.md` §4.3 as a deliberate design choice, including the honest caveat about why the LLM-judge is app-managed rather than Langfuse's native evaluator-rule engine).

### Slide 07 — Production Architecture
Billed as "the architectural climax" and it reads that way — the full system on one diagram plus a real-looking OpenSearch query example plus the three concrete integration paths (agent traces → LangSmith, OTel → Collector → OpenSearch, LLM traffic → Gateway → providers).

This is the single highest-value slide to update with the real architecture, because it's the slide explicitly designed to be "here's the production system" — and this project has a production system running, right now, with a real diagram already drafted in `PRD.md` §4.6 (FastAPI backend, CrewAI sequential crew, MCP-served tools, Ollama/OpenRouter fallback chain, Langfuse Cloud). Swapping in that diagram (or a simplified version of it) turns this slide from "here's how you'd architect this" into "here's what I built and is running on my laptop right now" — a meaningfully stronger claim for a technical audience, and sets up a live demo perfectly if one is planned.

### Slide 08 — The Production Improvement Loop
The auto-cycling ring (8 phases: PRODUCE → TRACE → DETECT → DATASET → EVAL → FIX → REGRESSION → DEPLOY) is visually strong and the closing triplet ("observability tells us what happened / evaluation tells us whether it was good / together, improve the agent safely") is a clean, quotable closing line matching the brief's suggested wording almost verbatim.

This project has a real instance of this exact loop already: the CLM-9004 seed-data bug found via `run_evals.py`, fixed in `mcp_server.py`'s fraud-signal table, re-run to green (documented in this session's own history — a real "baseline run had 1 failure, fixed run is green" story). If time allows, replacing the abstract loop description with 30 seconds of "here's a bug I found running my own eval suite this week" would be one of the strongest moments in the talk — it's the brief's own advice ("real anecdotes land better than illustrations") applied to material that's sitting right here in the project's git history.

### Slide 09 — If You Remember One Picture
Good closing-mental-model slide, directly matching the brief's final "one picture" ask almost exactly (agent = llm + loop + tools + memory; observability = traces + metrics + evals → improvement, with a feedback arrow). No changes needed.

### Slide 10 — CTA / Q&A
Clean, minimal, appropriately brief for a closing slide. The QR code caveat from Slide 00 applies here too (same `fallback()` function).

---

## 3. Structural / delivery risks for a 45-minute live session

- **Pacing:** the deck's own `data-dur` values sum to roughly 20.9 seconds of *animation* time, which is unrelated to actual speaking time — but the segment durations do encode the presenter's own intended relative weighting (Slide 1 gets 3200ms, the largest single share, consistent with "spend the most time on the mental model"). Given 45 minutes total and 10 content spans, that's ~4.5 min/slide on average — Slide 1 (progressive reveal, 5 stages) and Slide 7 (production climax) will likely want 6–7 minutes each if delivered at the pace the brief's suggested narration implies, which means Slides 5–6 (the two densest, but least novel to an infra-savvy audience) are the natural squeeze points if time runs short. Worth rehearsing with a timer against the real venue's clock, not just the deck's `data-dur` values.
- **Live demo integration:** the deck currently has no dedicated "now watch this happen live" slide or explicit hand-off point. If Meridian Claims is demoed live (recommended given how much of this session went into making the live-agent-activity experience — SSE streaming, the floating thinking widget, the global activity drawer — genuinely demoable), it needs an explicit moment in the flow, most naturally right after Slide 07 (production architecture) and before Slide 08 (improvement loop), so the audience sees the architecture, then sees it running, then sees how it gets better over time.
- **Fallback risk:** several of the deck's liveliest moments (Slide 4's auto-replaying failure trace, Slide 8's auto-cycling ring, the QR code) depend on JS execution and/or CDN availability. Worth a full offline dry-run (disconnect wifi, reload) before the actual session, since conference wifi is a known failure mode and the `qrcode-generator` CDN dependency plus the fully client-side animation logic are the only external dependencies in an otherwise self-contained single HTML file.

---

## 4. Small execution notes (low priority, easy fixes)

- Title tag and several strings show visible mojibake (`Â·`, `â`, `â¸`, `Ã` in place of what should be em-dashes, middle dots, and arrows) — the file appears to have been saved/transmitted with a charset mismatch somewhere, since `<meta charset="UTF-8">` is declared correctly but the literal bytes in the HTML don't match. Worth a find-and-replace pass (`Â·` → `·`, `â` → `—`, `â¸` → `▸` or similar, `Ã—` → `×`) before the real event — this is currently the single most visible defect and would be embarrassing on a projector.
- `evals/regression.jsonl` and `docker-compose.yml` appear as repo chips on the closing slide (Slide 10) — this project doesn't use Docker Compose (deliberately, per `PRD.md` — "No Docker/Podman required"), so that chip references infrastructure that doesn't exist in the actual repo. Swap for something real, e.g. `mcp_server.py`, `agents.py`, or `seed_evals.py`.

---

## Summary

The deck is well-crafted and faithfully implements the brief's specific structural requests (progressive reveal, one master diagram, four-lens observability, layered tools, production climax, improvement loop, one final picture). The main opportunity is aligning its content with the real system this project ended up building — Meridian Claims — particularly on Slides 1, 4, and 7, since the project has genuine, demoable, already-working material (MCP tool calls, live SSE agent activity, real Langfuse traces, a real caught-and-fixed eval bug) that would make several of the deck's illustrative moments into "here's the actual thing" moments instead — which is consistently more compelling for a technical audience than a well-drawn but generic diagram.
