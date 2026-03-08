from __future__ import annotations

from pydantic import BaseModel, Field


class AdvisorSalesReportItem(BaseModel):
    advisor_user_id: str | None = None
    advisor_name: str = Field(default="Unassigned")
    won_leads: int


class StageConversionReportItem(BaseModel):
    stage_id: str
    stage_name: str
    entered_leads: int
    progressed_leads: int
    conversion_rate: float


class CloseTimeReportItem(BaseModel):
    closed_stage_type: str
    closed_leads: int
    average_hours_to_close: float


class LeadsByChannelItem(BaseModel):
    source_channel: str
    leads: int


class LossReasonItem(BaseModel):
    reason: str
    leads: int


class FunnelReportSummary(BaseModel):
    sales_by_advisor: list[AdvisorSalesReportItem]
    conversion_by_stage: list[StageConversionReportItem]
    average_close_time: list[CloseTimeReportItem]
    leads_by_channel: list[LeadsByChannelItem]
    loss_reasons: list[LossReasonItem]
