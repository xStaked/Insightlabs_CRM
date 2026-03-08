from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    project_name: str = "Insightlabs CRM"
    environment: str = "local"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_minutes: int = 10080

    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "insightlabs"
    postgres_user: str = "insightlabs"
    postgres_password: str = "insightlabs"

    redis_url: str = "redis://redis:6379/0"
    cors_origins: str = "http://localhost:3000"

    wompi_public_key: str = ""
    wompi_private_key: str = ""
    wompi_webhook_secret: str = ""

    meta_webhook_verify_token: str = ""
    meta_app_secret: str = ""

    whatsapp_api_url: str = ""
    whatsapp_api_token: str = ""
    instagram_api_url: str = ""
    instagram_api_token: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
