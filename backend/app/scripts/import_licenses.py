"""Импорт пула лицензий из .txt файлов в БД.

Читает все *.txt из каталога (по умолчанию licenses_pool), создаёт записи
licenses со status='free'. Уже импортированные (по filename) пропускает —
скрипт идемпотентен, можно запускать повторно при пополнении пула.

Запуск (из каталога backend, в venv):
    ../.venv/bin/python -m app.scripts.import_licenses ../licenses_pool
    ../.venv/bin/python -m app.scripts.import_licenses /path/to/pool
"""
import asyncio
import os
import sys
from pathlib import Path

from sqlalchemy import select

from app.db import AsyncSessionLocal
from app.models import License

DEFAULT_POOL_DIR = os.environ.get("LICENSES_POOL_DIR", "/licenses_pool")
# Пример-файл из репозитория не импортируем как реальную лицензию.
SKIP_FILES = {"example.txt"}


async def import_pool(pool_dir: str) -> None:
    path = Path(pool_dir)
    if not path.is_dir():
        print(f"[import_licenses] Каталог не найден: {pool_dir}", file=sys.stderr)
        sys.exit(1)

    txt_files = sorted(
        p for p in path.glob("*.txt") if p.name not in SKIP_FILES
    )
    if not txt_files:
        print(f"[import_licenses] Нет .txt файлов в {pool_dir}.")
        return

    created = 0
    skipped = 0

    async with AsyncSessionLocal() as db:
        existing = set(
            (await db.scalars(select(License.filename))).all()
        )

        for file in txt_files:
            if file.name in existing:
                skipped += 1
                continue

            content = file.read_text(encoding="utf-8").strip()
            if not content:
                print(f"[import_licenses] Пропуск пустого файла: {file.name}")
                continue

            db.add(License(license_key=content, filename=file.name))
            created += 1

        await db.commit()

    total = await _count_free()
    print(
        f"[import_licenses] Импортировано: {created}, пропущено (дубли): "
        f"{skipped}. Свободных лицензий в пуле: {total}."
    )


async def _count_free() -> int:
    from app.services.licenses import count_free_licenses

    async with AsyncSessionLocal() as db:
        return await count_free_licenses(db)


def main() -> None:
    pool_dir = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_POOL_DIR
    asyncio.run(import_pool(pool_dir))


if __name__ == "__main__":
    main()
