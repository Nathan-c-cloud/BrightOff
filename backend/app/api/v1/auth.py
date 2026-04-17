from datetime import datetime
from uuid import UUID

import google.auth.exceptions
import google.auth.transport.requests
import google.oauth2.id_token
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.auth import jwt, password, service
from app.modules.auth.jwt import JWTError
from app.modules.auth.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

_bearer_scheme = HTTPBearer()


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
async def register(
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> TokenResponse:
    existing_user = await service.get_user_by_email(db, payload.email)
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    hashed_password = password.hash_password(payload.password)
    user = await service.create_user_email(db, payload.email, hashed_password)

    access_token = jwt.create_access_token({"sub": user.email})

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
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
async def login(
    payload: UserLoginRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> TokenResponse:
    user = await service.get_user_by_email(db, payload.email)

    # Message générique intentionnel : ne pas distinguer "email inconnu" de
    # "mot de passe incorrect" pour éviter l'énumération de comptes (OWASP).
    # Le cas hashed_password is None couvre les comptes Google-only sans password.
    _invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )

    if user is None or user.hashed_password is None:
        raise _invalid

    if not password.verify_password(payload.password, user.hashed_password):
        raise _invalid

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled",
        )

    access_token = jwt.create_access_token({"sub": user.email})

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
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
async def google_auth(
    payload: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> TokenResponse:
    # Vérification du token Google via la bibliothèque officielle google-auth.
    # ValueError est levée si le token est invalide, expiré ou si l'audience ne
    # correspond pas au Client ID. GoogleAuthError couvre les erreurs d'issuer.
    try:
        google_request = google.auth.transport.requests.Request()
        id_info = google.oauth2.id_token.verify_oauth2_token(
            payload.google_token,
            google_request,
            settings.GOOGLE_CLIENT_ID,
        )
    except (ValueError, google.auth.exceptions.GoogleAuthError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token Google invalide",
        ) from None

    email: str = id_info["email"]
    oauth_id: str = id_info["sub"]

    user = await service.create_or_get_user_google(db, email, oauth_id)

    access_token = jwt.create_access_token({"sub": user.email})

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
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
async def refresh_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),  # noqa: B008
) -> TokenResponse:
    _invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
    )

    try:
        payload = jwt.decode_token(credentials.credentials)
    except JWTError:
        raise _invalid from None

    # Empêche l'utilisation d'un access token comme refresh token.
    if payload.get("type") != "refresh":
        raise _invalid

    sub: str | None = payload.get("sub")
    if sub is None:
        raise _invalid

    access_token = jwt.create_access_token({"sub": sub})

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
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
async def get_me(
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> UserMeResponse:
    return UserMeResponse(
        id=current_user.id,
        email=current_user.email,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
    )
