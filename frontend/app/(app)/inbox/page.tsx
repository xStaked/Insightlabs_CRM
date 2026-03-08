"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Field } from "@/components/ui/primitives";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";
import type { ConversationStatus, MessageChannel, MessageStatus } from "@/types/api";

const CHANNEL_OPTIONS: Array<MessageChannel | "all"> = ["all", "whatsapp", "instagram"];
const STATUS_OPTIONS: Array<ConversationStatus | "all"> = ["all", "open", "follow_up", "waiting", "closed"];

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No activity";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function channelTone(channel: MessageChannel) {
  return channel === "whatsapp" ? "cold" : "warning";
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

export default function InboxPage() {
  const { api } = useAuth();
  const [selectedId, setSelectedId] = useState("");
  const [channelFilter, setChannelFilter] = useState<MessageChannel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "all">("all");
  const [advisorFilter, setAdvisorFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const conversations = useAsyncResource(
    () =>
      api.listConversations({
        channel: channelFilter,
        status: statusFilter,
        advisor_user_id: advisorFilter,
      }),
    [api, channelFilter, statusFilter, advisorFilter],
  );

  useEffect(() => {
    const current = conversations.data || [];
    if (current.length === 0) {
      setSelectedId("");
      return;
    }

    if (!current.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(current[0].id);
    }
  }, [conversations.data, selectedId]);

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

  return (
    <div className="page-stack">
      <PageHeader
        title="Inbox"
        description="Unified inbox backed by messaging conversations, lead associations and outbound WhatsApp actions."
      />

      <div className="three-column-grid">
        <Card title="Conversations" subtitle="Filters for channel, owner and lifecycle state.">
          <div className="inline-stack">
            <div className="form-grid">
              <Field label="Channel">
                <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value as MessageChannel | "all")}>
                  {CHANNEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ConversationStatus | "all")}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Advisor">
              <select value={advisorFilter} onChange={(event) => setAdvisorFilter(event.target.value)}>
                <option value="all">all</option>
                {advisorOptions.map((conversation) => (
                  <option key={conversation.assigned_user_id} value={conversation.assigned_user_id || ""}>
                    {conversation.assigned_advisor_name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {conversations.data && conversations.data.length > 0 ? (
            <div className="inbox-list">
              {conversations.data.map((conversation) => {
                const active = conversation.id === selectedId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    className={`inbox-list__item${active ? " inbox-list__item--active" : ""}`}
                    onClick={() => setSelectedId(conversation.id)}
                  >
                    <div className="topbar-row">
                      <strong>{conversation.lead_name}</strong>
                      <span className="muted-text">{formatTimestamp(conversation.last_message_at)}</span>
                    </div>
                    <div className="pill-row">
                      <Badge tone={channelTone(conversation.channel)}>{conversation.channel}</Badge>
                      <Badge tone={statusTone(conversation.status)}>{conversation.status}</Badge>
                      <Badge
                        tone={
                          conversation.lead_temperature === "hot"
                            ? "hot"
                            : conversation.lead_temperature === "warm"
                              ? "warm"
                              : "cold"
                        }
                      >
                        {conversation.lead_temperature}
                      </Badge>
                    </div>
                    <div className="topbar-row">
                      <span className="muted-text">Lead: {conversation.lead_id}</span>
                      <span className="muted-text">{conversation.assigned_advisor_name}</span>
                    </div>
                    <p className="inbox-list__preview">{conversation.last_message_preview || "No messages yet"}</p>
                    {conversation.unread_count > 0 ? <Badge tone="warning">{conversation.unread_count} unread</Badge> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No conversations found" copy="Inbox data appears here once the tenant starts receiving or sending messages." />
          )}
        </Card>

        <div className="inbox-thread-column">
          {selectedId && conversationDetail.isLoading ? (
            <LoadingState title="Loading thread" copy="Fetching the selected conversation timeline." />
          ) : conversationDetail.error ? (
            <ErrorState title="Thread failed to load" copy={conversationDetail.error} action={{ label: "Retry", onClick: conversationDetail.reload }} />
          ) : activeConversation ? (
            <>
              <Card
                title={activeConversation.lead_name}
                subtitle={`Lead-linked conversation in ${activeConversation.channel}.`}
                actions={
                  <div className="pill-row">
                    <Badge tone={channelTone(activeConversation.channel)}>{activeConversation.channel}</Badge>
                    <Badge tone={statusTone(activeConversation.status)}>{activeConversation.status}</Badge>
                  </div>
                }
              >
                <div className="topbar-row">
                  <div className="inline-stack">
                    <span className="muted-text">Lead ID</span>
                    <strong>{activeConversation.lead_id}</strong>
                  </div>
                  <div className="inline-stack">
                    <span className="muted-text">Advisor</span>
                    <strong>{activeConversation.assigned_advisor_name}</strong>
                  </div>
                </div>
              </Card>

              <Card title="Timeline" subtitle="Inbound and outbound messages with delivery states.">
                <div className="message-stack">
                  {activeConversation.messages.map((message) => (
                    <article
                      key={message.id}
                      className={`message-bubble${message.direction === "outbound" ? " message-bubble--outbound" : ""}`}
                    >
                      <div className="topbar-row">
                        <strong>{message.direction === "inbound" ? activeConversation.lead_name : "Advisor"}</strong>
                        <Badge tone={statusTone(message.status)}>{message.status}</Badge>
                      </div>
                      <p className="message-bubble__content">{message.content}</p>
                      <div className="topbar-row">
                        <span className="muted-text">{formatTimestamp(message.created_at)}</span>
                        {message.error_code ? <span className="muted-text">Error: {message.error_code}</span> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </Card>

              <Card title="WhatsApp composer" subtitle="Queues outbound messages against the live messaging API.">
                {activeConversation.channel === "whatsapp" ? (
                  <div className="inline-stack">
                    <Field label="Reply">
                      <textarea
                        rows={4}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Write the next WhatsApp reply"
                      />
                    </Field>
                    {sendError ? <div className="banner-error">{sendError}</div> : null}
                    <div className="action-row">
                      <Button onClick={() => void handleSendMessage()} disabled={!draft.trim() || isSending}>
                        {isSending ? "Queueing..." : "Queue WhatsApp message"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="Composer not enabled for this channel"
                    copy="The interactive composer remains intentionally limited to WhatsApp for this phase."
                  />
                )}
              </Card>
            </>
          ) : (
            <EmptyState title="Select a conversation" copy="The thread pane appears after choosing a conversation from the left column." />
          )}
        </div>
      </div>
    </div>
  );
}
