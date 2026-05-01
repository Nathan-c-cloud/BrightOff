from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import settings
from app.middleware.security_headers import SecurityHeadersMiddleware

app = FastAPI(
    title="BrightOff API",
    description=(
        "API backend pour BrightOff — plateforme de matching emploi "
        "avec analyse d'écart de compétences."
    ),
    version="0.1.0",
)

# Ordre d'enregistrement : FastAPI empile les middlewares en LIFO.
# CORSMiddleware est enregistré en premier → il s'exécute en dernier (couche interne).
# SecurityHeadersMiddleware est enregistré en second → il s'exécute en premier
# (couche externe), garantissant que les headers de sécurité sont présents même
# sur les réponses d'erreur CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SecurityHeadersMiddleware,
    environment=settings.ENVIRONMENT,
)


app.include_router(api_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
