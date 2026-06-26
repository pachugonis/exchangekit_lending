from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # App
    app_base_url: str = "http://localhost:3000"
    secret_key: str = "change_me"
    environment: str = "development"

    # Database / cache
    database_url: str = "postgresql+asyncpg://exchangekit:exchangekit@db:5432/exchangekit"
    redis_url: str = "redis://redis:6379/0"

    # YooKassa
    yookassa_shop_id: str = ""
    yookassa_secret_key: str = ""
    yookassa_return_url: str = "http://localhost:3000/payment/success"
    license_price: str = "29900.00"

    # Email (SMTP)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@exchangekit.cc"

    # JWT
    jwt_secret: str = "change_me"
    jwt_expire_minutes: int = 1440

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    @property
    def license_price_decimal(self) -> str:
        # ЮКасса ожидает строку вида "29900.00"
        return f"{float(self.license_price):.2f}"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
