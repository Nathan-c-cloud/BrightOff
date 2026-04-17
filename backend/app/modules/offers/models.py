from __future__ import annotations

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base
from app.core.mixins import TimestampMixin, UUIDMixin


class JobOffer(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "job_offers"

    source: Mapped[str] = mapped_column(String(50), nullable=False)
    source_url: Mapped[str] = mapped_column(String(1000), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contract_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    remote_policy: Mapped[str | None] = mapped_column(String(50), nullable=True)
    salary_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    skills: Mapped[list[JobOfferSkill]] = relationship(
        back_populates="job_offer", cascade="all, delete-orphan"
    )
    embedding: Mapped[JobOfferEmbedding | None] = relationship(
        back_populates="job_offer", cascade="all, delete-orphan", uselist=False
    )


class JobOfferSkill(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "job_offer_skills"

    job_offer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_offers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    importance: Mapped[str] = mapped_column(String(20), nullable=False)

    job_offer: Mapped[JobOffer] = relationship(back_populates="skills")


class JobOfferEmbedding(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "job_offer_embeddings"

    job_offer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_offers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)
    model_version: Mapped[str] = mapped_column(
        String(50), nullable=False, default="text-embedding-3-small"
    )

    job_offer: Mapped[JobOffer] = relationship(back_populates="embedding")
