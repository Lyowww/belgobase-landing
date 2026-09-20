"""One authenticated session owner per licence; device identities are retained.

Call takeover only within the caller's authenticated BEGIN IMMEDIATE transaction.
Token refresh never transfers ownership. No email or credential is stored here.
"""
import sqlite3
from pathlib import Path


def initialize(connection: sqlite3.Connection) -> None:
    connection.execute("""CREATE TABLE IF NOT EXISTS license_session_owner (
        license_id TEXT PRIMARY KEY, principal TEXT NOT NULL, updated_at TEXT NOT NULL
    )""")


def permitted(connection: sqlite3.Connection, license_id: str, principal: str) -> bool:
    table = connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='license_session_owner'").fetchone()
    if table is None:
        return True  # Existing sessions migrate on their next explicit login.
    row = connection.execute("SELECT principal FROM license_session_owner WHERE license_id=?", (license_id,)).fetchone()
    return row is None or row[0] == principal


def takeover(connection: sqlite3.Connection, license_id: str, principal: str, now: str) -> None:
    if not connection.in_transaction:
        raise RuntimeError("session takeover requires an existing transaction")
    if Path(__file__).with_suffix(".pending").exists():
        raise RuntimeError("Session switch temporarily unavailable during deployment")
    initialize(connection)
    tables = {r[0] for r in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if {'web_browsers', 'web_memberships', 'web_sessions'} <= tables:
        browser = principal[4:] if principal.startswith('web:') else ''
        args = (now, license_id, browser)
        connection.execute("""UPDATE web_sessions SET revoked_at=? WHERE revoked_at IS NULL
            AND browser_id IN (SELECT b.browser_id FROM web_browsers b
            JOIN web_memberships m ON m.membership_id=b.membership_id
            WHERE m.license_id=? AND b.browser_id<>?)""", args)
        connection.execute("""UPDATE web_browsers SET status='revoked',revoked_at=?
            WHERE status='active' AND membership_id IN
            (SELECT membership_id FROM web_memberships WHERE license_id=?) AND browser_id<>?""", args)
    if 'device_access_tokens' in tables:
        connection.execute("UPDATE device_access_tokens SET revoked_at=? WHERE license_id=? AND revoked_at IS NULL", (now, license_id))
    connection.execute("""INSERT INTO license_session_owner(license_id,principal,updated_at) VALUES(?,?,?)
        ON CONFLICT(license_id) DO UPDATE SET principal=excluded.principal,updated_at=excluded.updated_at""",
        (license_id, principal, now))
