import uuid
from datetime import datetime

from pydantic import BaseModel


class LicenseStatusOut(BaseModel):
    has_license: bool
    license_id: uuid.UUID | None = None
    filename: str | None = None
    sold_at: datetime | None = None
