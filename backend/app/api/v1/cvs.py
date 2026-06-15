from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.aws import get_s3_client
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.auth.models import User
from app.modules.cv_parser import service as cv_service
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
    response_model=CVResponse,
    status_code=status.HTTP_200_OK,
    summary="Statut et métadonnées d'un CV",
    description="Retourne les métadonnées et le statut de parsing d'un CV spécifique.",
    responses={
        401: {"description": "JWT manquant, expiré ou invalide"},
        404: {"description": "CV introuvable"},
    },
)
async def get_cv(cv_id: UUID) -> CVResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )


@router.get(
    "",
    response_model=CVListResponse,
    status_code=status.HTTP_200_OK,
    summary="Liste des CVs de l'utilisateur",
    description=(
        "Liste tous les CVs uploadés par l'utilisateur courant, "
        "triés par date de création décroissante."
    ),
    responses={
        401: {"description": "JWT manquant, expiré ou invalide"},
    },
)
async def list_cvs() -> CVListResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )
