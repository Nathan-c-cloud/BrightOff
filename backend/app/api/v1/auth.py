import re
from datetime import UTC, datetime
from uuid import UUID

import google.auth.exceptions
import google.auth.transport.requests
import google.oauth2.id_token
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limiter import limiter
from app.core.security import get_current_user
from app.modules.auth import jwt, password, service
from app.modules.auth.jwt import JWTError
from app.modules.auth.models import User
from app.modules.auth.refresh_token_model import RefreshToken
from app.modules.auth.service import EmailAlreadyRegisteredError


async def _no_store_cache(response: Response) -> None:
    """Dépendance FastAPI — injecte Cache-Control: no-store sur les réponses auth.

    Empêche la mise en cache des tokens JWT par les proxies et navigateurs.
    Appliquée uniquement sur /api/v1/auth/* : les futures routes /matches et
    /offers peuvent légitimement bénéficier du cache client-side.
    """
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(
    prefix="/auth",
    tags=["auth"],
    dependencies=[Depends(_no_store_cache)],  # noqa: B008
)

_bearer_scheme = HTTPBearer()


# ---------- Schemas ----------


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        """Valide la complexité du mot de passe.

        Règles (compromis UX / sécurité — pas de symbole obligatoire) :
        - Au moins 10 caractères (géré par Field.min_length avant ce validator)
        - Au moins 1 lettre majuscule
        - Au moins 1 lettre minuscule
        - Au moins 1 chiffre
        """
        if not re.search(r"[A-Z]", v):
            raise ValueError(
                "Le mot de passe doit contenir au moins 10 caractères, "
                "dont 1 majuscule, 1 minuscule et 1 chiffre."
            )
        if not re.search(r"[a-z]", v):
            raise ValueError(
                "Le mot de passe doit contenir au moins 10 caractères, "
                "dont 1 majuscule, 1 minuscule et 1 chiffre."
            )
        if not re.search(r"\d", v):
            raise ValueError(
                "Le mot de passe doit contenir au moins 10 caractères, "
                "dont 1 majuscule, 1 minuscule et 1 chiffre."
            )
        return v


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    google_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserMeResponse(BaseModel):
    id: UUID
    email: str
    is_active: bool
    created_at: datetime


class LogoutRequest(BaseModel):
    refresh_token: str


# ---------- Helpers internes ----------


async def _emit_token_pair(
    db: AsyncSession,
    user: User,
) -> TokenResponse:
    """Émet une paire access + refresh token et persiste le refresh en base.

    Centralise la logique d'émission pour éviter la duplication entre
    /register, /login, /google et /refresh.
    """
    access_token = jwt.create_access_token({"sub": user.email})
    refresh_token_str, jti, expires_at = jwt.create_refresh_token({"sub": user.email})

    await service.store_refresh_token(
        db=db,
        jti=jti,
        user_id=user.id,
        expires_at=expires_at,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token_str,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


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
        422: {"description": "Données invalides (email mal formé, mot de passe trop court ou trop simple)"},
        429: {"description": "Trop de tentatives — réessayez dans 1 minute"},
    },
)
@limiter.limit("3/minute")
async def register(
    request: Request,
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> TokenResponse:
    hashed_password = password.hash_password(payload.password)
    try:
        user = await service.create_user_email(db, payload.email, hashed_password)
    except EmailAlreadyRegisteredError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from None

    return await _emit_token_pair(db, user)


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
        429: {"description": "Trop de tentatives — réessayez dans 1 minute"},
    },
)
@limiter.limit("5/minute")
async def login(
    request: Request,
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

    return await _emit_token_pair(db, user)


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
        401: {"description": "Token Google invalide ou email non vérifié"},
        409: {"description": "Un compte avec cet email existe déjà (autre provider)"},
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

    # Refuser les tokens dont l'email n'a pas été vérifié par Google.
    if not id_info.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google email not verified",
        )

    email: str = id_info["email"]
    oauth_id: str = id_info["sub"]

    try:
        user = await service.create_or_get_user_google(db, email, oauth_id)
    except EmailAlreadyRegisteredError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please sign in with your password.",
        ) from None

    return await _emit_token_pair(db, user)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Renouveler le JWT",
    description=(
        "Renouvelle la paire de tokens à partir d'un refresh token valide. "
        "Rotation effective : l'ancien refresh token est immédiatement invalidé. "
        "Fournir le refresh token (et non l'access token) dans le header Authorization: Bearer."
    ),
    responses={
        401: {"description": "Refresh token manquant, expiré, révoqué ou invalide"},
        403: {"description": "Header Authorization absent (Bearer requis)"},
        429: {"description": "Trop de tentatives — réessayez dans 1 minute"},
    },
)
@limiter.limit("20/minute")
async def refresh_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
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
    jti_str: str | None = payload.get("jti")
    if sub is None or jti_str is None:
        raise _invalid

    # Vérification en base : le token doit exister, ne pas être révoqué, et ne pas être expiré.
    # L'expiration JWT est déjà vérifiée par decode_token() (claim "exp"),
    # mais on vérifie aussi expires_at en base pour couvrir l'edge case d'une
    # horloge serveur déphasée ou d'un token généré avant une migration.
    try:
        jti = UUID(jti_str)
    except ValueError:
        raise _invalid from None

    stored: RefreshToken | None = await service.get_refresh_token(db, jti)
    if stored is None or stored.revoked:
        raise _invalid
    # stored.expires_at est timezone-aware (DateTime(timezone=True) → asyncpg renvoie UTC).
    # On normalise en UTC pour garantir la comparaison même si le tzinfo diffère.
    expires_at_utc = stored.expires_at.astimezone(UTC)
    if expires_at_utc < datetime.now(UTC):
        raise _invalid

    # Vérifier que l'utilisateur existe encore et est actif : un compte désactivé
    # ne doit pas pouvoir renouveler ses tokens pendant toute la durée du refresh token.
    user = await service.get_user_by_email(db, sub)
    if user is None:
        raise _invalid

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled",
        )

    # Rotation atomique : révoquer l'ancien token AVANT d'émettre le nouveau.
    # Si la transaction est annulée (exception après ce point), l'ancien token
    # reste valide — comportement sûr (pas de token perdu pour l'utilisateur).
    await service.revoke_refresh_token(db, jti)

    return await _emit_token_pair(db, user)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Déconnexion — invalider le refresh token",
    description=(
        "Révoque le refresh token fourni en body. "
        "L'access token existant reste valide jusqu'à son expiration naturelle (15 min). "
        "Le client doit supprimer les deux tokens de son stockage local."
    ),
    responses={
        400: {"description": "Refresh token manquant ou malformé"},
        204: {"description": "Déconnexion réussie"},
    },
)
async def logout(
    payload: LogoutRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> None:
    # Décoder silencieusement : un token expiré ou malformé ne doit pas faire
    # échouer le logout — l'objectif est simplement de marquer le jti comme révoqué
    # s'il existe. On retourne toujours 204 pour éviter les fuites d'information.
    try:
        decoded = jwt.decode_token(payload.refresh_token)
        jti_str: str | None = decoded.get("jti")
        if jti_str and decoded.get("type") == "refresh":
            jti = UUID(jti_str)
            stored = await service.get_refresh_token(db, jti)
            if stored and not stored.revoked:
                await service.revoke_refresh_token(db, jti)
    except (JWTError, ValueError):
        # Token invalide ou expiré : rien à révoquer, on retourne 204 quand même.
        pass


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
