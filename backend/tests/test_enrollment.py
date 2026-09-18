from __future__ import annotations

import datetime as dt
import json
import sqlite3
import tempfile
import threading
import unittest
from dataclasses import replace
from pathlib import Path
from typing import Any

from backend.enrollment import (
    CentralEnrollmentError,
    EnrollmentCompletion,
    EnrollmentPreparation,
    WebEnrollmentHTTPAdapter,
    WebEnrollmentService,
)
from backend.registry import LicenseRecord
from backend.web_auth import AuthError, WebAuthConfig, WebAuthService


UTC = dt.timezone.utc


class Mailer:
    def __init__(self) -> None:
        self.messages: list[dict[str, Any]] = []

    def send_login_code(self, **values: Any) -> None:
        self.messages.append(dict(values))


class Registry:
    def __init__(self) -> None:
        self.profile_visible = False
        self.windows = 0
        self.record = LicenseRecord(
            license_id="lic-1",
            customer_id="customer-1",
            support_email="new@example.test",
            status="active",
            plan="full",
            rights={"data_access": "all_current", "exports": True, "xbrl": True},
            max_devices=3,
            starts_at="2026-01-01T00:00:00+00:00",
            expires_at="2027-01-01T00:00:00+00:00",
        )

    def validate_claim(self, license_code: str, now: dt.datetime) -> LicenseRecord:
        if not self.profile_visible or license_code != "CODE":
            raise LookupError()
        return self.record

    def get_license(self, license_id: str, now: dt.datetime) -> LicenseRecord:
        if not self.profile_visible or license_id != self.record.license_id:
            raise LookupError()
        return self.record

    def count_windows_allocated(
        self, license_id: str, *, connection: sqlite3.Connection | None = None
    ) -> int:
        return self.windows


class Central:
    def __init__(self, registry: Registry) -> None:
        self.registry = registry
        self.lock = threading.Lock()
        self.claim: EnrollmentPreparation | None = None
        self.cancelled: list[str] = []
        self.completed: EnrollmentCompletion | None = None

    def prepare(
        self, license_code: str, email: str, *, now: dt.datetime
    ) -> EnrollmentPreparation:
        if license_code != "UNBOUND" or email != "new@example.test":
            raise CentralEnrollmentError("claim_unavailable", 409)
        with self.lock:
            if self.claim is not None:
                raise CentralEnrollmentError("claim_unavailable", 409)
            self.claim = EnrollmentPreparation(
                "claim-1", "lic-1", "customer-1", email
            )
            return self.claim

    def cancel(self, claim_id: str) -> None:
        self.cancelled.append(claim_id)

    def autofill(
        self, claim_id: str, email: str, enterprise_number: str, *, now: dt.datetime
    ) -> dict[str, Any]:
        if self.claim is None or claim_id != self.claim.claim_id:
            raise CentralEnrollmentError("enrollment_expired", 401)
        choices = {
            "general_terms": "Algemene voorwaarden voor Example BV.",
            "usage_terms": "Gebruiksvoorwaarden voor Example BV.",
            "privacy_notice": "Privacyverklaring gelezen.",
            "business_authority": "Ik mag Example BV vertegenwoordigen.",
        }
        return {
            "ok": True,
            "company": {
                "company_type": "business",
                "enterprise_number": enterprise_number,
                "legal_name": "Example BV",
            },
            "legal": {
                "legal_set_id": "commercial-v1",
                "language": "nl-BE",
                "documents": [
                    {
                        "document_id": "terms",
                        "title": "Voorwaarden",
                        "role": "contractual_terms",
                        "version": "1",
                        "view_url": "/api/web/legal/terms",
                        "download_url": "/api/web/legal/terms.pdf",
                        "sha256": "a" * 64,
                    }
                ],
                "choice_texts": choices,
            },
            "preflight_id": "preflight-1",
            "preflight_fingerprint": "a" * 64,
        }

    def complete(
        self, claim_id: str, email: str, request: dict[str, Any], *, now: dt.datetime
    ) -> EnrollmentCompletion:
        if self.claim is None or claim_id != self.claim.claim_id:
            raise CentralEnrollmentError("enrollment_expired", 401)
        if self.completed is None:
            self.registry.profile_visible = True
            self.completed = EnrollmentCompletion(
                "acceptance-1", claim_id, "lic-1", "customer-1", email
            )
        return self.completed


class EnrollmentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.database = Path(self.temp.name) / "state.sqlite3"
        connection = sqlite3.connect(self.database)
        connection.execute(
            "CREATE TABLE devices(device_id TEXT PRIMARY KEY,license_id TEXT,status TEXT)"
        )
        connection.commit()
        connection.close()
        self.registry = Registry()
        self.mailer = Mailer()
        self.auth = WebAuthService(
            WebAuthConfig(self.database, b"z" * 32), self.registry, self.mailer
        )
        self.central = Central(self.registry)
        self.service = WebEnrollmentService(self.auth, self.central, self.mailer)
        self.adapter = WebEnrollmentHTTPAdapter(
            self.service,
            allowed_origins={"http://localhost:3000"},
            production=False,
        )
        self.headers = {
            "Origin": "http://localhost:3000",
            "Content-Type": "application/json",
        }

    def start(self) -> tuple[dict[str, Any], str]:
        response = self.adapter.handle(
            "POST",
            "/web/enrollment/start",
            self.headers,
            json.dumps(
                {
                    "license_code": "UNBOUND",
                    "email": "new@example.test",
                    "remember_browser": True,
                }
            ),
            source="203.0.113.1",
        )
        self.assertEqual(202, response.status)
        return response.body, str(self.mailer.messages[-1]["code"])

    def verified(self):
        started, otp = self.start()
        response = self.adapter.handle(
            "POST",
            "/web/enrollment/verify",
            self.headers,
            json.dumps({"challenge_id": started["challenge_id"], "code": otp}),
            source="203.0.113.1",
        )
        self.assertEqual(200, response.status)
        cookie = response.multi_headers[0][1].split(";", 1)[0]
        return response, cookie

    def completion_body(self, enrollment_token: str) -> dict[str, Any]:
        preflight = self.service.autofill(
            self.service.session(enrollment_token), "0123456789"
        )
        return {
            "company_type": "business",
            "enterprise_number": "0123456789",
            "legal_name": "Example BV",
            "acceptant": {"name": "Ada Example", "function": "Bestuurder"},
            "declarations": {
                "terms_accepted": True,
                "usage_terms_accepted": True,
                "privacy_acknowledged": True,
                "authority_declared": True,
            },
            "choice_texts": preflight["legal"]["choice_texts"],
            "preflight_id": preflight["preflight_id"],
            "preflight_fingerprint": preflight["preflight_fingerprint"],
        }

    def test_unknown_or_wrong_email_is_generic_and_sends_no_mail(self) -> None:
        response = self.adapter.handle(
            "POST",
            "/web/enrollment/start",
            self.headers,
            json.dumps(
                {
                    "license_code": "UNBOUND",
                    "email": "wrong@example.test",
                    "remember_browser": False,
                }
            ),
            source="203.0.113.1",
        )
        self.assertEqual(202, response.status)
        self.assertEqual("if_license_available", response.body["delivery"])
        self.assertEqual([], self.mailer.messages)

    def test_otp_is_one_use_and_enrollment_session_has_no_data_context(self) -> None:
        started, otp = self.start()
        first = self.service.verify(started["challenge_id"], otp)
        self.assertEqual("new@example.test", first.email)
        self.assertNotIn("auth_context", first.__dict__)
        with self.assertRaisesRegex(AuthError, "code_invalid"):
            self.service.verify(started["challenge_id"], otp)

    def test_session_refresh_autofill_csrf_and_private_block(self) -> None:
        verified, cookie = self.verified()
        session = self.adapter.handle(
            "GET",
            "/web/enrollment/session",
            {"Cookie": cookie},
            None,
            source="203.0.113.1",
        )
        self.assertEqual(200, session.status)
        self.assertEqual("profile", session.body["next"])
        self.assertNotIn("license", json.dumps(session.body).lower())
        denied = self.adapter.handle(
            "POST",
            "/web/enrollment/autofill",
            {**self.headers, "Cookie": cookie},
            json.dumps({"enterprise_number": "0123.456.789"}),
            source="203.0.113.1",
        )
        self.assertEqual(403, denied.status)
        allowed = self.adapter.handle(
            "POST",
            "/web/enrollment/autofill",
            {
                **self.headers,
                "Cookie": cookie,
                "X-BelgoBase-CSRF": verified.body["csrf"],
            },
            json.dumps({"enterprise_number": "0123.456.789"}),
            source="203.0.113.1",
        )
        self.assertEqual(200, allowed.status)
        private = self.adapter.handle(
            "POST",
            "/web/enrollment/complete",
            {
                **self.headers,
                "Cookie": cookie,
                "X-BelgoBase-CSRF": verified.body["csrf"],
            },
            json.dumps({"company_type": "private"}),
            source="203.0.113.1",
        )
        self.assertEqual(409, private.status)
        self.assertEqual("consumer_registration_unavailable", private.body["error"])

    def test_completion_atomically_consumes_enrollment_and_sets_two_cookies(self) -> None:
        verified, cookie = self.verified()
        body = self.completion_body(cookie.split("=", 1)[1])
        completed = self.adapter.handle(
            "POST",
            "/web/enrollment/complete",
            {
                **self.headers,
                "Cookie": cookie,
                "X-BelgoBase-CSRF": verified.body["csrf"],
            },
            json.dumps(body),
            source="203.0.113.1",
        )
        self.assertEqual(200, completed.status)
        self.assertTrue(completed.body["authenticated"])
        self.assertEqual(2, len(completed.multi_headers))
        cookie_lines = [value for name, value in completed.multi_headers if name == "Set-Cookie"]
        self.assertTrue(any(line.startswith("belgobase_session=") for line in cookie_lines))
        self.assertTrue(any(line.startswith("belgobase_enrollment=;") for line in cookie_lines))
        expired = self.adapter.handle(
            "GET",
            "/web/enrollment/session",
            {"Cookie": cookie},
            None,
            source="203.0.113.1",
        )
        self.assertEqual(401, expired.status)
        normal = cookie_lines[0].split(";", 1)[0].split("=", 1)[1]
        context = self.auth.validate_session(normal)
        self.assertEqual("customer-1", context.customer_id)

    def test_lost_completion_response_recovers_same_browser_seat(self) -> None:
        _verified, cookie = self.verified()
        enrollment_token = cookie.split("=", 1)[1]
        body = self.completion_body(enrollment_token)
        first = self.service.complete(self.service.session(enrollment_token), body)
        recovery_session = self.service.session(
            enrollment_token, allow_completed=True
        )
        second = self.service.complete(recovery_session, body)
        self.assertEqual(first.context.browser_id, second.context.browser_id)
        self.assertNotEqual(first.token, second.token)
        with self.assertRaisesRegex(AuthError, "session_invalid"):
            self.auth.validate_session(first.token)
        self.assertEqual(
            first.context.browser_id,
            self.auth.validate_session(second.token).browser_id,
        )
        connection = sqlite3.connect(self.database)
        try:
            active_browsers = connection.execute(
                "SELECT COUNT(*) FROM web_browsers WHERE status='active'"
            ).fetchone()[0]
        finally:
            connection.close()
        self.assertEqual(1, active_browsers)
        connection = sqlite3.connect(self.database)
        try:
            connection.execute(
                "UPDATE web_enrollment_sessions SET expires_at=?",
                ("2020-01-01T00:00:00+00:00",),
            )
            connection.commit()
        finally:
            connection.close()
        with self.assertRaisesRegex(AuthError, "enrollment_invalid"):
            self.service.session(enrollment_token, allow_completed=True)

    def test_concurrent_prepare_has_one_real_claim(self) -> None:
        barrier = threading.Barrier(2)
        results: list[dict[str, Any]] = []

        def run() -> None:
            barrier.wait()
            results.append(
                self.service.start(
                    license_code="UNBOUND",
                    email="new@example.test",
                    remember_browser=False,
                    source="shared-bff",
                )
            )

        threads = [threading.Thread(target=run) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(2, len(results))
        self.assertEqual(1, len(self.mailer.messages))
        self.assertEqual(1, sum(item["challenge_id"] == self.mailer.messages[0]["challenge_id"] for item in results))


if __name__ == "__main__":
    unittest.main()
