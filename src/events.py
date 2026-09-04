import queue
import threading

_queues: dict[str, "queue.Queue[dict]"] = {}
_global_subscribers: list["queue.Queue[dict]"] = []
_lock = threading.Lock()


def create_stream(run_id: str) -> None:
    with _lock:
        _queues[run_id] = queue.Queue()


def publish(run_id: str, event: dict) -> None:
    q = _queues.get(run_id)
    if q:
        q.put(event)

    global_event = {**event, "claim_id": run_id}
    with _lock:
        subscribers = list(_global_subscribers)
    for gq in subscribers:
        gq.put(global_event)


def subscribe(run_id: str) -> "queue.Queue[dict]":
    return _queues.setdefault(run_id, queue.Queue())


def subscribe_global() -> "queue.Queue[dict]":
    q: "queue.Queue[dict]" = queue.Queue()
    with _lock:
        _global_subscribers.append(q)
    return q


def unsubscribe_global(q: "queue.Queue[dict]") -> None:
    with _lock:
        if q in _global_subscribers:
            _global_subscribers.remove(q)


def close_stream(run_id: str) -> None:
    publish(run_id, {"type": "done"})
