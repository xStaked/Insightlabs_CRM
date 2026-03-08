from datetime import UTC, datetime

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps.auth import CurrentPrincipal, get_current_principal
from app.core.db import get_db
from app.repositories.billing import BillingRepository


def require_active_subscription(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> str:
    repo = BillingRepository(db)
    subscription = repo.get_current_subscription(principal.tenant_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="No subscription found")

    now = datetime.now(UTC)
    if subscription.status in {"active", "trialing"}:
        return principal.tenant_id

    if subscription.status == "past_due" and subscription.grace_until and subscription.grace_until >= now:
        return principal.tenant_id

    raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Subscription inactive")
