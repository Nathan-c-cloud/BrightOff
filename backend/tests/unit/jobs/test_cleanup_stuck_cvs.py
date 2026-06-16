"""Tests du job cleanup_stuck_cvs.

Stratégie d'isolation :
- PostgreSQL réel (brightoff_test) via un engine NullPool dédié.
- cleanup_stuck_cvs() ouvre sa propre AsyncSessionLocal (depuis app.core.database).
  On la patche pour qu'elle pointe sur brightoff_test.
- Les fixtures créent et nettoient leurs propres données (DELETE en teardown).

Prérequis :
    - Container PostgreSQL démarré : docker compose up postgres -d
    - Base brightoff_test accessible
"""

from __future__ import annotations

import os
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
import pytest_asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.base import Base
from app.core.config import settings
from app.modules.auth.models import User
from app.modules.cv_parser.models import CV

# ---------------------------------------------------------------------------
# URL de test — même logique que les autres suites
# ---------------------------------------------------------------------------


def _build_test_db_url() -> str:
    from urllib.parse import urlparse, urlunparse

    explicit = os.getenv("TEST_DATABASE_URL")
    if explicit:
        return explicit
    test_db_name = os.getenv("TEST_POSTGRES_DB", "brightoff_test")
    parsed = urlparse(settings.DATABASE_URL)
    return urlunparse(parsed._replace(path=f"/{test_db_name}"))


# ---------------------------------------------------------------------------
# Fixtures — engine, session committante, patch AsyncSessionLocal
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    """Engine NullPool sur brightoff_test, tables créées au démarrage."""
    url = _build_test_db_url()
    engine = create_async_engine(url, echo=False, future=True, poolclass=NullPool)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM cvs"))
        await conn.execute(text("DELETE FROM users"))

    await engine.dispose()


@pytest_asyncio.fixture
async def committing_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Session qui commite réellement — ses données sont visibles par cleanup_stuck_cvs."""
    session = AsyncSession(bind=test_engine, expire_on_commit=False)
    try:
        yield session
    finally:
        await session.close()


@pytest.fixture
def patched_session_local(test_engine):
    """Remplace AsyncSessionLocal dans cleanup_stuck_cvs par une factory sur brightoff_test."""
    test_factory = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    with patch("app.jobs.cleanup_stuck_cvs.AsyncSessionLocal", test_factory):
        yield


# ---------------------------------------------------------------------------
# Fixture : utilisateur de référence (clé étrangère obligatoire pour les CVs)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_user(committing_session) -> User:
    """Crée un utilisateur minimal pour rattacher les CVs de test."""
    user = User(
        email=f"cleanup-test-{uuid.uuid4()}@example.com",
        hashed_password="$2b$12$placeholder",
        oauth_provider=None,
        oauth_id=None,
    )
    committing_session.add(user)
    await committing_session.commit()
    return user


# ---------------------------------------------------------------------------
# Helper : créer un CV avec un parsing_status et un updated_at explicites
# ---------------------------------------------------------------------------


async def _create_cv(
    session: AsyncSession,
    user_id: uuid.UUID,
    parsing_status: str,
    updated_at_offset: timedelta,
) -> CV:
    """Insère un CV en base avec updated_at = now() + offset.

    Un offset négatif (ex: -timedelta(minutes=10)) place updated_at dans le passé.
    """
    cv = CV(
        user_id=user_id,
        s3_key=f"cv/{uuid.uuid4()}.pdf",
        original_filename="cv.pdf",
        file_format="pdf",
        parsing_status=parsing_status,
    )
    session.add(cv)
    await session.flush()

    # SQLAlchemy / Postgres positionne updated_at via server_default (func.now()).
    # On force la valeur via un UPDATE SQL direct pour maîtriser l'instant précis.
    from sqlalchemy import update as sa_update

    target_time = datetime.now(UTC) + updated_at_offset
    await session.execute(
        sa_update(CV).where(CV.id == cv.id).values(updated_at=target_time)
    )
    await session.commit()

    result = await session.execute(select(CV).where(CV.id == cv.id))
    return result.scalar_one()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestCleanupStuckCvs:
    @pytest.mark.asyncio
    async def test_stuck_cv_is_marked_failed(
        self, committing_session, patched_session_local, test_user
    ):
        """Un CV en parsing depuis plus de 5 min doit être marqué failed."""
        from app.jobs.cleanup_stuck_cvs import cleanup_stuck_cvs

        cv = await _create_cv(
            committing_session,
            test_user.id,
            parsing_status="parsing",
            updated_at_offset=-timedelta(minutes=10),
        )

        count = await cleanup_stuck_cvs(threshold_minutes=5)

        assert count == 1
        await committing_session.refresh(cv)
        assert cv.parsing_status == "failed"

    @pytest.mark.asyncio
    async def test_recent_parsing_cv_is_not_touched(
        self, committing_session, patched_session_local, test_user
    ):
        """Un CV en parsing depuis moins de 5 min ne doit pas être modifié."""
        from app.jobs.cleanup_stuck_cvs import cleanup_stuck_cvs

        cv = await _create_cv(
            committing_session,
            test_user.id,
            parsing_status="parsing",
            updated_at_offset=-timedelta(minutes=1),
        )

        count = await cleanup_stuck_cvs(threshold_minutes=5)

        assert count == 0
        await committing_session.refresh(cv)
        assert cv.parsing_status == "parsing"

    @pytest.mark.asyncio
    async def test_ready_cv_is_not_touched(
        self, committing_session, patched_session_local, test_user
    ):
        """Un CV déjà en status ready ne doit pas être modifié, même s'il est ancien."""
        from app.jobs.cleanup_stuck_cvs import cleanup_stuck_cvs

        cv = await _create_cv(
            committing_session,
            test_user.id,
            parsing_status="ready",
            updated_at_offset=-timedelta(hours=1),
        )

        count = await cleanup_stuck_cvs(threshold_minutes=5)

        assert count == 0
        await committing_session.refresh(cv)
        assert cv.parsing_status == "ready"

    @pytest.mark.asyncio
    async def test_only_stuck_cv_is_updated_among_mixed_set(
        self, committing_session, patched_session_local, test_user
    ):
        """Sur 3 CVs (1 bloqué, 1 frais, 1 terminé), seul le bloqué est traité."""
        from app.jobs.cleanup_stuck_cvs import cleanup_stuck_cvs

        # CV1 : bloqué — doit passer à failed
        cv1 = await _create_cv(
            committing_session,
            test_user.id,
            parsing_status="parsing",
            updated_at_offset=-timedelta(minutes=10),
        )
        # CV2 : parsing frais — ne pas toucher
        cv2 = await _create_cv(
            committing_session,
            test_user.id,
            parsing_status="parsing",
            updated_at_offset=-timedelta(minutes=1),
        )
        # CV3 : terminé — ne pas toucher
        cv3 = await _create_cv(
            committing_session,
            test_user.id,
            parsing_status="ready",
            updated_at_offset=-timedelta(hours=1),
        )

        count = await cleanup_stuck_cvs(threshold_minutes=5)

        assert count == 1

        await committing_session.refresh(cv1)
        await committing_session.refresh(cv2)
        await committing_session.refresh(cv3)

        assert cv1.parsing_status == "failed"
        assert cv2.parsing_status == "parsing"
        assert cv3.parsing_status == "ready"

    @pytest.mark.asyncio
    async def test_dry_run_does_not_modify_db(
        self, committing_session, patched_session_local, test_user
    ):
        """En dry_run=True, aucun CV ne doit être modifié en base."""
        from app.jobs.cleanup_stuck_cvs import cleanup_stuck_cvs

        cv = await _create_cv(
            committing_session,
            test_user.id,
            parsing_status="parsing",
            updated_at_offset=-timedelta(minutes=10),
        )

        count = await cleanup_stuck_cvs(threshold_minutes=5, dry_run=True)

        assert count == 1
        await committing_session.refresh(cv)
        # Le statut ne doit pas avoir changé
        assert cv.parsing_status == "parsing"

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_stuck_cvs(
        self, committing_session, patched_session_local, test_user
    ):
        """Sans CV bloqué, cleanup_stuck_cvs retourne 0."""
        from app.jobs.cleanup_stuck_cvs import cleanup_stuck_cvs

        await _create_cv(
            committing_session,
            test_user.id,
            parsing_status="ready",
            updated_at_offset=-timedelta(hours=2),
        )

        count = await cleanup_stuck_cvs(threshold_minutes=5)

        assert count == 0

    @pytest.mark.asyncio
    async def test_custom_threshold_is_respected(
        self, committing_session, patched_session_local, test_user
    ):
        """Un threshold personnalisé doit être pris en compte correctement."""
        from app.jobs.cleanup_stuck_cvs import cleanup_stuck_cvs

        # CV bloqué depuis 3 min — sous le seuil de 5 min mais au-dessus de 2 min
        cv = await _create_cv(
            committing_session,
            test_user.id,
            parsing_status="parsing",
            updated_at_offset=-timedelta(minutes=3),
        )

        # Avec threshold=5 : ne doit pas être traité
        count_5 = await cleanup_stuck_cvs(threshold_minutes=5)
        assert count_5 == 0
        await committing_session.refresh(cv)
        assert cv.parsing_status == "parsing"

        # Avec threshold=2 : doit être traité
        count_2 = await cleanup_stuck_cvs(threshold_minutes=2)
        assert count_2 == 1
        await committing_session.refresh(cv)
        assert cv.parsing_status == "failed"
