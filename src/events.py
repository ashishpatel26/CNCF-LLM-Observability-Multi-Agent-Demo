import queue
import threading

_queues: dict[str, "queue.Queue[dict]"] = {}
_lock = threading.Lock()


def create_stream(run_id: str) -> None:
    with _lock:
        _queues[run_id] = queue.Queue()


def publish(run_id: str, event: dict) -> None:
    q = _queues.get(run_id)
    if q:
        q.put(event)


def subscribe(run_id: str) -> "queue.Queue[dict]":
    return _queues.setdefault(run_id, queue.Queue())


def close_stream(run_id: str) -> None:
    publish(run_id, {"type": "done"})
