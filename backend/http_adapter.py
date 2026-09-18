from __future__ import annotations

import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from http.cookies import SimpleCookie
from typing import Any

from .authorization import require_scopes
from .web_auth import AuthContext, AuthError, WebAuthService


BridgeHandler = Callable[[str, dict[str, Any], dict[str, Any]], Any]
ScopeResolver = Callable[[str, dict[str, Any]], frozenset[str]]


@dataclass(frozen=True)
class HTTPResponse:
    status: int
    body: dict[str, Any]
    headers: dict[str, str]
    audit_context: dict[str, Any] | None = None
    # HTTP permits repeated Set-Cookie fields.  They must never be folded into
    # one comma-separated value because Expires and cookie parsing make that
    # ambiguous.  Ordinary responses keep using ``headers``.
    multi_headers: tuple[tuple[str, str], ...] = ()


class WebAuthHTTPAdapter:
    """Framework-neutral `/web/*` handler for the trusted server process.

    The adapter accepts a network-derived ``source`` value.  It deliberately
    does not trust a browser-supplied client-IP header.  The bridge callback
    receives only the server-created AuthContext; client JSON cannot supply or
    override licence, tenant, plan, rights, user or browser identity.
    """

    def __init__(
        self,
        service: WebAuthService,
        *,
        allowed_origins: set[str] | frozenset[str],
        production: bool = True,
        bridge_handler: BridgeHandler | None = None,
        bridge_scope_resolver: ScopeResolver | None = None,
    ) -> None:
        if not allowed_origins or any(not origin.startswith("https://") for origin in allowed_origins):
            if production:
                raise ValueError("production web auth requires explicit HTTPS origins")
        self.service = service
        self.allowed_origins = frozenset(origin.rstrip("/") for origin in allowed_origins)
        self.production = production
        self.bridge_handler = bridge_handler
        self.bridge_scope_resolver = bridge_scope_resolver
        self.cookie_name = "__Host-belgobase_session" if production else "belgobase_session"

    @staticmethod
    def _header(headers: Mapping[str, str], name: str) -> str:
        lowered = name.lower()
        for key, value in headers.items():
            if str(key).lower() == lowered:
                return str(value)
        return ""

    def _token(self, headers: Mapping[str, str]) -> str:
        raw = self._header(headers, "Cookie")
        cookie = SimpleCookie()
        try:
            cookie.load(raw)
        except Exception:
            return ""
        morsel = cookie.get(self.cookie_name)
        return morsel.value if morsel is not None else ""

    def _require_post(self, headers: Mapping[str, str]) -> None:
        origin = self._header(headers, "Origin").rstrip("/")
        if origin not in self.allowed_origins:
            raise AuthError("origin_invalid", 403)
        content_type = self._header(headers, "Content-Type").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            raise AuthError("content_type_invalid", 415)

    @staticmethod
    def _json(raw: bytes | str | None, *, max_bytes: int) -> dict[str, Any]:
        if raw is None:
            return {}
        try:
            if isinstance(raw, bytes):
                if len(raw) > max_bytes:
                    raise AuthError("request_too_large", 413)
                text = raw.decode("utf-8")
            else:
                text = raw
                if len(text.encode("utf-8")) > max_bytes:
                    raise AuthError("request_too_large", 413)
            value = json.loads(text) if text else {}
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise AuthError("invalid_request", 400) from exc
        if not isinstance(value, dict):
            raise AuthError("invalid_request", 400)
        return value

    def _set_cookie(self, token: str, max_age: int) -> str:
        attributes = [
            f"{self.cookie_name}={token}",
            "Path=/",
            "HttpOnly",
            "SameSite=Lax",
            f"Max-Age={int(max_age)}",
        ]
        if self.production:
            attributes.append("Secure")
        return "; ".join(attributes)

    def _clear_cookie(self) -> str:
        return self._set_cookie("", 0)

    @staticmethod
    def _headers(**extra: str) -> dict[str, str]:
        return {
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8",
            **extra,
        }

    def _session(self, headers: Mapping[str, str], *, csrf: bool) -> tuple[str, AuthContext]:
        token = self._token(headers)
        context = self.service.validate_session(token)
        if csrf:
            self.service.require_csrf(token, self._header(headers, "X-BelgoBase-CSRF"))
        return token, context

    def authenticate(
        self, headers: Mapping[str, str], *, require_csrf: bool = False
    ) -> tuple[str, AuthContext]:
        return self._session(headers, csrf=require_csrf)

    def parse_json_post(
        self,
        headers: Mapping[str, str],
        body: bytes | str | None,
        *,
        max_bytes: int,
    ) -> dict[str, Any]:
        self._require_post(headers)
        return self._json(body, max_bytes=max_bytes)

    @staticmethod
    def _session_body(token: str, context: AuthContext, service: WebAuthService) -> dict[str, Any]:
        return {
            "ok": True,
            "authenticated": True,
            "account": {"email": context.email},
            "auth_context": context.as_dict(),
            "csrf": service.csrf_token(token),
        }

    def handle(
        self,
        method: str,
        path: str,
        headers: Mapping[str, str],
        body: bytes | str | None = None,
        *,
        source: str = "unknown",
    ) -> HTTPResponse:
        verb = str(method).upper()
        route = str(path).split("?", 1)[0].rstrip("/") or "/"
        try:
            if verb == "GET" and route == "/web/auth/session":
                token, context = self._session(headers, csrf=False)
                return HTTPResponse(
                    200,
                    self._session_body(token, context, self.service),
                    self._headers(),
                    context.as_dict(),
                )
            if verb == "GET" and route == "/web/auth/sessions":
                token, _context = self._session(headers, csrf=False)
                return HTTPResponse(
                    200,
                    {"ok": True, "sessions": self.service.list_browsers(token)},
                    self._headers(),
                    _context.as_dict(),
                )
            if verb != "POST":
                raise AuthError("not_found", 404)
            self._require_post(headers)
            request = self._json(
                body,
                max_bytes=8 * 1024 * 1024 if route == "/web/bridge" else 16_384,
            )

            if route == "/web/auth/claim":
                result = self.service.start_claim(
                    request.get("email"),
                    request.get("license_code"),
                    remember_browser=request.get("remember_browser"),
                    source=source,
                )
                return HTTPResponse(202, result, self._headers())
            if route == "/web/auth/login":
                result = self.service.start_login(
                    request.get("email"),
                    remember_browser=request.get("remember_browser"),
                    source=source,
                )
                return HTTPResponse(202, result, self._headers())
            if route == "/web/auth/verify":
                grant = self.service.verify_code(request.get("challenge_id"), request.get("code"))
                return HTTPResponse(
                    200,
                    self._session_body(grant.token, grant.context, self.service),
                    self._headers(**{"Set-Cookie": self._set_cookie(grant.token, grant.max_age_seconds)}),
                    grant.context.as_dict(),
                )
            if route == "/web/auth/logout":
                token, _context = self._session(headers, csrf=True)
                self.service.logout(token)
                return HTTPResponse(
                    200,
                    {"ok": True},
                    self._headers(**{"Set-Cookie": self._clear_cookie()}),
                    _context.as_dict(),
                )
            if route == "/web/auth/logout-all":
                token, _context = self._session(headers, csrf=True)
                self.service.logout_all(token)
                return HTTPResponse(
                    200,
                    {"ok": True},
                    self._headers(**{"Set-Cookie": self._clear_cookie()}),
                    _context.as_dict(),
                )
            if route == "/web/auth/revoke":
                token, _context = self._session(headers, csrf=True)
                current = self.service.revoke_browser(token, request.get("browser_id"))
                headers_out = self._headers()
                if current:
                    headers_out["Set-Cookie"] = self._clear_cookie()
                return HTTPResponse(
                    200,
                    {"ok": True, "current_session_revoked": current},
                    headers_out,
                    _context.as_dict(),
                )
            if route == "/web/bridge":
                _token, context = self._session(headers, csrf=True)
                bridge_method = request.get("method")
                payload = request.get("payload")
                if not isinstance(bridge_method, str) or not bridge_method or len(bridge_method) > 100:
                    raise AuthError("invalid_request", 400)
                if not isinstance(payload, dict):
                    raise AuthError("invalid_request", 400)
                if self.bridge_handler is None or self.bridge_scope_resolver is None:
                    raise AuthError("bridge_unavailable", 503)
                required = self.bridge_scope_resolver(bridge_method, payload)
                if not isinstance(required, frozenset):
                    raise AuthError("authorization_policy_invalid", 500)
                effective = require_scopes(context, required)
                server_context = context.as_dict()
                server_context["required_scopes"] = sorted(required)
                server_context["effective_scopes"] = sorted(effective)
                result = self.bridge_handler(bridge_method, payload, server_context)
                if not isinstance(result, dict) or type(result.get("ok")) is not bool:
                    raise AuthError("bridge_response_invalid", 500)
                headers_out = self._headers()
                if result.get("deactivated") is True:
                    headers_out["Set-Cookie"] = self._clear_cookie()
                return HTTPResponse(200, result, headers_out, server_context)
            raise AuthError("not_found", 404)
        except AuthError as exc:
            return HTTPResponse(exc.status, {"ok": False, "error": exc.code}, self._headers())
        except Exception:
            return HTTPResponse(500, {"ok": False, "error": "internal_error"}, self._headers())
