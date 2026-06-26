import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import User
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    UserOut,
)
from app.security import (
    clear_auth_cookie,
    create_access_token,
    get_current_user,
    hash_password,
    set_auth_cookie,
    verify_password,
)
from app.services.mailer import send_verification_email
from app.services.ratelimit import rate_limit
from app.services.tokens import (
    consume_email_verify_token,
    create_email_verify_token,
)

logger = logging.getLogger("auth")
router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/register", response_model=MessageResponse, status_code=201)
async def register(
    payload: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await rate_limit(request, key="register", limit=5, window_seconds=3600)

    email = payload.email.strip().lower()
    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        # Не раскрываем, существует ли email — единообразный ответ.
        return MessageResponse(
            message="Если email свободен, мы отправили письмо для подтверждения."
        )

    await db.refresh(user)
    token = await create_email_verify_token(user.id)
    await send_verification_email(user.email, token)

    return MessageResponse(
        message="Если email свободен, мы отправили письмо для подтверждения."
    )


@router.get("/verify", response_model=MessageResponse)
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    user_id = await consume_email_verify_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ссылка недействительна или истекла.",
        )

    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден.")

    if not user.is_email_verified:
        user.is_email_verified = True
        await db.commit()

    return MessageResponse(message="Email успешно подтверждён.")


@router.post("/login", response_model=UserOut)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    await rate_limit(request, key="login", limit=10, window_seconds=900)

    email = payload.email.strip().lower()
    user = await db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль.",
        )

    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    return user


@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response):
    clear_auth_cookie(response)
    return MessageResponse(message="Вы вышли из аккаунта.")


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
