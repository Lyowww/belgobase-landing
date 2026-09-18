from __future__ import annotations

import sqlite3


def count_web_allocated(
    connection: sqlite3.Connection, license_id: str, now_iso: str
) -> int:
    table = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='web_browsers'"
    ).fetchone()
    if table is None:
        return 0
    row = connection.execute(
        """SELECT COUNT(*)
           FROM web_browsers b
           JOIN web_memberships m ON m.membership_id=b.membership_id
           WHERE m.license_id=? AND m.status='active'
             AND b.status='active' AND b.expires_at>?""",
        (str(license_id), str(now_iso)),
    ).fetchone()
    return int(row[0])


def count_all_allocated(
    connection: sqlite3.Connection,
    license_id: str,
    now_iso: str,
    *,
    exclude_device_id: str | None = None,
) -> int:
    if exclude_device_id is None:
        row = connection.execute(
            """SELECT COUNT(*) FROM devices
               WHERE license_id=? AND status IN ('active','suspended')""",
            (str(license_id),),
        ).fetchone()
    else:
        row = connection.execute(
            """SELECT COUNT(*) FROM devices
               WHERE license_id=? AND status IN ('active','suspended') AND device_id<>?""",
            (str(license_id), str(exclude_device_id)),
        ).fetchone()
    return int(row[0]) + count_web_allocated(connection, license_id, now_iso)
