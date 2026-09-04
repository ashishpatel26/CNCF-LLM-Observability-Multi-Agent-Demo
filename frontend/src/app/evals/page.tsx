"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listEvals, type EvalCase, type EvalResult } from "@/lib/api";

export default function EvalsPage() {
  const [cases, setCases] = useState<EvalCase[]>([]);
  const [results, setResults] = useState<EvalResult[]>([]);

  useEffect(() => {
    listEvals().then((d) => {
      setCases(d.cases);
      setResults(d.results);
    });
  }, []);

  const latestByCase = new Map<string, EvalResult>();
  for (const r of results) {
    if (!latestByCase.has(r.case_id)) latestByCase.set(r.case_id, r);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Eval Dashboard</h1>
        <Link href="/" className="text-sm text-muted-foreground underline">
          ← Chat
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-col divide-y">
          {cases.map((c) => {
            const result = latestByCase.get(c.id);
            return (
              <div key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{c.prompt}</p>
                  <p className="text-xs text-muted-foreground">expected: {c.expected_agent}</p>
                </div>
                <div className="flex items-center gap-2">
                  {result ? (
                    <>
                      <Badge variant={result.passed ? "default" : "destructive"}>
                        {result.passed ? "PASS" : "FAIL"} ({result.actual_agent})
                      </Badge>
                      {result.trace_url && (
                        <a href={result.trace_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                          trace ↗
                        </a>
                      )}
                    </>
                  ) : (
                    <Badge variant="outline">not run</Badge>
                  )}
                </div>
              </div>
            );
          })}
          {cases.length === 0 && <p className="text-sm text-muted-foreground">No eval cases seeded yet.</p>}
        </div>
      </Card>
    </div>
  );
}
