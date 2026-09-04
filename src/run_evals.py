"""Run the claims pipeline against the Langfuse eval dataset and score results.

Usage: uv run python -m src.run_evals [run_label]
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")

from src.agents import run_claim  # noqa: E402
from src.db import get_conn, init_db  # noqa: E402
from src.seed_evals import DATASET_NAME  # noqa: E402
from src.tracing import langfuse, score_decision, setup_tracing  # noqa: E402


def run_evals(run_label: str = "manual"):
    setup_tracing()
    init_db()
    dataset = langfuse.get_dataset(DATASET_NAME)

    with get_conn() as conn:
        for item in dataset.items:
            conn.execute(
                "INSERT OR REPLACE INTO eval_cases (id, claim_id, expected_decision) VALUES (?, ?, ?)",
                (item.id, item.input["claim_id"], item.expected_output["decision"]),
            )

    for item in dataset.items:
        claim = item.input
        claim_id = claim["claim_id"]
        expected = item.expected_output["decision"]

        result = run_claim(claim_id, claim)
        actual = result["decision"]
        passed = actual == expected

        score_decision(claim_id, passed)
        trace_url = os.environ.get("LANGFUSE_HOST")
        with get_conn() as conn:
            conn.execute(
                """INSERT INTO eval_results
                   (case_id, run_label, actual_decision, passed, trace_url)
                   VALUES (?, ?, ?, ?, ?)""",
                (item.id, run_label, actual, int(passed), trace_url),
            )

        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {claim_id}: expected={expected} actual={actual} (run={run_label})")


if __name__ == "__main__":
    label = sys.argv[1] if len(sys.argv) > 1 else "manual"
    run_evals(label)
