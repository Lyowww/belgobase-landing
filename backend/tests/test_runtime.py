from __future__ import annotations

import datetime as dt
import io
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from typing import Any

from backend.registry import LicenseRecord
from backend.runtime import (
    DisabledWebRuntime,
    RuntimeConfigurationError,
    WebRuntime,
    _enrollment_company_lookup,
    _interpret_premium_for_web,
    _read_ai_wallet_for_web,
    build_web_runtime_from_environment,
    operation_binding,
)
from backend.web_auth import WebAuthConfig, WebAuthService


UTC = dt.timezone.utc


class Registry:
    def __init__(self, record: LicenseRecord) -> None:
        self.record = record

    def validate_claim(self, license_code: str, now: dt.datetime) -> LicenseRecord:
        if license_code != "CODE" or not self.record.is_active(now):
            raise LookupError()
        return self.record

    def get_license(self, license_id: str, now: dt.datetime) -> LicenseRecord:
        if license_id != self.record.license_id:
            raise LookupError()
        return self.record

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


class Mailer:
    def __init__(self) -> None:
        self.last: dict[str, Any] = {}

    def send_login_code(self, **values: Any) -> None:
        self.last = values


class Permit:
    def __init__(self, route: str, events: list[Any]) -> None:
        self.route = route
        self.events = events
        self.closed = False

    def configure_payload(self, payload: dict[str, Any]) -> None:
        self.events.append(("configure", self.route, dict(payload)))

    def check_deadline(self) -> None:
        self.events.append(("deadline", self.route))

    def complete(self, rows: int) -> None:
        self.events.append(("complete", self.route, rows))

    def close(self) -> None:
        self.closed = True
        self.events.append(("close", self.route))


class Usage:
    def __init__(self) -> None:
        self.events: list[Any] = []

    def start_request(
        self, method: str, route: str, source: str, context: dict[str, Any]
    ) -> Permit:
        self.events.append(("start", method, route, source, dict(context)))
        return Permit(route, self.events)


class Workspace:
    def __init__(self) -> None:
        self.calls: list[Any] = []

    def execute(self, method: str, payload: dict[str, Any], context: Any) -> dict[str, Any]:
        self.calls.append((method, dict(payload), context))
        if method.startswith("export_"):
            return {"ok": True, "rows": 3, "download_url": "/api/web/download/job-1234567890123456"}
        return {"ok": True, "rows": [{"number": "1"}], "total": 1}


class Handler:
    def __init__(self, method: str, path: str, headers: dict[str, str], body: bytes = b"") -> None:
        self.command = method
        self.path = path
        self.headers = dict(headers)
        if body and "Content-Length" not in self.headers:
            self.headers["Content-Length"] = str(len(body))
        self.rfile = io.BytesIO(body)
        self.wfile = io.BytesIO()
        self.status = 0
        self.response_headers: dict[str, str] = {}
        self.json_body: dict[str, Any] | None = None

    def send_json(self, status: int, payload: dict[str, Any], headers: dict[str, str]) -> None:
        self.status = status
        self.json_body = payload
        self.response_headers.update(headers)

    def send_response(self, status: int) -> None:
        self.status = status

    def send_header(self, name: str, value: str) -> None:
        self.response_headers[name] = value

    def end_headers(self) -> None:
        return None


class RuntimeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        database = Path(self.temp.name) / "state.sqlite3"
        connection = sqlite3.connect(database)
        connection.execute(
            "CREATE TABLE devices(device_id TEXT PRIMARY KEY,license_id TEXT,status TEXT)"
        )
        connection.commit()
        connection.close()
        record = LicenseRecord(
            license_id="lic-1",
            customer_id="customer-1",
            support_email="owner@example.test",
            status="active",
            plan="full",
            rights={"data_access": "all_current", "exports": True, "xbrl": True},
            max_devices=5,
            starts_at="2026-01-01T00:00:00+00:00",
            expires_at="2027-01-01T00:00:00+00:00",
        )
        self.mailer = Mailer()
        self.service = WebAuthService(
            WebAuthConfig(database, b"x" * 32), Registry(record), self.mailer
        )
        challenge = self.service.start_claim(
            "owner@example.test", "CODE", remember_browser=True, source="127.0.0.1"
        )
        self.grant = self.service.verify_code(challenge["challenge_id"], self.mailer.last["code"])
        self.usage = Usage()
        self.workspace = Workspace()
        self.authorizations: list[Any] = []
        self.download = Path(self.temp.name) / "export.xlsx"
        self.download.write_bytes(b"xlsx")

        def authorize(method: str, route: str, context: dict[str, Any], source: str):
            self.authorizations.append((method, route, dict(context), source))
            return dict(context)

        self.runtime = WebRuntime(
            auth_service=self.service,
            workspace_service=self.workspace,
            usage_controller=self.usage,
            authorize_context=authorize,
            allowed_origins={"http://localhost:3000"},
            production=False,
            ai_interpreter=lambda payload, context: {"filters": payload.get("filters", {})},
            voice_transcriber=lambda payload, context: {"ok": True, "text": "test"},
            download_resolver=lambda job, context: self.download,
        )

    def headers(self) -> dict[str, str]:
        return {
            "Origin": "http://localhost:3000",
            "Content-Type": "application/json",
            "Cookie": "belgobase_session=" + self.grant.token,
            "X-BelgoBase-CSRF": self.grant.csrf_token,
        }

    def test_default_feature_flag_is_disabled_without_importing_server_dependencies(self) -> None:
        runtime = build_web_runtime_from_environment(object(), env={})
        self.assertIsInstance(runtime, DisabledWebRuntime)
        self.assertFalse(runtime.matches("/web/auth/session"))
        with self.assertRaises(RuntimeConfigurationError):
            build_web_runtime_from_environment(object(), env={"BELGOBASE_WEB_ENABLED": "yes"})

    def test_web_ai_reuses_current_assistant_callbacks(self) -> None:
        class Main:
            normalize_premium_ai_filters = staticmethod(lambda value: value)
            premium_ai_enum_values = staticmethod(lambda: {"enum": True})
            premium_ai_metric_catalog = staticmethod(lambda: [{"metric": True}])
            assistant_company_lookup = staticmethod(lambda query, limit=6: [query, limit])
            assistant_count_search = staticmethod(lambda filters, regions=None, preferences=None: 7)
            assistant_metric_lookup = staticmethod(lambda query, limit=20: [query, limit])

        calls: list[dict[str, Any]] = []

        def interpreter(payload, context, **kwargs):
            calls.append({"payload": payload, "context": context, **kwargs})
            return {"ok": True}

        result = _interpret_premium_for_web(
            Main(), interpreter, {"action": "ask"}, {"principal_type": "web"}
        )
        self.assertEqual({"ok": True}, result)
        self.assertIs(calls[0]["company_lookup"], Main.assistant_company_lookup)
        self.assertIs(calls[0]["count_search"], Main.assistant_count_search)
        self.assertIs(calls[0]["metric_lookup"], Main.assistant_metric_lookup)
        self.assertEqual({"enum": True}, calls[0]["enum_values"])
        self.assertEqual([{"metric": True}], calls[0]["metric_catalog"])

        _interpret_premium_for_web(
            Main(), interpreter, {"action": "close"}, {"principal_type": "web"}
        )
        self.assertIsNone(calls[1]["enum_values"])
        self.assertIsNone(calls[1]["metric_catalog"])

    def test_enrollment_projects_current_kbo_company_fields(self) -> None:
        class Main:
            @staticmethod
            def lookup_company(number):
                return (
                    "0123456789",
                    {
                        "naam": "Voorbeeld BV",
                        "straat_nl": "Wetstraat",
                        "straat_fr": "Rue de la Loi",
                        "huisnummer": None,
                        "kbo_postcode": "1000",
                        "gemeente_nl": "Brussel",
                        "gemeente_fr": "Bruxelles",
                    },
                    Path("index.parquet"),
                )

        company = _enrollment_company_lookup(Main(), "BE 0123.456.789")
        self.assertEqual("0123456789", company["enterprise_number"])
        self.assertEqual("Voorbeeld BV", company["legal_name"])
        self.assertEqual(
            {
                "street": "Wetstraat",
                "house_number": "",
                "postal_code": "1000",
                "municipality": "Brussel",
            },
            company["address"],
        )

    def test_bridge_search_uses_canonical_permit_and_web_quota_subject(self) -> None:
        body = json.dumps({"method": "search", "payload": {"filters": {}}}).encode()
        handler = Handler("POST", "/web/bridge", self.headers(), body)
        handled = self.runtime.handle_base_request(handler, "POST", "198.51.100.5")
        self.assertTrue(handled.handled)
        self.assertEqual(200, handler.status)
        self.assertEqual(1, handler.json_body["total"])
        start = next(event for event in self.usage.events if event[0] == "start")
        self.assertEqual("/leadsearch/results", start[2])
        self.assertEqual("web:" + self.grant.context.browser_id, start[4]["quota_subject_id"])
        self.assertNotIn("device_id", start[4])
        self.assertIn(("close", "/leadsearch/results"), self.usage.events)
        self.assertEqual("/leadsearch/results", self.authorizations[0][1])

    def test_xbrl_export_uses_xbrl_export_policy_and_completes_rows(self) -> None:
        body = json.dumps(
            {
                "method": "export_results",
                "payload": {"filters": {"xbrl_metric_filters": [{"key": "metric"}]}},
            }
        ).encode()
        handler = Handler("POST", "/web/bridge", self.headers(), body)
        self.runtime.handle_base_request(handler, "POST", "198.51.100.6")
        self.assertEqual(200, handler.status)
        self.assertEqual("/xbrl/leadsearch/export", self.authorizations[0][1])
        self.assertIn(("complete", "/xbrl/leadsearch/export", 3), self.usage.events)

    def test_voice_reuses_transcribe_route_and_download_is_tenant_authenticated(self) -> None:
        voice = Handler(
            "POST", "/web/voice", self.headers(), json.dumps({"wav_base64": "AA=="}).encode()
        )
        voice_result = self.runtime.handle_base_request(voice, "POST", "198.51.100.7")
        self.assertTrue(voice_result.handled)
        self.assertEqual({"ok": True, "text": "test"}, voice.json_body)
        self.assertIn(("close", "/leadsearch/transcribe"), self.usage.events)

        download_headers = {"Cookie": "belgobase_session=" + self.grant.token}
        download = Handler(
            "GET", "/web/download/job-1234567890123456", download_headers
        )
        download_result = self.runtime.handle_base_request(
            download, "GET", "198.51.100.7"
        )
        self.assertTrue(download_result.handled)
        self.assertEqual(200, download.status)
        self.assertEqual(b"xlsx", download.wfile.getvalue())
        self.assertEqual("/leadsearch/export", self.authorizations[-1][1])
        self.assertIn(("close", "/web/download"), self.usage.events)

    def test_non_web_route_is_not_handled(self) -> None:
        handler = Handler("POST", "/leadsearch/results", {}, b"{}")
        self.assertFalse(
            self.runtime.handle_base_request(handler, "POST", "127.0.0.1").handled
        )

    def test_operation_binding_does_not_charge_metadata_as_export(self) -> None:
        binding = operation_binding("export_columns", {})
        self.assertEqual("/leadsearch/export", binding.authorization_route)
        self.assertEqual("/web/bridge", binding.usage_route)
        self.assertFalse(binding.export)

    def test_ai_wallet_reuses_interpret_route_and_trusted_context(self) -> None:
        binding = operation_binding("ai_wallet", {})
        self.assertEqual("/leadsearch/interpret", binding.authorization_route)
        self.assertEqual("/leadsearch/interpret", binding.usage_route)

        trusted = {"principal_type": "web", "license_id": "lic-1"}

        class Auth:
            @staticmethod
            def authorization_context():
                return dict(trusted)

        class Main:
            normalize_premium_ai_filters = staticmethod(lambda value: value)

        calls: list[tuple[Any, ...]] = []

        def interpreter(payload, context, **kwargs):
            calls.append((payload, context, kwargs))
            return {"ok": True, "wallet": {"available_neur": 123}}

        result = _read_ai_wallet_for_web(Main(), interpreter, Auth())
        self.assertEqual({"ok": True, "wallet": {"available_neur": 123}}, result)
        self.assertEqual("belgobase-premium-v1", calls[0][0]["contract"])
        self.assertEqual("wallet", calls[0][0]["action"])
        self.assertRegex(calls[0][0]["request_id"], r"^[0-9a-f-]{36}$")
        self.assertEqual(trusted, calls[0][1])
        self.assertIs(calls[0][2]["normalize_callback"], Main.normalize_premium_ai_filters)

        with self.assertRaisesRegex(RuntimeConfigurationError, "premium wallet response is invalid"):
            _read_ai_wallet_for_web(
                Main(), lambda *_args, **_kwargs: {"ok": True}, Auth()
            )

    def test_account_deactivate_revokes_browser_and_clears_cookie(self) -> None:
        body = json.dumps(
            {
                "method": "account_action",
                "payload": {"action": "deactivate", "confirmed": True},
            }
        ).encode()
        handler = Handler("POST", "/web/bridge", self.headers(), body)
        self.runtime.handle_base_request(handler, "POST", "198.51.100.8")
        self.assertEqual(200, handler.status)
        self.assertTrue(handler.json_body["deactivated"])
        self.assertIn("Max-Age=0", handler.response_headers["Set-Cookie"])
        with self.assertRaisesRegex(Exception, "session_invalid"):
            self.service.validate_session(self.grant.token)


if __name__ == "__main__":
    unittest.main()
