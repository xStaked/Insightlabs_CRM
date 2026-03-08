from __future__ import annotations

import argparse
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import delete, select

from app.core.db import SessionLocal, get_engine
from app.core.security import hash_password
from app.models.entities import (
    Appointment,
    AuditLog,
    Automation,
    AutomationRun,
    Company,
    Conversation,
    Lead,
    LeadScore,
    LeadStageHistory,
    LeadTag,
    Membership,
    Message,
    Payment,
    Pipeline,
    PipelineStage,
    Plan,
    Subscription,
    Tag,
    Task,
    User,
    WebhookEvent,
)
from app.repositories.billing import BillingRepository


DEMO_PASSWORD = "demo123"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed demo data for Insightlabs CRM.")
    parser.add_argument("--slug", default="demo-phase6", help="Company slug for the demo tenant.")
    parser.add_argument("--name", default="Insightlabs Demo Phase 6", help="Company display name.")
    parser.add_argument("--timezone", default="America/Bogota", help="Company timezone.")
    return parser.parse_args()


def upsert_company(db, *, slug: str, name: str, timezone: str) -> Company:
    company = db.scalar(select(Company).where(Company.slug == slug))
    if company:
        company.name = name
        company.timezone = timezone
        company.status = "active"
        company.industry = "SaaS"
        db.commit()
        db.refresh(company)
        return company

    company = Company(
        name=name,
        slug=slug,
        timezone=timezone,
        status="active",
        industry="SaaS",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def reset_demo_tenant(db, tenant_id: str) -> None:
    db.execute(delete(WebhookEvent).where(WebhookEvent.tenant_id == tenant_id))
    db.execute(delete(AuditLog).where(AuditLog.tenant_id == tenant_id))
    db.execute(delete(Payment).where(Payment.tenant_id == tenant_id))
    db.execute(delete(Subscription).where(Subscription.tenant_id == tenant_id))
    db.execute(delete(Appointment).where(Appointment.tenant_id == tenant_id))
    db.execute(delete(Task).where(Task.tenant_id == tenant_id))
    db.execute(delete(Message).where(Message.tenant_id == tenant_id))
    db.execute(delete(Conversation).where(Conversation.tenant_id == tenant_id))
    db.execute(delete(AutomationRun).where(AutomationRun.tenant_id == tenant_id))
    db.execute(delete(Automation).where(Automation.tenant_id == tenant_id))
    db.execute(delete(LeadTag).where(LeadTag.tenant_id == tenant_id))
    db.execute(delete(Tag).where(Tag.tenant_id == tenant_id))
    db.execute(delete(LeadScore).where(LeadScore.tenant_id == tenant_id))
    db.execute(delete(LeadStageHistory).where(LeadStageHistory.tenant_id == tenant_id))
    db.execute(delete(Lead).where(Lead.tenant_id == tenant_id))
    db.execute(delete(PipelineStage).where(PipelineStage.tenant_id == tenant_id))
    db.execute(delete(Pipeline).where(Pipeline.tenant_id == tenant_id))
    db.execute(delete(Membership).where(Membership.tenant_id == tenant_id))
    db.execute(delete(User).where(User.tenant_id == tenant_id))
    db.commit()


def create_user(db, *, tenant_id: str, email: str, full_name: str, role: str) -> User:
    user = User(
        tenant_id=tenant_id,
        email=email,
        full_name=full_name,
        password_hash=hash_password(DEMO_PASSWORD),
        role=role,
        is_active=True,
        last_login_at=datetime.now(UTC) - timedelta(hours=2),
    )
    db.add(user)
    db.flush()
    return user


def create_stage(db, *, tenant_id: str, pipeline_id: str, name: str, position: int, probability: int) -> PipelineStage:
    stage = PipelineStage(
        tenant_id=tenant_id,
        pipeline_id=pipeline_id,
        name=name,
        position=position,
        probability=probability,
    )
    db.add(stage)
    db.flush()
    return stage


def create_lead(
    db,
    *,
    tenant_id: str,
    assigned_user_id: str | None,
    current_stage_id: str,
    name: str,
    phone: str,
    email: str,
    source_channel: str,
    status: str,
    score_total: int,
    temperature: str,
    created_at: datetime,
) -> Lead:
    lead = Lead(
        tenant_id=tenant_id,
        assigned_user_id=assigned_user_id,
        current_stage_id=current_stage_id,
        name=name,
        phone=phone,
        email=email,
        source_channel=source_channel,
        status=status,
        score_total=score_total,
        temperature=temperature,
        created_at=created_at,
        updated_at=created_at,
    )
    db.add(lead)
    db.flush()
    return lead


def add_history(
    db,
    *,
    tenant_id: str,
    lead_id: str,
    from_stage_id: str | None,
    to_stage_id: str,
    changed_by_user_id: str,
    created_at: datetime,
    reason: str | None = None,
) -> None:
    db.add(
        LeadStageHistory(
            tenant_id=tenant_id,
            lead_id=lead_id,
            from_stage_id=from_stage_id,
            to_stage_id=to_stage_id,
            changed_by_user_id=changed_by_user_id,
            reason=reason,
            created_at=created_at,
            updated_at=created_at,
        )
    )


def seed_demo_data(*, slug: str, name: str, timezone: str) -> None:
    get_engine()
    db = SessionLocal()

    try:
        BillingRepository(db).seed_default_plans()
        company = upsert_company(db, slug=slug, name=name, timezone=timezone)
        reset_demo_tenant(db, company.id)

        now = datetime.now(UTC)

        owner = create_user(db, tenant_id=company.id, email="owner@demo-crm.local", full_name="Valeria Soto", role="owner")
        admin = create_user(db, tenant_id=company.id, email="admin@demo-crm.local", full_name="Daniel Rojas", role="admin")
        advisor_a = create_user(db, tenant_id=company.id, email="ana@demo-crm.local", full_name="Ana Perez", role="advisor")
        advisor_b = create_user(db, tenant_id=company.id, email="carlos@demo-crm.local", full_name="Carlos Mejia", role="advisor")
        viewer = create_user(db, tenant_id=company.id, email="viewer@demo-crm.local", full_name="Laura Torres", role="viewer")

        for user in [owner, admin, advisor_a, advisor_b, viewer]:
            db.add(
                Membership(
                    tenant_id=company.id,
                    user_id=user.id,
                    company_id=company.id,
                    role=user.role,
                    is_active=True,
                )
            )

        pipeline = Pipeline(
            tenant_id=company.id,
            name="Ventas B2B",
            is_default=True,
            is_active=True,
        )
        db.add(pipeline)
        db.flush()

        stage_new = create_stage(db, tenant_id=company.id, pipeline_id=pipeline.id, name="New", position=1, probability=10)
        stage_contacted = create_stage(db, tenant_id=company.id, pipeline_id=pipeline.id, name="Contacted", position=2, probability=25)
        stage_demo = create_stage(db, tenant_id=company.id, pipeline_id=pipeline.id, name="Demo Scheduled", position=3, probability=45)
        stage_proposal = create_stage(db, tenant_id=company.id, pipeline_id=pipeline.id, name="Proposal", position=4, probability=70)
        stage_won = create_stage(db, tenant_id=company.id, pipeline_id=pipeline.id, name="Closed Won", position=5, probability=100)
        stage_lost = create_stage(db, tenant_id=company.id, pipeline_id=pipeline.id, name="Closed Lost", position=6, probability=0)

        hot = Tag(tenant_id=company.id, name="VIP", color="#B9382F")
        nurture = Tag(tenant_id=company.id, name="Nurture", color="#C97A2B")
        enterprise = Tag(tenant_id=company.id, name="Enterprise", color="#0F766E")
        db.add_all([hot, nurture, enterprise])
        db.flush()

        leads_spec = [
            ("Acme SAS", advisor_a, stage_won, "whatsapp", "won", 92, "hot", 18, None),
            ("Nova Retail", advisor_a, stage_won, "instagram", "won", 88, "hot", 15, None),
            ("Clarity Foods", advisor_b, stage_won, "web", "won", 81, "warm", 12, None),
            ("Orbital Health", advisor_b, stage_lost, "whatsapp", "lost", 54, "warm", 11, "No budget"),
            ("Punto Legal", advisor_a, stage_lost, "manual", "lost", 48, "cold", 10, "Sin respuesta"),
            ("Delta Cargo", advisor_b, stage_proposal, "web", "new", 73, "warm", 8, None),
            ("Faro Studio", advisor_a, stage_demo, "instagram", "new", 61, "warm", 7, None),
            ("Kubo Dental", advisor_b, stage_contacted, "whatsapp", "new", 46, "cold", 5, None),
            ("Menta Market", None, stage_new, "web", "new", 24, "cold", 3, None),
            ("Selva Coffee", advisor_a, stage_contacted, "manual", "new", 39, "cold", 2, None),
        ]

        leads: list[Lead] = []
        for index, (lead_name, owner_user, final_stage, source, status, score, temperature, age_days, lost_reason) in enumerate(leads_spec, start=1):
            created_at = now - timedelta(days=age_days)
            lead = create_lead(
                db,
                tenant_id=company.id,
                assigned_user_id=owner_user.id if owner_user else None,
                current_stage_id=final_stage.id,
                name=lead_name,
                phone=f"+573001000{index:02d}",
                email=f"contacto{index}@demo-crm.local",
                source_channel=source,
                status=status,
                score_total=score,
                temperature=temperature,
                created_at=created_at,
            )
            leads.append(lead)

            track = [stage_new]
            if final_stage.position >= stage_contacted.position:
                track.append(stage_contacted)
            if final_stage.position >= stage_demo.position:
                track.append(stage_demo)
            if final_stage.position >= stage_proposal.position:
                track.append(stage_proposal)
            if final_stage.id in {stage_won.id, stage_lost.id}:
                track.append(final_stage)

            for stage_index, stage in enumerate(track):
                history_at = created_at + timedelta(days=stage_index + 1)
                add_history(
                    db,
                    tenant_id=company.id,
                    lead_id=lead.id,
                    from_stage_id=track[stage_index - 1].id if stage_index > 0 else None,
                    to_stage_id=stage.id,
                    changed_by_user_id=(owner_user or admin).id,
                    created_at=history_at,
                    reason=lost_reason if stage.id == stage_lost.id else None,
                )

        db.add_all(
            [
                LeadTag(tenant_id=company.id, lead_id=leads[0].id, tag_id=hot.id),
                LeadTag(tenant_id=company.id, lead_id=leads[0].id, tag_id=enterprise.id),
                LeadTag(tenant_id=company.id, lead_id=leads[3].id, tag_id=nurture.id),
                LeadTag(tenant_id=company.id, lead_id=leads[5].id, tag_id=enterprise.id),
            ]
        )

        for lead in leads:
            db.add(
                LeadScore(
                    tenant_id=company.id,
                    lead_id=lead.id,
                    event_type="seed_score",
                    points=lead.score_total,
                    reason="Demo seed baseline",
                    metadata_json={"source_channel": lead.source_channel},
                    created_at=lead.created_at + timedelta(hours=2),
                    updated_at=lead.created_at + timedelta(hours=2),
                )
            )

        automation_stage = Automation(
            tenant_id=company.id,
            name="Follow up after demo",
            trigger_type="lead.stage_changed",
            conditions_json={"all": [{"field": "to_stage_name", "op": "eq", "value": "Demo Scheduled"}]},
            actions_json={"actions": [{"type": "create_task", "task_type": "follow_up", "priority": "high"}]},
            is_active=True,
        )
        automation_idle = Automation(
            tenant_id=company.id,
            name="Inactividad 3 dias",
            trigger_type="lead.inactive",
            conditions_json={"all": [{"field": "days_without_reply", "op": "gte", "value": 3}]},
            actions_json={"actions": [{"type": "tag", "name": "Nurture", "color": "#C97A2B"}]},
            is_active=True,
        )
        db.add_all([automation_stage, automation_idle])
        db.flush()

        db.add_all(
            [
                AutomationRun(
                    tenant_id=company.id,
                    automation_id=automation_stage.id,
                    entity_type="lead",
                    entity_id=leads[6].id,
                    status="completed",
                    attempts=1,
                    idempotency_key=f"seed-run-{automation_stage.id}-1",
                    error=None,
                ),
                AutomationRun(
                    tenant_id=company.id,
                    automation_id=automation_idle.id,
                    entity_type="lead",
                    entity_id=leads[7].id,
                    status="failed",
                    attempts=3,
                    idempotency_key=f"seed-run-{automation_idle.id}-1",
                    error="Provider timeout while sending reminder",
                ),
            ]
        )

        tasks = [
            Task(
                tenant_id=company.id,
                lead_id=leads[5].id,
                assigned_user_id=advisor_b.id,
                type="follow_up",
                due_at=now + timedelta(days=1),
                status="pending",
                priority="high",
                origin="manual",
            ),
            Task(
                tenant_id=company.id,
                lead_id=leads[6].id,
                assigned_user_id=advisor_a.id,
                type="email",
                due_at=now + timedelta(hours=6),
                status="pending",
                priority="medium",
                origin="automation",
            ),
            Task(
                tenant_id=company.id,
                lead_id=leads[0].id,
                assigned_user_id=advisor_a.id,
                type="handoff",
                due_at=now - timedelta(days=1),
                status="done",
                priority="low",
                origin="manual",
            ),
        ]
        db.add_all(tasks)

        appointments = [
            Appointment(
                tenant_id=company.id,
                lead_id=leads[5].id,
                owner_user_id=advisor_b.id,
                starts_at=now + timedelta(days=1, hours=2),
                ends_at=now + timedelta(days=1, hours=3),
                status="scheduled",
                location="Google Meet",
                notes="Revisar propuesta enterprise",
                reminder_status="pending",
            ),
            Appointment(
                tenant_id=company.id,
                lead_id=leads[6].id,
                owner_user_id=advisor_a.id,
                starts_at=now + timedelta(hours=20),
                ends_at=now + timedelta(hours=21),
                status="scheduled",
                location="Zoom",
                notes="Demo comercial",
                reminder_status="pending",
            ),
        ]
        db.add_all(appointments)

        convo_a = Conversation(
            tenant_id=company.id,
            lead_id=leads[0].id,
            assigned_user_id=advisor_a.id,
            channel="whatsapp",
            external_thread_id="wa-acme-001",
            status="open",
            last_message_at=now - timedelta(hours=1),
        )
        convo_b = Conversation(
            tenant_id=company.id,
            lead_id=leads[3].id,
            assigned_user_id=advisor_b.id,
            channel="instagram",
            external_thread_id="ig-orbital-001",
            status="waiting",
            last_message_at=now - timedelta(hours=5),
        )
        convo_c = Conversation(
            tenant_id=company.id,
            lead_id=leads[6].id,
            assigned_user_id=advisor_a.id,
            channel="whatsapp",
            external_thread_id="wa-faro-001",
            status="follow_up",
            last_message_at=now - timedelta(minutes=30),
        )
        db.add_all([convo_a, convo_b, convo_c])
        db.flush()

        db.add_all(
            [
                Message(
                    tenant_id=company.id,
                    conversation_id=convo_a.id,
                    direction="inbound",
                    provider_message_id="wa-in-1",
                    content="Hola, quiero una demo para mi equipo.",
                    message_type="text",
                    status="read",
                    sent_at=now - timedelta(hours=3),
                    delivered_at=now - timedelta(hours=3),
                    read_at=now - timedelta(hours=2, minutes=50),
                    created_at=now - timedelta(hours=3),
                    updated_at=now - timedelta(hours=3),
                ),
                Message(
                    tenant_id=company.id,
                    conversation_id=convo_a.id,
                    direction="outbound",
                    provider_message_id="wa-out-1",
                    content="Perfecto, te comparto agenda para esta tarde.",
                    message_type="text",
                    status="delivered",
                    sent_at=now - timedelta(hours=2),
                    delivered_at=now - timedelta(hours=2),
                    created_at=now - timedelta(hours=2),
                    updated_at=now - timedelta(hours=2),
                ),
                Message(
                    tenant_id=company.id,
                    conversation_id=convo_b.id,
                    direction="inbound",
                    provider_message_id="ig-in-1",
                    content="No tenemos presupuesto este trimestre.",
                    message_type="text",
                    status="received",
                    sent_at=now - timedelta(hours=5),
                    created_at=now - timedelta(hours=5),
                    updated_at=now - timedelta(hours=5),
                ),
                Message(
                    tenant_id=company.id,
                    conversation_id=convo_c.id,
                    direction="outbound",
                    provider_message_id="wa-out-2",
                    content="Te confirmo demo manana a las 10am.",
                    message_type="text",
                    status="failed",
                    error_code="provider_timeout",
                    created_at=now - timedelta(minutes=30),
                    updated_at=now - timedelta(minutes=30),
                ),
            ]
        )

        plans = {plan.code: plan for plan in db.scalars(select(Plan)).all()}
        growth_plan = plans["growth"]
        subscription = Subscription(
            tenant_id=company.id,
            plan_id=growth_plan.id,
            status="active",
            starts_at=now - timedelta(days=20),
            renews_at=now + timedelta(days=10),
            grace_until=None,
            external_ref="sub_demo_phase6",
        )
        db.add(subscription)
        db.flush()

        db.add(
            Payment(
                tenant_id=company.id,
                subscription_id=subscription.id,
                provider="wompi",
                provider_tx_id="wompi_demo_tx_001",
                amount=Decimal("149000.00"),
                currency="COP",
                status="paid",
                paid_at=now - timedelta(days=19),
                raw_payload={"reference": "seed-payment-001", "status": "paid"},
            )
        )

        db.add_all(
            [
                AuditLog(
                    tenant_id=company.id,
                    actor_user_id=admin.id,
                    entity="lead",
                    entity_id=leads[0].id,
                    action="move_stage",
                    payload_json={"to_stage": "Closed Won"},
                    ip="127.0.0.1",
                    user_agent="seed-script",
                ),
                AuditLog(
                    tenant_id=company.id,
                    actor_user_id=advisor_b.id,
                    entity="auth",
                    entity_id=company.id,
                    action="login_failed",
                    payload_json={"email": "ana@demo-crm.local", "reason": "Invalid credentials"},
                    ip="127.0.0.1",
                    user_agent="seed-script",
                ),
                AuditLog(
                    tenant_id=company.id,
                    actor_user_id=owner.id,
                    entity="billing",
                    entity_id=subscription.id,
                    action="checkout_created",
                    payload_json={"plan_code": "growth"},
                    ip="127.0.0.1",
                    user_agent="seed-script",
                ),
            ]
        )

        db.add_all(
            [
                WebhookEvent(
                    tenant_id=company.id,
                    provider="meta",
                    event_id="meta_evt_failed_001",
                    event_type="message.status",
                    signature_valid=True,
                    status="failed",
                    payload_json={"channel": "whatsapp", "status": "failed"},
                    processed_at=now - timedelta(minutes=20),
                    error="Meta API timeout on status sync",
                ),
                WebhookEvent(
                    tenant_id=company.id,
                    provider="wompi",
                    event_id="wompi_evt_failed_001",
                    event_type="transaction.updated",
                    signature_valid=False,
                    status="failed",
                    payload_json={"event": "transaction.updated"},
                    processed_at=now - timedelta(minutes=12),
                    error="Invalid webhook signature",
                ),
                WebhookEvent(
                    tenant_id=company.id,
                    provider="meta",
                    event_id="meta_evt_processed_001",
                    event_type="message.received",
                    signature_valid=True,
                    status="processed",
                    payload_json={"channel": "instagram"},
                    processed_at=now - timedelta(hours=2),
                    error=None,
                ),
            ]
        )

        db.commit()

        print("Demo data created successfully.")
        print(f"tenant_id={company.id}")
        print(f"tenant_slug={company.slug}")
        print("users:")
        print(f"  owner:  owner@demo-crm.local / {DEMO_PASSWORD}")
        print(f"  admin:  admin@demo-crm.local / {DEMO_PASSWORD}")
        print(f"  advisor: ana@demo-crm.local / {DEMO_PASSWORD}")
        print(f"  advisor: carlos@demo-crm.local / {DEMO_PASSWORD}")
        print(f"  viewer: viewer@demo-crm.local / {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    args = parse_args()
    seed_demo_data(slug=args.slug, name=args.name, timezone=args.timezone)
