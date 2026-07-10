import time
from app.redis_client import r

def fixed_window(client_id: str, max_requests: int, window_seconds: int) -> dict:
    window_key = int(time.time() // window_seconds)
    key = f"fw:{client_id}:{window_key}"

    count = r.incr(key)
    if count == 1:
        r.expire(key, window_seconds)

    # Cap count at max_requests so remaining never goes negative
    effective_count = min(count, max_requests)
    allowed = count <= max_requests
    reset_in = window_seconds - (int(time.time()) % window_seconds)

    return {
        "allowed": allowed,
        "algorithm": "fixed_window",
        "count": effective_count,
        "remaining": max_requests - effective_count,
        "reset_in": reset_in,
        "limit": max_requests
    }