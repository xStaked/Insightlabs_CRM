import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/primitives";
import type { AutomationTagSuggestion, Lead, LeadScoreEvent, LeadTag } from "@/types/api";

function toneForPoints(points: number): "hot" | "warm" | "cold" {
  if (points >= 25) {
    return "hot";
  }
  if (points > 0) {
    return "warm";
  }
  return "cold";
}

export function LeadScorePanel({
  lead,
  events,
  tags,
  suggestions,
}: {
  lead: Lead | null;
  events: LeadScoreEvent[];
  tags: LeadTag[];
  suggestions: AutomationTagSuggestion[];
}) {
  return (
    <Card
      title="Scoring and tags"
      subtitle={lead ? `Timeline and automatic tagging for ${lead.name}.` : "Select a lead to inspect score history."}
    >
      {lead ? (
        <div className="inline-stack">
          <div className="topbar-row">
            <div className="inline-stack">
              <strong>{lead.name}</strong>
              <span className="muted-text">
                {lead.score_total} pts · {lead.temperature}
              </span>
            </div>
            <Badge tone={lead.temperature === "hot" ? "hot" : lead.temperature === "warm" ? "warm" : "cold"}>
              {lead.temperature}
            </Badge>
          </div>

          <div className="automation-tags">
            {tags.length > 0 ? tags.map((tag) => <Badge key={tag.id}>{tag.name}</Badge>) : <span className="muted-text">No automatic tags yet.</span>}
          </div>

          <div className="timeline-list">
            {events.length > 0 ? (
              events.map((event) => (
                <article className="timeline-item automation-score" key={event.id}>
                  <div className="topbar-row">
                    <strong>{event.reason}</strong>
                    <Badge tone={toneForPoints(event.points)}>{event.points > 0 ? `+${event.points}` : event.points}</Badge>
                  </div>
                  <div className="automation-run__meta">
                    <span>{event.event_type}</span>
                    <span>{new Date(event.created_at).toLocaleString()}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="muted-text">No scoring events yet for this lead.</div>
            )}
          </div>

          <div className="inline-stack">
            <strong>Tag surface</strong>
            <div className="automation-tags">
              {suggestions.length > 0 ? (
                suggestions.map((tag) => (
                  <span className="tag-chip" key={tag.name}>
                    {tag.name}
                  </span>
                ))
              ) : (
                <span className="muted-text">No tag suggestions declared in current automations.</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="muted-text">Pick a lead from the selector to inspect score events and tags.</div>
      )}
    </Card>
  );
}
