"use client";

import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Field } from "@/components/ui/primitives";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

function leadTone(temperature: string): "hot" | "warm" | "cold" {
  if (temperature === "hot") {
    return "hot";
  }
  if (temperature === "warm") {
    return "warm";
  }
  return "cold";
}

function formatProbability(value: number) {
  return `${value}%`;
}

export default function PipelinesPage() {
  const { api } = useAuth();
  const pipelines = useAsyncResource(() => api.listPipelines(), []);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [pipelineName, setPipelineName] = useState("");
  const [stageName, setStageName] = useState("");
  const [stageProbability, setStageProbability] = useState(0);
  const [stageSlaHours, setStageSlaHours] = useState("");
  const [stagePosition, setStagePosition] = useState(1);
  const [isSavingPipeline, setIsSavingPipeline] = useState(false);
  const [isSavingStage, setIsSavingStage] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const stages = useAsyncResource(() => api.listStages(selectedPipelineId), [selectedPipelineId], Boolean(selectedPipelineId));
  const kanban = useAsyncResource(() => api.getKanban(selectedPipelineId), [selectedPipelineId], Boolean(selectedPipelineId));
  const kanbanColumns = kanban.data || [];
  const selectedPipeline = (pipelines.data || []).find((pipeline) => pipeline.id === selectedPipelineId) || null;
  const activeStageCount = stages.data?.length || 0;
  const totalLeadsInBoard = kanbanColumns.reduce((total, column) => total + column.leads.length, 0);
  const stalledStageCount = kanbanColumns.filter((column) => column.leads.length === 0).length;

  useEffect(() => {
    if (!selectedPipelineId && pipelines.data?.[0]) {
      setSelectedPipelineId(pipelines.data[0].id);
    }
  }, [pipelines.data, selectedPipelineId]);

  async function handleCreatePipeline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationError(null);
    setIsSavingPipeline(true);
    try {
      const pipeline = await api.createPipeline({ name: pipelineName, is_default: !(pipelines.data?.length || 0) });
      setPipelineName("");
      pipelines.reload();
      setSelectedPipelineId(pipeline.id);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to create pipeline");
    } finally {
      setIsSavingPipeline(false);
    }
  }

  async function handleCreateStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPipelineId) {
      return;
    }
    setMutationError(null);
    setIsSavingStage(true);
    try {
      await api.createStage(selectedPipelineId, {
        name: stageName,
        position: stagePosition,
        probability: stageProbability,
        sla_hours: stageSlaHours ? Number(stageSlaHours) : null,
      });
      setStageName("");
      setStageProbability(0);
      setStageSlaHours("");
      setStagePosition((stages.data?.length || 0) + 2);
      stages.reload();
      kanban.reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to create stage");
    } finally {
      setIsSavingStage(false);
    }
  }

  async function moveLead(leadId: string, toStageId: string) {
    setMutationError(null);
    try {
      await api.moveLeadStage(leadId, { to_stage_id: toStageId });
      kanban.reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to move lead");
    }
  }

  if (pipelines.isLoading) {
    return <LoadingState title="Loading pipelines" copy="Fetching pipeline definitions and kanban metadata." />;
  }

  if (pipelines.error) {
    return <ErrorState title="Pipelines failed to load" copy={pipelines.error} action={{ label: "Retry", onClick: pipelines.reload }} />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Pipelines"
        description="Manage active sales flows, keep stage hygiene tight, and move opportunities forward without losing context."
        actions={
          selectedPipeline ? (
            <div className="pill-row">
              <Badge tone="neutral">{selectedPipeline.is_default ? "default pipeline" : "custom pipeline"}</Badge>
              <Badge tone="neutral">{selectedPipeline.is_active ? "active" : "inactive"}</Badge>
            </div>
          ) : null
        }
      />

      <section className="ops-summary-grid" aria-label="Pipeline overview">
        <article className="ops-metric-card">
          <span className="ops-metric-card__label">Pipelines</span>
          <strong className="ops-metric-card__value">{pipelines.data?.length || 0}</strong>
          <span className="muted-text">Available sales workflows for the active workspace.</span>
        </article>
        <article className="ops-metric-card">
          <span className="ops-metric-card__label">Stages in selected flow</span>
          <strong className="ops-metric-card__value">{activeStageCount}</strong>
          <span className="muted-text">Ordered stage definitions with SLA and conversion intent.</span>
        </article>
        <article className="ops-metric-card">
          <span className="ops-metric-card__label">Open cards on board</span>
          <strong className="ops-metric-card__value">{totalLeadsInBoard}</strong>
          <span className="muted-text">Leads currently distributed across the visible kanban board.</span>
        </article>
        <article className="ops-metric-card">
          <span className="ops-metric-card__label">Empty stages</span>
          <strong className="ops-metric-card__value">{stalledStageCount}</strong>
          <span className="muted-text">Columns with no active leads and no immediate work queued.</span>
        </article>
      </section>

      <section className="ops-main-grid">
        <div className="ops-sidebar-stack">
          <Card title="Pipeline directory" subtitle="Switch between active flows and keep structure changes contained to the selected board.">
            <div className="ops-list">
              {(pipelines.data || []).map((pipeline) => (
                <button
                  key={pipeline.id}
                  type="button"
                  className={`ops-list-item${pipeline.id === selectedPipelineId ? " ops-list-item--active" : ""}`}
                  onClick={() => setSelectedPipelineId(pipeline.id)}
                  aria-pressed={pipeline.id === selectedPipelineId}
                >
                  <div className="ops-list-item__header">
                    <strong>{pipeline.name}</strong>
                    <Badge tone="neutral">{pipeline.is_default ? "default" : "custom"}</Badge>
                  </div>
                  <div className="ops-list-item__meta">
                    <span>{pipeline.is_active ? "Ready for live use" : "Marked inactive"}</span>
                    <span>{pipeline.id === selectedPipelineId ? "Selected board" : "Open board"}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Add pipeline" subtitle="Use this for a new sales motion, territory, or business unit.">
            <form className="inline-stack" onSubmit={handleCreatePipeline}>
              <Field label="Pipeline name">
                <input
                  value={pipelineName}
                  onChange={(event) => setPipelineName(event.target.value)}
                  placeholder="Enterprise outbound"
                  required
                />
              </Field>
              <div className="action-row">
                <Button type="submit" disabled={isSavingPipeline}>
                  {isSavingPipeline ? "Saving..." : "Create pipeline"}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="page-stack">
          <Card
            title={selectedPipeline ? `${selectedPipeline.name} board setup` : "Board setup"}
            subtitle="Keep stage order stable, define win probability, and make SLA intent explicit for the team."
          >
            <div className="form-grid">
              <Field label="Selected pipeline">
                <select value={selectedPipelineId} onChange={(event) => setSelectedPipelineId(event.target.value)}>
                  <option value="">Select pipeline</option>
                  {(pipelines.data || []).map((pipeline) => (
                    <option key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <form className="ops-inline-form" onSubmit={handleCreateStage}>
              <Field label="Stage name">
                <input value={stageName} onChange={(event) => setStageName(event.target.value)} placeholder="Discovery" required />
              </Field>
              <Field label="Position">
                <input
                  type="number"
                  min={1}
                  value={stagePosition}
                  onChange={(event) => setStagePosition(Number(event.target.value))}
                />
              </Field>
              <Field label="Probability">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={stageProbability}
                  onChange={(event) => setStageProbability(Number(event.target.value))}
                />
              </Field>
              <Field label="SLA hours">
                <input value={stageSlaHours} onChange={(event) => setStageSlaHours(event.target.value)} placeholder="24" />
              </Field>
              <div className="ops-inline-form__action">
                <Button type="submit" disabled={isSavingStage || !selectedPipelineId}>
                  {isSavingStage ? "Saving..." : "Add stage"}
                </Button>
              </div>
            </form>
          </Card>

          {selectedPipelineId && stages.data && stages.data.length > 0 ? (
            <Card title="Stage map" subtitle="The stage order below controls the operational flow used by the kanban board.">
              <div className="ops-stage-grid">
                {stages.data.map((stage) => (
                  <article className="ops-stage-card" key={stage.id}>
                    <div className="ops-stage-card__header">
                      <strong>
                        {stage.position}. {stage.name}
                      </strong>
                      <Badge tone="neutral">{formatProbability(stage.probability)}</Badge>
                    </div>
                    <div className="ops-stage-card__meta">
                      <span>SLA</span>
                      <strong>{stage.sla_hours ? `${stage.sla_hours}h` : "Not set"}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </section>

      {mutationError ? <div className="banner-error">{mutationError}</div> : null}

      {!selectedPipelineId ? (
        <EmptyState title="No pipeline selected" copy="Create or select a pipeline to load stages and kanban columns." />
      ) : null}

      {selectedPipelineId && stages.isLoading ? (
        <LoadingState title="Loading stages" copy="Hydrating stage list and kanban columns." />
      ) : null}

      {selectedPipelineId && (stages.error || kanban.error) ? (
        <ErrorState
          title="Kanban failed to load"
          copy={stages.error || kanban.error || "Unknown error"}
          action={{
            label: "Retry",
            onClick: () => {
              stages.reload();
              kanban.reload();
            },
          }}
        />
      ) : null}

      {selectedPipelineId && kanbanColumns.length > 0 ? (
        <section className="page-stack">
          <div className="ops-section-heading">
            <div className="inline-stack">
              <h2 className="panel-title">Live board</h2>
              <p className="panel-subtitle">Advance opportunities stage by stage and keep each column operationally readable.</p>
            </div>
          </div>
          <div className="kanban-grid">
            {kanbanColumns.map((column, columnIndex) => (
              <section className="kanban-column" key={column.stage.id}>
                <div className="kanban-column__header">
                  <div className="inline-stack">
                    <h3 className="panel-title">{column.stage.name}</h3>
                    <span className="muted-text">
                      {column.leads.length} {column.leads.length === 1 ? "lead" : "leads"} · {formatProbability(column.stage.probability)}
                    </span>
                  </div>
                  <Badge tone="neutral">{column.stage.sla_hours ? `${column.stage.sla_hours}h SLA` : "No SLA"}</Badge>
                </div>
                <div className="list-stack">
                  {column.leads.length > 0 ? (
                    column.leads.map((lead) => {
                      const nextColumn = kanbanColumns[columnIndex + 1];
                      return (
                        <article className="lead-card ops-lead-card" key={lead.id}>
                          <div className="ops-lead-card__header">
                            <div className="inline-stack">
                              <strong>{lead.name}</strong>
                              <span className="muted-text">{lead.status}</span>
                            </div>
                            <Badge tone={leadTone(lead.temperature)}>{lead.temperature}</Badge>
                          </div>
                          <div className="ops-lead-card__details">
                            <span>{lead.email || lead.phone || "No contact data"}</span>
                            <span>Score {lead.score_total}</span>
                            <span>Source {lead.source_channel}</span>
                          </div>
                          <div className="ops-lead-card__footer">
                            {nextColumn ? (
                              <>
                                <span className="muted-text">Next action</span>
                                <Button size="small" variant="secondary" onClick={() => void moveLead(lead.id, nextColumn.stage.id)}>
                                  Advance to {nextColumn.stage.name}
                                </Button>
                              </>
                            ) : (
                              <span className="muted-text">Final stage reached</span>
                            )}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="ops-empty-slot">
                      <strong>No active leads</strong>
                      <span className="muted-text">This stage is ready for new cards when upstream work progresses.</span>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </section>
      ) : selectedPipelineId && !kanban.isLoading && !kanban.error ? (
        <EmptyState title="No kanban data yet" copy="Add stages first, then assign or move leads into the pipeline." />
      ) : null}
    </div>
  );
}
