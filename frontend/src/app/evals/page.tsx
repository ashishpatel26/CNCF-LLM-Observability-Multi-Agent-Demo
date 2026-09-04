"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, X } from "lucide-react";
import { listEvals, type EvalCase, type EvalResult } from "@/lib/api";

export default function EvalsPage() {
  const [cases, setCases] = useState<EvalCase[]>([]);
  const [results, setResults] = useState<EvalResult[]>([]);

  useEffect(() => {
    listEvals()
      .then((d) => {
        setCases(d.cases);
        setResults(d.results);
      })
      .catch(() => {});
  }, []);

  const latestByCase = new Map<string, EvalResult>();
  for (const r of results) {
    if (!latestByCase.has(r.case_id)) latestByCase.set(r.case_id, r);
  }

  const passCount = [...latestByCase.values()].filter((r) => r.passed).length;

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="font-serif text-2xl font-semibold text-primary">Eval dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sample claims with known-correct decisions, re-run against the pipeline to catch
        regressions before they reach a real claim.
      </p>

      <div className="mt-6 flex gap-6 text-sm">
        <span>
          <strong className="text-lg">{cases.length}</strong>{" "}
          <span className="text-muted-foreground">cases</span>
        </span>
        <span>
          <strong className="text-lg text-approved">{passCount}</strong>{" "}
          <span className="text-muted-foreground">passing</span>
        </span>
        <span>
          <strong className="text-lg text-denied">{latestByCase.size - passCount}</strong>{" "}
          <span className="text-muted-foreground">failing</span>
        </span>
      </div>

      <div className="mt-6 divide-y divide-border rounded-sm border border-border bg-card">
        {cases.map((c) => {
          const result = latestByCase.get(c.id);
          return (
            <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">{c.claim_id}</p>
                <p className="text-sm">expects <span className="font-medium">{c.expected_decision.replace("_", " ")}</span></p>
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
  );
}
