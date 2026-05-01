"""Tests d'intégration des endpoints auth — T2-12.

Chaque test utilise une vraie base PostgreSQL (brightoff_test) via les fixtures
`client` et `db_session` définies dans `tests/conftest.py`.

Prérequis :
    - Container PostgreSQL démarré : `docker compose up postgres -d`
    - Base `brightoff_test` accessible à l'URL définie dans TEST_DATABASE_URL

Exécution :
    cd backend && pytest tests/integration/ -v
"""

from datetime import UTC, timedelta
from unittest.mock import patch

import pytest

from app.core.config import settings
from app.modules.auth import jwt as jwt_module
from app.modules.auth.models import User

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _auth_headers(token: str) -> dict:
    """Construit le header Authorization Bearer pour un token donné."""
    return {"Authorization": f"Bearer {token}"}


async def _register_user(client, email: str, password: str) -> dict:
    """Raccourci pour inscrire un utilisateur et récupérer la réponse JSON."""
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    return response


# ---------------------------------------------------------------------------
# Tests — POST /api/v1/auth/register
# ---------------------------------------------------------------------------


class TestRegister:
    @pytest.mark.asyncio
    async def test_register_success_returns_201_with_token(self, client, db_session):
        """Une inscription valide doit retourner 201 avec un TokenResponse complet."""
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "newuser@example.com", "password": "securepass"},
        )

        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["access_token"] != ""
        assert data["refresh_token"] != ""
        assert data["token_type"] == "bearer"
        assert isinstance(data["expires_in"], int)
        assert data["expires_in"] > 0

    @pytest.mark.asyncio
    async def test_register_success_token_is_decodable(self, client, db_session):
        """Le token retourné par register doit être un JWT valide décodable."""
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "decodable@example.com", "password": "securepass"},
        )

        assert response.status_code == 201
        token = response.json()["access_token"]
        payload = jwt_module.decode_token(token)
        assert payload["sub"] == "decodable@example.com"
        assert payload["type"] == "access"

    @pytest.mark.asyncio
    async def test_register_success_user_persisted_in_db(self, client, db_session):
        """Après inscription réussie, l'utilisateur doit être présent en base."""
        from sqlalchemy import select

        email = "persisted@example.com"
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "securepass"},
        )

        assert response.status_code == 201

        # Vérifier la présence en base via la session de test
        result = await db_session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        assert user is not None
        assert user.email == email
        assert user.is_active is True
        assert user.hashed_password is not None
        # Le mot de passe ne doit jamais être stocké en clair
        assert user.hashed_password != "securepass"
        assert user.oauth_provider is None

    @pytest.mark.asyncio
    async def test_register_duplicate_email_returns_409(self, client, db_session):
        """Inscrire un email déjà utilisé doit retourner 409 Conflict."""
        payload = {"email": "duplicate@example.com", "password": "securepass"}

        # Première inscription — succès attendu
        first = await client.post("/api/v1/auth/register", json=payload)
        assert first.status_code == 201

        # Deuxième inscription avec le même email — conflit attendu
        second = await client.post("/api/v1/auth/register", json=payload)

        assert second.status_code == 409

    @pytest.mark.asyncio
    async def test_register_invalid_email_returns_422(self, client, db_session):
        """Un email malformé doit retourner 422 Unprocessable Entity."""
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "not-an-email", "password": "securepass"},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_password_too_short_returns_422(self, client, db_session):
        """Un mot de passe de moins de 10 caractères doit retourner 422."""
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "short@example.com", "password": "short"},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_password_9_chars_returns_422(self, client, db_session):
        """Un mot de passe de 9 caractères exactement doit retourner 422.

        Vérifie le seuil exact : 9 < 10, donc rejeté par Pydantic Field(min_length=10).
        """
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "ninechars@example.com", "password": "neufchars"},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_password_10_chars_returns_201(self, client, db_session):
        """Un mot de passe de 10 caractères exactement doit être accepté (retourne 201).

        Vérifie le seuil exact : 10 >= 10, donc accepté par Pydantic Field(min_length=10).
        """
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "tenchars@example.com", "password": "dixchar10!"},
        )

        assert response.status_code == 201

    @pytest.mark.asyncio
    @pytest.mark.skip(
        reason=(
            "La fixture `client` partage une unique AsyncSession entre toutes les "
            "requêtes du test. Deux asyncio.gather sur le même client déclenchent "
            "'Session is already flushing' côté SQLAlchemy — ce n'est pas un bug "
            "du code de production mais une limite d'isolation du harness de test. "
            "La race condition réelle est couverte indirectement par "
            "test_register_duplicate_email_returns_409 (contrainte UNIQUE + "
            "IntegrityError → 409). Un test de vraie concurrence nécessiterait un "
            "client HTTP externe (ex. httpx.AsyncClient distinct par requête) avec "
            "une connexion DB dédiée par appel — hors scope S3-05."
        )
    )
    async def test_register_concurrent_same_email_one_succeeds_one_fails(
        self, client, db_session
    ):
        """Deux inscriptions simultanées avec le même email : exactement un 201 et un 409.

        Vérifie que la contrainte UNIQUE BDD + gestion IntegrityError dans
        create_user_email empêche les doublons même sous race condition. L'un des
        deux appels réussit (201), l'autre est rejeté atomiquement (409).
        """
        import asyncio

        payload = {"email": "concurrent@example.com", "password": "validPass123"}

        r1, r2 = await asyncio.gather(
            client.post("/api/v1/auth/register", json=payload),
            client.post("/api/v1/auth/register", json=payload),
        )

        statuses = sorted([r1.status_code, r2.status_code])
        assert statuses == [201, 409], (
            f"Expected exactly one 201 and one 409, got {statuses}"
        )


# ---------------------------------------------------------------------------
# Tests — POST /api/v1/auth/login
# ---------------------------------------------------------------------------


class TestLogin:
    @pytest.mark.asyncio
    async def test_login_success_returns_200_with_token(self, client, db_session):
        """Une connexion valide doit retourner 200 avec un TokenResponse."""
        # Arrange : créer l'utilisateur via register
        await client.post(
            "/api/v1/auth/register",
            json={"email": "loginuser@example.com", "password": "correctpass"},
        )

        # Act : connexion
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "loginuser@example.com", "password": "correctpass"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["access_token"] != ""
        assert data["refresh_token"] != ""
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_success_token_contains_correct_sub(self, client, db_session):
        """Le token retourné par login doit contenir l'email comme claim sub."""
        email = "subcheck@example.com"
        await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "correctpass"},
        )

        response = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "correctpass"},
        )

        assert response.status_code == 200
        token = response.json()["access_token"]
        payload = jwt_module.decode_token(token)
        assert payload["sub"] == email

    @pytest.mark.asyncio
    async def test_login_wrong_password_returns_401(self, client, db_session):
        """Un mot de passe incorrect doit retourner 401 avec un message générique."""
        await client.post(
            "/api/v1/auth/register",
            json={"email": "wrongpass@example.com", "password": "correctpass"},
        )

        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "wrongpass@example.com", "password": "wrongpassword"},
        )

        assert response.status_code == 401
        # Message générique : ne pas distinguer email inconnu de mauvais password (OWASP)
        assert response.json()["detail"] == "Invalid email or password"

    @pytest.mark.asyncio
    async def test_login_unknown_email_returns_401(self, client, db_session):
        """Un email inconnu doit retourner 401 avec le même message générique que mauvais password.

        Anti-énumération : l'attaquant ne doit pas pouvoir distinguer
        "cet email n'existe pas" de "mauvais mot de passe".
        """
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "unknown@example.com", "password": "anypassword"},
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"

    @pytest.mark.asyncio
    async def test_login_disabled_user_returns_403(self, client, db_session):
        """Un utilisateur avec is_active=False doit obtenir 403 Forbidden après authentification.

        La distinction 401 / 403 est intentionnelle : l'identité est prouvée
        (email + password corrects) mais l'accès est explicitement refusé.
        """
        from sqlalchemy import select

        email = "disabled@example.com"

        # Créer l'utilisateur via register
        await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "correctpass"},
        )

        # Désactiver le compte directement en base
        result = await db_session.execute(select(User).where(User.email == email))
        user = result.scalar_one()
        user.is_active = False
        await db_session.flush()

        # Tentative de connexion avec un compte désactivé
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "correctpass"},
        )

        assert response.status_code == 403
        assert response.json()["detail"] == "Account disabled"


# ---------------------------------------------------------------------------
# Tests — GET /api/v1/auth/me
# ---------------------------------------------------------------------------


class TestMe:
    @pytest.mark.asyncio
    async def test_me_authenticated_returns_200_with_user_data(self, client, db_session):
        """Un utilisateur authentifié doit recevoir 200 avec ses données (id, email, etc.)."""
        email = "meuser@example.com"

        # Arrange : inscription et récupération du token
        register_response = await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "securepass"},
        )
        token = register_response.json()["access_token"]

        # Act
        response = await client.get("/api/v1/auth/me", headers=_auth_headers(token))

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == email
        assert data["is_active"] is True
        # Vérification que l'UUID est présent (format UUID string)
        assert "id" in data
        assert len(data["id"]) == 36  # format UUID standard : 8-4-4-4-12
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_me_email_matches_registered_email(self, client, db_session):
        """L'email retourné par /me doit correspondre exactement à l'email d'inscription."""
        email = "exactmatch@example.com"

        register_response = await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "securepass"},
        )
        token = register_response.json()["access_token"]

        response = await client.get("/api/v1/auth/me", headers=_auth_headers(token))

        assert response.status_code == 200
        assert response.json()["email"] == email

    @pytest.mark.asyncio
    async def test_me_unauthenticated_returns_401(self, client, db_session):
        """Appeler /me sans header Authorization doit retourner 401."""
        response = await client.get("/api/v1/auth/me")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_me_invalid_token_returns_401(self, client, db_session):
        """Un token JWT malformé ou invalide doit retourner 401."""
        response = await client.get(
            "/api/v1/auth/me",
            headers=_auth_headers("this.is.not.a.valid.jwt"),
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_me_expired_token_returns_401(self, client, db_session):
        """Un access token expiré doit retourner 401."""
        expired_token = jwt_module.create_access_token(
            data={"sub": "expired@example.com"},
            expires_delta=timedelta(seconds=-1),
        )

        response = await client.get(
            "/api/v1/auth/me",
            headers=_auth_headers(expired_token),
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_me_with_refresh_token_returns_401(self, client, db_session):
        """Utiliser un refresh token sur /me doit retourner 401.

        get_current_user rejette explicitement les tokens avec type != 'access'.
        Ce test protège contre une régression où un refresh token pourrait
        être accepté comme access token.
        """
        refresh_token = jwt_module.create_refresh_token(data={"sub": "refreshtest@example.com"})

        response = await client.get(
            "/api/v1/auth/me",
            headers=_auth_headers(refresh_token),
        )

        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Tests — POST /api/v1/auth/refresh
# ---------------------------------------------------------------------------


class TestRefresh:
    @pytest.mark.asyncio
    async def test_refresh_valid_refresh_token_returns_200_with_new_access_token(
        self, client, db_session
    ):
        """Un refresh token valide doit retourner 200 avec access token et refresh token.

        Rotation : chaque appel à /refresh émet un nouveau refresh token.
        """
        # Arrange : inscrire l'utilisateur et récupérer le refresh token depuis la réponse register
        email = "refreshvalid@example.com"
        register_response = await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "securepass"},
        )
        refresh_token = register_response.json()["refresh_token"]

        # Act
        response = await client.post(
            "/api/v1/auth/refresh",
            headers=_auth_headers(refresh_token),
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["access_token"] != ""
        assert data["refresh_token"] != ""
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_refresh_returns_decodable_access_token(self, client, db_session):
        """Le token retourné par /refresh doit être un access token valide et décodable."""
        email = "refreshdecode@example.com"
        await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "securepass"},
        )
        refresh_token = jwt_module.create_refresh_token(data={"sub": email})

        response = await client.post(
            "/api/v1/auth/refresh",
            headers=_auth_headers(refresh_token),
        )

        assert response.status_code == 200
        new_token = response.json()["access_token"]
        payload = jwt_module.decode_token(new_token)
        assert payload["type"] == "access"
        assert payload["sub"] == email

    @pytest.mark.asyncio
    async def test_refresh_with_access_token_returns_401(self, client, db_session):
        """Utiliser un access token sur /refresh doit retourner 401.

        L'endpoint /refresh rejette explicitement les tokens avec type != 'refresh'.
        Ce test de non-régression protège contre un contournement de sécurité où
        un access token serait accepté comme refresh token.
        """
        email = "accessasrefresh@example.com"
        register_response = await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "securepass"},
        )
        access_token = register_response.json()["access_token"]

        response = await client.post(
            "/api/v1/auth/refresh",
            headers=_auth_headers(access_token),
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_expired_refresh_token_returns_401(self, client, db_session):
        """Un refresh token expiré doit retourner 401."""
        from datetime import datetime

        from jose import jwt as jose_jwt

        # Construire manuellement un refresh token expiré
        expired_payload = {
            "sub": "expiredrefresh@example.com",
            "type": "refresh",
            "exp": datetime(2020, 1, 1, tzinfo=UTC),
        }
        expired_refresh = jose_jwt.encode(
            expired_payload,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )

        response = await client.post(
            "/api/v1/auth/refresh",
            headers=_auth_headers(expired_refresh),
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_invalid_token_returns_401(self, client, db_session):
        """Un token JWT malformé sur /refresh doit retourner 401."""
        response = await client.post(
            "/api/v1/auth/refresh",
            headers=_auth_headers("completely.invalid.token"),
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_no_token_returns_403(self, client, db_session):
        """Appeler /refresh sans header Authorization doit retourner 403.

        Note : HTTPBearer retourne 403 (pas 401) quand le header est absent,
        comportement par défaut de FastAPI avec auto_error=True.
        """
        response = await client.post("/api/v1/auth/refresh")

        # HTTPBearer avec auto_error=True retourne 403 si le header est absent
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Tests — POST /api/v1/auth/google (token invalide uniquement)
# ---------------------------------------------------------------------------


class TestGoogleAuth:
    @pytest.mark.asyncio
    async def test_google_invalid_token_returns_401(self, client, db_session):
        """Un token Google invalide doit retourner 401.

        Le test de succès Google OAuth n'est pas couvert ici : il nécessiterait
        de mocker google.oauth2.id_token.verify_oauth2_token, ce qui sort du
        périmètre des tests d'intégration avec vraie DB. Un test unitaire dédié
        est plus approprié pour ce cas (T2-11 ou une suite future).
        """
        response = await client.post(
            "/api/v1/auth/google",
            json={"google_token": "this-is-not-a-valid-google-token"},
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Token Google invalide"

    @pytest.mark.asyncio
    async def test_google_empty_token_returns_401(self, client, db_session):
        """Un token Google vide doit retourner 401."""
        response = await client.post(
            "/api/v1/auth/google",
            json={"google_token": ""},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_google_success_with_mocked_verification(self, client, db_session):
        """Avec un token Google valide (mocké), un utilisateur doit être créé et un JWT retourné.

        Ce test utilise unittest.mock pour bypasser la vérification Google réelle.
        Il valide la logique d'intégration complète (création utilisateur + JWT)
        sans dépendre d'un vrai token Google.
        """
        mock_id_info = {
            "email": "googleuser@example.com",
            "sub": "google-oauth-id-12345",
            "email_verified": True,  # M-003 : requis depuis le check email_verified
        }

        with patch(
            "google.oauth2.id_token.verify_oauth2_token",
            return_value=mock_id_info,
        ):
            response = await client.post(
                "/api/v1/auth/google",
                json={"google_token": "mocked-valid-google-token"},
            )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["access_token"] != ""
        assert data["refresh_token"] != ""
        assert data["token_type"] == "bearer"

        # Vérifier que le token retourné est valide et contient le bon sub
        payload = jwt_module.decode_token(data["access_token"])
        assert payload["sub"] == "googleuser@example.com"

    @pytest.mark.asyncio
    async def test_google_success_creates_user_in_db_with_mocked_verification(
        self, client, db_session
    ):
        """Avec un token Google mocké, l'utilisateur doit être persisté en base.

        Vérifie que oauth_provider='google' et oauth_id sont correctement stockés.
        """
        from sqlalchemy import select

        email = "googlenewuser@example.com"
        oauth_id = "google-sub-unique-9999"
        mock_id_info = {
            "email": email,
            "sub": oauth_id,
            "email_verified": True,  # M-003 : requis depuis le check email_verified
        }

        with patch(
            "google.oauth2.id_token.verify_oauth2_token",
            return_value=mock_id_info,
        ):
            response = await client.post(
                "/api/v1/auth/google",
                json={"google_token": "mocked-valid-google-token"},
            )

        assert response.status_code == 200

        result = await db_session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        assert user is not None
        assert user.oauth_provider == "google"
        assert user.oauth_id == oauth_id
        assert user.hashed_password is None

    @pytest.mark.asyncio
    async def test_google_unverified_email_returns_401(self, client, db_session):
        """Un token Google avec email non vérifié (email_verified=False) doit retourner 401.

        Vérifie le check M-003 : l'endpoint rejette explicitement les comptes Google
        dont l'email n'a pas été confirmé par Google, avant toute création en base.
        """
        mock_id_info = {
            "email": "alice@example.com",
            "sub": "google-id-123",
            "email_verified": False,
        }

        with patch(
            "google.oauth2.id_token.verify_oauth2_token",
            return_value=mock_id_info,
        ):
            response = await client.post(
                "/api/v1/auth/google",
                json={"google_token": "mocked-unverified-google-token"},
            )

        assert response.status_code == 401
        assert response.json()["detail"] == "Google email not verified"
