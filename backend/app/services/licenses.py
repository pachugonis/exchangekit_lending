import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import License, LicenseStatus, User

logger = logging.getLogger("licenses")


class NoLicensesAvailableError(Exception):
    """В пуле не осталось свободных лицензий."""


async def count_free_licenses(db: AsyncSession) -> int:
    return await db.scalar(
        select(func.count())
        .select_from(License)
        .where(License.status == LicenseStatus.free)
    ) or 0


async def assign_free_license(db: AsyncSession, user: User) -> License:
    """Атомарно берёт первую свободную лицензию и привязывает к пользователю.

    Должна вызываться ВНУТРИ транзакции (обработчик webhook).
    Использует FOR UPDATE SKIP LOCKED — исключает гонку при одновременных
    покупках: две транзакции не получат одну лицензию.
    """
    stmt = (
        select(License)
        .where(License.status == LicenseStatus.free)
        .order_by(License.created_at)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    license_ = await db.scalar(stmt)
    if license_ is None:
        # Критично: продаём «в минус» — нужен алерт и пополнение пула.
        logger.critical(
            "LICENSE POOL EXHAUSTED: нет свободных лицензий для user_id=%s",
            user.id,
        )
        raise NoLicensesAvailableError

    license_.status = LicenseStatus.sold
    license_.user_id = user.id
    license_.sold_at = datetime.now(timezone.utc)
    await db.flush()

    logger.info(
        "Лицензия выдана: license_id=%s filename=%s user_id=%s",
        license_.id,
        license_.filename,
        user.id,
    )
    return license_


async def get_user_license(db: AsyncSession, user: User) -> License | None:
    return await db.scalar(
        select(License)
        .where(License.user_id == user.id, License.status == LicenseStatus.sold)
        .order_by(License.sold_at.desc())
        .limit(1)
    )
