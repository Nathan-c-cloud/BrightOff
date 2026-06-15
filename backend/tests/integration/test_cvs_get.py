"""Tests d'intégration — GET /api/v1/cvs/{cv_id} (S3-13).

Stratégie :
    - PostgreSQL réel (brightoff_test) via les fixtures conftest.py
    - get_current_user overridé pour chaque user de test (évite la validation JWT)
    - Les CV sont insérés directement en BDD via db_session (sans S3)
    - Couvre : 200 (parsing/ready/failed), 401, 403, 404, 422

Prérequis :
    - Container PostgreSQL démarré : docker compose up postgres -d
    - Base brightoff_test accessible

Exécution :
    cd backend && pytest tests/integration/test_cvs_get.py -v
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.modules.auth.models import User
from app.modules.cv_parser.models import CV

# ---------------------------------------------------------------------------
# Helpers — factory de CV en BDD
# ---------------------------------------------------------------------------


def _make_cv(
    user_id: uuid.UUID,
    parsing_status: str = "parsing",
    parsed_at: datetime | None = None,
    file_format: str = "pdf",
) -> CV:
    """Construit un CV SQLAlchemy sans l'insérer."""
    return CV(
        id=uuid.uuid4(),
        user_id=user_id,
        s3_key=f"cvs/{uuid.uuid4()}.{file_format}",
        original_filename=f"CV_{uuid.uuid4().hex[:6]}.{file_format}",
        file_format=file_format,
        parsing_status=parsing_status,
        parsed_at=parsed_at,
    )


# ---------------------------------------------------------------------------
# Fixtures — users de test
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def user_a(db_session: AsyncSession) -> User:
    """Propriétaire des CVs dans les tests positifs."""
    user = User(
        id=uuid.uuid4(),
        email=f"user-a-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="hashed",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def user_b(db_session: AsyncSession) -> User:
    """Autre utilisateur — tests d'isolation (403)."""
    user = User(
        id=uuid.uuid4(),
        email=f"user-b-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="hashed",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


# ---------------------------------------------------------------------------
# Fixtures — clients HTTP
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def client_a(
    db_session: AsyncSession,
    user_a: User,
) -> AsyncGenerator[AsyncClient, None]:
    """Client authentifié en tant que user_a."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    async def override_get_current_user() -> User:
        return user_a

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client_b(
    db_session: AsyncSession,
    user_b: User,
) -> AsyncGenerator[AsyncClient, None]:
    """Client authentifié en tant que user_b."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    async def override_get_current_user() -> User:
        return user_b

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
    """Client sans authentification — teste les 401."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    # get_current_user intentionnellement non overridé → 401

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Tests 200 — happy path
# ---------------------------------------------------------------------------


class TestGetCvHappyPath:
    @pytest.mark.asyncio
    async def test_get_cv_status_parsing_returns_200(
        self, client_a: AsyncClient, db_session: AsyncSession, user_a: User
    ) -> None:
        """200 — CV en cours de parsing : parsed_at est null."""
        cv = _make_cv(user_id=user_a.id, parsing_status="parsing")
        db_session.add(cv)
        await db_session.flush()

        response = await client_a.get(f"/api/v1/cvs/{cv.id}")

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["id"] == str(cv.id)
        assert data["original_filename"] == cv.original_filename
        assert data["file_format"] == "pdf"
        assert data["parsing_status"] == "parsing"
        assert data["parsed_at"] is None
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_get_cv_status_ready_returns_200(
        self, client_a: AsyncClient, db_session: AsyncSession, user_a: User
    ) -> None:
        """200 — CV prêt : parsed_at est non null."""
        parsed_time = datetime(2025, 6, 1, 12, 0, 0, tzinfo=UTC)
        cv = _make_cv(
            user_id=user_a.id,
            parsing_status="ready",
            parsed_at=parsed_time,
        )
        db_session.add(cv)
        await db_session.flush()

        response = await client_a.get(f"/api/v1/cvs/{cv.id}")

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["parsing_status"] == "ready"
        assert data["parsed_at"] is not None

    @pytest.mark.asyncio
    async def test_get_cv_status_failed_returns_200(
        self, client_a: AsyncClient, db_session: AsyncSession, user_a: User
    ) -> None:
        """200 — CV en erreur de parsing : status='failed', parsed_at null."""
        cv = _make_cv(user_id=user_a.id, parsing_status="failed")
        db_session.add(cv)
        await db_session.flush()

        response = await client_a.get(f"/api/v1/cvs/{cv.id}")

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["parsing_status"] == "failed"
        assert data["parsed_at"] is None

    @pytest.mark.asyncio
    async def test_get_cv_response_shape(
        self, client_a: AsyncClient, db_session: AsyncSession, user_a: User
    ) -> None:
        """200 — Tous les champs attendus par la spec S3-13 sont présents."""
        cv = _make_cv(user_id=user_a.id, parsing_status="parsing")
        db_session.add(cv)
        await db_session.flush()

        response = await client_a.get(f"/api/v1/cvs/{cv.id}")

        assert response.status_code == 200
        data = response.json()
        expected_keys = {
            "id", "original_filename", "file_format", "parsing_status", "created_at", "parsed_at"
        }
        missing = expected_keys - data.keys()
        assert expected_keys.issubset(data.keys()), f"Champs manquants : {missing}"


# ---------------------------------------------------------------------------
# Tests 401 — non authentifié
# ---------------------------------------------------------------------------


class TestGetCvAuth:
    @pytest.mark.asyncio
    async def test_get_cv_no_auth_returns_401(self, unauth_client: AsyncClient) -> None:
        """401 — Sans header Authorization."""
        response = await unauth_client.get(f"/api/v1/cvs/{uuid.uuid4()}")
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Tests 403 — CV d'un autre utilisateur
# ---------------------------------------------------------------------------


class TestGetCvForbidden:
    @pytest.mark.asyncio
    async def test_get_cv_other_user_returns_403(
        self,
        client_b: AsyncClient,
        db_session: AsyncSession,
        user_a: User,
    ) -> None:
        """403 — user_b demande un CV appartenant à user_a."""
        cv = _make_cv(user_id=user_a.id, parsing_status="ready")
        db_session.add(cv)
        await db_session.flush()

        # user_b est authentifié (client_b) mais le CV appartient à user_a
        response = await client_b.get(f"/api/v1/cvs/{cv.id}")

        assert response.status_code == 403, response.text


# ---------------------------------------------------------------------------
# Tests 404 — CV inexistant
# ---------------------------------------------------------------------------


class TestGetCvNotFound:
    @pytest.mark.asyncio
    async def test_get_cv_unknown_uuid_returns_404(self, client_a: AsyncClient) -> None:
        """404 — UUID valide mais absent de la BDD."""
        unknown_id = uuid.uuid4()

        response = await client_a.get(f"/api/v1/cvs/{unknown_id}")

        assert response.status_code == 404, response.text

    @pytest.mark.asyncio
    async def test_get_cv_invalid_uuid_returns_422(self, client_a: AsyncClient) -> None:
        """422 — cv_id n'est pas un UUID valide → FastAPI rejette au niveau validation."""
        response = await client_a.get("/api/v1/cvs/not-a-valid-uuid")

        # FastAPI valide le type UUID avant d'appeler le handler → 422
        assert response.status_code == 422, response.text
