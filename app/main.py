from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from app.limiters.fixed_window import fixed_window
from app.limiters.sliding_window import sliding_window_log
from app.limiters.token_bucket import token_bucket
from app.config import settings

app = FastAPI(title="Rate Limiter API", version="1.0.0")
app.mount("/static", StaticFiles(directory="frontend"), name="static")

def get_client_id(request: Request) -> str:
    # Check for API key first
    api_key = request.headers.get("X-API-Key")
    if api_key:
        return api_key

    # On Render/Railway, real IP is in X-Forwarded-For header
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP — that's the real client IP
        return forwarded_for.split(",")[0].strip()

    # Fallback to direct IP
    return request.client.host

def build_response(result: dict) -> JSONResponse:
    status_code = 200 if result["allowed"] else 429
    content = {
        "allowed": result["allowed"],
        "algorithm": result["algorithm"],
        "count": result["count"],
        "remaining": result["remaining"],
        "reset_in": result["reset_in"],
        "limit": result["limit"],
    }
    if not result["allowed"]:
        content["error"] = "Rate limit exceeded"

    headers = {
        "X-RateLimit-Limit": str(result["limit"]),
        "X-RateLimit-Remaining": str(result["remaining"]),
        "X-RateLimit-Reset": str(result["reset_in"]),
    }
    if not result["allowed"]:
        headers["Retry-After"] = str(result["reset_in"])

    return JSONResponse(status_code=status_code, content=content, headers=headers)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/api/fixed-window")
async def fixed_window_route(request: Request):
    client_id = get_client_id(request)
    result = fixed_window(client_id, settings.DEFAULT_MAX_REQUESTS, settings.DEFAULT_WINDOW_SECONDS)
    return build_response(result)

@app.get("/api/sliding-window")
async def sliding_window_route(request: Request):
    client_id = get_client_id(request)
    result = sliding_window_log(client_id, settings.DEFAULT_MAX_REQUESTS, settings.DEFAULT_WINDOW_SECONDS)
    return build_response(result)

@app.get("/api/token-bucket")
async def token_bucket_route(request: Request):
    client_id = get_client_id(request)
    result = token_bucket(client_id, capacity=10, refill_rate=0.2)
    return build_response(result)

@app.get("/")
async def serve_ui():
    return FileResponse("frontend/index.html")