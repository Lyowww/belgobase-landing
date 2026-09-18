from __future__ import annotations

import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


local = load("deploy_web_runtime", ROOT / "tools" / "deploy_web_runtime.py")
remote = load("deploy_web_runtime_remote", ROOT / "tools" / "deploy_web_runtime_remote.py")


class DeploymentToolTests(unittest.TestCase):
    def test_bundle_is_manifest_bound_and_contains_only_deployable_files(self):
        raw, contract = local.build_bundle()
        self.assertEqual(len(raw), contract["bundle_size"])
        self.assertEqual(local.sha256_bytes(raw), contract["bundle_sha256"])
        self.assertIn("server/30b_belgobase_windows_vps_api_server.py", contract["file_sha256"])
        self.assertIn("server/backend/runtime.py", contract["file_sha256"])
        self.assertIn("account/belgobase_web_enrollment_1a.py", contract["file_sha256"])
        self.assertIn("pipeline/daily_api_maintenance_dual_cutover.py", contract["file_sha256"])
        self.assertFalse(any(name.endswith(".patch") for name in contract["file_sha256"]))

    def test_daily_cutover_wait_is_bounded_and_timeout_still_fails_closed(self):
        files, _manifests = local.candidate_files()
        source = files["pipeline/daily_api_maintenance_dual_cutover.py"].decode("utf-8")
        self.assertIn("win32event.WaitForSingleObject(mutex, 600000)", source)
        self.assertNotIn("win32event.WaitForSingleObject(mutex, 0)", source)
        self.assertIn('need(acquired, "deployment_mutex_busy")', source)
        self.assertIn("win32event.WAIT_OBJECT_0, win32event.WAIT_ABANDONED", source)

    def test_serialized_restart_rejects_phase_switch_and_hash_drift(self):
        ready = remote.CUTOVER_PATCHED_SHA256
        patchable = remote.CUTOVER_PREIMAGE_SHA256
        self.assertTrue(remote.serialized_restart_safe("idle", patchable, False))
        self.assertTrue(remote.serialized_restart_safe("running_31h", ready, True))
        self.assertFalse(remote.serialized_restart_safe("running_31h", ready, False))
        self.assertFalse(remote.serialized_restart_safe("running_other_stage", ready, True))
        self.assertFalse(remote.serialized_restart_safe("idle", "0" * 64, False))

    def test_wrappers_preserve_existing_launch_and_add_only_web_settings(self):
        server = (ROOT / ".local" / "launch_preimage" / "run_30b_api_task.cmd").read_text(encoding="utf-8-sig")
        account = (ROOT / ".local" / "launch_preimage" / "run_account_service_task.cmd").read_text(encoding="utf-8-sig")
        server_result = remote.patch_server_wrapper(server)
        account_result = remote.patch_account_wrapper(account)
        self.assertIn("BELGOBASE_WEB_ENABLED=1", server_result)
        self.assertIn("BELGOBASE_WEB_MAIL_RELAY_URL=https://www.belgobase.com/api/web/mail", server_result)
        self.assertIn("BELGOBASE_AI_KEY_FILE", server_result)
        self.assertIn("BELGOBASE_ACCOUNT_INTERNAL_PROOF_FILE", account_result)
        self.assertIn("BELGOBASE_ACCEPTANCE_SIGNING_KEY", account_result)
        with self.assertRaisesRegex(Exception, "already_has_web_config"):
            remote.patch_server_wrapper(server_result)

    def test_internal_proof_requires_printable_ascii_header_token(self):
        remote.validate_internal_proof(b"A" * 64)
        for invalid in (b"A" * 31, b" A" * 32, b"A" * 63 + b"\n", b"A" * 32 + b"\xff"):
            with self.subTest(invalid=repr(invalid)):
                with self.assertRaises(remote.DeployError):
                    remote.validate_internal_proof(invalid)

    def test_projection_canary_selects_only_active_receipted_profile(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "licenses.sqlite3"
            connection = sqlite3.connect(database)
            connection.executescript(
                """CREATE TABLE licenses(
                       license_id TEXT PRIMARY KEY,customer_id TEXT,status TEXT,
                       starts_at TEXT,expires_at TEXT
                   );
                   CREATE TABLE license_customer_profiles(
                       license_id TEXT PRIMARY KEY,support_email TEXT
                   );
                   CREATE TABLE web_legal_acceptance_receipts(license_id TEXT);
                   CREATE TABLE legal_acceptance_receipts(license_id TEXT);
                   CREATE TABLE text_legal_acceptance_receipts(license_id TEXT);
                   INSERT INTO licenses VALUES('inactive','c0','revoked',NULL,NULL);
                   INSERT INTO license_customer_profiles VALUES('inactive','old@example.invalid');
                   INSERT INTO web_legal_acceptance_receipts VALUES('inactive');
                   INSERT INTO licenses VALUES('active','c1','active',NULL,NULL);
                   INSERT INTO license_customer_profiles VALUES('active','user@example.invalid');
                   INSERT INTO text_legal_acceptance_receipts VALUES('active');"""
            )
            connection.commit()
            connection.close()
            identity = remote.projection_canary_identity(database)
        self.assertEqual(
            identity,
            {
                "principal_type": "web",
                "license_id": "active",
                "customer_id": "c1",
                "email": "user@example.invalid",
            },
        )


if __name__ == "__main__":
    unittest.main()
