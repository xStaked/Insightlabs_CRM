from __future__ import annotations

from collections.abc import Callable

from fastapi import HTTPException, Request, status
from redis import RedisError

from app.core.redis import redis_client


def _default_key_builder(namespace: str, request: Request) -> str:
    client_ip = request.client.host if request.client else "unknown"
    return f"rate_limit:{namespace}:{client_ip}"


def rate_limit(namespace: str, limit: int, window_seconds: int, key_builder: Callable[[str, Request], str] | None = None):
    def _dependency(request: Request) -> None:
        key = (key_builder or _default_key_builder)(namespace, request)
        try:
            current = redis_client.incr(key)
            if current == 1:
                redis_client.expire(key, window_seconds)
        except RedisError:
            return

        if current > limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for {namespace}",
                headers={"Retry-After": str(window_seconds)},
            )

    return _dependency
