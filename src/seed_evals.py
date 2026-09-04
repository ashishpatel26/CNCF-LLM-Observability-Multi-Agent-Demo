"""Seed a Langfuse Dataset with sample claims. Run once:
uv run python -m src.seed_evals
"""

from src.mcp_server import SEED_CLAIMS
from src.tracing import langfuse

DATASET_NAME = "claims-eval-v1"

if __name__ == "__main__":
    langfuse.create_dataset(
        name=DATASET_NAME,
        description="Sample claims with known-correct decisions, for regression testing the claims pipeline.",
    )
    for c in SEED_CLAIMS:
        langfuse.create_dataset_item(
            dataset_name=DATASET_NAME,
            input={
                "claim_id": c["claim_id"],
                "patient_id": c["patient_id"],
                "policy_id": c["policy_id"],
                "provider_id": c["provider_id"],
                "procedure_code": c["procedure_code"],
                "billed_amount": c["billed_amount"],
            },
            expected_output={"decision": c["expected_decision"]},
            id=c["claim_id"],
        )
    print(f"Seeded {len(SEED_CLAIMS)} items into Langfuse dataset '{DATASET_NAME}'.")
