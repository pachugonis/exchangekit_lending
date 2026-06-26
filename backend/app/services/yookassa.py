"""Обёртка над YooKassa SDK.

Создание платежа с чеком по 54-ФЗ и повторная проверка статуса через API
(не доверяем телу webhook вслепую — см. CLAUDE.md §6).
"""
import logging
import uuid

from yookassa import Configuration, Payment as YooPayment

from app.config import settings

logger = logging.getLogger("yookassa")

_configured = False


def _ensure_configured() -> None:
    global _configured
    if not _configured:
        Configuration.account_id = settings.yookassa_shop_id
        Configuration.secret_key = settings.yookassa_secret_key
        _configured = True


def create_payment(
    *,
    internal_payment_id: uuid.UUID,
    user_id: uuid.UUID,
    user_email: str,
    idempotence_key: str,
) -> dict:
    """Создаёт платёж в ЮКасса. Возвращает dict с id и confirmation_url."""
    _ensure_configured()
    amount = settings.license_price_decimal

    payload = {
        "amount": {"value": amount, "currency": "RUB"},
        "capture": True,
        "confirmation": {
            "type": "redirect",
            "return_url": settings.yookassa_return_url,
        },
        "description": "Лицензия ExchangeKit (пожизненная)",
        "metadata": {
            "user_id": str(user_id),
            "payment_id": str(internal_payment_id),
        },
        # Чек по 54-ФЗ — обязателен для онлайн-оплаты в РФ.
        "receipt": {
            "customer": {"email": user_email},
            "items": [
                {
                    "description": "Лицензия ExchangeKit",
                    "quantity": "1.00",
                    "amount": {"value": amount, "currency": "RUB"},
                    "vat_code": 1,  # без НДС
                    "payment_mode": "full_payment",
                    "payment_subject": "service",
                }
            ],
        },
    }

    payment = YooPayment.create(payload, idempotence_key)
    logger.info("ЮКасса: создан платёж %s (internal=%s)", payment.id, internal_payment_id)
    return {
        "id": payment.id,
        "status": payment.status,
        "confirmation_url": payment.confirmation.confirmation_url,
    }


def get_payment_status(yookassa_payment_id: str) -> dict:
    """Повторно запрашивает платёж через API ЮКасса для верификации webhook."""
    _ensure_configured()
    payment = YooPayment.find_one(yookassa_payment_id)
    return {
        "id": payment.id,
        "status": payment.status,
        "paid": payment.paid,
        "metadata": dict(payment.metadata or {}),
    }
