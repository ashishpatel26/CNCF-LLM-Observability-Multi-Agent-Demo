const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type Claim = {
  id: string;
  patient_id: string;
  patient_name?: string;
  policy_id: string;
  provider_id: string;
  provider_name?: string;
  procedure_code: string;
  billed_amount: number;
  status: string;
  decision: string | null;
  decision_reason: string | null;
  langfuse_session_url: string | null;
  created_at: string;
};

export type ClaimFinding = {
  id: number;
  claim_id: string;
  agent: string;
  finding: string;
  trace_url: string | null;
  created_at: string;
};

export type ClaimActivityEntry = {
  id: number;
  claim_id: string;
  agent: string;
  note: string;
  created_at: string;
};

export type ClaimDetail = Claim & {
  patient: { name: string; dob: string; policy_id: string } | null;
  provider: { name: string; npi: string } | null;
  findings: ClaimFinding[];
  activity: ClaimActivityEntry[];
};

export type NewClaimInput = {
  patient_id: string;
  policy_id: string;
  provider_id: string;
  procedure_code: string;
  billed_amount: number;
};

export type EvalCase = {
  id: string;
  claim_id: string;
  expected_decision: string;
};

export type EvalResult = {
  id: number;
  case_id: string;
  run_label: string;
  actual_decision: string;
  passed: number;
  trace_url: string | null;
  created_at: string;
};

export async function listClaims(): Promise<Claim[]> {
  const res = await fetch(`${API_BASE}/claims`, { cache: "no-store" });
  return res.json();
}

export async function getClaim(id: string): Promise<ClaimDetail> {
  const res = await fetch(`${API_BASE}/claims/${id}`, { cache: "no-store" });
  return res.json();
}

export async function submitClaim(input: NewClaimInput) {
  const res = await fetch(`${API_BASE}/claims`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Claim submission failed: ${res.status}`);
  return res.json();
}

export async function listEvals(): Promise<{ cases: EvalCase[]; results: EvalResult[] }> {
  const res = await fetch(`${API_BASE}/evals`, { cache: "no-store" });
  return res.json();
}

export type ReferencePatients = Record<string, { name: string; dob: string; policy_id: string }>;
export type ReferenceProviders = Record<string, { name: string; npi: string }>;

export async function listPatients(): Promise<ReferencePatients> {
  const res = await fetch(`${API_BASE}/reference/patients`, { cache: "no-store" });
  return res.json();
}

export async function listProviders(): Promise<ReferenceProviders> {
  const res = await fetch(`${API_BASE}/reference/providers`, { cache: "no-store" });
  return res.json();
}

export type ClaimEvent =
  | { type: "stage"; agent: string; status: "running" | "done" }
  | { type: "step"; agent: string; note: string }
  | { type: "decision"; decision: string; reason: string }
  | { type: "done" };

export function subscribeClaimEvents(claimId: string, onEvent: (e: ClaimEvent) => void): () => void {
  const es = new EventSource(`${API_BASE}/claims/${claimId}/events`);
  es.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data));
    } catch {
      // ignore malformed events
    }
  };
  es.onerror = () => es.close();
  return () => es.close();
}

export type GlobalActivityEntry = {
  id: number;
  claim_id: string;
  agent: string;
  note: string;
  created_at: string;
};

export async function recentActivity(limit = 50): Promise<GlobalActivityEntry[]> {
  const res = await fetch(`${API_BASE}/activity/recent?limit=${limit}`, { cache: "no-store" });
  return res.json();
}

export function subscribeGlobalActivity(onEvent: (e: GlobalActivityEntry) => void): () => void {
  const es = new EventSource(`${API_BASE}/activity/stream`);
  es.onmessage = (msg) => {
    try {
      const parsed = JSON.parse(msg.data);
      if (parsed.type === "step") onEvent(parsed);
    } catch {
      // ignore malformed events
    }
  };
  return () => es.close();
}

export { API_BASE };
