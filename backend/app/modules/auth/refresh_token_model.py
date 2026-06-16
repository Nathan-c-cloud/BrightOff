from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.base import Base


class RefreshToken(Base):
    """Stockage côté serveur des refresh tokens émis.

    Chaque refresh token a un identifiant unique (jti) inscrit dans le claim JWT.
    À l'utilisation (/auth/refresh), le jti est vérifié en base et marqué revoked
    avant d'émettre un nouveau token — c'est la rotation effective.

    Contraintes :
        - CASCADE sur user_id : la suppression de l'utilisateur purge ses tokens.
        - Index composite (user_id, revoked) : optimise les requêtes de comptage
          ou de révocation de tous les tokens actifs d'un utilisateur.
    """

    __tablename__ = "refresh_tokens"

    jti: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    revoked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
