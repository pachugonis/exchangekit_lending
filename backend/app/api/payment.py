import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Payment, PaymentStatus, User
from app.schemas.payment import PaymentCreateResponse
from app.security import get_verified_user
from app.services.licenses import (
    NoLicensesAvailableError,
    assign_free_license,
    get_user_license,
)
from app.services.mailer import send_license_email
from app.services.ratelimit import rate_limit
from app.services import yookassa as yk

logger = logging.getLogger("payment")
router = APIRouter(prefix="/api/payment", tags=["payment"])


@router.post("/create", response_model=PaymentCreateResponse)
async def create_payment(
    request: Request,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    await rate_limit(request, key="payment_create", limit=10, window_seconds=3600)

    # Уже есть купленная лицензия — повторно не продаём.
    existing_license = await get_user_license(db, user)
    if existing_license is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="У вас уже есть лицензия.",
        )

    # Создаём внутренний платёж заранее — его id идёт в metadata ЮКасса.
    internal_id = uuid.uuid4()
    idempotence_key = str(internal_id)

    try:
        yk_result = yk.create_payment(
            internal_payment_id=internal_id,
            user_id=user.id,
            user_email=user.email,
            idempotence_key=idempotence_key,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Ошибка создания платежа ЮКасса для user_id=%s", user.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Не удалось создать платёж. Попробуйте позже.",
        )

    from decimal import Decimal

    from app.config import settings

    payment = Payment(
        id=internal_id,
        user_id=user.id,
        yookassa_payment_id=yk_result["id"],
        amount=Decimal(settings.license_price_decimal),
        status=PaymentStatus.pending,
    )
    db.add(payment)
    await db.commit()

    return PaymentCreateResponse(
        confirmation_url=yk_result["confirmation_url"],
        payment_id=yk_result["id"],
    )


@router.post("/webhook", status_code=200)
async def yookassa_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Главная логика выдачи. Доверяем только повторной проверке статуса
    через API ЮКасса; тело webhook — лишь сигнал."""
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = body.get("event")
    obj = body.get("object") or {}
    yk_payment_id = obj.get("id")

    if not yk_payment_id:
        # Всегда 200, чтобы ЮКасса не ретраила бесконечно по нашим ошибкам формата.
        logger.warning("Webhook без object.id: %s", body)
        return {"status": "ignored"}

    # Верификация: запрашиваем актуальный статус напрямую у ЮКасса.
    try:
        verified = yk.get_payment_status(yk_payment_id)
    except Exception:  # noqa: BLE001
        logger.exception("Не удалось проверить статус платежа %s", yk_payment_id)
        # 502 — пусть ЮКасса повторит позже.
        raise HTTPException(status_code=502, detail="verification failed")

    if event == "payment.canceled" or verified["status"] == "canceled":
        await _mark_canceled(db, yk_payment_id)
        return {"status": "ok"}

    if verified["status"] != "succeeded" or not verified.get("paid"):
        logger.info("Платёж %s ещё не succeeded: %s", yk_payment_id, verified["status"])
        return {"status": "pending"}

    await _fulfill(db, yk_payment_id)
    return {"status": "ok"}


async def _mark_canceled(db: AsyncSession, yk_payment_id: str) -> None:
    payment = await db.scalar(
        select(Payment)
        .where(Payment.yookassa_payment_id == yk_payment_id)
        .with_for_update()
    )
    if payment and payment.status == PaymentStatus.pending:
        payment.status = PaymentStatus.canceled
        await db.commit()


async def _fulfill(db: AsyncSession, yk_payment_id: str) -> None:
    """Идемпотентная атомарная выдача лицензии в одной транзакции."""
    # Блокируем строку платежа — сериализуем повторные webhook по одному платежу.
    payment = await db.scalar(
        select(Payment)
        .where(Payment.yookassa_payment_id == yk_payment_id)
        .with_for_update()
    )
    if payment is None:
        logger.error("Webhook: платёж %s не найден в БД", yk_payment_id)
        await db.rollback()
        return

    # Идемпотентность: уже обработан — ничего не делаем.
    if payment.status == PaymentStatus.succeeded:
        logger.info("Платёж %s уже succeeded — пропуск (идемпотентность)", yk_payment_id)
        await db.rollback()
        return

    user = await db.get(User, payment.user_id)
    if user is None:
        logger.error("Webhook: пользователь %s не найден", payment.user_id)
        await db.rollback()
        return

    try:
        license_ = await assign_free_license(db, user)
    except NoLicensesAvailableError:
        # Платёж НЕ теряем: помечаем succeeded, лицензию выдадим вручную/после пополнения.
        payment.status = PaymentStatus.succeeded
        await db.commit()
        logger.critical(
            "Платёж %s оплачен, но пул лицензий пуст! Требуется ручная выдача user_id=%s",
            yk_payment_id,
            payment.user_id,
        )
        return

    payment.status = PaymentStatus.succeeded
    payment.license_id = license_.id
    await db.commit()

    # Письмо вне транзакции — сбой почты не должен откатывать выдачу.
    try:
        await send_license_email(user.email, license_.license_key, license_.filename)
    except Exception:  # noqa: BLE001
        logger.exception("Лицензия выдана, но письмо не отправлено: user_id=%s", user.id)
