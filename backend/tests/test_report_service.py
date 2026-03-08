from __future__ import annotations

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.report_service import ReportService


class FakeReportsRepository:
    def sales_by_advisor(self, tenant_id: str) -> list[dict]:
        return [
            {"advisor_user_id": "user-1", "advisor_name": "Ana Perez", "won_leads": 4},
            {"advisor_user_id": None, "advisor_name": "Unassigned", "won_leads": 1},
        ]

    def conversion_by_stage(self, tenant_id: str) -> list[dict]:
        return [
            {
                "stage_id": "stage-1",
                "stage_name": "New",
                "entered_leads": 10,
                "progressed_leads": 6,
                "conversion_rate": 60.0,
            }
        ]

    def average_close_time(self, tenant_id: str) -> list[dict]:
        return [
            {"closed_stage_type": "won", "closed_leads": 3, "average_hours_to_close": 48.456},
            {"closed_stage_type": "lost", "closed_leads": 2, "average_hours_to_close": None},
        ]

    def leads_by_channel(self, tenant_id: str) -> list[dict]:
        return [{"source_channel": "whatsapp", "leads": 8}]

    def loss_reasons(self, tenant_id: str) -> list[dict]:
        return [{"reason": "No budget", "leads": 2}]


class ReportServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = ReportService.__new__(ReportService)
        self.service.repo = FakeReportsRepository()

    def test_average_close_time_normalizes_numeric_values(self) -> None:
        result = self.service.average_close_time("tenant-1")

        self.assertEqual(
            result,
            [
                {"closed_stage_type": "won", "closed_leads": 3, "average_hours_to_close": 48.46},
                {"closed_stage_type": "lost", "closed_leads": 2, "average_hours_to_close": 0.0},
            ],
        )

    def test_summary_aggregates_all_sections(self) -> None:
        result = self.service.summary("tenant-1")

        self.assertEqual(len(result["sales_by_advisor"]), 2)
        self.assertEqual(result["conversion_by_stage"][0]["stage_name"], "New")
        self.assertEqual(result["leads_by_channel"][0]["source_channel"], "whatsapp")
        self.assertEqual(result["loss_reasons"][0]["reason"], "No budget")
