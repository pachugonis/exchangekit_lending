import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class LicenseStatus(str, enum.Enum):
    free = "free"
    reserved = "reserved"
    sold = "sold"


class License(Base):
    __tablename__ = "licenses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    license_key: Mapped[str] = mapped_column(nullable=False)  # содержимое .txt
    filename: Mapped[str] = mapped_column(nullable=False, unique=True)
    status: Mapped[LicenseStatus] = mapped_column(
        Enum(LicenseStatus, name="license_status"),
        nullable=False,
        server_default=LicenseStatus.free.value,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    sold_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    user: Mapped["User | None"] = relationship(  # noqa: F821
        back_populates="licenses"
    )

    __table_args__ = (Index("ix_licenses_status", "status"),)
