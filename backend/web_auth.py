from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from .mailer import LoginCodeMailer, MailDeliveryError
from .registry import LicenseRecord, LicenseRegistry
from .seat_policy import count_web_allocated


EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
OTP_PATTERN = re.compile(r"^[0-9]{6}$")
SCHEMA_VERSION = 3


class AuthError(RuntimeError):
    def __init__(self, code: str, status: int = 400) -> None:
        self.code = code
        self.status = status
        super().__init__(code)


@dataclass(frozen=True)
class WebAuthConfig:
    state_database: Path
    secret: bytes
    challenge_minutes: int = 10
    remembered_days: int = 30
    session_hours: int = 8
    max_failed_codes: int = 6
    start_rate_count: int = 5
    start_rate_minutes: int = 15
    # A Next/Vercel BFF has shared egress addresses.  A per-source limit would
    # therefore let one customer block unrelated customers.  It is disabled by
    # default and may only be enabled when ``source`` is the direct peer address.
    source_rate_count: int | None = None
    global_start_rate_count: int = 300

    def __post_init__(self) -> None:
        if len(self.secret) < 32:
            raise ValueError("web authentication secret must be at least 32 bytes")
        positive = (
            self.challenge_minutes,
            self.remembered_days,
            self.session_hours,
            self.max_failed_codes,
            self.start_rate_count,
            self.start_rate_minutes,
            self.global_start_rate_count,
        )
        if any(type(value) is not int or value <= 0 for value in positive):
            raise ValueError("web authentication limits must be positive integers")
        if self.source_rate_count is not None and (
            type(self.source_rate_count) is not int or self.source_rate_count <= 0
        ):
            raise ValueError("source rate limit must be a positive integer or None")
        if self.challenge_minutes > 10:
            raise ValueError("mail relay accepts challenges for at most 10 minutes")


@dataclass(frozen=True)
class AuthContext:
    license_id: str
    customer_id: str
    user_id: str
    email: str
    browser_id: str
    plan: str
    rights: dict[str, Any]

    def as_dict(self) -> dict[str, Any]:
        principal = "web:" + self.browser_id
        return {
            "access_class": "customer",
            "principal_type": "web",
            "principal_id": principal,
            "quota_subject_id": principal,
            "license_id": self.license_id,
            "customer_id": self.customer_id,
            "user_id": self.user_id,
            "email": self.email,
            "browser_id": self.browser_id,
            "plan": self.plan,
            "rights": dict(self.rights),
        }


@dataclass(frozen=True)
class SessionGrant:
    token: str
    max_age_seconds: int
    csrf_token: str
    context: AuthContext


class WebAuthService:
    def __init__(
        self,
        config: WebAuthConfig,
        registry: LicenseRegistry,
        mailer: LoginCodeMailer,
        *,
        clock: Callable[[], dt.datetime] | None = None,
    ) -> None:
        self.config = config
        self.registry = registry
        self.mailer = mailer
        self.clock = clock or (lambda: dt.datetime.now(dt.timezone.utc))
        registry_database = getattr(registry, "database_path", None)
        if registry_database is not None and Path(registry_database).resolve() != config.state_database.resolve():
            raise ValueError("web auth and licence registry must share one database")
        self._initialize()

    def _now(self) -> dt.datetime:
        value = self.clock()
        if value.tzinfo is None:
            value = value.replace(tzinfo=dt.timezone.utc)
        return value.astimezone(dt.timezone.utc)

    @staticmethod
    def _iso(value: dt.datetime) -> str:
        return value.astimezone(dt.timezone.utc).isoformat()

    @staticmethod
    def _parse(value: str) -> dt.datetime:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.config.state_database, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=15000")
        return connection

    def _initialize(self) -> None:
        self.config.state_database.parent.mkdir(parents=True, exist_ok=True)
        schema = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
        connection = self._connect()
        try:
            connection.executescript(schema)
            now = self._iso(self._now())
            completion_columns = {
                str(item["name"])
                for item in connection.execute(
                    "PRAGMA table_info(web_enrollment_completions)"
                ).fetchall()
            }
            if "browser_id" not in completion_columns:
                connection.execute(
                    "ALTER TABLE web_enrollment_completions ADD COLUMN browser_id TEXT"
                )
            row = connection.execute(
                "SELECT version FROM web_auth_schema WHERE component='web_auth'"
            ).fetchone()
            if row is not None and int(row["version"]) not in {1, 2, SCHEMA_VERSION}:
                raise RuntimeError("unsupported web authentication schema")
            connection.execute(
                "INSERT OR IGNORE INTO web_auth_schema(component,version,updated_at) VALUES('web_auth',?,?)",
                (SCHEMA_VERSION, now),
            )
            connection.execute(
                "UPDATE web_auth_schema SET version=?,updated_at=? WHERE component='web_auth' AND version IN (1,2)",
                (SCHEMA_VERSION, now),
            )
            connection.commit()
        finally:
            connection.close()

    @staticmethod
    def normalize_email(value: Any) -> str:
        text = str(value or "").strip().lower()
        if len(text) > 254 or EMAIL_PATTERN.fullmatch(text) is None:
            raise AuthError("invalid_request", 400)
        return text

    def _digest(self, purpose: str, value: str) -> str:
        return hmac.new(
            self.config.secret,
            (purpose + "\0" + value).encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    def _audit(
        self,
        connection: sqlite3.Connection,
        action: str,
        outcome: str,
        *,
        user_id: str | None = None,
        license_id: str | None = None,
        customer_id: str | None = None,
        browser_id: str | None = None,
        source_hash: str | None = None,
    ) -> None:
        connection.execute(
            """INSERT INTO web_auth_audit(
                   occurred_at,action,user_id,license_id,customer_id,browser_id,source_hash,outcome
               ) VALUES(?,?,?,?,?,?,?,?)""",
            (
                self._iso(self._now()), action, user_id, license_id, customer_id,
                browser_id, source_hash, outcome,
            ),
        )

    def _rate_event(
        self,
        connection: sqlite3.Connection,
        bucket: str,
        subject_hash: str,
        *,
        limit: int,
        window_minutes: int,
    ) -> None:
        now = self._now()
        cutoff = self._iso(now - dt.timedelta(minutes=window_minutes))
        amount = int(
            connection.execute(
                """SELECT COUNT(*) FROM web_auth_rate_events
                   WHERE bucket=? AND subject_hash=? AND occurred_at>=?""",
                (bucket, subject_hash, cutoff),
            ).fetchone()[0]
        )
        if amount >= limit:
            raise AuthError("rate_limited", 429)
        connection.execute(
            "INSERT INTO web_auth_rate_events(bucket,subject_hash,occurred_at) VALUES(?,?,?)",
            (bucket, subject_hash, self._iso(now)),
        )
        connection.execute(
            "DELETE FROM web_auth_rate_events WHERE occurred_at<?",
            (self._iso(now - dt.timedelta(days=2)),),
        )

    def _consume_start_rates(
        self, connection: sqlite3.Connection, email: str, source: str
    ) -> str:
        email_hash = self._digest("rate-email", email)
        source_hash = self._digest("rate-source", str(source or "unknown")[:200])
        self._rate_event(
            connection,
            "start_email",
            email_hash,
            limit=self.config.start_rate_count,
            window_minutes=self.config.start_rate_minutes,
        )
        self._rate_event(
            connection,
            "start_global",
            self._digest("rate-global", "web-auth-start"),
            limit=self.config.global_start_rate_count,
            window_minutes=self.config.start_rate_minutes,
        )
        if self.config.source_rate_count is not None:
            self._rate_event(
                connection,
                "start_source",
                source_hash,
                limit=self.config.source_rate_count,
                window_minutes=self.config.start_rate_minutes,
            )
        return source_hash

    def _dummy_start(self) -> dict[str, Any]:
        return {
            "ok": True,
            "delivery": "if_account_matches",
            "challenge_id": str(uuid.uuid4()),
        }

    def _create_challenge(
        self,
        *,
        purpose: str,
        email: str,
        license_record: LicenseRecord,
        remember_browser: bool,
        source_hash: str,
    ) -> dict[str, Any]:
        now = self._now()
        expiry = now + dt.timedelta(minutes=self.config.challenge_minutes)
        challenge_id = str(uuid.uuid4())
        code = f"{secrets.randbelow(1_000_000):06d}"
        otp_hash = self._digest("otp:" + challenge_id, code)
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                """INSERT INTO web_login_challenges(
                       challenge_id,purpose,email_normalized,license_id,customer_id,
                       otp_hash,remember_browser,created_at,expires_at,source_hash
                   ) VALUES(?,?,?,?,?,?,?,?,?,?)""",
                (
                    challenge_id, purpose, email, license_record.license_id,
                    license_record.customer_id, otp_hash, int(remember_browser),
                    self._iso(now), self._iso(expiry), source_hash,
                ),
            )
            connection.commit()
        finally:
            connection.close()
        try:
            self.mailer.send_login_code(
                email=email,
                code=code,
                challenge_id=challenge_id,
                issued_at=now,
                expires_at=expiry,
            )
        except MailDeliveryError:
            connection = self._connect()
            try:
                connection.execute(
                    "DELETE FROM web_login_challenges WHERE challenge_id=? AND delivered_at IS NULL",
                    (challenge_id,),
                )
                connection.commit()
            finally:
                connection.close()
            raise AuthError("mail_unavailable", 503)
        connection = self._connect()
        try:
            connection.execute(
                "UPDATE web_login_challenges SET delivered_at=? WHERE challenge_id=? AND consumed_at IS NULL",
                (self._iso(self._now()), challenge_id),
            )
            connection.commit()
        finally:
            connection.close()
        return {
            "ok": True,
            "delivery": "if_account_matches",
            "challenge_id": challenge_id,
        }

    def start_claim(
        self,
        email: Any,
        license_code: Any,
        *,
        remember_browser: bool,
        source: str = "unknown",
    ) -> dict[str, Any]:
        normalized = self.normalize_email(email)
        code_text = str(license_code or "").strip()
        if not code_text or len(code_text) > 200 or type(remember_browser) is not bool:
            raise AuthError("invalid_request", 400)
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            source_hash = self._consume_start_rates(connection, normalized, source)
            connection.commit()
        finally:
            connection.close()
        try:
            record = self.registry.validate_claim(code_text, self._now())
        except Exception:
            return self._dummy_start()
        if not hmac.compare_digest(record.support_email, normalized):
            return self._dummy_start()
        connection = self._connect()
        try:
            membership = connection.execute(
                "SELECT status FROM web_memberships WHERE license_id=?",
                (record.license_id,),
            ).fetchone()
        finally:
            connection.close()
        purpose = "login" if membership is not None and membership["status"] == "active" else "claim"
        return self._create_challenge(
            purpose=purpose,
            email=normalized,
            license_record=record,
            remember_browser=remember_browser,
            source_hash=source_hash,
        )

    def start_login(
        self,
        email: Any,
        *,
        remember_browser: bool,
        source: str = "unknown",
    ) -> dict[str, Any]:
        normalized = self.normalize_email(email)
        if type(remember_browser) is not bool:
            raise AuthError("invalid_request", 400)
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            source_hash = self._consume_start_rates(connection, normalized, source)
            row = connection.execute(
                """SELECT m.license_id FROM web_users u
                   JOIN web_memberships m ON m.user_id=u.user_id
                   WHERE u.email_normalized=? AND u.status='active' AND m.status='active'""",
                (normalized,),
            ).fetchall()
            connection.commit()
        finally:
            connection.close()
        if len(row) != 1:
            return self._dummy_start()
        try:
            record = self.registry.get_license(str(row[0]["license_id"]), self._now())
        except Exception:
            return self._dummy_start()
        if not record.is_active(self._now()) or not hmac.compare_digest(record.support_email, normalized):
            return self._dummy_start()
        return self._create_challenge(
            purpose="login",
            email=normalized,
            license_record=record,
            remember_browser=remember_browser,
            source_hash=source_hash,
        )

    def _reserve_browser(
        self,
        connection: sqlite3.Connection,
        membership_id: str,
        license_record: LicenseRecord,
        expires_at: dt.datetime,
        label: str,
    ) -> str:
        windows = self.registry.count_windows_allocated(
            license_record.license_id, connection=connection
        )
        web = count_web_allocated(
            connection, license_record.license_id, self._iso(self._now())
        )
        if windows + web >= license_record.max_devices:
            raise AuthError("browser_limit_reached", 409)
        browser_id = str(uuid.uuid4())
        now_text = self._iso(self._now())
        connection.execute(
            """INSERT INTO web_browsers(
                   browser_id,membership_id,label,status,created_at,last_seen_at,expires_at
               ) VALUES(?,?,?,'active',?,?,?)""",
            (browser_id, membership_id, label[:100], now_text, now_text, self._iso(expires_at)),
        )
        return browser_id

    def verify_code(
        self,
        challenge_id: Any,
        code: Any,
        *,
        browser_label: str = "Webbrowser",
    ) -> SessionGrant:
        challenge = str(challenge_id or "").strip()
        otp = str(code or "").strip()
        if len(challenge) > 100 or OTP_PATTERN.fullmatch(otp) is None:
            raise AuthError("code_invalid", 401)
        now = self._now()
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM web_login_challenges WHERE challenge_id=?",
                (challenge,),
            ).fetchone()
            if (
                row is None
                or row["delivered_at"] is None
                or row["consumed_at"] is not None
                or self._parse(row["expires_at"]) <= now
                or int(row["failed_attempts"]) >= self.config.max_failed_codes
            ):
                raise AuthError("code_invalid", 401)
            supplied = self._digest("otp:" + challenge, otp)
            if not hmac.compare_digest(str(row["otp_hash"]), supplied):
                connection.execute(
                    "UPDATE web_login_challenges SET failed_attempts=failed_attempts+1 WHERE challenge_id=?",
                    (challenge,),
                )
                connection.commit()
                raise AuthError("code_invalid", 401)
            record = self.registry.get_license(str(row["license_id"]), now)
            if not record.is_active(now):
                raise AuthError("license_inactive", 403)
            if not hmac.compare_digest(record.support_email, str(row["email_normalized"])):
                raise AuthError("identity_changed", 403)

            if row["purpose"] == "claim":
                existing_license = connection.execute(
                    "SELECT membership_id,status FROM web_memberships WHERE license_id=?",
                    (record.license_id,),
                ).fetchone()
                if existing_license is not None:
                    raise AuthError("claim_already_used", 409)
                existing_user = connection.execute(
                    "SELECT user_id,status FROM web_users WHERE email_normalized=?",
                    (record.support_email,),
                ).fetchone()
                if existing_user is not None:
                    raise AuthError("identity_conflict", 409)
                user_id = str(uuid.uuid4())
                membership_id = str(uuid.uuid4())
                connection.execute(
                    "INSERT INTO web_users(user_id,email_normalized,status,created_at) VALUES(?,?,'active',?)",
                    (user_id, record.support_email, self._iso(now)),
                )
                connection.execute(
                    """INSERT INTO web_memberships(
                           membership_id,user_id,license_id,customer_id,status,claimed_at
                       ) VALUES(?,?,?,?,'active',?)""",
                    (
                        membership_id, user_id, record.license_id, record.customer_id,
                        self._iso(now),
                    ),
                )
            else:
                membership = connection.execute(
                    """SELECT m.membership_id,m.user_id FROM web_memberships m
                       JOIN web_users u ON u.user_id=m.user_id
                       WHERE m.license_id=? AND m.customer_id=? AND m.status='active'
                         AND u.status='active' AND u.email_normalized=?""",
                    (record.license_id, record.customer_id, record.support_email),
                ).fetchone()
                if membership is None:
                    raise AuthError("code_invalid", 401)
                membership_id = str(membership["membership_id"])
                user_id = str(membership["user_id"])

            remember = bool(row["remember_browser"])
            lifetime = (
                dt.timedelta(days=self.config.remembered_days)
                if remember
                else dt.timedelta(hours=self.config.session_hours)
            )
            expires_at = now + lifetime
            browser_id = self._reserve_browser(
                connection, membership_id, record, expires_at, browser_label
            )
            token = "BBS3-" + secrets.token_urlsafe(32)
            session_id = str(uuid.uuid4())
            connection.execute(
                """INSERT INTO web_sessions(
                       session_id,browser_id,token_hash,created_at,last_seen_at,expires_at
                   ) VALUES(?,?,?,?,?,?)""",
                (
                    session_id, browser_id, self._digest("session", token),
                    self._iso(now), self._iso(now), self._iso(expires_at),
                ),
            )
            connection.execute(
                "UPDATE web_login_challenges SET consumed_at=? WHERE challenge_id=? AND consumed_at IS NULL",
                (self._iso(now), challenge),
            )
            self._audit(
                connection,
                "web_session_created",
                "allowed",
                user_id=user_id,
                license_id=record.license_id,
                customer_id=record.customer_id,
                browser_id=browser_id,
                source_hash=str(row["source_hash"]),
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
        context = AuthContext(
            license_id=record.license_id,
            customer_id=record.customer_id,
            user_id=user_id,
            email=record.support_email,
            browser_id=browser_id,
            plan=record.plan,
            rights=dict(record.rights),
        )
        return SessionGrant(
            token=token,
            max_age_seconds=int(lifetime.total_seconds()),
            csrf_token=self.csrf_token(token),
            context=context,
        )

    def csrf_token(self, session_token: str) -> str:
        return self._digest("csrf", str(session_token))

    def activate_enrollment(
        self,
        *,
        enrollment_session_id: str,
        central_claim_id: str,
        central_completion_id: str,
        license_id: str,
        customer_id: str,
        email: str,
        remember_browser: bool,
        browser_label: str = "Webbrowser",
    ) -> SessionGrant:
        """Create the first data-bearing web session after central acceptance.

        The account service has already atomically created the customer profile
        and signed legal receipt.  This method re-reads that central truth and
        creates a membership exactly once.  It cannot bind or update a central
        customer profile itself.
        """

        enrollment_id = str(enrollment_session_id or "").strip()
        claim_id = str(central_claim_id or "").strip()
        completion_id = str(central_completion_id or "").strip()
        expected_license = str(license_id or "").strip()
        expected_customer = str(customer_id or "").strip()
        normalized_email = self.normalize_email(email)
        if (
            not enrollment_id
            or len(enrollment_id) > 128
            or not claim_id
            or len(claim_id) > 128
            or not completion_id
            or len(completion_id) > 128
            or not expected_license
            or len(expected_license) > 128
            or not expected_customer
            or len(expected_customer) > 128
            or type(remember_browser) is not bool
        ):
            raise AuthError("enrollment_invalid", 401)
        now = self._now()
        try:
            record = self.registry.get_license(expected_license, now)
        except Exception as exc:
            raise AuthError("enrollment_invalid", 401) from exc
        if not record.is_active(now):
            raise AuthError("license_inactive", 403)
        if (
            record.customer_id != expected_customer
            or not hmac.compare_digest(record.support_email, normalized_email)
        ):
            raise AuthError("identity_changed", 409)

        lifetime = (
            dt.timedelta(days=self.config.remembered_days)
            if remember_browser
            else dt.timedelta(hours=self.config.session_hours)
        )
        expires_at = now + lifetime
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            enrollment = connection.execute(
                """SELECT c.central_claim_id,c.license_id,c.customer_id,c.email_normalized,
                          s.expires_at,s.consumed_at,s.revoked_at
                   FROM web_enrollment_sessions s
                   JOIN web_enrollment_challenges c ON c.challenge_id=s.challenge_id
                   WHERE s.enrollment_session_id=?""",
                (enrollment_id,),
            ).fetchone()
            if (
                enrollment is None
                or enrollment["revoked_at"] is not None
                or self._parse(enrollment["expires_at"]) <= now
                or str(enrollment["central_claim_id"]) != claim_id
                or str(enrollment["license_id"]) != expected_license
                or str(enrollment["customer_id"]) != expected_customer
                or not hmac.compare_digest(
                    str(enrollment["email_normalized"]), normalized_email
                )
            ):
                raise AuthError("enrollment_invalid", 401)
            completed = connection.execute(
                """SELECT * FROM web_enrollment_completions
                   WHERE central_completion_id=? OR central_claim_id=?""",
                (completion_id, claim_id),
            ).fetchone()
            if completed is not None:
                if (
                    str(completed["central_completion_id"]) != completion_id
                    or str(completed["central_claim_id"]) != claim_id
                    or str(completed["license_id"]) != expected_license
                    or str(completed["customer_id"]) != expected_customer
                    or not hmac.compare_digest(
                        str(completed["email_normalized"]), normalized_email
                    )
                    or not completed["browser_id"]
                    or enrollment["consumed_at"] is None
                ):
                    raise AuthError("binding_conflict", 409)
                membership_id = str(completed["membership_id"])
                user_id = str(completed["user_id"])
                browser_id = str(completed["browser_id"])
                browser = connection.execute(
                    """SELECT status,expires_at FROM web_browsers
                       WHERE browser_id=? AND membership_id=?""",
                    (browser_id, membership_id),
                ).fetchone()
                if (
                    browser is None
                    or browser["status"] != "active"
                    or self._parse(browser["expires_at"]) <= now
                ):
                    raise AuthError("enrollment_already_completed", 409)
                expires_at = self._parse(browser["expires_at"])
                lifetime = expires_at - now
                connection.execute(
                    "UPDATE web_sessions SET revoked_at=? WHERE browser_id=? AND revoked_at IS NULL",
                    (self._iso(now), browser_id),
                )
                token = "BBS3-" + secrets.token_urlsafe(32)
                connection.execute(
                    """INSERT INTO web_sessions(
                           session_id,browser_id,token_hash,created_at,last_seen_at,expires_at
                       ) VALUES(?,?,?,?,?,?)""",
                    (
                        str(uuid.uuid4()),
                        browser_id,
                        self._digest("session", token),
                        self._iso(now),
                        self._iso(now),
                        self._iso(expires_at),
                    ),
                )
                self._audit(
                    connection,
                    "web_enrollment_session_recovered",
                    "allowed",
                    user_id=user_id,
                    license_id=expected_license,
                    customer_id=expected_customer,
                    browser_id=browser_id,
                )
                connection.commit()
                return SessionGrant(
                    token=token,
                    max_age_seconds=max(1, int(lifetime.total_seconds())),
                    csrf_token=self.csrf_token(token),
                    context=AuthContext(
                        license_id=expected_license,
                        customer_id=expected_customer,
                        user_id=user_id,
                        email=normalized_email,
                        browser_id=browser_id,
                        plan=record.plan,
                        rights=dict(record.rights),
                    ),
                )
            if enrollment["consumed_at"] is not None:
                raise AuthError("enrollment_invalid", 401)
            by_license = connection.execute(
                "SELECT membership_id,user_id,customer_id,status FROM web_memberships WHERE license_id=?",
                (expected_license,),
            ).fetchone()
            if by_license is not None:
                raise AuthError("binding_conflict", 409)
            user = connection.execute(
                "SELECT user_id,status FROM web_users WHERE email_normalized=?",
                (normalized_email,),
            ).fetchone()
            if user is None:
                user_id = str(uuid.uuid4())
                connection.execute(
                    "INSERT INTO web_users(user_id,email_normalized,status,created_at) VALUES(?,?,'active',?)",
                    (user_id, normalized_email, self._iso(now)),
                )
            elif user["status"] == "active":
                user_id = str(user["user_id"])
                existing_membership = connection.execute(
                    "SELECT 1 FROM web_memberships WHERE user_id=? AND status='active'",
                    (user_id,),
                ).fetchone()
                if existing_membership is not None:
                    raise AuthError("identity_conflict", 409)
            else:
                raise AuthError("identity_conflict", 409)

            membership_id = str(uuid.uuid4())
            connection.execute(
                """INSERT INTO web_memberships(
                       membership_id,user_id,license_id,customer_id,status,claimed_at
                   ) VALUES(?,?,?,?,'active',?)""",
                (
                    membership_id,
                    user_id,
                    expected_license,
                    expected_customer,
                    self._iso(now),
                ),
            )
            browser_id = self._reserve_browser(
                connection, membership_id, record, expires_at, browser_label
            )
            token = "BBS3-" + secrets.token_urlsafe(32)
            session_id = str(uuid.uuid4())
            connection.execute(
                """INSERT INTO web_sessions(
                       session_id,browser_id,token_hash,created_at,last_seen_at,expires_at
                   ) VALUES(?,?,?,?,?,?)""",
                (
                    session_id,
                    browser_id,
                    self._digest("session", token),
                    self._iso(now),
                    self._iso(now),
                    self._iso(expires_at),
                ),
            )
            connection.execute(
                """INSERT INTO web_enrollment_completions(
                       central_completion_id,central_claim_id,license_id,customer_id,
                       email_normalized,user_id,membership_id,browser_id,completed_at
                   ) VALUES(?,?,?,?,?,?,?,?,?)""",
                (
                    completion_id,
                    claim_id,
                    expected_license,
                    expected_customer,
                    normalized_email,
                    user_id,
                    membership_id,
                    browser_id,
                    self._iso(now),
                ),
            )
            consumed = connection.execute(
                """UPDATE web_enrollment_sessions SET consumed_at=?
                   WHERE enrollment_session_id=? AND consumed_at IS NULL AND revoked_at IS NULL""",
                (self._iso(now), enrollment_id),
            )
            if consumed.rowcount != 1:
                raise AuthError("enrollment_invalid", 401)
            self._audit(
                connection,
                "web_enrollment_activated",
                "allowed",
                user_id=user_id,
                license_id=expected_license,
                customer_id=expected_customer,
                browser_id=browser_id,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

        return SessionGrant(
            token=token,
            max_age_seconds=int(lifetime.total_seconds()),
            csrf_token=self.csrf_token(token),
            context=AuthContext(
                license_id=expected_license,
                customer_id=expected_customer,
                user_id=user_id,
                email=normalized_email,
                browser_id=browser_id,
                plan=record.plan,
                rights=dict(record.rights),
            ),
        )

    def validate_session(self, token: Any, *, touch: bool = True) -> AuthContext:
        supplied = str(token or "").strip()
        if not supplied or len(supplied) > 200:
            raise AuthError("session_invalid", 401)
        now = self._now()
        connection = self._connect()
        try:
            row = connection.execute(
                """SELECT s.session_id,s.expires_at AS session_expires,s.revoked_at AS session_revoked,
                          b.browser_id,b.expires_at AS browser_expires,b.status AS browser_status,
                          m.membership_id,m.license_id,m.customer_id,m.status AS membership_status,
                          u.user_id,u.email_normalized,u.status AS user_status
                   FROM web_sessions s
                   JOIN web_browsers b ON b.browser_id=s.browser_id
                   JOIN web_memberships m ON m.membership_id=b.membership_id
                   JOIN web_users u ON u.user_id=m.user_id
                   WHERE s.token_hash=?""",
                (self._digest("session", supplied),),
            ).fetchone()
            if (
                row is None
                or row["session_revoked"] is not None
                or row["browser_status"] != "active"
                or row["membership_status"] != "active"
                or row["user_status"] != "active"
                or self._parse(row["session_expires"]) <= now
                or self._parse(row["browser_expires"]) <= now
            ):
                raise AuthError("session_invalid", 401)
            record = self.registry.get_license(str(row["license_id"]), now)
            if not record.is_active(now):
                raise AuthError("license_inactive", 403)
            if (
                record.customer_id != row["customer_id"]
                or not hmac.compare_digest(record.support_email, str(row["email_normalized"]))
            ):
                raise AuthError("session_invalid", 401)
            if touch:
                now_text = self._iso(now)
                connection.execute(
                    "UPDATE web_sessions SET last_seen_at=? WHERE session_id=?",
                    (now_text, row["session_id"]),
                )
                connection.execute(
                    "UPDATE web_browsers SET last_seen_at=? WHERE browser_id=?",
                    (now_text, row["browser_id"]),
                )
                connection.commit()
        finally:
            connection.close()
        return AuthContext(
            license_id=record.license_id,
            customer_id=record.customer_id,
            user_id=str(row["user_id"]),
            email=record.support_email,
            browser_id=str(row["browser_id"]),
            plan=record.plan,
            rights=dict(record.rights),
        )

    def require_csrf(self, session_token: str, supplied: Any) -> None:
        expected = self.csrf_token(session_token)
        value = str(supplied or "")
        if not value or not hmac.compare_digest(expected, value):
            raise AuthError("csrf_invalid", 403)

    def logout(self, token: Any) -> None:
        context = self.validate_session(token, touch=False)
        now = self._iso(self._now())
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                "UPDATE web_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL",
                (now, self._digest("session", str(token))),
            )
            connection.execute(
                "UPDATE web_browsers SET status='revoked',revoked_at=? WHERE browser_id=? AND status='active'",
                (now, context.browser_id),
            )
            self._audit(
                connection, "web_logout", "allowed", user_id=context.user_id,
                license_id=context.license_id, customer_id=context.customer_id,
                browser_id=context.browser_id,
            )
            connection.commit()
        finally:
            connection.close()

    def logout_all(self, token: Any) -> None:
        context = self.validate_session(token, touch=False)
        now = self._iso(self._now())
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            membership = connection.execute(
                "SELECT membership_id FROM web_memberships WHERE license_id=? AND user_id=?",
                (context.license_id, context.user_id),
            ).fetchone()
            if membership is None:
                raise AuthError("session_invalid", 401)
            browser_ids = [
                str(row[0])
                for row in connection.execute(
                    "SELECT browser_id FROM web_browsers WHERE membership_id=? AND status='active'",
                    (membership["membership_id"],),
                ).fetchall()
            ]
            if browser_ids:
                placeholders = ",".join("?" for _ in browser_ids)
                connection.execute(
                    f"UPDATE web_sessions SET revoked_at=? WHERE browser_id IN ({placeholders}) AND revoked_at IS NULL",
                    (now, *browser_ids),
                )
                connection.execute(
                    f"UPDATE web_browsers SET status='revoked',revoked_at=? WHERE browser_id IN ({placeholders})",
                    (now, *browser_ids),
                )
            self._audit(
                connection, "web_logout_all", "allowed", user_id=context.user_id,
                license_id=context.license_id, customer_id=context.customer_id,
                browser_id=context.browser_id,
            )
            connection.commit()
        finally:
            connection.close()

    def list_browsers(self, token: Any) -> list[dict[str, Any]]:
        context = self.validate_session(token, touch=False)
        connection = self._connect()
        try:
            rows = connection.execute(
                """SELECT b.browser_id,b.label,b.created_at,b.last_seen_at,b.expires_at
                   FROM web_browsers b
                   JOIN web_memberships m ON m.membership_id=b.membership_id
                   WHERE m.license_id=? AND m.user_id=? AND m.status='active'
                     AND b.status='active' AND b.expires_at>?
                   ORDER BY b.last_seen_at DESC,b.created_at DESC""",
                (context.license_id, context.user_id, self._iso(self._now())),
            ).fetchall()
        finally:
            connection.close()
        return [
            {
                "browser_id": str(row["browser_id"]),
                "label": str(row["label"]),
                "created_at": str(row["created_at"]),
                "last_seen_at": str(row["last_seen_at"]),
                "expires_at": str(row["expires_at"]),
                "current": str(row["browser_id"]) == context.browser_id,
            }
            for row in rows
        ]

    def revoke_browser(self, token: Any, browser_id: Any) -> bool:
        context = self.validate_session(token, touch=False)
        target = str(browser_id or "").strip()
        if not target or len(target) > 100:
            raise AuthError("invalid_request", 400)
        now = self._iso(self._now())
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                """SELECT b.browser_id
                   FROM web_browsers b
                   JOIN web_memberships m ON m.membership_id=b.membership_id
                   WHERE b.browser_id=? AND b.status='active'
                     AND m.license_id=? AND m.user_id=? AND m.status='active'""",
                (target, context.license_id, context.user_id),
            ).fetchone()
            if row is None:
                raise AuthError("browser_not_found", 404)
            connection.execute(
                "UPDATE web_sessions SET revoked_at=? WHERE browser_id=? AND revoked_at IS NULL",
                (now, target),
            )
            connection.execute(
                "UPDATE web_browsers SET status='revoked',revoked_at=? WHERE browser_id=?",
                (now, target),
            )
            self._audit(
                connection,
                "web_browser_revoked",
                "allowed",
                user_id=context.user_id,
                license_id=context.license_id,
                customer_id=context.customer_id,
                browser_id=target,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
        return target == context.browser_id

    def revoke_authenticated_browser(self, context: AuthContext) -> None:
        """Revoke the current browser from an already verified server context."""
        now = self._iso(self._now())
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                """SELECT b.browser_id
                   FROM web_browsers b
                   JOIN web_memberships m ON m.membership_id=b.membership_id
                   WHERE b.browser_id=? AND b.status='active' AND m.license_id=?
                     AND m.customer_id=? AND m.user_id=? AND m.status='active'""",
                (
                    context.browser_id,
                    context.license_id,
                    context.customer_id,
                    context.user_id,
                ),
            ).fetchone()
            if row is None:
                raise AuthError("session_invalid", 401)
            connection.execute(
                "UPDATE web_sessions SET revoked_at=? WHERE browser_id=? AND revoked_at IS NULL",
                (now, context.browser_id),
            )
            connection.execute(
                "UPDATE web_browsers SET status='revoked',revoked_at=? WHERE browser_id=?",
                (now, context.browser_id),
            )
            self._audit(
                connection,
                "web_browser_revoked",
                "allowed",
                user_id=context.user_id,
                license_id=context.license_id,
                customer_id=context.customer_id,
                browser_id=context.browser_id,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
