from __future__ import annotations

from pathlib import Path
import sys
import unittest

from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.auth import LoginInput


class LoginInputTests(unittest.TestCase):
    def test_accepts_demo_local_email(self) -> None:
        payload = LoginInput(
            email="ana@demo-crm.local",
            password="admin123",
            tenant_id="tenant-1",
        )

        self.assertEqual(payload.email, "ana@demo-crm.local")

    def test_rejects_malformed_email(self) -> None:
        with self.assertRaises(ValidationError):
            LoginInput(
                email="ana-at-demo-crm.local",
                password="admin123",
                tenant_id="tenant-1",
            )
