"""initial schema: users, licenses, payments

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "citext"')

    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("email", postgresql.CITEXT(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column(
            "is_email_verified",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # create_type=False: тип создаём явно ниже, чтобы create_table его не дублировал.
    license_status = postgresql.ENUM(
        "free", "reserved", "sold", name="license_status", create_type=False
    )
    postgresql.ENUM(
        "free", "reserved", "sold", name="license_status"
    ).create(op.get_bind(), checkfirst=True)

    op.create_table(
        "licenses",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("license_key", sa.Text(), nullable=False),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column(
            "status",
            license_status,
            server_default="free",
            nullable=False,
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), nullable=True
        ),
        sa.Column("sold_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("filename", name="uq_licenses_filename"),
    )
    op.create_index("ix_licenses_status", "licenses", ["status"])

    payment_status = postgresql.ENUM(
        "pending", "succeeded", "canceled", name="payment_status", create_type=False
    )
    postgresql.ENUM(
        "pending", "succeeded", "canceled", name="payment_status"
    ).create(op.get_bind(), checkfirst=True)

    op.create_table(
        "payments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("yookassa_payment_id", sa.Text(), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "status",
            payment_status,
            server_default="pending",
            nullable=False,
        ),
        sa.Column("license_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["license_id"], ["licenses.id"]),
        sa.UniqueConstraint(
            "yookassa_payment_id", name="uq_payments_yookassa_payment_id"
        ),
    )
    op.create_index(
        "ix_payments_yookassa_payment_id",
        "payments",
        ["yookassa_payment_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("payments")
    op.execute("DROP TYPE IF EXISTS payment_status")
    op.drop_table("licenses")
    op.execute("DROP TYPE IF EXISTS license_status")
    op.drop_table("users")
