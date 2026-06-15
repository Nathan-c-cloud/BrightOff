"""Tâches asynchrones du module cv_parser — stub S3-10, implémentation S3-11.

Ce module expose trigger_parsing(), couche d'abstraction entre l'endpoint
d'upload et le déclenchement réel du parsing. Cela permet à S3-11 de
remplacer le stub par un appel Claude API sans toucher à l'endpoint.
"""

from __future__ import annotations

import logging
import uuid

log = logging.getLogger(__name__)


async def trigger_parsing(cv_id: uuid.UUID) -> None:
    """Déclenche le parsing d'un CV après upload réussi.

    STUB S3-10 — sera remplacé en S3-11 par l'appel Claude API
    (pdfplumber/python-docx → extraction texte → Claude → profil).

    Si cette tâche BackgroundTask crashe, le CV reste en
    parsing_status='parsing'. Un job de cleanup futur pourra
    détecter les CVs bloqués en 'parsing' depuis > N minutes
    et les passer en 'error' pour permettre un retry utilisateur.
    """
    log.info("trigger_parsing: STUB — cv_id=%s sera traité en S3-11", cv_id)
