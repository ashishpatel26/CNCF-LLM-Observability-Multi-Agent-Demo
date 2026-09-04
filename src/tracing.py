from langfuse import get_client
from openinference.instrumentation.crewai import CrewAIInstrumentor

langfuse = get_client()
_instrumented = False


def setup_tracing():
    """Instrument CrewAI via OpenInference -> OTel -> Langfuse v4.

    Langfuse v4's SDK is OTel-native; CrewAI/LiteLLM calls are captured by
    wrapping CrewAI's own methods (not via litellm.callbacks, which is the
    older v2/v3 Langfuse integration pattern and does nothing on v4).
    """
    global _instrumented
    if _instrumented:
        return
    CrewAIInstrumentor().instrument(skip_dep_check=True)
    _instrumented = True
