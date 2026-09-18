from __future__ import annotations

import base64
import datetime as dt
import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Protocol


class MailDeliveryError(RuntimeError):
    """A login email was not accepted by the configured delivery service."""


class LoginCodeMailer(Protocol):
    def send_login_code(
        self,
        *,
        email: str,
        code: str,
        challenge_id: str,
        issued_at: dt.datetime,
        expires_at: dt.datetime,
        language: str = "nl",
    ) -> None: ...


class DisabledMailer:
    """Fail closed when production mail delivery has not been configured."""

    def send_login_code(self, **_values: Any) -> None:
        raise MailDeliveryError("authentication_mail_not_configured")


class _RejectRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        raise MailDeliveryError("mail_relay_redirect_forbidden")


def _canonical_json(value: dict[str, Any]) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _b64(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


@dataclass(frozen=True)
class SignedWebsiteMailer:
    """Relay a VPS-created OTP to the website's existing Resend integration.

    The private signing key stays on the VPS.  The website pins only the public
    key, verifies the exact body, schema and freshness, and uses challenge_id
    as its provider idempotency key.  No browser response ever contains the OTP.
    """

    endpoint: str
    signer: Callable[[bytes], bytes]
    timeout_seconds: int = 15
    opener: Any = None

    def __post_init__(self) -> None:
        parsed = urllib.parse.urlsplit(self.endpoint)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.fragment
        ):
            raise ValueError("mail relay endpoint must use HTTPS")

    @classmethod
    def from_ed25519_pem(
        cls,
        *,
        endpoint: str,
        private_key_path: Path,
        timeout_seconds: int = 15,
    ) -> "SignedWebsiteMailer":
        try:
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
            from cryptography.hazmat.primitives.serialization import load_pem_private_key
        except ImportError as exc:  # pragma: no cover - production dependency gate
            raise MailDeliveryError("mail_signing_dependency_missing") from exc
        raw = Path(private_key_path).read_bytes()
        key = load_pem_private_key(raw, password=None)
        if not isinstance(key, Ed25519PrivateKey):
            raise MailDeliveryError("mail_signing_key_invalid")
        return cls(
            endpoint=endpoint,
            signer=key.sign,
            timeout_seconds=timeout_seconds,
        )

    def send_login_code(
        self,
        *,
        email: str,
        code: str,
        challenge_id: str,
        issued_at: dt.datetime,
        expires_at: dt.datetime,
        language: str = "nl",
    ) -> None:
        if language not in {"nl", "en"}:
            raise MailDeliveryError("mail_language_invalid")
        if len(code) != 6 or not code.isascii() or not code.isdigit():
            raise MailDeliveryError("mail_code_invalid")
        if not challenge_id or len(challenge_id) > 100:
            raise MailDeliveryError("mail_challenge_invalid")
        issued = int(issued_at.astimezone(dt.timezone.utc).timestamp())
        expires = int(expires_at.astimezone(dt.timezone.utc).timestamp())
        if expires <= issued or expires - issued > 600:
            raise MailDeliveryError("mail_expiry_invalid")
        body = _canonical_json(
            {
                "purpose": "belgobase-login-v1",
                "email": email,
                "code": code,
                "challenge_id": challenge_id,
                "issued_at": issued,
                "expires_at": expires,
                "language": language,
            }
        )
        try:
            signature = _b64(self.signer(body))
        except Exception as exc:
            raise MailDeliveryError("mail_signing_failed") from exc
        request = urllib.request.Request(
            self.endpoint,
            data=body,
            method="POST",
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json; charset=utf-8",
                "X-BelgoBase-Mail-Signature": signature,
                "User-Agent": "BelgoBase-WebAuth-Mailer/1.0",
            },
        )
        opener = self.opener or urllib.request.build_opener(
            _RejectRedirect(), urllib.request.HTTPSHandler(context=ssl.create_default_context())
        )
        try:
            with opener.open(request, timeout=self.timeout_seconds) as response:
                raw = response.read(4097)
                if len(raw) > 4096:
                    raise MailDeliveryError("mail_relay_response_too_large")
                parsed = json.loads(raw.decode("utf-8")) if raw else {}
                if int(response.status) != 200 or parsed.get("ok") is not True:
                    raise MailDeliveryError("mail_relay_rejected")
        except MailDeliveryError:
            raise
        except (OSError, ValueError, urllib.error.URLError, json.JSONDecodeError) as exc:
            raise MailDeliveryError("mail_relay_failed") from exc
