from fastapi import HTTPException, Request, status

from app.redis_client import redis_client


async def rate_limit(
    request: Request,
    *,
    key: str,
    limit: int,
    window_seconds: int,
) -> None:
    """Простой fixed-window rate-limit на Redis.

    key — логический префикс (напр. "login"); IP добавляется автоматически.
    """
    client_ip = request.client.host if request.client else "unknown"
    redis_key = f"rl:{key}:{client_ip}"

    current = await redis_client.incr(redis_key)
    if current == 1:
        await redis_client.expire(redis_key, window_seconds)

    if current > limit:
        ttl = await redis_client.ttl(redis_key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Слишком много запросов. Повторите через {max(ttl, 1)} сек.",
        )
