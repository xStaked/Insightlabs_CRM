from app.core.db import SessionLocal
from app.services.automation_service import AutomationService
from app.tasks.worker import celery_app


@celery_app.task(name="automations.evaluate_trigger")
def evaluate_trigger(trigger_type: str, tenant_id: str, entity_id: str) -> dict[str, int | str]:
    db = SessionLocal()
    try:
        service = AutomationService(db)
        return service.evaluate_trigger(trigger_type, tenant_id, entity_id)
    finally:
        db.close()


@celery_app.task(name="automations.run_inactivity_scan")
def run_inactivity_scan() -> dict[str, int | str]:
    db = SessionLocal()
    try:
        service = AutomationService(db)
        return service.run_inactivity_scan()
    finally:
        db.close()
