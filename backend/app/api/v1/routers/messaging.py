from fastapi import APIRouter, Depends, HTTPException, Request, status as http_status
from sqlalchemy.orm import Session

from app.api.deps.audit import audit_action
from app.api.deps.auth import CurrentPrincipal, get_current_principal, require_roles
from app.api.deps.subscription import require_active_subscription
from app.core.db import get_db
from app.schemas.messaging import ConversationDetailOut, ConversationSummaryOut, MessageOut, OutboundMessageInput
from app.services.messaging_service import MessagingService
from app.tasks.jobs.messaging import send_outbound

router = APIRouter(prefix="/messaging", tags=["messaging"])


@router.get(
    "/conversations",
    response_model=list[ConversationSummaryOut],
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor"}))],
)
def list_conversations(
    channel: str | None = None,
    status: str | None = None,
    advisor_user_id: str | None = None,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[ConversationSummaryOut]:
    service = MessagingService(db)
    rows = service.list_conversations(
        tenant_id=principal.tenant_id,
        channel=channel,
        status=status,
        advisor_user_id=advisor_user_id,
    )
    return [
        ConversationSummaryOut(
            **{
                **row["conversation"].__dict__,
                "lead_name": row["lead_name"],
                "lead_phone": row["lead_phone"],
                "lead_email": row["lead_email"],
                "lead_temperature": row["lead_temperature"],
                "assigned_user_id": row["assigned_user_id"],
                "assigned_advisor_name": row["assigned_advisor_name"],
                "unread_count": row["unread_count"],
                "last_message_preview": row["last_message_preview"],
            }
        )
        for row in rows
    ]


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailOut,
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor"}))],
)
def get_conversation(
    conversation_id: str,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> ConversationDetailOut:
    service = MessagingService(db)
    try:
        row = service.get_conversation_detail(tenant_id=principal.tenant_id, conversation_id=conversation_id)
    except ValueError as exc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return ConversationDetailOut(
        **{
            **row["conversation"].__dict__,
            "lead_name": row["lead_name"],
            "lead_phone": row["lead_phone"],
            "lead_email": row["lead_email"],
            "lead_temperature": row["lead_temperature"],
            "assigned_user_id": row["assigned_user_id"],
            "assigned_advisor_name": row["assigned_advisor_name"],
            "unread_count": row["unread_count"],
            "last_message_preview": row["last_message_preview"],
            "messages": [MessageOut.model_validate(message, from_attributes=True) for message in row["messages"]],
        }
    )


@router.post(
    "/whatsapp/send",
    response_model=MessageOut,
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor"}))],
)
def send_whatsapp(
    payload: OutboundMessageInput,
    request: Request,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> MessageOut:
    service = MessagingService(db)
    try:
        msg = service.queue_outbound_message(
            tenant_id=principal.tenant_id,
            conversation_id=payload.conversation_id,
            content=payload.content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    audit_action(
        db,
        request,
        principal,
        entity="message",
        entity_id=msg.id,
        action="queue_whatsapp_outbound",
        payload={"conversation_id": msg.conversation_id, "message_type": msg.message_type, "status": msg.status},
    )
    send_outbound.delay(principal.tenant_id, msg.id)
    return MessageOut.model_validate(msg, from_attributes=True)


@router.post(
    "/instagram/send",
    response_model=MessageOut,
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor"}))],
)
def send_instagram(
    payload: OutboundMessageInput,
    request: Request,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> MessageOut:
    service = MessagingService(db)
    try:
        msg = service.queue_outbound_message(
            tenant_id=principal.tenant_id,
            conversation_id=payload.conversation_id,
            content=payload.content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    audit_action(
        db,
        request,
        principal,
        entity="message",
        entity_id=msg.id,
        action="queue_instagram_outbound",
        payload={"conversation_id": msg.conversation_id, "message_type": msg.message_type, "status": msg.status},
    )
    send_outbound.delay(principal.tenant_id, msg.id)
    return MessageOut.model_validate(msg, from_attributes=True)
