from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    port: int = 8000
    jwt_secret: str = "change_this_in_production_garagecar_2026"
    jwt_expire_hours: int = 24

    # PostgreSQL connection URL (primary)
    # Format: postgresql+asyncpg://user:password@host:port/dbname
    database_url: str = (
        "postgresql+asyncpg://garagecar:garagecar@localhost:5432/garagecar"
    )

    cors_origin: str = "*"
    log_level: str = "INFO"


settings = Settings()
