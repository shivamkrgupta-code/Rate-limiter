# Distributed Rate Limiter

A production-grade rate limiting service built from scratch — implementing three core algorithms using Redis atomic operations, deployed with Docker on Render.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-rate--limiter--ce9k.onrender.com-00ff87?style=for-the-badge&logo=render&logoColor=white)](https://rate-limiter-ce9k.onrender.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)

---

##  Live Demo

**[https://rate-limiter-ze9f.onrender.com/](https://rate-limiter-ce9k.onrender.com/)**

> Switch between algorithms, fire requests, trigger a 429, and watch the countdown timer. Use **Burst ×10** to fire 10 simultaneous requests and observe how each algorithm handles the load differently.

---


##  Algorithms Implemented

### 1. Fixed Window Counter
Divides time into fixed buckets. Counts requests per bucket using `INCR` + `EXPIRE`.

```
Window: 12:00:00 → 12:01:00
Requests: ████████░░  (8/10 used)
```

**Tradeoff:** Simple and memory-efficient, but vulnerable to boundary bursts — a user can send 10 requests at 12:00:59 and 10 more at 12:01:01, effectively doubling the limit in 2 seconds.

**Redis operations:** `INCR`, `EXPIRE`

---

### 2. Sliding Window Log
Stores the exact timestamp of every request in a **Redis Sorted Set**. On each request, purges timestamps older than the window and counts what remains.

```
Now: 12:01:30
Window: last 60 seconds
Timestamps in set: [12:00:35, 12:00:58, 12:01:10, 12:01:28]
Count: 4 → allowed
```

**Tradeoff:** Most accurate algorithm — no boundary burst problem. Memory cost is O(requests) per user. `reset_in` returns the actual time until the oldest request expires out of the window, not a fixed duration.

**Redis operations:** `ZREMRANGEBYSCORE`, `ZADD`, `ZCARD`, `ZRANGE` in a single pipeline

---

### 3. Token Bucket
Each client has a "bucket" that refills at a fixed rate. Requests consume tokens. Empty bucket = denied.

```
Capacity: 10 tokens
Refill rate: 0.2 tokens/second (1 token per 5s)
Burst of 10 requests → all pass (tokens drain instantly)
Next request in <5s → denied
```

**Tradeoff:** Best for allowing controlled bursts while preventing sustained abuse. Implemented entirely in a **Lua script** executed atomically on Redis — prevents race conditions when multiple servers check-and-update the same bucket simultaneously.

**Redis operations:** Atomic Lua script using `HMGET`, `HMSET`, `EXPIRE`

---

## Architecture

```
Client Request
      │
      ▼
┌─────────────────────────────┐
│         FastAPI App          │
│                             │
│  get_client_id()            │
│  → X-API-Key header         │
│  → X-Forwarded-For (proxy)  │
│  → request.client.host      │
│                             │
│  ┌──────────────────────┐   │
│  │   Rate Limit Logic   │   │
│  │                      │   │
│  │  Fixed Window        │   │
│  │  Sliding Window Log  │   │
│  │  Token Bucket (Lua)  │   │
│  └──────────┬───────────┘   │
│             │               │
└─────────────┼───────────────┘
              │
              ▼
    ┌─────────────────┐
    │   Redis (7.0)   │
    │                 │
    │  fw:client:key  │  ← Fixed Window counter
    │  sw:client      │  ← Sorted Set (timestamps)
    │  tb:client      │  ← Hash (tokens, last_refill)
    └─────────────────┘
              │
              ▼
┌─────────────────────────────┐
│      API Response           │
│                             │
│  200 OK  or  429 Too Many   │
│                             │
│  Headers:                   │
│  X-RateLimit-Limit: 10      │
│  X-RateLimit-Remaining: 3   │
│  X-RateLimit-Reset: 28      │
│  Retry-After: 28            │
└─────────────────────────────┘
```

---

## API Reference

All endpoints return a consistent response shape — both on success and on rate limit:

```json
{
  "allowed": true,
  "algorithm": "fixed_window",
  "count": 4,
  "remaining": 6,
  "reset_in": 32,
  "limit": 10
}
```

| Field | Description |
|-------|-------------|
| `allowed` | Whether the request was permitted |
| `algorithm` | Which algorithm processed the request |
| `count` | Requests made in current window |
| `remaining` | Requests left before rate limit |
| `reset_in` | Seconds until window resets (actual remaining time) |
| `limit` | Maximum requests per window |

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/fixed-window` | Fixed Window Counter |
| `GET` | `/api/sliding-window` | Sliding Window Log |
| `GET` | `/api/token-bucket` | Token Bucket |
| `GET` | `/health` | Health check / wake ping |
| `GET` | `/docs` | Swagger UI |

### Response Headers

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 6
X-RateLimit-Reset: 32
Retry-After: 32          ← only on 429
```

---

##  Key Technical Decisions

**1. Lua scripting for Token Bucket atomicity**
The token bucket requires a read-modify-write operation: fetch current tokens → calculate refill → check if sufficient → update. Without atomicity, two concurrent requests could both read the same token count and both get approved, violating the limit. Lua scripts execute atomically on Redis, solving this entirely.

**2. Proxy-aware client identification**
Behind Render's reverse proxy, `request.client.host` returns the internal load balancer IP — not the user's real IP. This caused every request to appear as a different client, resetting the counter each time. Fixed by reading `X-Forwarded-For` header and taking the first (leftmost) IP, which is the real client.

**3. Redis connection pooling**
Under burst load (10 simultaneous requests), a new Redis connection per request exhausted the connection limit and caused 500 errors. Fixed with a shared `ConnectionPool` with `max_connections=10`, amortizing connection overhead across requests.

**4. Consistent response shape across algorithms**
Each algorithm originally returned different fields. The frontend relied on these fields to update the UI — inconsistent shapes caused the counter to desync. Standardized all three algorithms to return identical fields on both 200 and 429 responses.

---

##  Run Locally

### With Docker (Recommended)

```bash
git clone https://github.com/akshayfouzder2005/rate-limiter.git
cd rate-limiter
docker compose up --build
```

Open [http://localhost:8000](http://localhost:8000)

### Without Docker

```bash
# Start Redis locally first
# Then:
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Environment Variables

```env
REDIS_URL=redis://localhost:6379
DEFAULT_MAX_REQUESTS=10
DEFAULT_WINDOW_SECONDS=60
```

---

##  Project Structure

```
rate-limiter/
├── app/
│   ├── main.py                  # FastAPI app, routes, response builder
│   ├── config.py                # Settings via pydantic-settings
│   ├── redis_client.py          # Shared Redis connection pool
│   └── limiters/
│       ├── fixed_window.py      # Fixed Window Counter
│       ├── sliding_window.py    # Sliding Window Log (sorted set)
│       └── token_bucket.py      # Token Bucket (Lua script)
├── frontend/
│   ├── index.html               # UI entry point
│   ├── css/styles.css
│   └── js/
│       ├── api.js               # All fetch calls
│       ├── ui.js                # All DOM updates
│       ├── timer.js             # Countdown logic
│       └── app.js               # Main controller
├── tests/
│   └── test_limiters.py
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

---

## Tests

```bash
pytest tests/ -v
```

---

## What I Learned

- Redis `INCR` is atomic — safe for distributed counters without locks
- Sorted sets (`ZSET`) are the right data structure for sliding window logs — O(log N) insert and range delete
- Lua scripts in Redis execute as a single atomic unit — essential for compound read-modify-write operations
- Connection pooling is not optional under concurrent load
- Reverse proxies modify the request — always read `X-Forwarded-For` in production deployments
- Consistent API contracts matter — the frontend and backend are a contract, not just implementation details

---

## 👤 Author

**Akshay Fouzder**  
CS Student · Graduating August 2027  
Targeting Backend / ML Engineering Internships 2026

[![GitHub](https://img.shields.io/badge/GitHub-akshayfouzder2005-181717?style=flat-square&logo=github)](https://github.com/akshayfouzder2005)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0077B5?style=flat-square&logo=linkedin)](https://linkedin.com/in/akshay-fouzder)

---

