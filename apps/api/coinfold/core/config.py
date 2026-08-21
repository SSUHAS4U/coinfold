"""Application settings, read once from the environment.

Every secret arrives as an environment variable. Nothing here has a usable
default for production: `database_url` and `jwt_secret` have no fallback, so a
misconfigured deploy fails at startup with a clear message instead of silently
running on a development credential.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Database -----------------------------------------------------------
    database_url: str = Field(
        ...,
        description="libpq connection string, e.g. postgresql://user:pw@host:5432/db",
    )
    db_pool_min: int = Field(default=1, ge=1)
    db_pool_max: int = Field(default=8, ge=1)

    # --- Auth ---------------------------------------------------------------
    jwt_secret: str = Field(..., min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = Field(default=30, ge=1)
    refresh_token_ttl_days: int = Field(default=14, ge=1)

    # --- HTTP ---------------------------------------------------------------
    # Comma-separated. No wildcard: credentialed CORS with "*" is rejected by
    # browsers anyway, and widening it would be a real security regression.
    allowed_origins: str = "http://localhost:3000"
    environment: str = "development"

    # --- Read-path limits ---------------------------------------------------
    # Caps the page size a client can ask for. Without it, `?page_size=100000`
    # is an unauthenticated way to make the server materialise the whole table.
    max_page_size: int = Field(default=100, ge=1, le=500)

    @field_validator("jwt_secret")
    @classmethod
    def _reject_placeholder_secret(cls, value: str) -> str:
        weak = {"change-me", "secret", "changeme", "your-secret-here"}
        if value.strip().lower() in weak:
            raise ValueError("jwt_secret is a placeholder; set a real random value")
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip().rstrip("/")
            for origin in self.allowed_origins.split(",")
            if origin.strip()
        ]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
