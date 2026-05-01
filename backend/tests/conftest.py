"""Fixtures partagées pour les tests d'intégration BrightOff.

IMPORTANT — ordre d'exécution :
1. Force ENVIRONMENT=dev et JWT_SECRET_KEY via os.environ AVANT toute
   importation de app.core.config (sinon Settings() est instancié avec
   les valeurs réelles du .env local et peut crasher au validateur
   _enforce_prod_safety, ou configurer les middlewares avec la mauvaise
   valeur). Les os.environ.setdefault ci-dessous sont la seule défense
   efficace — muter settings après import ne reconfigure pas les
   middlewares déjà instanciés.
2. Imports standard (pytest, sqlalchemy...).
3. Imports app.* (qui voient maintenant les bonnes vars d'env).
4. Fixtures.

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

# ---------------------------------------------------------------------------
# Forcer les vars d'env AVANT tout import de app.* (voir docstring ci-dessus)
#
# setdefault (pas =) : ne pas écraser si l'utilisateur a déjà défini ces vars
# dans son environnement shell pour ses tests locaux.
# ---------------------------------------------------------------------------
TEST_JWT_SECRET = "test-secret-only-for-pytest-do-not-use-in-prod-32chars-min"
os.environ.setdefault("JWT_SECRET_KEY", TEST_JWT_SECRET)
os.environ.setdefault("ENVIRONMENT", "dev")

# ---------------------------------------------------------------------------
# Imports standard
# ---------------------------------------------------------------------------
from collections.abc import AsyncGenerator  # noqa: E402
from urllib.parse import urlparse, urlunparse  # noqa: E402

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

# ---------------------------------------------------------------------------
# Imports app.* — voient maintenant les bonnes vars d'env
# ---------------------------------------------------------------------------
from app.core.base import Base  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.database import get_db  # noqa: E402
from app.main import app  # noqa: E402

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
