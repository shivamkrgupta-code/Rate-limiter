import time
from app.redis_client import r

def sliding_window_log(client_id: str, max_requests: int, window_seconds: int) -> dict:
    now = time.time()
    window_start = now - window_seconds
    key = f"sw:{client_id}"

    pipe = r.pipeline()
    pipe.zremrangebyscore(key, 0, window_start)
    pipe.zadd(key, {str(now): now})
    pipe.zcard(key)
    pipe.expire(key, window_seconds)
    pipe.zrange(key, 0, 0, withscores=True)  # get oldest request timestamp
    results = pipe.execute()

    count = results[2]
    oldest = results[4]  # list of (member, score) tuples

    # Calculate actual reset_in — time until oldest request falls outside window
    if oldest and count >= max_requests:
        oldest_timestamp = oldest[0][1]
        reset_in = max(0, round(oldest_timestamp + window_seconds - now))
    else:
        reset_in = window_seconds

    effective_count = min(count, max_requests)
    allowed = count <= max_requests

    return {
        "allowed": allowed,
        "algorithm": "sliding_window_log",
        "count": effective_count,
        "remaining": max(0, max_requests - effective_count),
        "reset_in": reset_in,
        "limit": max_requests
    }