"use client";

import { useState } from "react";
import { ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThinkingStep = { time: Date; agent: string; note: string };

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ThinkingWidget({
  active,
  currentLabel,
  steps,
}: {
  active: boolean;
  currentLabel: string;
  steps: ThinkingStep[];
}) {
  const [expanded, setExpanded] = useState(false);

  // Hides entirely once the pipeline finishes — the decision card and audit
  // trail become the record at that point, not this in-progress indicator.
  if (!active) return null;

  return (
    <div className="fixed right-8 bottom-8 z-40 w-[min(380px,calc(100vw-2.5rem))]">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-review" />
          <span className="flex-1 truncate text-sm font-medium text-review">{currentLabel}</span>
          <ChevronUp
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
          />
        </button>

        {expanded && (
          <div className="max-h-64 overflow-y-auto border-t border-border bg-muted/40 px-4 py-3">
            <div className="flex flex-col gap-1.5 font-mono text-xs text-muted-foreground">
              {steps.length === 0 ? (
                <p>Waiting for the first step…</p>
              ) : (
                steps.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="shrink-0 text-muted-foreground/60">{formatTime(s.time)}</span>
                    <span className="shrink-0 font-medium text-foreground">{s.agent}</span>
                    <span>{s.note}</span>
                  </div>
                ))
              )}
              <div className="flex items-center gap-2 text-review">
                <span className="text-review/60">{formatTime(new Date())}</span>
                <span className="inline-block h-2.5 w-1 animate-pulse bg-review" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
