"""Tests d'intégration — GET/PUT /api/v1/profile/me (S3-15).

Stratégie :
    - PostgreSQL réel (brightoff_test) via les fixtures conftest.py
    - get_current_user overridé pour injecter un user de test avec un vrai UUID
    - Fixtures : un user + un profil pré-créé, et un user sans profil

Prérequis :
    - Container PostgreSQL démarré : docker compose up postgres -d
    - Base brightoff_test accessible

Exécution :
    cd backend && pytest tests/integration/test_profile.py -v
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.modules.auth.models import User
from app.modules.cv_parser.models import Profile, ProfileSkill

# ---------------------------------------------------------------------------
# Fixtures utilisateur et profil
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Utilisateur de test avec un vrai UUID en BDD."""
    user = User(
        id=uuid.uuid4(),
        email=f"profile-test-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="hashed",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def test_user_no_profile(db_session: AsyncSession) -> User:
    """Utilisateur de test sans profil associé."""
    user = User(
        id=uuid.uuid4(),
        email=f"no-profile-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="hashed",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def test_profile(db_session: AsyncSession, test_user: User) -> Profile:
    """Profil de base pour test_user avec une skill pré-insérée."""
    profile = Profile(
        id=uuid.uuid4(),
        user_id=test_user.id,
        title="Développeur Fullstack",
        summary="Passionné par le cloud et les APIs.",
        years_of_experience=3,
    )
    db_session.add(profile)
    await db_session.flush()

    skill = ProfileSkill(
        id=uuid.uuid4(),
        profile_id=profile.id,
        name="Python",
        category="tech",
        level=4,
    )
    db_session.add(skill)
    await db_session.flush()

    return profile


# ---------------------------------------------------------------------------
# Fixtures clients HTTP
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def profile_client(
    db_session: AsyncSession,
    test_user: User,
    test_profile: Profile,
) -> AsyncGenerator[AsyncClient, None]:
    """Client authentifié en tant que test_user (qui possède un profil)."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    async def override_get_current_user() -> User:
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def no_profile_client(
    db_session: AsyncSession,
    test_user_no_profile: User,
) -> AsyncGenerator[AsyncClient, None]:
    """Client authentifié en tant que test_user_no_profile (pas de profil)."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    async def override_get_current_user() -> User:
        return test_user_no_profile

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def unauth_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Client sans authentification — pour tester les 401."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Tests GET /api/v1/profile/me
# ---------------------------------------------------------------------------


class TestGetProfile:
    @pytest.mark.asyncio
    async def test_get_profile_returns_200_with_full_data(
        self, profile_client: AsyncClient, test_profile: Profile
    ):
        """GET /profile/me → 200 avec l'intégralité du profil (identité + skills)."""
        response = await profile_client.get("/api/v1/profile/me")

        assert response.status_code == 200, response.text
        data = response.json()

        assert data["id"] == str(test_profile.id)
        assert data["title"] == "Développeur Fullstack"
        assert data["summary"] == "Passionné par le cloud et les APIs."
        assert data["years_of_experience"] == 3
        assert isinstance(data["skills"], list)
        assert len(data["skills"]) == 1
        assert data["skills"][0]["name"] == "Python"
        assert data["skills"][0]["category"] == "tech"
        assert data["skills"][0]["level"] == 4
        assert isinstance(data["experiences"], list)
        assert isinstance(data["educations"], list)
        assert isinstance(data["languages"], list)
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_get_profile_404_when_no_profile(
        self, no_profile_client: AsyncClient
    ):
        """GET /profile/me → 404 si l'user n'a pas encore de profil."""
        response = await no_profile_client.get("/api/v1/profile/me")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_profile_401_without_jwt(self, unauth_client: AsyncClient):
        """GET /profile/me sans header Authorization → 401."""
        response = await unauth_client.get("/api/v1/profile/me")
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Tests PUT /api/v1/profile/me
# ---------------------------------------------------------------------------

_FULL_PAYLOAD = {
    "title": "Cloud Engineer",
    "summary": "Architecte AWS passionné.",
    "years_of_experience": 5,
    "skills": [
        {"name": "Python", "category": "tech", "level": 5},
        {"name": "Terraform", "category": "tool", "level": 3},
        {"name": "Communication", "category": "soft", "level": None},
    ],
    "experiences": [
        {
            "company": "Startup SAS",
            "position": "Fullstack Dev",
            "start_date": "2022-01-01",
            "end_date": "2024-06-30",
            "description": "Backend FastAPI, infra AWS.",
        }
    ],
    "educations": [
        {
            "school": "EPITECH",
            "degree": "Bac+5 Expert IT",
            "field": "Informatique",
            "start_date": "2017-09-01",
            "end_date": "2022-06-30",
        }
    ],
    "languages": [
        {"name": "Français", "level": "Natif"},
        {"name": "Anglais", "level": "C1"},
    ],
}


class TestPutProfile:
    @pytest.mark.asyncio
    async def test_put_profile_returns_200_with_updated_data(
        self, profile_client: AsyncClient
    ):
        """PUT /profile/me → 200 avec les nouvelles données en réponse."""
        response = await profile_client.put(
            "/api/v1/profile/me", json=_FULL_PAYLOAD
        )

        assert response.status_code == 200, response.text
        data = response.json()

        assert data["title"] == "Cloud Engineer"
        assert data["summary"] == "Architecte AWS passionné."
        assert data["years_of_experience"] == 5

    @pytest.mark.asyncio
    async def test_put_profile_replaces_skills(self, profile_client: AsyncClient):
        """PUT /profile/me → les skills sont remplacées (pas de doublon)."""
        response = await profile_client.put(
            "/api/v1/profile/me", json=_FULL_PAYLOAD
        )

        data = response.json()
        skill_names = [s["name"] for s in data["skills"]]

        # La skill "Python" initiale du profil est remplacée par les 3 nouvelles
        assert len(data["skills"]) == 3
        assert "Python" in skill_names
        assert "Terraform" in skill_names
        assert "Communication" in skill_names

    @pytest.mark.asyncio
    async def test_put_profile_replaces_experiences(self, profile_client: AsyncClient):
        """PUT /profile/me → les expériences sont correctement insérées."""
        response = await profile_client.put(
            "/api/v1/profile/me", json=_FULL_PAYLOAD
        )

        data = response.json()
        assert len(data["experiences"]) == 1
        assert data["experiences"][0]["company"] == "Startup SAS"
        assert data["experiences"][0]["end_date"] == "2024-06-30"

    @pytest.mark.asyncio
    async def test_put_profile_no_duplicates_on_second_call(
        self, profile_client: AsyncClient
    ):
        """Deux appels PUT successifs → pas de doublons dans les collections."""
        await profile_client.put("/api/v1/profile/me", json=_FULL_PAYLOAD)
        response = await profile_client.put(
            "/api/v1/profile/me", json=_FULL_PAYLOAD
        )

        assert response.status_code == 200
        data = response.json()
        # Exactement le nombre de skills du payload, pas le double
        assert len(data["skills"]) == 3
        assert len(data["experiences"]) == 1

    @pytest.mark.asyncio
    async def test_put_profile_current_position_null_end_date(
        self, profile_client: AsyncClient
    ):
        """end_date null dans une expérience → poste actuel accepté."""
        payload = {
            **_FULL_PAYLOAD,
            "experiences": [
                {
                    "company": "Current Corp",
                    "position": "Lead Dev",
                    "start_date": "2023-01-01",
                    "end_date": None,
                    "description": None,
                }
            ],
        }

        response = await profile_client.put("/api/v1/profile/me", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["experiences"][0]["end_date"] is None

    @pytest.mark.asyncio
    async def test_put_profile_404_when_no_profile(
        self, no_profile_client: AsyncClient
    ):
        """PUT /profile/me sans profil existant → 404."""
        response = await no_profile_client.put(
            "/api/v1/profile/me", json=_FULL_PAYLOAD
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_put_profile_401_without_jwt(self, unauth_client: AsyncClient):
        """PUT /profile/me sans header Authorization → 401."""
        response = await unauth_client.put(
            "/api/v1/profile/me", json=_FULL_PAYLOAD
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_put_profile_422_invalid_skill_level(
        self, profile_client: AsyncClient
    ):
        """skill.level=99 → 422 Unprocessable Entity."""
        payload = {
            **_FULL_PAYLOAD,
            "skills": [{"name": "Python", "category": "tech", "level": 99}],
        }

        response = await profile_client.put("/api/v1/profile/me", json=payload)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_put_profile_422_invalid_skill_level_zero(
        self, profile_client: AsyncClient
    ):
        """skill.level=0 → 422 (level est 1-5)."""
        payload = {
            **_FULL_PAYLOAD,
            "skills": [{"name": "Python", "category": "tech", "level": 0}],
        }

        response = await profile_client.put("/api/v1/profile/me", json=payload)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_put_profile_422_invalid_language_level(
        self, profile_client: AsyncClient
    ):
        """language.level invalide (ex: "D7") → 422."""
        payload = {
            **_FULL_PAYLOAD,
            "languages": [{"name": "Anglais", "level": "D7"}],
        }

        response = await profile_client.put("/api/v1/profile/me", json=payload)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_put_profile_422_invalid_skill_category(
        self, profile_client: AsyncClient
    ):
        """skill.category='unknown_category' → 422."""
        payload = {
            **_FULL_PAYLOAD,
            "skills": [{"name": "Python", "category": "unknown_category", "level": 3}],
        }

        response = await profile_client.put("/api/v1/profile/me", json=payload)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_put_profile_empty_collections(self, profile_client: AsyncClient):
        """PUT avec listes vides → profil mis à jour, collections vides."""
        payload = {
            "title": "Solo Dev",
            "summary": None,
            "years_of_experience": None,
            "skills": [],
            "experiences": [],
            "educations": [],
            "languages": [],
        }

        response = await profile_client.put("/api/v1/profile/me", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Solo Dev"
        assert data["skills"] == []
        assert data["experiences"] == []
