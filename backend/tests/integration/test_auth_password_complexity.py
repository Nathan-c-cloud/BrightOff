"""Tests d'intégration — validation de complexité du mot de passe (Fix 5).

Vérifie que le validator Pydantic `password_complexity` sur UserRegisterRequest
rejette les mots de passe ne satisfaisant pas les règles :
- >= 10 caractères
- Au moins 1 majuscule
- Au moins 1 minuscule
- Au moins 1 chiffre

Pas de symbole obligatoire (choix UX).

Prérequis :
    - Container PostgreSQL démarré : `docker compose up postgres -d`

Exécution :
    cd backend && pytest tests/integration/test_auth_password_complexity.py -v
"""

import pytest


class TestPasswordComplexity:
    @pytest.mark.asyncio
    async def test_no_uppercase_returns_422(self, client, db_session):
        """Un mot de passe sans majuscule doit retourner 422."""
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "complexity1@example.com", "password": "abcdefghij"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_no_lowercase_returns_422(self, client, db_session):
        """Un mot de passe sans minuscule doit retourner 422."""
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "complexity2@example.com", "password": "ABCDEFGHIJ"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_no_digit_returns_422(self, client, db_session):
        """Un mot de passe sans chiffre doit retourner 422."""
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "complexity3@example.com", "password": "Abcdefghij"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_valid_password_returns_201(self, client, db_session):
        """Un mot de passe avec maj + min + chiffre + >= 10 chars doit retourner 201."""
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "complexity4@example.com", "password": "Abcdef1234"},
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_password_10_chars_all_rules_satisfied_returns_201(
        self, client, db_session
    ):
        """Exactement 10 caractères avec toutes les règles satisfaites doit retourner 201."""
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "complexity5@example.com", "password": "Abcdefg1hi"},
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_error_message_is_informative(self, client, db_session):
        """Le message d'erreur 422 doit être explicite sur les règles manquantes."""
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "complexity6@example.com", "password": "abcdefghij"},
        )
        assert response.status_code == 422
        body = response.json()
        # Vérifier que le message Pydantic est présent dans la réponse
        detail_str = str(body)
        assert "majuscule" in detail_str or "1 majuscule" in detail_str
