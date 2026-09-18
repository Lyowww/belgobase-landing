"""Headless, tenant-safe adapter for the frozen BUILD98 workspace contract.

This module deliberately contains no device, Tk, pywebview, APPDATA or provider
credentials.  The HTTP gateway supplies an authenticated ``auth_context`` and
an injected CoreCallbacks implementation backed by the existing server core.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from types import MappingProxyType
from typing import Any, Callable, Mapping


class WorkspaceError(ValueError):
    """A deliberate, safe error which may be returned to the UI."""


class CoreNotConfiguredError(WorkspaceError):
    pass


@dataclass(frozen=True)
class AuthContext:
    """Trusted identity created by web_auth; never accepted from browser JSON."""
    license_id: str
    user_id: str
    display_name: str = "BelgoBase"
    customer_id: str = ""
    browser_id: str = ""
    plan: str = ""
    rights: Mapping[str, Any] = field(default_factory=dict)
    effective_scopes: frozenset[str] = frozenset()
    principal_id: str = ""
    quota_subject_id: str = ""
    email: str = ""

    def __post_init__(self) -> None:
        object.__setattr__(self, "rights", MappingProxyType(copy.deepcopy(dict(self.rights))))
        object.__setattr__(self, "effective_scopes", frozenset(self.effective_scopes))

    def authorization_context(self) -> dict[str, Any]:
        return {
            "access_class": "customer",
            "principal_type": "web",
            "principal_id": self.principal_id,
            "quota_subject_id": self.quota_subject_id,
            "license_id": self.license_id,
            "customer_id": self.customer_id,
            "user_id": self.user_id,
            "email": self.email,
            "browser_id": self.browser_id,
            "plan": self.plan,
            "rights": copy.deepcopy(dict(self.rights)),
            "effective_scopes": sorted(self.effective_scopes),
        }

    @property
    def tenant_key(self) -> str:
        raw = f"{self.customer_id}\x1f{self.license_id}\x1f{self.user_id}".encode("utf-8")
        return hashlib.sha256(raw).hexdigest()


class CoreCallbacks:
    """Small explicit contract required from the existing authenticated core.

    A callback is looked up by name.  Each receives ``payload`` and ``auth``;
    callbacks must return JSON-compatible mappings.  Missing callbacks fail
    closed with a typed error rather than inventing data or making network calls.
    """
    def __init__(self, **callbacks: Callable[[dict[str, Any], AuthContext], Mapping[str, Any]]):
        self._callbacks = callbacks

    def call(self, name: str, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        callback = self._callbacks.get(name)
        if callback is None:
            raise CoreNotConfiguredError(f"Core integration ontbreekt voor: {name}.")
        result = callback(copy.deepcopy(payload), auth)
        if not isinstance(result, Mapping):
            raise CoreNotConfiguredError(f"Core integration gaf geen geldig antwoord voor: {name}.")
        return dict(result)


class AtomicTenantStore:
    """File-backed state scoped by a server-derived tenant key."""
    def __init__(self, root: str | Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()

    def _path(self, auth: AuthContext) -> Path:
        return self.root / (auth.tenant_key + ".json")

    def load(self, auth: AuthContext) -> dict[str, Any]:
        with self._lock:
            path = self._path(auth)
            if not path.exists():
                return {"workspace": None, "workspace_revision": 0, "history": [], "downloads": {}}
            try:
                value = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                raise WorkspaceError("Je opgeslagen werkruimte kan niet worden gelezen.") from exc
            if not isinstance(value, dict):
                raise WorkspaceError("Je opgeslagen werkruimte is ongeldig.")
            return {"workspace": value.get("workspace"), "workspace_revision": value.get("workspace_revision", 0), "history": value.get("history", []),
                    "downloads": value.get("downloads", {})}

    def save(self, auth: AuthContext, value: Mapping[str, Any]) -> None:
        safe = {"workspace": value.get("workspace"), "workspace_revision": value.get("workspace_revision", 0), "history": value.get("history", []),
                "downloads": value.get("downloads", {})}
        encoded = json.dumps(safe, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        with self._lock:
            path = self._path(auth)
            fd, temporary = tempfile.mkstemp(prefix=".workspace-", suffix=".tmp", dir=str(self.root))
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as handle:
                    handle.write(encoded)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(temporary, path)
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)

    def update(self, auth: AuthContext, change: Callable[[dict[str, Any]], None]) -> dict[str, Any]:
        # One runtime owns this store; hold the same lock across read-modify-write.
        with self._lock:
            state = self.load(auth)
            change(state)
            self.save(auth, state)
            return state


class WorkspaceService:
    """Implements the JSON methods used by frozen FINAL3 ui.html."""
    PAGE_SIZE = 50
    _CORE_METHODS = {
        "search": "search", "company": "company", "compare_companies": "compare_companies",
        "relaxation_suggestions": "relaxation_suggestions", "ai": "ai",
        "workspace_data": "workspace_data", "filters_apply": "filters_apply",
        "xbrl_catalog": "xbrl_catalog", "similar_company": "similar_company",
        "similar_apply": "similar_apply", "export_columns": "export_columns",
        "account_action": "account_action",
    }

    def __init__(self, core: CoreCallbacks, storage: AtomicTenantStore, assets_dir: str | Path):
        self.core, self.storage, self.assets_dir = core, storage, Path(assets_dir)
        self._operations: dict[tuple[str, str], dict[str, Any]] = {}
        self._operations_lock = threading.RLock()

    def _asset(self, name: str, fallback: Any) -> Any:
        path = self.assets_dir / name
        if not path.exists():
            return fallback
        return json.loads(path.read_text(encoding="utf-8"))

    def _operation(self, payload: Mapping[str, Any], stage: str, auth: AuthContext) -> str | None:
        operation_id = payload.get("operation_id")
        if operation_id is None:
            return None
        if not isinstance(operation_id, str) or not operation_id or len(operation_id) > 100:
            raise WorkspaceError("Ongeldige bewerkingsidentiteit.")
        with self._operations_lock:
            self._operations[(auth.tenant_key, operation_id)] = {"stage": stage, "completed": 0, "total": 0,
                                              "cancelled": False, "at": time.time()}
        return operation_id

    def _require_object(self, payload: Any) -> dict[str, Any]:
        if payload is None:
            return {}
        if not isinstance(payload, dict):
            raise WorkspaceError("Ongeldig verzoek.")
        return payload

    def execute(self, method: str, payload: Any, auth_context: AuthContext) -> dict[str, Any]:
        """Return the exact pywebview-style envelope: ``{ok: true, ...}``."""
        try:
            if not isinstance(auth_context, AuthContext) or not auth_context.license_id or not auth_context.user_id:
                raise WorkspaceError("Je aanmelding kon niet worden bevestigd.")
            request = self._require_object(payload)
            handler = getattr(self, "_" + method, None)
            if handler is None or method.startswith("_"):
                raise WorkspaceError("Deze werkruimteactie wordt niet ondersteund.")
            answer = handler(request, auth_context)
            if not isinstance(answer, Mapping):
                raise CoreNotConfiguredError("Core integration gaf geen geldig antwoord.")
            tracked = {"search", "company", "compare_companies", "relaxation_suggestions", "ai", "export_results", "export_selection"}
            if method in tracked and isinstance(request.get("operation_id"), str):
                with self._operations_lock:
                    operation = self._operations.get((auth_context.tenant_key, request["operation_id"]))
                    if operation is not None:
                        operation.update(completed=1, total=1, stage="Afgerond")
                        if operation["cancelled"]:
                            operation["stage"] = "Geannuleerd"
                            raise WorkspaceError("Deze actie is geannuleerd.")
            return {"ok": True, **dict(answer)}
        except WorkspaceError as exc:
            return {"ok": False, "error": str(exc)}
        except Exception:
            return {"ok": False, "error": "Deze actie kon niet worden voltooid. Probeer opnieuw."}

    def _bootstrap(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        state = self.storage.load(auth)
        meta = self._asset("workspace_metadata.json", {})
        bootstrap = self.core.call("bootstrap", {}, auth)
        return {**bootstrap, "account": {"name": auth.display_name},
                "workspace_revision": state["workspace_revision"],
                "workspace": state["workspace"] or bootstrap.get("workspace") or {"lists": [], "searches": []},
                "filter_labels": meta.get("filter_labels", bootstrap.get("filter_labels", {})),
                "schema_provenance": meta.get("provenance")}

    def _search(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._operation(request, "Bedrijven zoeken", auth)
        return self.core.call("search", request, auth)

    def _company(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._operation(request, "Bedrijfsfiche laden", auth)
        return self.core.call("company", request, auth)

    def _compare_companies(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._operation(request, "Bedrijven vergelijken", auth)
        return self.core.call("compare_companies", request, auth)

    def _relaxation_suggestions(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._operation(request, "Mogelijke aanpassingen controleren", auth)
        return self.core.call("relaxation_suggestions", request, auth)

    def _ai(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._operation(request, "Zoekvraag begrijpen", auth)
        return self.core.call("ai", request, auth)

    def _workspace_data(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        return self.core.call("workspace_data", request, auth)

    def _filters_apply(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        return self.core.call("filters_apply", request, auth)

    def _xbrl_catalog(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        return self.core.call("xbrl_catalog", request, auth)

    def _similar_company(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        return self.core.call("similar_company", request, auth)

    def _similar_apply(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        return self.core.call("similar_apply", request, auth)

    def _export_columns(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        return self.core.call("export_columns", request, auth)

    def _account_action(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        # The core endpoint must enforce license/device state.  This adapter has no device code.
        return self.core.call("account_action", request, auth)

    def _workspace_save(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        workspace = request.get("workspace")
        if not isinstance(workspace, dict):
            raise WorkspaceError("Ongeldige werkruimte.")
        expected = request.get("workspace_revision")
        def change(state):
            # The browser adapter adds the last acknowledged server revision.
            # Reject stale saves instead of overwriting another browser's work.
            if type(expected) is not int or expected != state["workspace_revision"]:
                raise WorkspaceError("Je werkruimte is op een ander venster of toestel gewijzigd. Heropen BelgoBase om de nieuwste versie te laden; je wijziging is niet overschreven.")
            state["workspace"] = copy.deepcopy(workspace)
            state["workspace_revision"] += 1
        state = self.storage.update(auth, change)
        return {"workspace": workspace, "workspace_revision": state["workspace_revision"]}

    def _search_history(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        action = request.get("action", "list")
        if action == "list":
            return {"history": self.storage.load(auth)["history"]}
        def change(state):
            history = state["history"] if isinstance(state["history"], list) else []
            if action == "record":
                item = {"id": uuid.uuid4().hex, "filters": request.get("filters", {}), "query": request.get("query", ""),
                        "total": request.get("total"), "saved_at": int(time.time())}
                history = [item, *history]
            elif action == "delete":
                history = [item for item in history if isinstance(item, dict) and item.get("id") != request.get("id")]
            elif action == "clear" and request.get("confirmed") is True:
                history = []
            else:
                raise WorkspaceError("Deze geschiedenisactie wordt niet ondersteund.")
            state["history"] = history
        return {"history": self.storage.update(auth, change)["history"]}

    def _operation_status(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        operation_id = request.get("operation_id")
        with self._operations_lock:
            value = self._operations.get((auth.tenant_key, operation_id), {})
        return {k: value[k] for k in ("stage", "completed", "total", "cancelled") if k in value}

    def _cancel_operation(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        operation_id = request.get("operation_id")
        with self._operations_lock:
            if (auth.tenant_key, operation_id) in self._operations:
                self._operations[(auth.tenant_key, operation_id)]["cancelled"] = True
        return {"cancelled": True}

    def _export_results(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        return self._export(request, auth)

    def _export_selection(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        return self._export(request, auth)

    def _export(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        """Create a session-owned job. The gateway serves its download URL."""
        self._operation(request, "Excel voorbereiden", auth)
        result = self.core.call("export", request, auth)
        job_id = uuid.uuid4().hex
        # Core returns an opaque gateway-owned download reference, never a local filesystem path.
        reference = result.get("download_reference")
        if not isinstance(reference, str) or not reference:
            raise CoreNotConfiguredError("Core integration ontbreekt voor: export download.")
        def change(state):
            downloads = state["downloads"] if isinstance(state["downloads"], dict) else {}
            downloads[job_id] = {"reference": reference, "created_at": int(time.time())}
            state["downloads"] = downloads
        self.storage.update(auth, change)
        return {"download_url": f"/api/web/download/{job_id}", "rows": result.get("rows"),
                "total": result.get("total"), "message": result.get("message", "Excel is voorbereid.")}

    def _ai_usage(self, request: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        return self.core.call("ai_usage", {}, auth)
