import secrets
import uuid

from app.redis_client import redis_client

VERIFY_PREFIX = "verify:"
VERIFY_TTL_SECONDS = 60 * 60 * 24  # 24 часа


async def create_email_verify_token(user_id: uuid.UUID) -> str:
    token = secrets.token_urlsafe(32)
    await redis_client.set(
        f"{VERIFY_PREFIX}{token}", str(user_id), ex=VERIFY_TTL_SECONDS
    )
    return token


async def consume_email_verify_token(token: str) -> uuid.UUID | None:
    key = f"{VERIFY_PREFIX}{token}"
    user_id = await redis_client.get(key)
    if user_id is None:
        return None
    await redis_client.delete(key)
    try:
        return uuid.UUID(user_id)
    except ValueError:
        return None
