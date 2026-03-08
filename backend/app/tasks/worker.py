from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "insightlabs",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.jobs.webhooks",
        "app.tasks.jobs.automations",
        "app.tasks.jobs.billing",
        "app.tasks.jobs.messaging",
    ],
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    beat_schedule={
        "run-inactivity-automation-scan": {
            "task": "automations.run_inactivity_scan",
            "schedule": crontab(minute="*/15"),
        },
        "reconcile-subscriptions": {
            "task": "billing.reconcile_subscriptions",
            "schedule": crontab(minute=0, hour="*/6"),
        },
    },
)


@celery_app.task(name="health.ping")
def ping() -> str:
    return "pong"
