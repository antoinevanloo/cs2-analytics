"""Configuration settings for the parser service."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Service configuration
    service_name: str = "cs2-parser"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    log_level: str = "INFO"

    # API configuration
    host: str = "0.0.0.0"
    port: int = 8001
    workers: int = 4

    # Redis configuration
    redis_url: str = "redis://localhost:6379"
    redis_queue_name: str = "demo_parse_queue"
    redis_result_ttl: int = 3600  # 1 hour

    # Storage configuration
    storage_type: Literal["local", "s3"] = "local"
    local_demo_path: str = "/tmp/demos"
    s3_bucket: str = ""
    s3_region: str = "eu-west-1"
    s3_access_key: str = ""
    s3_secret_key: str = ""

    # Parser configuration
    max_demo_size_mb: int = 500
    parse_timeout_seconds: int = 300
    tick_rate: int = 64  # CS2 default tickrate
    enable_streaming: bool = True
    chunk_size: int = 10000  # Ticks per streaming chunk

    # Output configuration
    output_format: Literal["json", "ndjson", "msgpack"] = "ndjson"
    compress_output: bool = True


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
