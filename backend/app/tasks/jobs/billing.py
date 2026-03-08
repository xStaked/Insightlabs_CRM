from app.core.db import SessionLocal
from app.services.billing_service import BillingService
from app.tasks.worker import celery_app


@celery_app.task(name="billing.reconcile_subscriptions")
def reconcile_subscriptions() -> dict[str, int]:
    db = SessionLocal()
    try:
        service = BillingService(db)
        return service.run_renewal_and_suspension()
    finally:
        db.close()
