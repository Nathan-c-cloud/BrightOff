from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "BrightOff"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://brightoff:brightoff_dev@localhost:5432/brightoff"

    AWS_REGION: str = "eu-west-3"
    S3_BUCKET_NAME: str = "brightoff-cvs"

    ANTHROPIC_API_KEY: str = ""

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # JWT (a utiliser pour l'auth dans une task ulterieure)
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24  # 24h

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
