from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    port: int = 8000
    jwt_secret: str = "change_this_in_production_garagecar_2026"
    jwt_expire_hours: int = 24

    # PostgreSQL connection URL (primary)
    # Format: postgresql+asyncpg://user:password@host:port/dbname
    database_url: str = "postgresql+asyncpg://garagecar:garagecar@localhost:5432/garagecar"

    cors_origin: str = "*"
    log_level: str = "INFO"

    # AI provider selection: mock | openai | gemini | ollama
    ai_provider: str = "mock"

    # OpenAI
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"

    # Google Gemini
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-1.5-flash"

    # Ollama (local)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"


settings = Settings()
