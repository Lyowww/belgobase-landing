from __future__ import annotations

import json
import os
import re
import threading
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .authorization import require_scopes
from .enrollment import (
    AccountServiceEnrollmentClient,
    WebEnrollmentHTTPAdapter,
    WebEnrollmentService,
)
from .http_adapter import HTTPResponse, WebAuthHTTPAdapter
from .mailer import SignedWebsiteMailer
from .registry import BelgoBaseLicenseRegistry
from .web_auth import AuthError, WebAuthConfig, WebAuthService
from .workspace_integration import (
    make_workspace_bridge_handler,
    workspace_auth_context,
    workspace_scope_resolver,
)


WEB_ENABLED_ENV = "BELGOBASE_WEB_ENABLED"
DOWNLOAD_PATTERN = re.compile(r"^/web/download/([A-Za-z0-9_-]{16,100})$")


class RuntimeConfigurationError(RuntimeError):
    pass


@dataclass(frozen=True)
class RuntimeHandleResult:
    handled: bool
    auth_context: dict[str, Any] | None = None


@dataclass(frozen=True)
class OperationBinding:
    authorization_route: str | None
    usage_route: str
    export: bool = False


PreauthenticatedAuthorizer = Callable[
    [str, str, dict[str, Any], str], dict[str, Any]
]
AIInterpreter = Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]
VoiceTranscriber = Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]
DownloadResolver = Callable[[str, Any], Path]


def operation_binding(method: str, payload: dict[str, Any]) -> OperationBinding:
    filters = payload.get("filters") if isinstance(payload.get("filters"), dict) else {}
    uses_xbrl = bool(filters.get("xbrl_metric_filters"))
    if method == "search":
        route = "/xbrl/leadsearch/results" if uses_xbrl else "/leadsearch/results"
        return OperationBinding(route, route)
    if method == "company" or method == "compare_companies" or method == "similar_company":
        return OperationBinding("/company/lookup", "/company/lookup")
    if method == "relaxation_suggestions":
        return OperationBinding("/leadsearch/count", "/leadsearch/count")
    if method == "ai":
        return OperationBinding("/leadsearch/interpret", "/leadsearch/interpret")
    if method == "xbrl_catalog":
        return OperationBinding("/xbrl/metrics/browse", "/xbrl/metrics/browse")
    if method in {"export_results", "export_selection"}:
        route = "/xbrl/leadsearch/export" if uses_xbrl else "/leadsearch/export"
        return OperationBinding(route, route, export=True)
    if method == "export_columns":
        return OperationBinding("/leadsearch/export", "/web/bridge")
    if method == "workspace_data" and payload.get("section") == "xbrl":
        return OperationBinding("/xbrl/metrics/browse", "/web/bridge")
    if method in {"filters_apply", "similar_apply"} and uses_xbrl:
        return OperationBinding("/xbrl/leadsearch/results", "/web/bridge")
    if method == "account_action":
        return OperationBinding(None, "/web/bridge")
    # These operations are account-local but still require data.read in the
    # bridge resolver. Reuse the existing light data.read policy for the
    # authorization decision without charging a company lookup operation.
    return OperationBinding("/company/lookup", "/web/bridge")


class DisabledWebRuntime:
    enabled = False

    @staticmethod
    def matches(_path: str) -> bool:
        return False

    @staticmethod
    def handle_base_request(
        _handler: Any, _method: str, _source_ip: str
    ) -> RuntimeHandleResult:
        return RuntimeHandleResult(False)


class WebRuntime:
    enabled = True

    def __init__(
        self,
        *,
        auth_service: WebAuthService,
        workspace_service: Any,
        usage_controller: Any,
        authorize_context: PreauthenticatedAuthorizer,
        allowed_origins: set[str] | frozenset[str],
        production: bool,
        ai_interpreter: AIInterpreter,
        voice_transcriber: VoiceTranscriber,
        download_resolver: DownloadResolver,
        enrollment_service: WebEnrollmentService | None = None,
    ) -> None:
        dependencies = {
            "workspace_service.execute": getattr(workspace_service, "execute", None),
            "usage_controller.start_request": getattr(usage_controller, "start_request", None),
            "authorize_context": authorize_context,
            "ai_interpreter": ai_interpreter,
            "voice_transcriber": voice_transcriber,
            "download_resolver": download_resolver,
        }
        missing = [name for name, value in dependencies.items() if not callable(value)]
        if missing:
            raise RuntimeConfigurationError(
                "web runtime dependencies missing: " + ", ".join(sorted(missing))
            )
        self.auth_service = auth_service
        self.workspace_service = workspace_service
        self.workspace_handler = make_workspace_bridge_handler(workspace_service)
        self.usage_controller = usage_controller
        self.authorize_context = authorize_context
        self.ai_interpreter = ai_interpreter
        self.voice_transcriber = voice_transcriber
        self.download_resolver = download_resolver
        self._thread = threading.local()
        self.http = WebAuthHTTPAdapter(
            auth_service,
            allowed_origins=allowed_origins,
            production=production,
            bridge_handler=self._bridge,
            bridge_scope_resolver=workspace_scope_resolver,
        )
        self.enrollment_http = (
            WebEnrollmentHTTPAdapter(
                enrollment_service,
                allowed_origins=allowed_origins,
                production=production,
            )
            if enrollment_service is not None
            else None
        )

    @staticmethod
    def matches(path: str) -> bool:
        return str(path).split("?", 1)[0].startswith("/web/")

    def _source(self) -> str:
        return str(getattr(self._thread, "source_ip", "unknown"))

    def _authorize(
        self, route: str | None, context: dict[str, Any]
    ) -> dict[str, Any]:
        if route is None:
            return dict(context)
        authorized = self.authorize_context("POST", route, dict(context), self._source())
        if not isinstance(authorized, dict):
            raise AuthError("authorization_policy_invalid", 500)
        for key in ("license_id", "customer_id", "user_id", "browser_id", "quota_subject_id"):
            if str(authorized.get(key) or "") != str(context.get(key) or ""):
                raise AuthError("authorization_context_changed", 500)
        return authorized

    def _start_permit(
        self, route: str, context: dict[str, Any], payload: dict[str, Any]
    ) -> Any:
        permit = self.usage_controller.start_request(
            "POST", route, self._source(), context
        )
        configure = getattr(permit, "configure_payload", None)
        close = getattr(permit, "close", None)
        if not callable(configure) or not callable(close):
            if callable(close):
                close()
            raise AuthError("usage_controller_invalid", 500)
        try:
            configure(payload)
        except Exception:
            close()
            raise
        return permit

    @staticmethod
    def _translate_runtime_error(exc: Exception) -> AuthError:
        status = getattr(exc, "status", None)
        code = getattr(exc, "error", None) or getattr(exc, "code", None)
        if isinstance(status, int) and isinstance(code, str) and re.fullmatch(
            r"[a-z0-9_]{1,100}", code
        ):
            return AuthError(code, status)
        if exc.__class__.__name__ == "RequestTimeoutExceeded":
            return AuthError("request_timeout", 504)
        if exc.__class__.__name__ == "AuthenticationRequired":
            return AuthError("session_invalid", 401)
        if exc.__class__.__name__ == "AuthorizationDenied":
            return AuthError("authorization_denied", 403)
        return AuthError("internal_error", 500)

    def _bridge(
        self, method: str, payload: dict[str, Any], context: dict[str, Any]
    ) -> dict[str, Any]:
        binding = operation_binding(method, payload)
        permit = None
        try:
            authorized = self._authorize(binding.authorization_route, context)
            permit = self._start_permit(binding.usage_route, authorized, payload)
            if method == "ai":
                proposal = self.ai_interpreter(payload, authorized)
                if not isinstance(proposal, dict):
                    raise AuthError("ai_invalid_response", 502)
                result = {"ok": True, "proposal": proposal}
            elif (
                method == "account_action"
                and payload.get("action") == "deactivate"
                and payload.get("confirmed") is True
            ):
                self.auth_service.revoke_authenticated_browser(
                    self.auth_service.validate_session(
                        self._thread.session_token, touch=False
                    )
                )
                result = {"ok": True, "deactivated": True}
            else:
                result = self.workspace_handler(method, payload, authorized)
            check_deadline = getattr(permit, "check_deadline", None)
            if callable(check_deadline):
                check_deadline()
            if binding.export and result.get("ok") is True:
                complete = getattr(permit, "complete", None)
                if not callable(complete):
                    raise AuthError("usage_controller_invalid", 500)
                complete(int(result.get("rows") or 0))
            return result
        except AuthError:
            raise
        except Exception as exc:
            raise self._translate_runtime_error(exc) from exc
        finally:
            if permit is not None:
                permit.close()

    @staticmethod
    def _content_length(headers: Mapping[str, str]) -> int:
        normalized = {str(key).lower(): str(value) for key, value in headers.items()}
        transfer = normalized.get("transfer-encoding", "").strip()
        if transfer:
            raise AuthError("content_length_required", 411)
        raw = normalized.get("content-length", "0").strip()
        if raw and not raw.isdigit():
            raise AuthError("content_length_invalid", 400)
        return int(raw or "0")

    def _read_body(self, handler: Any, maximum: int) -> bytes:
        length = self._content_length(handler.headers)
        if length > maximum:
            raise AuthError("request_too_large", 413)
        raw = handler.rfile.read(length) if length else b""
        if len(raw) != length:
            raise AuthError("incomplete_request", 400)
        return raw

    @staticmethod
    def _send_json(handler: Any, response: HTTPResponse) -> None:
        extra = {
            name: value
            for name, value in response.headers.items()
            if name.lower() not in {"content-type", "content-length"}
        }
        send_json = getattr(handler, "send_json", None)
        if callable(send_json) and not response.multi_headers:
            send_json(response.status, response.body, extra)
            return
        raw = json.dumps(
            response.body, ensure_ascii=False, separators=(",", ":")
        ).encode("utf-8")
        handler.send_response(response.status)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(raw)))
        for name, value in extra.items():
            handler.send_header(name, value)
        for name, value in response.multi_headers:
            handler.send_header(name, value)
        handler.end_headers()
        handler.wfile.write(raw)

    def _voice(
        self, headers: Mapping[str, str], body: bytes
    ) -> HTTPResponse:
        payload = self.http.parse_json_post(headers, body, max_bytes=2_600_000)
        _token, context = self.http.authenticate(headers, require_csrf=True)
        authorized = self._authorize("/leadsearch/transcribe", context.as_dict())
        permit = None
        try:
            permit = self._start_permit("/leadsearch/transcribe", authorized, payload)
            result = self.voice_transcriber(payload, authorized)
            if not isinstance(result, dict) or result.get("ok") is not True:
                raise AuthError("voice_invalid_response", 502)
            check_deadline = getattr(permit, "check_deadline", None)
            if callable(check_deadline):
                check_deadline()
            return HTTPResponse(
                200,
                result,
                {"Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8"},
                authorized,
            )
        except AuthError:
            raise
        except Exception as exc:
            raise self._translate_runtime_error(exc) from exc
        finally:
            if permit is not None:
                permit.close()

    def _download(self, handler: Any, route: str) -> RuntimeHandleResult:
        match = DOWNLOAD_PATTERN.fullmatch(route)
        if match is None:
            raise AuthError("not_found", 404)
        _token, context = self.http.authenticate(handler.headers, require_csrf=False)
        base = context.as_dict()
        authorized = self._authorize("/leadsearch/export", base)
        permit = None
        try:
            permit = self._start_permit("/web/download", authorized, {})
            workspace_context = workspace_auth_context(authorized)
            path = Path(self.download_resolver(match.group(1), workspace_context)).resolve()
            if not path.is_file():
                raise AuthError("download_not_found", 404)
            size = path.stat().st_size
            handler._audit_response_bytes = size
            handler.send_response(200)
            handler.send_header(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            handler.send_header(
                "Content-Disposition", 'attachment; filename="belgobase-export.xlsx"'
            )
            handler.send_header("Content-Length", str(size))
            handler.send_header("Cache-Control", "private, no-store")
            handler.end_headers()
            with path.open("rb") as source:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk:
                        break
                    handler.wfile.write(chunk)
            return RuntimeHandleResult(True, authorized)
        finally:
            if permit is not None:
                permit.close()

    def handle_base_request(
        self, handler: Any, method: str, source_ip: str
    ) -> RuntimeHandleResult:
        route = str(handler.path).split("?", 1)[0].rstrip("/") or "/"
        if not self.matches(route):
            return RuntimeHandleResult(False)
        verb = str(method).upper()
        self._thread.source_ip = str(source_ip or "unknown")
        self._thread.session_token = ""
        try:
            if verb == "GET" and route.startswith("/web/download/"):
                return self._download(handler, route)
            body = b""
            if verb == "POST":
                maximum = 2_600_000 if route == "/web/voice" else (
                    8 * 1024 * 1024 if route == "/web/bridge" else 16_384
                )
                body = self._read_body(handler, maximum)
            if route == "/web/voice" and verb == "POST":
                response = self._voice(handler.headers, body)
            elif route.startswith("/web/enrollment/"):
                if self.enrollment_http is None:
                    raise AuthError("enrollment_unavailable", 503)
                response = self.enrollment_http.handle(
                    verb,
                    route,
                    handler.headers,
                    body,
                    source=str(source_ip or "unknown"),
                )
            else:
                if route == "/web/bridge":
                    self._thread.session_token = self.http._token(handler.headers)
                response = self.http.handle(
                    verb,
                    route,
                    handler.headers,
                    body,
                    source=str(source_ip or "unknown"),
                )
            self._send_json(handler, response)
            return RuntimeHandleResult(True, response.audit_context)
        except AuthError as exc:
            response = HTTPResponse(
                exc.status,
                {"ok": False, "error": exc.code},
                {"Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8"},
            )
            self._send_json(handler, response)
            return RuntimeHandleResult(True)
        except Exception as exc:
            translated = self._translate_runtime_error(exc)
            response = HTTPResponse(
                translated.status,
                {"ok": False, "error": translated.code},
                {"Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8"},
            )
            self._send_json(handler, response)
            return RuntimeHandleResult(True)
        finally:
            self._thread.source_ip = "unknown"
            self._thread.session_token = ""


def _required_env(env: Mapping[str, str], name: str) -> str:
    value = str(env.get(name) or "").strip()
    if not value:
        raise RuntimeConfigurationError(f"missing required setting: {name}")
    return value


def _read_secret(path_text: str, *, minimum: int = 32) -> bytes:
    path = Path(path_text)
    try:
        value = path.read_bytes()
    except OSError as exc:
        raise RuntimeConfigurationError("web secret file is unavailable") from exc
    if len(value) < minimum:
        raise RuntimeConfigurationError("web secret file is too short")
    return value


def build_web_runtime_from_environment(
    main_module: Any,
    *,
    env: Mapping[str, str] | None = None,
) -> DisabledWebRuntime | WebRuntime:
    """Construct the runtime only when the explicit feature flag is enabled."""

    values = os.environ if env is None else env
    flag = str(values.get(WEB_ENABLED_ENV) or "0").strip()
    if flag == "0":
        return DisabledWebRuntime()
    if flag != "1":
        raise RuntimeConfigurationError(f"{WEB_ENABLED_ENV} must be 0 or 1")

    secret_file = _required_env(values, "BELGOBASE_WEB_AUTH_SECRET_FILE")
    mail_key_file = _required_env(values, "BELGOBASE_WEB_MAIL_PRIVATE_KEY_FILE")
    account_proof_file = _required_env(
        values, "BELGOBASE_ACCOUNT_INTERNAL_PROOF_FILE"
    )
    mail_endpoint = _required_env(values, "BELGOBASE_WEB_MAIL_RELAY_URL")
    origins = {
        item.strip().rstrip("/")
        for item in _required_env(values, "BELGOBASE_WEB_ALLOWED_ORIGINS").split(",")
        if item.strip()
    }
    if not origins:
        raise RuntimeConfigurationError("no allowed web origins configured")

    try:
        from belgobase_authorization_45a import authorize_preauthenticated_customer
        from belgobase_license_registry_42a import (
            DEFAULT_DATABASE_PATH,
            DEFAULT_PEPPER_PATH,
            validate_credential,
        )
        from belgobase_usage_limits_46a import USAGE_CONTROLLER
        from belgobase_voice_transcription import transcribe
        from belgobase_premium_ai_server import interpret_premium
        from .web_core import WebCore
        from .web_workspace import AtomicTenantStore, WorkspaceError, WorkspaceService
    except ImportError as exc:
        raise RuntimeConfigurationError("web runtime dependency import failed") from exc

    database_path = Path(
        str(values.get("BELGOBASE_WEB_STATE_DATABASE") or DEFAULT_DATABASE_PATH)
    ).resolve()
    if database_path != Path(DEFAULT_DATABASE_PATH).resolve():
        raise RuntimeConfigurationError("web auth must use the central licence database")

    registry = BelgoBaseLicenseRegistry(
        database_path,
        lambda credential, now: validate_credential(
            credential,
            database_path=database_path,
            pepper_path=DEFAULT_PEPPER_PATH,
            now=now,
        ),
    )
    mailer = SignedWebsiteMailer.from_ed25519_pem(
        endpoint=mail_endpoint,
        private_key_path=Path(mail_key_file),
    )
    auth_service = WebAuthService(
        WebAuthConfig(
            state_database=database_path,
            secret=_read_secret(secret_file),
        ),
        registry,
        mailer,
    )
    def enrollment_company_lookup(number: str) -> dict[str, Any]:
        normalized, company, _source = main_module.lookup_company(number)
        legal_name = str(company.get("naam") or "").strip()
        if not legal_name:
            raise LookupError("company legal name is missing")
        return {
            "company_type": "business",
            "enterprise_number": normalized,
            "legal_name": legal_name,
            "address": {
                "street": str(company.get("straat") or "").strip(),
                "house_number": str(company.get("huisnummer") or "").strip(),
                "postal_code": str(company.get("postcode") or "").strip(),
                "municipality": str(company.get("gemeente") or "").strip(),
            },
        }

    central_enrollment = AccountServiceEnrollmentClient(
        base_url=str(
            values.get("BELGOBASE_ACCOUNT_INTERNAL_URL")
            or "http://127.0.0.1:8765"
        ),
        proof_token=_read_secret(account_proof_file),
        company_lookup=enrollment_company_lookup,
    )
    enrollment_service = WebEnrollmentService(
        auth_service, central_enrollment, mailer
    )

    def core_authorize(auth: Any, action: str, payload: Mapping[str, Any]) -> None:
        method = "export_results" if action == "export" else action
        required = workspace_scope_resolver(method, dict(payload))
        try:
            require_scopes(auth.authorization_context(), required)
        except AuthError as exc:
            raise WorkspaceError("Deze actie is niet toegestaan voor je licentie.") from exc

    package_dir = Path(__file__).resolve().parent
    assets_dir = Path(
        str(values.get("BELGOBASE_WEB_ASSETS_DIR") or package_dir / "workspace_assets")
    )
    state_root = Path(
        str(values.get("BELGOBASE_WEB_WORKSPACE_ROOT") or r"C:\BelgoBase_App\web_workspace")
    )
    download_root = Path(
        str(values.get("BELGOBASE_WEB_DOWNLOAD_ROOT") or r"C:\BelgoBase_App\web_downloads")
    )
    metadata_path = assets_dir / "workspace_metadata.json"
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        raise RuntimeConfigurationError("web workspace metadata is unavailable") from exc
    if not isinstance(metadata, dict):
        raise RuntimeConfigurationError("web workspace metadata is invalid")
    logo_path = Path(
        str(values.get("BELGOBASE_WEB_LOGO_PATH") or assets_dir / "belgobase_bb_logo.png")
    )
    web_core = WebCore(
        main_module,
        core_authorize,
        download_root,
        metadata,
        logo_path,
        account_projector=lambda auth, payload: central_enrollment.project_account(
            auth.authorization_context(), payload
        ),
    )
    workspace = WorkspaceService(web_core.callbacks(), AtomicTenantStore(state_root), assets_dir)

    def resolve_download(job_id: str, auth: Any) -> Path:
        state = workspace.storage.load(auth)
        downloads = state.get("downloads") if isinstance(state, dict) else None
        item = downloads.get(job_id) if isinstance(downloads, dict) else None
        reference = item.get("reference") if isinstance(item, dict) else None
        if not isinstance(reference, str) or not reference:
            raise AuthError("download_not_found", 404)
        return web_core.resolve_download(reference, auth)

    def interpret(payload: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        new_session = payload.get("session_id") is None
        return interpret_premium(
            payload,
            context,
            normalize_callback=main_module.normalize_premium_ai_filters,
            enum_values=main_module.premium_ai_enum_values() if new_session else None,
            metric_catalog=main_module.premium_ai_metric_catalog() if new_session else None,
        )

    def preauthorize(
        method: str, route: str, context: dict[str, Any], source_ip: str
    ) -> dict[str, Any]:
        return authorize_preauthenticated_customer(
            method, route, context, source_ip=source_ip
        )

    production = str(values.get("BELGOBASE_WEB_PRODUCTION") or "1").strip() != "0"
    return WebRuntime(
        auth_service=auth_service,
        workspace_service=workspace,
        usage_controller=USAGE_CONTROLLER,
        authorize_context=preauthorize,
        allowed_origins=origins,
        production=production,
        ai_interpreter=interpret,
        voice_transcriber=transcribe,
        download_resolver=resolve_download,
        enrollment_service=enrollment_service,
    )
