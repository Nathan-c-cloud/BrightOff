from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
from jwt.exceptions import InvalidTokenError as JWTError  # noqa: N812

from app.core.config import settings

# Re-export JWTError so callers can import it from here without depending on PyJWT directly.
# JWTError est un alias de jwt.exceptions.InvalidTokenError — superclasse de toutes les
# exceptions PyJWT (ExpiredSignatureError, InvalidSignatureError, DecodeError, etc.).
__all__ = [
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "JWTError",
]


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Encode an access token with a short expiry.

    Args:
        data: Claims to embed (must include "sub" with the user identifier).
        expires_delta: Custom expiry. Defaults to JWT_ACCESS_TOKEN_EXPIRE_MINUTES.

    Returns:
        Signed JWT string.
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    expire = datetime.now(UTC) + expires_delta
    payload = {**data, "type": "access", "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> tuple[str, UUID, datetime]:
    """Encode a refresh token with a longer expiry and a unique jti.

    The jti (JWT ID) is persisted in the refresh_tokens table to enable
    effective server-side rotation: on each /auth/refresh call, the jti is
    verified, marked revoked, and a new token is issued atomically.

    Args:
        data: Claims to embed (must include "sub" with the user identifier).

    Returns:
        Tuple of (signed JWT string, jti UUID, expires_at datetime).
        The caller must persist the jti and expires_at in the DB.
    """
    jti = uuid4()
    expires_at = datetime.now(UTC) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {**data, "type": "refresh", "jti": str(jti), "exp": expires_at}
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, jti, expires_at


def decode_token(token: str) -> dict:
    """Decode and validate a JWT.

    Args:
        token: JWT string to decode.

    Returns:
        Decoded payload as a dict.

    Raises:
        JWTError: If the token is invalid, expired, or the signature does not match.
    """
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
