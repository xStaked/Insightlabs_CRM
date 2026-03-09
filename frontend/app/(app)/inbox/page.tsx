"use client";

import { type ReactNode, useDeferredValue, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Field } from "@/components/ui/primitives";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";
import type {
  ConversationStatus,
  InboxConversation,
  InboxConversationSummary,
  InboxMessage,
  MessageChannel,
  MessageStatus,
} from "@/types/api";

const CHANNEL_OPTIONS: Array<MessageChannel | "all"> = ["all", "whatsapp", "instagram"];
const STATUS_OPTIONS: Array<ConversationStatus | "all"> = ["all", "open", "follow_up", "waiting", "closed"];

function formatTimestamp(value: string | null, mode: "full" | "time" = "full") {
  if (!value) {
    return "No activity";
  }

  return new Intl.DateTimeFormat("es-CO", {
    ...(mode === "time" ? { timeStyle: "short" } : { dateStyle: "medium", timeStyle: "short" }),
  }).format(new Date(value));
}

function formatRelativeTime(value: string | null) {
  if (!value) {
    return "No activity";
  }

  const timestamp = new Date(value).getTime();
  const diffMinutes = Math.round((timestamp - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  return formatter.format(Math.round(diffHours / 24), "day");
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

function titleize(value: string) {
  return value.replaceAll("_", " ");
}

function channelTone(channel: MessageChannel) {
  return channel === "whatsapp" ? "cold" : "warning";
}

function leadTone(temperature: string) {
  if (temperature === "hot") {
    return "hot";
  }
  if (temperature === "warm") {
    return "warm";
  }
  return "cold";
}

function statusTone(status: MessageStatus | ConversationStatus) {
  if (status === "failed") {
    return "hot";
  }
  if (status === "read" || status === "delivered" || status === "open") {
    return "cold";
  }
  if (status === "sent" || status === "received" || status === "follow_up" || status === "waiting") {
    return "warning";
  }
  return "neutral";
}

function responseCue({
  unreadCount,
  pendingOutboundCount,
  lastInboundMessage,
  lastOutboundMessage,
}: {
  unreadCount: number;
  pendingOutboundCount: number;
  lastInboundMessage: InboxMessage | null;
  lastOutboundMessage: InboxMessage | null;
}) {
  if (unreadCount > 0) {
    return {
      label: "Needs reply",
      tone: "warning" as const,
      copy: "Unread inbound activity is waiting for advisor follow-up.",
    };
  }

  if (!lastOutboundMessage && lastInboundMessage) {
    return {
      label: "First reply pending",
      tone: "hot" as const,
      copy: "The lead has written, but no outbound response has been sent yet.",
    };
  }

  if (pendingOutboundCount > 0) {
    return {
      label: "Outbound in progress",
      tone: "cold" as const,
      copy: "A queued or recently sent reply is already covering this thread.",
    };
  }

  return {
    label: "On track",
    tone: "warm" as const,
    copy: "The conversation is under control and ready for the next commercial step.",
  };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function getLastMessageByDirection(messages: InboxMessage[], direction: InboxMessage["direction"]) {
  return [...messages].reverse().find((message) => message.direction === direction) || null;
}

function buildTimeline(messages: InboxMessage[]) {
  const items: Array<{ type: "day"; key: string; label: string } | { type: "message"; key: string; message: InboxMessage }> = [];
  let lastDay = "";

  for (const message of messages) {
    const dayKey = new Date(message.created_at).toISOString().slice(0, 10);
    if (dayKey !== lastDay) {
      items.push({ type: "day", key: `day-${dayKey}`, label: formatDayLabel(message.created_at) });
      lastDay = dayKey;
    }

    items.push({ type: "message", key: message.id, message });
  }

  return items;
}

function matchesConversationSearch(conversation: InboxConversationSummary, term: string) {
  if (!term) {
    return true;
  }

  const haystack = [
    conversation.lead_name,
    conversation.assigned_advisor_name,
    conversation.lead_email,
    conversation.lead_phone,
    conversation.last_message_preview,
    conversation.lead_id,
    conversation.channel,
    conversation.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(term);
}

function ConversationListItem({
  conversation,
  active,
  onSelect,
}: {
  conversation: InboxConversationSummary;
  active: boolean;
  onSelect: () => void;
}) {
  const isWaitingOnAdvisor = conversation.unread_count > 0 || conversation.status === "waiting";

  return (
    <button
      type="button"
      className={`inbox-list__item${active ? " inbox-list__item--active" : ""}${conversation.unread_count > 0 ? " inbox-list__item--unread" : ""}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <div className="inbox-list__topline">
        <div className="inbox-list__identity">
          <span className="inbox-avatar">{getInitials(conversation.lead_name)}</span>
          <div className="inline-stack">
            <div className="inbox-list__title-row">
              <strong>{conversation.lead_name}</strong>
              <span className="inbox-list__time">{formatRelativeTime(conversation.last_message_at)}</span>
            </div>
            <p className="inbox-list__preview">{conversation.last_message_preview || "No messages yet."}</p>
          </div>
        </div>
        {conversation.unread_count > 0 ? <span className="inbox-unread-pill">{conversation.unread_count}</span> : null}
      </div>

      <div className="inbox-list__footer">
        <div className="pill-row">
          <Badge tone={channelTone(conversation.channel)}>{conversation.channel}</Badge>
          <Badge tone={statusTone(conversation.status)}>{titleize(conversation.status)}</Badge>
          {isWaitingOnAdvisor ? <Badge tone="warning">Needs attention</Badge> : null}
        </div>
        <span className="inbox-list__advisor">{conversation.assigned_advisor_name || "Unassigned"}</span>
      </div>

      <div className="inbox-list__meta">
        <span className="muted-text">{conversation.lead_email || conversation.lead_phone || `Lead ${conversation.lead_id}`}</span>
        <Badge tone={leadTone(conversation.lead_temperature)}>{conversation.lead_temperature}</Badge>
      </div>
    </button>
  );
}

function ThreadHeader({
  conversation,
  pendingOutboundCount,
  queuePosition,
  responseState,
}: {
  conversation: InboxConversation;
  pendingOutboundCount: number;
  queuePosition: number | null;
  responseState: ReturnType<typeof responseCue>;
}) {
  return (
    <header className="inbox-thread-header">
      <div className="inbox-thread-header__main">
        <div className="inbox-thread-header__identity">
          <span className="inbox-avatar inbox-avatar--large">{getInitials(conversation.lead_name)}</span>
          <div className="inline-stack">
            <div className="inbox-thread-header__title">
              <h2 className="panel-title">{conversation.lead_name}</h2>
              <div className="pill-row">
                <Badge tone={channelTone(conversation.channel)}>{conversation.channel}</Badge>
                <Badge tone={statusTone(conversation.status)}>{titleize(conversation.status)}</Badge>
                <Badge tone={leadTone(conversation.lead_temperature)}>{conversation.lead_temperature}</Badge>
              </div>
            </div>
            <div className="inbox-thread-header__facts">
              <span>Owner {conversation.assigned_advisor_name || "unassigned"}</span>
              <span>Lead {conversation.lead_id}</span>
              <span>Updated {formatRelativeTime(conversation.updated_at)}</span>
              {queuePosition ? <span>Queue #{queuePosition}</span> : null}
            </div>
            <div className="pill-row">
              {conversation.lead_phone ? <span className="inbox-chip">{conversation.lead_phone}</span> : null}
              {conversation.lead_email ? <span className="inbox-chip">{conversation.lead_email}</span> : null}
            </div>
          </div>
        </div>

        <div className="inbox-thread-header__status">
          <span className="inbox-section-label">Conversation status</span>
          <div className="inbox-thread-status-card">
            <div className="inbox-thread-status-card__topline">
              <Badge tone={responseState.tone}>{responseState.label}</Badge>
              <span className="muted-text">{formatTimestamp(conversation.updated_at, "time")}</span>
            </div>
            <p className="inbox-thread-status-card__copy">{responseState.copy}</p>
          </div>
        </div>
      </div>

      <div className="inbox-thread-header__stats" aria-label="Conversation summary">
        <div className="inbox-thread-stat">
          <span className="muted-text">Messages</span>
          <strong>{conversation.messages.length}</strong>
          <span className="muted-text">Full thread history</span>
        </div>
        <div className="inbox-thread-stat">
          <span className="muted-text">Unread</span>
          <strong>{conversation.unread_count}</strong>
          <span className="muted-text">Inbound waiting now</span>
        </div>
        <div className="inbox-thread-stat">
          <span className="muted-text">Pending outbound</span>
          <strong>{pendingOutboundCount}</strong>
          <span className="muted-text">Queued or recently sent</span>
        </div>
      </div>
    </header>
  );
}

function ComposerPanel({
  activeConversation,
  draft,
  isSending,
  sendError,
  onDraftChange,
  onSend,
}: {
  activeConversation: InboxConversation | null;
  draft: string;
  isSending: boolean;
  sendError: string | null;
  onDraftChange: (value: string) => void;
  onSend: () => void;
}) {
  if (!activeConversation) {
    return (
      <div className="inbox-composer inbox-composer--empty">
        <p className="muted-text">Select a conversation to unlock the reply composer.</p>
      </div>
    );
  }

  if (activeConversation.channel !== "whatsapp") {
    return (
      <div className="inbox-composer inbox-composer--empty">
        <p className="muted-text">Replies are currently sent from WhatsApp threads only. Instagram conversations remain visible for triage and context.</p>
      </div>
    );
  }

  return (
    <div className="inbox-composer">
      <div className="inbox-composer__header">
        <div className="inline-stack">
          <span className="inbox-section-label">Reply in thread</span>
          <p className="muted-text">Draft the next WhatsApp message in the same workflow your team uses to triage the queue.</p>
        </div>
        <Badge tone="cold">WhatsApp</Badge>
      </div>
      <Field label="Message">
        <textarea
          rows={5}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Write the next WhatsApp reply"
        />
      </Field>
      {sendError ? <div className="banner-error">{sendError}</div> : null}
      <div className="action-row inbox-composer__actions">
        <span className="muted-text">{draft.trim() ? `${draft.trim().length} characters` : "Keep the reply clear, concise, and tied to the next step."}</span>
        <Button onClick={onSend} disabled={!draft.trim() || isSending}>
          {isSending ? "Queueing..." : "Queue WhatsApp message"}
        </Button>
      </div>
    </div>
  );
}

function ContextSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="inbox-context-section">
      <h3 className="inbox-section-label">{title}</h3>
      <div className="inbox-context-section__body">{children}</div>
    </section>
  );
}

export default function InboxPage() {
  const { api } = useAuth();
  const [selectedId, setSelectedId] = useState("");
  const [channelFilter, setChannelFilter] = useState<MessageChannel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "all">("all");
  const [advisorFilter, setAdvisorFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const deferredSearch = useDeferredValue(searchTerm.trim().toLowerCase());

  const conversations = useAsyncResource(
    () =>
      api.listConversations({
        channel: channelFilter,
        status: statusFilter,
        advisor_user_id: advisorFilter,
      }),
    [api, channelFilter, statusFilter, advisorFilter],
  );

  const visibleConversations = (conversations.data || []).filter((conversation) =>
    matchesConversationSearch(conversation, deferredSearch),
  );

  useEffect(() => {
    if (visibleConversations.length === 0) {
      setSelectedId("");
      return;
    }

    if (!visibleConversations.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(visibleConversations[0].id);
    }
  }, [selectedId, visibleConversations]);

  const conversationDetail = useAsyncResource(
    () => (selectedId ? api.getConversation(selectedId) : Promise.resolve(null)),
    [api, selectedId],
    Boolean(selectedId),
  );

  async function handleSendMessage() {
    if (!conversationDetail.data || conversationDetail.data.channel !== "whatsapp" || !draft.trim()) {
      return;
    }

    setIsSending(true);
    setSendError(null);
    try {
      await api.sendWhatsAppMessage({
        conversation_id: conversationDetail.data.id,
        content: draft.trim(),
      });
      setDraft("");
      conversations.reload();
      conversationDetail.reload();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Unable to queue WhatsApp message");
    } finally {
      setIsSending(false);
    }
  }

  if (conversations.isLoading) {
    return <LoadingState title="Loading inbox" copy="Fetching conversations, ownership and message delivery status." />;
  }

  if (conversations.error) {
    return <ErrorState title="Inbox failed to load" copy={conversations.error} action={{ label: "Retry", onClick: conversations.reload }} />;
  }

  const advisorOptions = (conversations.data || []).filter(
    (conversation, index, items) =>
      conversation.assigned_user_id &&
      items.findIndex((item) => item.assigned_user_id === conversation.assigned_user_id) === index,
  );
  const activeConversation = conversationDetail.data;
  const totalUnread = visibleConversations.reduce((sum, conversation) => sum + conversation.unread_count, 0);
  const openCount = visibleConversations.filter((conversation) => conversation.status === "open").length;
  const waitingCount = visibleConversations.filter((conversation) => conversation.status === "waiting").length;
  const timeline = activeConversation ? buildTimeline(activeConversation.messages) : [];
  const lastInboundMessage = activeConversation ? getLastMessageByDirection(activeConversation.messages, "inbound") : null;
  const lastOutboundMessage = activeConversation ? getLastMessageByDirection(activeConversation.messages, "outbound") : null;
  const pendingOutboundCount = activeConversation
    ? activeConversation.messages.filter((message) => message.direction === "outbound" && ["queued", "sent"].includes(message.status)).length
    : 0;
  const responseState = responseCue({
    unreadCount: activeConversation?.unread_count || 0,
    pendingOutboundCount,
    lastInboundMessage,
    lastOutboundMessage,
  });
  const activeQueuePosition = activeConversation
    ? visibleConversations.findIndex((conversation) => conversation.id === activeConversation.id) + 1 || null
    : null;
  const assignedCount = visibleConversations.filter((conversation) => conversation.assigned_user_id).length;
  const needsReplyCount = visibleConversations.filter(
    (conversation) => conversation.unread_count > 0 || conversation.status === "waiting",
  ).length;
  const hasActiveFilters = channelFilter !== "all" || statusFilter !== "all" || advisorFilter !== "all" || Boolean(searchTerm.trim());

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Inbox"
        title="Conversation workspace"
        description="Triage the live queue, review lead context, and send replies without losing operational visibility."
        actions={
          <div className="action-row">
            <Badge tone="neutral">{visibleConversations.length} threads</Badge>
            {needsReplyCount > 0 ? <Badge tone="warning">{needsReplyCount} need reply</Badge> : null}
            {totalUnread > 0 ? <Badge tone="warning">{totalUnread} unread</Badge> : null}
            <Button variant="secondary" size="small" onClick={() => conversations.reload()}>
              Refresh inbox
            </Button>
          </div>
        }
      />

      <section className="inbox-shell">
        <aside className="inbox-sidebar">
          <div className="inbox-sidebar__header">
            <div className="inline-stack">
              <div className="eyebrow">Conversation inbox</div>
              <h2 className="panel-title">Queue</h2>
              <p className="panel-subtitle">Scan active conversations, focus the queue, and open the next thread without leaving the workspace.</p>
            </div>
            <div className="inbox-sidebar__summary" aria-label="Queue summary">
              <span>
                <strong>{openCount}</strong> open
              </span>
              <span>
                <strong>{totalUnread}</strong> unread
              </span>
              <span>
                <strong>{waitingCount}</strong> waiting
              </span>
              <span>
                <strong>{assignedCount}</strong> assigned
              </span>
            </div>
          </div>

          <div className="inbox-sidebar__filters">
            <Field label="Search">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Lead, advisor, email or message"
              />
            </Field>
            <div className="inbox-filter-grid">
              <Field label="Channel">
                <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value as MessageChannel | "all")}>
                  {CHANNEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {titleize(option)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ConversationStatus | "all")}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {titleize(option)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Advisor">
              <select value={advisorFilter} onChange={(event) => setAdvisorFilter(event.target.value)}>
                <option value="all">All advisors</option>
                {advisorOptions.map((conversation) => (
                  <option key={conversation.assigned_user_id} value={conversation.assigned_user_id || ""}>
                    {conversation.assigned_advisor_name}
                  </option>
                ))}
              </select>
            </Field>
            {hasActiveFilters ? (
              <div className="inbox-filter-summary">
                <span className="muted-text">Queue narrowed by active filters.</span>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => {
                    setSearchTerm("");
                    setChannelFilter("all");
                    setStatusFilter("all");
                    setAdvisorFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : null}
          </div>

          <div className="inbox-sidebar__list">
            {visibleConversations.length > 0 ? (
              <div className="inbox-list inbox-list--upgraded">
                {visibleConversations.map((conversation) => {
                  const active = conversation.id === selectedId;

                  return (
                    <ConversationListItem
                      key={conversation.id}
                      conversation={conversation}
                      active={active}
                      onSelect={() => setSelectedId(conversation.id)}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No conversations match"
                copy="Adjust filters or search terms. The workspace is ready, but nothing in the current queue matches the criteria."
              />
            )}
          </div>
        </aside>

        <section className="inbox-thread-panel">
          {selectedId && conversationDetail.isLoading ? (
            <LoadingState title="Loading thread" copy="Fetching the selected conversation timeline." />
          ) : conversationDetail.error ? (
            <ErrorState title="Thread failed to load" copy={conversationDetail.error} action={{ label: "Retry", onClick: conversationDetail.reload }} />
          ) : activeConversation ? (
            <>
              <ThreadHeader
                conversation={activeConversation}
                pendingOutboundCount={pendingOutboundCount}
                queuePosition={activeQueuePosition}
                responseState={responseState}
              />

              <div className="inbox-thread-scroll">
                <div className="inbox-thread-body">
                  {timeline.length > 0 ? (
                    timeline.map((item) =>
                      item.type === "day" ? (
                        <div key={item.key} className="inbox-day-separator">
                          <span>{item.label}</span>
                        </div>
                      ) : (
                        <article
                          key={item.key}
                          className={`message-bubble${item.message.direction === "outbound" ? " message-bubble--outbound" : ""}`}
                        >
                          <div className="message-bubble__meta">
                            <strong>{item.message.direction === "inbound" ? activeConversation.lead_name : "Advisor"}</strong>
                            <div className="pill-row">
                              <span className="message-bubble__timestamp">{formatTimestamp(item.message.created_at, "time")}</span>
                              <Badge tone={statusTone(item.message.status)}>{item.message.status}</Badge>
                            </div>
                          </div>
                          <p className="message-bubble__content">{item.message.content}</p>
                          {item.message.error_code ? <div className="message-bubble__error">Error: {item.message.error_code}</div> : null}
                        </article>
                      ),
                    )
                  ) : (
                    <EmptyState title="No messages yet" copy="This conversation exists, but the timeline is still empty." />
                  )}
                </div>
              </div>

              <ComposerPanel
                activeConversation={activeConversation}
                draft={draft}
                isSending={isSending}
                sendError={sendError}
                onDraftChange={setDraft}
                onSend={() => void handleSendMessage()}
              />
            </>
          ) : (
            <EmptyState
              title="Select a conversation"
              copy="Choose a thread from the queue to open its commercial context, message history and reply composer."
            />
          )}
        </section>

        <aside className="inbox-context-rail">
          <section className="inbox-context-panel">
            <div className="inline-stack">
              <div className="eyebrow">Conversation details</div>
              <h2 className="panel-title">Context</h2>
              <p className="panel-subtitle">Operational detail for ownership, timing, and next-step quality.</p>
            </div>
            {activeConversation ? (
              <div className="inbox-context-stack">
                <ContextSection title="Priority">
                  <div className="inbox-context-highlight">
                    <Badge tone={responseState.tone}>{responseState.label}</Badge>
                    <p className="inbox-detail-copy">{responseState.copy}</p>
                  </div>
                </ContextSection>

                <ContextSection title="Lead">
                  <div className="inbox-context-row">
                    <span className="muted-text">Temperature</span>
                    <Badge tone={leadTone(activeConversation.lead_temperature)}>{activeConversation.lead_temperature}</Badge>
                  </div>
                  <div className="inbox-context-row">
                    <span className="muted-text">Owner</span>
                    <strong>{activeConversation.assigned_advisor_name || "Unassigned"}</strong>
                  </div>
                  <div className="inbox-context-row">
                    <span className="muted-text">Contact</span>
                    <strong>{activeConversation.lead_phone || activeConversation.lead_email || `Lead ${activeConversation.lead_id}`}</strong>
                  </div>
                </ContextSection>

                <ContextSection title="Conversation">
                  <div className="inbox-context-row">
                    <span className="muted-text">Channel</span>
                    <strong>{activeConversation.channel}</strong>
                  </div>
                  <div className="inbox-context-row">
                    <span className="muted-text">Status</span>
                    <strong>{titleize(activeConversation.status)}</strong>
                  </div>
                  <div className="inbox-context-row">
                    <span className="muted-text">Updated</span>
                    <strong>{formatTimestamp(activeConversation.updated_at)}</strong>
                  </div>
                  <div className="inbox-context-row">
                    <span className="muted-text">Created</span>
                    <strong>{formatTimestamp(activeConversation.created_at)}</strong>
                  </div>
                </ContextSection>

                <ContextSection title="Response timing">
                  <div className="inbox-context-row inbox-context-row--stacked">
                    <span className="muted-text">Last inbound</span>
                    <strong>{lastInboundMessage ? formatRelativeTime(lastInboundMessage.created_at) : "No inbound yet"}</strong>
                    <span className="muted-text">{lastInboundMessage ? formatTimestamp(lastInboundMessage.created_at) : "Waiting for the first message."}</span>
                  </div>
                  <div className="inbox-context-row inbox-context-row--stacked">
                    <span className="muted-text">Last outbound</span>
                    <strong>{lastOutboundMessage ? formatRelativeTime(lastOutboundMessage.created_at) : "No outbound yet"}</strong>
                    <span className="muted-text">{lastOutboundMessage ? formatTimestamp(lastOutboundMessage.created_at) : "No advisor reply yet."}</span>
                  </div>
                </ContextSection>

                <ContextSection title="Follow-up signal">
                  <p className="inbox-detail-copy">
                    {activeConversation.unread_count > 0
                      ? "Unread messages are sitting in the thread. Confirm ownership quickly and move the conversation to a clear next action."
                      : "The thread is stable. Use the next reply to lock the lead into a specific commercial commitment."}
                  </p>
                  <div className="inbox-context-row">
                    <span className="muted-text">Pending outbound</span>
                    <strong>{pendingOutboundCount}</strong>
                  </div>
                  <div className="inbox-context-row">
                    <span className="muted-text">Unread inbound</span>
                    <strong>{activeConversation.unread_count}</strong>
                  </div>
                </ContextSection>
              </div>
            ) : (
              <EmptyState
                title="No context loaded"
                copy="Once a thread is selected, this rail shows timing, response cues and the commercial health of the conversation."
              />
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}
