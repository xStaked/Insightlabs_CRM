"use client";

import { FormEvent, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Field } from "@/components/ui/primitives";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

export default function TasksPage() {
  const { api } = useAuth();
  const tasks = useAsyncResource(() => api.listTasks(), []);
  const leads = useAsyncResource(() => api.listLeads(), []);

  const [leadId, setLeadId] = useState("");
  const [taskType, setTaskType] = useState("follow_up");
  const [priority, setPriority] = useState("medium");
  const [dueAt, setDueAt] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleTasks = (tasks.data || []).filter((task) => statusFilter === "all" || task.status === statusFilter);

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationError(null);
    setIsSubmitting(true);
    try {
      await api.createTask({
        lead_id: leadId || null,
        type: taskType,
        priority,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      });
      setLeadId("");
      setTaskType("follow_up");
      setPriority("medium");
      setDueAt("");
      tasks.reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to create task");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function advanceStatus(taskId: string, currentStatus: string) {
    const nextStatus = currentStatus === "pending" ? "done" : "pending";
    await api.updateTaskStatus(taskId, nextStatus);
    tasks.reload();
  }

  if (tasks.isLoading || leads.isLoading) {
    return <LoadingState title="Loading tasks" copy="Fetching work queue and available lead links." />;
  }

  if (tasks.error || leads.error) {
    return <ErrorState title="Tasks failed to load" copy={tasks.error || leads.error || "Unknown error"} action={{ label: "Retry", onClick: () => window.location.reload() }} />;
  }

  return (
    <div className="page-stack">
      <PageHeader title="Tasks" description="Internal follow-ups tied to leads or managed as standalone operational tasks." />

      <div className="two-column-grid">
        <Card title="Create task" subtitle="Backed by POST /tasks.">
          <form className="inline-stack" onSubmit={handleCreateTask}>
            <Field label="Linked lead">
              <select value={leadId} onChange={(event) => setLeadId(event.target.value)}>
                <option value="">No linked lead</option>
                {(leads.data || []).map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Task type">
                <select value={taskType} onChange={(event) => setTaskType(event.target.value)}>
                  <option value="follow_up">follow_up</option>
                  <option value="email">email</option>
                  <option value="whatsapp">whatsapp</option>
                  <option value="reminder">reminder</option>
                </select>
              </Field>
              <Field label="Priority">
                <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </Field>
            </div>
            <Field label="Due at">
              <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </Field>
            {mutationError ? <div className="banner-error">{mutationError}</div> : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create task"}
            </Button>
          </form>
        </Card>

        <Card title="Task filters" subtitle="Client-side filter over the current task queue.">
          <Field label="Status">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">all</option>
              <option value="pending">pending</option>
              <option value="done">done</option>
            </select>
          </Field>
        </Card>
      </div>

      {visibleTasks.length > 0 ? (
        <div className="timeline-list">
          {visibleTasks.map((task) => (
            <article className="timeline-item" key={task.id}>
              <div className="topbar-row">
                <div className="inline-stack">
                  <strong>{task.type}</strong>
                  <span className="muted-text">Lead: {task.lead_id || "unlinked"}</span>
                </div>
                <div className="action-row">
                  <Badge tone="neutral">{task.priority}</Badge>
                  <Badge tone={task.status === "done" ? "cold" : "warning"}>{task.status}</Badge>
                  <Button size="small" variant="secondary" onClick={() => void advanceStatus(task.id, task.status)}>
                    Mark {task.status === "done" ? "pending" : "done"}
                  </Button>
                </div>
              </div>
              <div className="muted-text">Due: {task.due_at || "No due date"} · Origin: {task.origin}</div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No tasks in this view" copy="Create a task or change the active status filter." />
      )}
    </div>
  );
}
