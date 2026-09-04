# Speaker Script — "Use Observability"
Cloud Native Day Gandhinagar · 45-minute session · Ashish Patel

Plain-language narration for every slide, plus exact moments to switch over and show real Langfuse Cloud screens. Total: ~13 slides, budget roughly 3 minutes each with room to breathe.

**Before you start:** open two browser tabs — the deck (`presentation-v2.html`) and Langfuse Cloud (your Meridian Claims project), logged in, `Traces` view open. Also have `localhost:3000` (the Meridian Claims portal) ready in a third tab.

---

## Slide 0 — Title (root span)

**Say:**
"Hi everyone. My talk today is called 'Use Observability' — and the subtitle tells you the journey we're going to take: from a single AI agent, all the way to a production multi-agent system, and where observability actually fits into that picture.

I'm Ashish, Senior Principal Architect at Oracle, working across AI, ML, and data science. Everything I show you today is real — a system called Meridian Claims that I built specifically for this talk, and I'll be running it live, not just showing you slides of it."

**Do:** let the boot terminal animation play out — it's designed to look like a real system starting up. Point at it once: "this little animation? Also real — it's literally listing what we're about to cover, framed as a trace."

---

## Slide 1 — The Mental Model (5-stage build)

**Say (Stage 1 — just LLM):**
"Let's start as simple as possible. This box — an LLM — is not an agent. Text goes in, text comes out. It has no memory of what happened before, it can't do anything except respond. Like a very smart autocomplete."

**Say (Stage 2 — + Loop):**
"Now watch what happens when I wrap that LLM in a loop. This is the actual definition of an agent: it understands a goal, decides what to do, acts, and then observes what happened — and can loop back and decide again. That loop is the whole trick."

**Say (Stage 3 — + Tools/Memory):**
"An agent that can only think isn't useful. Give it tools — real actions it can take, like calling an API — and memory, so it remembers what it already found out. Now it can actually do something in the real world."

**Say (Stage 4 — + Agents):**
"Now here's the jump that matters for today's talk. Instead of one agent doing everything, what if we split the work? One supervisor, and three specialists, each an expert in one thing. In my real system, those three specialists check insurance policy coverage, look up a patient's medical history, and screen for fraud. The moment you do this, you don't have a chatbot anymore — you have a distributed system, with multiple things happening, handing off work to each other."

**Say (Stage 5 — + Observe):**
"And that's exactly where today's actual subject comes in — observability. The moment you have multiple things happening across multiple agents, you need one thing to see all of it, tie it together, and let you ask 'what actually happened, step by step, for this one request?' That's the layer we're going to spend the rest of the talk on."

---

## Slide 2 — Why Traditional Observability Isn't Enough

**Say:**
"Here's the problem in one sentence, in plain English: a normal computer program either works or it crashes. If something goes wrong, you get an error, a red alert, a 500 status code — something loud that tells you immediately.

An AI agent doesn't work that way. Watch this: the agent calls the right tool, gets a real answer back, and still returns a wrong decision — and the system reports success. HTTP 200. Everything looks fine from the outside.

In my example — a health insurance claim — that's not a cosmetic bug. If a claim gets denied for the wrong reason, and there's no way to reconstruct *why* the AI decided that, that's not just a bad user experience. That's a compliance and legal liability problem for an insurance company. 'It looked fine' is not good enough when real money and real people are involved."

---

## Slide 3 — Anatomy of a Claim's Trace

**Say:**
"So what does 'seeing what actually happened' look like in practice? This is called a trace — think of it as a receipt for one single request, showing every step the system took, in order, with real numbers.

This isn't invented — this is a real trace shape from my system. One claim comes in, the agent decides what to do, it calls a tool to check the insurance policy, it gets an answer back, and — this last one is important — a small AI judge automatically scores whether the answer was actually grounded in what the tool said, or whether the AI made something up.

Hover over any of these rows" — *[hover live if presenting on a laptop with mouse]* — "and you can see exactly which part of the system that step came from. Nothing here is a black box."

---

## Slide 4 — Multi-Agent: Where Failure Is Born

**Say:**
"Now let's make it harder. Watch this animation replay — it's simulating a real scenario I actually hit while building this. The policy check works fine. The medical history check works fine. Then the fraud-check tool call times out — no answer comes back. What happens?

The system doesn't crash. It doesn't return an error. It makes the conservative call: since it couldn't confirm there's no fraud risk, it routes the claim to a human for review, instead of guessing. That's actually the right behavior — but here's the point: without a trace, all you'd see is 'this claim went to review.' You wouldn't know *why*. With the trace, you can see exactly which of the three agents didn't get an answer, and why the system made the safe choice instead of the wrong one."

---

## Slide 5 — What Should We Observe?

**Say:**
"Let's zoom out. When people say 'observability for AI agents,' they usually only mean one of four things, and they're all incomplete on their own.

One: the same system-level stuff you already watch today — is the server up, is the database responding.

Two: the LLM itself — how many tokens did it use, how fast did it respond, what did it cost. In my case, I'm running a model locally, so my cost is literally zero dollars per call — but latency still matters.

Three — and this is the one most teams miss — the agent's own decisions. Which tool did it pick? Did it loop forever? Did it hand off to the right specialist?

Four: quality. Was the answer actually correct? Was it grounded in real data, or made up? This is the layer everyone forgets, right up until it costs them.

You need all four together. Miss one, and you're blind on exactly that axis — and you won't know it until something goes wrong there specifically."

---

## Slide 6 — The Tool Landscape

**Say:**
"So what do you actually use to get all four of those? Think of it as five layers, from the ground up: your infrastructure, your normal application logging, how you route and pay for LLM calls, how you trace what the agents are doing, and finally, evaluation — catching regressions before they ship.

In my system specifically, one tool — Langfuse — does more of that agent and evaluation work than people usually expect from a single tracing tool. I'll show you exactly what I mean in a minute, live."

**Note:** flag the honest caveat verbally if asked in Q&A: "one thing I'll be upfront about — the AI-judge scoring I use is something I built myself in my own code, not Langfuse's own built-in judge feature. That's a deliberate choice for now, and a known next step."

---

## Slide 7 — Production Architecture (conceptual)

**Say:**
"Put it all together, and this is what a production version looks like. The important idea here: the observability layer isn't a dashboard you bolt on afterward. It's wired into the architecture from day one, sitting right alongside the actual agent logic."

---

## Slide 8a — "Meet The System" (Meridian Claims diagram) [NEW]

**Say:**
"Enough abstraction — this next one is not a generic diagram. This is the literal, real architecture of the exact system I'm about to show you running. A Next.js web app on top. A Python backend underneath it. Three AI agents doing the actual claims work, using a small local model that runs on my own laptop's GPU, with a free-tier cloud model as backup if that fails. Every one of those agents talks to its tools through something called MCP — think of it as a very clean, standard way for an AI agent to call a real function, like 'check this policy number.' And everything — every agent call, every tool call — reports into Langfuse.

This is the system I'm about to open in a real browser tab, right now."

---

## Slide 9 — LIVE DEMO (switch to the browser)

**This is the centerpiece of the talk. Take your time here — 8-10 minutes.**

### Step 1 — File a real claim
**Say:** "Let's file a real insurance claim, live, right now." Switch to `localhost:3000`. Click "File a new claim." Fill in a real-looking patient, provider, procedure code, and a billed amount. Submit it.

**Say while it processes:** "Watch this little floating box in the corner — it's telling you, in plain language, exactly which agent is thinking right now. This isn't fake — this is a live stream of events coming off the real backend as the agents actually run."

### Step 2 — Show the live audit trail
**Say:** "And here — this timeline is filling in as we watch. Policy check, done. Medical history, done. Fraud check, done. Each one shows the actual answer that agent's tool gave back — not a summary, the real data."

### Step 3 — Click "View trace ↗" — SWITCH TO LANGFUSE
**Say:** "Now here's the moment I want you to remember. Every single one of those steps has a 'View trace' link. I'm going to click it." Click through to the Langfuse Cloud tab.

**In Langfuse, point at and explain each of these, in plain language:**
- **The trace timeline** — "This nested list is every single thing that happened for this one claim, in order, with exact timing. This is the receipt I mentioned earlier — except now it's real, for the claim I just filed thirty seconds ago."
- **Click into one span (an LLM call)** — "This shows me exactly what I sent the AI model, and exactly what it said back. If the AI ever says something wrong, this is where I'd find out why — I can see its exact reasoning."
- **Sessions tab** — "Here's something a lot of tracing tools don't do well. I've grouped every span from all three agents for this one claim into a single Session. So instead of three separate, disconnected traces, I get one timeline for the whole claim, start to finish."
- **Users / filter by patient** — "I've also tagged every trace with the patient's ID. That means I can filter and say 'show me every AI interaction for this one person' — which matters a lot in healthcare, where you need to account for exactly what happened to whom."
- **Scores tab** — "Remember that AI judge I mentioned? Every claim gets a groundedness score automatically — a number saying 'did the agent's answer actually match what the tool told it, or did it make something up.' You're looking at real scores, generated automatically, with zero manual review."

### Step 4 — The eval dashboard
Switch back to the portal, click "Eval dashboard."

**Say:** "This is where the observability turns into something actionable. I keep a small set of sample claims with known-correct answers. Every time I change something in my code, I re-run all of them. Right now you're looking at 4 out of 4 passing — but that wasn't always true."

**Say (the real story):** "While I was building this, one of these test claims failed. The system approved a claim that should have gone to a human for review. I opened the trace, saw exactly which piece of data was missing, fixed one line in my code, re-ran the test — and it went green. That's not a hypothetical. That happened this week, while I was preparing this talk."

---

## Slide 10 — The Production Improvement Loop

**Say:**
"That story I just showed you live — that's this slide, in practice. A real failure becomes a permanent test case. You fix it once, and the system is now protected against that exact mistake forever, on every future change. That's the whole point of closing the loop — production failures make the system safer over time, instead of just being embarrassing incidents you move past."

---

## Slide 11 — If You Remember One Picture

**Say:**
"If you forget everything else today, remember this one picture. An agent is an LLM, wrapped in a loop, with tools and memory. Add more agents, and it becomes a distributed system. And observability — traces, scores, evaluations — is what watches all of it and feeds back into making it better. That loop, right there, is the whole talk."

---

## Slide 12 — Closing / Q&A

**Say:**
"That's it from me. Everything you saw today was real and running — no slides pretending to be a product. Happy to take questions, and I'm on LinkedIn if you want to dig into the code afterward."

---

## Quick-reference: Langfuse concepts, explained in one plain sentence each

Keep this list handy for Q&A — if someone asks "what exactly is a Session vs a Trace," you have the layman's answer ready:

- **Trace** — the full record of one thing the system did, start to finish, made up of smaller steps.
- **Span** — one single step inside a trace (one LLM call, one tool call, one score).
- **Session** — a way to tie multiple traces together as "these all belong to the same real-world event" (in my case: one claim, even though three agents each generate their own trace).
- **User** — tagging traces with who they were for, so you can filter by person later.
- **Dataset** — a saved list of test questions with known-correct answers, used to catch regressions.
- **Dataset Run** — one pass of running your whole dataset through the system and recording what happened.
- **Score** — a number or pass/fail judgment attached to a trace — can be automatic (like my groundedness judge) or manual (a human reviewing it).

## Timing checkpoint (45 min total)

| Segment | Target time | Running total |
|---|---|---|
| Slides 0-1 | 6 min | 6 min |
| Slides 2-4 | 8 min | 14 min |
| Slides 5-6 | 6 min | 20 min |
| Slide 7 + 8a | 4 min | 24 min |
| **Live demo (Slide 9)** | **10 min** | 34 min |
| Slides 10-12 | 5 min | 39 min |
| Buffer / Q&A lead-in | 6 min | 45 min |

If running long: cut Slide 6's tool-landscape detail short (it's the least novel slide to this audience) rather than shortening the live demo — the demo is the whole point.
