from fastapi import APIRouter

from app.api.v1.routers import audit, automations, appointments, auth, billing, companies, health, leads, messaging, operations, pipelines, reports, tasks, webhooks

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(audit.router)
api_router.include_router(companies.router)
api_router.include_router(leads.router)
api_router.include_router(operations.router)
api_router.include_router(pipelines.router)
api_router.include_router(tasks.router)
api_router.include_router(appointments.router)
api_router.include_router(messaging.router)
api_router.include_router(billing.router)
api_router.include_router(webhooks.router)
api_router.include_router(reports.router)
api_router.include_router(automations.router)
