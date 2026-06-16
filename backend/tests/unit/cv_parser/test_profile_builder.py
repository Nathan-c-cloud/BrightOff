"""Tests d'intégration BDD — profile_builder.py (S3-11).

Stratégie :
- PostgreSQL réel (brightoff_test) via les fixtures conftest.py (db_session).
- Pas de mock : on teste la vraie logique SQL (ON CONFLICT, DELETE, re-INSERT).
- Chaque test repart d'une session isolée (SAVEPOINT → rollback en teardown).

Prérequis :
    - Container PostgreSQL démarré : docker compose up postgres -d
    - Base brightoff_test accessible
"""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.cv_parser.models import (
    CV,
    Profile,
    ProfileEducation,
    ProfileExperience,
    ProfileLanguage,
    ProfileSkill,
)
from app.modules.cv_parser.profile_builder import upsert_profile

# ---------------------------------------------------------------------------
# Données de test réutilisables
# ---------------------------------------------------------------------------

_PARSED_FULL = {
    "is_cv": True,
    "title": "Développeur Fullstack",
    "summary": "Expert React et FastAPI",
    "years_of_experience": 4,
    "skills": [
        {"name": "Python", "category": "tech", "level": 4},
        {"name": "React", "category": "tech", "level": 3},
        {"name": "Leadership", "category": "soft", "level": None},
    ],
    "experiences": [
        {
            "company": "BrightOff",
            "position": "Lead Dev",
            "start_date": "2022-01-01",
            "end_date": None,
            "description": "Développement de la plateforme",
        }
    ],
    "education": [
        {
            "school": "IUT Lyon",
            "degree": "BUT Informatique",
            "field": None,
            "start_date": "2019-09-01",
            "end_date": "2022-06-01",
        }
    ],
    "languages": [
        {"name": "Français", "level": "Natif"},
        {"name": "Anglais", "level": "B2"},
    ],
}

_PARSED_SECOND_CV = {
    "is_cv": True,
    "title": "Lead Engineer",
    "summary": None,
    "years_of_experience": 6,
    "skills": [
        {"name": "Go", "category": "tech", "level": 2},
    ],
    "experiences": [
        {
            "company": "NewCorp",
            "position": "CTO",
            "start_date": "2023-06-01",
            "end_date": None,
            "description": None,
        }
    ],
    "education": [],
    "languages": [
        {"name": "Anglais", "level": "C1"},
    ],
}

_PARSED_MINIMAL = {
    "is_cv": True,
    "title": None,
    "summary": None,
    "years_of_experience": None,
    "skills": [],
    "experiences": [],
    "education": [],
    "languages": [],
}


# ---------------------------------------------------------------------------
# Fixtures locales
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"pb-test-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="hashed",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def test_cv(db_session: AsyncSession, test_user: User) -> CV:
    cv = CV(
        id=uuid.uuid4(),
        user_id=test_user.id,
        s3_key=f"cvs/{uuid.uuid4()}/cv.pdf",
        original_filename="cv.pdf",
        file_format="pdf",
        parsing_status="parsing",
    )
    db_session.add(cv)
    await db_session.flush()
    return cv


@pytest_asyncio.fixture
async def test_cv_2(db_session: AsyncSession, test_user: User) -> CV:
    cv = CV(
        id=uuid.uuid4(),
        user_id=test_user.id,
        s3_key=f"cvs/{uuid.uuid4()}/cv2.pdf",
        original_filename="cv2.pdf",
        file_format="pdf",
        parsing_status="parsing",
    )
    db_session.add(cv)
    await db_session.flush()
    return cv


# ---------------------------------------------------------------------------
# Tests — premier upsert (INSERT)
# ---------------------------------------------------------------------------


class TestUpsertProfileFirstCall:
    async def test_upsert_creates_profile_in_db(self, db_session, test_user, test_cv):
        profile = await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_FULL)

        result = await db_session.execute(
            select(Profile).where(Profile.user_id == test_user.id)
        )
        db_profile = result.scalar_one_or_none()

        assert db_profile is not None
        assert db_profile.id == profile.id
        assert db_profile.title == "Développeur Fullstack"
        assert db_profile.years_of_experience == 4

    async def test_upsert_creates_skills(self, db_session, test_user, test_cv):
        profile = await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_FULL)

        result = await db_session.execute(
            select(func.count()).where(ProfileSkill.profile_id == profile.id)
        )
        count = result.scalar_one()
        assert count == 3

    async def test_upsert_creates_experiences(self, db_session, test_user, test_cv):
        profile = await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_FULL)

        result = await db_session.execute(
            select(func.count()).where(ProfileExperience.profile_id == profile.id)
        )
        count = result.scalar_one()
        assert count == 1

    async def test_upsert_creates_educations(self, db_session, test_user, test_cv):
        profile = await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_FULL)

        result = await db_session.execute(
            select(func.count()).where(ProfileEducation.profile_id == profile.id)
        )
        count = result.scalar_one()
        assert count == 1

    async def test_upsert_creates_languages(self, db_session, test_user, test_cv):
        profile = await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_FULL)

        result = await db_session.execute(
            select(func.count()).where(ProfileLanguage.profile_id == profile.id)
        )
        count = result.scalar_one()
        assert count == 2

    async def test_upsert_returns_profile_with_correct_id(self, db_session, test_user, test_cv):
        profile = await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_FULL)

        assert profile.id is not None
        assert profile.user_id == test_user.id
        assert profile.cv_id == test_cv.id

    async def test_upsert_skill_has_correct_category_and_level(
        self, db_session, test_user, test_cv
    ):
        profile = await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_FULL)

        result = await db_session.execute(
            select(ProfileSkill).where(
                ProfileSkill.profile_id == profile.id,
                ProfileSkill.name == "Python",
            )
        )
        skill = result.scalar_one_or_none()

        assert skill is not None
        assert skill.category == "technique"  # "tech" normalisé par _normalize_category (S3-16)
        assert skill.level == 4


# ---------------------------------------------------------------------------
# Tests — second upsert (UPDATE + DELETE + re-INSERT)
# ---------------------------------------------------------------------------


class TestUpsertProfileSecondCall:
    async def test_upsert_updates_profile_scalars(
        self, db_session, test_user, test_cv, test_cv_2
    ):
        await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_FULL)
        profile2 = await upsert_profile(db_session, test_user.id, test_cv_2.id, _PARSED_SECOND_CV)

        result = await db_session.execute(
            select(Profile).where(Profile.user_id == test_user.id)
        )
        db_profile = result.scalar_one_or_none()

        # Un seul profil par user (ON CONFLICT)
        assert db_profile is not None
        assert db_profile.id == profile2.id
        assert db_profile.title == "Lead Engineer"
        assert db_profile.years_of_experience == 6

    async def test_upsert_only_one_profile_per_user(
        self, db_session, test_user, test_cv, test_cv_2
    ):
        await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_FULL)
        await upsert_profile(db_session, test_user.id, test_cv_2.id, _PARSED_SECOND_CV)

        result = await db_session.execute(
            select(func.count()).select_from(Profile).where(Profile.user_id == test_user.id)
        )
        count = result.scalar_one()
        assert count == 1

    async def test_upsert_replaces_skills_no_duplicates(
        self, db_session, test_user, test_cv, test_cv_2
    ):
        profile1 = await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_FULL)
        profile2 = await upsert_profile(db_session, test_user.id, test_cv_2.id, _PARSED_SECOND_CV)

        # Les deux appels retournent le même profile_id (ON CONFLICT)
        assert profile1.id == profile2.id

        result = await db_session.execute(
            select(func.count()).where(ProfileSkill.profile_id == profile1.id)
        )
        count = result.scalar_one()
        # Seul le jeu du 2e CV doit être présent (1 skill : "Go")
        assert count == 1

    async def test_upsert_replaces_experiences_no_old_data(
        self, db_session, test_user, test_cv, test_cv_2
    ):
        profile1 = await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_FULL)
        await upsert_profile(db_session, test_user.id, test_cv_2.id, _PARSED_SECOND_CV)

        result = await db_session.execute(
            select(ProfileExperience).where(
                ProfileExperience.profile_id == profile1.id,
                ProfileExperience.company == "BrightOff",
            )
        )
        # L'ancienne expérience "BrightOff" ne doit plus exister
        old_exp = result.scalar_one_or_none()
        assert old_exp is None

    async def test_upsert_replaces_languages_no_old_data(
        self, db_session, test_user, test_cv, test_cv_2
    ):
        profile1 = await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_FULL)
        await upsert_profile(db_session, test_user.id, test_cv_2.id, _PARSED_SECOND_CV)

        result = await db_session.execute(
            select(func.count()).where(ProfileLanguage.profile_id == profile1.id)
        )
        count = result.scalar_one()
        # Le 2e CV a 1 langue (Anglais C1), la langue "Français" du 1er CV doit être supprimée
        assert count == 1


# ---------------------------------------------------------------------------
# Tests — données minimales (parsed quasi-vide)
# ---------------------------------------------------------------------------


class TestUpsertProfileMinimalData:
    async def test_upsert_minimal_data_does_not_crash(self, db_session, test_user, test_cv):
        profile = await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_MINIMAL)

        assert profile is not None
        assert profile.id is not None

    async def test_upsert_minimal_data_creates_profile_with_nulls(
        self, db_session, test_user, test_cv
    ):
        profile = await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_MINIMAL)

        result = await db_session.execute(
            select(Profile).where(Profile.user_id == test_user.id)
        )
        db_profile = result.scalar_one_or_none()

        assert db_profile is not None
        assert db_profile.title is None
        assert db_profile.summary is None
        assert db_profile.years_of_experience is None

    async def test_upsert_minimal_data_no_skills_inserted(self, db_session, test_user, test_cv):
        profile = await upsert_profile(db_session, test_user.id, test_cv.id, _PARSED_MINIMAL)

        result = await db_session.execute(
            select(func.count()).where(ProfileSkill.profile_id == profile.id)
        )
        count = result.scalar_one()
        assert count == 0

    async def test_upsert_skill_without_name_is_ignored(self, db_session, test_user, test_cv):
        parsed = {
            **_PARSED_MINIMAL,
            "skills": [
                {"name": None, "category": "tech", "level": 3},  # name manquant → ignoré
                {"name": "Python", "category": "tech", "level": 2},  # valide
            ],
        }
        profile = await upsert_profile(db_session, test_user.id, test_cv.id, parsed)

        result = await db_session.execute(
            select(func.count()).where(ProfileSkill.profile_id == profile.id)
        )
        count = result.scalar_one()
        # Seul le skill valide (Python) doit être inséré
        assert count == 1

    async def test_upsert_experience_without_start_date_is_ignored(
        self, db_session, test_user, test_cv
    ):
        parsed = {
            **_PARSED_MINIMAL,
            "experiences": [
                {
                    "company": "Acme",
                    "position": "Dev",
                    "start_date": None,  # manquant → ignoré
                    "end_date": None,
                    "description": None,
                }
            ],
        }
        profile = await upsert_profile(db_session, test_user.id, test_cv.id, parsed)

        result = await db_session.execute(
            select(func.count()).where(ProfileExperience.profile_id == profile.id)
        )
        count = result.scalar_one()
        assert count == 0
