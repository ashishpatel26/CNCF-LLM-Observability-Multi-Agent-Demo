"use client";

import { cn } from "@/lib/utils";

const AGENTS = [
  { key: "research", label: "Research", tool: "Searches internal docs", color: "bg-agent-research" },
  { key: "infra", label: "Infra", tool: "Checks deployment health", color: "bg-agent-infra" },
  { key: "support", label: "Support", tool: "Looks up tickets", color: "bg-agent-support" },
];

export function AgentGraph({
  activeAgent,
  status,
}: {
  activeAgent: string | null;
  status: "idle" | "running" | "done";
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {AGENTS.map((a) => {
        const isActive = activeAgent === a.key;
        const isRunning = isActive && status === "running";
        return (
          <div
            key={a.key}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all",
              isActive
                ? "border-transparent bg-secondary text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isActive ? a.color : "bg-border",
                isRunning && "animate-pulse",
              )}
            />
            <span className="font-medium">{a.label}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">{a.tool}</span>
          </div>
        );
      })}
    </div>
  );
}
