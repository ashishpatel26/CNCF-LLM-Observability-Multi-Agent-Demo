import Link from "next/link";
import { listClaims } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso.replace(" ", "T") + "Z").toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ClaimsQueue() {
  const claims = await listClaims().catch(() => []);

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-primary">Claims queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {claims.length} claim{claims.length === 1 ? "" : "s"} on file
          </p>
        </div>
        <Link
          href="/claims/new"
          className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          File a new claim
        </Link>
      </div>

      {claims.length === 0 ? (
        <div className="rounded-sm border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No claims on file yet. File one to see the adjudication pipeline run.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Claim</th>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Procedure</th>
                <th className="px-4 py-3 text-right font-medium">Billed</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Filed</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <Link href={`/claims/${c.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                      {c.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{c.patient_name ?? c.patient_id}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.provider_name ?? c.provider_id}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.procedure_code}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(c.billed_amount)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status === "done" ? c.decision : "processing"} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
