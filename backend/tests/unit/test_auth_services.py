"""Tests unitaires des services d'authentification — JWT et password.

Ces tests sont purement synchrones et n'ont aucune dépendance externe (pas de BDD,
pas d'appel réseau). Les fonctions des services CRUD User (service.py) sont exclues
de ce fichier — elles relèvent de T2-12 (tests d'intégration).

Note sur JWT_SECRET_KEY :
    Pydantic Settings valide JWT_SECRET_KEY au moment de l'import de config.py (champ
    requis sans valeur par défaut). La fixture `patch_jwt_secret` (autouse=True) force
    une valeur déterministe avant chaque test pour découpler les tests de l'environnement
    réel. Elle rétablit la valeur d'origine en teardown afin de ne pas polluer les autres
    suites de tests éventuellement exécutées dans la même session.
"""

from datetime import UTC, timedelta

import pytest

from app.core.config import settings
from app.modules.auth.jwt import (
    JWTError,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.modules.auth.password import hash_password, verify_password

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

TEST_JWT_SECRET = "test-secret-key-for-unit-tests-only"


@pytest.fixture(autouse=True)
def patch_jwt_secret():
    """Force une clé JWT déterministe pour tous les tests de ce module.

    Nécessaire car JWT_SECRET_KEY est un champ requis Pydantic Settings sans
    valeur par défaut : sans cette fixture, les tests échouent si la variable
    d'environnement n'est pas définie dans le contexte d'exécution.
    """
    original = settings.JWT_SECRET_KEY
    settings.JWT_SECRET_KEY = TEST_JWT_SECRET
    yield
    settings.JWT_SECRET_KEY = original


# ---------------------------------------------------------------------------
# Tests — password
# ---------------------------------------------------------------------------


class TestHashPassword:
    def test_hash_password_is_not_plain(self):
        """Le hash bcrypt ne doit jamais être identique au mot de passe en clair."""
        plain = "my_secure_password"
        hashed = hash_password(plain)

        assert hashed != plain

    def test_hash_password_deterministic_is_false(self):
        """Deux appels successifs avec le même mot de passe produisent des hashes différents.

        bcrypt intègre un salt aléatoire à chaque appel, garantissant que les hashes
        ne sont pas identiques même pour le même mot de passe. Cela protège contre les
        attaques par table arc-en-ciel.
        """
        plain = "my_secure_password"
        hash1 = hash_password(plain)
        hash2 = hash_password(plain)

        assert hash1 != hash2

    def test_hash_password_produces_non_empty_string(self):
        """Le hash retourné est une chaîne non vide."""
        hashed = hash_password("any_password")

        assert isinstance(hashed, str)
        assert len(hashed) > 0

    def test_hash_password_starts_with_bcrypt_prefix(self):
        """Le hash bcrypt commence toujours par le préfixe $2b$ ou $2a$ (format Blowfish)."""
        hashed = hash_password("any_password")

        assert hashed.startswith("$2")


class TestVerifyPassword:
    def test_verify_password_correct(self):
        """verify_password retourne True quand le mot de passe correspond au hash."""
        plain = "correct_password"
        hashed = hash_password(plain)

        assert verify_password(plain, hashed) is True

    def test_verify_password_wrong(self):
        """verify_password retourne False quand le mot de passe ne correspond pas."""
        hashed = hash_password("correct_password")

        assert verify_password("wrong_password", hashed) is False

    def test_verify_password_empty_string_does_not_match_non_empty_hash(self):
        """Une chaîne vide ne doit pas valider un hash produit depuis un mot de passe réel."""
        hashed = hash_password("some_password")

        assert verify_password("", hashed) is False

    def test_verify_password_case_sensitive(self):
        """La vérification est sensible à la casse — 'Password' != 'password'."""
        plain = "Password"
        hashed = hash_password(plain)

        assert verify_password("password", hashed) is False


# ---------------------------------------------------------------------------
# Tests — JWT
# ---------------------------------------------------------------------------


class TestCreateAccessToken:
    def test_create_access_token_contains_sub(self):
        """Le payload du token doit contenir le claim 'sub' tel qu'il a été fourni."""
        token = create_access_token(data={"sub": "user@example.com"})
        payload = decode_token(token)

        assert payload["sub"] == "user@example.com"

    def test_create_access_token_contains_type_access(self):
        """Le claim 'type' doit valoir 'access' pour distinguer ce token d'un refresh token."""
        token = create_access_token(data={"sub": "user@example.com"})
        payload = decode_token(token)

        assert payload["type"] == "access"

    def test_create_access_token_contains_exp(self):
        """Le token doit inclure un claim 'exp' (expiration) positionné dans le futur."""
        from datetime import datetime

        token = create_access_token(data={"sub": "user@example.com"})
        payload = decode_token(token)

        # jose retourne exp sous forme de timestamp entier
        exp = payload["exp"]
        assert exp > datetime.now(tz=UTC).timestamp()

    def test_create_access_token_returns_string(self):
        """create_access_token doit retourner une chaîne non vide."""
        token = create_access_token(data={"sub": "user@example.com"})

        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_access_token_custom_expires_delta(self):
        """Un expires_delta personnalisé doit être pris en compte."""
        # Token valide pendant 60 minutes — doit se décoder sans erreur
        token = create_access_token(
            data={"sub": "user@example.com"},
            expires_delta=timedelta(minutes=60),
        )
        payload = decode_token(token)

        assert payload["sub"] == "user@example.com"


class TestCreateRefreshToken:
    def test_create_refresh_token_contains_type_refresh(self):
        """Le claim 'type' doit valoir 'refresh' pour distinguer ce token d'un access token."""
        token = create_refresh_token(data={"sub": "user@example.com"})
        payload = decode_token(token)

        assert payload["type"] == "refresh"

    def test_create_refresh_token_contains_sub(self):
        """Le payload du refresh token doit contenir le claim 'sub'."""
        token = create_refresh_token(data={"sub": "user@example.com"})
        payload = decode_token(token)

        assert payload["sub"] == "user@example.com"

    def test_create_refresh_token_returns_string(self):
        """create_refresh_token doit retourner une chaîne non vide."""
        token = create_refresh_token(data={"sub": "user@example.com"})

        assert isinstance(token, str)
        assert len(token) > 0


class TestDecodeToken:
    def test_decode_valid_token(self):
        """Un token fraîchement créé doit se décoder sans lever d'exception."""
        token = create_access_token(data={"sub": "user@example.com"})
        payload = decode_token(token)

        assert isinstance(payload, dict)
        assert "sub" in payload

    def test_decode_invalid_token_raises(self):
        """decode_token doit lever JWTError pour une chaîne qui n'est pas un JWT valide."""
        with pytest.raises(JWTError):
            decode_token("garbage.not.a.token")

    def test_decode_expired_token_raises(self):
        """Un token avec une expiration dans le passé doit lever JWTError."""
        expired_token = create_access_token(
            data={"sub": "user@example.com"},
            expires_delta=timedelta(seconds=-1),
        )

        with pytest.raises(JWTError):
            decode_token(expired_token)

    def test_decode_token_with_tampered_signature_raises(self):
        """Altérer la signature du token doit invalider la vérification et lever JWTError.

        Ce test de non-régression garantit que la validation de signature est bien
        effectuée à chaque décodage.
        """
        token = create_access_token(data={"sub": "user@example.com"})
        # On remplace les derniers caractères de la signature (3ème segment du JWT)
        parts = token.split(".")
        tampered_signature = parts[2][:-4] + "XXXX"
        tampered_token = ".".join([parts[0], parts[1], tampered_signature])

        with pytest.raises(JWTError):
            decode_token(tampered_token)

    def test_decode_token_signed_with_wrong_key_raises(self):
        """Un token signé avec une clé différente de celle courante doit lever JWTError."""
        # Signer avec une clé différente de TEST_JWT_SECRET
        original_key = settings.JWT_SECRET_KEY
        settings.JWT_SECRET_KEY = "another-totally-different-secret"
        token_with_other_key = create_access_token(data={"sub": "user@example.com"})

        # Restaurer la clé de test et tenter de décoder
        settings.JWT_SECRET_KEY = original_key

        with pytest.raises(JWTError):
            decode_token(token_with_other_key)

    def test_decode_empty_string_raises(self):
        """Une chaîne vide doit lever JWTError."""
        with pytest.raises(JWTError):
            decode_token("")
