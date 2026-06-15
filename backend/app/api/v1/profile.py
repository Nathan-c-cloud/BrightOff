"""Router profile — S3-15.

GET  /api/v1/profile/me  → profil complet de l'utilisateur authentifié
PUT  /api/v1/profile/me  → remplacement complet (identité + collections)

Stratégie PUT : DELETE + re-INSERT des collections via cascade SQLAlchemy.
Simple, sans risque de doublons, adapté au MVP.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.auth.models import User
from app.modules.cv_parser.models import (
    Profile,
    ProfileEducation,
    ProfileExperience,
    ProfileLanguage,
    ProfileSkill,
)

router = APIRouter(prefix="/profile", tags=["profile"])

# Valeurs de level acceptées pour les langues (CECRL + niveaux courants)
LANGUAGE_LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2", "Natif", "Bilingue"}

# Catégories de compétences — max 10 chars (contrainte BDD String(10))
SkillCategory = Literal["tech", "soft", "tool", "language", "other"]

_AUTH_RESPONSES = {401: {"description": "JWT manquant, expiré ou invalide"}}


# ---------------------------------------------------------------------------
# Schémas — collections (lecture)
# ---------------------------------------------------------------------------


class SkillOut(BaseModel):
    id: UUID
    name: str
    category: str
    level: int | None = None

    model_config = {"from_attributes": True}


class ExperienceOut(BaseModel):
    id: UUID
    company: str
    position: str
    start_date: date
    end_date: date | None = None
    description: str | None = None

    model_config = {"from_attributes": True}


class EducationOut(BaseModel):
    id: UUID
    school: str
    degree: str
    field: str | None = None
    start_date: date
    end_date: date | None = None

    model_config = {"from_attributes": True}


class LanguageOut(BaseModel):
    id: UUID
    name: str
    level: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Schémas — collections (écriture)
# ---------------------------------------------------------------------------


class SkillIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category: SkillCategory
    level: int | None = Field(default=None, ge=1, le=5)


class ExperienceIn(BaseModel):
    company: str = Field(min_length=1, max_length=255)
    position: str = Field(min_length=1, max_length=255)
    start_date: date
    end_date: date | None = None
    description: str | None = None


class EducationIn(BaseModel):
    school: str = Field(min_length=1, max_length=255)
    degree: str = Field(min_length=1, max_length=255)
    field: str | None = Field(default=None, max_length=255)
    start_date: date
    end_date: date | None = None


class LanguageIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    # Niveau CECRL ou Natif/Bilingue — max 8 chars (BDD String(10))
    level: str = Field(min_length=1, max_length=10)

    def model_post_init(self, __context: object) -> None:
        if self.level not in LANGUAGE_LEVELS:
            raise ValueError(
                f"level '{self.level}' invalide. Valeurs acceptées : {sorted(LANGUAGE_LEVELS)}"
            )


# ---------------------------------------------------------------------------
# Schémas — profil global
# ---------------------------------------------------------------------------


class ProfileResponse(BaseModel):
    id: UUID
    title: str | None = None
    summary: str | None = None
    years_of_experience: int | None = None
    skills: list[SkillOut] = []
    experiences: list[ExperienceOut] = []
    educations: list[EducationOut] = []
    languages: list[LanguageOut] = []
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    years_of_experience: int | None = Field(default=None, ge=0, le=70)
    skills: list[SkillIn] = []
    experiences: list[ExperienceIn] = []
    educations: list[EducationIn] = []
    languages: list[LanguageIn] = []


# ---------------------------------------------------------------------------
# Helper — mapping ORM → response
# ---------------------------------------------------------------------------


def _profile_to_response(profile: Profile) -> ProfileResponse:
    return ProfileResponse(
        id=profile.id,
        title=profile.title,
        summary=profile.summary,
        years_of_experience=profile.years_of_experience,
        skills=[SkillOut.model_validate(s) for s in profile.skills],
        experiences=[ExperienceOut.model_validate(e) for e in profile.experiences],
        educations=[EducationOut.model_validate(ed) for ed in profile.educations],
        languages=[LanguageOut.model_validate(lang) for lang in profile.languages],
        updated_at=profile.updated_at,
    )


# ---------------------------------------------------------------------------
# Helper — charger le profil avec ses collections
# ---------------------------------------------------------------------------


async def _get_profile_with_collections(
    db: AsyncSession, user_id: UUID
) -> Profile | None:
    stmt = (
        select(Profile)
        .where(Profile.user_id == user_id)
        .options(
            selectinload(Profile.skills),
            selectinload(Profile.experiences),
            selectinload(Profile.educations),
            selectinload(Profile.languages),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get(
    "/me",
    response_model=ProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Profil de l'utilisateur courant",
    description=(
        "Retourne le profil complet de l'utilisateur connecté "
        "(identité, skills, expériences, formations, langues)."
    ),
    responses={**_AUTH_RESPONSES, 404: {"description": "Profil introuvable"}},
)
async def get_my_profile(
    current_user: User = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> ProfileResponse:
    profile = await _get_profile_with_collections(db, current_user.id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )
    return _profile_to_response(profile)


@router.put(
    "/me",
    response_model=ProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Mettre à jour le profil complet",
    description=(
        "Remplace l'intégralité du profil : identité + collections (skills, "
        "expériences, formations, langues). Stratégie MVP : DELETE + re-INSERT "
        "des collections à chaque appel. L'identité (title, summary, years) est "
        "mise à jour en place. Retourne le profil mis à jour."
    ),
    responses={
        **_AUTH_RESPONSES,
        404: {"description": "Profil introuvable (créer d'abord via upload de CV)"},
        422: {"description": "Données invalides (level hors range, champ manquant...)"},
    },
)
async def update_my_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> ProfileResponse:
    profile = await _get_profile_with_collections(db, current_user.id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found. Upload a CV first to create your profile.",
        )

    # Mise à jour de l'identité
    profile.title = payload.title
    profile.summary = payload.summary
    profile.years_of_experience = payload.years_of_experience

    # Remplacement des collections : vider puis re-insérer.
    # La cascade "all, delete-orphan" sur le relationship assure que les anciens
    # objets sont supprimés en BDD dès qu'ils sont retirés de la collection Python.
    profile.skills = [
        ProfileSkill(
            profile_id=profile.id,
            name=s.name,
            category=s.category,
            level=s.level,
        )
        for s in payload.skills
    ]
    profile.experiences = [
        ProfileExperience(
            profile_id=profile.id,
            company=e.company,
            position=e.position,
            start_date=e.start_date,
            end_date=e.end_date,
            description=e.description,
        )
        for e in payload.experiences
    ]
    profile.educations = [
        ProfileEducation(
            profile_id=profile.id,
            school=ed.school,
            degree=ed.degree,
            field=ed.field,
            start_date=ed.start_date,
            end_date=ed.end_date,
        )
        for ed in payload.educations
    ]
    profile.languages = [
        ProfileLanguage(
            profile_id=profile.id,
            name=lang.name,
            level=lang.level,
        )
        for lang in payload.languages
    ]

    await db.flush()

    # Recharger le profil complet après flush :
    # - les scalaires (updated_at, title, summary, years_of_experience, id) car updated_at
    #   est géré côté serveur (onupdate=func.now()) et expire après flush en async
    # - les collections pour récupérer les UUIDs générés par la BDD
    await db.refresh(
        profile,
        attribute_names=[
            "id",
            "title",
            "summary",
            "years_of_experience",
            "updated_at",
            "skills",
            "experiences",
            "educations",
            "languages",
        ],
    )

    return _profile_to_response(profile)
