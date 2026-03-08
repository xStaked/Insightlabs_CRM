# Insightlabs CRM

Scaffold técnico del MVP SaaS multi-tenant.

## Stack
- Frontend: Next.js + TypeScript
- Backend: FastAPI + SQLAlchemy + Alembic
- Async: Celery + Redis
- DB: PostgreSQL
- Infra: Docker Compose

## Arranque local
1. Crear variables:
   ```bash
   cp .env.example .env
   ```
2. Levantar stack:
   ```bash
   make up-local
   ```
3. Cargar datos demo:
   ```bash
   make seed-demo
   ```

## Servicios
- Frontend: `http://localhost:3000`
- API: `http://localhost:8000`
- Health live: `GET /api/v1/health/live`
- Health ready: `GET /api/v1/health/ready`

## Flujo base de uso
1. Crear empresa:
   - `POST /api/v1/companies`
2. Login por tenant:
   - `POST /api/v1/auth/login`
   - Body mínimo:
     ```json
     {
       "email": "admin@insightlabscrm.com",
       "password": "admin123",
       "tenant_id": "<company_id>"
     }
     ```
3. Crear checkout (habilita suscripción trialing inicial):
   - `POST /api/v1/billing/checkout`
4. Consumir rutas protegidas con:
   - `Authorization: Bearer <access_token>`
   - `X-Tenant-ID: <tenant_id>`

## Datos demo
- Comando: `make seed-demo`
- Alternativa directa backend: `cd backend && python3 -m scripts.seed_demo_data`
- Tenant demo creado: `demo-phase6`
- El script crea:
  - empresa demo multi-tenant
  - usuarios `owner/admin/advisor/viewer`
  - pipeline y stages con leads abiertos, ganados y perdidos
  - historial de etapas para reportes
  - conversaciones y mensajes para inbox
  - tareas, citas, automatizaciones y ejecuciones
  - suscripción activa y pago aprobado
  - auditoría y webhooks fallidos para la pantalla de operación
- Credenciales demo:
  - `owner@demo-crm.local / demo123`
  - `admin@demo-crm.local / demo123`
  - `ana@demo-crm.local / demo123`
  - `carlos@demo-crm.local / demo123`
  - `viewer@demo-crm.local / demo123`

## Endpoints iniciales
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST/GET /api/v1/companies`
- `POST/GET /api/v1/leads`
- `POST /api/v1/leads/{lead_id}/move-stage`
- `POST/GET /api/v1/pipelines`
- `POST/GET /api/v1/pipelines/{pipeline_id}/stages`
- `GET /api/v1/billing/plans`
- `POST /api/v1/billing/checkout`
- `GET /api/v1/billing/subscription/status`
- `GET /api/v1/webhooks/meta` (challenge Meta)
- `POST /api/v1/webhooks/meta`
- `POST /api/v1/webhooks/wompi`
- `POST/GET/PATCH /api/v1/tasks` (PATCH en `/tasks/{task_id}/status`)
- `POST/GET/PATCH /api/v1/appointments` (PATCH en `/appointments/{appointment_id}/status`)
- `POST /api/v1/messaging/whatsapp/send`
- `POST /api/v1/messaging/instagram/send`

## Multi-tenant y billing guard
- Las rutas de negocio (`leads`, `pipelines`) exigen JWT válido y tenant consistente.
- Además exigen suscripción en estado `active`, `trialing` o `past_due` dentro de gracia.

## Automatizaciones y eventos
- Mover lead de etapa encola trigger async `lead.stage_changed`.
- Webhooks se guardan primero en `webhook_events` y luego se procesan en worker.

## Migraciones
- `0001_initial`
- `0002_domain_tables`

## Calidad y CI
- Backend lint: `make backend-lint`
- Backend tests: `make backend-test`
- Frontend lint: `make frontend-lint`
- Frontend build: `make frontend-build`
- CI GitHub Actions: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

## Arquitectura
Ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
