"""Назначение пользователя администратором (и снятие прав).

Пользователь должен быть уже зарегистрирован. Скрипт ставит флаг is_admin.

Запуск (из каталога backend, в venv):
    ../.venv/bin/python -m app.scripts.make_admin admin@exchangekit.cc
    ../.venv/bin/python -m app.scripts.make_admin admin@exchangekit.cc --revoke
"""
import asyncio
import sys

from sqlalchemy import select

from app.db import AsyncSessionLocal
from app.models import User


async def set_admin(email: str, value: bool) -> None:
    email = email.strip().lower()
    async with AsyncSessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == email))
        if user is None:
            print(f"[make_admin] Пользователь не найден: {email}", file=sys.stderr)
            sys.exit(1)
        user.is_admin = value
        await db.commit()
        state = "назначен администратором" if value else "лишён прав администратора"
        print(f"[make_admin] {email} {state}.")


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print("Использование: python -m app.scripts.make_admin <email> [--revoke]")
        sys.exit(1)
    email = args[0]
    revoke = "--revoke" in args[1:]
    asyncio.run(set_admin(email, value=not revoke))


if __name__ == "__main__":
    main()
