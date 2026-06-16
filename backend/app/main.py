from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1 import api_router
from app.core.config import settings
from app.core.rate_limiter import limiter
from app.middleware.security_headers import SecurityHeadersMiddleware

app = FastAPI(
    title="BrightOff API",
    description=(
        "API backend pour BrightOff — plateforme de matching emploi "
        "avec analyse d'écart de compétences."
    ),
    version="0.1.0",
    docs_url="/docs" if settings.ENVIRONMENT != "prod" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "prod" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT != "prod" else None,
)

# Rate limiter global — clé par IP cliente (X-Forwarded-For ou IP directe).
# L'instance est définie dans app.core.rate_limiter pour éviter les imports
# circulaires (main → api.v1 → auth → main). Les limites par route sont
# déclarées via @limiter.limit() dans les routers concernés.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Ordre d'enregistrement : FastAPI empile les middlewares en LIFO.
# CORSMiddleware est enregistré en premier → il s'exécute en dernier (couche interne).
# SecurityHeadersMiddleware est enregistré en second → il s'exécute en premier
# (couche externe), garantissant que les headers de sécurité sont présents même
# sur les réponses d'erreur CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.add_middleware(
    SecurityHeadersMiddleware,
    environment=settings.ENVIRONMENT,
)


app.include_router(api_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
