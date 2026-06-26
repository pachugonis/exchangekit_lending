"""Создание (или обновление) пользователя-администратора.

В отличие от make_admin (который только повышает уже существующего
пользователя), этот скрипт создаёт администратора с нуля: email + пароль,
сразу с подтверждённым email и флагом is_admin. Если пользователь с таким
email уже есть — обновляет пароль (если передан) и выставляет права админа.

Идемпотентен: безопасно запускать повторно при деплое.

Запуск:
    python -m app.scripts.create_admin admin@exchangekit.cc 'СильныйПароль'
    python -m app.scripts.create_admin admin@exchangekit.cc            # пароль из env ADMIN_PASSWORD
"""
import asyncio
import os
import sys

from sqlalchemy import select

from app.db import AsyncSessionLocal
from app.models import User
from app.security import hash_password


async def create_admin(email: str, password: str | None) -> None:
    email = email.strip().lower()
    async with AsyncSessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == email))

        if user is None:
            if not password:
                print(
                    "[create_admin] Для нового администратора нужен пароль "
                    "(аргумент или env ADMIN_PASSWORD).",
                    file=sys.stderr,
                )
                sys.exit(1)
            user = User(
                email=email,
                password_hash=hash_password(password),
                is_email_verified=True,
                is_admin=True,
            )
            db.add(user)
            await db.commit()
            print(f"[create_admin] Создан администратор: {email}")
            return

        # Пользователь уже существует — повышаем до админа.
        user.is_admin = True
        user.is_email_verified = True
        if password:
            user.password_hash = hash_password(password)
            print(f"[create_admin] {email}: обновлён пароль, выданы права администратора.")
        else:
            print(f"[create_admin] {email}: выданы права администратора (пароль не менялся).")
        await db.commit()


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(
            "Использование: python -m app.scripts.create_admin <email> [password]",
            file=sys.stderr,
        )
        sys.exit(1)
    email = args[0]
    password = args[1] if len(args) > 1 else os.environ.get("ADMIN_PASSWORD")
    asyncio.run(create_admin(email, password))


if __name__ == "__main__":
    main()
