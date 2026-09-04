"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, Loader2, Radio } from "lucide-react";
import { getClaim, subscribeClaimEvents, type ClaimDetail, type ClaimEvent } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { ThinkingWidget } from "@/components/thinking-widget";
import { cn } from "@/lib/utils";

const AGENT_LABEL: Record<string, string> = {
  policy: "Policy verification",
  medical_history: "Medical history review",
  fraud: "Fraud screening",
};

const AGENT_ORDER = ["policy", "medical_history", "fraud"];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [liveStages, setLiveStages] = useState<Record<string, "running" | "done">>({});
  const [agentLog, setAgentLog] = useState<Record<string, { time: Date; note: string }[]>>({});
  const [liveDecision, setLiveDecision] = useState<{ decision: string; reason: string } | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    getClaim(id)
      .then((c) => {
        if (!c || "error" in c) {
          setNotFound(true);
          return;
        }
        setClaim(c);
        // Only seed from persisted history for claims already finished — a
        // still-processing claim's activity will keep arriving via SSE, and
        // seeding here too would double up entries that land in both places.
        if (c.status === "done") {
          const seeded: Record<string, { time: Date; note: string }[]> = {};
          for (const a of c.activity) {
            const time = new Date(a.created_at.replace(" ", "T") + "Z");
            seeded[a.agent] = [...(seeded[a.agent] ?? []), { time, note: a.note }];
          }
          setAgentLog(seeded);
        }
      })
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => {
    if (!claim || claim.status === "done") return;

    setConnected(true);
    const unsubscribe = subscribeClaimEvents(id, (event: ClaimEvent) => {
      if (event.type === "stage") {
        setLiveStages((prev) => ({ ...prev, [event.agent]: event.status }));
      } else if (event.type === "step") {
        setAgentLog((prev) => ({
          ...prev,
          [event.agent]: [...(prev[event.agent] ?? []), { time: new Date(), note: event.note }],
        }));
      } else if (event.type === "decision") {
        setLiveDecision({ decision: event.decision, reason: event.reason });
      } else if (event.type === "done") {
        setConnected(false);
        getClaim(id).then(setClaim).catch(() => {});
      }
    });

    return () => {
      setConnected(false);
      unsubscribe();
    };
  }, [id, claim]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-10">
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Claims queue
        </Link>
        <p className="mt-6 text-sm">Claim {id} was not found.</p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-10">
        <p className="text-sm text-muted-foreground">Loading claim…</p>
      </div>
    );
  }

  const isLive = claim.status !== "done";
  const findingsByAgent = new Map(claim.findings.map((f) => [f.agent, f]));
  const decision = isLive ? liveDecision?.decision ?? null : claim.decision;
  const decisionReason = isLive ? liveDecision?.reason ?? null : claim.decision_reason;

  const runningAgent = AGENT_ORDER.find((a) => liveStages[a] === "running");
  const flatSteps = Object.entries(agentLog)
    .flatMap(([agent, entries]) => entries.map((e) => ({ ...e, agent: AGENT_LABEL[agent] ?? agent })))
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Claims queue
      </Link>

      <div className="mt-4 flex items-start justify-between border-b border-border pb-6">
        <div>
          <h1 className="font-mono text-sm text-muted-foreground">{claim.id}</h1>
          <p className="mt-1 font-serif text-2xl font-semibold text-primary">
            {claim.patient?.name ?? claim.patient_id}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {claim.provider?.name ?? claim.provider_id} · CPT {claim.procedure_code} ·{" "}
            {formatCurrency(claim.billed_amount)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {connected && (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-review">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-review opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-review" />
              </span>
              LIVE
            </span>
          )}
          <StatusBadge status={decision ?? "processing"} />
        </div>
      </div>

      {decision && (
        <div className="mt-6 rounded-sm border border-border bg-card px-5 py-4">
          <p className="text-sm font-medium">Decision: {decision.replace("_", " ")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{decisionReason}</p>
        </div>
      )}

      <div className="mt-10 mb-4 flex items-center gap-2">
        <h2 className="font-serif text-lg font-semibold text-primary">Audit trail</h2>
        {isLive && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Radio className="h-3 w-3 animate-pulse text-review" />
            agents working now
          </span>
        )}
      </div>
      <ol className="flex flex-col">
        {AGENT_ORDER.map((agentKey, i) => {
          const finding = findingsByAgent.get(agentKey);
          const liveStatus = liveStages[agentKey];
          const isRunning = isLive && liveStatus === "running";
          const isDone = Boolean(finding) || (isLive && liveStatus === "done");
          const stepLog = agentLog[agentKey] ?? [];
          const liveNote = stepLog.at(-1)?.note;

          return (
            <li key={agentKey} className="relative flex gap-4 pb-8 last:pb-0">
              {i < AGENT_ORDER.length - 1 && (
                <span
                  className={cn(
                    "absolute top-7 left-3.5 h-full w-px transition-colors",
                    isDone ? "bg-primary/40" : "bg-border",
                  )}
                />
              )}
              <span
                className={cn(
                  "z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-medium transition-colors",
                  isRunning
                    ? "border-review text-review shadow-[0_0_0_4px_rgba(168,121,31,0.12)]"
                    : isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground",
                )}
                title={isRunning ? liveNote ?? "Working…" : undefined}
              >
                {isRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isDone ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  i + 1
                )}
              </span>
              <div className="flex-1 pt-0.5">
                <div className="flex items-center justify-between">
                  <p className={cn("text-sm font-medium", isRunning && "text-review")}>
                    {AGENT_LABEL[agentKey]}
                    {isRunning && " — running now"}
                  </p>
                  {finding?.trace_url && (
                    <a
                      href={finding.trace_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                    >
                      View trace
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p
                  className={cn(
                    "mt-1 text-sm",
                    finding ? "text-muted-foreground" : isRunning ? "text-review/80 italic" : "text-muted-foreground/60",
                  )}
                  title={isRunning ? liveNote : undefined}
                >
                  {finding ? finding.finding : isRunning ? (liveNote ?? "Calling tool and evaluating…") : "Pending"}
                </p>

                {isLive && stepLog.length > 0 && (
                  <div className="mt-2 flex flex-col gap-0.5 border-l-2 border-border pl-3 font-mono text-[11px] text-muted-foreground">
                    {stepLog.map((entry, j) => (
                      <div key={j} className="flex gap-2">
                        <span className="text-muted-foreground/60">{formatTime(entry.time)}</span>
                        <span>{entry.note}</span>
                      </div>
                    ))}
                    {isRunning && (
                      <div className="flex items-center gap-2 text-review">
                        <span className="text-review/60">{formatTime(new Date())}</span>
                        <span className="inline-block h-2.5 w-1 animate-pulse bg-review" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <ThinkingWidget
        active={isLive}
        currentLabel={runningAgent ? `${AGENT_LABEL[runningAgent]} is thinking…` : "Starting up…"}
        steps={flatSteps}
      />
    </div>
  );
}
