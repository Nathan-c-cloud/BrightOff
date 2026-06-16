"""Dépendances FastAPI pour les clients AWS.

Factoriser les clients boto3 ici permet de les overrider facilement
en test via app.dependency_overrides — sans toucher aux endpoints.
"""

import boto3

from app.core.config import settings


def get_s3_client():
    """Retourne un client boto3 S3 configuré sur la région du projet.

    Scope : par requête (pas de singleton global) — boto3 clients sont
    thread-safe mais pas safe entre event loops asyncio. Comme l'appel
    S3 est délégué à run_in_executor (thread pool), un client par requête
    évite tout partage entre threads concurrents.
    """
    return boto3.client("s3", region_name=settings.AWS_REGION)
