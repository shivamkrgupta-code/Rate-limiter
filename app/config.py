from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    REDIS_URL: str = "redis://localhost:6379"
    DEFAULT_MAX_REQUESTS: int = 10
    DEFAULT_WINDOW_SECONDS: int = 60

    class Config:
        env_file = ".env"

settings = Settings()