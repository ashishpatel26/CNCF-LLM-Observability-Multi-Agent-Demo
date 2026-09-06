"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitClaim, listPatients, listProviders, type ReferencePatients, type ReferenceProviders } from "@/lib/api";

export default function NewClaimPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<ReferencePatients>({});
  const [providers, setProviders] = useState<ReferenceProviders>({});
  const [referenceError, setReferenceError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);

  const [patientId, setPatientId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [procedureCode, setProcedureCode] = useState("");
  const [billedAmount, setBilledAmount] = useState("");

  useEffect(() => {
    Promise.all([listPatients(), listProviders()])
      .then(([p, pr]) => {
        setPatients(p);
        setProviders(pr);
      })
      .catch(() => setReferenceError(true));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setPatientError(null);
    setProviderError(null);

    const patient = patients[patientId];
    let hasError = false;
    if (!patient) {
      setPatientError("Select a patient on file.");
      hasError = true;
    }
    if (!providerId) {
      setProviderError("Select the treating provider.");
      hasError = true;
    }
    if (hasError) return;

    setSubmitting(true);
    try {
      const res = await submitClaim({
        patient_id: patientId,
        policy_id: patient!.policy_id,
        provider_id: providerId,
        procedure_code: procedureCode,
        billed_amount: parseFloat(billedAmount),
      });
      router.push(`/claims/${res.claim_id}`);
    } catch {
      setSubmitError("Could not submit the claim. Check that the API server is running.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="font-serif text-2xl font-semibold text-primary">File a new claim</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        First notice of claim. Submitting runs the claim through policy verification, medical
        history review, and fraud screening before a decision is reached.
      </p>

      {referenceError && (
        <div className="mt-6 rounded-sm border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Could not load patients and providers. Check that the API server is running, then reload.
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5 rounded-sm border border-border bg-card p-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="patient">Patient</Label>
          <Select value={patientId} onValueChange={(v) => setPatientId(v ?? "")}>
            <SelectTrigger
              id="patient"
              aria-describedby={patientError ? "patient-error" : undefined}
              aria-invalid={Boolean(patientError)}
            >
              <SelectValue placeholder="Select a patient on file" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(patients).map(([id, p]) => (
                <SelectItem key={id} value={id}>
                  {p.name} — {id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {patientError && (
            <p id="patient-error" className="text-sm text-destructive">
              {patientError}
            </p>
          )}
          {patients[patientId] && (
            <p className="text-xs text-muted-foreground">Policy {patients[patientId].policy_id}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="provider">Provider</Label>
          <Select value={providerId} onValueChange={(v) => setProviderId(v ?? "")}>
            <SelectTrigger
              id="provider"
              aria-describedby={providerError ? "provider-error" : undefined}
              aria-invalid={Boolean(providerError)}
            >
              <SelectValue placeholder="Select the treating provider" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(providers).map(([id, p]) => (
                <SelectItem key={id} value={id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {providerError && (
            <p id="provider-error" className="text-sm text-destructive">
              {providerError}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="procedure">Procedure code (CPT)</Label>
            <Input
              id="procedure"
              value={procedureCode}
              onChange={(e) => setProcedureCode(e.target.value)}
              placeholder="99213"
              aria-describedby="procedure-hint"
              required
            />
            <p id="procedure-hint" className="text-xs text-muted-foreground">
              5-digit CPT code for the billed procedure
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="billed">Billed amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="billed"
                type="number"
                step="0.01"
                min="0.01"
                value={billedAmount}
                onChange={(e) => setBilledAmount(e.target.value)}
                placeholder="180.00"
                className="pl-6"
                required
              />
            </div>
          </div>
        </div>

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Running adjudication…" : "Submit claim"}
          </Button>
        </div>
      </form>
    </div>
  );
}
