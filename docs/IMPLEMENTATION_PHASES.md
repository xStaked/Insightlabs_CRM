# Insightlabs CRM - Phases y Checklist

Última actualización: 2026-03-08

## Cómo usar este documento
- Cada feature implementada pasa de `[ ]` a `[x]`.
- Cada equipo toma tareas por stream sin bloquear a otros.
- Si una tarea depende de otra, se marca en `Dependencias`.

## Streams paralelos sugeridos
- `Stream A`: Core CRM (leads, pipelines, kanban, tareas, citas).
- `Stream B`: Integraciones (Meta/WhatsApp, Instagram, webhooks, delivery states).
- `Stream C`: Billing SaaS (Wompi, suscripciones, control de acceso).
- `Stream D`: Seguridad/Plataforma (auth, permisos, observabilidad, tests, CI/CD).

## Phase 0 - Foundation (Infra + Arquitectura)
- [x] Docker Compose base (`api`, `worker`, `scheduler`, `postgres`, `redis`, `frontend`, `migrations`)
- [x] Entornos `local` y `staging` por compose override
- [x] FastAPI modular monolith (routers/services/repositories/models)
- [x] SQLAlchemy + Alembic configurado
- [x] Health checks `live` y `ready` (DB + Redis)

## Phase 1 - Multi-tenant + Auth base
- [x] Estrategia `shared-db + tenant_id`
- [x] Middleware `X-Tenant-ID`
- [x] JWT access token con `tenant_id`
- [x] Login por tenant (`/auth/login`)
- [x] Persistencia de refresh tokens hasheados
- [x] Refresh token rotation endpoint
- [x] Logout/revoke endpoint
- [x] RBAC por rol (`owner/admin/advisor/viewer`) aplicado en rutas

## Phase 2 - CRM Core MVP
- [x] Empresas (`companies`) CRUD inicial
- [x] Leads (`leads`) crear/listar
- [x] Pipelines (`pipelines`) crear/listar
- [x] Stages (`pipeline_stages`) crear/listar
- [x] Mover lead de etapa + historial (`lead_stage_history`)
- [x] Kanban endpoint optimizado por etapa
- [x] Tareas internas (`tasks`) CRUD MVP
- [x] Agenda/citas (`appointments`) CRUD MVP

## Phase 3 - Billing SaaS MVP
- [x] Planes base (`starter/growth/scale`) seed
- [x] Checkout inicial (`/billing/checkout`)
- [x] Estado de suscripción (`/billing/subscription/status`)
- [x] Guard de suscripción activa en rutas de negocio
- [x] Webhook Wompi ingest + procesamiento async
- [x] Validación estricta de firma Wompi (spec final)
- [x] Renovación recurrente automática
- [x] Suspensión automática por impago fuera de gracia

## Phase 4 - Mensajería e Integraciones MVP
- [x] Ingesta webhook Meta (`/webhooks/meta`) + challenge
- [x] Persistencia idempotente de webhook events
- [x] Parser inicial Meta -> lead/conversation/message
- [x] Asociación automática por teléfono
- [x] Envío outbound WhatsApp con estado (`queued/sent/delivered/read`)
- [x] Integración Instagram inbound/outbound
- [x] Reintentos por tipo de error (429/5xx)

## Phase 5 - Automatizaciones y Scoring
- [x] Trigger async al mover etapa (`lead.stage_changed`)
- [x] Scheduler base (inactividad/reconciliación)
- [x] Motor de reglas ejecutables (`conditions_json/actions_json`)
- [x] Acciones: email, WhatsApp, crear tarea, tag, reminder
- [x] Inactividad `X` días sin respuesta
- [x] Lead scoring operativo (`lead_scores` + recalculo total)

## Phase 6 - Reportes, Seguridad y Operación
- [x] Reportes MVP: ventas por asesor
- [x] Reportes MVP: conversión por etapa
- [x] Reportes MVP: tiempo promedio de cierre
- [x] Reportes MVP: leads por canal y motivos de pérdida
- [x] Auditoría automática de acciones sensibles
- [x] Rate limit en auth/webhooks
- [x] Trazabilidad unificada (`request_id`, `tenant_id`, `user_id`)
- [x] CI: tests + lint + migraciones + build

## Dependencias clave
- `RBAC` depende de tener membership/roles aplicados en auth deps.
- `Kanban optimizado` depende de índices y queries por stage.
- `Outbound messaging` depende de credenciales provider + retries.
- `Automations engine` depende de diseño final de condiciones/acciones.

## Backlog inmediato (siguiente sprint)
- [x] Refresh token rotation + revoke
- [x] Kanban query endpoint por pipeline con agrupación por stage
- [x] Wompi signature strict mode + reconciliación diaria
- [x] Outbound WhatsApp mínimo viable
