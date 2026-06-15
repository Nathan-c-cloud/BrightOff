"""Tests unitaires — claude_client.py (S3-11).

Stratégie de mock :
- On patche `app.modules.cv_parser.claude_client._call_claude_once` directement.
  Cela évite de construire les objets anthropic.AsyncAnthropic complets (opaque, lourd)
  et isole exactement la logique de retry/error-handling de parse_cv_with_claude.
- Pour le test du prompt caching et des paramètres modèle, on patche
  `anthropic.AsyncAnthropic` et on inspecte l'appel à `client.messages.create`.
- httpx.TimeoutException et anthropic.RateLimitError sont levées directement
  depuis les mocks (pas besoin de vraie réponse HTTP).
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import anthropic
import httpx
import pytest

from app.modules.cv_parser.claude_client import (
    MODEL_ID,
    RATE_LIMIT_RETRY_DELAY_SECONDS,
    TEMPERATURE,
    ClaudeRateLimitError,
    ClaudeTimeoutError,
    InvalidJsonError,
    MAX_TOKENS,
    _extract_json_from_response,
    parse_cv_with_claude,
)
from app.modules.cv_parser.prompt import SYSTEM_PROMPT

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_VALID_CV_DICT = {
    "is_cv": True,
    "title": "Développeur Python",
    "summary": None,
    "years_of_experience": 3,
    "skills": [{"name": "Python", "category": "tech", "level": 4}],
    "experiences": [],
    "education": [],
    "languages": [{"name": "Français", "level": "Natif"}],
}


# ---------------------------------------------------------------------------
# Tests — _extract_json_from_response (parseur 3 passes)
# ---------------------------------------------------------------------------


class TestExtractJsonFromResponse:
    def test_parse_1_clean_json_direct(self):
        raw = '{"is_cv": true, "title": "Dev"}'
        result = _extract_json_from_response(raw)
        assert result == {"is_cv": True, "title": "Dev"}

    def test_parse_2_json_in_markdown_block(self):
        raw = '```json\n{"is_cv": true}\n```'
        result = _extract_json_from_response(raw)
        assert result == {"is_cv": True}

    def test_parse_2_json_in_generic_code_block(self):
        raw = "```\n{\"is_cv\": false, \"reason\": \"lettre de motivation\"}\n```"
        result = _extract_json_from_response(raw)
        assert result == {"is_cv": False, "reason": "lettre de motivation"}

    def test_parse_3_json_embedded_in_text(self):
        raw = 'Voici le résultat : {"is_cv": true, "title": "Dev"} — fin.'
        result = _extract_json_from_response(raw)
        assert result == {"is_cv": True, "title": "Dev"}

    def test_parse_raises_value_error_on_invalid_json(self):
        raw = "pas de JSON du tout ici"
        with pytest.raises(ValueError, match="Aucun JSON valide"):
            _extract_json_from_response(raw)

    def test_parse_raises_value_error_on_empty_string(self):
        with pytest.raises(ValueError):
            _extract_json_from_response("")

    def test_parse_raises_value_error_on_malformed_json(self):
        raw = "{is_cv: true}"  # JSON invalide (clé sans guillemets)
        with pytest.raises(ValueError):
            _extract_json_from_response(raw)

    def test_parse_1_handles_leading_trailing_whitespace(self):
        raw = "   \n  {\"is_cv\": true}  \n  "
        result = _extract_json_from_response(raw)
        assert result == {"is_cv": True}


# ---------------------------------------------------------------------------
# Tests — parse_cv_with_claude : cas nominal
# ---------------------------------------------------------------------------


class TestParseCvWithClaudeSuccess:
    async def test_first_call_success_returns_dict(self):
        with patch(
            "app.modules.cv_parser.claude_client._call_claude_once",
            new_callable=AsyncMock,
            return_value=_VALID_CV_DICT,
        ):
            result = await parse_cv_with_claude("texte cv valide")

        assert result["is_cv"] is True
        assert result["title"] == "Développeur Python"

    async def test_first_call_success_no_retry_needed(self):
        mock_call = AsyncMock(return_value=_VALID_CV_DICT)
        with patch("app.modules.cv_parser.claude_client._call_claude_once", mock_call):
            await parse_cv_with_claude("texte cv")

        # Appel unique — pas de retry
        assert mock_call.call_count == 1


# ---------------------------------------------------------------------------
# Tests — parse_cv_with_claude : retry JSON invalide
# ---------------------------------------------------------------------------


class TestParseCvWithClaudeJsonRetry:
    async def test_invalid_json_first_call_then_valid_second_call_returns_dict(self):
        mock_call = AsyncMock(
            side_effect=[ValueError("JSON invalide"), _VALID_CV_DICT]
        )
        with patch("app.modules.cv_parser.claude_client._call_claude_once", mock_call):
            result = await parse_cv_with_claude("texte cv")

        assert result == _VALID_CV_DICT
        assert mock_call.call_count == 2

    async def test_invalid_json_twice_raises_invalid_json_error(self):
        mock_call = AsyncMock(
            side_effect=[ValueError("JSON invalide 1"), ValueError("JSON invalide 2")]
        )
        with patch("app.modules.cv_parser.claude_client._call_claude_once", mock_call):
            with pytest.raises(InvalidJsonError):
                await parse_cv_with_claude("texte cv")

        assert mock_call.call_count == 2

    async def test_timeout_on_json_retry_raises_claude_timeout_error(self):
        mock_call = AsyncMock(
            side_effect=[ValueError("JSON invalide"), httpx.TimeoutException("timeout")]
        )
        with patch("app.modules.cv_parser.claude_client._call_claude_once", mock_call):
            with pytest.raises(ClaudeTimeoutError):
                await parse_cv_with_claude("texte cv")


# ---------------------------------------------------------------------------
# Tests — parse_cv_with_claude : timeout
# ---------------------------------------------------------------------------


class TestParseCvWithClaudeTimeout:
    async def test_timeout_on_first_call_raises_claude_timeout_error(self):
        mock_call = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        with patch("app.modules.cv_parser.claude_client._call_claude_once", mock_call):
            with pytest.raises(ClaudeTimeoutError):
                await parse_cv_with_claude("texte cv")

    async def test_timeout_does_not_retry(self):
        mock_call = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        with patch("app.modules.cv_parser.claude_client._call_claude_once", mock_call):
            with pytest.raises(ClaudeTimeoutError):
                await parse_cv_with_claude("texte cv")

        # Timeout → 0 retry
        assert mock_call.call_count == 1


# ---------------------------------------------------------------------------
# Tests — parse_cv_with_claude : rate limit 429
# ---------------------------------------------------------------------------


class TestParseCvWithClaudeRateLimit:
    async def test_rate_limit_then_success_returns_dict(self):
        mock_call = AsyncMock(
            side_effect=[
                anthropic.RateLimitError(
                    "rate limit",
                    response=MagicMock(status_code=429),
                    body=None,
                ),
                _VALID_CV_DICT,
            ]
        )
        # Patch asyncio.sleep pour ne pas attendre 5s en test
        with patch("app.modules.cv_parser.claude_client._call_claude_once", mock_call):
            with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                result = await parse_cv_with_claude("texte cv")

        assert result == _VALID_CV_DICT
        mock_sleep.assert_called_once_with(RATE_LIMIT_RETRY_DELAY_SECONDS)
        assert mock_call.call_count == 2

    async def test_rate_limit_twice_raises_claude_rate_limit_error(self):
        rate_limit_exc = anthropic.RateLimitError(
            "rate limit",
            response=MagicMock(status_code=429),
            body=None,
        )
        mock_call = AsyncMock(side_effect=[rate_limit_exc, rate_limit_exc])
        with patch("app.modules.cv_parser.claude_client._call_claude_once", mock_call):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                with pytest.raises(ClaudeRateLimitError):
                    await parse_cv_with_claude("texte cv")

        assert mock_call.call_count == 2

    async def test_rate_limit_retry_waits_configured_delay(self):
        rate_limit_exc = anthropic.RateLimitError(
            "rate limit",
            response=MagicMock(status_code=429),
            body=None,
        )
        mock_call = AsyncMock(side_effect=[rate_limit_exc, _VALID_CV_DICT])
        with patch("app.modules.cv_parser.claude_client._call_claude_once", mock_call):
            with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                await parse_cv_with_claude("texte cv")

        mock_sleep.assert_awaited_once_with(RATE_LIMIT_RETRY_DELAY_SECONDS)

    async def test_rate_limit_then_invalid_json_raises_invalid_json_error(self):
        rate_limit_exc = anthropic.RateLimitError(
            "rate limit",
            response=MagicMock(status_code=429),
            body=None,
        )
        mock_call = AsyncMock(side_effect=[rate_limit_exc, ValueError("JSON invalide")])
        with patch("app.modules.cv_parser.claude_client._call_claude_once", mock_call):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                with pytest.raises(InvalidJsonError):
                    await parse_cv_with_claude("texte cv")


# ---------------------------------------------------------------------------
# Tests — structure de l'appel Claude (prompt caching + paramètres modèle)
# ---------------------------------------------------------------------------


class TestCallClaudeOnceCachingAndParams:
    """Vérifie que _call_claude_once passe les bons paramètres à l'API Anthropic.

    Ces tests importent et appellent _call_claude_once directement en mockant
    le client anthropic pour inspecter les arguments passés à messages.create.
    """

    async def test_call_claude_uses_correct_model(self):
        from app.modules.cv_parser.claude_client import _call_claude_once

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='{"is_cv": true}')]

        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        await _call_claude_once(mock_client, "texte cv")

        call_kwargs = mock_client.messages.create.call_args.kwargs
        assert call_kwargs["model"] == MODEL_ID

    async def test_call_claude_uses_temperature_zero(self):
        from app.modules.cv_parser.claude_client import _call_claude_once

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='{"is_cv": true}')]
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        await _call_claude_once(mock_client, "texte cv")

        call_kwargs = mock_client.messages.create.call_args.kwargs
        assert call_kwargs["temperature"] == TEMPERATURE
        assert call_kwargs["temperature"] == 0

    async def test_call_claude_uses_correct_max_tokens(self):
        from app.modules.cv_parser.claude_client import _call_claude_once

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='{"is_cv": true}')]
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        await _call_claude_once(mock_client, "texte cv")

        call_kwargs = mock_client.messages.create.call_args.kwargs
        assert call_kwargs["max_tokens"] == MAX_TOKENS
        assert call_kwargs["max_tokens"] == 2500

    async def test_call_claude_has_cache_control_ephemeral_on_system(self):
        """Vérifie que le prompt caching est activé sur le SYSTEM_PROMPT.

        Critique pour les coûts : cache_control ephemeral sur le system
        permet un cache hit à partir du 2e appel (10x moins cher).
        """
        from app.modules.cv_parser.claude_client import _call_claude_once

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='{"is_cv": true}')]
        mock_client = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        await _call_claude_once(mock_client, "texte cv")

        call_kwargs = mock_client.messages.create.call_args.kwargs
        system_blocks = call_kwargs["system"]

        assert isinstance(system_blocks, list), "system doit être une liste de blocs"
        assert len(system_blocks) == 1

        block = system_blocks[0]
        assert block["type"] == "text"
        assert block["text"] == SYSTEM_PROMPT
        assert block["cache_control"] == {"type": "ephemeral"}, (
            "cache_control manquant ou incorrect — le prompt caching ne fonctionnera pas"
        )
