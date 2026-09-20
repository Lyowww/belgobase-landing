from __future__ import annotations

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


# Shared base version: the account registry requires 1; additions are checked by column.
SCHEMA_VERSION = 1
GENERIC_LICENSE_ERROR = "license_invalid"
ACTIVE_STATUS = "active"
ALLOWED_STATUSES = {"active", "suspended", "revoked"}
ALLOWED_PLANS = frozenset({"full", "internal-full", "read_only", "data_only", "xbrl_only"})
ALLOWED_RIGHTS_KEYS = frozenset({"data_access", "xbrl", "exports", "scopes"})
ALLOWED_DATA_ACCESS = frozenset({"all_current"})
ALLOWED_SCOPES = frozenset({"data.read", "data.export", "xbrl.read", "xbrl.export"})
DEFAULT_DATABASE_PATH = Path(
    os.environ.get("BELGOBASE_LICENSE_DB") or r"C:\BelgoBase_App\security\licenses.sqlite3"
)
DEFAULT_PEPPER_PATH = Path(
    os.environ.get("BELGOBASE_LICENSE_PEPPER_FILE") or r"C:\BelgoBase_App\secrets\license_pepper.bin"
)
IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")
CREDENTIAL_PATTERN = re.compile(r"^BB2-[A-Za-z0-9_-]{43}$")
_AUDIT_SECRET_PATTERNS = (
    re.compile(r"(?:BB2|BD3|BAT3)-[A-Za-z0-9_-]{20,}"),
    re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b"),
    re.compile(
        r"-----BEGIN [^-\r\n]*PRIVATE KEY-----.*?-----END [^-\r\n]*PRIVATE KEY-----",
        re.IGNORECASE | re.DOTALL,
    ),
)
_AUDIT_HASH_PATTERN = re.compile(r"(?<![A-Fa-f0-9])[A-Fa-f0-9]{64}(?![A-Fa-f0-9])")
_AUDIT_BASE64_PATTERN = re.compile(
    r"(?<![A-Za-z0-9+/_-])[A-Za-z0-9+/_-]{48,}={0,2}(?![A-Za-z0-9+/_=-])"
)
_AUDIT_SENSITIVE_ASSIGNMENT = re.compile(
    r"(?i)((?:password|passwd|secret|token|credential|license_code|private_key|pepper)\s*[:=]\s*)([^\s,;]+)"
)


class LicenseValidationError(PermissionError):
    pass


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def iso_utc(value: dt.datetime | None = None) -> str:
    current = value or utc_now()
    if current.tzinfo is None:
        current = current.replace(tzinfo=dt.timezone.utc)
    return current.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def parse_timestamp(value: str | None, field_name: str) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"{field_name} moet een geldige ISO-8601 datum/tijd zijn.") from exc
    if parsed.tzinfo is None:
        raise ValueError(f"{field_name} moet een tijdzone bevatten.")
    return iso_utc(parsed)


def validate_identifier(value: str, field_name: str) -> str:
    text = str(value or "").strip()
    if not IDENTIFIER_PATTERN.fullmatch(text):
        raise ValueError(f"{field_name} bevat ongeldige tekens of lengte.")
    return text


def validate_nonempty(value: str, field_name: str, maximum: int = 200) -> str:
    text = str(value or "").strip()
    if not text or len(text) > maximum:
        raise ValueError(f"{field_name} ontbreekt of is te lang.")
    return text


def normalize_rights(rights: Any) -> dict[str, Any]:
    if rights is None:
        return {"data_access": "all_current"}
    if isinstance(rights, str):
        parsed = json.loads(rights)
    else:
        parsed = rights
    if not isinstance(parsed, dict):
        raise ValueError("rights moet een JSON-object zijn.")
    unknown_keys = set(parsed).difference(ALLOWED_RIGHTS_KEYS)
    if unknown_keys:
        raise ValueError("rights bevat onbekende velden.")
    data_access = parsed.get("data_access", "all_current")
    if not isinstance(data_access, str) or data_access not in ALLOWED_DATA_ACCESS:
        raise ValueError("rights.data_access is ongeldig.")
    normalized: dict[str, Any] = {"data_access": data_access}
    for field in ("xbrl", "exports"):
        if field in parsed:
            if not isinstance(parsed[field], bool):
                raise ValueError(f"rights.{field} moet true of false zijn.")
            normalized[field] = parsed[field]
    if "scopes" in parsed:
        scopes = parsed["scopes"]
        if not isinstance(scopes, list) or any(not isinstance(scope, str) for scope in scopes):
            raise ValueError("rights.scopes moet een lijst met erkende scopes zijn.")
        if len(scopes) != len(set(scopes)) or not set(scopes).issubset(ALLOWED_SCOPES):
            raise ValueError("rights.scopes bevat een onbekende of dubbele scope.")
        normalized["scopes"] = list(scopes)
    return normalized


def connect_database(database_path: Path = DEFAULT_DATABASE_PATH) -> sqlite3.Connection:
    connection = sqlite3.connect(str(database_path), timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute("PRAGMA busy_timeout=15000")
    return connection


def connect_database_readonly(database_path: Path = DEFAULT_DATABASE_PATH) -> sqlite3.Connection:
    database = Path(database_path).resolve()
    connection = sqlite3.connect(database.as_uri() + "?mode=ro", uri=True, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute("PRAGMA query_only=ON")
    connection.execute("PRAGMA busy_timeout=15000")
    return connection


def initialize_registry(
    database_path: Path = DEFAULT_DATABASE_PATH,
    pepper_path: Path = DEFAULT_PEPPER_PATH,
    create_pepper: bool = False,
) -> dict[str, Any]:
    database_path = Path(database_path)
    pepper_path = Path(pepper_path)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    pepper_path.parent.mkdir(parents=True, exist_ok=True)
    if create_pepper and not pepper_path.exists():
        pepper_path.write_bytes(secrets.token_bytes(32))
    if not pepper_path.exists():
        raise RuntimeError("Licentiepepper ontbreekt.")
    pepper = pepper_path.read_bytes()
    if len(pepper) < 32:
        raise RuntimeError("Licentiepepper is ongeldig.")

    connection = connect_database(database_path)
    try:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS licenses (
                license_id TEXT PRIMARY KEY,
                customer_id TEXT NOT NULL,
                customer_name TEXT NOT NULL,
                contract_id TEXT NOT NULL,
                credential_hash TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'revoked')),
                plan TEXT NOT NULL,
                rights_json TEXT NOT NULL,
                max_devices INTEGER NOT NULL CHECK (max_devices >= 0),
                starts_at TEXT,
                expires_at TEXT,
                duration_days INTEGER CHECK (duration_days IS NULL OR duration_days BETWEEN 1 AND 36500),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                rotated_at TEXT,
                revoked_at TEXT,
                credential_version INTEGER NOT NULL DEFAULT 1,
                notes TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_licenses_customer_id ON licenses(customer_id);
            CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
            CREATE INDEX IF NOT EXISTS idx_licenses_contract_id ON licenses(contract_id);
            CREATE UNIQUE INDEX IF NOT EXISTS uq_licenses_customer_id ON licenses(customer_id);
            CREATE TABLE IF NOT EXISTS license_audit_log (
                audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
                occurred_at TEXT NOT NULL,
                action TEXT NOT NULL,
                actor TEXT NOT NULL,
                license_id TEXT NOT NULL,
                reason TEXT NOT NULL,
                before_json TEXT NOT NULL DEFAULT '{}',
                after_json TEXT NOT NULL DEFAULT '{}'
            );
            CREATE INDEX IF NOT EXISTS idx_license_audit_license
                ON license_audit_log(license_id, audit_id);
            CREATE TRIGGER IF NOT EXISTS license_audit_no_update
            BEFORE UPDATE ON license_audit_log
            BEGIN SELECT RAISE(ABORT, 'license_audit_log is append-only'); END;
            CREATE TRIGGER IF NOT EXISTS license_audit_no_delete
            BEFORE DELETE ON license_audit_log
            BEGIN SELECT RAISE(ABORT, 'license_audit_log is append-only'); END;
            """
        )
        connection.execute("BEGIN IMMEDIATE")
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(licenses)")}
        if "duration_days" not in columns:
            connection.execute(
                "ALTER TABLE licenses ADD COLUMN duration_days INTEGER "
                "CHECK (duration_days IS NULL OR duration_days BETWEEN 1 AND 36500)"
            )
        connection.execute(f"PRAGMA user_version={SCHEMA_VERSION}")
        connection.commit()
    finally:
        connection.close()
    return registry_health(database_path, pepper_path)


def read_pepper(pepper_path: Path = DEFAULT_PEPPER_PATH) -> bytes:
    path = Path(pepper_path)
    if not path.exists():
        raise LicenseValidationError(GENERIC_LICENSE_ERROR)
    value = path.read_bytes()
    if len(value) < 32:
        raise LicenseValidationError(GENERIC_LICENSE_ERROR)
    return value


def normalize_credential(credential: str) -> str:
    supplied = str(credential or "").strip()
    if not CREDENTIAL_PATTERN.fullmatch(supplied):
        raise LicenseValidationError(GENERIC_LICENSE_ERROR)
    return supplied


def credential_hash(credential: str, pepper_path: Path = DEFAULT_PEPPER_PATH) -> str:
    supplied = normalize_credential(credential)
    pepper = read_pepper(pepper_path)
    return hmac.new(pepper, supplied.encode("utf-8"), hashlib.sha256).hexdigest()


def generate_credential() -> str:
    return "BB2-" + secrets.token_urlsafe(32)


def normalize_plan(plan: str) -> str:
    normalized = validate_identifier(plan, "plan")
    if normalized not in ALLOWED_PLANS:
        raise ValueError("Onbekend licentieplan.")
    return normalized


def validate_audit_text(
    value: str, field_name: str, maximum: int, *, allow_empty: bool = False
) -> str:
    if allow_empty and not str(value or "").strip():
        return ""
    text = validate_nonempty(value, field_name, maximum)
    if any(ord(character) < 32 and character not in "\t" for character in text):
        raise ValueError(f"{field_name} moet gewone tekst zijn.")
    if (
        any(pattern.search(text) for pattern in _AUDIT_SECRET_PATTERNS)
        or _AUDIT_HASH_PATTERN.search(text)
        or _AUDIT_BASE64_PATTERN.search(text)
        or _AUDIT_SENSITIVE_ASSIGNMENT.search(text)
    ):
        raise ValueError(f"{field_name} mag geen code, token, sleutel of hash bevatten.")
    return text


def _audit_safe_value(value: Any) -> Any:
    if isinstance(value, str):
        text = value[:500]
        for pattern in _AUDIT_SECRET_PATTERNS:
            text = pattern.sub("[GEHEIM VERWIJDERD]", text)
        return _AUDIT_SENSITIVE_ASSIGNMENT.sub(r"\1[GEHEIM VERWIJDERD]", text)
    if isinstance(value, list):
        return [_audit_safe_value(item) for item in value[:100]]
    if isinstance(value, (bool, int, float)) or value is None:
        return value
    return "[ONDERDRUKT]"


def _audit_snapshot(row: sqlite3.Row | dict[str, Any] | None) -> dict[str, Any]:
    if row is None:
        return {}
    data = dict(row)
    rights = data.get("rights_json", "{}")
    parsed_rights = json.loads(rights) if isinstance(rights, str) else rights
    safe_rights = {
        key: _audit_safe_value(parsed_rights[key])
        for key in ("data_access", "xbrl", "exports", "scopes")
        if isinstance(parsed_rights, dict) and key in parsed_rights
    }
    snapshot = {
        "status": data.get("status"),
        "plan": data.get("plan"),
        "rights": safe_rights,
        "max_devices": data.get("max_devices"),
        "starts_at": data.get("starts_at"),
        "expires_at": data.get("expires_at"),
        "duration_days": data.get("duration_days"),
        "credential_version": data.get("credential_version"),
        "created_at": data.get("created_at"),
        "updated_at": data.get("updated_at"),
        "rotated_at": data.get("rotated_at"),
        "revoked_at": data.get("revoked_at"),
    }
    for field in ("revoked_token_count", "revoked_device_count"):
        value = data.get(field)
        if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
            snapshot[field] = value
    return snapshot


def _write_license_audit(
    connection: sqlite3.Connection,
    action: str,
    actor: str,
    reason: str,
    license_id: str,
    before: sqlite3.Row | dict[str, Any] | None,
    after: sqlite3.Row | dict[str, Any] | None,
) -> None:
    connection.execute(
        """
        INSERT INTO license_audit_log(
            occurred_at, action, actor, license_id, reason, before_json, after_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            iso_utc(),
            validate_identifier(action, "action"),
            validate_audit_text(actor, "actor", 200),
            validate_nonempty(license_id, "license_id", 128),
            validate_audit_text(reason, "reason", 1000),
            json.dumps(_audit_snapshot(before), ensure_ascii=False, sort_keys=True, separators=(",", ":")),
            json.dumps(_audit_snapshot(after), ensure_ascii=False, sort_keys=True, separators=(",", ":")),
        ),
    )


def _allocated_device_count(connection: sqlite3.Connection, license_id: str) -> int:
    table = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='devices'"
    ).fetchone()
    if table is None:
        return 0
    return int(
        connection.execute(
            "SELECT COUNT(*) FROM devices WHERE license_id=? AND status IN ('active','suspended')",
            (license_id,),
        ).fetchone()[0]
    )


def _device_security_tables_available(connection: sqlite3.Connection) -> bool:
    rows = connection.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type='table' AND name IN ('devices', 'device_access_tokens')
        """
    ).fetchall()
    names = {str(row["name"]) for row in rows}
    required = {"devices", "device_access_tokens"}
    if not names:
        return False
    if names != required:
        raise RuntimeError("Device-securityschema is onvolledig; licentiemutatie geweigerd.")
    return True


def public_record(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    data = dict(row)
    data.pop("credential_hash", None)
    rights = data.pop("rights_json", "{}")
    data["rights"] = json.loads(rights)
    return data


def create_license(
    customer_id: str,
    customer_name: str,
    contract_id: str,
    plan: str,
    rights: Any = None,
    max_devices: int = 1,
    starts_at: str | None = None,
    expires_at: str | None = None,
    notes: str = "",
    issued_credential: str | None = None,
    database_path: Path = DEFAULT_DATABASE_PATH,
    pepper_path: Path = DEFAULT_PEPPER_PATH,
    actor: str = "legacy-internal",
    reason: str = "Legacy internal programmatic operation",
    duration_days: int | None = None,
) -> tuple[dict[str, Any], str]:
    normalized_actor = validate_audit_text(actor, "actor", 200)
    normalized_reason = validate_audit_text(reason, "reason", 1000)
    initialize_registry(database_path, pepper_path, create_pepper=False)
    normalized_customer_id = validate_identifier(customer_id, "customer_id")
    normalized_contract_id = validate_identifier(contract_id, "contract_id")
    normalized_customer_name = validate_nonempty(customer_name, "customer_name")
    normalized_plan = normalize_plan(plan)
    normalized_rights = normalize_rights(rights)
    normalized_starts_at = parse_timestamp(starts_at, "starts_at")
    normalized_expires_at = parse_timestamp(expires_at, "expires_at")
    if duration_days is not None:
        if isinstance(duration_days, bool) or not isinstance(duration_days, int) or not 1 <= duration_days <= 36500:
            raise ValueError("duration_days moet een geheel aantal dagen tussen 1 en 36500 zijn.")
        if normalized_starts_at or normalized_expires_at:
            raise ValueError("Een termijn vanaf activatie kan geen vaste start- of einddatum hebben.")
    if normalized_starts_at and normalized_expires_at and normalized_starts_at >= normalized_expires_at:
        raise ValueError("expires_at moet na starts_at liggen.")
    device_limit = int(max_devices)
    if device_limit < 0:
        raise ValueError("max_devices mag niet negatief zijn.")
    credential = normalize_credential(issued_credential) if issued_credential is not None else generate_credential()
    digest = credential_hash(credential, pepper_path)
    created_at = iso_utc()
    license_id = str(uuid.uuid4())
    connection = connect_database(Path(database_path))
    try:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute(
            """
            INSERT INTO licenses (
                license_id, customer_id, customer_name, contract_id, credential_hash,
                status, plan, rights_json, max_devices, starts_at, expires_at,
                created_at, updated_at, notes, duration_days
            ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                license_id,
                normalized_customer_id,
                normalized_customer_name,
                normalized_contract_id,
                digest,
                normalized_plan,
                json.dumps(normalized_rights, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                device_limit,
                normalized_starts_at,
                normalized_expires_at,
                created_at,
                created_at,
                str(notes or "").strip()[:1000],
                duration_days,
            ),
        )
        row = connection.execute("SELECT * FROM licenses WHERE license_id = ?", (license_id,)).fetchone()
        if row is None:
            raise RuntimeError("Nieuwe licentie kon niet worden teruggelezen.")
        _write_license_audit(
            connection, "license_created", normalized_actor, normalized_reason, license_id, None, row
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return public_record(row), credential


def validate_credential(
    credential: str,
    database_path: Path = DEFAULT_DATABASE_PATH,
    pepper_path: Path = DEFAULT_PEPPER_PATH,
    now: dt.datetime | None = None,
) -> dict[str, Any]:
    try:
        digest = credential_hash(credential, pepper_path)
        connection = connect_database_readonly(Path(database_path))
        try:
            row = connection.execute(
                "SELECT * FROM licenses WHERE credential_hash = ? LIMIT 1", (digest,)
            ).fetchone()
        finally:
            connection.close()
        if row is None:
            raise LicenseValidationError(GENERIC_LICENSE_ERROR)
        current = iso_utc(now)
        if row["status"] != ACTIVE_STATUS:
            raise LicenseValidationError(GENERIC_LICENSE_ERROR)
        if row["starts_at"] and current < row["starts_at"]:
            raise LicenseValidationError(GENERIC_LICENSE_ERROR)
        if row["expires_at"] and current >= row["expires_at"]:
            raise LicenseValidationError(GENERIC_LICENSE_ERROR)
        return public_record(row)
    except LicenseValidationError:
        raise
    except Exception as exc:
        raise LicenseValidationError(GENERIC_LICENSE_ERROR) from exc


def get_license(license_id: str, database_path: Path = DEFAULT_DATABASE_PATH) -> dict[str, Any]:
    normalized_license_id = validate_nonempty(license_id, "license_id", 128)
    connection = connect_database_readonly(Path(database_path))
    try:
        row = connection.execute("SELECT * FROM licenses WHERE license_id = ?", (normalized_license_id,)).fetchone()
    finally:
        connection.close()
    if row is None:
        raise KeyError("Licentie niet gevonden.")
    return public_record(row)


def list_licenses(database_path: Path = DEFAULT_DATABASE_PATH) -> list[dict[str, Any]]:
    connection = connect_database_readonly(Path(database_path))
    try:
        rows = connection.execute(
            "SELECT * FROM licenses ORDER BY customer_id, created_at, license_id"
        ).fetchall()
    finally:
        connection.close()
    return [public_record(row) for row in rows]


def set_license_status(
    license_id: str,
    status: str,
    database_path: Path = DEFAULT_DATABASE_PATH,
    actor: str = "legacy-internal",
    reason: str = "Legacy internal programmatic operation",
) -> dict[str, Any]:
    normalized_actor = validate_audit_text(actor, "actor", 200)
    normalized_reason = validate_audit_text(reason, "reason", 1000)
    normalized_status = str(status or "").strip().lower()
    if normalized_status not in ALLOWED_STATUSES:
        raise ValueError("Ongeldige licentiestatus.")
    normalized_license_id = validate_nonempty(license_id, "license_id", 128)
    updated_at = iso_utc()
    connection = connect_database(Path(database_path))
    try:
        connection.execute("BEGIN IMMEDIATE")
        before = connection.execute(
            "SELECT * FROM licenses WHERE license_id = ?", (normalized_license_id,)
        ).fetchone()
        if before is None:
            raise KeyError("Licentie niet gevonden.")
        current_status = str(before["status"])
        if normalized_status == current_status:
            connection.rollback()
            return public_record(before)
        allowed_transitions = {
            "active": {"suspended", "revoked"},
            "suspended": {"active", "revoked"},
            "revoked": set(),
        }
        if normalized_status not in allowed_transitions[current_status]:
            raise ValueError("Deze licentiestatus kan niet meer worden gewijzigd.")
        revoked_at = updated_at if normalized_status == "revoked" else None
        connection.execute(
            "UPDATE licenses SET status = ?, updated_at = ?, revoked_at = ? WHERE license_id = ?",
            (normalized_status, updated_at, revoked_at, normalized_license_id),
        )
        revoked_token_count = 0
        if _device_security_tables_available(connection):
            cursor = connection.execute(
                """
                UPDATE device_access_tokens
                SET revoked_at = ?
                WHERE license_id = ? AND revoked_at IS NULL
                """,
                (updated_at, normalized_license_id),
            )
            revoked_token_count = max(0, int(cursor.rowcount))
        row = connection.execute(
            "SELECT * FROM licenses WHERE license_id = ?", (normalized_license_id,)
        ).fetchone()
        audit_after = dict(row) if row is not None else {}
        audit_after["revoked_token_count"] = revoked_token_count
        _write_license_audit(
            connection,
            {"active": "license_activated", "suspended": "license_suspended", "revoked": "license_revoked"}[normalized_status],
            normalized_actor,
            normalized_reason,
            normalized_license_id,
            before,
            audit_after,
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    if row is None:
        raise KeyError("Licentie niet gevonden.")
    return public_record(row)


def rotate_license(
    license_id: str,
    database_path: Path = DEFAULT_DATABASE_PATH,
    pepper_path: Path = DEFAULT_PEPPER_PATH,
    issued_credential: str | None = None,
    actor: str = "legacy-internal",
    reason: str = "Legacy internal programmatic operation",
) -> tuple[dict[str, Any], str]:
    normalized_actor = validate_audit_text(actor, "actor", 200)
    normalized_reason = validate_audit_text(reason, "reason", 1000)
    normalized_license_id = validate_nonempty(license_id, "license_id", 128)
    credential = normalize_credential(issued_credential) if issued_credential is not None else generate_credential()
    digest = credential_hash(credential, pepper_path)
    rotated_at = iso_utc()
    connection = connect_database(Path(database_path))
    try:
        connection.execute("BEGIN IMMEDIATE")
        before = connection.execute(
            "SELECT * FROM licenses WHERE license_id = ?", (normalized_license_id,)
        ).fetchone()
        if before is None:
            raise KeyError("Licentie niet gevonden.")
        if before["status"] == "revoked":
            raise ValueError("Een ingetrokken licentie kan geen nieuwe code krijgen.")
        connection.execute(
            """
            UPDATE licenses
            SET credential_hash = ?, credential_version = credential_version + 1,
                rotated_at = ?, updated_at = ?
            WHERE license_id = ?
            """,
            (digest, rotated_at, rotated_at, normalized_license_id),
        )
        revoked_device_count = 0
        revoked_token_count = 0
        if _device_security_tables_available(connection):
            device_cursor = connection.execute(
                """
                UPDATE devices
                SET status = 'revoked', updated_at = ?,
                    revoked_at = COALESCE(revoked_at, ?),
                    reset_generation = reset_generation + 1
                WHERE license_id = ? AND status IN ('active', 'suspended')
                """,
                (rotated_at, rotated_at, normalized_license_id),
            )
            revoked_device_count = max(0, int(device_cursor.rowcount))
            token_cursor = connection.execute(
                """
                UPDATE device_access_tokens
                SET revoked_at = ?
                WHERE license_id = ? AND revoked_at IS NULL
                """,
                (rotated_at, normalized_license_id),
            )
            revoked_token_count = max(0, int(token_cursor.rowcount))
        row = connection.execute("SELECT * FROM licenses WHERE license_id = ?", (normalized_license_id,)).fetchone()
        audit_after = dict(row) if row is not None else {}
        audit_after["revoked_device_count"] = revoked_device_count
        audit_after["revoked_token_count"] = revoked_token_count
        _write_license_audit(
            connection,
            "license_rotated",
            normalized_actor,
            normalized_reason,
            normalized_license_id,
            before,
            audit_after,
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    if row is None:
        raise KeyError("Licentie niet gevonden.")
    return public_record(row), credential


def update_license(
    license_id: str,
    plan: str,
    rights: Any,
    max_devices: int,
    expires_at: str | None,
    database_path: Path = DEFAULT_DATABASE_PATH,
    actor: str = "legacy-internal",
    reason: str = "Legacy internal programmatic operation",
) -> dict[str, Any]:
    normalized_actor = validate_audit_text(actor, "actor", 200)
    normalized_reason = validate_audit_text(reason, "reason", 1000)
    normalized_license_id = validate_nonempty(license_id, "license_id", 128)
    normalized_plan = normalize_plan(plan)
    normalized_rights = normalize_rights(rights)
    normalized_expires_at = parse_timestamp(expires_at, "expires_at")
    device_limit = int(max_devices)
    if device_limit < 0:
        raise ValueError("max_devices mag niet negatief zijn.")
    updated_at = iso_utc()
    connection = connect_database(Path(database_path))
    try:
        connection.execute("BEGIN IMMEDIATE")
        before = connection.execute(
            "SELECT * FROM licenses WHERE license_id = ?", (normalized_license_id,)
        ).fetchone()
        if before is None:
            raise KeyError("Licentie niet gevonden.")
        if before["status"] == "revoked":
            raise ValueError("Een ingetrokken licentie kan niet worden aangepast.")
        if before["duration_days"] is not None:
            normalized_expires_at = before["expires_at"]
        if before["starts_at"] and normalized_expires_at and before["starts_at"] >= normalized_expires_at:
            raise ValueError("expires_at moet na starts_at liggen.")
        allocated = _allocated_device_count(connection, normalized_license_id)
        if device_limit < allocated:
            raise ValueError(
                f"max_devices mag niet lager zijn dan de {allocated} gekoppelde computers."
            )
        connection.execute(
            """
            UPDATE licenses
            SET plan=?, rights_json=?, max_devices=?, expires_at=?, updated_at=?
            WHERE license_id=?
            """,
            (
                normalized_plan,
                json.dumps(normalized_rights, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                device_limit,
                normalized_expires_at,
                updated_at,
                normalized_license_id,
            ),
        )
        row = connection.execute(
            "SELECT * FROM licenses WHERE license_id = ?", (normalized_license_id,)
        ).fetchone()
        _write_license_audit(
            connection,
            "license_updated",
            normalized_actor,
            normalized_reason,
            normalized_license_id,
            before,
            row,
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    if row is None:
        raise KeyError("Licentie niet gevonden.")
    return public_record(row)


def list_license_audit(
    database_path: Path = DEFAULT_DATABASE_PATH,
    license_id: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    parameters: list[Any] = []
    where = ""
    if license_id:
        where = " WHERE license_id = ?"
        parameters.append(validate_nonempty(license_id, "license_id", 128))
    bounded_limit = max(1, min(int(limit), 1000))
    connection = connect_database_readonly(Path(database_path))
    try:
        rows = connection.execute(
            f"SELECT * FROM license_audit_log{where} ORDER BY audit_id DESC LIMIT ?",
            (*parameters, bounded_limit),
        ).fetchall()
    finally:
        connection.close()
    result: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["before"] = json.loads(item.pop("before_json") or "{}")
        item["after"] = json.loads(item.pop("after_json") or "{}")
        result.append(item)
    return result


def registry_health(
    database_path: Path = DEFAULT_DATABASE_PATH,
    pepper_path: Path = DEFAULT_PEPPER_PATH,
) -> dict[str, Any]:
    database = Path(database_path)
    pepper = Path(pepper_path)
    result: dict[str, Any] = {
        "ready": False,
        "schema_version": 0,
        "database_exists": database.exists(),
        "pepper_exists": pepper.exists(),
    }
    if not database.exists() or not pepper.exists():
        return result
    try:
        connection = connect_database_readonly(database)
        try:
            version = int(connection.execute("PRAGMA user_version").fetchone()[0])
            connection.execute("SELECT license_id, duration_days FROM licenses LIMIT 1").fetchone()
            connection.execute("SELECT audit_id FROM license_audit_log LIMIT 1").fetchone()
        finally:
            connection.close()
        result["schema_version"] = version
        result["ready"] = version == SCHEMA_VERSION and len(pepper.read_bytes()) >= 32
    except Exception:
        result["ready"] = False
    return result
