import uuid
from datetime import datetime

from sqlalchemy import DateTime, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class InstallScript(Base):
    """Скрипт установки ExchangeKit, загружаемый администратором.

    Хранится единственной строкой (последняя загрузка перезаписывает
    предыдущую). Содержимое — текст shell-скрипта; отдаётся клиентам,
    у которых есть купленная лицензия.
    """

    __tablename__ = "install_script"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    filename: Mapped[str] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
