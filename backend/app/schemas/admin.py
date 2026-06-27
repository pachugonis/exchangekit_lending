import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr


class AdminStats(BaseModel):
    users_total: int
    users_verified: int
    licenses_total: int
    licenses_free: int
    licenses_reserved: int
    licenses_sold: int
    payments_succeeded: int
    payments_pending: int
    revenue_total: Decimal


class AdminLicenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    status: str
    user_email: str | None = None
    sold_at: datetime | None = None
    created_at: datetime


class AdminLicenseList(BaseModel):
    items: list[AdminLicenseOut]
    total: int


class LicenseUploadResult(BaseModel):
    created: int
    skipped: int
    errors: list[str]
    free_total: int


class AdminClientOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    is_email_verified: bool
    is_admin: bool
    created_at: datetime
    has_license: bool
    license_filename: str | None = None
    sold_at: datetime | None = None
    payments_count: int
    total_paid: Decimal


class AdminClientList(BaseModel):
    items: list[AdminClientOut]
    total: int


class AdminPaymentOut(BaseModel):
    id: uuid.UUID
    user_email: str | None = None
    yookassa_payment_id: str
    amount: Decimal
    status: str
    license_filename: str | None = None
    created_at: datetime


class AdminPaymentList(BaseModel):
    items: list[AdminPaymentOut]
    total: int
