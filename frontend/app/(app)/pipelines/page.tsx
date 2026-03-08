"use client";

import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Field } from "@/components/ui/primitives";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

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
      <PageHeader title="Pipelines" description="Create pipeline structure, attach stages and operate the kanban board." />

      <div className="two-column-grid">
        <Card title="Create pipeline" subtitle="Backend access is restricted to owner/admin roles.">
          <form className="inline-stack" onSubmit={handleCreatePipeline}>
            <Field label="Pipeline name">
              <input value={pipelineName} onChange={(event) => setPipelineName(event.target.value)} required />
            </Field>
            <div className="action-row">
              <Button type="submit" disabled={isSavingPipeline}>
                {isSavingPipeline ? "Saving..." : "Create pipeline"}
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Create stage" subtitle="Appends a stage to the selected pipeline.">
          <form className="inline-stack" onSubmit={handleCreateStage}>
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
            <div className="form-grid">
              <Field label="Stage name">
                <input value={stageName} onChange={(event) => setStageName(event.target.value)} required />
              </Field>
              <Field label="Position">
                <input
                  type="number"
                  min={1}
                  value={stagePosition}
                  onChange={(event) => setStagePosition(Number(event.target.value))}
                />
              </Field>
            </div>
            <div className="form-grid">
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
                <input value={stageSlaHours} onChange={(event) => setStageSlaHours(event.target.value)} />
              </Field>
            </div>
            <div className="action-row">
              <Button type="submit" disabled={isSavingStage || !selectedPipelineId}>
                {isSavingStage ? "Saving..." : "Create stage"}
              </Button>
            </div>
          </form>
        </Card>
      </div>

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

      {selectedPipelineId && stages.data && stages.data.length > 0 ? (
        <Card title="Stage map" subtitle="Current stage order and SLA metadata.">
          <div className="pill-row">
            {stages.data.map((stage) => (
              <Badge key={stage.id} tone="neutral">
                {stage.position}. {stage.name} ({stage.probability}%)
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}

      {selectedPipelineId && kanbanColumns.length > 0 ? (
        <div className="kanban-grid">
          {kanbanColumns.map((column, columnIndex) => (
            <section className="kanban-column" key={column.stage.id}>
              <div className="kanban-column__header">
                <div className="inline-stack">
                  <h3 className="panel-title">{column.stage.name}</h3>
                  <span className="muted-text">{column.leads.length} leads</span>
                </div>
                <Badge tone="neutral">{column.stage.probability}%</Badge>
              </div>
              <div className="list-stack">
                {column.leads.length > 0 ? (
                  column.leads.map((lead) => {
                    const nextColumn = kanbanColumns[columnIndex + 1];
                    return (
                      <article className="lead-card" key={lead.id}>
                        <div className="inline-stack">
                          <strong>{lead.name}</strong>
                          <Badge tone={lead.temperature === "hot" ? "hot" : lead.temperature === "warm" ? "warm" : "cold"}>
                            {lead.temperature}
                          </Badge>
                        </div>
                        <span className="muted-text">{lead.email || lead.phone || "No contact data"}</span>
                        {nextColumn ? (
                          <Button size="small" variant="secondary" onClick={() => void moveLead(lead.id, nextColumn.stage.id)}>
                            Move to {nextColumn.stage.name}
                          </Button>
                        ) : (
                          <span className="muted-text">Final stage</span>
                        )}
                      </article>
                    );
                  })
                ) : (
                  <div className="muted-text">No leads in this stage yet.</div>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : selectedPipelineId && !kanban.isLoading && !kanban.error ? (
        <EmptyState title="No kanban data yet" copy="Add stages first, then assign or move leads into the pipeline." />
      ) : null}
    </div>
  );
}
