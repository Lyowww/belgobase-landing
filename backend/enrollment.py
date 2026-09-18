from __future__ import annotations

import datetime as dt
import hmac
import json
import re
import secrets
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from http.cookies import SimpleCookie
from typing import Any, Callable, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener

from .http_adapter import HTTPResponse
from .mailer import LoginCodeMailer, MailDeliveryError
from .web_auth import AuthError, OTP_PATTERN, SessionGrant, WebAuthService


ENTERPRISE_PATTERN = re.compile(r"^[0-9]{10}$")
ENROLLMENT_TTL = dt.timedelta(hours=1)
LEGAL_DOCUMENT_ROUTE = re.compile(
    r"^/web/enrollment/legal/([A-Za-z0-9_-]{1,128})/([A-Za-z0-9_.-]{1,150})$"
)


class CentralEnrollmentError(RuntimeError):
    def __init__(self, code: str, status: int = 400) -> None:
        self.code = code
        self.status = status
        super().__init__(code)


@dataclass(frozen=True)
class EnrollmentPreparation:
    claim_id: str
    license_id: str
    customer_id: str
    email: str


@dataclass(frozen=True)
class EnrollmentCompletion:
    completion_id: str
    claim_id: str
    license_id: str
    customer_id: str
    email: str


@dataclass(frozen=True)
class EnrollmentSession:
    enrollment_session_id: str
    token: str
    email: str
    claim_id: str
    license_id: str
    customer_id: str
    remember_browser: bool
    csrf_token: str
    expires_at: dt.datetime
    completed: bool = False


class CentralEnrollmentBackend(Protocol):
    """Trusted central account service; browser input never implements this."""

    def prepare(
        self, license_code: str, email: str, *, now: dt.datetime
    ) -> EnrollmentPreparation: ...

    def cancel(self, claim_id: str) -> None: ...

    def autofill(
        self, claim_id: str, email: str, enterprise_number: str, *, now: dt.datetime
    ) -> dict[str, Any]: ...

    def complete(
        self, claim_id: str, email: str, request: dict[str, Any], *, now: dt.datetime
    ) -> EnrollmentCompletion: ...

    def document(
        self, claim_id: str, email: str, preflight_id: str, document_id: str
    ) -> dict[str, Any]: ...


class AccountServiceEnrollmentClient:
    """Loopback client for the central, signed-receipt account service."""

    def __init__(
        self,
        *,
        base_url: str,
        proof_token: bytes,
        opener: Any | None = None,
        timeout_seconds: int = 15,
        company_lookup: Callable[[str], dict[str, Any]] | None = None,
    ) -> None:
        normalized = str(base_url or "").rstrip("/")
        if normalized not in {"http://127.0.0.1:8765", "http://localhost:8765"}:
            raise ValueError("central enrollment service must be loopback port 8765")
        if len(proof_token) < 32:
            raise ValueError("central enrollment proof token is too short")
        self.base_url = normalized
        try:
            self.proof_token = proof_token.decode("ascii", errors="strict").strip()
        except UnicodeDecodeError as exc:
            raise ValueError("central enrollment proof token is invalid") from exc
        if len(self.proof_token) < 32:
            raise ValueError("central enrollment proof token is invalid")
        self.opener = opener or build_opener()
        self.timeout_seconds = int(timeout_seconds)
        self.company_lookup = company_lookup

    def _post(self, route: str, payload: dict[str, Any]) -> dict[str, Any]:
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        request = Request(
            self.base_url + route,
            data=raw,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Content-Length": str(len(raw)),
                "X-BelgoBase-Internal-Proof": self.proof_token,
            },
        )
        try:
            with self.opener.open(request, timeout=self.timeout_seconds) as response:
                if int(getattr(response, "status", 0)) != 200:
                    raise CentralEnrollmentError("temporarily_unavailable", 503)
                result = json.loads(response.read(262_145).decode("utf-8"))
        except HTTPError as exc:
            try:
                result = json.loads(exc.read(65_537).decode("utf-8"))
            except Exception:
                raise CentralEnrollmentError("temporarily_unavailable", 503) from exc
            code = str(result.get("error") or "temporarily_unavailable")
            safe = {
                "claim_unavailable": ("claim_unavailable", 409),
                "binding_conflict": ("binding_conflict", 409),
                "company_not_found": ("company_not_found", 404),
                "document_not_found": ("document_not_found", 404),
                "legal_acceptance_invalid": ("legal_acceptance_invalid", 400),
                "consumer_registration_unavailable": (
                    "consumer_registration_unavailable",
                    409,
                ),
                "enrollment_expired": ("enrollment_expired", 401),
                "legal_document_changed": ("temporarily_unavailable", 503),
            }
            mapped = safe.get(code, ("temporarily_unavailable", 503))
            raise CentralEnrollmentError(*mapped) from exc
        except (URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as exc:
            raise CentralEnrollmentError("temporarily_unavailable", 503) from exc
        if not isinstance(result, dict) or result.get("ok") is not True:
            raise CentralEnrollmentError("temporarily_unavailable", 503)
        return result

    @staticmethod
    def _preparation(value: dict[str, Any]) -> EnrollmentPreparation:
        try:
            result = EnrollmentPreparation(
                claim_id=str(value["claim_id"]),
                license_id=str(value["license_id"]),
                customer_id=str(value["customer_id"]),
                email=str(value["email"]),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise CentralEnrollmentError("temporarily_unavailable", 503) from exc
        if not all((result.claim_id, result.license_id, result.customer_id, result.email)):
            raise CentralEnrollmentError("temporarily_unavailable", 503)
        return result

    def prepare(
        self, license_code: str, email: str, *, now: dt.datetime
    ) -> EnrollmentPreparation:
        return self._preparation(
            self._post(
                "/internal/web-enrollment/prepare",
                {"license_code": license_code, "email": email},
            )
        )

    def cancel(self, claim_id: str) -> None:
        self._post("/internal/web-enrollment/cancel", {"claim_id": claim_id})

    def autofill(
        self, claim_id: str, email: str, enterprise_number: str, *, now: dt.datetime
    ) -> dict[str, Any]:
        if self.company_lookup is None:
            raise CentralEnrollmentError("temporarily_unavailable", 503)
        try:
            company = self.company_lookup(enterprise_number)
        except (LookupError, ValueError):
            raise CentralEnrollmentError("company_not_found", 404)
        except Exception as exc:
            raise CentralEnrollmentError("temporarily_unavailable", 503) from exc
        if not isinstance(company, dict):
            raise CentralEnrollmentError("temporarily_unavailable", 503)
        result = self._post(
            "/internal/web-enrollment/autofill",
            {
                "claim_id": claim_id,
                "email": email,
                "enterprise_number": enterprise_number,
                "company": company,
            },
        )
        required = {"company", "legal", "preflight_id", "preflight_fingerprint"}
        if not required.issubset(result):
            raise CentralEnrollmentError("temporarily_unavailable", 503)
        return result

    def complete(
        self, claim_id: str, email: str, request: dict[str, Any], *, now: dt.datetime
    ) -> EnrollmentCompletion:
        result = self._post(
            "/internal/web-enrollment/complete",
            {"claim_id": claim_id, "email": email, **request},
        )
        try:
            completion = EnrollmentCompletion(
                completion_id=str(result["completion_id"]),
                claim_id=str(result["claim_id"]),
                license_id=str(result["license_id"]),
                customer_id=str(result["customer_id"]),
                email=str(result["email"]),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise CentralEnrollmentError("temporarily_unavailable", 503) from exc
        if not all(
            (
                completion.completion_id,
                completion.claim_id,
                completion.license_id,
                completion.customer_id,
                completion.email,
            )
        ):
            raise CentralEnrollmentError("temporarily_unavailable", 503)
        return completion

    def document(
        self, claim_id: str, email: str, preflight_id: str, document_id: str
    ) -> dict[str, Any]:
        return self._post(
            "/internal/web-enrollment/document",
            {
                "claim_id": claim_id,
                "email": email,
                "preflight_id": preflight_id,
                "document_id": document_id,
            },
        )

    def project_account(
        self, auth_context: dict[str, Any], payload: dict[str, Any]
    ) -> dict[str, Any]:
        return self._post(
            "/internal/web-account/project",
            {"auth_context": dict(auth_context), "payload": dict(payload)},
        )


class WebEnrollmentService:
    def __init__(
        self,
        auth: WebAuthService,
        central: CentralEnrollmentBackend,
        mailer: LoginCodeMailer,
    ) -> None:
        self.auth = auth
        self.central = central
        self.mailer = mailer

    def _now(self) -> dt.datetime:
        return self.auth._now()

    def _dummy_start(self) -> dict[str, Any]:
        return {
            "ok": True,
            "delivery": "if_license_available",
            "challenge_id": str(uuid.uuid4()),
        }

    def start(
        self,
        *,
        license_code: Any,
        email: Any,
        remember_browser: Any,
        source: str,
    ) -> dict[str, Any]:
        normalized = self.auth.normalize_email(email)
        credential = str(license_code or "").strip()
        if not credential or len(credential) > 200 or type(remember_browser) is not bool:
            raise AuthError("invalid_request", 400)
        connection = self.auth._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            source_hash = self.auth._consume_start_rates(connection, normalized, source)
            connection.commit()
        finally:
            connection.close()
        try:
            preparation = self.central.prepare(credential, normalized, now=self._now())
        except CentralEnrollmentError as exc:
            if exc.code in {"claim_unavailable", "binding_conflict"}:
                return self._dummy_start()
            raise AuthError(exc.code, exc.status) from exc
        if not hmac.compare_digest(preparation.email, normalized):
            try:
                self.central.cancel(preparation.claim_id)
            finally:
                raise AuthError("temporarily_unavailable", 503)

        now = self._now()
        expiry = now + dt.timedelta(minutes=self.auth.config.challenge_minutes)
        challenge_id = str(uuid.uuid4())
        code = f"{secrets.randbelow(1_000_000):06d}"
        connection = self.auth._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                """INSERT INTO web_enrollment_challenges(
                       challenge_id,central_claim_id,license_id,customer_id,email_normalized,
                       otp_hash,remember_browser,created_at,expires_at,source_hash
                   ) VALUES(?,?,?,?,?,?,?,?,?,?)""",
                (
                    challenge_id,
                    preparation.claim_id,
                    preparation.license_id,
                    preparation.customer_id,
                    normalized,
                    self.auth._digest("enrollment-otp:" + challenge_id, code),
                    int(remember_browser),
                    self.auth._iso(now),
                    self.auth._iso(expiry),
                    source_hash,
                ),
            )
            connection.commit()
        except Exception:
            connection.rollback()
            try:
                self.central.cancel(preparation.claim_id)
            finally:
                raise
        finally:
            connection.close()
        try:
            self.mailer.send_login_code(
                email=normalized,
                code=code,
                challenge_id=challenge_id,
                issued_at=now,
                expires_at=expiry,
            )
        except MailDeliveryError as exc:
            connection = self.auth._connect()
            try:
                connection.execute(
                    "DELETE FROM web_enrollment_challenges WHERE challenge_id=? AND delivered_at IS NULL",
                    (challenge_id,),
                )
                connection.commit()
            finally:
                connection.close()
            try:
                self.central.cancel(preparation.claim_id)
            finally:
                raise AuthError("mail_unavailable", 503) from exc
        connection = self.auth._connect()
        try:
            connection.execute(
                "UPDATE web_enrollment_challenges SET delivered_at=? WHERE challenge_id=?",
                (self.auth._iso(self._now()), challenge_id),
            )
            connection.commit()
        finally:
            connection.close()
        return {
            "ok": True,
            "delivery": "if_license_available",
            "challenge_id": challenge_id,
        }

    def verify(self, challenge_id: Any, code: Any) -> EnrollmentSession:
        challenge = str(challenge_id or "").strip()
        otp = str(code or "").strip()
        if len(challenge) > 100 or OTP_PATTERN.fullmatch(otp) is None:
            raise AuthError("code_invalid", 401)
        now = self._now()
        connection = self.auth._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM web_enrollment_challenges WHERE challenge_id=?",
                (challenge,),
            ).fetchone()
            if (
                row is None
                or row["delivered_at"] is None
                or row["consumed_at"] is not None
                or self.auth._parse(row["expires_at"]) <= now
                or int(row["failed_attempts"]) >= self.auth.config.max_failed_codes
            ):
                raise AuthError("code_invalid", 401)
            supplied = self.auth._digest("enrollment-otp:" + challenge, otp)
            if not hmac.compare_digest(str(row["otp_hash"]), supplied):
                connection.execute(
                    "UPDATE web_enrollment_challenges SET failed_attempts=failed_attempts+1 WHERE challenge_id=?",
                    (challenge,),
                )
                connection.commit()
                raise AuthError("code_invalid", 401)
            token = "BBE1-" + secrets.token_urlsafe(32)
            enrollment_id = str(uuid.uuid4())
            expires_at = now + ENROLLMENT_TTL
            connection.execute(
                """INSERT INTO web_enrollment_sessions(
                       enrollment_session_id,challenge_id,token_hash,created_at,expires_at
                   ) VALUES(?,?,?,?,?)""",
                (
                    enrollment_id,
                    challenge,
                    self.auth._digest("enrollment-session", token),
                    self.auth._iso(now),
                    self.auth._iso(expires_at),
                ),
            )
            connection.execute(
                "UPDATE web_enrollment_challenges SET consumed_at=? WHERE challenge_id=?",
                (self.auth._iso(now), challenge),
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
        return EnrollmentSession(
            enrollment_session_id=enrollment_id,
            token=token,
            email=str(row["email_normalized"]),
            claim_id=str(row["central_claim_id"]),
            license_id=str(row["license_id"]),
            customer_id=str(row["customer_id"]),
            remember_browser=bool(row["remember_browser"]),
            csrf_token=self.csrf_token(token),
            expires_at=expires_at,
        )

    def csrf_token(self, token: str) -> str:
        return self.auth._digest("enrollment-csrf", str(token))

    def session(
        self, token: Any, *, allow_completed: bool = False
    ) -> EnrollmentSession:
        supplied = str(token or "").strip()
        if not supplied or len(supplied) > 200:
            raise AuthError("enrollment_invalid", 401)
        now = self._now()
        connection = self.auth._connect()
        try:
            row = connection.execute(
                """SELECT s.enrollment_session_id,s.expires_at,s.consumed_at,s.revoked_at,
                          c.central_claim_id,c.license_id,c.customer_id,c.email_normalized,
                          c.remember_browser
                   FROM web_enrollment_sessions s
                   JOIN web_enrollment_challenges c ON c.challenge_id=s.challenge_id
                   WHERE s.token_hash=?""",
                (self.auth._digest("enrollment-session", supplied),),
            ).fetchone()
        finally:
            connection.close()
        if (
            row is None
            or (row["consumed_at"] is not None and not allow_completed)
            or row["revoked_at"] is not None
            or self.auth._parse(row["expires_at"]) <= now
        ):
            raise AuthError("enrollment_invalid", 401)
        return EnrollmentSession(
            enrollment_session_id=str(row["enrollment_session_id"]),
            token=supplied,
            email=str(row["email_normalized"]),
            claim_id=str(row["central_claim_id"]),
            license_id=str(row["license_id"]),
            customer_id=str(row["customer_id"]),
            remember_browser=bool(row["remember_browser"]),
            csrf_token=self.csrf_token(supplied),
            expires_at=self.auth._parse(row["expires_at"]),
            completed=row["consumed_at"] is not None,
        )

    def require_csrf(self, session: EnrollmentSession, supplied: Any) -> None:
        if not hmac.compare_digest(session.csrf_token, str(supplied or "")):
            raise AuthError("csrf_invalid", 403)

    @staticmethod
    def _enterprise_number(value: Any) -> str:
        normalized = re.sub(r"[^0-9]", "", str(value or ""))
        if ENTERPRISE_PATTERN.fullmatch(normalized) is None:
            raise AuthError("invalid_request", 400)
        return normalized

    def autofill(self, session: EnrollmentSession, enterprise_number: Any) -> dict[str, Any]:
        normalized = self._enterprise_number(enterprise_number)
        try:
            result = self.central.autofill(
                session.claim_id, session.email, normalized, now=self._now()
            )
        except CentralEnrollmentError as exc:
            raise AuthError(exc.code, exc.status) from exc
        if not isinstance(result, dict) or result.get("ok") is not True:
            raise AuthError("temporarily_unavailable", 503)
        return result

    def document(
        self, session: EnrollmentSession, preflight_id: Any, document_id: Any
    ) -> dict[str, Any]:
        preflight = str(preflight_id or "").strip()
        document = str(document_id or "").strip()
        if (
            not preflight
            or len(preflight) > 128
            or not document
            or len(document) > 150
        ):
            raise AuthError("invalid_request", 400)
        try:
            result = self.central.document(
                session.claim_id, session.email, preflight, document
            )
        except CentralEnrollmentError as exc:
            raise AuthError(exc.code, exc.status) from exc
        if not isinstance(result, dict) or result.get("ok") is not True:
            raise AuthError("temporarily_unavailable", 503)
        return result

    @staticmethod
    def _completion_request(value: dict[str, Any]) -> dict[str, Any]:
        if value.get("company_type") != "business":
            raise AuthError("consumer_registration_unavailable", 409)
        enterprise = WebEnrollmentService._enterprise_number(value.get("enterprise_number"))
        legal_name = str(value.get("legal_name") or "").strip()
        acceptant = value.get("acceptant")
        declarations = value.get("declarations")
        choice_texts = value.get("choice_texts")
        preflight_id = str(value.get("preflight_id") or "").strip()
        fingerprint = str(value.get("preflight_fingerprint") or "").strip().lower()
        if (
            not legal_name
            or len(legal_name) > 300
            or not isinstance(acceptant, dict)
            or set(acceptant) != {"name", "function"}
            or not str(acceptant.get("name") or "").strip()
            or len(str(acceptant.get("name") or "")) > 200
            or not str(acceptant.get("function") or "").strip()
            or len(str(acceptant.get("function") or "")) > 200
            or not isinstance(declarations, dict)
            or set(declarations)
            != {
                "terms_accepted",
                "usage_terms_accepted",
                "privacy_acknowledged",
                "authority_declared",
            }
            or any(item is not True for item in declarations.values())
            or not isinstance(choice_texts, dict)
            or set(choice_texts)
            != {
                "general_terms",
                "usage_terms",
                "privacy_notice",
                "business_authority",
            }
            or any(not isinstance(item, str) or not item for item in choice_texts.values())
            or not preflight_id
            or len(preflight_id) > 128
            or re.fullmatch(r"[0-9a-f]{64}", fingerprint) is None
        ):
            raise AuthError("legal_acceptance_invalid", 400)
        return {
            "company_type": "business",
            "enterprise_number": enterprise,
            "legal_name": legal_name,
            "acceptant": {
                "name": str(acceptant["name"]).strip(),
                "function": str(acceptant["function"]).strip(),
            },
            "declarations": dict(declarations),
            "choice_texts": dict(choice_texts),
            "preflight_id": preflight_id,
            "preflight_fingerprint": fingerprint,
        }

    def complete(
        self, session: EnrollmentSession, request: dict[str, Any]
    ) -> SessionGrant:
        payload = self._completion_request(request)
        try:
            completion = self.central.complete(
                session.claim_id, session.email, payload, now=self._now()
            )
        except CentralEnrollmentError as exc:
            raise AuthError(exc.code, exc.status) from exc
        if (
            completion.claim_id != session.claim_id
            or completion.license_id != session.license_id
            or completion.customer_id != session.customer_id
            or not hmac.compare_digest(completion.email, session.email)
        ):
            raise AuthError("temporarily_unavailable", 503)
        return self.auth.activate_enrollment(
            enrollment_session_id=session.enrollment_session_id,
            central_claim_id=completion.claim_id,
            central_completion_id=completion.completion_id,
            license_id=completion.license_id,
            customer_id=completion.customer_id,
            email=completion.email,
            remember_browser=session.remember_browser,
        )


class WebEnrollmentHTTPAdapter:
    def __init__(
        self,
        service: WebEnrollmentService,
        *,
        allowed_origins: set[str] | frozenset[str],
        production: bool,
    ) -> None:
        self.service = service
        self.allowed_origins = frozenset(item.rstrip("/") for item in allowed_origins)
        self.production = production
        self.cookie_name = (
            "__Host-belgobase_enrollment" if production else "belgobase_enrollment"
        )
        self.auth_cookie_name = (
            "__Host-belgobase_session" if production else "belgobase_session"
        )

    @staticmethod
    def _header(headers: Mapping[str, str], name: str) -> str:
        for key, value in headers.items():
            if str(key).lower() == name.lower():
                return str(value)
        return ""

    def _token(self, headers: Mapping[str, str]) -> str:
        cookies = SimpleCookie()
        try:
            cookies.load(self._header(headers, "Cookie"))
        except Exception:
            return ""
        value = cookies.get(self.cookie_name)
        return value.value if value is not None else ""

    def _cookie(self, name: str, value: str, max_age: int) -> str:
        parts = [
            f"{name}={value}",
            "Path=/",
            "HttpOnly",
            "SameSite=Lax",
            f"Max-Age={int(max_age)}",
        ]
        if self.production:
            parts.append("Secure")
        return "; ".join(parts)

    @staticmethod
    def _headers() -> dict[str, str]:
        return {
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8",
        }

    def _require_post(self, headers: Mapping[str, str]) -> None:
        if self._header(headers, "Origin").rstrip("/") not in self.allowed_origins:
            raise AuthError("origin_invalid", 403)
        if self._header(headers, "Content-Type").split(";", 1)[0].strip().lower() != "application/json":
            raise AuthError("content_type_invalid", 415)

    @staticmethod
    def _json(body: bytes | str | None) -> dict[str, Any]:
        try:
            raw = body.decode("utf-8") if isinstance(body, bytes) else str(body or "")
            if len(raw.encode("utf-8")) > 16_384:
                raise AuthError("request_too_large", 413)
            result = json.loads(raw) if raw else {}
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise AuthError("invalid_request", 400) from exc
        if not isinstance(result, dict):
            raise AuthError("invalid_request", 400)
        return result

    @staticmethod
    def _body(session: EnrollmentSession) -> dict[str, Any]:
        return {
            "ok": True,
            "enrollment_verified": True,
            "next": "profile",
            "email": session.email,
            "csrf": session.csrf_token,
        }

    def handle(
        self,
        method: str,
        path: str,
        headers: Mapping[str, str],
        body: bytes | str | None,
        *,
        source: str,
    ) -> HTTPResponse:
        route = str(path).split("?", 1)[0].rstrip("/") or "/"
        verb = str(method).upper()
        try:
            if verb == "GET" and route == "/web/enrollment/session":
                session = self.service.session(self._token(headers))
                return HTTPResponse(200, self._body(session), self._headers())
            document_match = LEGAL_DOCUMENT_ROUTE.fullmatch(route)
            if verb == "GET" and document_match is not None:
                session = self.service.session(self._token(headers))
                return HTTPResponse(
                    200,
                    self.service.document(
                        session, document_match.group(1), document_match.group(2)
                    ),
                    self._headers(),
                )
            if verb != "POST":
                raise AuthError("not_found", 404)
            self._require_post(headers)
            request = self._json(body)
            if route == "/web/enrollment/start":
                result = self.service.start(
                    license_code=request.get("license_code"),
                    email=request.get("email"),
                    remember_browser=request.get("remember_browser"),
                    source=source,
                )
                return HTTPResponse(202, result, self._headers())
            if route == "/web/enrollment/verify":
                session = self.service.verify(request.get("challenge_id"), request.get("code"))
                return HTTPResponse(
                    200,
                    self._body(session),
                    self._headers(),
                    multi_headers=((
                        "Set-Cookie",
                        self._cookie(self.cookie_name, session.token, int(ENROLLMENT_TTL.total_seconds())),
                    ),),
                )
            session = self.service.session(
                self._token(headers),
                allow_completed=route == "/web/enrollment/complete",
            )
            self.service.require_csrf(session, self._header(headers, "X-BelgoBase-CSRF"))
            if route == "/web/enrollment/autofill":
                return HTTPResponse(
                    200,
                    self.service.autofill(session, request.get("enterprise_number")),
                    self._headers(),
                )
            if route == "/web/enrollment/complete":
                grant = self.service.complete(session, request)
                response_body = {
                    "ok": True,
                    "authenticated": True,
                    "account": {"email": grant.context.email},
                    "auth_context": grant.context.as_dict(),
                    "csrf": grant.csrf_token,
                }
                return HTTPResponse(
                    200,
                    response_body,
                    self._headers(),
                    grant.context.as_dict(),
                    (
                        (
                            "Set-Cookie",
                            self._cookie(self.auth_cookie_name, grant.token, grant.max_age_seconds),
                        ),
                        ("Set-Cookie", self._cookie(self.cookie_name, "", 0)),
                    ),
                )
            raise AuthError("not_found", 404)
        except AuthError as exc:
            return HTTPResponse(
                exc.status,
                {"ok": False, "error": exc.code},
                self._headers(),
            )
        except Exception:
            return HTTPResponse(
                500,
                {"ok": False, "error": "internal_error"},
                self._headers(),
            )
