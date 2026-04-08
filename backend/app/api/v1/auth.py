from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------- Schemas ----------


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    google_token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserMeResponse(BaseModel):
    id: UUID
    email: str
    is_active: bool
    created_at: datetime


# ---------- Routes ----------


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un nouveau compte utilisateur",
    description=(
        "Crée un nouveau compte utilisateur avec email et mot de passe. "
        "Retourne un JWT utilisable pour les requêtes authentifiées."
    ),
    responses={
        409: {"description": "Un compte avec cet email existe déjà"},
        422: {"description": "Données invalides (email mal formé, mot de passe trop court)"},
    },
)
async def register(payload: UserRegisterRequest) -> TokenResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Connexion email/password",
    description=(
        "Authentifie un utilisateur existant avec email et mot de passe. Retourne un JWT."
    ),
    responses={
        401: {"description": "Email ou mot de passe invalide"},
    },
)
async def login(payload: UserLoginRequest) -> TokenResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )


@router.post(
    "/google",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Connexion via Google OAuth",
    description=(
        "Authentifie via Google OAuth. Si l'utilisateur n'existe pas, "
        "un compte est créé automatiquement."
    ),
    responses={
        401: {"description": "Token Google invalide"},
    },
)
async def google_auth(payload: GoogleAuthRequest) -> TokenResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Renouveler le JWT",
    description=("Renouvelle le JWT de l'utilisateur connecté. Nécessite un JWT valide."),
    responses={
        401: {"description": "JWT manquant, expiré ou invalide"},
    },
)
async def refresh_token() -> TokenResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )


@router.get(
    "/me",
    response_model=UserMeResponse,
    status_code=status.HTTP_200_OK,
    summary="Info de l'utilisateur connecté",
    description="Retourne les informations du compte utilisateur courant.",
    responses={
        401: {"description": "JWT manquant, expiré ou invalide"},
    },
)
async def get_me() -> UserMeResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented",
    )
