"""Tests d'intégration end-to-end — tasks.py (trigger_parsing) — S3-11.

Stratégie d'isolation :
- PostgreSQL réel (brightoff_test) via un engine NullPool dédié.
- trigger_parsing() ouvre sa propre AsyncSessionLocal (depuis app.core.database).
  On la patche pour la remplacer par une factory qui pointe sur brightoff_test.
- S3 mocké via moto[s3] (mock_aws) — même pattern que test_cvs_upload.py.
- parse_cv_with_claude mocké (AsyncMock) — aucun appel réel à Claude/Anthropic.
- extract_text mocké dans la plupart des tests pour s'affranchir de l'extraction.

Pourquoi patcher AsyncSessionLocal et non utiliser db_session de conftest ?
    trigger_parsing ouvre sa propre session avec `async with AsyncSessionLocal() as db`.
    La session de conftest (SAVEPOINT) n'est pas visible depuis cette nouvelle connexion.
    On remplace donc AsyncSessionLocal par une async_sessionmaker pointant sur brightoff_test.
    Cleanup : DELETE explicite en teardown (puisqu'on commite réellement).
"""

from __future__ import annotations

import os
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import boto3
import pytest
import pytest_asyncio
from moto import mock_aws
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.base import Base
from app.core.config import settings
from app.modules.auth.models import User
from app.modules.cv_parser.claude_client import (
    ClaudeRateLimitError,
    ClaudeTimeoutError,
    InvalidJsonError,
)
from app.modules.cv_parser.extractors import EmptyTextError, ExtractionError
from app.modules.cv_parser.models import CV, Profile, ProfileSkill

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_PARSED_CV = {
    "is_cv": True,
    "title": "Développeur Python",
    "summary": "Expérimenté",
    "years_of_experience": 3,
    "skills": [
        {"name": "Python", "category": "tech", "level": 4},
        {"name": "FastAPI", "category": "tech", "level": 3},
    ],
    "experiences": [
        {
            "company": "BrightOff",
            "position": "Dev Backend",
            "start_date": "2022-01-01",
            "end_date": None,
            "description": "Développement API",
        }
    ],
    "education": [
        {
            "school": "IUT Lyon",
            "degree": "BUT Info",
            "field": None,
            "start_date": "2019-09-01",
            "end_date": "2022-06-01",
        }
    ],
    "languages": [{"name": "Français", "level": "Natif"}],
}

_NOT_CV_RESPONSE = {
    "is_cv": False,
    "reason": "C'est une offre d'emploi",
}

_PDF_CONTENT = b"%PDF-1.4\n" + b"0" * 512

_TABLES_CLEANUP_ORDER = (
    "profile_skills",
    "profile_experiences",
    "profile_educations",
    "profile_languages",
    "profiles",
    "cvs",
    "users",
)


# ---------------------------------------------------------------------------
# URL de test
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
# Fixtures — engine + session committante + factory patchée
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    """Engine NullPool sur brightoff_test, avec toutes les tables créées."""
    url = _build_test_db_url()
    engine = create_async_engine(url, echo=False, future=True, poolclass=NullPool)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Teardown : nettoie toutes les lignes créées par ce test
    async with engine.begin() as conn:
        for table in _TABLES_CLEANUP_ORDER:
            await conn.execute(text(f"DELETE FROM {table}"))

    await engine.dispose()


@pytest_asyncio.fixture
async def committing_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Session qui COMMIT réellement — ses données sont visibles par trigger_parsing."""
    session = AsyncSession(bind=test_engine, expire_on_commit=False)
    try:
        yield session
    finally:
        await session.close()


@pytest.fixture
def patched_async_session_local(test_engine):
    """Remplace AsyncSessionLocal dans tasks.py par une factory pointant sur brightoff_test.

    Sans ce patch, trigger_parsing() ouvrirait une session sur la BDD de production
    (ou la DATABASE_URL du .env local) et ne verrait pas les données committées
    par committing_session.
    """
    test_factory = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    with patch("app.modules.cv_parser.tasks.AsyncSessionLocal", test_factory):
        yield test_factory


# ---------------------------------------------------------------------------
# Fixture — user + cv committés en BDD
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def user_and_cv(committing_session: AsyncSession):
    user = User(
        id=uuid.uuid4(),
        email=f"tasks-test-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="hashed",
        is_active=True,
    )
    committing_session.add(user)
    await committing_session.flush()

    cv = CV(
        id=uuid.uuid4(),
        user_id=user.id,
        s3_key=f"cvs/{uuid.uuid4()}/cv.pdf",
        original_filename="cv.pdf",
        file_format="pdf",
        parsing_status="parsing",
    )
    committing_session.add(cv)
    await committing_session.commit()

    return user, cv


@pytest.fixture
def mock_s3_with_cv(user_and_cv):
    """Démarre moto S3 et uploade le fichier CV dans le bucket."""
    user, cv = user_and_cv
    with mock_aws():
        client = boto3.client("s3", region_name="eu-west-3")
        client.create_bucket(
            Bucket=settings.S3_BUCKET_NAME,
            CreateBucketConfiguration={"LocationConstraint": "eu-west-3"},
        )
        client.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=cv.s3_key,
            Body=_PDF_CONTENT,
        )
        yield client, user, cv


# ---------------------------------------------------------------------------
# Helpers — relecture BDD via une session fraîche
# ---------------------------------------------------------------------------


async def _read_cv(cv_id: uuid.UUID, engine) -> CV | None:
    async with AsyncSession(bind=engine, expire_on_commit=False) as s:
        result = await s.execute(select(CV).where(CV.id == cv_id))
        return result.scalar_one_or_none()


async def _read_profile(user_id: uuid.UUID, engine) -> Profile | None:
    async with AsyncSession(bind=engine, expire_on_commit=False) as s:
        result = await s.execute(select(Profile).where(Profile.user_id == user_id))
        return result.scalar_one_or_none()


async def _count_skills(profile_id: uuid.UUID, engine) -> int:
    async with AsyncSession(bind=engine, expire_on_commit=False) as s:
        result = await s.execute(
            select(func.count()).where(ProfileSkill.profile_id == profile_id)
        )
        return result.scalar_one()


# ---------------------------------------------------------------------------
# Tests — happy path
# ---------------------------------------------------------------------------


class TestTriggerParsingSuccess:
    async def test_trigger_parsing_sets_status_ready(
        self, mock_s3_with_cv, patched_async_session_local, test_engine
    ):
        client, user, cv = mock_s3_with_cv

        with patch("app.modules.cv_parser.tasks.get_s3_client", return_value=client):
            with patch(
                "app.modules.cv_parser.tasks.parse_cv_with_claude",
                new_callable=AsyncMock,
                return_value=_PARSED_CV,
            ):
                with patch(
                    "app.modules.cv_parser.tasks.extract_text",
                    return_value="Texte CV extrait",
                ):
                    from app.modules.cv_parser.tasks import trigger_parsing
                    await trigger_parsing(cv.id)

        db_cv = await _read_cv(cv.id, test_engine)
        assert db_cv is not None
        assert db_cv.parsing_status == "ready"

    async def test_trigger_parsing_sets_parsed_at(
        self, mock_s3_with_cv, patched_async_session_local, test_engine
    ):
        client, user, cv = mock_s3_with_cv
        before = datetime.now(UTC)

        with patch("app.modules.cv_parser.tasks.get_s3_client", return_value=client):
            with patch(
                "app.modules.cv_parser.tasks.parse_cv_with_claude",
                new_callable=AsyncMock,
                return_value=_PARSED_CV,
            ):
                with patch(
                    "app.modules.cv_parser.tasks.extract_text",
                    return_value="Texte CV",
                ):
                    from app.modules.cv_parser.tasks import trigger_parsing
                    await trigger_parsing(cv.id)

        db_cv = await _read_cv(cv.id, test_engine)
        assert db_cv.parsed_at is not None
        assert db_cv.parsed_at >= before

    async def test_trigger_parsing_creates_profile_with_title(
        self, mock_s3_with_cv, patched_async_session_local, test_engine
    ):
        client, user, cv = mock_s3_with_cv

        with patch("app.modules.cv_parser.tasks.get_s3_client", return_value=client):
            with patch(
                "app.modules.cv_parser.tasks.parse_cv_with_claude",
                new_callable=AsyncMock,
                return_value=_PARSED_CV,
            ):
                with patch(
                    "app.modules.cv_parser.tasks.extract_text",
                    return_value="Texte CV",
                ):
                    from app.modules.cv_parser.tasks import trigger_parsing
                    await trigger_parsing(cv.id)

        profile = await _read_profile(user.id, test_engine)
        assert profile is not None
        assert profile.title == "Développeur Python"

    async def test_trigger_parsing_creates_skills_in_db(
        self, mock_s3_with_cv, patched_async_session_local, test_engine
    ):
        client, user, cv = mock_s3_with_cv

        with patch("app.modules.cv_parser.tasks.get_s3_client", return_value=client):
            with patch(
                "app.modules.cv_parser.tasks.parse_cv_with_claude",
                new_callable=AsyncMock,
                return_value=_PARSED_CV,
            ):
                with patch(
                    "app.modules.cv_parser.tasks.extract_text",
                    return_value="Texte CV",
                ):
                    from app.modules.cv_parser.tasks import trigger_parsing
                    await trigger_parsing(cv.id)

        profile = await _read_profile(user.id, test_engine)
        assert profile is not None
        count = await _count_skills(profile.id, test_engine)
        assert count == 2  # Python + FastAPI dans _PARSED_CV


# ---------------------------------------------------------------------------
# Tests — cas d'erreur → parsing_status = "failed"
# ---------------------------------------------------------------------------


class TestTriggerParsingFailures:
    async def test_not_cv_document_sets_status_failed(
        self, mock_s3_with_cv, patched_async_session_local, test_engine
    ):
        """Claude retourne is_cv: false → _NotACVError interne → failed."""
        client, user, cv = mock_s3_with_cv

        with patch("app.modules.cv_parser.tasks.get_s3_client", return_value=client):
            with patch(
                "app.modules.cv_parser.tasks.parse_cv_with_claude",
                new_callable=AsyncMock,
                return_value=_NOT_CV_RESPONSE,
            ):
                with patch(
                    "app.modules.cv_parser.tasks.extract_text",
                    return_value="Offre d'emploi texte",
                ):
                    from app.modules.cv_parser.tasks import trigger_parsing
                    await trigger_parsing(cv.id)

        db_cv = await _read_cv(cv.id, test_engine)
        assert db_cv.parsing_status == "failed"
        assert db_cv.parsed_at is not None

    async def test_s3_download_error_sets_status_failed(
        self, mock_s3_with_cv, patched_async_session_local, test_engine
    ):
        """Échec du téléchargement S3 → ExtractionError → failed."""
        client, user, cv = mock_s3_with_cv

        with patch("app.modules.cv_parser.tasks.get_s3_client", return_value=client):
            with patch(
                "app.modules.cv_parser.tasks.download_from_s3_sync",
                side_effect=ExtractionError("Simulated S3 error"),
            ):
                from app.modules.cv_parser.tasks import trigger_parsing
                await trigger_parsing(cv.id)

        db_cv = await _read_cv(cv.id, test_engine)
        assert db_cv.parsing_status == "failed"
        assert db_cv.parsed_at is not None

    async def test_claude_timeout_sets_status_failed(
        self, mock_s3_with_cv, patched_async_session_local, test_engine
    ):
        """ClaudeTimeoutError → failed."""
        client, user, cv = mock_s3_with_cv

        with patch("app.modules.cv_parser.tasks.get_s3_client", return_value=client):
            with patch(
                "app.modules.cv_parser.tasks.parse_cv_with_claude",
                new_callable=AsyncMock,
                side_effect=ClaudeTimeoutError("timeout"),
            ):
                with patch(
                    "app.modules.cv_parser.tasks.extract_text",
                    return_value="Texte CV",
                ):
                    from app.modules.cv_parser.tasks import trigger_parsing
                    await trigger_parsing(cv.id)

        db_cv = await _read_cv(cv.id, test_engine)
        assert db_cv.parsing_status == "failed"

    async def test_claude_rate_limit_sets_status_failed(
        self, mock_s3_with_cv, patched_async_session_local, test_engine
    ):
        """ClaudeRateLimitError (persistant) → failed."""
        client, user, cv = mock_s3_with_cv

        with patch("app.modules.cv_parser.tasks.get_s3_client", return_value=client):
            with patch(
                "app.modules.cv_parser.tasks.parse_cv_with_claude",
                new_callable=AsyncMock,
                side_effect=ClaudeRateLimitError("rate limit persistant"),
            ):
                with patch(
                    "app.modules.cv_parser.tasks.extract_text",
                    return_value="Texte CV",
                ):
                    from app.modules.cv_parser.tasks import trigger_parsing
                    await trigger_parsing(cv.id)

        db_cv = await _read_cv(cv.id, test_engine)
        assert db_cv.parsing_status == "failed"

    async def test_invalid_json_sets_status_failed(
        self, mock_s3_with_cv, patched_async_session_local, test_engine
    ):
        """InvalidJsonError après retry → failed."""
        client, user, cv = mock_s3_with_cv

        with patch("app.modules.cv_parser.tasks.get_s3_client", return_value=client):
            with patch(
                "app.modules.cv_parser.tasks.parse_cv_with_claude",
                new_callable=AsyncMock,
                side_effect=InvalidJsonError("JSON invalide après retry"),
            ):
                with patch(
                    "app.modules.cv_parser.tasks.extract_text",
                    return_value="Texte CV",
                ):
                    from app.modules.cv_parser.tasks import trigger_parsing
                    await trigger_parsing(cv.id)

        db_cv = await _read_cv(cv.id, test_engine)
        assert db_cv.parsing_status == "failed"

    async def test_empty_text_extraction_sets_status_failed(
        self, mock_s3_with_cv, patched_async_session_local, test_engine
    ):
        """PDF scanné (EmptyTextError) → failed."""
        client, user, cv = mock_s3_with_cv

        with patch("app.modules.cv_parser.tasks.get_s3_client", return_value=client):
            with patch(
                "app.modules.cv_parser.tasks.extract_text",
                side_effect=EmptyTextError("PDF scanné"),
            ):
                from app.modules.cv_parser.tasks import trigger_parsing
                await trigger_parsing(cv.id)

        db_cv = await _read_cv(cv.id, test_engine)
        assert db_cv.parsing_status == "failed"

    async def test_unknown_cv_id_does_not_crash(self, patched_async_session_local):
        """cv_id inexistant en BDD → return silencieux (pas d'exception propagée)."""
        nonexistent_id = uuid.uuid4()

        from app.modules.cv_parser.tasks import trigger_parsing

        # Ne doit pas lever d'exception — le log "introuvable" est attendu
        await trigger_parsing(nonexistent_id)
