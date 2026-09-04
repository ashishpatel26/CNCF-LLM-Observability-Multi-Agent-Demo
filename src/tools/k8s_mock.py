from crewai.tools import tool

_FAKE_CLUSTER_STATE = {
    "checkout-service": {"status": "Running", "replicas": "3/3", "restarts": 0},
    "payments-service": {"status": "CrashLoopBackOff", "replicas": "1/3", "restarts": 12},
    "auth-service": {"status": "Running", "replicas": "2/2", "restarts": 0},
}


@tool("k8s_status")
def k8s_status(deployment_name: str) -> str:
    """Get the status of a Kubernetes deployment by name (mock cluster)."""
    state = _FAKE_CLUSTER_STATE.get(deployment_name)
    if state is None:
        return f"No deployment named '{deployment_name}' found in cluster."
    return f"{deployment_name}: status={state['status']}, replicas={state['replicas']}, restarts={state['restarts']}"
