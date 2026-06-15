"""Service d'upload de CV — S3-10.

Séquence atomique validée par l'architecte :
    1. Validation du fichier (taille, MIME magic bytes, filename)
    2. Vérification rate limit (10 uploads / user / 24h)
    3. INSERT cvs (parsing_status="uploading") en BDD
    4. PutObject S3
    5. UPDATE parsing_status="parsing"
    6. Rollback BDD (DELETE) si l'étape 4 échoue

L'appel S3 (synchrone boto3) est exécuté via asyncio.get_event_loop().run_in_executor
pour ne pas bloquer la boucle d'événements FastAPI.
"""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from datetime import UTC, datetime, timedelta

import filetype
from fastapi import UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.cv_parser.models import CV

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
CHUNK_SIZE = 64 * 1024  # 64 KB par chunk (lecture anti-surcharge RAM)
RATE_LIMIT_COUNT = 10
RATE_LIMIT_WINDOW_HOURS = 24

# Extensions acceptées et leurs types MIME correspondants (vérifiés par magic bytes)
ALLOWED_MIME_TYPES: dict[str, str] = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    # application/zip correspond au format OOXML (DOCX) avant identification précise
    "application/zip": "docx",
}

# Regex pour valider le filename original (audit sécurité, point 4)
# \w avec flag UNICODE inclut [a-zA-Z0-9_] + lettres accentuées latines (é, è, ç, ñ...)
# nécessaires pour une app francophone, sans ouvrir aux caractères dangereux (/, \, \x00, <, >, etc.)
_FILENAME_RE = re.compile(r"^[\w .\-]{1,200}$", re.UNICODE)


# ---------------------------------------------------------------------------
# Exceptions métier
# ---------------------------------------------------------------------------


class FileTooLargeError(Exception):
    """Le fichier dépasse la limite de 5 MB."""


class InvalidFileTypeError(Exception):
    """Le type MIME détecté par magic bytes n'est pas PDF ou DOCX."""


class InvalidFilenameError(Exception):
    """Le nom de fichier contient des caractères non autorisés."""


class RateLimitExceededError(Exception):
    """L'utilisateur a atteint la limite de 10 uploads en 24h."""


class S3UploadError(Exception):
    """Erreur lors du transfert du fichier vers S3."""


# ---------------------------------------------------------------------------
# Helpers internes
# ---------------------------------------------------------------------------


async def _validate_file(file: UploadFile) -> tuple[bytes, str]:
    """Lit le fichier par chunks, vérifie la taille et les magic bytes.

    Retourne (content_bytes, file_format) où file_format est "pdf" ou "docx".

    Lève :
        FileTooLargeError : si > 5 MB
        InvalidFileTypeError : si les magic bytes ne correspondent pas à PDF/DOCX
        InvalidFilenameError : si le fichier est vide (0 octets)
    """
    chunks: list[bytes] = []
    total = 0

    while True:
        chunk = await file.read(CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_FILE_SIZE_BYTES:
            raise FileTooLargeError(
                f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB"
            )
        chunks.append(chunk)

    if total == 0:
        raise InvalidFilenameError("File is empty")

    content = b"".join(chunks)

    # Détection par magic bytes — on passe les 261 premiers octets (max nécessaire pour filetype)
    detected = filetype.guess(content[:261])

    if detected is None or detected.mime not in ALLOWED_MIME_TYPES:
        mime_str = detected.mime if detected else "unknown"
        raise InvalidFileTypeError(
            f"File type '{mime_str}' is not supported. Only PDF and DOCX are accepted."
        )

    return content, ALLOWED_MIME_TYPES[detected.mime]


def _sanitize_filename(filename: str | None) -> str:
    """Valide et nettoie le nom de fichier original.

    - Retire les préfixes de chemin (basename uniquement)
    - Vérifie la regex ^[a-zA-Z0-9 ._-]{1,200}$
    - Lève InvalidFilenameError si le nom contient des caractères interdits
      (null bytes, path traversal, caractères spéciaux)

    La clé S3 n'est JAMAIS dérivée de ce nom — ce nettoyage s'applique
    uniquement à la colonne original_filename en BDD (pour affichage).
    """
    if not filename:
        return "cv_upload"

    # Null bytes : toujours rejeter explicitement (contournement de validation)
    if "\x00" in filename:
        raise InvalidFilenameError("Filename contains null bytes")

    # Extraire uniquement le nom de fichier (défense path traversal)
    import os

    basename = os.path.basename(filename)

    if not basename:
        return "cv_upload"

    if not _FILENAME_RE.match(basename):
        raise InvalidFilenameError(
            f"Filename '{basename}' contains invalid characters. "
            "Only alphanumeric, spaces, dots, underscores and hyphens are allowed."
        )

    return basename[:200]


def build_s3_key(user_id: uuid.UUID, cv_id: uuid.UUID, ext: str) -> str:
    """Construit la clé S3 server-side.

    Format : cvs/{user_id}/{cv_id}.{ext}
    Le filename utilisateur n'entre jamais dans la clé S3.
    """
    return f"cvs/{user_id}/{cv_id}.{ext}"


async def _check_rate_limit(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Vérifie que l'utilisateur n'a pas dépassé 10 uploads en 24h.

    Requête COUNT sur la table cvs avec index sur (user_id, created_at).
    Pas de Redis nécessaire pour 1-10 users MVP.

    Lève RateLimitExceededError si la limite est atteinte.
    """
    window_start = datetime.now(UTC) - timedelta(hours=RATE_LIMIT_WINDOW_HOURS)

    stmt = select(func.count(CV.id)).where(
        CV.user_id == user_id,
        CV.created_at > window_start,
    )
    result = await db.execute(stmt)
    count = result.scalar_one()

    if count >= RATE_LIMIT_COUNT:
        raise RateLimitExceededError(
            f"Upload limit reached: {RATE_LIMIT_COUNT} uploads per {RATE_LIMIT_WINDOW_HOURS}h. "
            f"Current count: {count}"
        )


def _upload_to_s3_sync(s3_client, bucket: str, key: str, body: bytes) -> None:
    """Upload synchrone S3 via boto3 PutObject.

    Conçu pour être appelé via run_in_executor (thread pool FastAPI).
    Ne pas appeler directement depuis du code async.

    Lève S3UploadError en cas d'erreur boto3.
    """
    try:
        s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=body,
        )
    except Exception as exc:
        raise S3UploadError(f"S3 PutObject failed for key '{key}': {exc}") from exc


# ---------------------------------------------------------------------------
# Fonction principale
# ---------------------------------------------------------------------------


async def upload_cv(
    db: AsyncSession,
    s3_client,
    user_id: uuid.UUID,
    file: UploadFile,
    bucket_name: str,
) -> CV:
    """Upload atomique d'un CV : validation → INSERT BDD → S3 → UPDATE BDD.

    Séquence :
        1. Valider le fichier (taille + magic bytes) et le filename
        2. Vérifier le rate limit
        3. INSERT cvs (parsing_status="uploading") — rollback S3 possible
        4. PutObject S3 dans run_in_executor
        5. UPDATE parsing_status="parsing"
        6. Si S3 fail → logger + DELETE BDD (rollback explicite)

    Retourne l'objet CV avec parsing_status="parsing".
    Lève FileTooLargeError, InvalidFileTypeError, InvalidFilenameError,
    RateLimitExceededError, S3UploadError selon le cas d'échec.
    """
    # Étape 1 : lire le fichier en RAM et valider (taille + magic bytes)
    # On lit AVANT d'ouvrir la transaction pour ne pas tenir une transaction
    # ouverte pendant les I/O réseau du client.
    content, file_format = await _validate_file(file)

    # Étape 1b : valider et nettoyer le filename original
    safe_filename = _sanitize_filename(file.filename)

    # Étape 2 : rate limit
    await _check_rate_limit(db, user_id)

    # Étape 3 : INSERT BDD avec parsing_status="uploading"
    cv_id = uuid.uuid4()
    s3_key = build_s3_key(user_id, cv_id, file_format)

    cv = CV(
        id=cv_id,
        user_id=user_id,
        s3_key=s3_key,
        original_filename=safe_filename,
        file_format=file_format,
        parsing_status="uploading",  # explicite, pas de default
    )
    db.add(cv)
    await db.flush()  # persiste en BDD sans commit (rollback encore possible)

    # Étape 4 : upload S3 via thread pool (boto3 est synchrone)
    loop = asyncio.get_event_loop()
    s3_success = False
    try:
        await loop.run_in_executor(
            None,
            _upload_to_s3_sync,
            s3_client,
            bucket_name,
            s3_key,
            content,
        )
        s3_success = True
    except S3UploadError as exc:
        log.error(
            "S3 upload failed for cv_id=%s user_id=%s key=%s — rolling back DB insert. Cause: %s",
            cv_id,
            user_id,
            s3_key,
            exc,
            exc_info=True,
        )
        raise
    finally:
        # Rollback conditionnel : uniquement si S3 a échoué
        if not s3_success:
            await db.execute(delete(CV).where(CV.id == cv_id))
            await db.flush()

    # Étape 5 : UPDATE parsing_status="parsing"
    cv.parsing_status = "parsing"
    await db.flush()

    log.info(
        "CV uploaded successfully: cv_id=%s user_id=%s s3_key=%s format=%s",
        cv_id,
        user_id,
        s3_key,
        file_format,
    )

    return cv
