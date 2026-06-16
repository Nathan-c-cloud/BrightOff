"""create refresh_tokens table for effective token rotation

Revision ID: c47a2e8f1b03
Revises: b31c4e7f9a01
Create Date: 2026-06-16 00:00:00.000000

Contexte S3 security hardening (V3) : la rotation de refresh tokens était
déclarée non effective (H-005 dans la dette technique). Cette table stocke
chaque refresh token émis avec son jti (JWT ID) et son état de révocation.
À chaque utilisation de /auth/refresh, le token entrant est marqué revoked
avant d'émettre un nouveau token — rotation atomique, sans fenêtre de réutilisation.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c47a2e8f1b03"
down_revision: Union[str, None] = "b31c4e7f9a01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "refresh_tokens",
        sa.Column("jti", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "revoked",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_refresh_tokens_user_id_revoked",
        "refresh_tokens",
        ["user_id", "revoked"],
    )


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_user_id_revoked", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
