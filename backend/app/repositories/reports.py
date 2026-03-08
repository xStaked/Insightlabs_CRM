from __future__ import annotations

from sqlalchemy import case, distinct, func, or_, select
from sqlalchemy.orm import Session, aliased

from app.models.entities import Lead, LeadStageHistory, PipelineStage, User

WON_STAGE_TOKENS = ("won", "ganad", "cerrad ganad", "closed won")
LOST_STAGE_TOKENS = ("lost", "perdid", "cerrad perdid", "closed lost")


def _normalized_stage_name(column):
    return func.lower(func.trim(column))


def _stage_matches(column, tokens: tuple[str, ...]):
    normalized = _normalized_stage_name(column)
    return or_(*[normalized.like(f"%{token}%") for token in tokens])


class ReportsRepository:
    def __init__(self, db: Session):
        self.db = db

    def sales_by_advisor(self, tenant_id: str) -> list[dict]:
        stage = aliased(PipelineStage)
        won_case = case((_stage_matches(stage.name, WON_STAGE_TOKENS), Lead.id), else_=None)
        stmt = (
            select(
                User.id.label("advisor_user_id"),
                func.coalesce(User.full_name, "Unassigned").label("advisor_name"),
                func.count(distinct(won_case)).label("won_leads"),
            )
            .select_from(Lead)
            .join(stage, stage.id == Lead.current_stage_id)
            .outerjoin(User, User.id == Lead.assigned_user_id)
            .where(Lead.tenant_id == tenant_id, stage.tenant_id == tenant_id)
            .group_by(User.id, User.full_name)
            .having(func.count(distinct(won_case)) > 0)
            .order_by(func.count(distinct(won_case)).desc(), func.coalesce(User.full_name, "Unassigned").asc())
        )
        return [dict(row._mapping) for row in self.db.execute(stmt).all()]

    def conversion_by_stage(self, tenant_id: str) -> list[dict]:
        entered_stmt = (
            select(
                PipelineStage.id.label("stage_id"),
                PipelineStage.name.label("stage_name"),
                func.count(distinct(LeadStageHistory.lead_id)).label("entered_leads"),
            )
            .select_from(PipelineStage)
            .outerjoin(
                LeadStageHistory,
                (LeadStageHistory.to_stage_id == PipelineStage.id) & (LeadStageHistory.tenant_id == tenant_id),
            )
            .where(PipelineStage.tenant_id == tenant_id)
            .group_by(PipelineStage.id, PipelineStage.name, PipelineStage.position)
            .order_by(PipelineStage.position.asc())
        )
        progressed_stmt = (
            select(
                LeadStageHistory.from_stage_id.label("stage_id"),
                func.count(distinct(LeadStageHistory.lead_id)).label("progressed_leads"),
            )
            .where(LeadStageHistory.tenant_id == tenant_id, LeadStageHistory.from_stage_id.is_not(None))
            .group_by(LeadStageHistory.from_stage_id)
        )

        progressed_map = {
            row.stage_id: int(row.progressed_leads)
            for row in self.db.execute(progressed_stmt).all()
            if row.stage_id is not None
        }
        rows = []
        for row in self.db.execute(entered_stmt).all():
            entered = int(row.entered_leads)
            progressed = progressed_map.get(row.stage_id, 0)
            rate = round((progressed / entered) * 100, 2) if entered else 0.0
            rows.append(
                {
                    "stage_id": row.stage_id,
                    "stage_name": row.stage_name,
                    "entered_leads": entered,
                    "progressed_leads": progressed,
                    "conversion_rate": rate,
                }
            )
        return rows

    def average_close_time(self, tenant_id: str) -> list[dict]:
        closed_stage = aliased(PipelineStage)
        stmt = (
            select(
                case(
                    (_stage_matches(closed_stage.name, WON_STAGE_TOKENS), "won"),
                    else_="lost",
                ).label("closed_stage_type"),
                func.count(distinct(Lead.id)).label("closed_leads"),
                func.avg(
                    func.extract("epoch", LeadStageHistory.created_at - Lead.created_at) / 3600.0
                ).label("average_hours_to_close"),
            )
            .select_from(LeadStageHistory)
            .join(Lead, (Lead.id == LeadStageHistory.lead_id) & (Lead.tenant_id == tenant_id))
            .join(closed_stage, (closed_stage.id == LeadStageHistory.to_stage_id) & (closed_stage.tenant_id == tenant_id))
            .where(
                LeadStageHistory.tenant_id == tenant_id,
                or_(
                    _stage_matches(closed_stage.name, WON_STAGE_TOKENS),
                    _stage_matches(closed_stage.name, LOST_STAGE_TOKENS),
                ),
            )
            .group_by("closed_stage_type")
            .order_by("closed_stage_type")
        )
        return [dict(row._mapping) for row in self.db.execute(stmt).all()]

    def leads_by_channel(self, tenant_id: str) -> list[dict]:
        stmt = (
            select(Lead.source_channel, func.count(Lead.id).label("leads"))
            .where(Lead.tenant_id == tenant_id)
            .group_by(Lead.source_channel)
            .order_by(func.count(Lead.id).desc(), Lead.source_channel.asc())
        )
        return [dict(row._mapping) for row in self.db.execute(stmt).all()]

    def loss_reasons(self, tenant_id: str) -> list[dict]:
        lost_stage = aliased(PipelineStage)
        stmt = (
            select(
                func.coalesce(func.nullif(func.trim(LeadStageHistory.reason), ""), "Unspecified").label("reason"),
                func.count(distinct(LeadStageHistory.lead_id)).label("leads"),
            )
            .select_from(LeadStageHistory)
            .join(lost_stage, (lost_stage.id == LeadStageHistory.to_stage_id) & (lost_stage.tenant_id == tenant_id))
            .where(LeadStageHistory.tenant_id == tenant_id, _stage_matches(lost_stage.name, LOST_STAGE_TOKENS))
            .group_by("reason")
            .order_by(func.count(distinct(LeadStageHistory.lead_id)).desc(), "reason")
        )
        return [dict(row._mapping) for row in self.db.execute(stmt).all()]
