"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, X } from "lucide-react";
import { listEvals, listClaims, type EvalCase, type EvalResult, type Claim } from "@/lib/api";

function decisionBadgeClass(decision: string | null) {
  if (decision === "approved") return "bg-approved/10 text-approved";
  if (decision === "denied") return "bg-denied/10 text-denied";
  if (decision === "human_review") return "bg-review/10 text-review";
  return "bg-muted text-muted-foreground";
}

export default function EvalsPage() {
  const [cases, setCases] = useState<EvalCase[]>([]);
  const [results, setResults] = useState<EvalResult[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([listEvals(), listClaims()])
      .then(([evalData, claimData]) => {
        setCases(evalData.cases);
        setResults(evalData.results);
        setClaims(claimData);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const latestByCase = new Map<string, EvalResult>();
  for (const r of results) {
    if (!latestByCase.has(r.case_id)) latestByCase.set(r.case_id, r);
  }

  const passCount = [...latestByCase.values()].filter((r) => r.passed).length;
  const failCount = latestByCase.size - passCount;
  const passRate = latestByCase.size ? Math.round((passCount / latestByCase.size) * 100) : 0;

  const runOrder: string[] = [];
  const runStats = new Map<string, { pass: number; total: number; at: string }>();
  for (const r of results) {
    if (!runStats.has(r.run_label)) {
      runOrder.push(r.run_label);
      runStats.set(r.run_label, { pass: 0, total: 0, at: r.created_at });
    }
    const s = runStats.get(r.run_label)!;
    s.total += 1;
    if (r.passed) s.pass += 1;
    if (r.created_at < s.at) s.at = r.created_at;
  }
  const runs = runOrder
    .map((label) => ({ label, ...runStats.get(label)! }))
    .sort((a, b) => a.at.localeCompare(b.at));

  const totalClaims = claims.length;
  const processingCount = claims.filter((c) => c.status === "processing").length;
  const doneCount = claims.filter((c) => c.status === "done").length;
  const totalBilled = claims.reduce((sum, c) => sum + (c.billed_amount ?? 0), 0);

  const decisionCounts = { approved: 0, denied: 0, human_review: 0 };
  for (const c of claims) {
    if (c.decision === "approved") decisionCounts.approved += 1;
    else if (c.decision === "denied") decisionCounts.denied += 1;
    else if (c.decision === "human_review") decisionCounts.human_review += 1;
  }
  const decisionTotal = decisionCounts.approved + decisionCounts.denied + decisionCounts.human_review;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        <h1 className="font-serif text-2xl font-semibold text-primary">Eval dashboard</h1>
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        <h1 className="font-serif text-2xl font-semibold text-primary">Eval dashboard</h1>
        <div className="mt-6 rounded-sm border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
          <p className="text-sm font-medium text-destructive">Could not load eval data.</p>
          <p className="mt-1 text-sm text-muted-foreground">Check that the API server is running, then reload.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="font-serif text-2xl font-semibold text-primary">Eval dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Live analytics across every claim the pipeline has processed, plus regression results
        against the known-correct sample set.
      </p>

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-sm border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Total claims</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-primary">{totalClaims}</p>
        </div>
        <div className="rounded-sm border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">In progress</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-review">{processingCount}</p>
        </div>
        <div className="rounded-sm border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-primary">{doneCount}</p>
        </div>
        <div className="rounded-sm border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Total billed</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-primary">
            ${totalBilled.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Decision distribution + eval pass rate */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-sm border border-border bg-card p-5">
          <p className="text-sm font-medium">Decision distribution</p>
          <div className="mt-4 space-y-3">
            {(
              [
                ["approved", decisionCounts.approved, "bg-approved"],
                ["denied", decisionCounts.denied, "bg-denied"],
                ["human_review", decisionCounts.human_review, "bg-review"],
              ] as const
            ).map(([label, count, color]) => {
              const pct = decisionTotal ? (count / decisionTotal) * 100 : 0;
              return (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="capitalize text-muted-foreground">{label.replace("_", " ")}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {decisionTotal === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">No completed claims yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-sm border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Regression pass rate</p>
            <p className="text-sm text-muted-foreground">{passRate}%</p>
          </div>
          <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {passCount > 0 && (
              <div className="h-full bg-approved" style={{ width: `${(passCount / latestByCase.size) * 100}%` }} />
            )}
            {failCount > 0 && (
              <div className="h-full bg-denied" style={{ width: `${(failCount / latestByCase.size) * 100}%` }} />
            )}
          </div>
          <div className="mt-3 flex gap-6 text-sm">
            <span>
              <strong className="text-lg">{cases.length}</strong>{" "}
              <span className="text-muted-foreground">cases</span>
            </span>
            <span>
              <strong className="text-lg text-approved">{passCount}</strong>{" "}
              <span className="text-muted-foreground">passing</span>
            </span>
            <span>
              <strong className="text-lg text-denied">{failCount}</strong>{" "}
              <span className="text-muted-foreground">failing</span>
            </span>
          </div>

          {runs.length > 1 && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground">Run history</p>
              <div className="mt-3 flex items-end gap-2" style={{ height: 80 }} role="img" aria-label={runs.map((r) => `${r.label}: ${r.total ? Math.round((r.pass / r.total) * 100) : 0}% passing`).join(", ")}>
                {runs.map((r) => {
                  const pct = r.total ? (r.pass / r.total) * 100 : 0;
                  return (
                    <div key={r.label} className="flex flex-1 flex-col items-center gap-1" aria-hidden="true">
                      <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{Math.round(pct)}%</span>
                      <div className="flex h-16 w-full items-end overflow-hidden rounded-sm bg-muted">
                        <div className={pct === 100 ? "w-full bg-approved" : "w-full bg-denied"} style={{ height: `${pct}%` }} />
                      </div>
                      <p className="max-w-full truncate text-[10px] text-muted-foreground" title={r.label}>
                        {r.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Regression cases */}
      <div className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Regression cases</h2>
        <div className="mt-2 divide-y divide-border rounded-sm border border-border bg-card">
          {cases.map((c) => {
            const result = latestByCase.get(c.id);
            return (
              <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{c.claim_id}</p>
                  <p className="text-sm">
                    expects <span className="font-medium">{c.expected_decision.replace("_", " ")}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {result ? (
                    <>
                      <span
                        className={
                          result.passed
                            ? "flex items-center gap-1 rounded-full bg-approved/10 px-2.5 py-1 text-xs font-medium text-approved"
                            : "flex items-center gap-1 rounded-full bg-denied/10 px-2.5 py-1 text-xs font-medium text-denied"
                        }
                      >
                        {result.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {result.actual_decision?.replace("_", " ")}
                      </span>
                      {result.trace_url && (
                        <a
                          href={result.trace_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                        >
                          Trace
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not run</span>
                  )}
                </div>
              </div>
            );
          })}
          {cases.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No eval cases yet. Run <code className="font-mono">uv run python -m src.seed_evals</code>.
            </p>
          )}
        </div>
      </div>

      {/* All claims */}
      <div className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">All claims ({totalClaims})</h2>
        <div className="mt-2 overflow-x-auto rounded-sm border border-border bg-card">
          <table className="w-full min-w-180 text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Claim</th>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Billed</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Decision</th>
                <th className="px-4 py-3 font-medium">Filed</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{c.id}</td>
                  <td className="px-4 py-3">{c.patient_name ?? c.patient_id}</td>
                  <td className="px-4 py-3">{c.provider_name ?? c.provider_id}</td>
                  <td className="px-4 py-3">${c.billed_amount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        c.status === "processing"
                          ? "rounded-full bg-review/10 px-2 py-0.5 text-xs font-medium text-review"
                          : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.decision ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${decisionBadgeClass(c.decision)}`}>
                        {c.decision.replace("_", " ")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/claims/${c.id}`}
                      className="flex items-center justify-end gap-0.5 text-xs font-medium text-primary hover:underline"
                    >
                      View
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
              {claims.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No claims filed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
