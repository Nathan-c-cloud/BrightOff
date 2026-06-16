"""Orchestrateur de parsing CV — S3-11.

trigger_parsing() est appelé en BackgroundTask FastAPI après un upload réussi.
Il s'exécute dans le même process mais après la fin de la requête HTTP.

IMPORTANT : on instancie une NOUVELLE AsyncSession via AsyncSessionLocal, car la session
de la requête HTTP est fermée (et commitée) avant que BackgroundTask ne s'exécute.
Utiliser la session de la requête provoquerait une erreur "session already closed".
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update

from app.core.aws import get_s3_client
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.modules.cv_parser.claude_client import (
    ClaudeRateLimitError,
    ClaudeTimeoutError,
    InvalidJsonError,
    parse_cv_with_claude,
)
from app.modules.cv_parser.extractors import (
    EmptyTextError,
    ExtractionError,
    download_from_s3_sync,
    extract_text,
)
from app.modules.cv_parser.models import CV
from app.modules.cv_parser.profile_builder import upsert_profile

log = logging.getLogger(__name__)


async def trigger_parsing(cv_id: uuid.UUID) -> None:
    """Orchestre le parsing d'un CV : download S3 → extraction texte → Claude → profil BDD.

    Séquence :
        1. Nouvelle AsyncSession (indépendante de la requête HTTP)
        2. Chargement du CV depuis la BDD
        3. Download S3 via run_in_executor (boto3 synchrone)
        4. Extraction texte via run_in_executor (pdfplumber/python-docx synchrones)
        5. Appel Claude async (parse_cv_with_claude)
        6. Vérification is_cv == true
        7. Upsert du profil en BDD
        8. UPDATE cv.parsing_status = "ready", cv.parsed_at = now()

    Sur toute exception : log + UPDATE parsing_status = "failed".
    """
    log.info("trigger_parsing: démarrage pour cv_id=%s", cv_id)

    async with AsyncSessionLocal() as db:
        try:
            # --- Étape 2 : chargement du CV ---
            result = await db.execute(select(CV).where(CV.id == cv_id))
            cv = result.scalar_one_or_none()

            if cv is None:
                log.error(
                    "trigger_parsing: cv_id=%s introuvable en BDD — parsing annulé.", cv_id
                )
                return

            user_id = cv.user_id
            s3_key = cv.s3_key
            file_format = cv.file_format

            # --- Étape 3 : download S3 ---
            s3_client = get_s3_client()
            loop = asyncio.get_running_loop()

            content: bytes = await loop.run_in_executor(
                None,
                download_from_s3_sync,
                s3_client,
                settings.S3_BUCKET_NAME,
                s3_key,
            )
            log.info(
                "trigger_parsing: fichier téléchargé depuis S3 — cv_id=%s key=%s (%d bytes)",
                cv_id,
                s3_key,
                len(content),
            )

            # --- Étape 4 : extraction texte ---
            cv_text: str = await loop.run_in_executor(
                None,
                extract_text,
                content,
                file_format,
            )
            log.info(
                "trigger_parsing: texte extrait — cv_id=%s format=%s chars=%d",
                cv_id,
                file_format,
                len(cv_text),
            )

            # --- Étape 5 : appel Claude ---
            parsed: dict = await parse_cv_with_claude(cv_text)

            # --- Étape 6 : vérification is_cv ---
            if not parsed.get("is_cv"):
                reason = parsed.get("reason", "non précisé")
                log.warning(
                    "trigger_parsing: document non reconnu comme CV — cv_id=%s reason=%r",
                    cv_id,
                    reason,
                )
                raise _NotACVError(f"Document non CV : {reason}")

            # --- Étape 7 : upsert profil ---
            profile = await upsert_profile(db=db, user_id=user_id, cv_id=cv_id, parsed=parsed)
            log.info(
                "trigger_parsing: profil upserted — profile_id=%s user_id=%s cv_id=%s",
                profile.id,
                user_id,
                cv_id,
            )

            # --- Étape 8 : UPDATE cv → ready ---
            await db.execute(
                update(CV)
                .where(CV.id == cv_id)
                .values(parsing_status="ready", parsed_at=datetime.now(UTC))
            )
            await db.commit()

            log.info(
                "trigger_parsing: parsing terminé avec succès — cv_id=%s status=ready", cv_id
            )

        except Exception as exc:
            # Rollback de tout ce qui était en cours (upsert profil notamment)
            await db.rollback()

            _log_parsing_error(cv_id, exc)

            # UPDATE séparé (nouvelle transaction) pour marquer le CV comme failed
            try:
                await db.execute(
                    update(CV)
                    .where(CV.id == cv_id)
                    .values(parsing_status="failed", parsed_at=datetime.now(UTC))
                )
                await db.commit()
            except Exception as update_exc:
                log.error(
                    "trigger_parsing: impossible de mettre à jour le statut failed"
                    " pour cv_id=%s : %s",
                    cv_id,
                    update_exc,
                    exc_info=True,
                )


# ---------------------------------------------------------------------------
# Exception interne (non-CV détecté par Claude)
# ---------------------------------------------------------------------------


class _NotACVError(Exception):
    """Document détecté comme non-CV par Claude — usage interne à trigger_parsing."""


# ---------------------------------------------------------------------------
# Helper de logging des erreurs
# ---------------------------------------------------------------------------


def _log_parsing_error(cv_id: uuid.UUID, exc: Exception) -> None:
    """Log l'erreur avec le niveau approprié selon le type d'exception."""
    if isinstance(exc, ExtractionError | EmptyTextError):
        log.warning(
            "trigger_parsing: échec extraction texte — cv_id=%s : %s",
            cv_id,
            exc,
        )
    elif isinstance(exc, ClaudeTimeoutError):
        log.error(
            "trigger_parsing: timeout Claude — cv_id=%s : %s",
            cv_id,
            exc,
        )
    elif isinstance(exc, ClaudeRateLimitError):
        log.error(
            "trigger_parsing: rate limit Claude persistant — cv_id=%s : %s",
            cv_id,
            exc,
        )
    elif isinstance(exc, InvalidJsonError):
        log.error(
            "trigger_parsing: JSON invalide après retry — cv_id=%s : %s",
            cv_id,
            exc,
        )
    elif isinstance(exc, _NotACVError):
        log.warning(
            "trigger_parsing: non-CV détecté — cv_id=%s : %s",
            cv_id,
            exc,
        )
    else:
        log.error(
            "trigger_parsing: erreur inattendue — cv_id=%s",
            cv_id,
            exc_info=True,
        )
