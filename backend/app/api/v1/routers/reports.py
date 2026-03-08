from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps.auth import CurrentPrincipal, get_current_principal, require_roles
from app.api.deps.subscription import require_active_subscription
from app.core.db import get_db
from app.schemas.reports import (
    AdvisorSalesReportItem,
    CloseTimeReportItem,
    FunnelReportSummary,
    LeadsByChannelItem,
    LossReasonItem,
    StageConversionReportItem,
)
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get(
    "/sales-by-advisor",
    response_model=list[AdvisorSalesReportItem],
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))],
)
def get_sales_by_advisor(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[AdvisorSalesReportItem]:
    service = ReportService(db)
    return [AdvisorSalesReportItem.model_validate(item) for item in service.sales_by_advisor(principal.tenant_id)]


@router.get(
    "/conversion-by-stage",
    response_model=list[StageConversionReportItem],
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))],
)
def get_conversion_by_stage(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[StageConversionReportItem]:
    service = ReportService(db)
    return [StageConversionReportItem.model_validate(item) for item in service.conversion_by_stage(principal.tenant_id)]


@router.get(
    "/average-close-time",
    response_model=list[CloseTimeReportItem],
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))],
)
def get_average_close_time(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[CloseTimeReportItem]:
    service = ReportService(db)
    return [CloseTimeReportItem.model_validate(item) for item in service.average_close_time(principal.tenant_id)]


@router.get(
    "/lead-sources",
    response_model=list[LeadsByChannelItem],
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))],
)
def get_lead_sources(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[LeadsByChannelItem]:
    service = ReportService(db)
    return [LeadsByChannelItem.model_validate(item) for item in service.leads_by_channel(principal.tenant_id)]


@router.get(
    "/loss-reasons",
    response_model=list[LossReasonItem],
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))],
)
def get_loss_reasons(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[LossReasonItem]:
    service = ReportService(db)
    return [LossReasonItem.model_validate(item) for item in service.loss_reasons(principal.tenant_id)]


@router.get(
    "/summary",
    response_model=FunnelReportSummary,
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))],
)
def get_report_summary(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> FunnelReportSummary:
    service = ReportService(db)
    return FunnelReportSummary.model_validate(service.summary(principal.tenant_id))
