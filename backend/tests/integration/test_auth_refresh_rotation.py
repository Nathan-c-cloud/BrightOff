"""Tests d'intégration — rotation effective des refresh tokens (Fix 2, jti persisté).

Vérifie que :
- Un refresh token issu de /login est utilisable une seule fois (/refresh).
- Après rotation, l'ancien token retourne 401.
- Après /logout, le refresh token est révoqué.
- Un token expiré retourne 401 (expiration détectée côté JWT par PyJWT).
- Un token sans jti (format pré-rotation) est rejeté.

Prérequis :
    - Container PostgreSQL démarré : `docker compose up postgres -d`

Exécution :
    cd backend && pytest tests/integration/test_auth_refresh_rotation.py -v
"""

from datetime import UTC, datetime

import pytest
import jwt as jose_jwt

from app.core.config import settings

VALID_PASSWORD = "Securepass1"


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestRefreshRotation:
    @pytest.mark.asyncio
    async def test_login_returns_refresh_token_usable_once(self, client, db_session):
        """Un refresh token issu du login peut être utilisé une fois pour obtenir de nouveaux tokens."""
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": "rotationlogin@example.com", "password": VALID_PASSWORD},
        )
        # Créer d'abord l'utilisateur
        await client.post(
            "/api/v1/auth/register",
            json={"email": "rotationlogin@example.com", "password": VALID_PASSWORD},
        )
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": "rotationlogin@example.com", "password": VALID_PASSWORD},
        )
        refresh_token = login_response.json()["refresh_token"]

        response = await client.post(
            "/api/v1/auth/refresh",
            headers=_auth_headers(refresh_token),
        )
        assert response.status_code == 200
        assert "access_token" in response.json()
        assert "refresh_token" in response.json()

    @pytest.mark.asyncio
    async def test_refresh_old_token_invalid_after_rotation(self, client, db_session):
        """Après rotation, réutiliser l'ancien refresh token doit retourner 401."""
        await client.post(
            "/api/v1/auth/register",
            json={"email": "rotationold@example.com", "password": VALID_PASSWORD},
        )
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": "rotationold@example.com", "password": VALID_PASSWORD},
        )
        old_refresh = login_response.json()["refresh_token"]

        # Première rotation — consomme l'ancien token
        first_refresh = await client.post(
            "/api/v1/auth/refresh",
            headers=_auth_headers(old_refresh),
        )
        assert first_refresh.status_code == 200

        # Réutiliser l'ancien token doit échouer
        reuse = await client.post(
            "/api/v1/auth/refresh",
            headers=_auth_headers(old_refresh),
        )
        assert reuse.status_code == 401

    @pytest.mark.asyncio
    async def test_new_refresh_token_is_different_from_old(self, client, db_session):
        """Après rotation, le nouveau refresh token doit être différent de l'ancien."""
        register_response = await client.post(
            "/api/v1/auth/register",
            json={"email": "rotationdiff@example.com", "password": VALID_PASSWORD},
        )
        old_refresh = register_response.json()["refresh_token"]

        refresh_response = await client.post(
            "/api/v1/auth/refresh",
            headers=_auth_headers(old_refresh),
        )
        assert refresh_response.status_code == 200
        new_refresh = refresh_response.json()["refresh_token"]

        assert old_refresh != new_refresh

    @pytest.mark.asyncio
    async def test_logout_invalidates_refresh_token(self, client, db_session):
        """Après logout, le refresh token doit être révoqué et retourner 401 sur /refresh."""
        register_response = await client.post(
            "/api/v1/auth/register",
            json={"email": "rotationlogout@example.com", "password": VALID_PASSWORD},
        )
        refresh_token = register_response.json()["refresh_token"]

        logout = await client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": refresh_token},
        )
        assert logout.status_code == 204

        # Le token révoqué ne doit plus fonctionner
        refresh_after_logout = await client.post(
            "/api/v1/auth/refresh",
            headers=_auth_headers(refresh_token),
        )
        assert refresh_after_logout.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_refresh_token_returns_401(self, client, db_session):
        """Un refresh token dont le claim exp est dépassé doit retourner 401.

        PyJWT lève InvalidTokenError avant même la vérification du jti en base.
        """
        expired_payload = {
            "sub": "expiredrotation@example.com",
            "type": "refresh",
            "jti": "00000000-0000-0000-0000-000000000001",
            "exp": datetime(2020, 1, 1, tzinfo=UTC),
        }
        expired_token = jose_jwt.encode(
            expired_payload,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )

        response = await client.post(
            "/api/v1/auth/refresh",
            headers=_auth_headers(expired_token),
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_token_without_jti_returns_401(self, client, db_session):
        """Un refresh token sans claim jti (format pré-rotation) doit retourner 401.

        Protège contre la réutilisation de tokens émis avant la mise en place
        de la rotation effective. Ces tokens ne peuvent pas être vérifiés en base.
        """
        legacy_payload = {
            "sub": "legacyrotation@example.com",
            "type": "refresh",
        }
        legacy_token = jose_jwt.encode(
            legacy_payload,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )

        response = await client.post(
            "/api/v1/auth/refresh",
            headers=_auth_headers(legacy_token),
        )
        assert response.status_code == 401
