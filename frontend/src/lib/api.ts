const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type ChatResponse = {
  run_id: string;
  agent: string;
  response: string;
  trace_url: string | null;
};

export type Run = {
  id: string;
  request: string;
  agent: string;
  response: string | null;
  status: string;
  trace_url: string | null;
  created_at: string;
};

export type EvalCase = {
  id: string;
  prompt: string;
  expected_agent: string;
};

export type EvalResult = {
  id: number;
  case_id: string;
  run_label: string;
  actual_agent: string;
  passed: number;
  trace_url: string | null;
  created_at: string;
};

export async function sendChat(message: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
  return res.json();
}

export async function listRuns(): Promise<Run[]> {
  const res = await fetch(`${API_BASE}/runs`);
  return res.json();
}

export async function listEvals(): Promise<{ cases: EvalCase[]; results: EvalResult[] }> {
  const res = await fetch(`${API_BASE}/evals`);
  return res.json();
}

export function subscribeRunEvents(runId: string, onEvent: (data: string) => void): () => void {
  const es = new EventSource(`${API_BASE}/runs/${runId}/events`);
  es.onmessage = (e) => onEvent(e.data);
  return () => es.close();
}

export { API_BASE };
