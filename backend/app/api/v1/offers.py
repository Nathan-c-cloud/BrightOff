from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

router = APIRouter(prefix="/offers", tags=["offers"])


# ---------- Schemas ----------


class OfferResponse(BaseModel):
    id: UUID
    source: str
    source_url: str
    title: str
    company: str
    description: str
    location: str | None = None
    contract_type: str | None = None
    remote_policy: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    scraped_at: datetime


class OfferListResponse(BaseModel):
    items: list[OfferResponse]
    total: int
    page: int
    page_size: int


# ---------- Routes ----------


@router.get(
    "",
    response_model=OfferListResponse,
    status_code=status.HTTP_200_OK,
    summary="Liste paginée des offres",
    description=(
        "Liste paginée des offres d'emploi disponibles. Supporte la recherche "
        "textuelle et le filtrage par localisation et politique de télétravail."
    ),
    responses={
        401: {"description": "JWT manquant, expiré ou invalide"},
    },
)
async def list_offers(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    location: str | None = Query(default=None),
    remote_policy: str | None = Query(default=None),
) -> OfferListResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )


@router.get(
    "/{offer_id}",
    response_model=OfferResponse,
    status_code=status.HTTP_200_OK,
    summary="Détail d'une offre",
    description="Retourne le détail complet d'une offre d'emploi.",
    responses={
        401: {"description": "JWT manquant, expiré ou invalide"},
        404: {"description": "Offre introuvable"},
    },
)
async def get_offer(offer_id: UUID) -> OfferResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )
