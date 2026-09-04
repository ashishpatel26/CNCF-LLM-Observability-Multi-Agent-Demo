import { cn } from "@/lib/utils";

const CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  processing: { label: "Processing", dot: "bg-review", text: "text-review" },
  approved: { label: "Approved", dot: "bg-approved", text: "text-approved" },
  denied: { label: "Denied", dot: "bg-denied", text: "text-denied" },
  human_review: { label: "Needs review", dot: "bg-review", text: "text-review" },
};

export function StatusBadge({ status }: { status: string | null }) {
  const key = status ?? "processing";
  const cfg = CONFIG[key] ?? { label: key, dot: "bg-muted-foreground", text: "text-muted-foreground" };
  const isProcessing = key === "processing";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", cfg.text)}>
      <span className="relative flex h-1.5 w-1.5">
        {isProcessing && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", cfg.dot)} />
        )}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", cfg.dot)} />
      </span>
      {cfg.label}
    </span>
  );
}
