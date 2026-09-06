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
  let claims: Awaited<ReturnType<typeof listClaims>> = [];
  let loadError = false;
  try {
    claims = await listClaims();
  } catch {
    loadError = true;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-primary">Claims queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loadError ? "Unable to load claims" : `${claims.length} claim${claims.length === 1 ? "" : "s"} on file`}
          </p>
        </div>
        <Link
          href="/claims/new"
          className="flex min-h-11 w-fit items-center rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          File a new claim
        </Link>
      </div>

      {loadError ? (
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
          <p className="text-sm font-medium text-destructive">Could not load the claims queue.</p>
          <p className="mt-1 text-sm text-muted-foreground">Check that the API server is running, then reload.</p>
        </div>
      ) : claims.length === 0 ? (
        <div className="rounded-sm border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No claims on file yet. File one to see the adjudication pipeline run.
          </p>
        </div>
      ) : (
        <>
          {/* Card layout below md */}
          <div className="flex flex-col gap-3 md:hidden">
            {claims.map((c) => (
              <Link
                key={c.id}
                href={`/claims/${c.id}`}
                className="block rounded-sm border border-border bg-card px-4 py-3 hover:bg-secondary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{c.id}</p>
                    <p className="mt-0.5 truncate text-sm font-medium">{c.patient_name ?? c.patient_id}</p>
                  </div>
                  <StatusBadge status={c.status === "done" ? c.decision : "processing"} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{c.provider_name ?? c.provider_id} · CPT {c.procedure_code}</span>
                  <span className="shrink-0 tabular-nums">{formatCurrency(c.billed_amount)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(c.created_at)}</p>
              </Link>
            ))}
          </div>

          {/* Table on md+ */}
          <div className="hidden overflow-x-auto rounded-sm border border-border bg-card md:block">
            <table className="w-full min-w-180 text-sm">
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
        </>
      )}
    </div>
  );
}
