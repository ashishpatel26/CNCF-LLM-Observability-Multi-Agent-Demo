import chromadb
from crewai.tools import tool

_client = chromadb.Client()
_collection = _client.get_or_create_collection("knowledge_base")

_SEED_DOCS = [
    ("doc1", "The refund policy allows returns within 30 days of purchase with a receipt."),
    ("doc2", "API rate limits are 100 requests per minute per API key on the free tier."),
    ("doc3", "Deployments to production require two approvals and pass all CI checks."),
]

if _collection.count() == 0:
    _collection.add(
        ids=[d[0] for d in _SEED_DOCS],
        documents=[d[1] for d in _SEED_DOCS],
    )


@tool("vector_search")
def vector_search(query: str) -> str:
    """Search the internal knowledge base for relevant documents."""
    results = _collection.query(query_texts=[query], n_results=2)
    docs = results.get("documents", [[]])[0]
    return "\n".join(docs) if docs else "No relevant documents found."
