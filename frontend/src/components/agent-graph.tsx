"use client";

import { cn } from "@/lib/utils";

const AGENTS = [
  { key: "research", label: "Research Agent", tool: "vector_search" },
  { key: "infra", label: "Infra Agent", tool: "k8s_status" },
  { key: "support", label: "Support Agent", tool: "ticket_lookup" },
];

export function AgentGraph({ activeAgent, status }: { activeAgent: string | null; status: "idle" | "running" | "done" }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div
        className={cn(
          "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
          status === "running" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-border bg-muted",
        )}
      >
        Supervisor
      </div>
      <div className="h-6 w-px bg-border" />
      <div className="flex gap-4">
        {AGENTS.map((a) => {
          const isActive = activeAgent === a.key;
          return (
            <div
              key={a.key}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs transition-all",
                isActive
                  ? status === "done"
                    ? "border-green-500 bg-green-50 text-green-700 scale-105"
                    : "border-blue-500 bg-blue-50 text-blue-700 scale-105 animate-pulse"
                  : "border-border bg-background text-muted-foreground opacity-50",
              )}
            >
              <span className="font-medium">{a.label}</span>
              <span className="text-[10px]">{a.tool}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
