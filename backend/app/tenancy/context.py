from fastapi import Request


def get_tenant_id(request: Request) -> str | None:
    return getattr(request.state, "tenant_id", None)
