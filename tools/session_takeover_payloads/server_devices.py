from __future__ import annotations
from belgobase_session_policy_1a import permitted, takeover

import base64
import datetime as dt
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import uuid
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from belgobase_license_registry_42a import (
    ACTIVE_STATUS,
    DEFAULT_DATABASE_PATH,
    DEFAULT_PEPPER_PATH,
    LicenseValidationError,
    connect_database,
    connect_database_readonly,
    initialize_registry,
    iso_utc,
    public_record as public_license_record,
    read_pepper,
    validate_audit_text,
    validate_credential,
    _write_license_audit,
)
from belgobase_device_protocol_43a import activation_message, deactivation_message, token_message
from backend.seat_policy import count_all_allocated


DEVICE_SCHEMA_VERSION = 1
AUTHORIZATION_SCHEMA_VERSION = 1
AUTHORIZATION_LOG_MAX_ROWS = 100_000
GENERIC_DEVICE_ERROR = "device_auth_invalid"
DEVICE_STATUSES = {"active", "suspended", "revoked"}
DEVICE_CREDENTIAL_PATTERN = re.compile(r"^BD3-[A-Za-z0-9_-]{43}$")
ACCESS_TOKEN_PATTERN = re.compile(r"^BAT3-[A-Za-z0-9_-]{43}$")
HEX_64_PATTERN = re.compile(r"^[a-f0-9]{64}$")
NONCE_PATTERN = re.compile(r"^[A-Za-z0-9_-]{22,200}$")
MAX_CLOCK_SKEW_SECONDS = 300
DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 900


class DeviceAuthError(PermissionError):
    pass


class DeviceLimitError(DeviceAuthError):
    pass


class DeviceConflictError(DeviceAuthError):
    pass


def _urlsafe_b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _urlsafe_b64decode(value: str, expected_bytes: int, field_name: str) -> bytes:
    text = str(value or "").strip()
    try:
        decoded = base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))
    except Exception as exc:
        raise DeviceAuthError(GENERIC_DEVICE_ERROR) from exc
    if len(decoded) != expected_bytes or _urlsafe_b64encode(decoded) != text:
        raise DeviceAuthError(GENERIC_DEVICE_ERROR)
    return decoded


def _normalize_uuid(value: str, field_name: str = "device_id") -> str:
    try:
        parsed = uuid.UUID(str(value or "").strip())
    except ValueError as exc:
        raise DeviceAuthError(GENERIC_DEVICE_ERROR) from exc
    if parsed.version != 4:
        raise DeviceAuthError(GENERIC_DEVICE_ERROR)
    return str(parsed)


def _normalize_hex64(value: str, field_name: str) -> str:
    text = str(value or "").strip().lower()
    if not HEX_64_PATTERN.fullmatch(text):
        raise DeviceAuthError(GENERIC_DEVICE_ERROR)
    return text


def _normalize_nonce(value: str) -> str:
    text = str(value or "").strip()
    if not NONCE_PATTERN.fullmatch(text):
        raise DeviceAuthError(GENERIC_DEVICE_ERROR)
    return text


def _normalize_client_timestamp(value: Any, now: dt.datetime | None = None) -> int:
    try:
        supplied = int(value)
    except (TypeError, ValueError) as exc:
        raise DeviceAuthError(GENERIC_DEVICE_ERROR) from exc
    current = now or dt.datetime.now(dt.timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=dt.timezone.utc)
    if abs(int(current.timestamp()) - supplied) > MAX_CLOCK_SKEW_SECONDS:
        raise DeviceAuthError(GENERIC_DEVICE_ERROR)
    return supplied


def _normalize_device_credential(value: str) -> str:
    text = str(value or "").strip()
    if not DEVICE_CREDENTIAL_PATTERN.fullmatch(text):
        raise DeviceAuthError(GENERIC_DEVICE_ERROR)
    return text


def _normalize_access_token(value: str) -> str:
    text = str(value or "").strip()
    if not ACCESS_TOKEN_PATTERN.fullmatch(text):
        raise DeviceAuthError(GENERIC_DEVICE_ERROR)
    return text


def _secret_hash(value: str, purpose: str, pepper_path: Path = DEFAULT_PEPPER_PATH) -> str:
    pepper = read_pepper(Path(pepper_path))
    payload = f"43A:{purpose}:{value}".encode("utf-8")
    return hmac.new(pepper, payload, hashlib.sha256).hexdigest()


def _verify_signature(public_key_b64: str, signature_b64: str, message: bytes) -> tuple[str, str]:
    public_key_bytes = _urlsafe_b64decode(public_key_b64, 32, "public_key")
    signature = _urlsafe_b64decode(signature_b64, 64, "signature")
    try:
        Ed25519PublicKey.from_public_bytes(public_key_bytes).verify(signature, message)
    except (InvalidSignature, ValueError) as exc:
        raise DeviceAuthError(GENERIC_DEVICE_ERROR) from exc
    return _urlsafe_b64encode(public_key_bytes), hashlib.sha256(public_key_bytes).hexdigest()


def initialize_device_registry(
    database_path: Path = DEFAULT_DATABASE_PATH,
    pepper_path: Path = DEFAULT_PEPPER_PATH,
) -> dict[str, Any]:
    initialize_registry(Path(database_path), Path(pepper_path), create_pepper=False)
    connection = connect_database(Path(database_path))
    try:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS security_schema_versions (
                component TEXT PRIMARY KEY,
                version INTEGER NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS devices (
                device_id TEXT PRIMARY KEY,
                license_id TEXT NOT NULL,
                public_key_b64 TEXT NOT NULL UNIQUE,
                public_key_fingerprint TEXT NOT NULL UNIQUE,
                machine_fingerprint_hash TEXT NOT NULL,
                device_credential_hash TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'revoked')),
                device_name TEXT NOT NULL,
                client_version TEXT NOT NULL DEFAULT '',
                activated_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_seen_at TEXT,
                suspended_at TEXT,
                revoked_at TEXT,
                reset_generation INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (license_id) REFERENCES licenses(license_id)
            );
            CREATE INDEX IF NOT EXISTS idx_devices_license_status ON devices(license_id, status);
            CREATE INDEX IF NOT EXISTS idx_devices_machine ON devices(license_id, machine_fingerprint_hash);
            CREATE UNIQUE INDEX IF NOT EXISTS uq_devices_allocated_machine
                ON devices(license_id, machine_fingerprint_hash)
                WHERE status IN ('active', 'suspended');
            CREATE TABLE IF NOT EXISTS device_nonces (
                nonce_hash TEXT PRIMARY KEY,
                device_id TEXT NOT NULL,
                purpose TEXT NOT NULL,
                used_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_device_nonces_expiry ON device_nonces(expires_at);
            CREATE TABLE IF NOT EXISTS device_access_tokens (
                token_hash TEXT PRIMARY KEY,
                device_id TEXT NOT NULL,
                license_id TEXT NOT NULL,
                issued_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                last_used_at TEXT,
                revoked_at TEXT,
                FOREIGN KEY (device_id) REFERENCES devices(device_id),
                FOREIGN KEY (license_id) REFERENCES licenses(license_id)
            );
            CREATE INDEX IF NOT EXISTS idx_device_tokens_device ON device_access_tokens(device_id, expires_at);
            CREATE INDEX IF NOT EXISTS idx_device_tokens_expiry ON device_access_tokens(expires_at);
            CREATE TABLE IF NOT EXISTS device_audit_log (
                audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
                occurred_at TEXT NOT NULL,
                action TEXT NOT NULL,
                actor TEXT NOT NULL,
                license_id TEXT,
                device_id TEXT,
                reason TEXT NOT NULL DEFAULT '',
                source_ip TEXT NOT NULL DEFAULT '',
                metadata_json TEXT NOT NULL DEFAULT '{}'
            );
            CREATE INDEX IF NOT EXISTS idx_device_audit_license ON device_audit_log(license_id, audit_id);
            CREATE INDEX IF NOT EXISTS idx_device_audit_device ON device_audit_log(device_id, audit_id);
            CREATE TABLE IF NOT EXISTS api_authorization_log (
                authz_id INTEGER PRIMARY KEY AUTOINCREMENT,
                occurred_at TEXT NOT NULL,
                method TEXT NOT NULL,
                route TEXT NOT NULL,
                access_class TEXT NOT NULL,
                allowed INTEGER NOT NULL CHECK (allowed IN (0, 1)),
                reason TEXT NOT NULL,
                license_id TEXT,
                customer_id TEXT,
                device_id TEXT,
                plan TEXT NOT NULL DEFAULT '',
                required_scopes_json TEXT NOT NULL DEFAULT '[]',
                effective_scopes_json TEXT NOT NULL DEFAULT '[]',
                source_ip TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_api_authz_license ON api_authorization_log(license_id, authz_id);
            CREATE INDEX IF NOT EXISTS idx_api_authz_device ON api_authorization_log(device_id, authz_id);
            CREATE INDEX IF NOT EXISTS idx_api_authz_route ON api_authorization_log(route, authz_id);
            """
        )
        now_text = iso_utc()
        connection.execute(
            """
            INSERT INTO security_schema_versions(component, version, updated_at)
            VALUES('devices', ?, ?)
            ON CONFLICT(component) DO UPDATE SET version=excluded.version, updated_at=excluded.updated_at
            """,
            (DEVICE_SCHEMA_VERSION, now_text),
        )
        connection.execute(
            """
            INSERT INTO security_schema_versions(component, version, updated_at)
            VALUES('authorization', ?, ?)
            ON CONFLICT(component) DO UPDATE SET version=excluded.version, updated_at=excluded.updated_at
            """,
            (AUTHORIZATION_SCHEMA_VERSION, now_text),
        )
        connection.commit()
    finally:
        connection.close()
    return device_registry_health(database_path, pepper_path)


def _public_device(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    data = dict(row)
    data.pop("device_credential_hash", None)
    data.pop("public_key_b64", None)
    return data


def _write_audit(
    connection: sqlite3.Connection,
    action: str,
    actor: str,
    license_id: str | None,
    device_id: str | None,
    reason: str = "",
    source_ip: str = "",
    metadata: dict[str, Any] | None = None,
) -> None:
    safe_actor = validate_audit_text(str(actor or "system"), "actor", 200)
    safe_reason = validate_audit_text(str(reason or ""), "reason", 1000, allow_empty=True)
    safe_metadata = _validate_audit_metadata(action, metadata)
    connection.execute(
        """
        INSERT INTO device_audit_log(
            occurred_at, action, actor, license_id, device_id, reason, source_ip, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            iso_utc(),
            str(action or "")[:100],
            safe_actor[:200],
            license_id,
            device_id,
            safe_reason[:1000],
            str(source_ip or "")[:100],
            json.dumps(safe_metadata, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
        ),
    )


def _validate_audit_metadata(action: str, metadata: dict[str, Any] | None) -> dict[str, Any]:
    value = dict(metadata or {})
    if not value:
        return {}
    if action == "device_self_deactivated":
        if set(value) != {"previous_status", "already_deactivated"}:
            raise ValueError("Ongeldige device-auditmetadata.")
        if value["previous_status"] not in DEVICE_STATUSES or not isinstance(
            value["already_deactivated"], bool
        ):
            raise ValueError("Ongeldige device-auditmetadata.")
        return value
    if action == "device_reset":
        if set(value) != {"revoked_device_ids", "revoked_count"}:
            raise ValueError("Ongeldige device-auditmetadata.")
        ids = value["revoked_device_ids"]
        count = value["revoked_count"]
        valid_ids = isinstance(ids, list) and len(ids) <= 1000
        if valid_ids:
            for item in ids:
                try:
                    if not isinstance(item, str) or _normalize_uuid(item) != item:
                        valid_ids = False
                        break
                except DeviceAuthError:
                    valid_ids = False
                    break
        if (
            not valid_ids
            or not isinstance(count, int)
            or isinstance(count, bool)
            or count != len(ids)
        ):
            raise ValueError("Ongeldige device-auditmetadata.")
        return {"revoked_device_ids": list(ids), "revoked_count": count}
    raise ValueError("Deze device-auditactie accepteert geen metadata.")


def _consume_nonce(
    connection: sqlite3.Connection,
    device_id: str,
    purpose: str,
    nonce: str,
    now: dt.datetime | None = None,
) -> None:
    current = now or dt.datetime.now(dt.timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=dt.timezone.utc)
    current_text = iso_utc(current)
    expiry = iso_utc(current + dt.timedelta(minutes=10))
    connection.execute("DELETE FROM device_nonces WHERE expires_at <= ?", (current_text,))
    digest = hashlib.sha256(f"{purpose}:{device_id}:{nonce}".encode("utf-8")).hexdigest()
    try:
        connection.execute(
            "INSERT INTO device_nonces(nonce_hash, device_id, purpose, used_at, expires_at) VALUES (?, ?, ?, ?, ?)",
            (digest, device_id, purpose, current_text, expiry),
        )
    except sqlite3.IntegrityError as exc:
        raise DeviceAuthError(GENERIC_DEVICE_ERROR) from exc


def _license_is_active_row(row: sqlite3.Row, current_text: str) -> bool:
    return bool(
        row["status"] == ACTIVE_STATUS
        and (not row["starts_at"] or current_text >= row["starts_at"])
        and (not row["expires_at"] or current_text < row["expires_at"])
    )


def _issue_access_token_in_transaction(
    connection: sqlite3.Connection,
    device_row: sqlite3.Row,
    license_row: sqlite3.Row,
    pepper_path: Path,
    now: dt.datetime | None = None,
    ttl_seconds: int | None = None,
) -> tuple[str, str]:
    current = now or dt.datetime.now(dt.timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=dt.timezone.utc)
    configured = ttl_seconds
    if configured is None:
        configured = int(os.environ.get("BELGOBASE_ACCESS_TOKEN_TTL_SECONDS") or DEFAULT_ACCESS_TOKEN_TTL_SECONDS)
    ttl = max(60, min(int(configured), 3600))
    token = "BAT3-" + secrets.token_urlsafe(32)
    digest = _secret_hash(token, "access-token", pepper_path)
    issued_at = iso_utc(current)
    expires_at = iso_utc(current + dt.timedelta(seconds=ttl))
    connection.execute(
        """
        INSERT INTO device_access_tokens(token_hash, device_id, license_id, issued_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (digest, device_row["device_id"], license_row["license_id"], issued_at, expires_at),
    )
    connection.execute(
        "UPDATE devices SET last_seen_at = ?, updated_at = ? WHERE device_id = ?",
        (issued_at, issued_at, device_row["device_id"]),
    )
    connection.execute("DELETE FROM device_access_tokens WHERE expires_at <= ?", (issued_at,))
    return token, expires_at


def activate_device(
    payload: dict[str, Any],
    database_path: Path = DEFAULT_DATABASE_PATH,
    pepper_path: Path = DEFAULT_PEPPER_PATH,
    source_ip: str = "",
    now: dt.datetime | None = None,
    token_ttl_seconds: int | None = None,
) -> dict[str, Any]:
    initialize_device_registry(database_path, pepper_path)
    license_code = str(payload.get("license_code") or "").strip()
    license_metadata = validate_credential(license_code, database_path, pepper_path, now)
    device_id = _normalize_uuid(payload.get("device_id"))
    public_key_b64 = str(payload.get("public_key") or "").strip()
    machine_hash = _normalize_hex64(payload.get("machine_fingerprint_hash"), "machine_fingerprint_hash")
    device_credential = _normalize_device_credential(payload.get("device_credential"))
    nonce = _normalize_nonce(payload.get("client_nonce"))
    client_timestamp = _normalize_client_timestamp(payload.get("client_timestamp"), now)
    signature_b64 = str(payload.get("signature") or "").strip()
    device_name = str(payload.get("device_name") or "Windows-apparaat").strip()[:200] or "Windows-apparaat"
    client_version = str(payload.get("client_version") or "").strip()[:100]
    canonical = activation_message(
        license_code,
        device_id,
        public_key_b64,
        machine_hash,
        device_credential,
        nonce,
        client_timestamp,
    )
    normalized_public_key, key_fingerprint = _verify_signature(public_key_b64, signature_b64, canonical)
    device_credential_hash = _secret_hash(device_credential, "device-credential", pepper_path)
    current = now or dt.datetime.now(dt.timezone.utc)
    current_text = iso_utc(current)
    connection = connect_database(Path(database_path))
    try:
        connection.execute("BEGIN IMMEDIATE")
        _consume_nonce(connection, device_id, "activate", nonce, current)
        license_row = connection.execute(
            "SELECT * FROM licenses WHERE license_id = ?", (license_metadata["license_id"],)
        ).fetchone()
        if license_row is None or not _license_is_active_row(license_row, current_text):
            raise DeviceAuthError(GENERIC_DEVICE_ERROR)
        existing = connection.execute("SELECT * FROM devices WHERE device_id = ?", (device_id,)).fetchone()
        if existing is not None:
            same_identity = bool(
                existing["license_id"] == license_row["license_id"]
                and existing["public_key_b64"] == normalized_public_key
                and existing["machine_fingerprint_hash"] == machine_hash
                and hmac.compare_digest(existing["device_credential_hash"], device_credential_hash)
            )
            if not same_identity or existing["status"] != "active":
                raise DeviceConflictError("device_activation_conflict")
            device_row = existing
            _write_audit(
                connection,
                "activation_retry",
                "client",
                license_row["license_id"],
                device_id,
                source_ip=source_ip,
            )
        else:
            if int(license_row["max_devices"]) < 1:
                raise DeviceLimitError("device_limit_reached")
            try:
                connection.execute(
                    """
                    INSERT INTO devices(
                        device_id, license_id, public_key_b64, public_key_fingerprint,
                        machine_fingerprint_hash, device_credential_hash, status,
                        device_name, client_version, activated_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
                    """,
                    (
                        device_id,
                        license_row["license_id"],
                        normalized_public_key,
                        key_fingerprint,
                        machine_hash,
                        device_credential_hash,
                        device_name,
                        client_version,
                        current_text,
                        current_text,
                    ),
                )
            except sqlite3.IntegrityError as exc:
                raise DeviceConflictError("device_activation_conflict") from exc
            device_row = connection.execute("SELECT * FROM devices WHERE device_id = ?", (device_id,)).fetchone()
            _write_audit(
                connection,
                "device_activated",
                "client",
                license_row["license_id"],
                device_id,
                source_ip=source_ip,
            )
        if device_row is None:
            raise DeviceAuthError(GENERIC_DEVICE_ERROR)
        if license_row["duration_days"] is not None and license_row["starts_at"] is None:
            before_term = license_row
            current = now or dt.datetime.now(dt.timezone.utc)
            current_text = iso_utc(current)
            term_end = iso_utc(current + dt.timedelta(days=int(license_row["duration_days"])))
            connection.execute(
                "UPDATE licenses SET starts_at=?, expires_at=?, updated_at=? "
                "WHERE license_id=? AND starts_at IS NULL",
                (current_text, term_end, current_text, license_row["license_id"]),
            )
            license_row = connection.execute(
                "SELECT * FROM licenses WHERE license_id=?", (license_row["license_id"],)
            ).fetchone()
            _write_license_audit(
                connection, "license_term_started", "client", "Eerste geslaagde activatie",
                license_row["license_id"], before_term, license_row,
            )
        if int(license_row["max_devices"]) < 1:
            raise DeviceLimitError("device_limit_reached")
        takeover(connection, license_row["license_id"], 'device:' + device_id, current_text)
        token, expires_at = _issue_access_token_in_transaction(
            connection, device_row, license_row, Path(pepper_path), current, token_ttl_seconds
        )
        connection.commit()
        return {
            "ok": True,
            "device": _public_device(device_row),
            "license": public_license_record(license_row),
            "access_token": token,
            "access_token_expires_at": expires_at,
            "auth_scheme": "Bearer",
        }
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def issue_access_token(
    payload: dict[str, Any],
    database_path: Path = DEFAULT_DATABASE_PATH,
    pepper_path: Path = DEFAULT_PEPPER_PATH,
    source_ip: str = "",
    now: dt.datetime | None = None,
    token_ttl_seconds: int | None = None,
) -> dict[str, Any]:
    initialize_device_registry(database_path, pepper_path)
    device_id = _normalize_uuid(payload.get("device_id"))
    machine_hash = _normalize_hex64(payload.get("machine_fingerprint_hash"), "machine_fingerprint_hash")
    device_credential = _normalize_device_credential(payload.get("device_credential"))
    nonce = _normalize_nonce(payload.get("client_nonce"))
    client_timestamp = _normalize_client_timestamp(payload.get("client_timestamp"), now)
    signature_b64 = str(payload.get("signature") or "").strip()
    canonical = token_message(device_id, machine_hash, device_credential, nonce, client_timestamp)
    credential_digest = _secret_hash(device_credential, "device-credential", pepper_path)
    current = now or dt.datetime.now(dt.timezone.utc)
    current_text = iso_utc(current)
    connection = connect_database(Path(database_path))
    try:
        connection.execute("BEGIN IMMEDIATE")
        device_row = connection.execute("SELECT * FROM devices WHERE device_id = ?", (device_id,)).fetchone()
        if device_row is None or device_row["status"] != "active":
            raise DeviceAuthError(GENERIC_DEVICE_ERROR)
        if device_row["machine_fingerprint_hash"] != machine_hash:
            raise DeviceAuthError(GENERIC_DEVICE_ERROR)
        if not hmac.compare_digest(device_row["device_credential_hash"], credential_digest):
            raise DeviceAuthError(GENERIC_DEVICE_ERROR)
        _verify_signature(device_row["public_key_b64"], signature_b64, canonical)
        _consume_nonce(connection, device_id, "token", nonce, current)
        license_row = connection.execute(
            "SELECT * FROM licenses WHERE license_id = ?", (device_row["license_id"],)
        ).fetchone()
        if license_row is None or not _license_is_active_row(license_row, current_text):
            raise DeviceAuthError(GENERIC_DEVICE_ERROR)
        if not permitted(connection, device_row["license_id"], 'device:' + device_id):
            raise DeviceAuthError(GENERIC_DEVICE_ERROR)
        token, expires_at = _issue_access_token_in_transaction(
            connection, device_row, license_row, Path(pepper_path), current, token_ttl_seconds
        )
        _write_audit(
            connection,
            "access_token_issued",
            "client",
            license_row["license_id"],
            device_id,
            source_ip=source_ip,
        )
        connection.commit()
        return {
            "ok": True,
            "access_token": token,
            "access_token_expires_at": expires_at,
            "auth_scheme": "Bearer",
            "device_id": device_id,
        }
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def deactivate_device(
    payload: dict[str, Any],
    database_path: Path = DEFAULT_DATABASE_PATH,
    pepper_path: Path = DEFAULT_PEPPER_PATH,
    source_ip: str = "",
    now: dt.datetime | None = None,
) -> dict[str, Any]:
    device_id = _normalize_uuid(payload.get("device_id"))
    machine_hash = _normalize_hex64(payload.get("machine_fingerprint_hash"), "machine_fingerprint_hash")
    device_credential = _normalize_device_credential(payload.get("device_credential"))
    reason = str(payload.get("reason") or "user_logout").strip()[:200]
    if not reason:
        raise DeviceAuthError(GENERIC_DEVICE_ERROR)
    try:
        reason = validate_audit_text(reason, "reason", 200)
    except ValueError as exc:
        raise DeviceAuthError(GENERIC_DEVICE_ERROR) from exc
    initialize_device_registry(database_path, pepper_path)
    nonce = _normalize_nonce(payload.get("client_nonce"))
    client_timestamp = _normalize_client_timestamp(payload.get("client_timestamp"), now)
    signature_b64 = str(payload.get("signature") or "").strip()
    canonical = deactivation_message(
        device_id,
        machine_hash,
        device_credential,
        reason,
        nonce,
        client_timestamp,
    )
    credential_digest = _secret_hash(device_credential, "device-credential", pepper_path)
    current = now or dt.datetime.now(dt.timezone.utc)
    current_text = iso_utc(current)
    connection = connect_database(Path(database_path))
    try:
        connection.execute("BEGIN IMMEDIATE")
        device_row = connection.execute("SELECT * FROM devices WHERE device_id = ?", (device_id,)).fetchone()
        if device_row is None:
            raise DeviceAuthError(GENERIC_DEVICE_ERROR)
        if device_row["machine_fingerprint_hash"] != machine_hash:
            raise DeviceAuthError(GENERIC_DEVICE_ERROR)
        if not hmac.compare_digest(device_row["device_credential_hash"], credential_digest):
            raise DeviceAuthError(GENERIC_DEVICE_ERROR)
        _verify_signature(device_row["public_key_b64"], signature_b64, canonical)
        _consume_nonce(connection, device_id, "deactivate", nonce, current)
        previous_status = str(device_row["status"])
        connection.execute(
            """
            UPDATE devices
            SET status='revoked', updated_at=?, revoked_at=COALESCE(revoked_at, ?),
                reset_generation=reset_generation + CASE WHEN status='revoked' THEN 0 ELSE 1 END
            WHERE device_id=?
            """,
            (current_text, current_text, device_id),
        )
        connection.execute(
            "UPDATE device_access_tokens SET revoked_at=? WHERE device_id=? AND revoked_at IS NULL",
            (current_text, device_id),
        )
        _write_audit(
            connection,
            "device_self_deactivated",
            "client",
            device_row["license_id"],
            device_id,
            reason=reason,
            source_ip=source_ip,
            metadata={"previous_status": previous_status, "already_deactivated": previous_status == "revoked"},
        )
        connection.commit()
        updated = connection.execute("SELECT * FROM devices WHERE device_id = ?", (device_id,)).fetchone()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    if updated is None:
        raise DeviceAuthError(GENERIC_DEVICE_ERROR)
    return {
        "ok": True,
        "device_id": device_id,
        "status": "revoked",
        "deactivated_at": updated["revoked_at"],
        "already_deactivated": previous_status == "revoked",
    }


def validate_access_token(
    access_token: str,
    database_path: Path = DEFAULT_DATABASE_PATH,
    pepper_path: Path = DEFAULT_PEPPER_PATH,
    now: dt.datetime | None = None,
) -> dict[str, Any]:
    try:
        token = _normalize_access_token(access_token)
        digest = _secret_hash(token, "access-token", pepper_path)
        current = now or dt.datetime.now(dt.timezone.utc)
        current_text = iso_utc(current)
        connection = connect_database(Path(database_path))
        try:
            row = connection.execute(
                """
                SELECT
                    t.token_hash, t.expires_at AS token_expires_at, t.revoked_at AS token_revoked_at,
                    d.*,
                    l.customer_id, l.customer_name, l.contract_id, l.status AS license_status,
                    l.plan, l.rights_json, l.max_devices, l.starts_at, l.expires_at AS license_expires_at
                FROM device_access_tokens t
                JOIN devices d ON d.device_id = t.device_id
                JOIN licenses l ON l.license_id = t.license_id
                WHERE t.token_hash = ?
                LIMIT 1
                """,
                (digest,),
            ).fetchone()
            if row is None:
                raise DeviceAuthError(GENERIC_DEVICE_ERROR)
            if row["token_revoked_at"] or current_text >= row["token_expires_at"]:
                raise DeviceAuthError(GENERIC_DEVICE_ERROR)
            if row["status"] != "active" or row["license_status"] != ACTIVE_STATUS:
                raise DeviceAuthError(GENERIC_DEVICE_ERROR)
            if not permitted(connection, row["license_id"], 'device:' + row["device_id"]):
                raise DeviceAuthError(GENERIC_DEVICE_ERROR)
            if row["starts_at"] and current_text < row["starts_at"]:
                raise DeviceAuthError(GENERIC_DEVICE_ERROR)
            if row["license_expires_at"] and current_text >= row["license_expires_at"]:
                raise DeviceAuthError(GENERIC_DEVICE_ERROR)
            connection.execute(
                "UPDATE device_access_tokens SET last_used_at = ? WHERE token_hash = ?",
                (current_text, digest),
            )
            connection.execute(
                "UPDATE devices SET last_seen_at = ?, updated_at = ? WHERE device_id = ?",
                (current_text, current_text, row["device_id"]),
            )
            connection.commit()
        finally:
            connection.close()
        rights = json.loads(row["rights_json"] or "{}")
        return {
            "license_id": row["license_id"],
            "customer_id": row["customer_id"],
            "customer_name": row["customer_name"],
            "contract_id": row["contract_id"],
            "plan": row["plan"],
            "rights": rights,
            "max_devices": row["max_devices"],
            "device_id": row["device_id"],
            "device_name": row["device_name"],
            "public_key_fingerprint": row["public_key_fingerprint"],
            "access_token_expires_at": row["token_expires_at"],
        }
    except DeviceAuthError:
        raise
    except Exception as exc:
        raise DeviceAuthError(GENERIC_DEVICE_ERROR) from exc


def list_devices(
    database_path: Path = DEFAULT_DATABASE_PATH,
    license_id: str | None = None,
) -> list[dict[str, Any]]:
    connection = connect_database_readonly(Path(database_path))
    try:
        if license_id:
            rows = connection.execute(
                "SELECT * FROM devices WHERE license_id = ? ORDER BY activated_at, device_id", (str(license_id),)
            ).fetchall()
        else:
            rows = connection.execute("SELECT * FROM devices ORDER BY license_id, activated_at, device_id").fetchall()
    finally:
        connection.close()
    return [_public_device(row) for row in rows]


def get_device(device_id: str, database_path: Path = DEFAULT_DATABASE_PATH) -> dict[str, Any]:
    normalized = _normalize_uuid(device_id)
    connection = connect_database_readonly(Path(database_path))
    try:
        row = connection.execute("SELECT * FROM devices WHERE device_id = ?", (normalized,)).fetchone()
    finally:
        connection.close()
    if row is None:
        raise KeyError("Device niet gevonden.")
    return _public_device(row)


def set_device_status(
    device_id: str,
    status: str,
    actor: str,
    reason: str,
    database_path: Path = DEFAULT_DATABASE_PATH,
) -> dict[str, Any]:
    normalized_actor = validate_audit_text(actor, "actor", 200)
    normalized_reason = validate_audit_text(reason, "reason", 1000)
    normalized = _normalize_uuid(device_id)
    normalized_status = str(status or "").strip().lower()
    if normalized_status not in DEVICE_STATUSES:
        raise ValueError("Ongeldige devicestatus.")
    current_text = iso_utc()
    connection = connect_database(Path(database_path))
    try:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute("SELECT * FROM devices WHERE device_id = ?", (normalized,)).fetchone()
        if row is None:
            raise KeyError("Device niet gevonden.")
        current_status = str(row["status"])
        if normalized_status == current_status:
            connection.rollback()
            return _public_device(row)
        allowed_transitions = {
            "active": {"suspended", "revoked"},
            "suspended": {"active", "revoked"},
            "revoked": set(),
        }
        if normalized_status not in allowed_transitions[current_status]:
            raise ValueError("Deze computerstatus kan niet meer worden gewijzigd.")
        if normalized_status == "active":
            license_row = connection.execute(
                "SELECT status, max_devices, starts_at, expires_at FROM licenses WHERE license_id = ?",
                (row["license_id"],),
            ).fetchone()
            if license_row is None or not _license_is_active_row(license_row, current_text):
                raise DeviceAuthError("license_not_active")
            allocated = count_all_allocated(
                connection, row["license_id"], current_text,
                exclude_device_id=normalized,
            )
            if int(allocated) >= int(license_row["max_devices"]):
                raise DeviceLimitError("device_limit_reached")
        suspended_at = current_text if normalized_status == "suspended" else None
        revoked_at = current_text if normalized_status == "revoked" else None
        connection.execute(
            """
            UPDATE devices
            SET status = ?, updated_at = ?, suspended_at = ?, revoked_at = ?
            WHERE device_id = ?
            """,
            (normalized_status, current_text, suspended_at, revoked_at, normalized),
        )
        if normalized_status != "active":
            connection.execute(
                "UPDATE device_access_tokens SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL",
                (current_text, normalized),
            )
        _write_audit(
            connection,
            f"device_{normalized_status}",
            normalized_actor,
            row["license_id"],
            normalized,
            reason=normalized_reason,
        )
        connection.commit()
        updated = connection.execute("SELECT * FROM devices WHERE device_id = ?", (normalized,)).fetchone()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    if updated is None:
        raise KeyError("Device niet gevonden.")
    return _public_device(updated)


def reset_license_devices(
    license_id: str,
    actor: str,
    reason: str,
    database_path: Path = DEFAULT_DATABASE_PATH,
) -> dict[str, Any]:
    normalized_actor = validate_audit_text(actor, "actor", 200)
    normalized_reason = validate_audit_text(reason, "reason", 1000)
    normalized_license_id = str(license_id or "").strip()
    if not normalized_license_id:
        raise ValueError("license_id ontbreekt.")
    current_text = iso_utc()
    connection = connect_database(Path(database_path))
    try:
        connection.execute("BEGIN IMMEDIATE")
        license_row = connection.execute(
            "SELECT license_id FROM licenses WHERE license_id = ?", (normalized_license_id,)
        ).fetchone()
        if license_row is None:
            raise KeyError("Licentie niet gevonden.")
        rows = connection.execute(
            "SELECT * FROM devices WHERE license_id = ? AND status IN ('active','suspended')",
            (normalized_license_id,),
        ).fetchall()
        ids = [row["device_id"] for row in rows]
        if ids:
            placeholders = ",".join("?" for _ in ids)
            connection.execute(
                f"UPDATE devices SET status='revoked', updated_at=?, revoked_at=?, reset_generation=reset_generation+1 WHERE device_id IN ({placeholders})",
                (current_text, current_text, *ids),
            )
            connection.execute(
                f"UPDATE device_access_tokens SET revoked_at=? WHERE device_id IN ({placeholders}) AND revoked_at IS NULL",
                (current_text, *ids),
            )
        _write_audit(
            connection,
            "device_reset",
            normalized_actor,
            normalized_license_id,
            None,
            reason=normalized_reason,
            metadata={"revoked_device_ids": ids, "revoked_count": len(ids)},
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {"license_id": normalized_license_id, "revoked_count": len(ids), "device_ids": ids}


def list_device_audit(
    database_path: Path = DEFAULT_DATABASE_PATH,
    license_id: str | None = None,
    device_id: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    parameters: list[Any] = []
    if license_id:
        clauses.append("license_id = ?")
        parameters.append(str(license_id))
    if device_id:
        clauses.append("device_id = ?")
        parameters.append(_normalize_uuid(device_id))
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    bounded_limit = max(1, min(int(limit), 1000))
    connection = connect_database_readonly(Path(database_path))
    try:
        rows = connection.execute(
            f"SELECT * FROM device_audit_log{where} ORDER BY audit_id DESC LIMIT ?",
            (*parameters, bounded_limit),
        ).fetchall()
    finally:
        connection.close()
    result: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["metadata"] = json.loads(item.pop("metadata_json") or "{}")
        result.append(item)
    return result


def record_authorization_decision(
    method: str,
    route: str,
    access_class: str,
    allowed: bool,
    reason: str,
    context: dict[str, Any] | None = None,
    required_scopes: list[str] | tuple[str, ...] | set[str] | None = None,
    effective_scopes: list[str] | tuple[str, ...] | set[str] | None = None,
    source_ip: str = "",
    database_path: Path = DEFAULT_DATABASE_PATH,
) -> int:
    auth_context = context or {}
    required = sorted({str(value) for value in (required_scopes or []) if str(value)})
    effective = sorted({str(value) for value in (effective_scopes or []) if str(value)})
    connection = connect_database(Path(database_path))
    try:
        cursor = connection.execute(
            """
            INSERT INTO api_authorization_log(
                occurred_at, method, route, access_class, allowed, reason,
                license_id, customer_id, device_id, plan,
                required_scopes_json, effective_scopes_json, source_ip
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                iso_utc(),
                str(method or "").strip().upper()[:16],
                str(route or "").strip()[:500],
                str(access_class or "").strip().lower()[:50],
                1 if allowed else 0,
                str(reason or "").strip().lower()[:100],
                str(auth_context.get("license_id") or "") or None,
                str(auth_context.get("customer_id") or "") or None,
                str(auth_context.get("device_id") or "") or None,
                str(auth_context.get("plan") or "")[:100],
                json.dumps(required, separators=(",", ":")),
                json.dumps(effective, separators=(",", ":")),
                str(source_ip or "")[:100],
            ),
        )
        connection.execute(
            """
            DELETE FROM api_authorization_log
            WHERE authz_id <= (SELECT COALESCE(MAX(authz_id), 0) - ? FROM api_authorization_log)
            """,
            (AUTHORIZATION_LOG_MAX_ROWS,),
        )
        connection.commit()
        return int(cursor.lastrowid)
    finally:
        connection.close()


def list_authorization_decisions(
    database_path: Path = DEFAULT_DATABASE_PATH,
    license_id: str | None = None,
    device_id: str | None = None,
    route: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    parameters: list[Any] = []
    if license_id:
        clauses.append("license_id = ?")
        parameters.append(str(license_id))
    if device_id:
        clauses.append("device_id = ?")
        parameters.append(_normalize_uuid(device_id))
    if route:
        clauses.append("route = ?")
        parameters.append(str(route))
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    bounded_limit = max(1, min(int(limit), 1000))
    connection = connect_database_readonly(Path(database_path))
    try:
        rows = connection.execute(
            f"SELECT * FROM api_authorization_log{where} ORDER BY authz_id DESC LIMIT ?",
            (*parameters, bounded_limit),
        ).fetchall()
    finally:
        connection.close()
    result: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["allowed"] = bool(item["allowed"])
        item["required_scopes"] = json.loads(item.pop("required_scopes_json") or "[]")
        item["effective_scopes"] = json.loads(item.pop("effective_scopes_json") or "[]")
        result.append(item)
    return result


def device_registry_health(
    database_path: Path = DEFAULT_DATABASE_PATH,
    pepper_path: Path = DEFAULT_PEPPER_PATH,
) -> dict[str, Any]:
    database = Path(database_path)
    pepper = Path(pepper_path)
    result: dict[str, Any] = {
        "ready": False,
        "schema_version": 0,
        "authorization_schema_version": 0,
        "authorization_ready": False,
        "database_exists": database.exists(),
        "pepper_exists": pepper.exists(),
    }
    if not database.exists() or not pepper.exists():
        return result
    try:
        connection = connect_database_readonly(database)
        try:
            row = connection.execute(
                "SELECT version FROM security_schema_versions WHERE component='devices'"
            ).fetchone()
            authorization_row = connection.execute(
                "SELECT version FROM security_schema_versions WHERE component='authorization'"
            ).fetchone()
            connection.execute("SELECT device_id FROM devices LIMIT 1").fetchone()
            connection.execute("SELECT token_hash FROM device_access_tokens LIMIT 1").fetchone()
            connection.execute("SELECT authz_id FROM api_authorization_log LIMIT 1").fetchone()
        finally:
            connection.close()
        version = int(row["version"]) if row is not None else 0
        authorization_version = int(authorization_row["version"]) if authorization_row is not None else 0
        result["schema_version"] = version
        result["authorization_schema_version"] = authorization_version
        result["authorization_ready"] = authorization_version == AUTHORIZATION_SCHEMA_VERSION
        result["ready"] = (
            version == DEVICE_SCHEMA_VERSION
            and result["authorization_ready"]
            and len(pepper.read_bytes()) >= 32
        )
    except Exception:
        result["ready"] = False
    return result
