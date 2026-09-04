"""Seed eval_cases with a small fixed dataset. Run once: uv run python -m src.seed_evals"""

from src.db import get_conn, init_db

CASES = [
    ("case-1", "What's our refund policy?", "research"),
    ("case-2", "Is checkout-service healthy?", "infra"),
    ("case-3", "Check status of TICKET-101", "support"),
    ("case-4", "What are the API rate limits?", "research"),
    ("case-5", "Is payments-service running?", "infra"),
]

if __name__ == "__main__":
    init_db()
    with get_conn() as conn:
        for case_id, prompt, expected_agent in CASES:
            conn.execute(
                "INSERT OR REPLACE INTO eval_cases (id, prompt, expected_agent) VALUES (?, ?, ?)",
                (case_id, prompt, expected_agent),
            )
    print(f"Seeded {len(CASES)} eval cases.")
