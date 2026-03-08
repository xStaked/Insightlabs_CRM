# Insightlabs CRM - Frontend Phases y Checklist

Última actualización: 2026-03-08

## Objetivo
- Separar el roadmap del frontend del plan general del backend.
- Permitir trabajo en paralelo con varios agentes sin colisiones.
- Alinear UI, data fetching y flujos con los endpoints ya existentes del API.

## Estado actual del frontend
- [x] App base en `Next.js 14` con `App Router`
- [x] `layout.tsx` global con providers
- [x] `page.tsx` con redirección por sesión
- [x] Design system real
- [x] Shell autenticado de aplicación
- [x] Cliente API compartido
- [x] Estado de sesión, tenant y guards
- [x] Pantallas de negocio
- [x] Manejo de errores, loading y empty states
- [x] Tests de frontend

## Cómo usar este documento
- Cada feature implementada pasa de `[ ]` a `[x]`.
- Cada agente debe tomar una sola phase o stream a la vez.
- Si una tarea toca layout global, tokens, auth shell o cliente API, debe coordinarse antes porque son piezas transversales.
- Priorizar entregables pequeños y mergeables: layout, providers, módulos, vistas, tests.

## Streams paralelos sugeridos
- `Stream A`: Foundation UI
  Alcance: design tokens, layout base, navegación, providers, cliente API, auth state.
- `Stream B`: CRM Core
  Alcance: leads, pipelines, stages, kanban, formularios, tareas, citas.
- `Stream C`: Billing + Integraciones
  Alcance: planes, checkout, suscripción, inbox, mensajes, webhook status, automatizaciones.
- `Stream D`: Calidad UX
  Alcance: loading states, errores, accesibilidad, responsive, tests, observabilidad de UI.

## Reglas para dividir trabajo entre agentes
- Un solo agente dueño de `app/layout.tsx`, providers globales y tokens por vez.
- Un solo agente dueño de `api client`, `auth store` y guards por vez.
- Las páginas de dominio pueden ir en paralelo si comparten contratos ya definidos.
- No mezclar rediseño visual global con implementación funcional de páginas en el mismo PR.
- Si dos agentes necesitan componentes compartidos, primero se define `ui/` y luego se consumen.

## Estructura objetivo sugerida
- `frontend/app/(public)` para login y pantallas sin sesión.
- `frontend/app/(app)` para la aplicación autenticada.
- `frontend/components/ui` para primitives reutilizables.
- `frontend/components/crm`, `frontend/components/billing`, `frontend/components/messaging` por dominio.
- `frontend/lib/api` para fetch wrappers y tipado.
- `frontend/lib/auth` para sesión, tenant y guards.
- `frontend/lib/utils` para helpers puros.
- `frontend/types` para contratos de frontend.

## Phase 0 - Foundation UI
- [x] Next.js scaffold operativo
- [x] Definir arquitectura de carpetas del frontend
- [x] Definir design tokens (`color`, `spacing`, `radius`, `shadow`, `z-index`)
- [x] Definir tipografía y estilo visual base del producto
- [x] CSS global real con responsive y foco accesible
- [x] Librería base de componentes (`Button`, `Input`, `Select`, `Badge`, `Card`, `Modal`, `Table`, `Tabs`)
- [ ] Iconografía consistente
- [x] Convención de loading, error y empty states
- [x] Convención de formularios y validación en cliente
- [x] Convención de tablas, filtros y paginación

## Phase 1 - App Shell + Auth + Tenant
- [x] Página de login por tenant
- [x] Persistencia de `access_token` y `refresh_token`
- [x] Persistencia y propagación de `tenant_id`
- [x] Cliente HTTP compartido con `Authorization` + `X-Tenant-ID`
- [x] Refresh token automático
- [x] Logout limpio
- [x] Guards para rutas autenticadas
- [x] Layout autenticado con sidebar + topbar + breadcrumb
- [x] Selector/contexto de empresa si se requiere multi-tenant visible en UI
- [x] Estados de sesión expirada y tenant inválido

## Phase 2 - CRM Core UI
- [x] Dashboard inicial con KPIs básicos
- [x] Listado de leads
- [x] Crear lead
- [x] Ver detalle de lead
- [ ] Editar detalle de lead
- [x] Gestión de pipelines
- [x] Gestión de stages
- [x] Vista kanban por pipeline
- [x] Mover lead entre etapas con feedback optimista o refresh controlado
- [ ] Historial de cambios de etapa visible en lead detail
- [x] CRUD MVP de tareas
- [x] CRUD MVP de citas/agenda
- [x] Búsqueda y filtros por canal, estado, asesor y etapa

## Phase 3 - Billing SaaS UI
- [x] Pantalla de planes
- [x] Flujo de checkout
- [x] Estado de suscripción actual
- [x] Estados de trial, activa, past_due, suspendida
- [x] Guard visual cuando el tenant no tiene acceso
- [ ] Pantalla de pagos o historial básico
- [x] Mensajes de upgrade/downgrade según plan

## Phase 4 - Inbox e Integraciones UI
- [x] Inbox unificado básico por conversación
- [x] Lista de conversaciones
- [x] Vista de conversación por lead
- [x] Timeline de mensajes inbound/outbound
- [x] Estados de mensaje (`queued`, `sent`, `delivered`, `read`, `failed`)
- [x] Composer básico para WhatsApp
- [x] Asociación visual conversación <-> lead
- [x] Indicadores de canal (`whatsapp`, `instagram`, etc.)
- [x] Filtros por estado, canal y asesor

### Notas de implementación de Phase 4
- La UI vive en `frontend/app/(app)/inbox/page.tsx`.
- El backend ya expone `GET /messaging/conversations`, `GET /messaging/conversations/{id}` y `POST /messaging/whatsapp/send`.
- Los estados `sent`, `delivered`, `read` y `failed` se actualizan desde eventos de proveedor procesados por el módulo de webhooks/meta.

## Phase 5 - Automatizaciones y Scoring UI
- [x] Listado de automatizaciones
- [x] Crear automatización
- [x] Editar automatización
- [x] Builder simple de condiciones
- [x] Builder simple de acciones
- [x] Activar/desactivar automatización
- [x] Historial de ejecuciones (`automation_runs`)
- [x] Vista de scoring por lead
- [x] Timeline de eventos de score
- [x] Badges de temperatura (`cold`, `warm`, `hot`)
- [x] Superficie para tags automáticos

## Phase 6 - Reportes, Seguridad y Operación UI
- [x] Dashboard de reportes
- [x] Reporte ventas por asesor
- [x] Reporte conversión por etapa
- [x] Reporte tiempo promedio de cierre
- [x] Reporte leads por canal
- [x] Reporte motivos de pérdida
- [x] Tabla de auditoría
- [x] Pantalla de errores operativos o eventos fallidos
- [x] Estados de rate limit y errores de auth/webhooks visibles en UI administrativa
- [x] Trazabilidad mínima en frontend (`request_id` en errores si backend lo expone)

### Implementación fase 6
- `Frontend route`: `frontend/app/(app)/reports/page.tsx`
  Consume `GET /api/v1/reports/summary` y desglosa ventas por asesor, conversión por etapa, tiempo promedio de cierre, leads por canal y motivos de pérdida.
- `Frontend route`: `frontend/app/(app)/operations/page.tsx`
  Consume `GET /api/v1/operations/status` y `GET /api/v1/audit/logs` para auditoría, eventos fallidos y estado operativo.
- `Frontend service`: `frontend/lib/api/client.ts`
  Se agregaron `getReportSummary`, `getOperationsStatus` y `listAuditLogs`.
- `Trazabilidad`: `frontend/lib/api/client.ts`
  `ApiError` ahora incorpora `requestId` y concatena `request_id` al mensaje cuando backend responde con `X-Request-ID`.

### Backend agregado para soportar fase 6 UI
- `GET /api/v1/reports/summary`
  Ya existía y se usa como agregado principal del dashboard de reportes.
- `GET /api/v1/audit/logs?limit=50&entity=&action=`
  Nuevo endpoint para tabla de auditoría en UI administrativa. Requiere rol `owner` o `admin`.
- `GET /api/v1/operations/status`
  Nuevo endpoint para exponer:
  `rate_limits`: estado resumido de `auth_login`, `auth_refresh`, `auth_logout`, `webhooks_meta`, `webhooks_wompi`.
  `failed_webhooks`: últimos webhooks fallidos para UI operativa.
- `Auth failures`
  Se registran fallos de `login`, `refresh` y `logout` en auditoría para que la UI administrativa tenga visibilidad de incidentes de autenticación.
- `CORS expose headers`
  Backend expone `X-Request-ID` para que el navegador pueda leerlo y mostrarlo en errores frontend.

## Dependencias de frontend con backend
- `Auth UI` depende de `POST /api/v1/auth/login`, `refresh`, `logout`.
- `CRM Core UI` depende de `companies`, `leads`, `pipelines`, `stages`, `tasks`, `appointments`.
- `Billing UI` depende de `plans`, `checkout`, `subscription/status`.
- `Inbox UI` depende de endpoints reales para conversaciones y mensajes; si aún no existen, usar mocks locales controlados.
- `Automations UI` depende de exponer CRUD para `automations` y lectura de `automation_runs`.
- `Reports UI` depende de endpoints agregados de reportes.

## Backlog inmediato sugerido para paralelo
- [x] Crear `frontend/lib/api/client.ts`
- [x] Crear `frontend/lib/auth/session.ts`
- [x] Crear `frontend/app/(public)/login/page.tsx`
- [x] Crear `frontend/app/(app)/layout.tsx`
- [x] Crear `frontend/components/ui` base
- [x] Crear `frontend/app/(app)/leads/page.tsx`
- [x] Crear `frontend/app/(app)/pipelines/page.tsx`
- [x] Crear `frontend/app/(app)/billing/page.tsx`
- [x] Crear `frontend/app/(app)/automations/page.tsx`

## Reparto sugerido por agentes
- `Agente 1`: Foundation UI + App Shell + Auth
- `Agente 2`: Leads + Pipelines + Kanban
- `Agente 3`: Billing + estado de suscripción
- `Agente 4`: Automatizaciones + scoring
- `Agente 5`: Inbox + mensajes
- `Agente 6`: QA UX, responsive, a11y, tests

## Entregables mínimos por stream
- Cada stream debe dejar páginas navegables aunque usen mocks temporales.
- Cada stream debe dejar componentes reutilizables, no solo páginas inline.
- Cada stream debe dejar estados `loading`, `empty` y `error`.
- Cada stream debe documentar supuestos de contrato API faltante.
