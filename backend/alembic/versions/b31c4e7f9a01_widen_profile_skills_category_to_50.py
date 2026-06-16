"""widen profile_skills.category from String(10) to String(50)

Revision ID: b31c4e7f9a01
Revises: a20fe129d252
Create Date: 2026-06-16 00:00:00.000000

Contexte S3 closure : la colonne category était limitée à 10 chars, ce qui correspond
exactement à la longueur de "soft_skill". Zéro marge pour de futures catégories.
On passe à 50 pour avoir de la marge sans surcoût.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b31c4e7f9a01"
down_revision: Union[str, None] = "a20fe129d252"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "profile_skills",
        "category",
        existing_type=sa.String(length=10),
        type_=sa.String(length=50),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "profile_skills",
        "category",
        existing_type=sa.String(length=50),
        type_=sa.String(length=10),
        existing_nullable=False,
    )
