from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.models.entities import User
from app.repositories.users import UserRepository

settings = get_settings()


class AuthService:
    def __init__(self, db: Session):
        self.users = UserRepository(db)

    def login(self, *, tenant_id: str, email: str, password: str) -> tuple[str, str]:
        user = self.users.get_by_email(tenant_id, email)
        if not user or not verify_password(password, user.password_hash):
            raise ValueError("Invalid credentials")

        return self._issue_tokens(user_id=user.id, tenant_id=tenant_id, role=user.role)

    def rotate_refresh_token(self, refresh_token: str) -> tuple[str, str]:
        payload = decode_token(refresh_token)
        if payload.get("typ") != "refresh":
            raise ValueError("Invalid token type")

        tenant_id = payload.get("tenant_id")
        user_id = payload.get("sub")
        if not tenant_id or not user_id:
            raise ValueError("Invalid token payload")

        user = self.users.get_by_id(tenant_id, user_id)
        if not user:
            raise ValueError("User not found")

        active_tokens = self.users.list_active_refresh_tokens(tenant_id=tenant_id, user_id=user_id)
        matched_token = None
        for token in active_tokens:
            if verify_password(refresh_token, token.token_hash):
                matched_token = token
                break

        if not matched_token:
            raise ValueError("Refresh token revoked or not found")

        self.users.revoke_refresh_token(matched_token.id)
        return self._issue_tokens(user_id=user_id, tenant_id=tenant_id, role=user.role)

    def logout(self, refresh_token: str) -> None:
        payload = decode_token(refresh_token)
        if payload.get("typ") != "refresh":
            raise ValueError("Invalid token type")

        tenant_id = payload.get("tenant_id")
        user_id = payload.get("sub")
        if not tenant_id or not user_id:
            raise ValueError("Invalid token payload")

        active_tokens = self.users.list_active_refresh_tokens(tenant_id=tenant_id, user_id=user_id)
        for token in active_tokens:
            if verify_password(refresh_token, token.token_hash):
                self.users.revoke_refresh_token(token.id)
                return

        raise ValueError("Refresh token revoked or not found")

    def _issue_tokens(self, *, user_id: str, tenant_id: str, role: str) -> tuple[str, str]:
        access_token = create_access_token(subject=user_id, tenant_id=tenant_id, role=role)
        refresh_token = create_refresh_token(subject=user_id, tenant_id=tenant_id, role=role)
        self.users.create_refresh_token(
            tenant_id=tenant_id,
            user_id=user_id,
            token_hash=hash_password(refresh_token),
            expires_at=datetime.now(UTC) + timedelta(minutes=settings.refresh_token_expire_minutes),
        )
        return access_token, refresh_token

    @staticmethod
    def seed_admin_if_missing(db: Session, tenant_id: str) -> User:
        repo = UserRepository(db)
        existing = repo.get_by_email(tenant_id, "admin@insightlabscrm.com")
        if existing:
            return existing

        user = User(
            tenant_id=tenant_id,
            email="admin@insightlabscrm.com",
            full_name="Admin Insightlabs",
            password_hash=hash_password("admin123"),
            role="owner",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
