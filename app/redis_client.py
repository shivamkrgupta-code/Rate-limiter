import redis
from app.config import settings

connection_pool = redis.ConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=10,
    decode_responses=True
)

r = redis.Redis(connection_pool=connection_pool)