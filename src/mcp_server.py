"""MCP server exposing claims-adjudication tools over stdio.

Run standalone for testing: uv run python -m src.mcp_server
CrewAI agents connect to it via MCPServerStdio (see src/agents.py).
"""

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("claims-tools")

# ---- Data layer (dummy but internally consistent) --------------------------

PATIENTS = {
    "PAT-500": {"name": "Maria Chen", "dob": "1978-04-12", "policy_id": "POL-1001"},
    "PAT-501": {"name": "James Whitfield", "dob": "1990-11-02", "policy_id": "POL-2002"},
    "PAT-502": {"name": "Priya Nair", "dob": "1965-07-23", "policy_id": "POL-1001"},
    "PAT-503": {"name": "Derek Osei", "dob": "1988-01-30", "policy_id": "POL-3003"},
}

PROVIDERS = {
    "PRV-01": {"name": "Lakeside Family Clinic", "npi": "1447829301"},
    "PRV-02": {"name": "Northgate Orthopedics", "npi": "1902847710"},
    "PRV-03": {"name": "Sunrise Urgent Care", "npi": "1774920385"},
}

ADJUSTERS = {
    "ADJ-01": {"name": "Renee Ortiz", "role": "Senior Claims Adjuster"},
    "ADJ-02": {"name": "Tom Baptiste", "role": "Claims Adjuster"},
}

_POLICIES = {
    ("POL-1001", "99213"): {"covered": True, "deductible_met": True, "exclusion": None},
    ("POL-1001", "99499"): {"covered": False, "deductible_met": True, "exclusion": "experimental procedure"},
    ("POL-1001", "99214"): {"covered": True, "deductible_met": True, "exclusion": None},
    ("POL-2002", "99213"): {"covered": True, "deductible_met": False, "exclusion": None},
    ("POL-2002", "27447"): {"covered": True, "deductible_met": True, "exclusion": None},
    ("POL-3003", "99213"): {"covered": True, "deductible_met": True, "exclusion": None},
    ("POL-1001", "99255"): {"covered": True, "deductible_met": True, "exclusion": None},
    ("POL-1001", "27130"): {"covered": True, "deductible_met": True, "exclusion": None},
}

_MEDICAL_HISTORY = {
    "PAT-500": {"prior_diagnoses": ["hypertension"], "prior_procedures": ["99213"]},
    "PAT-501": {"prior_diagnoses": [], "prior_procedures": []},
    "PAT-502": {"prior_diagnoses": ["osteoarthritis", "type 2 diabetes"], "prior_procedures": ["99213", "27447"]},
    "PAT-503": {"prior_diagnoses": [], "prior_procedures": ["99213"]},
}

_FRAUD_SIGNALS = {
    "CLM-9001": {"billed_vs_typical_ratio": 1.1, "prior_claim_flags": 0},
    "CLM-9002": {"billed_vs_typical_ratio": 4.8, "prior_claim_flags": 2},
    "CLM-9003": {"billed_vs_typical_ratio": 1.0, "prior_claim_flags": 0},
    "CLM-9004": {"billed_vs_typical_ratio": 3.4, "prior_claim_flags": 1},
}

# Seed claims — used by seed_claims.py to populate SQLite for demo/eval.
SEED_CLAIMS = [
    {
        "claim_id": "CLM-9001",
        "patient_id": "PAT-500",
        "policy_id": "POL-1001",
        "provider_id": "PRV-01",
        "procedure_code": "99213",
        "billed_amount": 180.00,
        "expected_decision": "approved",
    },
    {
        "claim_id": "CLM-9002",
        "patient_id": "PAT-501",
        "policy_id": "POL-2002",
        "provider_id": "PRV-02",
        "procedure_code": "27447",
        "billed_amount": 42500.00,
        "expected_decision": "human_review",
    },
    {
        "claim_id": "CLM-9003",
        "patient_id": "PAT-502",
        "policy_id": "POL-1001",
        "provider_id": "PRV-01",
        "procedure_code": "99499",
        "billed_amount": 950.00,
        "expected_decision": "denied",
    },
    {
        "claim_id": "CLM-9004",
        "patient_id": "PAT-503",
        "policy_id": "POL-3003",
        "provider_id": "PRV-03",
        "procedure_code": "99213",
        "billed_amount": 410.00,
        "expected_decision": "human_review",
    },
]


# ---- MCP tools --------------------------------------------------------------


@mcp.tool()
def check_coverage(policy_id: str, procedure_code: str) -> dict:
    """Check whether a procedure is covered under a policy: coverage status, deductible, exclusions."""
    result = _POLICIES.get((policy_id, procedure_code))
    if result is None:
        return {"covered": False, "deductible_met": False, "exclusion": "unknown policy or procedure"}
    return result


@mcp.tool()
def lookup_medical_history(patient_id: str) -> dict:
    """Look up a patient's prior diagnoses and procedures for consistency checks."""
    return _MEDICAL_HISTORY.get(patient_id, {"prior_diagnoses": [], "prior_procedures": []})


@mcp.tool()
def fraud_score(claim_id: str) -> dict:
    """Get fraud signal data for a claim: billed-vs-typical cost ratio, prior claim flags."""
    return _FRAUD_SIGNALS.get(claim_id, {"billed_vs_typical_ratio": 1.0, "prior_claim_flags": 0})


if __name__ == "__main__":
    mcp.run()
