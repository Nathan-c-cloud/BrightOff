from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "BrightOff"

    # Cible d'exécution. Défaut "prod" (secure-by-default) : un déploiement qui oublie
    # de définir ENVIRONMENT reste dans le mode le plus restrictif.
    ENVIRONMENT: Literal["dev", "staging", "prod"] = "prod"

    # DEBUG est autorisé uniquement hors production. Le validateur ci-dessous empêche
    # le backend de démarrer si DEBUG=true est détecté en prod (fail-fast explicite).
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://brightoff:brightoff_dev@localhost:5432/brightoff"

    AWS_REGION: str = "eu-west-3"
    S3_BUCKET_NAME: str = "brightoff-cvs"

    ANTHROPIC_API_KEY: str = ""

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}

    @model_validator(mode="after")
    def _enforce_prod_safety(self) -> "Settings":
        """Refuse le démarrage si DEBUG=true est activé en environnement de production.

        Objectif : rendre la misconfiguration visible immédiatement (fail-fast)
        plutôt que de laisser un backend prod exposer des stack traces ou des logs SQL.
        """
        if self.ENVIRONMENT == "prod" and self.DEBUG:
            raise ValueError(
                "DEBUG=true is forbidden when ENVIRONMENT=prod. "
                "Either set DEBUG=false or use ENVIRONMENT=dev/staging."
            )
        return self


settings = Settings()
