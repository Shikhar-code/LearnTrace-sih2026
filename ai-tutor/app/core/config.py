"""
Centralized application configuration.

Settings are read from environment variables (or a .env file).
Sensitive values such as LLM API keys must never appear in source
control — use .env.example as a template.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from the environment."""

    # ------------------------------------------------------------------ #
    # Application
    # ------------------------------------------------------------------ #
    APP_NAME: str = "ai-tutor"
    APP_ENV: str = "development"
    APP_VERSION: str = "0.1.0"

    # ------------------------------------------------------------------ #
    # API
    # ------------------------------------------------------------------ #
    API_V1_PREFIX: str = "/api/v1"

    # ------------------------------------------------------------------ #
    # LLM — placeholders for future phases; unused in Phase 1
    # ------------------------------------------------------------------ #
    LLM_PROVIDER: str = ""
    LLM_MODEL: str = ""
    LLM_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


# Single shared settings instance used throughout the application.
settings = Settings()
