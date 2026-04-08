import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base
from app.core.mixins import TimestampMixin, UUIDMixin


class Match(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "matches"
    __table_args__ = (UniqueConstraint("user_id", "job_offer_id", name="uq_match_user_offer"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    job_offer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_offers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    score_skills: Mapped[int] = mapped_column(Integer, nullable=False)
    score_experience: Mapped[int] = mapped_column(Integer, nullable=False)
    score_education: Mapped[int] = mapped_column(Integer, nullable=False)
    score_soft_skills: Mapped[int] = mapped_column(Integer, nullable=False)
    score_other: Mapped[int] = mapped_column(Integer, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
