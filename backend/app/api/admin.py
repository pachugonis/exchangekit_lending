import logging
import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.db import get_db
from app.models import (
    ContentPage,
    License,
    LicenseStatus,
    Payment,
    PaymentStatus,
    User,
)
from app.schemas.admin import (
    AdminClientList,
    AdminClientOut,
    AdminLicenseList,
    AdminLicenseOut,
    AdminPaymentList,
    AdminPaymentOut,
    AdminStats,
    ContentPageOut,
    ContentPageUpdate,
    InstallScriptInfo,
    LicenseUploadResult,
)
from app.content import CONTENT_SLUGS, DEFAULT_CONTENT
from app.security import get_admin_user
from app.services.install_script import get_install_script, set_install_script
from sqlalchemy import delete, update

logger = logging.getLogger("admin")
router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(get_admin_user)],
)

MAX_UPLOAD_BYTES = 256 * 1024  # одна лицензия — небольшой .txt
MAX_SCRIPT_BYTES = 1024 * 1024  # скрипт установки — до 1 МБ
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_filename(name: str) -> str:
    base = (name or "").strip().replace("\\", "/").split("/")[-1]
    base = _SAFE_NAME.sub("_", base).strip("._") or "license"
    if not base.lower().endswith(".txt"):
        base = f"{base}.txt"
    return base[:255]


def _safe_script_name(name: str) -> str:
    base = (name or "").strip().replace("\\", "/").split("/")[-1]
    base = _SAFE_NAME.sub("_", base).strip("._") or "install.sh"
    return base[:255]


@router.get("/stats", response_model=AdminStats)
async def admin_stats(db: AsyncSession = Depends(get_db)):
    users_total = await db.scalar(select(func.count()).select_from(User)) or 0
    users_verified = (
        await db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.is_email_verified.is_(True))
        )
        or 0
    )

    status_rows = (
        await db.execute(
            select(License.status, func.count()).group_by(License.status)
        )
    ).all()
    by_status = {s: c for s, c in status_rows}

    pay_rows = (
        await db.execute(
            select(Payment.status, func.count()).group_by(Payment.status)
        )
    ).all()
    by_pay = {s: c for s, c in pay_rows}

    revenue = (
        await db.scalar(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.status == PaymentStatus.succeeded
            )
        )
        or 0
    )

    free = by_status.get(LicenseStatus.free, 0)
    reserved = by_status.get(LicenseStatus.reserved, 0)
    sold = by_status.get(LicenseStatus.sold, 0)

    return AdminStats(
        users_total=users_total,
        users_verified=users_verified,
        licenses_total=free + reserved + sold,
        licenses_free=free,
        licenses_reserved=reserved,
        licenses_sold=sold,
        payments_succeeded=by_pay.get(PaymentStatus.succeeded, 0),
        payments_pending=by_pay.get(PaymentStatus.pending, 0),
        revenue_total=revenue,
    )


@router.get("/licenses", response_model=AdminLicenseList)
async def admin_licenses(
    db: AsyncSession = Depends(get_db),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    base = select(License).join(User, License.user_id == User.id, isouter=True)
    count_q = select(func.count()).select_from(License)

    if status_filter:
        try:
            st = LicenseStatus(status_filter)
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверный статус")
        base = base.where(License.status == st)
        count_q = count_q.where(License.status == st)

    total = await db.scalar(count_q) or 0
    rows = (
        await db.execute(
            base.add_columns(User.email)
            .order_by(License.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()

    items = [
        AdminLicenseOut(
            id=lic.id,
            filename=lic.filename,
            status=lic.status.value,
            user_email=email,
            sold_at=lic.sold_at,
            created_at=lic.created_at,
        )
        for lic, email in rows
    ]
    return AdminLicenseList(items=items, total=total)


@router.post("/licenses/upload", response_model=LicenseUploadResult)
async def upload_licenses(
    db: AsyncSession = Depends(get_db),
    files: list[UploadFile] = File(...),
):
    """Загрузка пула лицензий: каждый .txt → одна свободная лицензия.
    Дубли по имени файла пропускаются (как и в import_licenses)."""
    existing = set((await db.scalars(select(License.filename))).all())

    created = 0
    skipped = 0
    errors: list[str] = []
    seen: set[str] = set()

    for upload in files:
        raw = await upload.read()
        name = _safe_filename(upload.filename or "license.txt")

        if len(raw) > MAX_UPLOAD_BYTES:
            errors.append(f"{name}: файл слишком большой")
            continue

        try:
            content = raw.decode("utf-8").strip()
        except UnicodeDecodeError:
            errors.append(f"{name}: не UTF-8 текст")
            continue

        if not content:
            errors.append(f"{name}: пустой файл")
            continue

        if name in existing or name in seen:
            skipped += 1
            continue

        db.add(License(license_key=content, filename=name))
        seen.add(name)
        created += 1

    if created:
        await db.commit()

    free_total = (
        await db.scalar(
            select(func.count())
            .select_from(License)
            .where(License.status == LicenseStatus.free)
        )
        or 0
    )
    logger.info("Загружено лицензий: %s, пропущено: %s", created, skipped)
    return LicenseUploadResult(
        created=created, skipped=skipped, errors=errors, free_total=free_total
    )


@router.delete("/licenses/{license_id}", status_code=204)
async def delete_license(
    license_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    lic = await db.get(License, license_id)
    if lic is None:
        raise HTTPException(status_code=404, detail="Лицензия не найдена")
    if lic.status != LicenseStatus.free:
        raise HTTPException(
            status_code=409,
            detail="Можно удалять только свободные лицензии",
        )
    await db.delete(lic)
    await db.commit()


@router.get("/clients", response_model=AdminClientList)
async def admin_clients(
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    count_q = select(func.count()).select_from(User)
    base = select(User)
    if search:
        pattern = f"%{search.strip()}%"
        base = base.where(User.email.ilike(pattern))
        count_q = count_q.where(User.email.ilike(pattern))

    total = await db.scalar(count_q) or 0
    users = (
        await db.scalars(
            base.order_by(User.created_at.desc()).limit(limit).offset(offset)
        )
    ).all()

    if not users:
        return AdminClientList(items=[], total=total)

    user_ids = [u.id for u in users]

    # Купленная лицензия на пользователя.
    lic_rows = (
        await db.execute(
            select(License.user_id, License.filename, License.sold_at).where(
                License.user_id.in_(user_ids),
                License.status == LicenseStatus.sold,
            )
        )
    ).all()
    lic_by_user = {uid: (fn, sold) for uid, fn, sold in lic_rows}

    # Суммы успешных платежей на пользователя.
    pay_rows = (
        await db.execute(
            select(
                Payment.user_id,
                func.count(),
                func.coalesce(func.sum(Payment.amount), 0),
            )
            .where(
                Payment.user_id.in_(user_ids),
                Payment.status == PaymentStatus.succeeded,
            )
            .group_by(Payment.user_id)
        )
    ).all()
    pay_by_user = {uid: (cnt, total_) for uid, cnt, total_ in pay_rows}

    items = []
    for u in users:
        fn, sold = lic_by_user.get(u.id, (None, None))
        cnt, paid = pay_by_user.get(u.id, (0, 0))
        items.append(
            AdminClientOut(
                id=u.id,
                email=u.email,
                is_email_verified=u.is_email_verified,
                is_admin=u.is_admin,
                created_at=u.created_at,
                has_license=fn is not None,
                license_filename=fn,
                sold_at=sold,
                payments_count=cnt,
                total_paid=paid,
            )
        )
    return AdminClientList(items=items, total=total)


@router.delete("/clients/{client_id}", status_code=204)
async def delete_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Удаление клиента.

    Привязанные платежи удаляются (FK user_id NOT NULL), а выданные лицензии
    возвращаются в пул свободными, чтобы не терять их из пула.
    """
    if client_id == admin.id:
        raise HTTPException(
            status_code=409, detail="Нельзя удалить собственную учётную запись"
        )

    user = await db.get(User, client_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    email = user.email

    # Лицензии клиента возвращаем в пул свободными.
    await db.execute(
        update(License)
        .where(License.user_id == client_id)
        .values(status=LicenseStatus.free, user_id=None, sold_at=None)
    )
    await db.execute(delete(Payment).where(Payment.user_id == client_id))
    await db.delete(user)
    await db.commit()
    logger.info("Удалён клиент: %s (%s)", client_id, email)


@router.get("/payments", response_model=AdminPaymentList)
async def admin_payments(
    db: AsyncSession = Depends(get_db),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    lic = aliased(License)
    base = (
        select(Payment, User.email, lic.filename)
        .join(User, Payment.user_id == User.id, isouter=True)
        .join(lic, Payment.license_id == lic.id, isouter=True)
    )
    count_q = select(func.count()).select_from(Payment)

    if status_filter:
        try:
            st = PaymentStatus(status_filter)
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверный статус")
        base = base.where(Payment.status == st)
        count_q = count_q.where(Payment.status == st)

    total = await db.scalar(count_q) or 0
    rows = (
        await db.execute(
            base.order_by(Payment.created_at.desc()).limit(limit).offset(offset)
        )
    ).all()

    items = [
        AdminPaymentOut(
            id=p.id,
            user_email=email,
            yookassa_payment_id=p.yookassa_payment_id,
            amount=p.amount,
            status=p.status.value,
            license_filename=filename,
            created_at=p.created_at,
        )
        for p, email, filename in rows
    ]
    return AdminPaymentList(items=items, total=total)


async def _get_or_seed_page(db: AsyncSession, slug: str) -> ContentPage:
    """Возвращает строку content_pages, создавая её из дефолта при отсутствии."""
    if slug not in CONTENT_SLUGS:
        raise HTTPException(status_code=404, detail="Страница не найдена")
    page = await db.scalar(select(ContentPage).where(ContentPage.slug == slug))
    if page is None:
        default = DEFAULT_CONTENT[slug]
        page = ContentPage(slug=slug, title=default["title"], body=default["body"])
        db.add(page)
        await db.commit()
        await db.refresh(page)
    return page


@router.get("/content/{slug}", response_model=ContentPageOut)
async def get_content_page(slug: str, db: AsyncSession = Depends(get_db)):
    return await _get_or_seed_page(db, slug)


@router.put("/content/{slug}", response_model=ContentPageOut)
async def update_content_page(
    slug: str,
    payload: ContentPageUpdate,
    db: AsyncSession = Depends(get_db),
):
    page = await _get_or_seed_page(db, slug)
    page.title = payload.title
    page.body = payload.body
    await db.commit()
    await db.refresh(page)
    logger.info("Обновлён текст страницы: %s", slug)
    return page


def _script_info(script) -> InstallScriptInfo:
    if script is None:
        return InstallScriptInfo(exists=False)
    return InstallScriptInfo(
        exists=True,
        filename=script.filename,
        size=len(script.content.encode("utf-8")),
        updated_at=script.updated_at,
    )


@router.get("/install-script", response_model=InstallScriptInfo)
async def get_install_script_info(db: AsyncSession = Depends(get_db)):
    return _script_info(await get_install_script(db))


@router.post("/install-script", response_model=InstallScriptInfo)
async def upload_install_script(
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    """Загрузка скрипта установки. Перезаписывает предыдущий."""
    raw = await file.read()
    if len(raw) > MAX_SCRIPT_BYTES:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс. 1 МБ)")
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Файл должен быть текстом в UTF-8")
    if not content.strip():
        raise HTTPException(status_code=400, detail="Файл пустой")

    name = _safe_script_name(file.filename or "install.sh")
    script = await set_install_script(db, filename=name, content=content)
    logger.info("Загружен скрипт установки: %s (%s байт)", name, len(raw))
    return _script_info(script)


@router.delete("/install-script", status_code=204)
async def delete_install_script(db: AsyncSession = Depends(get_db)):
    script = await get_install_script(db)
    if script is None:
        raise HTTPException(status_code=404, detail="Скрипт не загружен")
    await db.delete(script)
    await db.commit()
    logger.info("Удалён скрипт установки")
