# Insightlabs CRM - Arquitectura MVP

## Enfoque
- Modular monolith en FastAPI.
- Multi-tenant por `tenant_id` (base compartida).
- Procesamiento asíncrono con Celery + Redis.
- Persistencia en PostgreSQL.

## Servicios de runtime
- `frontend`: Next.js app.
- `api`: FastAPI REST.
- `worker`: tareas async (webhooks, automations, billing).
- `scheduler`: jobs programados.
- `postgres`: base transaccional.
- `redis`: broker + cache.
- `migrations`: alembic upgrade head.

## Dominios modelados en BD
- SaaS/Billing: companies, plans, subscriptions, payments.
- IAM: users, memberships, refresh_tokens.
- CRM: leads, tags, lead_tags, pipelines, pipeline_stages, lead_stage_history.
- Mensajería: conversations, messages, webhook_events.
- Operación: automations, automation_runs, tasks, appointments, audit_logs, lead_scores.

## Reglas de multi-tenancy
- Todas las tablas de negocio contienen `tenant_id`.
- Routers de negocio requieren JWT + tenant en token.
- Header `X-Tenant-ID` debe coincidir con tenant del token.

## Flujo webhook
1. Webhook llega a `/api/v1/webhooks/{provider}`.
2. Se persiste `webhook_events` de forma idempotente (event_id único).
3. Se encola `webhooks.process_event`.
4. Worker procesa y marca `processed` o `failed`.

## Flujo auth actual
1. `POST /api/v1/auth/login` con email/password/tenant_id.
2. Bootstrap local crea admin por tenant si no existe (`admin@insightlabscrm.com` / `admin123`).
3. Emite access + refresh token.
4. Refresh token se almacena hasheado en BD.

## Próximas capas críticas
- Guard de suscripción activa por tenant.
- Integración real Meta/Wompi (firma, mapping payload, retries por tipo de error).
- Motor de automatizaciones con condiciones/acciones ejecutables.
- Auditoría automática de acciones sensibles.
