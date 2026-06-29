"""seed contacts content page

Revision ID: 0004_contacts_page
Revises: 0003_content_pages
Create Date: 2026-06-29

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_contacts_page"
down_revision: Union[str, None] = "0003_content_pages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CONTACTS_BODY = """\
Свяжитесь с нами любым удобным способом — мы на связи и поможем с покупкой, установкой и поддержкой ExchangeKit.

## Поддержка

Email: **support@exchangekit.cc**

Telegram: **@exchangekit**

## Время работы

Ежедневно с 10:00 до 20:00 по московскому времени. На письма отвечаем в течение одного рабочего дня.

## Реквизиты

Это шаблон страницы контактов. Перед запуском замените на актуальные контактные данные и реквизиты вашей организации."""


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO content_pages (slug, title, body)
            VALUES ('contacts', :title, :body)
            ON CONFLICT (slug) DO NOTHING
            """
        ).bindparams(title="Контакты", body=CONTACTS_BODY)
    )


def downgrade() -> None:
    op.execute("DELETE FROM content_pages WHERE slug = 'contacts'")
