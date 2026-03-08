from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import RefreshToken, User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, tenant_id: str, email: str) -> User | None:
        stmt = select(User).where(User.tenant_id == tenant_id, User.email == email)
        return self.db.scalar(stmt)

    def get_by_id(self, tenant_id: str, user_id: str) -> User | None:
        stmt = select(User).where(User.tenant_id == tenant_id, User.id == user_id)
        return self.db.scalar(stmt)

    def create_refresh_token(self, *, tenant_id: str, user_id: str, token_hash: str, expires_at) -> RefreshToken:
        refresh = RefreshToken(tenant_id=tenant_id, user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        self.db.add(refresh)
        self.db.commit()
        self.db.refresh(refresh)
        return refresh

    def list_active_refresh_tokens(self, *, tenant_id: str, user_id: str) -> list[RefreshToken]:
        stmt = select(RefreshToken).where(
            RefreshToken.tenant_id == tenant_id,
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(UTC),
        )
        return list(self.db.scalars(stmt).all())

    def revoke_refresh_token(self, token_id: str) -> None:
        stmt = select(RefreshToken).where(RefreshToken.id == token_id)
        token = self.db.scalar(stmt)
        if not token or token.revoked_at is not None:
            return
        token.revoked_at = datetime.now(UTC)
        self.db.commit()
