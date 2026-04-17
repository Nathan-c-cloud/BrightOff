from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(tags=["gap-analysis"])


# ---------- Schemas ----------


class MissingSkill(BaseModel):
    name: str
    importance: Literal["must_have", "nice_to_have"]
    impact_score: int = Field(ge=0)


class Recommendation(BaseModel):
    skill_name: str
    resource_type: Literal["course", "article", "video", "project"]
    title: str
    url: str


class GapAnalysisResponse(BaseModel):
    match_id: UUID
    missing_skills: list[MissingSkill]
    recommendations: list[Recommendation]
    generated_at: datetime


# ---------- Routes ----------


@router.get(
    "/matches/{match_id}/gap-analysis",
    response_model=GapAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyse d'écart pour un match",
    description=(
        "Retourne l'analyse d'écart de compétences pour un match : "
        "compétences manquantes avec leur impact sur le score, "
        "et recommandations de ressources pour combler les gaps."
    ),
    responses={
        401: {"description": "JWT manquant, expiré ou invalide"},
        404: {"description": "Match introuvable ou analyse non disponible"},
    },
)
async def get_gap_analysis(match_id: UUID) -> GapAnalysisResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )
