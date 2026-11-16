from pathlib import Path
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    port: int = 8000
    jwt_secret: str
    jwt_expire_hours: int = 24
    password_workers: int = Field(default=2, ge=1, le=8)
    image_workers: int = Field(default=2, ge=1, le=8)
    login_requests_per_minute: int = Field(default=120, ge=1)
    register_requests_per_minute: int = Field(default=10, ge=1)
    booking_requests_per_minute: int = Field(default=20, ge=1)

    @field_validator("jwt_secret")
    @classmethod
    def strong_secret(cls, value):
        if len(value.encode()) < 32 or value in {
            "change_this_in_production_garagecar_2026",
            "your_jwt_secret_here_change_in_production",
            "replace-with-a-long-random-secret",
        }:
            raise ValueError("JWT_SECRET phải là khóa riêng ngẫu nhiên ít nhất 32 byte")
        return value

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
