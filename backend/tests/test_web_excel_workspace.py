from __future__ import annotations

import base64
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path

from backend.web_excel_workspace import CHUNK_BYTES, WebExcelWorkspace
from backend.web_workspace import AuthContext, WorkspaceError


class FakeAnalysis:
    def __init__(self) -> None:
        self.paths: list[str] = []
        self.state = "idle"
        self.analysis_id = "a" * 64

    def select_files(self, paths):
        raw = [Path(path).read_bytes() for path in paths]
        if any(value == b"bad" for value in raw):
            raise ValueError("Bestand geweigerd door parser.")
        self.paths = list(paths)
        self.state = "ready"
        return {"count": len(paths), "files": [{"name": Path(path).name} for path in paths]}

    def start(self):
        self.state = "complete"
        return self.status()

    def status(self):
        return {"state": self.state, "analysis_id": self.analysis_id,
                "summary": {"partial": False}}

    def cancel(self):
        self.state = "cancelled"
        return self.status()

    def export(self, path, candidate_ids=None):
        Path(path).write_bytes(b"xlsx-full:" + ",".join(candidate_ids or []).encode())
        return {"path": path, "count": len(candidate_ids or [1, 2])}

    def export_call_list(self, path, candidate_ids):
        Path(path).write_bytes(b"xlsx-call:" + ",".join(candidate_ids).encode())
        return {"path": path, "count": len(candidate_ids)}


class RunningAnalysis(FakeAnalysis):
    release = threading.Event()

    def start(self):
        self.state = "running"
        self._thread = threading.Thread(target=self._finish, daemon=True)
        self._thread.start()
        return self.status()

    def _finish(self):
        self.release.wait(5)
        self.state = "complete"


class LargeCallAnalysis(FakeAnalysis):
    def export_call_list(self, path, candidate_ids):
        Path(path).write_bytes(b"x" * 2_400_000)
        return {"path": path, "count": len(candidate_ids)}


class PathLeakAnalysis(FakeAnalysis):
    def select_files(self, paths):
        raise OSError(r"C:\BelgoBase_App\web_workspace\tenant-secret\klant.xlsx")


class TooManyAnalysis(FakeAnalysis):
    def export(self, path, candidate_ids=None):
        Path(path).write_bytes(b"xlsx")
        return {"path": path, "count": 5001}


class FakeWorkflow:
    def __init__(self, analysis, cloud, cache_path=None) -> None:
        self.analysis = analysis
        self.cloud = cloud
        self.cache_path = cache_path
        self.confirmed = False
        self.handoff = None
        self.handoff_rows = set()
        self.preparation = None

    def state(self):
        if self.analysis.state != "complete":
            raise ValueError("Rond eerst het inlezen van je lijsten af.")
        return {"analysis_id": self.analysis.analysis_id, "phase": "ranked",
                "profile": {"version": "v1", "confirmed": True, "criteria": [{"field": "city", "value": "Gent"}]}}

    def start_profile(self, context):
        return {"phase": "analysing", "business_context": context}

    def stop(self):
        return {"phase": "split"}

    def confirm(self, analysis_id, version):
        self.confirmed = analysis_id == self.analysis.analysis_id and version == "v1"
        return self.state()

    def cohort(self, name):
        if name == "priority":
            return [
                {"id": "C000001", "enterprise_number": "0123456789", "name": "Zoekbaar", "street": "Markt",
                 "house_number": "1", "postcode": "9000", "city": "Gent", "website": "", "phones": []},
                {"id": "C000002", "enterprise_number": "", "name": "Bestaand", "street": "", "house_number": "",
                 "postcode": "", "city": "", "website": "", "phones": ["+3212345678"]},
                {"id": "C000003", "enterprise_number": "", "name": "Onbruikbaar", "street": "", "house_number": "",
                 "postcode": "", "city": "", "website": "", "phones": []},
            ]
        return [{"id": "C000004"}]

    def save_checkpoint(self):
        return None


class WebExcelWorkspaceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.calls = []
        self.finish_count = 1
        self.reserve_calls = []

        def cloud(command, request_id, auth):
            self.calls.append((dict(command), request_id, auth.tenant_key))
            operation = command.get("operation")
            if operation == "upload_begin":
                return {"numberfinder": {"upload_id": "f" * 32, "offset": 0}}
            if operation == "upload_chunk":
                size = len(base64.b64decode(command["data"]))
                return {"numberfinder": {"offset": command["offset"] + size}}
            if operation == "upload_finish":
                return {"numberfinder": {"status": 200, "body": {"count": self.finish_count}}}
            return {"ok": True}

        root = Path(self.temp.name)
        self.service = WebExcelWorkspace(root / "state", root / "downloads", cloud,
                                         analysis_factory=FakeAnalysis, workflow_factory=FakeWorkflow,
                                         export_reserver=lambda rows, auth: self.reserve_calls.append((rows, auth.tenant_key)) or rows)
        self.a = AuthContext("lic-a", "user-a", customer_id="customer-a")
        self.b = AuthContext("lic-b", "user-b", customer_id="customer-b")

    def upload(self, auth, raw=b"good", name="bron.xlsx", purpose="source"):
        begun = self.service.execute("local_excel_upload_begin",
                                     {"name": name, "size": len(raw), "purpose": purpose}, auth)
        offset = 0
        while offset < len(raw):
            part = raw[offset:offset + CHUNK_BYTES]
            chunk = {"batch_id": begun["batch_id"], "upload_id": begun["upload_id"], "offset": offset,
                     "data": base64.b64encode(part).decode()}
            sent = self.service.execute("local_excel_upload_chunk", chunk, auth)
            self.assertEqual(offset + len(part), sent["offset"])
            # Exact retry is accepted and does not duplicate bytes.
            self.assertEqual(offset + len(part), self.service.execute("local_excel_upload_chunk", chunk, auth)["offset"])
            offset += len(part)
        self.service.execute("local_excel_upload_finish",
                             {"batch_id": begun["batch_id"], "upload_id": begun["upload_id"]}, auth)
        return begun

    def test_atomic_upload_normal_empty_error_and_tenant_isolation(self):
        begun = self.upload(self.a)
        committed = self.service.execute("local_excel_upload_commit", {"batch_id": begun["batch_id"]}, self.a)
        self.assertEqual(1, committed["preview"]["count"])
        self.assertEqual("complete", self.service.execute("local_excel_start", {}, self.a)["status"]["state"])
        with self.assertRaisesRegex(WorkspaceError, "Kies eerst"):
            self.service.execute("local_excel_status", {}, self.b)

        cancelled = self.upload(self.a, b"later", "later.xlsx")
        self.assertTrue(self.service.execute("local_excel_upload_cancel", {"batch_id": cancelled["batch_id"]}, self.a)["cancelled"])
        self.assertEqual("complete", self.service.execute("local_excel_status", {}, self.a)["status"]["state"])

        rejected = self.upload(self.a, b"bad", "fout.xlsx")
        with self.assertRaisesRegex(WorkspaceError, "kon niet worden voltooid"):
            self.service.execute("local_excel_upload_commit", {"batch_id": rejected["batch_id"]}, self.a)
        self.assertEqual("complete", self.service.execute("local_excel_status", {}, self.a)["status"]["state"])
        with self.assertRaisesRegex(WorkspaceError, "xlsx"):
            self.service.execute("local_excel_upload_begin", {"name": "bron.csv", "size": 3, "purpose": "source"}, self.a)

        large = self.upload(self.b, b"x" * (CHUNK_BYTES + 1), "groot.xlsx")
        self.assertEqual(1, self.service.execute("local_excel_upload_commit", {"batch_id": large["batch_id"]}, self.b)["preview"]["count"])

        root = Path(self.temp.name)
        restarted = WebExcelWorkspace(root / "state", root / "downloads", self.service.cloud_dispatch,
                                      analysis_factory=FakeAnalysis, workflow_factory=FakeWorkflow,
                                      export_reserver=lambda rows, auth: rows)
        self.assertEqual("ready", restarted.execute("local_excel_status", {}, self.a)["status"]["state"])
        self.assertEqual("complete", restarted.execute("local_excel_start", {}, self.a)["status"]["state"])

    def test_export_download_is_opaque_and_tenant_bound(self):
        begun = self.upload(self.a)
        self.service.execute("local_excel_upload_commit", {"batch_id": begun["batch_id"]}, self.a)
        self.service.execute("local_excel_start", {}, self.a)
        exported = self.service.execute("local_excel_export", {}, self.a)
        self.assertRegex(exported["download_reference"], r"^[0-9a-f]{32}$")
        self.assertNotIn("result", exported, "an absolute engine path must never reach the browser")
        self.assertEqual(2, exported["rows"])
        self.assertEqual([(2, self.a.tenant_key)], self.reserve_calls)
        integrity = {"persisted_owner": self.a.tenant_key, "expected_bytes": exported["download_bytes"],
                     "expected_sha256": exported["download_sha256"]}
        path = self.service.resolve_download(exported["download_reference"], self.a, **integrity)
        self.assertEqual(b"xlsx-full:", path.read_bytes())
        restarted = WebExcelWorkspace(Path(self.temp.name) / "state", Path(self.temp.name) / "downloads",
                                      self.service.cloud_dispatch, analysis_factory=FakeAnalysis,
                                      workflow_factory=FakeWorkflow, export_reserver=lambda rows, auth: rows)
        self.assertEqual(path, restarted.resolve_download(exported["download_reference"], self.a, **integrity))
        with self.assertRaisesRegex(WorkspaceError, "gevonden"):
            restarted.resolve_download(exported["download_reference"], self.b, **integrity)

    def test_replacement_is_rejected_while_an_analysis_uses_the_active_files(self):
        RunningAnalysis.release.clear()
        root = Path(self.temp.name)
        self.service = WebExcelWorkspace(root / "state", root / "downloads", self.service.cloud_dispatch,
                                         analysis_factory=RunningAnalysis, workflow_factory=FakeWorkflow,
                                         export_reserver=lambda rows, auth: rows)
        first = self.upload(self.a, b"eerste")
        self.service.execute("local_excel_upload_commit", {"batch_id": first["batch_id"]}, self.a)
        self.service.execute("local_excel_start", {}, self.a)
        tenant = self.service._tenant(self.a)
        active = tenant.active_folder
        second = self.upload(self.a, b"tweede", "tweede.xlsx")
        try:
            with self.assertRaisesRegex(WorkspaceError, "lopende Excelanalyse"):
                self.service.execute("local_excel_upload_commit", {"batch_id": second["batch_id"]}, self.a)
            self.assertEqual(active, tenant.active_folder)
            self.assertTrue(active.is_dir())
        finally:
            RunningAnalysis.release.set()
            tenant.analysis._thread.join(2)

    def test_full_export_over_5000_is_rejected_before_publication(self):
        root = Path(self.temp.name)
        self.service = WebExcelWorkspace(root / "state", root / "downloads", self.service.cloud_dispatch,
                                         analysis_factory=TooManyAnalysis, workflow_factory=FakeWorkflow,
                                         export_reserver=lambda rows, auth: self.fail("over-limit rows must not be reserved"))
        begun = self.upload(self.a)
        self.service.execute("local_excel_upload_commit", {"batch_id": begun["batch_id"]}, self.a)
        self.service.execute("local_excel_start", {}, self.a)
        with self.assertRaisesRegex(WorkspaceError, "5.000"):
            self.service.execute("local_excel_export", {}, self.a)
        self.assertEqual([], list((root / "downloads" / self.a.tenant_key).glob("*.xlsx")))

    def test_priority_handoff_uses_numberfinder_without_starting_a_job(self):
        begun = self.upload(self.a)
        self.service.execute("local_excel_upload_commit", {"batch_id": begun["batch_id"]}, self.a)
        self.service.execute("local_excel_start", {}, self.a)
        result = self.service.execute("local_excel_prepare_enrichment",
                                      {"analysis_id": "a" * 64, "cohort": "priority", "limit": 10}, self.a)
        self.assertEqual(200, result["numberfinder"]["status"])
        self.assertEqual(1, result["selection"]["count"])
        self.assertEqual(1, result["selection"]["with_existing_phone"])
        self.assertEqual(1, result["selection"]["needs_address_review"])
        operations = [call[0]["operation"] for call in self.calls]
        self.assertEqual("upload_begin", operations[0])
        self.assertEqual("upload_finish", operations[-1])
        self.assertNotIn("http", operations, "preparation must never start a provider job")
        checkpoint = json.loads((Path(self.temp.name) / "state" / self.a.tenant_key / "numberfinder-preparation.json").read_text())
        self.assertEqual(result["selection"]["identity"], checkpoint["identity"])

    def test_priority_handoff_rejects_import_count_mismatch(self):
        begun = self.upload(self.a)
        self.service.execute("local_excel_upload_commit", {"batch_id": begun["batch_id"]}, self.a)
        self.service.execute("local_excel_start", {}, self.a)
        self.finish_count = 2
        with self.assertRaisesRegex(WorkspaceError, "niet alle"):
            self.service.execute("local_excel_prepare_enrichment",
                                 {"analysis_id": "a" * 64, "cohort": "priority", "limit": 10}, self.a)
        self.assertFalse((Path(self.temp.name) / "state" / self.a.tenant_key / "numberfinder-preparation.json").exists())

    def test_large_numberfinder_handoff_is_internal_and_not_request_paced(self):
        root = Path(self.temp.name)
        self.service = WebExcelWorkspace(root / "state", root / "downloads", self.service.cloud_dispatch,
                                         analysis_factory=LargeCallAnalysis, workflow_factory=FakeWorkflow,
                                         export_reserver=lambda rows, auth: rows)
        begun = self.upload(self.a)
        self.service.execute("local_excel_upload_commit", {"batch_id": begun["batch_id"]}, self.a)
        self.service.execute("local_excel_start", {}, self.a)
        started = time.monotonic()
        result = self.service.execute("local_excel_prepare_enrichment",
                                      {"analysis_id": "a" * 64, "cohort": "priority", "limit": 1}, self.a)
        self.assertEqual(1, result["selection"]["count"])
        self.assertLess(time.monotonic() - started, 5, "internal uploads must not use browser request pacing")
        chunks = [call for call, _request, _tenant in self.calls if call.get("operation") == "upload_chunk"]
        self.assertGreater(len(chunks), 75, "fixture must exceed the former 60-second paced boundary")

    def test_os_paths_are_redacted_and_manifest_traversal_is_rejected(self):
        root = Path(self.temp.name)
        leaking = WebExcelWorkspace(root / "leak-state", root / "leak-downloads", self.service.cloud_dispatch,
                                    analysis_factory=PathLeakAnalysis, workflow_factory=FakeWorkflow,
                                    export_reserver=lambda rows, auth: rows)
        self.service = leaking
        begun = self.upload(self.a)
        with self.assertRaises(WorkspaceError) as caught:
            leaking.execute("local_excel_upload_commit", {"batch_id": begun["batch_id"]}, self.a)
        self.assertNotIn("BelgoBase_App", str(caught.exception))
        self.assertNotIn("klant.xlsx", str(caught.exception))

        self.service = WebExcelWorkspace(root / "state", root / "downloads", self.service.cloud_dispatch,
                                         analysis_factory=FakeAnalysis, workflow_factory=FakeWorkflow,
                                         export_reserver=lambda rows, auth: rows)
        good = self.upload(self.a)
        self.service.execute("local_excel_upload_commit", {"batch_id": good["batch_id"]}, self.a)
        tenant = self.service._tenant(self.a)
        manifest_path = tenant.active_folder / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        outside = tenant.active_folder.parent / "outside.xlsx"
        outside.write_bytes((tenant.active_folder / manifest["files"][0]["stored"]).read_bytes())
        manifest["files"][0].update(stored="../outside.xlsx", size=outside.stat().st_size,
                                     sha256=__import__("hashlib").sha256(outside.read_bytes()).hexdigest())
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        restarted = WebExcelWorkspace(root / "state", root / "downloads", self.service.cloud_dispatch,
                                      analysis_factory=FakeAnalysis, workflow_factory=FakeWorkflow,
                                      export_reserver=lambda rows, auth: rows)
        with self.assertRaisesRegex(WorkspaceError, "veilig"):
            restarted.execute("local_excel_status", {}, self.a)

    def test_orphan_staging_is_swept_per_tenant_and_active_batches_are_bounded(self):
        root = Path(self.temp.name)
        service = WebExcelWorkspace(root / "sweep-state", root / "sweep-downloads", self.service.cloud_dispatch,
                                    analysis_factory=FakeAnalysis, workflow_factory=FakeWorkflow,
                                    export_reserver=lambda rows, auth: rows)
        for index in range(4):
            service.execute("local_excel_upload_begin",
                            {"name": f"bron{index}.xlsx", "size": 1, "purpose": "source"}, self.a)
        with self.assertRaisesRegex(WorkspaceError, "te veel"):
            service.execute("local_excel_upload_begin",
                            {"name": "teveel.xlsx", "size": 1, "purpose": "source"}, self.a)
        service.execute("local_excel_upload_begin",
                        {"name": "ander.xlsx", "size": 1, "purpose": "source"}, self.b)
        a_root = root / "sweep-state" / self.a.tenant_key
        b_root = root / "sweep-state" / self.b.tenant_key
        active_marker = a_root / "candidate" / "bewaren" / "active.xlsx"
        active_marker.parent.mkdir(parents=True)
        active_marker.write_bytes(b"active")
        restarted = WebExcelWorkspace(root / "sweep-state", root / "sweep-downloads", self.service.cloud_dispatch,
                                      analysis_factory=FakeAnalysis, workflow_factory=FakeWorkflow,
                                      export_reserver=lambda rows, auth: rows)
        restarted._tenant(self.a)
        self.assertEqual([], list((a_root / "staging").iterdir()))
        self.assertTrue(active_marker.is_file())
        self.assertNotEqual([], list((b_root / "staging").iterdir()), "one tenant may not sweep another tenant")


if __name__ == "__main__":
    unittest.main()
