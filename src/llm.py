import os

from crewai import LLM

OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "nvidia/nemotron-3-super-120b-a12b:free")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")


def get_llm() -> LLM:
    """Ollama (local, qwen2.5:7b) primary — more reliable at quoting tool
    output verbatim than the free OpenRouter models tested. Call
    get_fallback_llm() if Ollama isn't running on this machine.
    """
    return LLM(
        model=f"ollama/{OLLAMA_MODEL}",
        base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434").removesuffix("/v1"),
    )


def get_fallback_llm() -> LLM:
    return LLM(
        model=f"openrouter/{OPENROUTER_MODEL}",
        api_key=os.environ["OPENROUTER_API_KEY"],
    )
