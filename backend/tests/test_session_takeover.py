"""Regression contract for one authenticated owner across web and Windows."""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import importlib.util
import sys
import tempfile
import unittest
import uuid
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


ROOT = Path(__file__).resolve().parents[2]
TAKEOVER = ROOT / "tools" / "session_takeover_payloads"
ACCOUNT_PREIMAGE = ROOT / "backend" / "tests" / "fixtures" / "session_takeover"
for location in (str(ROOT), str(ACCOUNT_PREIMAGE)):
    if location not in sys.path:
        sys.path.insert(0, location)

from backend.registry import LicenseRecord
from backend.web_auth import AuthError, WebAuthConfig, WebAuthService
import belgobase_device_protocol_43a as protocol
import belgobase_license_registry_42a as licenses


def load_candidate(name: str):
    path = TAKEOVER / name
    spec = importlib.util.spec_from_file_location("session_takeover_" + name[:-3], path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


class Identity:
    def __init__(self, marker: str) -> None:
        self.private_key = Ed25519PrivateKey.generate()
        self.public_key = b64url(self.private_key.public_key().public_bytes(
            encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw,
        ))
        self.device_id = str(uuid.uuid4())
        self.machine_hash = hashlib.sha256(f"machine-{marker}".encode()).hexdigest()
        self.credential = "BD3-" + marker * 43

    def sign(self, message: bytes) -> str:
        return b64url(self.private_key.sign(message))


class Mailbox:
    def __init__(self) -> None:
        self.code = ""

    def send_login_code(self, *, code: str, **_values: object) -> None:
        self.code = code


class StaticRegistry:
    def __init__(self, record: LicenseRecord) -> None:
        self.record = record

    def get_license(self, license_id: str, _now: dt.datetime) -> LicenseRecord:
        if license_id != self.record.license_id:
            raise LookupError("license_not_found")
        return self.record

    def find_active_profile_licenses(self, email: str, _now: dt.datetime) -> tuple[LicenseRecord, ...]:
        return (self.record,) if email == self.record.support_email else ()


class SessionTakeoverTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="bb_session_takeover_")
        self.root = Path(self.temp.name)
        self.database = self.root / "state.sqlite3"
        self.pepper = self.root / "pepper.bin"
        self.pepper.write_bytes(hashlib.sha256(b"takeover-pepper").digest())
        self.now = dt.datetime(2026, 9, 20, tzinfo=dt.timezone.utc)
        self.nonce_number = 0

    def tearDown(self) -> None:
        self.temp.cleanup()

    def nonce(self, label: str) -> str:
        self.nonce_number += 1
        return f"{label}-{self.nonce_number}-{uuid.uuid4().hex}"

    def create_license(self, marker: str) -> tuple[dict, str, LicenseRecord]:
        module = load_candidate("server_devices.py")
        module.initialize_device_registry(self.database, self.pepper)
        record, code = licenses.create_license(
            customer_id=f"customer-takeover-{marker}", customer_name="Takeover customer",
            contract_id=f"takeover-contract-{marker}", plan="full", rights={"scopes": ["data.read"]},
            max_devices=1, issued_credential="BB2-" + marker * 43,
            database_path=self.database, pepper_path=self.pepper,
            actor="test", reason="synthetic takeover test",
        )
        web_record = LicenseRecord(
            license_id=record["license_id"], customer_id=f"customer-takeover-{marker}",
            support_email=f"owner-{marker.lower()}@example.test", status="active", plan="full",
            rights={"scopes": ["data.read"]}, max_devices=1,
        )
        return record, code, web_record

    def activation(self, code: str, identity: Identity, label: str) -> dict:
        timestamp = int(self.now.timestamp())
        nonce = self.nonce(label)
        message = protocol.activation_message(code, identity.device_id, identity.public_key,
            identity.machine_hash, identity.credential, nonce, timestamp)
        return {"license_code": code, "device_id": identity.device_id,
                "public_key": identity.public_key, "machine_fingerprint_hash": identity.machine_hash,
                "device_credential": identity.credential, "client_nonce": nonce,
                "client_timestamp": timestamp, "signature": identity.sign(message),
                "device_name": "Takeover test", "client_version": "test"}

    def renewal(self, identity: Identity, label: str) -> dict:
        timestamp = int(self.now.timestamp())
        nonce = self.nonce(label)
        message = protocol.token_message(identity.device_id, identity.machine_hash,
            identity.credential, nonce, timestamp)
        return {"device_id": identity.device_id, "machine_fingerprint_hash": identity.machine_hash,
                "device_credential": identity.credential, "client_nonce": nonce,
                "client_timestamp": timestamp, "signature": identity.sign(message)}

    def web_service(self, record: LicenseRecord) -> tuple[WebAuthService, Mailbox]:
        mailbox = Mailbox()
        return WebAuthService(WebAuthConfig(state_database=self.database, secret=b"x" * 32),
                              StaticRegistry(record), mailbox, clock=lambda: self.now), mailbox

    def test_verified_web_takeover_blocks_old_windows_token_until_explicit_reactivation(self) -> None:
        for candidate_name, marker in (("server_devices.py", "L"), ("account_devices.py", "M")):
            with self.subTest(candidate=candidate_name):
                devices = load_candidate(candidate_name)
                record, code, web_record = self.create_license(marker)
                identity = Identity(marker)
                first = devices.activate_device(self.activation(code, identity, "first"), self.database,
                                                self.pepper, now=self.now, token_ttl_seconds=3600)
                old_token = first["access_token"]
                devices.validate_access_token(old_token, self.database, self.pepper, now=self.now)

                web, mailbox = self.web_service(web_record)
                challenge = web.start_login(web_record.support_email, remember_browser=False, source="test")
                with self.assertRaises(AuthError):
                    web.verify_code(challenge["challenge_id"], "000000")
                # An unverified/incorrect code must not evict the desktop owner.
                devices.validate_access_token(old_token, self.database, self.pepper, now=self.now)

                grant = web.verify_code(challenge["challenge_id"], mailbox.code, browser_label="New browser")
                with self.assertRaises(devices.DeviceAuthError):
                    devices.validate_access_token(old_token, self.database, self.pepper, now=self.now)
                with self.assertRaises(devices.DeviceAuthError):
                    devices.issue_access_token(self.renewal(identity, "blocked"), self.database,
                                               self.pepper, now=self.now, token_ttl_seconds=3600)

                # Same device plus explicit product code transfers ownership without a new device seat.
                reclaimed = devices.activate_device(self.activation(code, identity, "reclaim"), self.database,
                                                    self.pepper, now=self.now, token_ttl_seconds=3600)
                devices.validate_access_token(reclaimed["access_token"], self.database, self.pepper, now=self.now)
                with self.assertRaises(AuthError):
                    web.validate_session(grant.token)
                connection = licenses.connect_database(self.database)
                try:
                    count = connection.execute(
                        "SELECT COUNT(*) FROM devices WHERE license_id=? AND status IN ('active','suspended')",
                        (record["license_id"],),
                    ).fetchone()[0]
                finally:
                    connection.close()
                self.assertEqual(1, count)


if __name__ == "__main__":
    unittest.main()
