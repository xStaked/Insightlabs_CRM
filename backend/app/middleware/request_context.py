from __future__ import annotations

import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        structlog.contextvars.clear_contextvars()

        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        tenant_id = request.headers.get("X-Tenant-ID")

        request.state.request_id = request_id
        structlog.contextvars.bind_contextvars(request_id=request_id, tenant_id=tenant_id)

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
