"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { recentActivity, subscribeGlobalActivity, type GlobalActivityEntry } from "@/lib/api";

const AGENT_LABEL: Record<string, string> = {
  policy: "Policy verification",
  medical_history: "Medical history review",
  fraud: "Fraud screening",
  decision: "Decision gate",
};

function formatTime(iso: string | undefined) {
  const date = iso ? new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z") : new Date();
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export function ActivityDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [entries, setEntries] = useState<GlobalActivityEntry[]>([]);
  const [error, setError] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    recentActivity(50)
      .then(setEntries)
      .catch(() => setError(true));
    const unsubscribe = subscribeGlobalActivity((entry) => {
      setEntries((prev) => [
        ...prev.slice(-99),
        { ...entry, id: entry.id ?? Date.now() + Math.random(), created_at: entry.created_at ?? new Date().toISOString() },
      ]);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, entries.length]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-96 p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="font-serif text-lg font-semibold text-primary">Activity</SheetTitle>
          <SheetDescription>Live across every claim</SheetDescription>
        </SheetHeader>

        <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {error && (
            <p className="text-sm text-destructive">
              Could not load activity. Check that the API server is running.
            </p>
          )}
          {!error && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity yet. File a claim to see the agents work.</p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-foreground">{AGENT_LABEL[e.agent] ?? e.agent}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatTime(e.created_at)}</span>
              </div>
              <p className="text-muted-foreground">{e.note}</p>
              <Link href={`/claims/${e.claim_id}`} className="font-mono text-[11px] text-primary hover:underline">
                {e.claim_id}
              </Link>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
