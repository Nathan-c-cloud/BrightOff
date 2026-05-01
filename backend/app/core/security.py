from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.jwt import JWTError, decode_token
from app.modules.auth.models import User
from app.modules.auth.service import get_user_by_email

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> User:
    """Dépendance FastAPI qui valide le JWT et retourne l'utilisateur courant.

    Raises:
        HTTPException 401: Token absent, invalide, expiré, mauvais type, ou user inexistant.
        HTTPException 403: Utilisateur authentifié mais compte désactivé.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
    except JWTError:
        raise credentials_exception from None

    # Rejeter les refresh tokens utilisés à la place d'un access token
    if payload.get("type") != "access":
        raise credentials_exception

    email: str | None = payload.get("sub")
    if email is None:
        raise credentials_exception

    user = await get_user_by_email(db, email)
    if user is None:
        raise credentials_exception

    # 403 et non 401 : l'identité est prouvée (token valide, user en base),
    # mais l'accès est explicitement refusé pour ce compte.
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    return user
