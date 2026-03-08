from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import structlog

from app.core.security import TokenError, decode_token

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentPrincipal:
    user_id: str
    tenant_id: str
    role: str


def get_current_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentPrincipal:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    try:
        payload = decode_token(credentials.credentials)
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if payload.get("typ") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = payload.get("sub")
    token_tenant = payload.get("tenant_id")
    role = payload.get("role") or "advisor"
    header_tenant = getattr(request.state, "tenant_id", None)

    if not user_id or not token_tenant:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    if header_tenant and header_tenant != token_tenant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant mismatch")

    request.state.user_id = user_id
    structlog.contextvars.bind_contextvars(user_id=user_id, tenant_id=token_tenant)
    return CurrentPrincipal(user_id=user_id, tenant_id=token_tenant, role=role)


def require_roles(allowed_roles: set[str]) -> Callable[[CurrentPrincipal], CurrentPrincipal]:
    def _dependency(principal: CurrentPrincipal = Depends(get_current_principal)) -> CurrentPrincipal:
        if principal.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return principal

    return _dependency
