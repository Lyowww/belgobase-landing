from __future__ import annotations

import datetime as dt
import json
import sqlite3
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from typing import Any

from backend.http_adapter import WebAuthHTTPAdapter
from backend.mailer import SignedWebsiteMailer
from backend.registry import BelgoBaseLicenseRegistry, LicenseRecord
from backend.web_auth import AuthError, WebAuthConfig, WebAuthService
from backend.workspace_integration import make_workspace_bridge_handler, workspace_scope_resolver


UTC = dt.timezone.utc


class Clock:
    def __init__(self) -> None:
        self.value = dt.datetime(2026, 9, 18, 10, 0, tzinfo=UTC)

    def __call__(self) -> dt.datetime:
        return self.value

    def advance(self, **values: int) -> None:
        self.value += dt.timedelta(**values)


class CapturingMailer:
    def __init__(self) -> None:
        self.messages: list[dict[str, Any]] = []

    def send_login_code(self, **values: Any) -> None:
        self.messages.append(values)


class FakeRegistry:
    def __init__(self, records: dict[str, LicenseRecord]) -> None:
        self.by_code = dict(records)
        self.by_id = {record.license_id: record for record in records.values()}
        self.profile_records: dict[str, list[LicenseRecord]] = {}

    def validate_claim(self, license_code: str, now: dt.datetime) -> LicenseRecord:
        record = self.by_code.get(license_code)
        if record is None or not record.is_active(now):
            raise LookupError("invalid")
        return record

    def get_license(self, license_id: str, now: dt.datetime) -> LicenseRecord:
        record = self.by_id.get(license_id)
        if record is None:
            raise LookupError("missing")
        return record

    def find_active_profile_licenses(
        self, support_email: str, now: dt.datetime
    ) -> tuple[LicenseRecord, ...]:
        return tuple(
            record
            for record in self.profile_records.get(support_email, [])
            if record.is_active(now)
        )

    def count_windows_allocated(
        self, license_id: str, *, connection: sqlite3.Connection | None = None
    ) -> int:
        assert connection is not None
        return int(
            connection.execute(
                "SELECT COUNT(*) FROM devices WHERE license_id=? AND status IN ('active','suspended')",
                (license_id,),
            ).fetchone()[0]
        )


def record(
    license_id: str = "lic-1",
    customer_id: str = "tenant-1",
    email: str = "owner@example.test",
    *,
    max_devices: int = 5,
) -> LicenseRecord:
    return LicenseRecord(
        license_id=license_id,
        customer_id=customer_id,
        support_email=email,
        status="active",
        plan="full",
        rights={"data_access": "all_current", "exports": True, "xbrl": True},
        max_devices=max_devices,
        starts_at="2026-01-01T00:00:00+00:00",
        expires_at="2027-01-01T00:00:00+00:00",
    )


class RegistryProfileLookupTests(unittest.TestCase):
    def test_reads_only_active_licenses_bound_by_central_profile_email(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            database = Path(temporary) / "central.sqlite3"
            connection = sqlite3.connect(database)
            try:
                connection.executescript(
                    """
                    CREATE TABLE licenses (
                        license_id TEXT PRIMARY KEY, customer_id TEXT NOT NULL,
                        status TEXT NOT NULL, plan TEXT NOT NULL,
                        rights_json TEXT NOT NULL, max_devices INTEGER NOT NULL,
                        starts_at TEXT, expires_at TEXT
                    );
                    CREATE TABLE license_customer_profiles (
                        license_id TEXT PRIMARY KEY, support_email TEXT NOT NULL
                    );
                    """
                )
                rows = (
                    ("active-1", "customer-1", "active", "2026-01-01T00:00:00+00:00", "2027-01-01T00:00:00+00:00", "DAVID@NOVAVENTURE.BE"),
                    ("inactive-1", "customer-2", "revoked", "2026-01-01T00:00:00+00:00", "2027-01-01T00:00:00+00:00", "david@novaventure.be"),
                )
                for license_id, customer_id, status, starts_at, expires_at, email in rows:
                    connection.execute(
                        "INSERT INTO licenses VALUES(?,?,?,?,?,?,?,?)",
                        (license_id, customer_id, status, "full", '{"exports":true}', 3, starts_at, expires_at),
                    )
                    connection.execute(
                        "INSERT INTO license_customer_profiles VALUES(?,?)", (license_id, email)
                    )
                connection.commit()
            finally:
                connection.close()
            registry = BelgoBaseLicenseRegistry(database, lambda *_args, **_kwargs: {})
            found = registry.find_active_profile_licenses(
                "david@novaventure.be", dt.datetime(2026, 9, 18, tzinfo=UTC)
            )
            self.assertEqual(["active-1"], [item.license_id for item in found])



class WebAuthTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.database = Path(self.temp.name) / "auth.sqlite3"
        connection = sqlite3.connect(self.database)
        connection.execute(
            "CREATE TABLE devices(device_id TEXT PRIMARY KEY, license_id TEXT NOT NULL, status TEXT NOT NULL)"
        )
        connection.commit()
        connection.close()
        self.clock = Clock()
        self.mailer = CapturingMailer()
        self.registry = FakeRegistry({"CODE-1": record()})
        self.service = WebAuthService(
            WebAuthConfig(state_database=self.database, secret=b"s" * 32),
            self.registry,
            self.mailer,
            clock=self.clock,
        )

    def claim(self, *, remember: bool = False, code: str = "CODE-1") -> tuple[dict[str, Any], str]:
        result = self.service.start_claim(
            " OWNER@EXAMPLE.TEST ", code, remember_browser=remember, source="198.51.100.1"
        )
        return result, str(self.mailer.messages[-1]["code"])

    def grant(self, *, remember: bool = False):
        result, otp = self.claim(remember=remember)
        return self.service.verify_code(result["challenge_id"], otp)

    def test_unregistered_email_cannot_login_or_create_membership(self) -> None:
        started = self.service.start_login(
            "not-a-customer@example.test", remember_browser=False, source="198.51.100.9"
        )
        self.assertEqual([], self.mailer.messages)
        with self.assertRaisesRegex(AuthError, "code_invalid"):
            self.service.verify_code(started["challenge_id"], "123456")
        connection = sqlite3.connect(self.database)
        try:
            self.assertEqual(0, connection.execute("SELECT COUNT(*) FROM web_memberships").fetchone()[0])
            self.assertEqual(0, connection.execute("SELECT COUNT(*) FROM web_sessions").fetchone()[0])
        finally:
            connection.close()

    def test_wrong_email_is_generic_and_sends_no_code(self) -> None:
        response = self.service.start_claim(
            "wrong@example.test", "CODE-1", remember_browser=False, source="198.51.100.1"
        )
        self.assertEqual("if_account_matches", response["delivery"])
        self.assertEqual([], self.mailer.messages)
        with self.assertRaisesRegex(AuthError, "code_invalid"):
            self.service.verify_code(response["challenge_id"], "123456")

    def test_code_is_one_use(self) -> None:
        result, otp = self.claim()
        grant = self.service.verify_code(result["challenge_id"], otp)
        self.assertEqual("lic-1", grant.context.license_id)
        with self.assertRaisesRegex(AuthError, "code_invalid"):
            self.service.verify_code(result["challenge_id"], otp)

    def test_code_expires(self) -> None:
        result, otp = self.claim()
        self.clock.advance(minutes=11)
        with self.assertRaisesRegex(AuthError, "code_invalid"):
            self.service.verify_code(result["challenge_id"], otp)

    def test_start_rate_is_enforced(self) -> None:
        service = WebAuthService(
            WebAuthConfig(
                state_database=self.database,
                secret=b"s" * 32,
                start_rate_count=2,
                source_rate_count=10,
            ),
            self.registry,
            self.mailer,
            clock=self.clock,
        )
        for _ in range(2):
            service.start_claim(
                "wrong@example.test", "BAD", remember_browser=False, source="198.51.100.2"
            )
        with self.assertRaisesRegex(AuthError, "rate_limited"):
            service.start_claim(
                "wrong@example.test", "BAD", remember_browser=False, source="198.51.100.2"
            )

    def test_verification_budget_blocks_correct_otp_until_window_resets(self) -> None:
        service = WebAuthService(
            WebAuthConfig(
                state_database=self.database,
                secret=b"s" * 32,
                start_rate_count=10,
                verification_rate_count=3,
            ),
            self.registry,
            self.mailer,
            clock=self.clock,
        )
        valid_before_limit = service.start_claim(
            "owner@example.test", "CODE-1", remember_browser=False, source="198.51.100.2"
        )
        grant = service.verify_code(
            valid_before_limit["challenge_id"], self.mailer.messages[-1]["code"]
        )
        self.assertEqual("lic-1", grant.context.license_id)
        challenges = [
            service.start_claim(
                "owner@example.test", "CODE-1", remember_browser=False, source="198.51.100.2"
            )
            for _ in range(3)
        ]
        for started in challenges[:2]:
            with self.assertRaisesRegex(AuthError, "code_invalid"):
                service.verify_code(started["challenge_id"], "000000")
        # The exhausted account-day budget generically rejects even the actual
        # OTP.  Otherwise an attacker can keep guessing until the right value.
        with self.assertRaisesRegex(AuthError, "code_invalid"):
            service.verify_code(challenges[2]["challenge_id"], self.mailer.messages[-1]["code"])
        connection = sqlite3.connect(self.database)
        try:
            self.assertEqual(
                3,
                connection.execute(
                    "SELECT COUNT(*) FROM web_auth_rate_events WHERE bucket='verify_account'"
                ).fetchone()[0],
            )
        finally:
            connection.close()
        self.clock.advance(minutes=24 * 60 + 1)
        after_reset = service.start_claim(
            "owner@example.test", "CODE-1", remember_browser=False, source="198.51.100.2"
        )
        grant = service.verify_code(after_reset["challenge_id"], self.mailer.messages[-1]["code"])
        self.assertEqual("lic-1", grant.context.license_id)

    def test_optional_wrong_otp_source_budget_uses_recorded_trusted_source(self) -> None:
        service = WebAuthService(
            WebAuthConfig(
                state_database=self.database,
                secret=b"s" * 32,
                start_rate_count=10,
                verification_rate_count=10,
                verification_source_rate_count=1,
            ),
            self.registry,
            self.mailer,
            clock=self.clock,
        )
        first = service.start_claim(
            "owner@example.test", "CODE-1", remember_browser=False, source="198.51.100.8"
        )
        with self.assertRaisesRegex(AuthError, "code_invalid"):
            service.verify_code(first["challenge_id"], "000000")
        second = service.start_claim(
            "owner@example.test", "CODE-1", remember_browser=False, source="198.51.100.8"
        )
        with self.assertRaisesRegex(AuthError, "code_invalid"):
            service.verify_code(second["challenge_id"], "000000")
        connection = sqlite3.connect(self.database)
        try:
            self.assertEqual(
                1,
                connection.execute(
                    "SELECT COUNT(*) FROM web_auth_rate_events WHERE bucket='verify_source'"
                ).fetchone()[0],
            )
        finally:
            connection.close()

    def test_unique_active_central_profile_creates_first_web_membership_after_otp(self) -> None:
        # This uses the actual registry query shape: the central profile, the
        # licence record and the web-auth state deliberately share one DB.
        central = self.registry.by_id["lic-1"]
        connection = sqlite3.connect(self.database)
        try:
            connection.executescript(
                """
                CREATE TABLE licenses (
                    license_id TEXT PRIMARY KEY, customer_id TEXT NOT NULL,
                    status TEXT NOT NULL, plan TEXT NOT NULL,
                    rights_json TEXT NOT NULL, max_devices INTEGER NOT NULL,
                    starts_at TEXT, expires_at TEXT
                );
                CREATE TABLE license_customer_profiles (
                    license_id TEXT PRIMARY KEY, support_email TEXT NOT NULL
                );
                """
            )
            connection.execute(
                "INSERT INTO licenses VALUES(?,?,?,?,?,?,?,?)",
                (
                    central.license_id, central.customer_id, central.status, central.plan,
                    json.dumps(central.rights), central.max_devices, central.starts_at,
                    central.expires_at,
                ),
            )
            connection.execute(
                "INSERT INTO license_customer_profiles VALUES(?,?)",
                (central.license_id, central.support_email),
            )
            connection.commit()
        finally:
            connection.close()
        service = WebAuthService(
            WebAuthConfig(state_database=self.database, secret=b"s" * 32),
            BelgoBaseLicenseRegistry(self.database, lambda *_args, **_kwargs: {}),
            self.mailer,
            clock=self.clock,
        )

        started = service.start_login(
            " OWNER@EXAMPLE.TEST ", remember_browser=False, source="198.51.100.7"
        )
        self.assertEqual("if_account_matches", started["delivery"])
        self.assertEqual(1, len(self.mailer.messages))
        grant = service.verify_code(started["challenge_id"], self.mailer.messages[-1]["code"])

        self.assertEqual("lic-1", grant.context.license_id)
        self.assertEqual("owner@example.test", grant.context.email)
        connection = sqlite3.connect(self.database)
        try:
            self.assertEqual(1, connection.execute("SELECT COUNT(*) FROM web_users").fetchone()[0])
            self.assertEqual(1, connection.execute("SELECT COUNT(*) FROM web_memberships").fetchone()[0])
        finally:
            connection.close()

    def test_profile_login_rejects_mismatched_profile_record_without_otp(self) -> None:
        self.registry.profile_records["owner@example.test"] = [
            replace(self.registry.by_id["lic-1"], support_email="other@example.test")
        ]

        started = self.service.start_login(
            "owner@example.test", remember_browser=False, source="198.51.100.7"
        )

        self.assertEqual("if_account_matches", started["delivery"])
        self.assertEqual([], self.mailer.messages)

    def test_profile_login_rejects_ambiguous_active_licenses_without_otp(self) -> None:
        second = record("lic-2", "tenant-2", "owner@example.test")
        self.registry.by_id["lic-2"] = second
        self.registry.profile_records["owner@example.test"] = [self.registry.by_id["lic-1"], second]

        started = self.service.start_login(
            "owner@example.test", remember_browser=False, source="198.51.100.7"
        )

        self.assertEqual("if_account_matches", started["delivery"])
        self.assertEqual([], self.mailer.messages)

    def test_profile_login_rejects_inactive_license_without_otp(self) -> None:
        inactive = replace(self.registry.by_id["lic-1"], status="revoked")
        self.registry.by_id["lic-1"] = inactive
        self.registry.profile_records["owner@example.test"] = [inactive]

        started = self.service.start_login(
            "owner@example.test", remember_browser=False, source="198.51.100.7"
        )

        self.assertEqual("if_account_matches", started["delivery"])
        self.assertEqual([], self.mailer.messages)

    def test_remember_and_short_session_lifetimes(self) -> None:
        short = self.grant(remember=False)
        self.assertEqual(8 * 60 * 60, short.max_age_seconds)
        self.service.logout(short.token)
        login = self.service.start_login(
            "owner@example.test", remember_browser=True, source="198.51.100.1"
        )
        remembered = self.service.verify_code(
            login["challenge_id"], str(self.mailer.messages[-1]["code"])
        )
        self.assertEqual(30 * 24 * 60 * 60, remembered.max_age_seconds)

    def test_logout_revokes_session_and_releases_browser_seat(self) -> None:
        self.registry.by_id["lic-1"] = replace(self.registry.by_id["lic-1"], max_devices=1)
        self.registry.by_code["CODE-1"] = self.registry.by_id["lic-1"]
        grant = self.grant()
        self.service.logout(grant.token)
        with self.assertRaisesRegex(AuthError, "session_invalid"):
            self.service.validate_session(grant.token)
        login = self.service.start_login(
            "owner@example.test", remember_browser=False, source="198.51.100.1"
        )
        second = self.service.verify_code(
            login["challenge_id"], str(self.mailer.messages[-1]["code"])
        )
        self.assertEqual("lic-1", second.context.license_id)

    def test_logout_all_revokes_every_browser_session(self) -> None:
        first = self.grant()
        login = self.service.start_login(
            "owner@example.test", remember_browser=True, source="198.51.100.4"
        )
        second = self.service.verify_code(
            login["challenge_id"], str(self.mailer.messages[-1]["code"])
        )
        self.assertEqual(first.context.user_id, second.context.user_id)
        self.assertNotEqual(first.context.browser_id, second.context.browser_id)
        self.assertEqual(2, len(self.service.list_browsers(first.token)))
        self.service.logout_all(second.token)
        for token in (first.token, second.token):
            with self.assertRaisesRegex(AuthError, "session_invalid"):
                self.service.validate_session(token)

    def test_live_license_expiry_or_revocation_blocks_existing_session(self) -> None:
        grant = self.grant()
        self.registry.by_id["lic-1"] = replace(self.registry.by_id["lic-1"], status="revoked")
        with self.assertRaisesRegex(AuthError, "license_inactive"):
            self.service.validate_session(grant.token)

    def test_tenant_context_cannot_be_swapped(self) -> None:
        second_record = record("lic-2", "tenant-2", "two@example.test")
        self.registry.by_code["CODE-2"] = second_record
        self.registry.by_id["lic-2"] = second_record
        first = self.grant()
        claim = self.service.start_claim(
            "two@example.test", "CODE-2", remember_browser=False, source="198.51.100.3"
        )
        second = self.service.verify_code(
            claim["challenge_id"], str(self.mailer.messages[-1]["code"])
        )
        self.assertEqual("tenant-1", self.service.validate_session(first.token).customer_id)
        self.assertEqual("tenant-2", self.service.validate_session(second.token).customer_id)
        with self.assertRaisesRegex(AuthError, "code_invalid"):
            self.service.verify_code(claim["challenge_id"], "000000")

    def test_windows_and_browser_share_max_devices(self) -> None:
        limited = replace(self.registry.by_id["lic-1"], max_devices=1)
        self.registry.by_id["lic-1"] = limited
        self.registry.by_code["CODE-1"] = limited
        connection = sqlite3.connect(self.database)
        connection.execute("INSERT INTO devices VALUES('pc-1','lic-1','active')")
        connection.commit()
        connection.close()
        result, otp = self.claim()
        with self.assertRaisesRegex(AuthError, "browser_limit_reached"):
            self.service.verify_code(result["challenge_id"], otp)

    def test_http_cookie_csrf_and_server_context(self) -> None:
        captured: list[dict[str, Any]] = []

        def bridge(method: str, payload: dict[str, Any], context: dict[str, Any]) -> Any:
            captured.append({"method": method, "payload": payload, "context": context})
            return {"ok": True, "license_id": context["license_id"]}

        adapter = WebAuthHTTPAdapter(
            self.service,
            allowed_origins={"http://localhost:3000"},
            production=False,
            bridge_handler=bridge,
            bridge_scope_resolver=lambda method, payload: frozenset({"data.read"}),
        )
        base = {"Origin": "http://localhost:3000", "Content-Type": "application/json"}
        started = adapter.handle(
            "POST",
            "/web/auth/claim",
            base,
            json.dumps(
                {
                    "email": "owner@example.test",
                    "license_code": "CODE-1",
                    "remember_browser": False,
                }
            ),
            source="127.0.0.1",
        )
        verified = adapter.handle(
            "POST",
            "/web/auth/verify",
            base,
            json.dumps(
                {
                    "challenge_id": started.body["challenge_id"],
                    "code": self.mailer.messages[-1]["code"],
                }
            ),
        )
        self.assertNotIn("token", json.dumps(verified.body).lower())
        self.assertIs(True, verified.body["authenticated"])
        self.assertEqual("owner@example.test", verified.body["account"]["email"])
        cookie = verified.headers["Set-Cookie"].split(";", 1)[0]
        csrf = str(verified.body["csrf"])
        forbidden = adapter.handle(
            "POST", "/web/bridge", {**base, "Cookie": cookie}, json.dumps({"method": "search", "payload": {}})
        )
        self.assertEqual(403, forbidden.status)
        bridged = adapter.handle(
            "POST",
            "/web/bridge",
            {**base, "Cookie": cookie, "X-BelgoBase-CSRF": csrf},
            json.dumps({"method": "search", "payload": {"license_id": "lic-2", "padding": "x" * 20_000}}),
        )
        self.assertEqual("lic-1", bridged.body["license_id"])
        self.assertNotIn("result", bridged.body)
        self.assertEqual("lic-1", captured[0]["context"]["license_id"])

    def test_auth_body_limit_and_bridge_body_limit_are_distinct(self) -> None:
        adapter = WebAuthHTTPAdapter(
            self.service,
            allowed_origins={"http://localhost:3000"},
            production=False,
        )
        headers = {"Origin": "http://localhost:3000", "Content-Type": "application/json"}
        too_large_auth = adapter.handle(
            "POST",
            "/web/auth/login",
            headers,
            json.dumps({"email": "owner@example.test", "remember_browser": False, "padding": "x" * 17_000}),
        )
        self.assertEqual(413, too_large_auth.status)
        invalid_utf8 = adapter.handle("POST", "/web/auth/login", headers, b"\xff")
        self.assertEqual(400, invalid_utf8.status)


class _Response:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *_args: Any) -> None:
        return None

    def read(self, _amount: int) -> bytes:
        return b'{"ok":true}'


class _Opener:
    def __init__(self) -> None:
        self.request = None

    def open(self, request, timeout: int):
        self.request = request
        return _Response()


class SignedMailerTests(unittest.TestCase):
    def test_signed_relay_contract_contains_only_agreed_fields(self) -> None:
        opener = _Opener()
        signed: list[bytes] = []
        mailer = SignedWebsiteMailer(
            endpoint="https://www.belgobase.be/api/web/mail",
            signer=lambda body: signed.append(body) or b"signature",
            opener=opener,
        )
        issued = dt.datetime(2026, 9, 18, 10, 0, tzinfo=UTC)
        mailer.send_login_code(
            email="owner@example.test",
            code="012345",
            challenge_id="challenge-1",
            issued_at=issued,
            expires_at=issued + dt.timedelta(minutes=10),
        )
        self.assertEqual(signed[0], opener.request.data)
        body = json.loads(opener.request.data)
        self.assertEqual(
            {
                "purpose",
                "email",
                "code",
                "challenge_id",
                "issued_at",
                "expires_at",
                "language",
            },
            set(body),
        )
        self.assertEqual("belgobase-login-v1", body["purpose"])
        self.assertEqual("c2lnbmF0dXJl", opener.request.get_header("X-belgobase-mail-signature"))


class WorkspaceIntegrationTests(unittest.TestCase):
    def test_trusted_identity_and_scopes_reach_workspace_unchanged(self) -> None:
        captured: list[Any] = []

        class Service:
            def execute(self, method: str, payload: Any, context: Any) -> dict[str, Any]:
                captured.append((method, payload, context))
                return {"ok": True}

        auth = {
            "license_id": "lic-1",
            "customer_id": "tenant-1",
            "user_id": "user-1",
            "email": "owner@example.test",
            "browser_id": "browser-1",
            "plan": "full",
            "rights": {"data_access": "all_current", "exports": True, "xbrl": True},
            "principal_id": "web:browser-1",
            "quota_subject_id": "web:browser-1",
            "effective_scopes": ["data.read", "xbrl.read"],
        }
        result = make_workspace_bridge_handler(Service())("search", {}, auth)
        self.assertEqual({"ok": True}, result)
        context = captured[0][2]
        self.assertEqual("tenant-1", context.customer_id)
        self.assertEqual("web:browser-1", context.quota_subject_id)
        self.assertEqual("owner@example.test", context.email)
        self.assertEqual("owner@example.test", context.authorization_context()["email"])
        self.assertEqual(frozenset({"data.read", "xbrl.read"}), context.effective_scopes)
        with self.assertRaises(TypeError):
            context.rights["exports"] = False

    def test_xbrl_export_requires_all_existing_export_scopes(self) -> None:
        required = workspace_scope_resolver(
            "export_results", {"filters": {"xbrl_metric_filters": [{"key": "x"}]}}
        )
        self.assertEqual(
            frozenset({"data.read", "data.export", "xbrl.read", "xbrl.export"}),
            required,
        )
        with self.assertRaisesRegex(AuthError, "bridge_method_not_allowed"):
            workspace_scope_resolver("not_a_method", {})


if __name__ == "__main__":
    unittest.main()
