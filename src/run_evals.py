"""Run all eval_cases through the crew and record pass/fail.

Usage: uv run python -m src.run_evals [run_label]
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")

from src.agents import route  # noqa: E402
from src.db import get_conn, init_db  # noqa: E402
from src.tracing import setup_tracing  # noqa: E402


def run_evals(run_label: str = "manual"):
    setup_tracing()
    init_db()

    with get_conn() as conn:
        cases = conn.execute("SELECT * FROM eval_cases").fetchall()

    for case in cases:
        actual_agent = route(case["prompt"])
        passed = actual_agent == case["expected_agent"]
        with get_conn() as conn:
            conn.execute(
                "INSERT INTO eval_results (case_id, run_label, actual_agent, passed) VALUES (?, ?, ?, ?)",
                (case["id"], run_label, actual_agent, int(passed)),
            )
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {case['id']}: expected={case['expected_agent']} actual={actual_agent}")


if __name__ == "__main__":
    label = sys.argv[1] if len(sys.argv) > 1 else "manual"
    run_evals(label)
