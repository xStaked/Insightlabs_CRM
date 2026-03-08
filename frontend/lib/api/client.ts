import type {
  Automation,
  AutomationAction,
  AutomationCondition,
  AutomationRun,
  AuditLogItem,
  AuthTokens,
  Appointment,
  AutomationTagSuggestion,
  CheckoutResponse,
  Company,
  FunnelReportSummary,
  InboxConversation,
  InboxConversationSummary,
  InboxMessage,
  KanbanColumn,
  Lead,
  LeadScoreEvent,
  LeadTag,
  OperationsStatus,
  Pipeline,
  PipelineStage,
  Plan,
  Session,
  Subscription,
  Task,
} from "@/types/api";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  requestId: string | null;

  constructor(status: number, message: string, payload: unknown, requestId: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.requestId = requestId;
  }
}

type RequestConfig = {
  getSession?: () => Session | null;
  refreshSession?: () => Promise<Session | null>;
  clearSession?: () => void;
  onAuthFailure?: (reason: "session_expired" | "tenant_mismatch" | "forbidden") => void;
  baseUrl?: string;
};

type RequestOptions = RequestInit & {
  auth?: boolean;
  retryOnAuth?: boolean;
};

export function resolveApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";
}

export function buildApiHeaders(session: Session | null, headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  result.set("Content-Type", "application/json");

  if (session?.accessToken) {
    result.set("Authorization", `Bearer ${session.accessToken}`);
  }
  if (session?.tenantId) {
    result.set("X-Tenant-ID", session.tenantId);
  }

  return result;
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function toMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = Reflect.get(payload, "detail");
    if (typeof detail === "string") {
      return detail;
    }
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return fallback;
}

export function createApiClient(config: RequestConfig = {}) {
  const baseUrl = config.baseUrl || resolveApiBaseUrl();

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const session = config.getSession?.() || null;
    const auth = options.auth ?? true;
    const retryOnAuth = options.retryOnAuth ?? true;

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: buildApiHeaders(auth ? session : null, options.headers),
    });

    if (response.status === 401 && auth && retryOnAuth && config.refreshSession && session?.refreshToken) {
      const nextSession = await config.refreshSession();
      if (nextSession) {
        return request<T>(path, { ...options, retryOnAuth: false });
      }
      config.clearSession?.();
      config.onAuthFailure?.("session_expired");
    }

    const payload = await parseResponse(response);
    const message = toMessage(payload, "Request failed");
    const requestId = response.headers.get("X-Request-ID");

    if (response.status === 403 && message === "Tenant mismatch") {
      config.clearSession?.();
      config.onAuthFailure?.("tenant_mismatch");
      throw new ApiError(
        response.status,
        requestId
          ? `Tenant mismatch. Select the correct workspace and sign in again. (request_id: ${requestId})`
          : "Tenant mismatch. Select the correct workspace and sign in again.",
        payload,
        requestId,
      );
    }

    if (response.status === 401) {
      config.clearSession?.();
      config.onAuthFailure?.("session_expired");
    }

    if (!response.ok) {
      throw new ApiError(
        response.status,
        requestId ? `${message} (request_id: ${requestId})` : message,
        payload,
        requestId,
      );
    }

    return payload as T;
  }

  return {
    request,
    listCompanies: () => request<Company[]>("/companies", { auth: false }),
    createCompany: (payload: { name: string; slug: string; timezone: string; industry?: string }) =>
      request<Company>("/companies", { method: "POST", body: JSON.stringify(payload), auth: false }),
    login: (payload: { email: string; password: string; tenant_id: string }) =>
      request<AuthTokens>("/auth/login", { method: "POST", body: JSON.stringify(payload), auth: false }),
    refresh: (refreshToken: string) =>
      request<AuthTokens>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
        auth: false,
      }),
    logout: (refreshToken: string) =>
      request<{ status: string }>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
        auth: false,
      }),
    listLeads: () => request<Lead[]>("/leads"),
    createLead: (payload: { name: string; phone?: string; email?: string; source_channel: string }) =>
      request<Lead>("/leads", { method: "POST", body: JSON.stringify(payload) }),
    moveLeadStage: (leadId: string, payload: { to_stage_id: string; reason?: string }) =>
      request<Lead>(`/leads/${leadId}/move-stage`, { method: "POST", body: JSON.stringify(payload) }),
    listPipelines: () => request<Pipeline[]>("/pipelines"),
    createPipeline: (payload: { name: string; is_default: boolean }) =>
      request<Pipeline>("/pipelines", { method: "POST", body: JSON.stringify(payload) }),
    listStages: (pipelineId: string) => request<PipelineStage[]>(`/pipelines/${pipelineId}/stages`),
    createStage: (
      pipelineId: string,
      payload: { name: string; position: number; probability: number; sla_hours?: number | null },
    ) => request<PipelineStage>(`/pipelines/${pipelineId}/stages`, { method: "POST", body: JSON.stringify(payload) }),
    getKanban: (pipelineId: string) => request<KanbanColumn[]>(`/pipelines/${pipelineId}/kanban`),
    listPlans: () => request<Plan[]>("/billing/plans", { auth: false }),
    getSubscriptionStatus: () => request<Subscription>("/billing/subscription/status"),
    createCheckout: (payload: { plan_code: string }) =>
      request<CheckoutResponse>("/billing/checkout", { method: "POST", body: JSON.stringify(payload) }),
    listConversations: (filters?: { channel?: string; status?: string; advisor_user_id?: string }) => {
      const query = new URLSearchParams();
      if (filters?.channel && filters.channel !== "all") {
        query.set("channel", filters.channel);
      }
      if (filters?.status && filters.status !== "all") {
        query.set("status", filters.status);
      }
      if (filters?.advisor_user_id && filters.advisor_user_id !== "all") {
        query.set("advisor_user_id", filters.advisor_user_id);
      }
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return request<InboxConversationSummary[]>(`/messaging/conversations${suffix}`);
    },
    getConversation: (conversationId: string) => request<InboxConversation>(`/messaging/conversations/${conversationId}`),
    sendWhatsAppMessage: (payload: { conversation_id: string; content: string }) =>
      request<InboxMessage>("/messaging/whatsapp/send", { method: "POST", body: JSON.stringify(payload) }),
    listTasks: () => request<Task[]>("/tasks"),
    createTask: (payload: {
      lead_id?: string | null;
      assigned_user_id?: string | null;
      type: string;
      due_at?: string | null;
      priority: string;
    }) => request<Task>("/tasks", { method: "POST", body: JSON.stringify(payload) }),
    updateTaskStatus: (taskId: string, status: string) =>
      request<Task>(`/tasks/${taskId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    listAppointments: () => request<Appointment[]>("/appointments"),
    createAppointment: (payload: {
      lead_id?: string | null;
      owner_user_id?: string | null;
      starts_at: string;
      ends_at: string;
      location?: string | null;
      notes?: string | null;
    }) => request<Appointment>("/appointments", { method: "POST", body: JSON.stringify(payload) }),
    updateAppointmentStatus: (appointmentId: string, status: string) =>
      request<Appointment>(`/appointments/${appointmentId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    listAutomations: () => request<Automation[]>("/automations"),
    createAutomation: (payload: {
      name: string;
      trigger_type: string;
      conditions: AutomationCondition[];
      actions: AutomationAction[];
      is_active: boolean;
    }) => request<Automation>("/automations", { method: "POST", body: JSON.stringify(payload) }),
    updateAutomation: (
      automationId: string,
      payload: {
        name?: string;
        trigger_type?: string;
        conditions?: AutomationCondition[];
        actions?: AutomationAction[];
        is_active?: boolean;
      },
    ) => request<Automation>(`/automations/${automationId}`, { method: "PATCH", body: JSON.stringify(payload) }),
    listAutomationRuns: (params?: { automation_id?: string; entity_id?: string }) => {
      const query = new URLSearchParams();
      if (params?.automation_id) {
        query.set("automation_id", params.automation_id);
      }
      if (params?.entity_id) {
        query.set("entity_id", params.entity_id);
      }
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return request<AutomationRun[]>(`/automations/runs${suffix}`);
    },
    listLeadScores: (leadId: string) => request<LeadScoreEvent[]>(`/automations/lead-scores/${leadId}`),
    listLeadTags: (leadId: string) => request<LeadTag[]>(`/automations/lead-tags/${leadId}`),
    listAutomationTagSuggestions: () => request<AutomationTagSuggestion[]>("/automations/tag-suggestions"),
    getReportSummary: () => request<FunnelReportSummary>("/reports/summary"),
    listAuditLogs: (params?: { limit?: number; entity?: string; action?: string }) => {
      const query = new URLSearchParams();
      if (params?.limit) {
        query.set("limit", String(params.limit));
      }
      if (params?.entity) {
        query.set("entity", params.entity);
      }
      if (params?.action) {
        query.set("action", params.action);
      }
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return request<AuditLogItem[]>(`/audit/logs${suffix}`);
    },
    getOperationsStatus: () => request<OperationsStatus>("/operations/status"),
  };
}
