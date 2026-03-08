import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.api.deps.rate_limit import rate_limit
from app.integrations.meta.signature import verify_meta_signature
from app.integrations.wompi.signature import verify_wompi_signature
from app.services.webhook_service import WebhookService
from app.tasks.jobs.webhooks import process_webhook_event

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
settings = get_settings()


def _extract_event(payload: dict) -> tuple[str, str]:
    event_id = str(payload.get("id") or payload.get("event_id") or uuid.uuid4())
    event_type = str(payload.get("type") or payload.get("event") or "unknown")
    return event_id, event_type


@router.get("/meta", response_class=PlainTextResponse)
def meta_challenge(
    mode: str = Query(alias="hub.mode"),
    token: str = Query(alias="hub.verify_token"),
    challenge: str = Query(alias="hub.challenge"),
) -> str:
    if mode != "subscribe" or token != settings.meta_webhook_verify_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid challenge token")
    return challenge


@router.post("/meta")
async def meta_webhook(
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit("webhooks_meta", limit=120, window_seconds=60)),
) -> dict[str, str]:
    raw_body = await request.body()
    payload = json.loads(raw_body.decode("utf-8") or "{}")

    signature = request.headers.get("X-Hub-Signature-256")
    signature_valid = verify_meta_signature(raw_body, signature)
    if not signature_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Meta signature")

    event_id, event_type = _extract_event(payload)
    service = WebhookService(db)
    event = service.ingest(
        provider="meta",
        event_id=event_id,
        event_type=event_type,
        payload=payload,
        signature_valid=True,
        tenant_id=request.headers.get("X-Tenant-ID"),
    )

    process_webhook_event.delay(event.event_id)
    return {"status": "accepted", "event_id": event.event_id}


@router.post("/wompi")
async def wompi_webhook(
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit("webhooks_wompi", limit=120, window_seconds=60)),
) -> dict[str, str]:
    raw_body = await request.body()
    payload = json.loads(raw_body.decode("utf-8") or "{}")

    signature_header = request.headers.get("X-Wompi-Signature") or request.headers.get("x-wompi-signature")
    signature_valid = verify_wompi_signature(raw_body, signature_header)
    if not signature_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Wompi signature")

    event_id, event_type = _extract_event(payload)
    service = WebhookService(db)
    event = service.ingest(
        provider="wompi",
        event_id=event_id,
        event_type=event_type,
        payload=payload,
        signature_valid=True,
        tenant_id=request.headers.get("X-Tenant-ID"),
    )

    process_webhook_event.delay(event.event_id)
    return {"status": "accepted", "event_id": event.event_id}
