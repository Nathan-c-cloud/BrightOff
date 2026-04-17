from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import BaseModel

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
        400: {"description": "Format de fichier non supporté"},
        401: {"description": "JWT manquant, expiré ou invalide"},
        413: {"description": "Fichier trop volumineux"},
    },
)
async def upload_cv(file: Annotated[UploadFile, File(...)]) -> CVUploadResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
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
