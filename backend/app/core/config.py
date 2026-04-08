from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "BrightOff"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/brightoff"

    AWS_REGION: str = "eu-west-3"
    S3_BUCKET_NAME: str = "brightoff-cvs"

    ANTHROPIC_API_KEY: str = ""

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env"}


settings = Settings()
