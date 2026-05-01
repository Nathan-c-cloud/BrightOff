"""Fixtures partagées pour les tests d'intégration BrightOff.

Stratégie DB :
    PostgreSQL via docker-compose (brightoff_test), conforme à la prod.
    SQLite écarté car les modèles utilisent sqlalchemy.dialects.postgresql.UUID
    et server_default=func.now() — ces constructions se comportent différemment
    sous SQLite et masqueraient des bugs réels.

Isolation par test :
    - La fixture `db_session` ouvre une connexion, démarre une transaction externe
      (BEGIN), puis crée une AsyncSession avec join_transaction_mode="create_savepoint".
      SQLAlchemy gère automatiquement le SAVEPOINT à chaque opération dans la session.
      En teardown, rollback de la transaction externe — toutes les écritures du test
      sont annulées, laissant la table propre pour le test suivant.
    - La fixture `client` override `get_db` pour injecter cette session de test
      à la place de la session de production.

Prérequis :
    - Le container PostgreSQL doit être démarré (`docker compose up postgres -d`)
    - La base `brightoff_test` doit exister (créée automatiquement par la fixture
      `db_engine` via `CREATE DATABASE brightoff_test` si absente, ou utiliser
      `createdb brightoff_test` en amont).
    - Les credentials sont lus depuis `backend/.env` via `settings.DATABASE_URL`
      (source unique de vérité, cohérente avec `make run`). Aucune variable
      POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_HOST / POSTGRES_PORT à exporter.
    - Override possible : exporter `TEST_DATABASE_URL` (CI) ou `TEST_POSTGRES_DB`
      (nom de la base, défaut `brightoff_test`).
"""

import os
from collections.abc import AsyncGenerator
from urllib.parse import urlparse, urlunparse

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.base import Base
from app.core.config import settings
from app.core.database import get_db
from app.main import app

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def _build_test_database_url() -> str:
    """Dérive TEST_DATABASE_URL depuis settings.DATABASE_URL en substituant le nom de la DB.

    Source unique de vérité : backend/.env (chargé par Pydantic Settings).
    Override possible via :
      - TEST_DATABASE_URL : remplace intégralement l'URL (CI ou env custom)
      - TEST_POSTGRES_DB  : remplace uniquement le nom de la base (défaut : brightoff_test)
    """
    explicit = os.getenv("TEST_DATABASE_URL")
    if explicit:
        return explicit
    test_db_name = os.getenv("TEST_POSTGRES_DB", "brightoff_test")
    parsed = urlparse(settings.DATABASE_URL)
    return urlunparse(parsed._replace(path=f"/{test_db_name}"))


TEST_DATABASE_URL = _build_test_database_url()

TEST_JWT_SECRET = "integration-test-secret-key-do-not-use-in-prod"


# ---------------------------------------------------------------------------
# Fixture : JWT secret (scope=session)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session", autouse=True)
def patch_jwt_secret_for_integration():
    """Force une clé JWT déterministe pour toute la session de tests d'intégration.

    JWT_SECRET_KEY est un champ Pydantic Settings requis sans valeur par défaut.
    Cette fixture garantit que les tests s'exécutent sans variable d'env réelle,
    et que les tokens générés pendant les tests sont décodables de façon cohérente.
    """
    original = settings.JWT_SECRET_KEY
    settings.JWT_SECRET_KEY = TEST_JWT_SECRET
    yield
    settings.JWT_SECRET_KEY = original


# ---------------------------------------------------------------------------
# Fixture : moteur DB de test (scope=session)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def db_engine():
    """Crée le moteur SQLAlchemy pointant sur brightoff_test.

    - Crée toutes les tables au démarrage de la session de test (create_all).
    - Supprime toutes les tables en teardown (drop_all) pour laisser la base propre.

    Note : le moteur utilise echo=False pour ne pas polluer la sortie des tests.
    """
    # NullPool désactive le pooling de connexions : chaque connect() ouvre une vraie
    # connexion asyncpg, fermée à la fin du context manager. Cela évite le conflit
    # d'event loop entre la fixture session-scoped et les tests function-scoped.
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, future=True, poolclass=NullPool)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


# ---------------------------------------------------------------------------
# Fixture : session DB isolée par test (scope=function)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Fournit une session AsyncSession isolée pour chaque test via SAVEPOINT.

    Pattern SQLAlchemy 2.0 officiel (join_transaction_mode="create_savepoint") :
    1. Ouvre une connexion et démarre une transaction externe (BEGIN).
    2. Crée une AsyncSession liée à cette connexion avec join_transaction_mode=
       "create_savepoint" — SQLAlchemy gère automatiquement les SAVEPOINTs.
    3. En teardown, rollback de la transaction externe — toutes les écritures
       du test sont annulées sans intervention manuelle sur les SAVEPOINTs.

    Ce pattern résout le conflit d'event loop (RuntimeError: Future attached to
    a different loop) : la connexion asyncpg et le test vivent sur la même event
    loop function par construction.

    Référence : https://docs.sqlalchemy.org/en/20/orm/session_transaction.html
    """
    async with db_engine.connect() as conn:
        await conn.begin()  # transaction externe — rollbackée en teardown

        session = AsyncSession(
            bind=conn,
            join_transaction_mode="create_savepoint",
            expire_on_commit=False,
        )
        try:
            yield session
        finally:
            await session.close()
            await conn.rollback()  # annule toutes les écritures du test


# ---------------------------------------------------------------------------
# Fixture : client HTTP de test (scope=function)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Fournit un httpx.AsyncClient connecté à l'app FastAPI de test.

    - Override la dépendance `get_db` pour injecter `db_session` (session
      de test isolée avec rollback) à la place de la session de production.
    - Utilise ASGITransport pour appeler l'app directement, sans réseau.
    - base_url est requis par httpx pour construire les URLs relatives.
    """

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        """Yield la session de test — sans commit ni rollback supplémentaires.

        Le commit automatique de la vraie `get_db` est intentionnellement
        absent ici : l'isolation par SAVEPOINT nécessite que la session ne
        commite pas — le rollback de la fixture `db_session` garantit le
        nettoyage en fin de test.
        """
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
