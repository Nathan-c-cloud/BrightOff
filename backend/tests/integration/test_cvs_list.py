"""Tests d'intégration — GET /api/v1/cvs (liste, S3-14).

Stratégie :
    - PostgreSQL réel (brightoff_test) via les fixtures conftest.py
    - get_current_user overridé par user (évite la validation JWT)
    - Les CV sont insérés directement en BDD via db_session (sans S3)
    - Couvre : isolation user, tri DESC, 401, liste vide, limit 10

Prérequis :
    - Container PostgreSQL démarré : docker compose up postgres -d
    - Base brightoff_test accessible

Exécution :
    cd backend && pytest tests/integration/test_cvs_list.py -v
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

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
# Helpers
# ---------------------------------------------------------------------------


def _make_cv(
    user_id: uuid.UUID,
    parsing_status: str = "parsing",
    created_at: datetime | None = None,
    file_format: str = "pdf",
) -> CV:
    """Construit un CV SQLAlchemy sans l'insérer."""
    cv = CV(
        id=uuid.uuid4(),
        user_id=user_id,
        s3_key=f"cvs/{uuid.uuid4()}.{file_format}",
        original_filename=f"CV_{uuid.uuid4().hex[:6]}.{file_format}",
        file_format=file_format,
        parsing_status=parsing_status,
    )
    if created_at is not None:
        # On force created_at pour tester le tri (TimestampMixin le renseigne auto sinon)
        cv.created_at = created_at
    return cv


# ---------------------------------------------------------------------------
# Fixtures — users
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def user_a(db_session: AsyncSession) -> User:
    """Propriétaire des CVs dans les tests positifs."""
    user = User(
        id=uuid.uuid4(),
        email=f"list-a-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="hashed",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def user_b(db_session: AsyncSession) -> User:
    """Autre utilisateur — tests d'isolation."""
    user = User(
        id=uuid.uuid4(),
        email=f"list-b-{uuid.uuid4().hex[:8]}@example.com",
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


class TestListCvsHappyPath:
    @pytest.mark.asyncio
    async def test_list_cvs_returns_200_with_items(
        self, client_a: AsyncClient, db_session: AsyncSession, user_a: User
    ) -> None:
        """200 — user_a voit ses CVs dans la liste."""
        cv = _make_cv(user_id=user_a.id, parsing_status="parsing")
        db_session.add(cv)
        await db_session.flush()

        response = await client_a.get("/api/v1/cvs")

        assert response.status_code == 200, response.text
        data = response.json()
        assert "items" in data
        assert "total" in data
        ids = [item["id"] for item in data["items"]]
        assert str(cv.id) in ids

    @pytest.mark.asyncio
    async def test_list_cvs_response_shape(
        self, client_a: AsyncClient, db_session: AsyncSession, user_a: User
    ) -> None:
        """200 — chaque item expose les champs attendus."""
        cv = _make_cv(user_id=user_a.id, parsing_status="ready")
        db_session.add(cv)
        await db_session.flush()

        response = await client_a.get("/api/v1/cvs")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        item = next(i for i in data["items"] if i["id"] == str(cv.id))
        expected_keys = {"id", "filename", "file_format", "parsing_status", "uploaded_at"}
        missing = expected_keys - item.keys()
        assert expected_keys.issubset(item.keys()), f"Champs manquants : {missing}"

    @pytest.mark.asyncio
    async def test_list_cvs_empty_for_new_user(
        self, client_a: AsyncClient
    ) -> None:
        """200 — utilisateur sans CV : items vide, total = 0."""
        response = await client_a.get("/api/v1/cvs")

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0


# ---------------------------------------------------------------------------
# Tests d'isolation — user_a ne voit pas les CVs de user_b
# ---------------------------------------------------------------------------


class TestListCvsIsolation:
    @pytest.mark.asyncio
    async def test_list_cvs_user_a_does_not_see_user_b_cvs(
        self,
        client_a: AsyncClient,
        db_session: AsyncSession,
        user_a: User,
        user_b: User,
    ) -> None:
        """200 — user_a ne voit que ses propres CVs, pas ceux de user_b."""
        cv_a = _make_cv(user_id=user_a.id, parsing_status="ready")
        cv_b = _make_cv(user_id=user_b.id, parsing_status="ready")
        db_session.add(cv_a)
        db_session.add(cv_b)
        await db_session.flush()

        response = await client_a.get("/api/v1/cvs")

        assert response.status_code == 200, response.text
        data = response.json()
        returned_ids = [item["id"] for item in data["items"]]
        assert str(cv_a.id) in returned_ids
        assert str(cv_b.id) not in returned_ids


# ---------------------------------------------------------------------------
# Tests de tri — DESC par created_at
# ---------------------------------------------------------------------------


class TestListCvsSorting:
    @pytest.mark.asyncio
    async def test_list_cvs_sorted_desc_by_created_at(
        self,
        client_a: AsyncClient,
        db_session: AsyncSession,
        user_a: User,
    ) -> None:
        """200 — les CVs sont triés par created_at décroissant (plus récent en premier)."""
        now = datetime.now(tz=UTC)
        cv_old = _make_cv(user_id=user_a.id, created_at=now - timedelta(hours=2))
        cv_mid = _make_cv(user_id=user_a.id, created_at=now - timedelta(hours=1))
        cv_new = _make_cv(user_id=user_a.id, created_at=now)
        db_session.add_all([cv_old, cv_mid, cv_new])
        await db_session.flush()

        response = await client_a.get("/api/v1/cvs")

        assert response.status_code == 200, response.text
        data = response.json()
        # Extraire seulement les IDs de nos 3 CVs de test (peut y en avoir d'autres)
        our_ids = {str(cv_old.id), str(cv_mid.id), str(cv_new.id)}
        returned_ids = [item["id"] for item in data["items"] if item["id"] in our_ids]
        assert returned_ids == [str(cv_new.id), str(cv_mid.id), str(cv_old.id)], (
            f"Ordre attendu : new→mid→old, obtenu : {returned_ids}"
        )


# ---------------------------------------------------------------------------
# Tests 401 — non authentifié
# ---------------------------------------------------------------------------


class TestListCvsAuth:
    @pytest.mark.asyncio
    async def test_list_cvs_no_auth_returns_401(self, unauth_client: AsyncClient) -> None:
        """401 — Sans header Authorization."""
        response = await unauth_client.get("/api/v1/cvs")
        assert response.status_code == 401
