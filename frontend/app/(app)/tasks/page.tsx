"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Field } from "@/components/ui/primitives";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

function formatDateTime(value: string | null) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getPriorityTone(priority: string): "neutral" | "warning" | "hot" {
  if (priority === "high") {
    return "hot";
  }
  if (priority === "medium") {
    return "warning";
  }
  return "neutral";
}

function getStatusTone(status: string): "cold" | "warning" {
  return status === "done" ? "cold" : "warning";
}

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

  const leadNameById = new Map((leads.data || []).map((lead) => [lead.id, lead.name]));
  const visibleTasks = [...(tasks.data || [])]
    .filter((task) => statusFilter === "all" || task.status === statusFilter)
    .sort((left, right) => {
      if (!left.due_at && !right.due_at) {
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      }
      if (!left.due_at) {
        return 1;
      }
      if (!right.due_at) {
        return -1;
      }
      return new Date(left.due_at).getTime() - new Date(right.due_at).getTime();
    });
  const pendingCount = (tasks.data || []).filter((task) => task.status === "pending").length;
  const completedCount = (tasks.data || []).filter((task) => task.status === "done").length;
  const overdueCount = (tasks.data || []).filter(
    (task) => task.status !== "done" && task.due_at && new Date(task.due_at).getTime() < Date.now(),
  ).length;

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
    setMutationError(null);
    try {
      await api.updateTaskStatus(taskId, nextStatus);
      tasks.reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to update task status");
    }
  }

  if (tasks.isLoading || leads.isLoading) {
    return <LoadingState title="Loading tasks" copy="Fetching work queue and available lead links." />;
  }

  if (tasks.error || leads.error) {
    return <ErrorState title="Tasks failed to load" copy={tasks.error || leads.error || "Unknown error"} action={{ label: "Retry", onClick: () => window.location.reload() }} />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Tasks"
        description="Track follow-ups, clear due work quickly, and keep the team operating from one visible task queue."
        actions={
          <div className="pill-row">
            <Badge tone="neutral">{visibleTasks.length} in view</Badge>
            <Badge tone="warning">{pendingCount} pending</Badge>
          </div>
        }
      />

      <section className="ops-summary-grid" aria-label="Task overview">
        <article className="ops-metric-card">
          <span className="ops-metric-card__label">Open tasks</span>
          <strong className="ops-metric-card__value">{pendingCount}</strong>
          <span className="muted-text">Pending work items still waiting for an owner action.</span>
        </article>
        <article className="ops-metric-card">
          <span className="ops-metric-card__label">Completed</span>
          <strong className="ops-metric-card__value">{completedCount}</strong>
          <span className="muted-text">Tasks already cleared from the current operating cycle.</span>
        </article>
        <article className="ops-metric-card">
          <span className="ops-metric-card__label">Overdue</span>
          <strong className="ops-metric-card__value">{overdueCount}</strong>
          <span className="muted-text">Tasks with due dates in the past and no completion update.</span>
        </article>
        <article className="ops-metric-card">
          <span className="ops-metric-card__label">Task coverage</span>
          <strong className="ops-metric-card__value">{tasks.data?.length || 0}</strong>
          <span className="muted-text">Total queue size across linked and standalone operational follow-ups.</span>
        </article>
      </section>

      {mutationError ? <div className="banner-error">{mutationError}</div> : null}

      <section className="ops-main-grid">
        <div className="page-stack">
          <Card title="Task queue" subtitle="Work the list from top to bottom. Due items stay visible, and lead-linked work remains easy to open.">
            <div className="ops-toolbar">
              <div className="ops-toolbar__search">
                <Field label="Status filter">
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="done">Done</option>
                  </select>
                </Field>
              </div>
            </div>

            {visibleTasks.length > 0 ? (
              <div className="table-wrap ops-table-wrap">
                <table className="table ops-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Lead</th>
                      <th>Due</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Origin</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTasks.map((task) => {
                      const linkedLeadName = task.lead_id ? leadNameById.get(task.lead_id) || task.lead_id : null;
                      return (
                        <tr key={task.id}>
                          <td>
                            <div className="inline-stack">
                              <strong>{task.type.replaceAll("_", " ")}</strong>
                              <span className="muted-text">Created {formatDateTime(task.created_at)}</span>
                            </div>
                          </td>
                          <td>
                            {task.lead_id ? (
                              <Link className="ops-inline-link" href={`/leads/${task.lead_id}`}>
                                {linkedLeadName}
                              </Link>
                            ) : (
                              <span className="muted-text">Standalone</span>
                            )}
                          </td>
                          <td>{formatDateTime(task.due_at)}</td>
                          <td>
                            <Badge tone={getPriorityTone(task.priority)}>{task.priority}</Badge>
                          </td>
                          <td>
                            <Badge tone={getStatusTone(task.status)}>{task.status}</Badge>
                          </td>
                          <td>{task.origin}</td>
                          <td>
                            <Button size="small" variant="secondary" onClick={() => void advanceStatus(task.id, task.status)}>
                              Mark {task.status === "done" ? "pending" : "done"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No tasks in this view" copy="Create a task or change the active status filter." />
            )}
          </Card>
        </div>

        <div className="ops-sidebar-stack">
          <Card title="Create task" subtitle="Add the next follow-up without leaving the queue.">
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
              <div className="action-row">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create task"}
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Queue notes" subtitle="Keep the task module focused on execution instead of free-form notes.">
            <div className="ops-note-list">
              <div>
                <strong>Pending first.</strong>
                <span className="muted-text">Use the default view to clear due work before triaging completed items.</span>
              </div>
              <div>
                <strong>Link when possible.</strong>
                <span className="muted-text">Lead-linked tasks keep account context one click away for reps and coordinators.</span>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
