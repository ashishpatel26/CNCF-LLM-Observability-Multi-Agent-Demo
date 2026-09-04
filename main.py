import os
import sys

from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")

from src.tracing import setup_tracing  # noqa: E402

setup_tracing()

from src.agents import build_crew  # noqa: E402


def main():
    user_request = " ".join(sys.argv[1:]) or "What's our refund policy, and is checkout-service healthy?"
    crew, agent_key = build_crew(user_request)
    result = crew.kickoff()
    print(f"\n--- RESULT (agent={agent_key}) ---")
    print(result)
    print(f"\nView trace: {os.environ.get('LANGFUSE_HOST')}")


if __name__ == "__main__":
    main()
