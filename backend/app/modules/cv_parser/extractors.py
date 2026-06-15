"""Extraction de texte depuis des fichiers CV (PDF, DOCX) — S3-11.

Les fonctions d'extraction sont synchrones (pdfplumber et python-docx bloquent)
et doivent TOUJOURS être appelées via run_in_executor depuis du code async.

download_from_s3_sync suit la même contrainte : boto3 est synchrone.
"""

from __future__ import annotations

import io
import logging

import docx
import pdfplumber

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exceptions typées
# ---------------------------------------------------------------------------


class ExtractionError(Exception):
    """Erreur lors de l'extraction du texte (fichier chiffré, corrompu, format inconnu)."""


class EmptyTextError(Exception):
    """Le fichier est valide mais ne contient aucun texte extractible (ex: PDF scanné)."""


# ---------------------------------------------------------------------------
# Download S3 synchrone
# ---------------------------------------------------------------------------


def download_from_s3_sync(s3_client, bucket: str, key: str) -> bytes:
    """Télécharge un objet S3 et retourne son contenu en bytes.

    Conçu pour être appelé via run_in_executor (boto3 est synchrone).
    Ne pas appeler directement depuis du code async.

    Lève ExtractionError si le téléchargement échoue.
    """
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()
    except Exception as exc:
        raise ExtractionError(f"Échec du téléchargement S3 pour la clé '{key}': {exc}") from exc


# ---------------------------------------------------------------------------
# Extraction de texte
# ---------------------------------------------------------------------------


def extract_text_pdf(content: bytes) -> str:
    """Extrait le texte d'un PDF via pdfplumber.

    pdfplumber reconstruit les lignes depuis les positions des glyphes,
    ce qui gère mieux les CVs multi-colonnes que PyPDF2.

    Lève ExtractionError si le PDF est chiffré ou corrompu.
    Lève EmptyTextError si aucune page ne contient de texte extractible.
    """
    try:
        pages_text: list[str] = []
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
    except Exception as exc:
        raise ExtractionError(f"Impossible d'ouvrir le PDF (chiffré ou corrompu) : {exc}") from exc

    result = "\n\n".join(pages_text)
    if not result.strip():
        raise EmptyTextError(
            "Le PDF ne contient aucun texte extractible (PDF scanné ou image uniquement)."
        )
    return result


def extract_text_docx(content: bytes) -> str:
    """Extrait le texte d'un fichier DOCX via python-docx.

    Lève ExtractionError si le DOCX est corrompu ou illisible.
    Lève EmptyTextError si le document ne contient aucun paragraphe non vide.
    """
    try:
        doc = docx.Document(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    except Exception as exc:
        raise ExtractionError(f"Impossible d'ouvrir le DOCX (corrompu) : {exc}") from exc

    result = "\n".join(paragraphs)
    if not result.strip():
        raise EmptyTextError("Le DOCX ne contient aucun paragraphe non vide.")
    return result


def extract_text(content: bytes, file_format: str) -> str:
    """Dispatcher : extrait le texte selon le format détecté lors de l'upload.

    Args:
        content: Contenu binaire du fichier.
        file_format: "pdf" ou "docx" (valeur stockée en BDD lors de l'upload).

    Lève ExtractionError si le format n'est pas supporté ou si l'extraction échoue.
    Lève EmptyTextError si le fichier ne contient aucun texte.
    """
    if file_format == "pdf":
        return extract_text_pdf(content)
    if file_format == "docx":
        return extract_text_docx(content)
    raise ExtractionError(
        f"Format '{file_format}' non supporté. Seuls 'pdf' et 'docx' sont acceptés."
    )
