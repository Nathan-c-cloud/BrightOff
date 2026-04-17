import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base
from app.core.mixins import TimestampMixin, UUIDMixin


class GapAnalysis(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "gap_analyses"

    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("matches.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    missing_skills: Mapped[list | dict] = mapped_column(JSONB, nullable=False)
    recommendations: Mapped[list | dict] = mapped_column(JSONB, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
