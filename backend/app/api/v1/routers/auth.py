from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.services.audit_service import AuditService
from app.api.deps.rate_limit import rate_limit
from app.core.db import get_db
from app.schemas.auth import LoginInput, LogoutInput, LogoutOutput, RefreshInput, TokenOutput
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOutput)
def login(
    payload: LoginInput,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit("auth_login", limit=10, window_seconds=60)),
) -> TokenOutput:
    tenant_id = payload.tenant_id
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="tenant_id is required")

    AuthService.seed_admin_if_missing(db, tenant_id)

    service = AuthService(db)
    try:
        access_token, refresh_token = service.login(
            tenant_id=tenant_id,
            email=payload.email,
            password=payload.password,
        )
    except ValueError as exc:
        AuditService(db).log(
            tenant_id=tenant_id,
            actor_user_id=None,
            entity="auth",
            entity_id=tenant_id,
            action="login_failed",
            payload_json={"email": payload.email, "reason": str(exc)},
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    return TokenOutput(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenOutput)
def refresh(
    payload: RefreshInput,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit("auth_refresh", limit=20, window_seconds=60)),
) -> TokenOutput:
    service = AuthService(db)
    try:
        access_token, refresh_token = service.rotate_refresh_token(payload.refresh_token)
    except ValueError as exc:
        AuditService(db).log(
            tenant_id="unknown",
            actor_user_id=None,
            entity="auth",
            entity_id="refresh",
            action="refresh_failed",
            payload_json={"reason": str(exc)},
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    return TokenOutput(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", response_model=LogoutOutput)
def logout(
    payload: LogoutInput,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit("auth_logout", limit=20, window_seconds=60)),
) -> LogoutOutput:
    service = AuthService(db)
    try:
        service.logout(payload.refresh_token)
    except ValueError as exc:
        AuditService(db).log(
            tenant_id="unknown",
            actor_user_id=None,
            entity="auth",
            entity_id="logout",
            action="logout_failed",
            payload_json={"reason": str(exc)},
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    return LogoutOutput(status="ok")
