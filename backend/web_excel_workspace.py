"""Tenant-bound web adapter for the existing PC1 Excel cleanup engine.

The parser, merge logic and ranking workflow stay in ``premium_local_excel``
and ``premium_excel_workflow``.  This module only owns browser upload staging,
tenant isolation, durable source manifests and authenticated downloads.
"""
from __future__ import annotations

import base64
import copy
import hashlib
import importlib
import json
import logging
import os
import re
import shutil
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Mapping

try:
    from .web_workspace import AuthContext, WorkspaceError
except ImportError:  # pragma: no cover - direct focused test import
    from web_workspace import AuthContext, WorkspaceError


CHUNK_BYTES = 4 * 1024 * 1024
NUMBERFINDER_CHUNK_BYTES = 30_000
MAX_FILE_BYTES = 32 * 1024 * 1024
MAX_TOTAL_BYTES = 512 * 1024 * 1024
MAX_FILES = 100
MAX_ACTIVE_BATCHES = 4
UPLOAD_TTL_SECONDS = 30 * 60
DOWNLOAD_TTL_SECONDS = 30 * 60
NUMBERFINDER_MAX_BYTES = 25 * 1024 * 1024
DOWNLOAD_REFERENCE = re.compile(r"^[0-9a-f]{32}$")
LOGGER = logging.getLogger(__name__)


def _atomic_json(path: Path, value: Mapping[str, Any]) -> None:
    raw = (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix="." + path.name + ".", suffix=".tmp", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def _safe_name(value: Any) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= 240 or any(ord(char) < 32 for char in value):
        raise WorkspaceError("De bestandsnaam is ongeldig.")
    name = Path(value).name
    if name != value or Path(name).suffix.lower() != ".xlsx":
        raise WorkspaceError("Kies alleen gewone .xlsx-bestanden.")
    return name


def _uuid(value: Any, label: str) -> str:
    try:
        parsed = str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        raise WorkspaceError(f"Ongeldige {label}.") from None
    if parsed != value:
        raise WorkspaceError(f"Ongeldige {label}.")
    return parsed


@dataclass
class _Upload:
    upload_id: str
    name: str
    size: int
    path: Path
    offset: int = 0
    finished: bool = False


@dataclass
class _Batch:
    batch_id: str
    purpose: str
    root: Path
    created: float
    uploads: dict[str, _Upload] = field(default_factory=dict)


@dataclass
class _Tenant:
    key: str
    root: Path
    lock: threading.RLock = field(default_factory=threading.RLock)
    analysis: Any = None
    workflow: Any = None
    active_folder: Path | None = None
    batches: dict[str, _Batch] = field(default_factory=dict)


class WebExcelWorkspace:
    """Expose the PC1 Excel engine through bounded browser-safe operations."""

    METHODS = frozenset({
        "local_excel_upload_begin", "local_excel_upload_chunk", "local_excel_upload_finish",
        "local_excel_upload_commit", "local_excel_upload_cancel", "local_excel_start",
        "local_excel_status", "local_excel_cancel", "local_excel_workflow_state",
        "local_excel_profile", "local_excel_profile_cancel", "local_excel_confirm_profile",
        "local_excel_export", "local_excel_export_cohort", "local_excel_prepare_enrichment",
    })

    def __init__(
        self,
        root: str | Path,
        download_root: str | Path,
        cloud_dispatch: Callable[[dict[str, Any], str, AuthContext], Mapping[str, Any]],
        *,
        analysis_factory: Callable[[], Any] | None = None,
        workflow_factory: Callable[..., Any] | None = None,
        export_reserver: Callable[[int, AuthContext], Any] | None = None,
    ) -> None:
        self.root = Path(root)
        self.download_root = Path(download_root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.download_root.mkdir(parents=True, exist_ok=True)
        self.cloud_dispatch = cloud_dispatch
        self._analysis_factory = analysis_factory
        self._workflow_factory = workflow_factory
        self._export_reserver = export_reserver
        self._tenants: dict[str, _Tenant] = {}
        self._lock = threading.RLock()

    def _factories(self) -> tuple[Callable[[], Any], Callable[..., Any]]:
        if self._analysis_factory is None:
            self._analysis_factory = importlib.import_module("premium_local_excel").LocalExcelAnalysis
        if self._workflow_factory is None:
            self._workflow_factory = importlib.import_module("premium_excel_workflow").ExcelWorkflow
        return self._analysis_factory, self._workflow_factory

    def _tenant(self, auth: AuthContext) -> _Tenant:
        key = auth.tenant_key
        with self._lock:
            tenant = self._tenants.get(key)
            if tenant is None:
                root = self.root / key
                root.mkdir(parents=True, exist_ok=True)
                self._sweep_orphan_staging(root)
                tenant = self._tenants[key] = _Tenant(key, root)
            return tenant

    @staticmethod
    def _sweep_orphan_staging(root: Path) -> None:
        staging = root / "staging"
        staging.mkdir(parents=True, exist_ok=True)
        resolved = staging.resolve()
        for child in list(staging.iterdir()):
            try:
                if child.parent.resolve() != resolved:
                    continue
                if child.is_symlink() or child.is_file():
                    child.unlink(missing_ok=True)
                elif child.is_dir():
                    shutil.rmtree(child, ignore_errors=True)
            except OSError:
                LOGGER.warning("Verweesde Excelupload kon niet worden verwijderd (%s)", child.name)

    @staticmethod
    def _require(payload: Any, allowed: set[str], required: set[str] = frozenset()) -> dict[str, Any]:
        if not isinstance(payload, dict) or set(payload) - allowed or not required.issubset(payload):
            raise WorkspaceError("Ongeldige Excelopdracht.")
        return payload

    def execute(self, method: str, payload: Any, auth: AuthContext) -> dict[str, Any]:
        if method not in self.METHODS:
            raise WorkspaceError("Deze Excelactie wordt niet ondersteund.")
        handler = getattr(self, "_" + method)
        try:
            return dict(handler(self._require(payload, set(payload) if isinstance(payload, dict) else set()), auth))
        except WorkspaceError:
            raise
        except (ValueError, OSError) as exc:
            reference = uuid.uuid4().hex[:12]
            LOGGER.exception("Excelactie mislukt [%s] (%s)", reference, type(exc).__name__)
            raise WorkspaceError(
                f"De Excelactie kon niet worden voltooid. Referentie: {reference}."
            ) from exc

    def _expire(self, tenant: _Tenant) -> None:
        now = time.monotonic()
        for batch_id, batch in list(tenant.batches.items()):
            if now - batch.created > UPLOAD_TTL_SECONDS:
                shutil.rmtree(batch.root, ignore_errors=True)
                tenant.batches.pop(batch_id, None)

    def _local_excel_upload_begin(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, {"name", "size", "purpose", "batch_id"}, {"name", "size", "purpose"})
        name = _safe_name(payload["name"])
        size = payload["size"]
        purpose = payload["purpose"]
        if type(size) is not int or not 1 <= size <= MAX_FILE_BYTES:
            raise WorkspaceError("Kies een Excelbestand van maximaal 32 MiB.")
        if purpose not in {"source", "feedback"}:
            raise WorkspaceError("Ongeldige Excelupload.")
        tenant = self._tenant(auth)
        with tenant.lock:
            self._expire(tenant)
            batch_id = payload.get("batch_id")
            if batch_id is None:
                if len(tenant.batches) >= MAX_ACTIVE_BATCHES:
                    raise WorkspaceError("Er staan te veel onvoltooide Exceluploads open. Rond er één af of annuleer hem.")
                batch_id = str(uuid.uuid4())
                root = tenant.root / "staging" / batch_id
                root.mkdir(parents=True, exist_ok=False)
                tenant.batches[batch_id] = _Batch(batch_id, purpose, root, time.monotonic())
            else:
                batch_id = _uuid(batch_id, "uploadgroep")
            batch = tenant.batches.get(batch_id)
            if batch is None or batch.purpose != purpose:
                raise WorkspaceError("Deze Excelupload is verlopen. Kies de bestanden opnieuw.")
            all_uploads = [item for current in tenant.batches.values() for item in current.uploads.values()]
            if len(all_uploads) >= MAX_FILES or sum(item.size for item in all_uploads) + size > MAX_TOTAL_BYTES:
                raise WorkspaceError("De gekozen bestanden overschrijden de analyselimiet.")
            upload_id = str(uuid.uuid4())
            path = batch.root / (upload_id + ".part")
            path.touch(exist_ok=False)
            batch.uploads[upload_id] = _Upload(upload_id, name, size, path)
            return {"batch_id": batch_id, "upload_id": upload_id, "offset": 0}

    def _batch_upload(self, tenant: _Tenant, payload: dict[str, Any]) -> tuple[_Batch, _Upload]:
        batch_id = _uuid(payload.get("batch_id"), "uploadgroep")
        upload_id = _uuid(payload.get("upload_id"), "upload")
        batch = tenant.batches.get(batch_id)
        upload = batch.uploads.get(upload_id) if batch else None
        if batch is None or upload is None:
            raise WorkspaceError("Deze Excelupload is verlopen. Kies de bestanden opnieuw.")
        return batch, upload

    def _local_excel_upload_chunk(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, {"batch_id", "upload_id", "offset", "data"}, {"batch_id", "upload_id", "offset", "data"})
        tenant = self._tenant(auth)
        with tenant.lock:
            self._expire(tenant)
            batch, upload = self._batch_upload(tenant, payload)
            if upload.finished:
                raise WorkspaceError("Deze Excelupload is al afgerond.")
            try:
                chunk = base64.b64decode(payload["data"], validate=True)
            except (ValueError, TypeError):
                raise WorkspaceError("Ongeldig Excelblok.") from None
            offset = payload["offset"]
            if type(offset) is not int or not 1 <= len(chunk) <= CHUNK_BYTES or offset < 0 or offset + len(chunk) > upload.size:
                raise WorkspaceError("Ongeldig Excelblok.")
            if offset == upload.offset:
                with upload.path.open("ab") as handle:
                    handle.write(chunk)
                    handle.flush()
                upload.offset += len(chunk)
            elif offset + len(chunk) <= upload.offset:
                with upload.path.open("rb") as handle:
                    handle.seek(offset)
                    if handle.read(len(chunk)) != chunk:
                        raise WorkspaceError("De Excelupload is onderbroken.")
            else:
                raise WorkspaceError("De Excelupload is onderbroken.")
            batch.created = time.monotonic()
            return {"offset": offset + len(chunk)}

    def _local_excel_upload_finish(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, {"batch_id", "upload_id"}, {"batch_id", "upload_id"})
        tenant = self._tenant(auth)
        with tenant.lock:
            self._expire(tenant)
            batch, upload = self._batch_upload(tenant, payload)
            if upload.offset != upload.size:
                raise WorkspaceError("De Excelupload is nog niet volledig.")
            if not upload.finished:
                ready = upload.path.with_suffix(".xlsx")
                os.replace(upload.path, ready)
                upload.path = ready
                upload.finished = True
            batch.created = time.monotonic()
            return {"file": {"name": upload.name, "size": upload.size},
                    "pending_files": sum(not item.finished for item in batch.uploads.values())}

    def _new_engine(self, tenant: _Tenant, auth: AuthContext, paths: list[str]) -> tuple[Any, Any, dict[str, Any]]:
        analysis_factory, workflow_factory = self._factories()
        analysis = analysis_factory()
        preview = analysis.select_files(paths)

        def cloud(command: dict[str, Any], *, request_id: str | None = None, timeout: int = 300) -> dict[str, Any]:
            del timeout
            result = self.cloud_dispatch(copy.deepcopy(command), request_id or str(uuid.uuid4()), auth)
            if not isinstance(result, Mapping):
                raise WorkspaceError("De adviesdienst gaf geen geldig antwoord.")
            return dict(result)

        workflow = workflow_factory(analysis, cloud, cache_path=tenant.root / "excel-progress.json")
        return analysis, workflow, preview

    def _manifest(self, tenant: _Tenant, folder: Path, batch: _Batch) -> dict[str, Any]:
        files = []
        for position, upload in enumerate(batch.uploads.values()):
            target = folder / f"{position:03d}_{upload.name}"
            shutil.copy2(upload.path, target)
            files.append({"name": upload.name, "stored": target.name, "size": upload.size,
                          "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})
        return {"version": 1, "purpose": batch.purpose, "files": files, "created_at": int(time.time())}

    def _local_excel_upload_commit(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, {"batch_id"}, {"batch_id"})
        tenant = self._tenant(auth)
        with tenant.lock:
            self._expire(tenant)
            batch_id = _uuid(payload["batch_id"], "uploadgroep")
            batch = tenant.batches.get(batch_id)
            if batch is None or not batch.uploads or any(not item.finished for item in batch.uploads.values()):
                raise WorkspaceError("Rond eerst alle Exceluploads af.")
            analysis_thread = getattr(tenant.analysis, "_thread", None)
            workflow_thread = getattr(tenant.workflow, "thread", None)
            if ((analysis_thread is not None and analysis_thread.is_alive())
                    or (workflow_thread is not None and workflow_thread.is_alive())):
                raise WorkspaceError("Wacht tot de lopende Excelanalyse is afgerond of gestopt.")
            candidate = tenant.root / "candidate" / batch_id
            candidate.mkdir(parents=True, exist_ok=False)
            try:
                manifest = self._manifest(tenant, candidate, batch)
                paths = [str(candidate / item["stored"]) for item in manifest["files"]]
                if batch.purpose == "source":
                    analysis, workflow, preview = self._new_engine(tenant, auth, paths)
                else:
                    if tenant.analysis is None or tenant.workflow is None:
                        raise WorkspaceError("Rond eerst een gewone Excelanalyse af.")
                    old_status = tenant.analysis.status()
                    if old_status.get("state") != "complete":
                        raise WorkspaceError("Rond eerst de huidige analyse af.")
                    if tenant.active_folder is None:
                        raise WorkspaceError("De eerdere bronbestanden zijn niet meer beschikbaar.")
                    existing = []
                    existing_manifest = []
                    for position, source in enumerate(sorted(tenant.active_folder.glob("*.xlsx"))):
                        target = candidate / f"old_{position:03d}_{source.name}"
                        shutil.copy2(source, target)
                        existing.append(str(target))
                        existing_manifest.append({"name": source.name, "stored": target.name,
                                                  "size": target.stat().st_size,
                                                  "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})
                    manifest["files"] = existing_manifest + manifest["files"]
                    analysis, workflow, preview = self._new_engine(tenant, auth, existing + paths)
                _atomic_json(candidate / "manifest.json", manifest)
                _atomic_json(tenant.root / "active.json", {
                    "version": 1, "folder": str(candidate.relative_to(tenant.root)).replace("\\", "/")
                })
            except Exception:
                shutil.rmtree(candidate, ignore_errors=True)
                raise
            previous = tenant.active_folder
            tenant.analysis, tenant.workflow, tenant.active_folder = analysis, workflow, candidate
            tenant.batches.pop(batch_id, None)
            shutil.rmtree(batch.root, ignore_errors=True)
            if previous and previous != candidate:
                shutil.rmtree(previous, ignore_errors=True)
            return {"preview": preview}

    def _local_excel_upload_cancel(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, {"batch_id"}, {"batch_id"})
        tenant = self._tenant(auth)
        with tenant.lock:
            batch_id = _uuid(payload["batch_id"], "uploadgroep")
            batch = tenant.batches.pop(batch_id, None)
            if batch:
                shutil.rmtree(batch.root, ignore_errors=True)
            return {"cancelled": True}

    def _engine(self, auth: AuthContext) -> tuple[_Tenant, Any, Any]:
        tenant = self._tenant(auth)
        if tenant.analysis is None or tenant.workflow is None:
            self._restore_engine(tenant, auth)
        if tenant.analysis is None or tenant.workflow is None:
            raise WorkspaceError("Kies eerst Excelbestanden voor de analyse.")
        return tenant, tenant.analysis, tenant.workflow

    def _restore_engine(self, tenant: _Tenant, auth: AuthContext) -> None:
        pointer = tenant.root / "active.json"
        if not pointer.is_file():
            return
        try:
            value = json.loads(pointer.read_text(encoding="utf-8"))
            if not isinstance(value, dict) or value.get("version") != 1 or set(value) != {"version", "folder"}:
                raise ValueError("pointer")
            folder = (tenant.root / str(value["folder"])).resolve()
            if tenant.root.resolve() not in folder.parents or folder.is_symlink() or not folder.is_dir():
                raise ValueError("folder")
            manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
            files = manifest.get("files") if isinstance(manifest, dict) else None
            if not isinstance(files, list) or not files:
                raise ValueError("manifest")
            paths = []
            stored_names: set[str] = set()
            resolved_folder = folder.resolve()
            for item in files:
                if not isinstance(item, dict) or set(item) != {"name", "stored", "size", "sha256"}:
                    raise ValueError("file")
                stored = item["stored"]
                if (not isinstance(stored, str) or stored != Path(stored).name
                        or Path(stored).suffix.lower() != ".xlsx" or stored in stored_names):
                    raise ValueError("file")
                stored_names.add(stored)
                path = (folder / stored).resolve(strict=True)
                if (path.parent != resolved_folder or not path.is_file() or path.is_symlink()
                        or path.stat().st_size != item["size"]
                        or hashlib.sha256(path.read_bytes()).hexdigest() != item["sha256"]):
                    raise ValueError("digest")
                paths.append(str(path))
            analysis, workflow, _preview = self._new_engine(tenant, auth, paths)
        except (OSError, ValueError, TypeError, json.JSONDecodeError) as exc:
            raise WorkspaceError("De opgeslagen Excelvoortgang kan niet veilig worden hervat. Kies de bronbestanden opnieuw.") from exc
        tenant.analysis, tenant.workflow, tenant.active_folder = analysis, workflow, folder

    def _local_excel_start(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, set())
        tenant = self._tenant(auth)
        with tenant.lock:
            _tenant, analysis, _workflow = self._engine(auth)
            return {"status": analysis.start()}

    def _local_excel_status(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, set())
        tenant = self._tenant(auth)
        with tenant.lock:
            _tenant, analysis, _workflow = self._engine(auth)
            return {"status": analysis.status()}

    def _local_excel_cancel(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, set())
        tenant = self._tenant(auth)
        with tenant.lock:
            _tenant, analysis, _workflow = self._engine(auth)
            return {"status": analysis.cancel()}

    def _local_excel_workflow_state(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, set())
        tenant = self._tenant(auth)
        with tenant.lock:
            _tenant, _analysis, workflow = self._engine(auth)
            return {"workflow": workflow.state()}

    def _local_excel_profile(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, {"business_context"}, {"business_context"})
        tenant = self._tenant(auth)
        with tenant.lock:
            _tenant, _analysis, workflow = self._engine(auth)
            return {"workflow": workflow.start_profile(payload["business_context"])}

    def _local_excel_profile_cancel(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, set())
        tenant = self._tenant(auth)
        with tenant.lock:
            _tenant, _analysis, workflow = self._engine(auth)
            return {"workflow": workflow.stop()}

    def _local_excel_confirm_profile(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, {"analysis_id", "profile_version"}, {"analysis_id", "profile_version"})
        tenant = self._tenant(auth)
        with tenant.lock:
            _tenant, _analysis, workflow = self._engine(auth)
            return {"workflow": workflow.confirm(payload["analysis_id"], payload["profile_version"])}

    def _export_result(self, tenant: _Tenant, action: Callable[[str], Mapping[str, Any]],
                       name: str, auth: AuthContext) -> dict[str, Any]:
        path = self.download_root / tenant.key
        path.mkdir(parents=True, exist_ok=True)
        reference = uuid.uuid4().hex
        target = path / (reference + "_" + name)
        result = dict(action(str(target)))
        if not target.is_file() or target.stat().st_size < 1:
            raise WorkspaceError("Het Excelbestand kon niet veilig worden voorbereid.")
        summary = result.get("summary") if isinstance(result.get("summary"), Mapping) else {}
        rows = result.get("count", summary.get("mergedrecords"))
        if type(rows) is not int or rows < 0:
            target.unlink(missing_ok=True)
            raise WorkspaceError("Het aantal Excelrijen kon niet veilig worden bevestigd.")
        if self._export_reserver is None:
            target.unlink(missing_ok=True)
            raise WorkspaceError("De exportlimiet kon niet veilig worden gereserveerd.")
        try:
            self._export_reserver(rows, auth)
        except Exception:
            target.unlink(missing_ok=True)
            raise
        download_bytes = target.stat().st_size
        download_sha256 = hashlib.sha256(target.read_bytes()).hexdigest()
        return {"download_reference": reference, "download_bytes": download_bytes,
                "download_sha256": download_sha256, "filename": name, "rows": rows}

    def _local_excel_export(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, set())
        tenant = self._tenant(auth)
        with tenant.lock:
            tenant, analysis, _workflow = self._engine(auth)
            return self._export_result(tenant, analysis.export, "BelgoBase_opgeschoond.xlsx", auth)

    def _local_excel_export_cohort(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, {"cohort"}, {"cohort"})
        tenant = self._tenant(auth)
        with tenant.lock:
            tenant, analysis, workflow = self._engine(auth)
            cohort = payload["cohort"]
            rows = workflow.cohort(cohort)
            if not rows:
                raise WorkspaceError("Deze lijst bevat geen records.")
            ids = [row["id"] for row in rows]
            action = (lambda path: analysis.export(path, candidate_ids=ids)) if cohort == "review" else (
                lambda path: analysis.export_call_list(path, candidate_ids=ids))
            return self._export_result(tenant, action, f"BelgoBase_{cohort}.xlsx", auth)

    def _numberfinder(self, command: dict[str, Any], auth: AuthContext, request_id: str | None = None) -> dict[str, Any]:
        result = self.cloud_dispatch({"command": "numberfinder", **command}, request_id or str(uuid.uuid4()), auth)
        numberfinder = result.get("numberfinder") if isinstance(result, Mapping) else None
        if not isinstance(numberfinder, Mapping):
            raise WorkspaceError("De Nummerzoeker gaf geen geldig antwoord.")
        return dict(numberfinder)

    def _local_excel_prepare_enrichment(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        tenant = self._tenant(auth)
        with tenant.lock:
            return self._local_excel_prepare_enrichment_locked(payload, auth)

    def _local_excel_prepare_enrichment_locked(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._require(payload, {"analysis_id", "cohort", "limit", "advance_completed"}, {"analysis_id", "cohort", "limit"})
        if (payload["cohort"] != "priority" or type(payload["limit"]) is not int
                or not 1 <= payload["limit"] <= 5000
                or payload.get("advance_completed", False) not in (True, False)):
            raise WorkspaceError("Kies één tot maximaal 5.000 bedrijven uit de bevestigde voorkeurslijst.")
        tenant, analysis, workflow = self._engine(auth)
        state = workflow.state()
        if payload["analysis_id"] != state.get("analysis_id") or state.get("phase") != "ranked":
            raise WorkspaceError("Bevestig eerst het actuele profiel en de selectie.")
        ranked = workflow.cohort("priority")
        missing = [row for row in ranked if not any(str(phone).strip() for phone in row.get("phones", []))]
        usable = [row for row in missing if row.get("enterprise_number") or
                  (row.get("name") and (row.get("city") or row.get("postcode") or row.get("street")))]
        if payload.get("advance_completed") is True and workflow.handoff is not None:
            workflow.handoff_rows.update(workflow.handoff.get("row_ids", []))
            workflow.handoff = None
            workflow.preparation = None
            workflow.save_checkpoint()
        remaining = [row for row in usable if row["id"] not in workflow.handoff_rows]
        if workflow.handoff is not None:
            selected_ids = set(workflow.handoff.get("row_ids", []))
            selected = [row for row in usable if row["id"] in selected_ids]
        else:
            selected = remaining[:payload["limit"]]
        if not selected:
            raise WorkspaceError("Er zijn geen bedrijven met ontbrekende nummers en voldoende zoekgegevens.")
        profile = {key: value for key, value in (state.get("profile") or {}).items() if key != "version"}
        fields = ("id", "enterprise_number", "name", "street", "house_number", "postcode", "city", "website")
        identity_value = {"analysis": state["analysis_id"], "profile": profile, "limit": payload["limit"],
                          "rows": [{key: row.get(key, "") for key in fields} for row in selected]}
        identity = hashlib.sha256(json.dumps(identity_value, ensure_ascii=False, sort_keys=True,
                                               separators=(",", ":")).encode("utf-8")).hexdigest()
        profile_version = (state.get("profile") or {}).get("version")
        def verify_current() -> None:
            current = workflow.state()
            if (tenant.workflow is not workflow or current.get("analysis_id") != payload["analysis_id"]
                    or current.get("phase") != "ranked"
                    or (current.get("profile") or {}).get("version") != profile_version
                    or workflow.cohort("priority") != ranked):
                raise WorkspaceError("De lokale selectie is gewijzigd. Bereid de actuele selectie opnieuw voor.")
        def send(operation: str, **values: Any) -> dict[str, Any]:
            verify_current()
            result = self._numberfinder({"operation": operation, **values}, auth)
            verify_current()
            return result
        with tempfile.TemporaryDirectory(prefix="belgobase_excel_numberfinder_") as temporary:
            target = Path(temporary) / "BelgoBase_voorkeurslijst.xlsx"
            analysis.export_call_list(str(target), candidate_ids=[row["id"] for row in selected])
            raw = target.read_bytes()
        if not raw or len(raw) > NUMBERFINDER_MAX_BYTES:
            raise WorkspaceError("De gekozen groep is te groot voor de Nummerzoeker. Kies minder bedrijven.")
        begin = send("upload_begin", name="BelgoBase_voorkeurslijst.xlsx", size=len(raw))
        upload_id = begin.get("upload_id")
        if not isinstance(upload_id, str):
            raise WorkspaceError("De selectie kon niet worden voorbereid.")
        offset = 0
        while offset < len(raw):
            chunk = raw[offset:offset + NUMBERFINDER_CHUNK_BYTES]
            reply = send("upload_chunk", upload_id=upload_id, offset=offset,
                         data=base64.b64encode(chunk).decode("ascii"))
            if reply.get("offset") != offset + len(chunk):
                raise WorkspaceError("De selectieoverdracht werd onderbroken.")
            offset += len(chunk)
        numberfinder = send("upload_finish", upload_id=upload_id)
        if numberfinder.get("status") != 200 or (numberfinder.get("body") or {}).get("count") != len(selected):
            raise WorkspaceError("De Nummerzoeker heeft niet alle geselecteerde bedrijven bevestigd. Probeer opnieuw.")
        selection = {"identity": identity, "count": len(selected), "available": len(usable),
                     "job_id": str(uuid.uuid5(uuid.NAMESPACE_URL, "belgobase:numberfinder:" + identity)),
                     "remaining": len(remaining) - len(selected),
                     "with_existing_phone": len(ranked) - len(missing),
                     "needs_address_review": len(missing) - len(usable),
                     "row_ids": [row["id"] for row in selected]}
        _atomic_json(tenant.root / "numberfinder-preparation.json", selection)
        # Identity belongs to preparation metadata, not the shared PC1 handoff
        # checkpoint schema, which is validated strictly when work resumes.
        workflow.handoff = {key: value for key, value in selection.items() if key != "identity"}
        workflow.preparation = {"identity": identity, "list_id": None}
        workflow.save_checkpoint()
        return {"numberfinder": numberfinder, "selection": selection}

    def owns_download(self, reference: str, auth: AuthContext) -> bool:
        if not isinstance(reference, str) or DOWNLOAD_REFERENCE.fullmatch(reference) is None:
            return False
        tenant = self._tenant(auth)
        with tenant.lock:
            folder = self.download_root / tenant.key
            return len(list(folder.glob(reference + "_*.xlsx"))) == 1

    def resolve_download(
        self, reference: str, auth: AuthContext, *, persisted_owner: str,
        expected_bytes: int, expected_sha256: str,
    ) -> Path:
        if persisted_owner != auth.tenant_key or not self.owns_download(reference, auth):
            raise WorkspaceError("Download niet gevonden.")
        path = next((self.download_root / auth.tenant_key).glob(reference + "_*.xlsx"))
        if (path.is_symlink() or path.stat().st_size != expected_bytes
                or hashlib.sha256(path.read_bytes()).hexdigest() != expected_sha256):
            raise WorkspaceError("Download niet gevonden.")
        return path

    def discard_download(
        self, reference: str, auth: AuthContext, *, persisted_owner: str,
        expected_bytes: int, expected_sha256: str,
    ) -> None:
        try:
            path = self.resolve_download(
                reference, auth, persisted_owner=persisted_owner,
                expected_bytes=expected_bytes, expected_sha256=expected_sha256,
            )
        except WorkspaceError:
            return
        path.unlink(missing_ok=True)
