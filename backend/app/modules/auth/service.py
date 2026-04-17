from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Retourne l'utilisateur correspondant à l'email, ou None."""
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_user_email(db: AsyncSession, email: str, hashed_password: str) -> User:
    """Crée un utilisateur email/password et le persiste (sans commit)."""
    user = User(
        email=email,
        hashed_password=hashed_password,
        oauth_provider=None,
        oauth_id=None,
    )
    db.add(user)
    await db.flush()
    return user


async def create_or_get_user_google(db: AsyncSession, email: str, oauth_id: str) -> User:
    """Retourne l'utilisateur Google existant ou en crée un nouveau."""
    user = await get_user_by_email(db, email)
    if user is not None:
        if user.oauth_provider != "google" or user.oauth_id != oauth_id:
            user = await link_google_to_existing_user(db, user, oauth_id)
        return user

    user = User(
        email=email,
        hashed_password=None,
        oauth_provider="google",
        oauth_id=oauth_id,
    )
    db.add(user)
    await db.flush()
    return user


async def link_google_to_existing_user(db: AsyncSession, user: User, oauth_id: str) -> User:
    """Lie un compte Google à un utilisateur existant."""
    user.oauth_provider = "google"
    user.oauth_id = oauth_id
    await db.flush()
    return user
