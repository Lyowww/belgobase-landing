from __future__ import annotations

import datetime as dt
import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Protocol


@dataclass(frozen=True)
class LicenseRecord:
    license_id: str
    customer_id: str
    support_email: str
    status: str
    plan: str
    rights: dict[str, Any]
    max_devices: int
    starts_at: str | None = None
    expires_at: str | None = None

    def is_active(self, now: dt.datetime) -> bool:
        current = now.astimezone(dt.timezone.utc)
        if self.status != "active":
            return False
        if self.starts_at and current < _timestamp(self.starts_at):
            return False
        if self.expires_at and current >= _timestamp(self.expires_at):
            return False
        return True


def _timestamp(value: str) -> dt.datetime:
    parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


class LicenseRegistry(Protocol):
    def validate_claim(self, license_code: str, now: dt.datetime) -> LicenseRecord: ...

    def get_license(self, license_id: str, now: dt.datetime) -> LicenseRecord: ...

    def count_windows_allocated(
        self, license_id: str, *, connection: sqlite3.Connection | None = None
    ) -> int: ...


class BelgoBaseLicenseRegistry:
    """Read the existing licence/customer truth without copying credentials.

    ``credential_validator`` should be the deployed
    ``belgobase_license_registry_42a.validate_credential`` bound to its existing
    database and pepper paths.  It returns the public licence projection and
    never exposes the stored credential hash.
    """

    def __init__(
        self,
        database_path: Path,
        credential_validator: Callable[..., dict[str, Any]],
    ) -> None:
        self.database_path = Path(database_path).resolve()
        self.credential_validator = credential_validator

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=15000")
        return connection

    def _record(self, row: sqlite3.Row) -> LicenseRecord:
        rights = json.loads(row["rights_json"] or "{}")
        license_id = str(row["license_id"] or "").strip()
        customer_id = str(row["customer_id"] or "").strip()
        support_email = str(row["support_email"] or "").strip().lower()
        if not license_id or not customer_id or "@" not in support_email:
            raise LookupError("license_identity_not_available")
        if not isinstance(rights, dict):
            raise LookupError("license_rights_not_available")
        return LicenseRecord(
            license_id=license_id,
            customer_id=customer_id,
            support_email=support_email,
            status=str(row["status"]),
            plan=str(row["plan"]),
            rights=rights,
            max_devices=int(row["max_devices"]),
            starts_at=row["starts_at"],
            expires_at=row["expires_at"],
        )

    def get_license(self, license_id: str, now: dt.datetime) -> LicenseRecord:
        connection = self._connect()
        try:
            row = connection.execute(
                """
                SELECT l.license_id, l.customer_id, l.status, l.plan,
                       l.rights_json, l.max_devices, l.starts_at, l.expires_at,
                       p.support_email
                FROM licenses l
                INNER JOIN license_customer_profiles p ON p.license_id=l.license_id
                WHERE l.license_id=?
                """,
                (str(license_id),),
            ).fetchone()
        finally:
            connection.close()
        if row is None:
            raise LookupError("license_not_available")
        return self._record(row)

    def validate_claim(self, license_code: str, now: dt.datetime) -> LicenseRecord:
        projection = self.credential_validator(str(license_code), now=now)
        license_id = str(projection.get("license_id") or "")
        if not license_id:
            raise LookupError("license_not_available")
        record = self.get_license(license_id, now)
        if not record.is_active(now):
            raise LookupError("license_not_available")
        return record

    def count_windows_allocated(
        self, license_id: str, *, connection: sqlite3.Connection | None = None
    ) -> int:
        owned = connection is None
        current = connection or self._connect()
        try:
            row = current.execute(
                """SELECT COUNT(*) AS amount FROM devices
                   WHERE license_id=? AND status IN ('active','suspended')""",
                (str(license_id),),
            ).fetchone()
            return int(row["amount"] if isinstance(row, sqlite3.Row) else row[0])
        finally:
            if owned:
                current.close()
