"""seed install_guide content page

Revision ID: 0006_install_guide_page
Revises: 0005_install_script
Create Date: 2026-06-29

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_install_guide_page"
down_revision: Union[str, None] = "0005_install_script"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


GUIDE_BODY = """\
Эта инструкция поможет установить ExchangeKit с помощью скрипта установки, который вы скачали выше.

## 1. Подготовьте файлы

Скачайте из личного кабинета **лицензию** (license.txt) и **скрипт установки** (install.sh). Положите оба файла в одну папку на сервере.

## 2. Запустите установку

Подключитесь к серверу по SSH и выполните:

chmod +x install.sh

sudo ./install.sh

Скрипт проверит зависимости, активирует лицензию и развернёт ExchangeKit.

## 3. Готово

После завершения откройте адрес вашего сервера в браузере. Если что-то пошло не так — напишите в поддержку, указав текст ошибки.

Это шаблон инструкции. Замените на актуальные шаги установки вашего софта."""


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO content_pages (slug, title, body)
            VALUES ('install_guide', :title, :body)
            ON CONFLICT (slug) DO NOTHING
            """
        ).bindparams(title="Установка ExchangeKit", body=GUIDE_BODY)
    )


def downgrade() -> None:
    op.execute("DELETE FROM content_pages WHERE slug = 'install_guide'")
