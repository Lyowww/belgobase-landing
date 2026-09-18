"""Local unit tests for the bounded remote web patch; no VPS connection is used."""
from __future__ import annotations

import base64
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest


MODULE_PATH = Path(__file__).with_name("deploy_web_core_patch.py")
SPEC = importlib.util.spec_from_file_location("deploy_web_core_patch", MODULE_PATH)
assert SPEC and SPEC.loader
PATCH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PATCH)


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


class FakeTask:
    def __init__(self, state: int):
        self.State = state


class FakeMutex:
    def Close(self):
        pass


class RemotePatchHarness:
    def __init__(self, root: Path, *, daily_state: int = 3, fail_write: int | None = None):
        self.root = root
        self.daily = FakeTask(daily_state)
        self.api = FakeTask(4)
        self.fail_write = fail_write
        self.writes = 0
        self.stops = 0
        self.starts = 0
        self.cutover = root / "cutover.py"
        self.cutover.write_bytes(b"cutover")
        (root / "backups").mkdir(exist_ok=True)

    def run(self, contract: dict) -> str:
        fake_win32event = types.SimpleNamespace(
            WAIT_OBJECT_0=0,
            WAIT_ABANDONED=0x80,
            CreateMutex=lambda *_: FakeMutex(),
            WaitForSingleObject=lambda *_: 0,
            ReleaseMutex=lambda *_: None,
        )
        old_module = sys.modules.get("win32event")
        sys.modules["win32event"] = fake_win32event

        def need(condition, message):
            if not condition:
                raise AssertionError(message)

        def task(_service, name, *_args):
            return self.daily if name == "daily" else self.api

        def atomic_write(target, raw):
            self.writes += 1
            if self.fail_write == self.writes:
                raise OSError("simulated atomic write failure")
            Path(target).write_bytes(raw)

        def stop_task(*_args):
            self.stops += 1
            self.api.State = 3

        def start_task(*_args):
            self.starts += 1
            self.api.State = 4

        def request(_port, method, path):
            if method == "GET" and path == "/health":
                return 200, {"ok": True}
            if method == "GET" and path == "/web/auth/session":
                return 401, {"error": "session_invalid"}
            raise AssertionError(f"unexpected request {method} {path}")

        scope = {
            "CONTRACT": contract,
            "SERVER_ROOT": self.root,
            "PIPELINE_ROOT": self.root,
            "BACKUP_ROOT": self.root / "backups",
            "CUTOVER": self.cutover,
            "CUTOVER_PATCHED_SHA256": digest(self.cutover.read_bytes()),
            "DAILY_TASK": "daily",
            "API_TASK": "api",
            "MAINTENANCE_MUTEX": "BelgoBaseWebPatchTest",
            "SERVER_WRAPPER": self.root / "wrapper.py",
            "API_PORT": 9999,
            "sha": lambda path: digest(Path(path).read_bytes()),
            "need": need,
            "scheduler": lambda: object(),
            "task": task,
            "verify_listener": lambda *_args: None,
            "atomic_write": atomic_write,
            "stop_task": stop_task,
            "start_task": start_task,
            "request": request,
        }
        stdout = io.StringIO()
        try:
            with contextlib.redirect_stdout(stdout):
                exec(PATCH.REMOTE, scope)
        finally:
            if old_module is None:
                sys.modules.pop("win32event", None)
            else:
                sys.modules["win32event"] = old_module
        return stdout.getvalue()


class DeployWebCorePatchRemoteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.backend = self.root / "backend"
        self.backend.mkdir()
        self.before_core = b"CORE = 'before'\n"
        self.before_workspace = b"WORKSPACE = 'before'\n"
        (self.backend / "web_core.py").write_bytes(self.before_core)
        (self.backend / "web_workspace.py").write_bytes(self.before_workspace)

    def tearDown(self):
        self.temp.cleanup()

    def contract(self, action="deploy", include_workspace=False):
        files = {"web_core.py": {"expected": digest(self.before_core), "source": base64.b64encode(b"CORE = 'after'\n").decode()}}
        if include_workspace:
            files["web_workspace.py"] = {"expected": digest(self.before_workspace), "source": base64.b64encode(b"WORKSPACE = 'after'\n").decode()}
        return {"files": files, "action": action}

    def test_preflight_reports_hashes_without_writing(self):
        harness = RemotePatchHarness(self.root)
        output = harness.run(self.contract(action="preflight", include_workspace=True))
        result = json.loads(output)
        self.assertEqual(result["status"], "PREFLIGHT_OK")
        self.assertFalse(result["changed"])
        self.assertEqual((self.backend / "web_core.py").read_bytes(), self.before_core)
        self.assertEqual((self.backend / "web_workspace.py").read_bytes(), self.before_workspace)
        self.assertEqual(harness.writes, 0)

    def test_preflight_rejects_drift_before_any_mutation(self):
        (self.backend / "web_core.py").write_bytes(b"CORE = 'drifted'\n")
        harness = RemotePatchHarness(self.root)
        with self.assertRaisesRegex(AssertionError, "preimage_drift:web_core.py"):
            harness.run(self.contract(action="preflight"))
        self.assertEqual((self.backend / "web_core.py").read_bytes(), b"CORE = 'drifted'\n")
        self.assertEqual(harness.writes, 0)

    def test_deploy_publishes_core_and_optional_workspace_together(self):
        harness = RemotePatchHarness(self.root)
        output = harness.run(self.contract(include_workspace=True))
        result = json.loads(output)
        self.assertEqual(result["status"], "DEPLOYED")
        self.assertEqual((self.backend / "web_core.py").read_bytes(), b"CORE = 'after'\n")
        self.assertEqual((self.backend / "web_workspace.py").read_bytes(), b"WORKSPACE = 'after'\n")
        self.assertEqual(harness.stops, 1)
        self.assertEqual(harness.starts, 1)
        self.assertEqual(harness.api.State, 4)

    def test_failed_second_write_restores_both_preimages_and_api(self):
        harness = RemotePatchHarness(self.root, fail_write=2)
        with self.assertRaisesRegex(OSError, "simulated atomic write failure"):
            harness.run(self.contract(include_workspace=True))
        self.assertEqual((self.backend / "web_core.py").read_bytes(), self.before_core)
        self.assertEqual((self.backend / "web_workspace.py").read_bytes(), self.before_workspace)
        self.assertEqual(harness.api.State, 4)
        self.assertGreaterEqual(harness.starts, 1)

    def test_deploy_refuses_when_daily_task_is_running(self):
        harness = RemotePatchHarness(self.root, daily_state=4)
        with self.assertRaisesRegex(AssertionError, "daily_not_idle"):
            harness.run(self.contract(include_workspace=True))
        self.assertEqual((self.backend / "web_core.py").read_bytes(), self.before_core)
        self.assertEqual((self.backend / "web_workspace.py").read_bytes(), self.before_workspace)
        self.assertEqual(harness.writes, 0)
        self.assertEqual(harness.stops, 0)


if __name__ == "__main__":
    unittest.main()
