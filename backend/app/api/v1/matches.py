from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.v1.offers import OfferResponse

router = APIRouter(prefix="/matches", tags=["matches"])


# ---------- Schemas ----------


class MatchResponse(BaseModel):
    id: UUID
    offer: OfferResponse
    score: int = Field(ge=0, le=100)
    score_skills: int
    score_experience: int
    score_education: int
    score_soft_skills: int
    score_other: int
    computed_at: datetime


class MatchListResponse(BaseModel):
    items: list[MatchResponse]
    total: int
    page: int
    page_size: int


# ---------- Routes ----------


@router.get(
    "",
    response_model=MatchListResponse,
    status_code=status.HTTP_200_OK,
    summary="Liste des offres matchées pour l'utilisateur",
    description=(
        "Retourne la liste des offres matchées avec l'utilisateur courant, "
        "triées par score décroissant. C'est la source du dashboard principal."
    ),
    responses={
        401: {"description": "JWT manquant, expiré ou invalide"},
    },
)
async def list_matches(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    min_score: int | None = Query(default=None, ge=0, le=100),
) -> MatchListResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )


@router.get(
    "/{match_id}",
    response_model=MatchResponse,
    status_code=status.HTTP_200_OK,
    summary="Détail d'un match",
    description=(
        "Retourne le détail complet d'un match spécifique avec ses sous-scores par critère."
    ),
    responses={
        401: {"description": "JWT manquant, expiré ou invalide"},
        404: {"description": "Match introuvable"},
    },
)
async def get_match(match_id: UUID) -> MatchResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )
