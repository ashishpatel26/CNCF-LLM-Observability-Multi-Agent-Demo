"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { submitClaim, listPatients, listProviders, type ReferencePatients, type ReferenceProviders } from "@/lib/api";

export default function NewClaimPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<ReferencePatients>({});
  const [providers, setProviders] = useState<ReferenceProviders>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patientId, setPatientId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [procedureCode, setProcedureCode] = useState("");
  const [billedAmount, setBilledAmount] = useState("");

  useEffect(() => {
    listPatients().then(setPatients).catch(() => {});
    listProviders().then(setProviders).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const patient = patients[patientId];
    if (!patient) {
      setError("Select a patient on file.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitClaim({
        patient_id: patientId,
        policy_id: patient.policy_id,
        provider_id: providerId,
        procedure_code: procedureCode,
        billed_amount: parseFloat(billedAmount),
      });
      router.push(`/claims/${res.claim_id}`);
    } catch {
      setError("Could not submit the claim. Check that the API server is running.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h1 className="font-serif text-2xl font-semibold text-primary">File a new claim</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        First notice of loss. Submitting runs the claim through policy verification, medical
        history review, and fraud screening before a decision is reached.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5 rounded-sm border border-border bg-card p-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="patient">Patient</Label>
          <select
            id="patient"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            required
            className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Select a patient on file
            </option>
            {Object.entries(patients).map(([id, p]) => (
              <option key={id} value={id}>
                {p.name} — {id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="provider">Provider</Label>
          <select
            id="provider"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            required
            className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Select the treating provider
            </option>
            {Object.entries(providers).map(([id, p]) => (
              <option key={id} value={id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="procedure">Procedure code (CPT)</Label>
            <Input
              id="procedure"
              value={procedureCode}
              onChange={(e) => setProcedureCode(e.target.value)}
              placeholder="99213"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="billed">Billed amount</Label>
            <Input
              id="billed"
              type="number"
              step="0.01"
              value={billedAmount}
              onChange={(e) => setBilledAmount(e.target.value)}
              placeholder="180.00"
              required
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Running adjudication…" : "Submit claim"}
          </Button>
        </div>
      </form>
    </div>
  );
}
