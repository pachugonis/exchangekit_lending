"""add content_pages and seed offer/privacy

Revision ID: 0003_content_pages
Revises: 0002_add_is_admin
Create Date: 2026-06-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_content_pages"
down_revision: Union[str, None] = "0002_add_is_admin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


OFFER_BODY = """\
Настоящий документ является официальным предложением (публичной офертой) о заключении договора на предоставление неисключительной пожизненной лицензии на программное обеспечение ExchangeKit.

## 1. Предмет договора

Продавец предоставляет Покупателю неисключительную лицензию на использование ПО ExchangeKit без ограничения срока. Стоимость лицензии составляет 29 900 ₽ (включая НДС).

## 2. Порядок оплаты и выдачи

Оплата производится через платёжный сервис ЮКасса. После подтверждения оплаты лицензионный файл автоматически закрепляется за аккаунтом Покупателя и направляется на указанный email.

## 3. Возврат

Поскольку лицензия является цифровым товаром с моментальной выдачей, условия возврата регулируются законодательством РФ. Для запроса возврата свяжитесь с поддержкой до начала использования лицензии.

Это шаблон оферты. Перед запуском замените на юридически проверенный документ с реквизитами вашей организации."""


PRIVACY_BODY = """\
Мы уважаем вашу конфиденциальность и обрабатываем персональные данные в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».

## Какие данные мы собираем

Email, используемый для регистрации, и данные о платеже, необходимые для выдачи лицензии и формирования чека по 54-ФЗ. Пароли хранятся в виде безопасного хеша.

## Цели обработки

Регистрация и авторизация, обработка платежа, выдача лицензии, направление сервисных уведомлений и оказание поддержки.

## Передача третьим лицам

Данные платежа передаются платёжному сервису ЮКасса. Иным третьим лицам данные не передаются, за исключением случаев, предусмотренных законодательством.

Это шаблон. Перед запуском замените на документ с реквизитами вашей организации и актуальными контактами."""


def upgrade() -> None:
    content_pages = op.create_table(
        "content_pages",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    op.bulk_insert(
        content_pages,
        [
            {
                "slug": "offer",
                "title": "Публичная оферта",
                "body": OFFER_BODY,
            },
            {
                "slug": "privacy",
                "title": "Политика конфиденциальности",
                "body": PRIVACY_BODY,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("content_pages")
