from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.aws import get_s3_client
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.auth.models import User
from app.modules.cv_parser import service as cv_service
from app.modules.cv_parser.models import CV
from app.modules.cv_parser.service import (
    FileTooLargeError,
    InvalidFilenameError,
    InvalidFileTypeError,
    RateLimitExceededError,
    S3UploadError,
)
from app.modules.cv_parser.tasks import trigger_parsing

router = APIRouter(prefix="/cvs", tags=["cvs"])


# ---------- Schemas ----------


class CVUploadResponse(BaseModel):
    id: UUID
    filename: str
    status: str
    uploaded_at: datetime


class CVResponse(BaseModel):
    id: UUID
    filename: str
    file_format: str
    parsing_status: str
    uploaded_at: datetime
    parsed_at: datetime | None = None


class CVListResponse(BaseModel):
    items: list[CVResponse]
    total: int


class CVStatusResponse(BaseModel):
    """Réponse du polling GET /cvs/{cv_id} (S3-13)."""

    id: UUID
    original_filename: str
    file_format: str
    parsing_status: str
    created_at: datetime
    parsed_at: datetime | None = None


# ---------- Routes ----------


@router.post(
    "/upload",
    response_model=CVUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload un CV",
    description=(
        "Upload un CV au format PDF ou DOCX. Le fichier est stocké sur S3 "
        "et l'analyse par Claude est déclenchée en arrière-plan. "
        "Le statut de parsing peut être suivi via GET /cvs/{cv_id}."
    ),
    responses={
        400: {"description": "Fichier vide ou nom de fichier invalide"},
        401: {"description": "JWT manquant, expiré ou invalide"},
        413: {"description": "Fichier trop volumineux (> 5 MB)"},
        415: {"description": "Format non supporté (uniquement PDF ou DOCX)"},
        429: {"description": "Limite d'upload atteinte (10 par 24h)"},
        500: {"description": "Erreur lors du transfert vers S3"},
    },
)
async def upload_cv(
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File(...)],
    current_user: User = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    s3_client=Depends(get_s3_client),  # noqa: B008
) -> CVUploadResponse:
    """Upload un CV et déclenche le parsing en arrière-plan."""
    try:
        cv = await cv_service.upload_cv(
            db=db,
            s3_client=s3_client,
            user_id=current_user.id,
            file=file,
            bucket_name=settings.S3_BUCKET_NAME,
        )
    except InvalidFilenameError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except FileTooLargeError as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(exc),
        ) from exc
    except InvalidFileTypeError as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=str(exc),
        ) from exc
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        ) from exc
    except S3UploadError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store CV. Please try again later.",
        ) from exc

    background_tasks.add_task(trigger_parsing, cv.id)

    return CVUploadResponse(
        id=cv.id,
        filename=cv.original_filename,
        status=cv.parsing_status,
        uploaded_at=cv.created_at,
    )


@router.get(
    "/{cv_id}",
    response_model=CVStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Statut et métadonnées d'un CV",
    description=(
        "Retourne les métadonnées et le statut de parsing d'un CV spécifique. "
        "Utilisé pour le polling côté frontend (toutes les 2s) jusqu'à ce que "
        "parsing_status soit 'ready' ou 'failed'."
    ),
    responses={
        401: {"description": "JWT manquant, expiré ou invalide"},
        403: {"description": "Le CV existe mais appartient à un autre utilisateur"},
        404: {"description": "CV introuvable"},
    },
)
async def get_cv(
    cv_id: UUID,
    current_user: User = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> CVStatusResponse:
    """Retourne les métadonnées et le statut de parsing du CV demandé.

    Stratégie d'autorisation :
    - Query principale filtrée sur id ET user_id → 0 ou 1 résultat.
    - Si 0 résultat : 2e query légère sur id seul pour distinguer 404 (inexistant)
      et 403 (existe mais appartient à un autre user).
    """
    result = await db.execute(
        select(CV).where(CV.id == cv_id, CV.user_id == current_user.id)
    )
    cv = result.scalar_one_or_none()

    if cv is not None:
        return CVStatusResponse(
            id=cv.id,
            original_filename=cv.original_filename,
            file_format=cv.file_format,
            parsing_status=cv.parsing_status,
            created_at=cv.created_at,
            parsed_at=cv.parsed_at,
        )

    # Distinguer 404 (inexistant) et 403 (existe, autre propriétaire)
    exists_result = await db.execute(select(CV.id).where(CV.id == cv_id))
    exists = exists_result.scalar_one_or_none()

    if exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CV not found",
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied",
    )


@router.get(
    "",
    response_model=CVListResponse,
    status_code=status.HTTP_200_OK,
    summary="Liste des CVs de l'utilisateur",
    description=(
        "Liste les CVs uploadés par l'utilisateur courant, "
        "triés par date de création décroissante (plus récent en premier). "
        "Limité à 10 résultats. Utilisé par le dashboard pour détecter un CV "
        "en cours de parsing et relancer le polling."
    ),
    responses={
        401: {"description": "JWT manquant, expiré ou invalide"},
    },
)
async def list_cvs(
    current_user: User = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    limit: int = Query(default=10, ge=1, le=50),  # noqa: B008
) -> CVListResponse:
    """Liste les CVs de l'utilisateur authentifié, triés par created_at DESC."""
    from sqlalchemy import desc

    result = await db.execute(
        select(CV)
        .where(CV.user_id == current_user.id)
        .order_by(desc(CV.created_at))
        .limit(limit)
    )
    cvs = result.scalars().all()

    items = [
        CVResponse(
            id=cv.id,
            filename=cv.original_filename,
            file_format=cv.file_format,
            parsing_status=cv.parsing_status,
            uploaded_at=cv.created_at,
            parsed_at=cv.parsed_at,
        )
        for cv in cvs
    ]

    return CVListResponse(items=items, total=len(items))
