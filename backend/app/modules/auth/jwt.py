from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import settings

# Re-export JWTError so callers can import it from here without depending on jose directly
__all__ = ["create_access_token", "create_refresh_token", "decode_token", "JWTError"]


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

    expire = datetime.now(tz=timezone.utc) + expires_delta
    payload = {**data, "type": "access", "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Encode a refresh token with a longer expiry.

    Args:
        data: Claims to embed (must include "sub" with the user identifier).

    Returns:
        Signed JWT string.
    """
    expire = datetime.now(tz=timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {**data, "type": "refresh", "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


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
