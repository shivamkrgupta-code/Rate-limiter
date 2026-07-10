import time
from app.redis_client import r

SCRIPT = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

local elapsed = now - last_refill
local new_tokens = math.min(capacity, tokens + (elapsed * refill_rate))

if new_tokens >= 1 then
    local remaining = math.floor(new_tokens - 1)
    redis.call('HMSET', key, 'tokens', new_tokens - 1, 'last_refill', now)
    redis.call('EXPIRE', key, 3600)
    return {1, remaining, 0}
else
    -- time until next token = (1 - new_tokens) / refill_rate
    local wait = math.ceil((1 - new_tokens) / refill_rate)
    redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
    return {0, 0, wait}
end
"""

_lua = r.register_script(SCRIPT)

def token_bucket(client_id: str, capacity: int, refill_rate: float) -> dict:
    result = _lua(
        keys=[f"tb:{client_id}"],
        args=[capacity, refill_rate, time.time()]
    )
    allowed = result[0] == 1
    remaining = int(result[1])
    reset_in = int(result[2])  # seconds until next token available
    used = capacity - remaining

    return {
        "allowed": allowed,
        "algorithm": "token_bucket",
        "count": used,
        "remaining": remaining,
        "reset_in": reset_in,
        "limit": capacity
    }