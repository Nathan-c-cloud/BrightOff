"""Tests d'intégration — rate limiting sur les endpoints auth.

Vérifie que slowapi applique correctement les limites déclarées sur /login
et /register. Le test de reset après 1 minute est skippé (trop lent en CI).

Prérequis :
    - Container PostgreSQL démarré : `docker compose up postgres -d`

Exécution :
    cd backend && pytest tests/integration/test_auth_rate_limit.py -v

Note sur l'isolation :
    slowapi stocke les compteurs en mémoire (MemoryStorage par défaut).
    Les compteurs sont partagés entre tests dans la même session pytest si
    l'app FastAPI n'est pas recréée entre chaque test. Pour contourner cela,
    chaque test utilise un email unique et une IP distincte via le header
    X-Forwarded-For — slowapi utilise get_remote_address qui lit ce header
    en priorité si FORWARDED_FOR est présent.
    On incrémente le dernier octet de l'IP pour isoler les compteurs par test.
"""

import pytest

VALID_PASSWORD = "Securepass1"


def _ip_headers(last_octet: int) -> dict:
    """Simule une IP cliente distincte pour isoler les compteurs slowapi."""
    return {"X-Forwarded-For": f"10.0.0.{last_octet}"}


# ---------------------------------------------------------------------------
# Rate limit — POST /api/v1/auth/login (5/minute)
# ---------------------------------------------------------------------------


class TestLoginRateLimit:
    @pytest.mark.asyncio
    async def test_login_5_attempts_succeed_6th_returns_429(self, client, db_session):
        """5 tentatives login sont acceptées, la 6e doit retourner 429."""
        headers = _ip_headers(10)

        # Les 5 premières requêtes doivent passer (peu importe le statut métier)
        for _ in range(5):
            resp = await client.post(
                "/api/v1/auth/login",
                json={"email": "ratelimit@example.com", "password": "Anypassword9"},
                headers=headers,
            )
            assert resp.status_code != 429, f"Expected non-429 but got 429 before limit reached"

        # La 6e doit être bloquée
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "ratelimit@example.com", "password": "Anypassword9"},
            headers=headers,
        )
        assert resp.status_code == 429

    @pytest.mark.asyncio
    @pytest.mark.skip(
        reason=(
            "Test de reset du compteur après 1 minute — trop lent pour la CI. "
            "Validé manuellement en environnement isolé."
        )
    )
    async def test_login_rate_limit_resets_after_1_minute(self, client, db_session):
        """Après 1 minute, le compteur doit être remis à zéro."""
        import asyncio

        headers = _ip_headers(11)

        for _ in range(5):
            await client.post(
                "/api/v1/auth/login",
                json={"email": "ratelimitreset@example.com", "password": "Anypassword9"},
                headers=headers,
            )

        await asyncio.sleep(61)

        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "ratelimitreset@example.com", "password": "Anypassword9"},
            headers=headers,
        )
        assert resp.status_code != 429


# ---------------------------------------------------------------------------
# Rate limit — POST /api/v1/auth/register (3/minute)
# ---------------------------------------------------------------------------


class TestRegisterRateLimit:
    @pytest.mark.asyncio
    async def test_register_3_attempts_succeed_4th_returns_429(self, client, db_session):
        """3 tentatives register sont acceptées, la 4e doit retourner 429."""
        headers = _ip_headers(20)

        # Les 3 premières requêtes doivent passer (peu importe le statut métier)
        for i in range(3):
            resp = await client.post(
                "/api/v1/auth/register",
                json={
                    "email": f"ratelimitreg{i}@example.com",
                    "password": VALID_PASSWORD,
                },
                headers=headers,
            )
            assert resp.status_code != 429, f"Expected non-429 but got 429 on attempt {i + 1}"

        # La 4e doit être bloquée
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "ratelimitreg3@example.com", "password": VALID_PASSWORD},
            headers=headers,
        )
        assert resp.status_code == 429

    @pytest.mark.asyncio
    @pytest.mark.skip(
        reason=(
            "Test de reset du compteur après 1 minute — trop lent pour la CI. "
            "Validé manuellement en environnement isolé."
        )
    )
    async def test_register_rate_limit_resets_after_1_minute(self, client, db_session):
        """Après 1 minute, le compteur doit être remis à zéro."""
        import asyncio

        headers = _ip_headers(21)

        for i in range(3):
            await client.post(
                "/api/v1/auth/register",
                json={
                    "email": f"ratelimitregreset{i}@example.com",
                    "password": VALID_PASSWORD,
                },
                headers=headers,
            )

        await asyncio.sleep(61)

        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "ratelimitregreset3@example.com", "password": VALID_PASSWORD},
            headers=headers,
        )
        assert resp.status_code != 429
