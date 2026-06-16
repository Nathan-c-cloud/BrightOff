"""Tests d'intégration — Security headers middleware (S3-06 / M-002).

Vérifie que :
    - X-Content-Type-Options et Referrer-Policy sont présents sur toutes les réponses.
    - HSTS est absent en mode dev (défaut des fixtures) et présent en mode prod.
    - Cache-Control: no-store est injecté sur /api/v1/auth/* uniquement.
    - Les headers de sécurité sont présents même sur les réponses d'erreur (401, 422).

Note sur le test HSTS en mode prod :
    La fixture conftest.py force settings.ENVIRONMENT = "dev" pour toute la session
    (patch_settings_for_integration). Pour tester le chemin prod sans polluer les
    autres tests, on instancie une app FastAPI minimale ad-hoc avec
    SecurityHeadersMiddleware(environment="prod") directement.
"""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.middleware.security_headers import SecurityHeadersMiddleware

# ---------------------------------------------------------------------------
# Tests — Headers globaux (via l'app principale, ENVIRONMENT="dev" forcé)
# ---------------------------------------------------------------------------


class TestSecurityHeadersGlobal:
    @pytest.mark.asyncio
    async def test_x_content_type_options_on_health(self, client):
        """GET /health retourne X-Content-Type-Options: nosniff."""
        response = await client.get("/health")

        assert response.status_code == 200
        assert response.headers.get("x-content-type-options") == "nosniff"

    @pytest.mark.asyncio
    async def test_referrer_policy_on_health(self, client):
        """GET /health retourne Referrer-Policy: strict-origin-when-cross-origin."""
        response = await client.get("/health")

        assert response.status_code == 200
        assert (
            response.headers.get("referrer-policy")
            == "strict-origin-when-cross-origin"
        )

    @pytest.mark.asyncio
    async def test_hsts_absent_in_dev(self, client):
        """En ENVIRONMENT=dev, Strict-Transport-Security ne doit pas être injecté.

        Le conftest.py force settings.ENVIRONMENT = "dev" pour toute la session.
        HSTS sur HTTP localhost n'a aucun effet et polluerait les logs navigateur.
        """
        response = await client.get("/health")

        assert response.status_code == 200
        assert "strict-transport-security" not in response.headers

    @pytest.mark.asyncio
    async def test_security_headers_present_on_error_response(self, client):
        """Les headers de sécurité doivent être présents même sur une réponse 401.

        Preuve que SecurityHeadersMiddleware s'exécute en couche externe, y compris
        sur les réponses d'erreur (le middleware wrappe le chemin complet).
        """
        # /api/v1/auth/me sans token → 401
        response = await client.get("/api/v1/auth/me")

        assert response.status_code == 401
        assert response.headers.get("x-content-type-options") == "nosniff"
        assert (
            response.headers.get("referrer-policy")
            == "strict-origin-when-cross-origin"
        )

    @pytest.mark.asyncio
    async def test_security_headers_present_on_422_response(self, client):
        """Les headers de sécurité doivent être présents sur une réponse 422 (validation error).

        422 est retourné par FastAPI avant même d'entrer dans le handler — vérifie
        que le middleware couvre aussi ce cas.
        """
        # POST /api/v1/auth/login avec body invalide → 422
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "not-an-email", "password": "x"},
        )

        assert response.status_code == 422
        assert response.headers.get("x-content-type-options") == "nosniff"
        assert (
            response.headers.get("referrer-policy")
            == "strict-origin-when-cross-origin"
        )


# ---------------------------------------------------------------------------
# Test — HSTS en mode prod (app ad-hoc indépendante du conftest)
# ---------------------------------------------------------------------------


class TestHSTSInProd:
    @pytest.mark.asyncio
    async def test_hsts_present_in_prod(self):
        """En ENVIRONMENT=prod, Strict-Transport-Security doit être injecté avec la valeur exacte.

        Instancie une app FastAPI minimale ad-hoc avec
        SecurityHeadersMiddleware(environment="prod")
        pour ne pas dépendre du singleton settings ni de la fixture conftest qui force "dev".
        """
        prod_app = FastAPI()
        prod_app.add_middleware(SecurityHeadersMiddleware, environment="prod")

        @prod_app.get("/ping")
        async def ping():
            return {"ping": "pong"}

        async with AsyncClient(
            transport=ASGITransport(app=prod_app),
            base_url="http://testserver",
        ) as ac:
            response = await ac.get("/ping")

        assert response.status_code == 200
        assert (
            response.headers.get("strict-transport-security")
            == "max-age=31536000; includeSubDomains"
        )
        # Les deux autres headers sont aussi présents en prod
        assert response.headers.get("x-content-type-options") == "nosniff"
        assert (
            response.headers.get("referrer-policy")
            == "strict-origin-when-cross-origin"
        )


# ---------------------------------------------------------------------------
# Tests — Cache-Control: no-store sur /api/v1/auth/*
# ---------------------------------------------------------------------------


class TestCacheControlAuth:
    @pytest.mark.asyncio
    async def test_auth_login_no_store_absent_on_httperror(self, client):
        """POST /api/v1/auth/login avec credentials invalides → 401 sans Cache-Control: no-store.

        Comportement connu de FastAPI (Option A — dépendance router) : quand un endpoint
        lève une HTTPException, FastAPI court-circuite vers l'exception handler global et
        construit une nouvelle Response indépendante. La dépendance qui modifie
        response.headers n'est pas exécutée sur ce chemin d'erreur.

        Ce test documente explicitement cette limite pour éviter toute confusion future.
        La dépendance couvre bien les cas de succès (test_auth_register_returns_no_store_on_201).
        Si la couverture des erreurs HTTP devient requise, migrer vers un middleware
        ciblant le préfixe /api/v1/auth/* (Option C ou exception_handler dédié).
        """
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "wrongpassword"},
        )

        assert response.status_code == 401
        # Le header n'est pas injecté sur HTTPException — comportement attendu de l'Option A.
        assert response.headers.get("cache-control") is None

    @pytest.mark.asyncio
    async def test_auth_register_returns_no_store_on_201(self, client, db_session):
        """POST /api/v1/auth/register avec données valides → 201 + Cache-Control: no-store.

        La dépendance _no_store_cache s'applique bien sur le chemin de succès.
        """
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "cachetest@example.com", "password": "Validpass1"},
        )

        assert response.status_code == 201
        assert response.headers.get("cache-control") == "no-store"

    @pytest.mark.asyncio
    async def test_health_endpoint_does_not_force_no_store(self, client):
        """GET /health ne doit pas forcer Cache-Control: no-store.

        Les endpoints hors /auth/* ne sont pas contraints — le client gère son cache.
        """
        response = await client.get("/health")

        assert response.status_code == 200
        # Vérifie l'absence du no-store forcé (le header peut être absent ou autre valeur)
        cache_control = response.headers.get("cache-control", "")
        assert "no-store" not in cache_control
