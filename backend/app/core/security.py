from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


class TokenError(Exception):
    pass


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def create_token(subject: str, expires_delta: timedelta, extra: dict[str, Any] | None = None) -> str:
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": datetime.now(UTC) + expires_delta,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, tenant_id: str | None = None, role: str | None = None) -> str:
    extra = {"tenant_id": tenant_id, "typ": "access", "role": role or "advisor"}
    return create_token(subject, timedelta(minutes=settings.access_token_expire_minutes), extra)


def create_refresh_token(subject: str, tenant_id: str | None = None, role: str | None = None) -> str:
    extra = {"tenant_id": tenant_id, "typ": "refresh", "role": role or "advisor"}
    return create_token(subject, timedelta(minutes=settings.refresh_token_expire_minutes), extra)


def decode_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise TokenError("Invalid token") from exc
    return payload
