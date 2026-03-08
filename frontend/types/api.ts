export type Company = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
  industry: string | null;
};

export type Lead = {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  assigned_user_id: string | null;
  current_stage_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  source_channel: string;
  status: string;
  score_total: number;
  temperature: "cold" | "warm" | "hot" | string;
};

export type Pipeline = {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
};

export type PipelineStage = {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  pipeline_id: string;
  name: string;
  position: number;
  probability: number;
  sla_hours: number | null;
};

export type KanbanColumn = {
  stage: PipelineStage;
  leads: Lead[];
};

export type Plan = {
  id: string;
  code: string;
  name: string;
  price: number;
  currency: string;
  billing_cycle: string;
};

export type Subscription = {
  id: string;
  plan_id: string;
  status: string;
  starts_at: string;
  renews_at: string | null;
  grace_until: string | null;
};

export type CheckoutResponse = {
  subscription_id: string;
  payment_id: string;
  provider_tx_id: string | null;
  checkout_url: string;
};

export type Task = {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  lead_id: string | null;
  assigned_user_id: string | null;
  type: string;
  due_at: string | null;
  status: string;
  priority: string;
  origin: string;
};

export type Appointment = {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  lead_id: string | null;
  owner_user_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  location: string | null;
  notes: string | null;
  reminder_status: string;
};

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
};

export type AdvisorSalesReportItem = {
  advisor_user_id: string | null;
  advisor_name: string;
  won_leads: number;
};

export type StageConversionReportItem = {
  stage_id: string;
  stage_name: string;
  entered_leads: number;
  progressed_leads: number;
  conversion_rate: number;
};

export type CloseTimeReportItem = {
  closed_stage_type: string;
  closed_leads: number;
  average_hours_to_close: number;
};

export type LeadsByChannelItem = {
  source_channel: string;
  leads: number;
};

export type LossReasonItem = {
  reason: string;
  leads: number;
};

export type FunnelReportSummary = {
  sales_by_advisor: AdvisorSalesReportItem[];
  conversion_by_stage: StageConversionReportItem[];
  average_close_time: CloseTimeReportItem[];
  leads_by_channel: LeadsByChannelItem[];
  loss_reasons: LossReasonItem[];
};

export type AuditLogItem = {
  id: string;
  created_at: string;
  tenant_id: string;
  actor_user_id: string | null;
  entity: string;
  entity_id: string;
  action: string;
  payload_json: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
};

export type RateLimitStatusItem = {
  namespace: string;
  limit: number;
  window_seconds: number;
  active_keys: number;
  max_hits: number;
  retry_after_seconds: number;
  saturated: boolean;
};

export type WebhookEventItem = {
  id: string;
  created_at: string;
  tenant_id: string | null;
  provider: string;
  event_id: string;
  event_type: string;
  signature_valid: boolean;
  status: string;
  processed_at: string | null;
  error: string | null;
};

export type OperationsStatus = {
  rate_limits: RateLimitStatusItem[];
  failed_webhooks: WebhookEventItem[];
};

export type MessageChannel = "whatsapp" | "instagram";

export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "received";

export type ConversationStatus = "open" | "follow_up" | "waiting" | "closed";

export type InboxMessage = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  channel: MessageChannel;
  content: string;
  status: MessageStatus;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_code: string | null;
};

export type InboxConversationSummary = {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  lead_id: string;
  lead_name: string;
  lead_phone: string | null;
  lead_email: string | null;
  lead_temperature: Lead["temperature"];
  assigned_user_id: string | null;
  assigned_advisor_name: string;
  channel: MessageChannel;
  status: ConversationStatus;
  last_message_at: string | null;
  unread_count: number;
  last_message_preview: string | null;
};

export type InboxConversation = InboxConversationSummary & {
  messages: InboxMessage[];
};

export type AutomationCondition = {
  field: string;
  op: string;
  value: string | number | boolean | null;
};

export type AutomationAction = {
  type: string;
  task_type?: string | null;
  priority?: string | null;
  delay_hours?: number | null;
  delay_days?: number | null;
  schedule?: string | null;
  assigned_user_id?: string | null;
  name?: string | null;
  color?: string | null;
  points?: number | null;
  reason?: string | null;
  event_type?: string | null;
};

export type Automation = {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  name: string;
  trigger_type: string;
  conditions_json: { all?: AutomationCondition[] };
  actions_json: { actions?: AutomationAction[] } | AutomationAction[];
  is_active: boolean;
};

export type AutomationRun = {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  automation_id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  attempts: number;
  idempotency_key: string;
  error: string | null;
};

export type LeadScoreEvent = {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  lead_id: string;
  event_type: string;
  points: number;
  reason: string;
  metadata_json: Record<string, unknown>;
};

export type LeadTag = {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  name: string;
  color: string | null;
};

export type AutomationTagSuggestion = {
  name: string;
  color: string | null;
  source_automation_ids: string[];
};
