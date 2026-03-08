from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps.audit import audit_action
from app.api.deps.auth import CurrentPrincipal, get_current_principal, require_roles
from app.core.db import get_db
from app.schemas.billing import CheckoutInput, CheckoutOut, PlanOut, SubscriptionOut
from app.services.billing_service import BillingService

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/plans", response_model=list[PlanOut])
def list_plans(db: Session = Depends(get_db)) -> list[PlanOut]:
    service = BillingService(db)
    plans = service.list_plans()
    return [PlanOut.model_validate(plan, from_attributes=True) for plan in plans]


@router.post("/checkout", response_model=CheckoutOut, dependencies=[Depends(require_roles({"owner", "admin"}))])
def create_checkout(
    payload: CheckoutInput,
    request: Request,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> CheckoutOut:
    service = BillingService(db)
    try:
        subscription, payment, checkout_url = service.create_checkout(principal.tenant_id, payload.plan_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    audit_action(
        db,
        request,
        principal,
        entity="subscription",
        entity_id=subscription.id,
        action="billing_checkout_created",
        payload={"payment_id": payment.id, "plan_code": payload.plan_code, "provider_tx_id": payment.provider_tx_id},
    )

    return CheckoutOut(
        subscription_id=subscription.id,
        payment_id=payment.id,
        provider_tx_id=payment.provider_tx_id,
        checkout_url=checkout_url,
    )


@router.get("/subscription/status", response_model=SubscriptionOut, dependencies=[Depends(require_roles({"owner", "admin"}))])
def get_subscription_status(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> SubscriptionOut:
    service = BillingService(db)
    subscription = service.get_subscription(principal.tenant_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    return SubscriptionOut.model_validate(subscription, from_attributes=True)
