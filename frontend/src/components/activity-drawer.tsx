"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
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

export function ActivityDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<GlobalActivityEntry[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    recentActivity(50).then(setEntries).catch(() => {});
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
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />}
      <aside
        className={`fixed top-0 right-0 z-50 h-screen w-96 transform border-l border-border bg-background shadow-xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-primary">Activity</h2>
            <p className="text-xs text-muted-foreground">Live across every claim</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={listRef} className="flex flex-col gap-3 overflow-y-auto px-5 py-4" style={{ height: "calc(100vh - 73px)" }}>
          {entries.length === 0 && (
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
      </aside>
    </>
  );
}
