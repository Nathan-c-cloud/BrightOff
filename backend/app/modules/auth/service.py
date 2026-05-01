from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User


class EmailAlreadyRegisteredError(Exception):
    """Levée quand un email existe déjà en base avec un autre provider que Google.

    Séparation des couches : le service ne connaît pas HTTP — c'est l'endpoint
    qui transforme cette exception en 409 Conflict.
    """


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Retourne l'utilisateur correspondant à l'email, ou None."""
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_user_email(db: AsyncSession, email: str, hashed_password: str) -> User:
    """Crée un utilisateur email/password de façon atomique.

    Lève EmailAlreadyRegisteredError si l'email est déjà enregistré (race-safe :
    s'appuie sur la contrainte UNIQUE de la colonne email — voir models.py:11).
    Le db.rollback() est obligatoire après IntegrityError pour remettre la session
    dans un état utilisable.
    """
    user = User(
        email=email,
        hashed_password=hashed_password,
        oauth_provider=None,
        oauth_id=None,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as e:
        await db.rollback()
        raise EmailAlreadyRegisteredError(email) from e
    return user


async def create_or_get_user_google(db: AsyncSession, email: str, oauth_id: str) -> User:
    """Retourne l'utilisateur Google existant ou en crée un nouveau."""
    user = await get_user_by_email(db, email)
    if user is not None:
        if user.oauth_provider == "google" and user.oauth_id == oauth_id:
            # Même compte Google déjà connu — retour direct.
            return user
        # Email déjà enregistré via un autre provider (email/password ou autre OAuth).
        # On refuse la liaison automatique pour éviter l'usurpation de compte.
        raise EmailAlreadyRegisteredError(email)

    user = User(
        email=email,
        hashed_password=None,
        oauth_provider="google",
        oauth_id=oauth_id,
    )
    db.add(user)
    await db.flush()
    return user
