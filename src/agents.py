from crewai import Agent, Crew, Process, Task

from src.events import publish
from src.llm import get_llm
from src.tools.k8s_mock import k8s_status
from src.tools.ticket_mock import ticket_lookup
from src.tools.vector_search import vector_search

llm = get_llm()

research_agent = Agent(
    role="Research Agent",
    goal="Answer questions using the internal knowledge base",
    backstory="You search internal docs and summarize what's relevant to the user's question.",
    tools=[vector_search],
    llm=llm,
)

infra_agent = Agent(
    role="Infra Agent",
    goal="Check deployment/cluster health when asked about services or infrastructure",
    backstory=(
        "You NEVER know deployment status from memory — you have no access to the "
        "cluster except through the k8s_status tool. You MUST call k8s_status with "
        "the deployment name before answering. Never invent status/replicas/restarts."
    ),
    tools=[k8s_status],
    llm=llm,
)

support_agent = Agent(
    role="Support Agent",
    goal="Look up support tickets when asked about customer issues",
    backstory=(
        "You NEVER know ticket details from memory — you have no access to the "
        "ticketing system except through the ticket_lookup tool. You MUST call "
        "ticket_lookup with the ticket ID before answering. Never invent ticket details."
    ),
    tools=[ticket_lookup],
    llm=llm,
)

_AGENTS = {
    "research": research_agent,
    "infra": infra_agent,
    "support": support_agent,
}


def route(user_request: str) -> str:
    """Supervisor step: pick which specialist agent should handle the request.

    Kept as plain keyword matching rather than an LLM call — free-tier models
    were unreliable at forced delegation (see PRD Slide-2 "HTTP 200 != correct"
    lesson: a model can look confident while skipping the tool it should use).
    A deterministic router keeps the demo's multi-agent story reliable on stage.
    """
    lowered = user_request.lower()
    if any(w in lowered for w in ("ticket", "customer", "support")):
        return "support"
    if any(w in lowered for w in ("deploy", "service", "cluster", "pod", "k8s", "kubernetes", "infra")):
        return "infra"
    return "research"


def build_crew(user_request: str) -> tuple[Crew, str]:
    """Supervisor routes to one specialist agent, which runs its task with its tool."""
    agent_key = route(user_request)
    agent = _AGENTS[agent_key]
    task = Task(
        description=(
            f"Call your tool first, then answer using ONLY the tool's returned text "
            f"(quote it, don't paraphrase or add details it doesn't contain). "
            f"Request: {user_request}"
        ),
        expected_output="The tool's output, presented clearly to the user.",
        agent=agent,
    )
    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )
    return crew, agent_key


def run_request(run_id: str, user_request: str) -> dict:
    """Run the crew for a request, publishing step events for SSE as it goes."""
    agent_key = route(user_request)
    publish(run_id, {"type": "routed", "agent": agent_key})

    crew, _ = build_crew(user_request)
    publish(run_id, {"type": "agent_started", "agent": agent_key})

    result = crew.kickoff()

    publish(run_id, {"type": "agent_finished", "agent": agent_key})
    return {"agent": agent_key, "response": str(result)}
