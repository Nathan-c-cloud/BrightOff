"""Client Claude pour le parsing de CVs — S3-11.

Modèle : claude-haiku-4-5-20251001 (choix coût, benchmark validé sur 9 docs).
Prompt caching ephemeral sur le SYSTEM_PROMPT (>1024 tokens → économie 10x sur appels 2+).
temperature=0 pour un output déterministe. max_tokens=2500 (suffisant pour un profil complet).

Stratégie de retry :
- JSON invalide au 1er appel → 1 retry immédiat (même prompt, Claude peut se corriger)
- RateLimitError 429 → 1 retry après 5s
- Timeout ou APIError 5xx → fail immédiat (0 retry)
"""

from __future__ import annotations

import asyncio
import json
import logging
import re

import anthropic
import httpx

from app.core.config import settings
from app.modules.cv_parser.prompt import SYSTEM_PROMPT, build_user_message

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

MODEL_ID = "claude-haiku-4-5-20251001"
MAX_TOKENS = 2500
TEMPERATURE = 0
RATE_LIMIT_RETRY_DELAY_SECONDS = 5


# ---------------------------------------------------------------------------
# Exceptions typées
# ---------------------------------------------------------------------------


class ClaudeTimeoutError(Exception):
    """L'appel Claude a dépassé le délai maximum."""


class ClaudeRateLimitError(Exception):
    """Claude a retourné une erreur 429 (rate limit) même après le retry."""


class NotACVError(Exception):
    """Claude a déterminé que le document n'est pas un CV."""


class InvalidJsonError(Exception):
    """La réponse Claude ne contient pas de JSON valide après le retry."""


# ---------------------------------------------------------------------------
# Parseur JSON tolérant (3 passes — porté verbatim depuis le benchmark)
# ---------------------------------------------------------------------------


def _extract_json_from_response(raw_text: str) -> dict:
    """Extrait un objet JSON depuis une réponse Claude potentiellement enveloppée en markdown.

    Stratégie en 3 passes :
    1. Tentative directe (réponse déjà propre — cas nominal)
    2. Extraction depuis un bloc ```json ... ``` ou ``` ... ``` (Haiku wrappe parfois)
    3. Extraction par premier { ... dernier } (JSON inline avec texte autour)

    Lève ValueError si aucune passe ne réussit.
    """
    stripped = raw_text.strip()

    # Passe 1 — JSON brut
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Passe 2 — bloc markdown ```json ... ``` ou ``` ... ```
    match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", stripped, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Passe 3 — premier { ... dernier } (JSON inline avec préambule/postambule)
    first_brace = stripped.find("{")
    last_brace = stripped.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        try:
            return json.loads(stripped[first_brace : last_brace + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError("Aucun JSON valide trouvé dans la réponse Claude")


# ---------------------------------------------------------------------------
# Appel Claude (avec prompt caching)
# ---------------------------------------------------------------------------


async def _call_claude_once(client: anthropic.AsyncAnthropic, cv_text: str) -> dict:
    """Effectue un appel Claude et retourne le dict parsé.

    Lève ValueError si le JSON est invalide.
    Lève httpx.TimeoutException si Claude ne répond pas à temps.
    Lève anthropic.RateLimitError si 429.
    Lève anthropic.APIStatusError pour les erreurs 5xx.
    """
    user_message = build_user_message(cv_text)

    response = await client.messages.create(
        model=MODEL_ID,
        max_tokens=MAX_TOKENS,
        temperature=TEMPERATURE,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                # Prompt caching : le SYSTEM_PROMPT est identique à chaque appel
                # → Anthropic le met en cache après le 1er appel (cache_creation)
                # → appels suivants : 10x moins cher (cache_read)
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_message}],
    )

    raw_text = response.content[0].text
    return _extract_json_from_response(raw_text)


# ---------------------------------------------------------------------------
# Fonction publique
# ---------------------------------------------------------------------------


async def parse_cv_with_claude(cv_text: str) -> dict:
    """Parse un CV via Claude et retourne le profil structuré en dict.

    Gère :
    - 1 retry si JSON invalide au 1er appel
    - 1 retry après 5s si RateLimitError 429
    - Fail immédiat sur timeout ou APIError 5xx (0 retry)

    Retourne le dict parsé (is_cv, title, summary, skills, experiences, education, languages).

    Lève :
        ClaudeTimeoutError : si httpx.TimeoutException
        ClaudeRateLimitError : si 429 même après retry
        InvalidJsonError : si JSON invalide après retry
        anthropic.APIStatusError : si erreur 5xx Claude (propagée telle quelle)
    """
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    # --- 1er appel ---
    try:
        parsed = await _call_claude_once(client, cv_text)
        log.info("parse_cv_with_claude: 1er appel OK (model=%s)", MODEL_ID)
        return parsed

    except httpx.TimeoutException as exc:
        log.error("parse_cv_with_claude: timeout sur l'appel Claude — %s", exc)
        raise ClaudeTimeoutError("L'appel Claude a dépassé le délai maximum.") from exc

    except anthropic.RateLimitError:
        # 429 → 1 retry après 5s
        log.warning(
            "parse_cv_with_claude: RateLimitError 429 au 1er appel, retry dans %ds.",
            RATE_LIMIT_RETRY_DELAY_SECONDS,
        )
        await asyncio.sleep(RATE_LIMIT_RETRY_DELAY_SECONDS)
        try:
            parsed = await _call_claude_once(client, cv_text)
            log.info("parse_cv_with_claude: retry rate limit OK.")
            return parsed
        except anthropic.RateLimitError as exc2:
            log.error("parse_cv_with_claude: RateLimitError persistante après retry.")
            raise ClaudeRateLimitError(
                "Claude retourne 429 en permanence — réessayer plus tard."
            ) from exc2
        except ValueError as exc2:
            log.error(
                "parse_cv_with_claude: JSON invalide au retry (rate limit path) — %s", exc2
            )
            raise InvalidJsonError(
                "JSON invalide après retry (suite rate limit)."
            ) from exc2

    except ValueError as exc:
        # JSON invalide au 1er appel → 1 retry immédiat
        log.warning(
            "parse_cv_with_claude: JSON invalide au 1er appel (%s), retry immédiat.", exc
        )
        try:
            parsed = await _call_claude_once(client, cv_text)
            log.info("parse_cv_with_claude: retry JSON OK.")
            return parsed
        except ValueError as exc2:
            log.error("parse_cv_with_claude: JSON invalide après retry — abandon.")
            raise InvalidJsonError(
                "La réponse Claude ne contient pas de JSON valide après retry."
            ) from exc2
        except httpx.TimeoutException as exc2:
            log.error("parse_cv_with_claude: timeout sur le retry JSON.")
            raise ClaudeTimeoutError("Timeout Claude sur le retry JSON.") from exc2
