from datetime import date, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/profile", tags=["profile"])


# ---------- Schemas ----------


class ProfileResponse(BaseModel):
    id: UUID
    title: str | None = None
    summary: str | None = None
    years_of_experience: int | None = None
    skills: list = []
    experiences: list = []
    educations: list = []
    languages: list = []
    updated_at: datetime


class ProfileUpdateRequest(BaseModel):
    title: str | None = None
    summary: str | None = None
    years_of_experience: int | None = None


class SkillRequest(BaseModel):
    name: str
    category: Literal["hard", "soft"]
    level: int | None = Field(default=None, ge=1, le=5)


class SkillResponse(BaseModel):
    id: UUID
    name: str
    category: str
    level: int | None = None


class ExperienceRequest(BaseModel):
    company: str
    position: str
    start_date: date
    end_date: date | None = None
    description: str | None = None


class ExperienceResponse(BaseModel):
    id: UUID
    company: str
    position: str
    start_date: date
    end_date: date | None = None
    description: str | None = None


# ---------- Routes ----------


_AUTH_RESPONSES = {401: {"description": "JWT manquant, expiré ou invalide"}}


@router.get(
    "",
    response_model=ProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Profil de l'utilisateur courant",
    description=(
        "Retourne le profil complet de l'utilisateur connecté "
        "(skills, expériences, formations, langues)."
    ),
    responses={**_AUTH_RESPONSES, 404: {"description": "Profil introuvable"}},
)
async def get_profile() -> ProfileResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )


@router.put(
    "",
    response_model=ProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Modifier les infos générales du profil",
    description=("Met à jour le titre, le résumé et les années d'expérience du profil."),
    responses={**_AUTH_RESPONSES, 422: {"description": "Données invalides"}},
)
async def update_profile(payload: ProfileUpdateRequest) -> ProfileResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )


@router.post(
    "/skills",
    response_model=SkillResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter une compétence",
    description="Ajoute une nouvelle compétence au profil.",
    responses={**_AUTH_RESPONSES, 422: {"description": "Données invalides"}},
)
async def add_skill(payload: SkillRequest) -> SkillResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )


@router.put(
    "/skills/{skill_id}",
    response_model=SkillResponse,
    status_code=status.HTTP_200_OK,
    summary="Modifier une compétence",
    description="Modifie une compétence existante du profil.",
    responses={**_AUTH_RESPONSES, 404: {"description": "Compétence introuvable"}},
)
async def update_skill(skill_id: UUID, payload: SkillRequest) -> SkillResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )


@router.delete(
    "/skills/{skill_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer une compétence",
    description="Supprime une compétence du profil.",
    responses={**_AUTH_RESPONSES, 404: {"description": "Compétence introuvable"}},
)
async def delete_skill(skill_id: UUID) -> None:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )


@router.post(
    "/experiences",
    response_model=ExperienceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter une expérience",
    description="Ajoute une expérience professionnelle au profil.",
    responses={**_AUTH_RESPONSES, 422: {"description": "Données invalides"}},
)
async def add_experience(payload: ExperienceRequest) -> ExperienceResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )


@router.delete(
    "/experiences/{experience_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer une expérience",
    description="Supprime une expérience professionnelle du profil.",
    responses={**_AUTH_RESPONSES, 404: {"description": "Expérience introuvable"}},
)
async def delete_experience(experience_id: UUID) -> None:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )
