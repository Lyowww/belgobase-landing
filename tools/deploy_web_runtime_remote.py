"""Fixed-path remote half for the BelgoBase web-runtime deployment."""
from __future__ import annotations

import datetime as dt
import hashlib
import http.client
import io
import json
import os
from pathlib import Path, PurePosixPath
import py_compile
import shutil
import sqlite3
import sys
import time
import uuid
import zipfile


SERVER_ROOT = Path(r"C:\BelgoBase_App\server")
ACCOUNT_ROOT = Path(r"C:\BelgoBase_App\account_service_build60_update8")
DATABASE = Path(r"C:\BelgoBase_App\security\licenses.sqlite3")
BACKUP_ROOT = Path(r"C:\BelgoBase_App\deployment_backups")
STAGING_ROOT = Path(r"C:\BelgoBase_App\deploy_staging")
PIPELINE_ROOT = Path(r"C:\BelgoBase_App\pipeline")
SERVER_WRAPPER = SERVER_ROOT / "run_30b_api_task.cmd"
ACCOUNT_WRAPPER = ACCOUNT_ROOT / "run_account_service_task.cmd"
API_TASK = "BelgoBase API Server 8770"
ACCOUNT_TASK = "BelgoBase Account Service 8765"
DAILY_TASK = "BelgoBase VPS Daily NBB Master Pipeline"
API_PORT = 8770
ACCOUNT_PORT = 8765
PYTHON = Path(r"C:\Tools\Python313_3.13.15\python.exe")
SECRETS = {
    "auth": Path(r"C:\BelgoBase_App\secrets\web_auth\auth_secret.bin"),
    "proof": Path(r"C:\BelgoBase_App\secrets\web_auth\account_internal_proof.bin"),
    "mail": Path(r"C:\BelgoBase_App\secrets\web_auth\mail_ed25519.pem"),
}
MAINTENANCE_MUTEX = "Global\\BelgoBaseDailyDataDeployment"
CUTOVER = PIPELINE_ROOT / "daily_api_maintenance_dual_cutover.py"
CURRENT_31H = PIPELINE_ROOT / "31H_build_nbb_enrichment_candidate_from_31F_STAGING_PC1.py"
CUTOVER_PREIMAGE_SHA256 = "ca48ba66e1f07fa9693684b26a74ed99dcfae850526b1731702aa4d648fe2a8b"
CUTOVER_PATCHED_SHA256 = "13ec83697156a07481d7e5cbc29f3937c38f0023ed58815bf60543cc25079c6b"
CURRENT_31H_SHA256 = "a5cfa0fc7792bcab89dfb6067b38a971de3876a9417ec666c07a8382f6375549"


class DeployError(RuntimeError):
    pass


def need(value: bool, message: str) -> None:
    if not value:
        raise DeployError(message)


def sha(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def emit(event: str, **values) -> None:
    print(json.dumps({"event": event, **values}, ensure_ascii=False), flush=True)


def patch_server_wrapper(text: str) -> str:
    marker = "@echo off\n"
    need(text.replace("\r\n", "\n").startswith(marker), "server_wrapper_shape_drift")
    normalized = text.replace("\r\n", "\n")
    need("BELGOBASE_WEB_ENABLED" not in normalized, "server_wrapper_already_has_web_config")
    additions = (
        'set "BELGOBASE_WEB_ENABLED=1"\n'
        'set "BELGOBASE_WEB_AUTH_SECRET_FILE=C:\\BelgoBase_App\\secrets\\web_auth\\auth_secret.bin"\n'
        'set "BELGOBASE_WEB_MAIL_PRIVATE_KEY_FILE=C:\\BelgoBase_App\\secrets\\web_auth\\mail_ed25519.pem"\n'
        'set "BELGOBASE_ACCOUNT_INTERNAL_PROOF_FILE=C:\\BelgoBase_App\\secrets\\web_auth\\account_internal_proof.bin"\n'
        'set "BELGOBASE_WEB_MAIL_RELAY_URL=https://www.belgobase.com/api/web/mail"\n'
        'set "BELGOBASE_WEB_ALLOWED_ORIGINS=https://www.belgobase.com"\n'
        'set "BELGOBASE_WEB_PRODUCTION=1"\n'
        'set "BELGOBASE_ACCOUNT_INTERNAL_URL=http://127.0.0.1:8765"\n'
        'set "BELGOBASE_WEB_WORKSPACE_ROOT=C:\\BelgoBase_App\\web_workspace"\n'
        'set "BELGOBASE_WEB_DOWNLOAD_ROOT=C:\\BelgoBase_App\\web_downloads"\n'
    )
    return (marker + additions + normalized[len(marker) :]).replace("\n", "\r\n")


def patch_account_wrapper(text: str) -> str:
    normalized = text.replace("\r\n", "\n")
    marker = 'set "BELGOBASE_ACCEPTANCE_SIGNING_KEY=C:\\BelgoBase_App\\secrets\\acceptance_receipt_ed25519_build60.pem"\n'
    need(normalized.count(marker) == 1, "account_wrapper_shape_drift")
    need("BELGOBASE_ACCOUNT_INTERNAL_PROOF_FILE" not in normalized, "account_wrapper_already_has_web_config")
    addition = 'set "BELGOBASE_ACCOUNT_INTERNAL_PROOF_FILE=C:\\BelgoBase_App\\secrets\\web_auth\\account_internal_proof.bin"\n'
    return normalized.replace(marker, marker + addition).replace("\n", "\r\n")


def scheduler():
    import win32com.client
    service = win32com.client.Dispatch("Schedule.Service")
    service.Connect()
    return service


def task(service, name: str, wrapper: Path):
    current = service.GetFolder("\\").GetTask(name)
    need(str(current.Name) == name, f"task_missing:{name}")
    need(str(current.Definition.Principal.UserId).upper() in {"SYSTEM", "S-1-5-18"}, f"task_identity_drift:{name}")
    actions = list(current.Definition.Actions)
    need(len(actions) == 1 and actions[0].Type == 0, f"task_action_shape_drift:{name}")
    need(str(wrapper).lower() in str(actions[0].Arguments).lower(), f"task_wrapper_drift:{name}")
    return current


def process_rows() -> list[dict]:
    import win32com.client
    rows = win32com.client.GetObject(r"winmgmts:\\.\root\cimv2").ExecQuery(
        "SELECT ProcessId,ParentProcessId,ExecutablePath,CommandLine FROM Win32_Process"
    )
    return [
        {
            "pid": int(row.ProcessId),
            "parent": int(row.ParentProcessId),
            "exe": str(row.ExecutablePath or ""),
            "cmd": str(row.CommandLine or ""),
        }
        for row in rows
    ]


def listener_pids(port: int) -> list[int]:
    import win32com.client
    rows = win32com.client.GetObject(r"winmgmts:\\.\root\StandardCimv2").ExecQuery(
        f"SELECT LocalAddress,OwningProcess FROM MSFT_NetTCPConnection WHERE LocalPort={int(port)} AND State=2"
    )
    result = []
    for row in rows:
        need(str(row.LocalAddress) in {"127.0.0.1", "::1"}, f"unexpected_listener_address:{port}")
        result.append(int(row.OwningProcess))
    return sorted(set(result))


def verify_listener(port: int, script: Path, required: bool) -> int | None:
    pids = listener_pids(port)
    if not pids:
        need(not required, f"listener_missing:{port}")
        return None
    need(len(pids) == 1, f"listener_count_invalid:{port}")
    row = next((item for item in process_rows() if item["pid"] == pids[0]), None)
    if row is None and not required and not listener_pids(port):
        return None  # Process exited between the socket and process snapshots.
    need(row is not None, f"listener_process_missing:{port}")
    need(os.path.normcase(str(PYTHON)) == os.path.normcase(row["exe"]), f"listener_python_drift:{port}")
    need(str(script).lower() in row["cmd"].lower(), f"listener_command_drift:{port}")
    return pids[0]


def descendants(rows: list[dict], root_pid: int) -> list[dict]:
    found, frontier = [], {root_pid}
    while frontier:
        children = [row for row in rows if row["parent"] in frontier and row not in found]
        found.extend(children)
        frontier = {row["pid"] for row in children}
    return found


def serialization_state() -> tuple[str, str]:
    current = sha(CUTOVER) if CUTOVER.is_file() else ""
    state = (
        "ready" if current == CUTOVER_PATCHED_SHA256 else
        "patchable" if current == CUTOVER_PREIMAGE_SHA256 else "drift"
    )
    return current, state


def serialized_restart_safe(
    state: str, serialization_hash: str, current_31h_verified: bool
) -> bool:
    if serialization_hash not in {CUTOVER_PREIMAGE_SHA256, CUTOVER_PATCHED_SHA256}:
        return False
    return state == "idle" or (state == "running_31h" and current_31h_verified)


def daily_stage(service) -> dict:
    current = task(service, DAILY_TASK, Path(r"C:\BelgoBase_App\pipeline\31K_vps_daily_master_task.ps1"))
    serialization_hash, serialization = serialization_state()
    if current.State == 3:
        return {
            "state": "idle",
            "safe": serialized_restart_safe("idle", serialization_hash, False),
            "serialization": serialization,
            "current_31h_source_verified": False,
        }
    need(current.State == 4, "daily_task_state_unknown")
    rows = process_rows()
    masters = [row for row in rows if "31k_belgobase_vps_daily_master_pipeline.py" in row["cmd"].lower()]
    need(len(masters) == 1, "daily_master_process_unknown")
    lock = Path(r"C:\BelgoBase_App\pipeline\31K_vps_daily_master_output\31K_vps_daily_master.lock")
    need(lock.is_file(), "daily_lock_missing")
    lock_value = json.loads(lock.read_text(encoding="utf-8"))
    need(int(lock_value.get("pid", -1)) == masters[0]["pid"], "daily_lock_owner_mismatch")
    children = descendants(rows, masters[0]["pid"])
    commands = [row["cmd"].lower() for row in children]
    stage_31h = any("31h_build_nbb_enrichment_candidate" in value for value in commands)
    if stage_31h:
        need(CURRENT_31H.is_file() and sha(CURRENT_31H) == CURRENT_31H_SHA256, "daily_31h_source_drift")
    state = "running_31h" if stage_31h else "running_other_stage"
    return {
        "state": state,
        "safe": serialized_restart_safe(state, serialization_hash, stage_31h),
        "serialization": serialization,
        "current_31h_source_verified": bool(stage_31h),
        "master_pid": masters[0]["pid"],
    }


def verify_preimages(contract: dict) -> None:
    for name, expected in contract["vps_preimage_sha256"].items():
        path = SERVER_ROOT / name
        need(path.is_file() and sha(path) == expected, f"server_preimage_drift:{name}")
    for name, expected in contract["account_preimage_sha256"].items():
        path = ACCOUNT_ROOT / name
        need(path.is_file() and sha(path) == expected, f"account_preimage_drift:{name}")
    need(sha(SERVER_WRAPPER) == contract["wrapper_preimage_sha256"]["server"], "server_wrapper_hash_drift")
    need(sha(ACCOUNT_WRAPPER) == contract["wrapper_preimage_sha256"]["account"], "account_wrapper_hash_drift")
    serialization = contract.get("daily_serialization") or {}
    need(
        serialization == {
            "preimage_sha256": CUTOVER_PREIMAGE_SHA256,
            "candidate_sha256": CUTOVER_PATCHED_SHA256,
            "wait_milliseconds": 600000,
            "current_31h_sha256": CURRENT_31H_SHA256,
        },
        "daily_serialization_contract_invalid",
    )
    need(
        CUTOVER.is_file() and sha(CUTOVER) in {CUTOVER_PREIMAGE_SHA256, CUTOVER_PATCHED_SHA256},
        "daily_cutover_preimage_drift",
    )


def verify_secrets() -> None:
    need(SECRETS["auth"].is_file() and SECRETS["auth"].stat().st_size >= 32, "auth_secret_missing")
    need(SECRETS["proof"].is_file(), "internal_proof_missing")
    validate_internal_proof(SECRETS["proof"].read_bytes())
    need(SECRETS["mail"].is_file(), "mail_key_missing")
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives.serialization import load_pem_private_key
    need(isinstance(load_pem_private_key(SECRETS["mail"].read_bytes(), password=None), Ed25519PrivateKey), "mail_key_invalid")


def validate_internal_proof(raw: bytes) -> None:
    """Validate the shared proof exactly as a safe HTTP header value."""
    try:
        value = raw.decode("ascii")
    except UnicodeDecodeError as error:
        raise DeployError("internal_proof_not_ascii") from error
    need(32 <= len(value) <= 256, "internal_proof_length_invalid")
    need(value == value.strip(), "internal_proof_whitespace_invalid")
    need(all(0x21 <= ord(character) <= 0x7E for character in value), "internal_proof_header_invalid")


def read_bundle(contract: dict) -> bytes:
    size = int(contract["bundle_size"])
    need(0 <= size <= 16 * 1024 * 1024, "bundle_size_invalid")
    raw = sys.stdin.buffer.read(size)
    need(len(raw) == size and hashlib.sha256(raw).hexdigest() == contract["bundle_sha256"], "bundle_hash_invalid")
    need(not sys.stdin.buffer.read(1), "bundle_trailing_bytes")
    return raw


def stage_bundle(raw: bytes, contract: dict, run_id: str) -> Path:
    root = STAGING_ROOT / f"web_runtime_{run_id}"
    root.mkdir(parents=True, exist_ok=False)
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        names = sorted(archive.namelist())
        need(names == sorted(contract["file_sha256"]), "bundle_file_set_invalid")
        for name in names:
            item = PurePosixPath(name)
            need(not item.is_absolute() and ".." not in item.parts, "bundle_path_invalid")
            target = root.joinpath(*item.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            data = archive.read(name)
            need(hashlib.sha256(data).hexdigest() == contract["file_sha256"][name], f"bundle_member_hash_invalid:{name}")
            target.write_bytes(data)
    for path in root.rglob("*.py"):
        py_compile.compile(str(path), doraise=True)
    return root


def backup_database(target: Path) -> None:
    source = sqlite3.connect(f"file:{DATABASE.as_posix()}?mode=ro", uri=True, timeout=30)
    destination = sqlite3.connect(target)
    try:
        source.backup(destination)
        need(destination.execute("PRAGMA quick_check").fetchone()[0] == "ok", "database_backup_quick_check_failed")
    finally:
        destination.close()
        source.close()


def destination(archive_name: str) -> Path:
    parts = PurePosixPath(archive_name).parts
    need(parts and parts[0] in {"server", "account", "pipeline"}, "candidate_destination_invalid")
    root = {
        "server": SERVER_ROOT,
        "account": ACCOUNT_ROOT,
        "pipeline": PIPELINE_ROOT,
    }[parts[0]]
    return root.joinpath(*parts[1:])


def make_backup(contract: dict, run_id: str) -> tuple[Path, dict]:
    root = BACKUP_ROOT / f"web_runtime_{run_id}"
    root.mkdir(parents=True, exist_ok=False)
    records = {}
    touched = list(contract["file_sha256"]) + ["server/run_30b_api_task.cmd", "account/run_account_service_task.cmd"]
    for name in touched:
        source = destination(name)
        record = {"existed": source.is_file(), "sha256": sha(source) if source.is_file() else None}
        records[name] = record
        if source.is_file():
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    backup_database(root / "licenses.sqlite3")
    (root / "backup_manifest.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    return root, records


def atomic_write(target: Path, raw: bytes) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.parent / f".{target.name}.{uuid.uuid4().hex}.tmp"
    with temporary.open("xb") as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, target)


def install(stage: Path, contract: dict) -> None:
    for name, expected in contract["file_sha256"].items():
        if name.startswith("pipeline/"):
            continue
        source = stage.joinpath(*PurePosixPath(name).parts)
        target = destination(name)
        atomic_write(target, source.read_bytes())
        need(sha(target) == expected, f"installed_hash_invalid:{name}")
    atomic_write(SERVER_WRAPPER, patch_server_wrapper(SERVER_WRAPPER.read_text(encoding="utf-8-sig")).encode("utf-8"))
    atomic_write(ACCOUNT_WRAPPER, patch_account_wrapper(ACCOUNT_WRAPPER.read_text(encoding="utf-8-sig")).encode("utf-8"))


def install_daily_serialization(stage: Path, contract: dict) -> bool:
    name = "pipeline/daily_api_maintenance_dual_cutover.py"
    expected = contract["file_sha256"].get(name)
    need(expected == CUTOVER_PATCHED_SHA256, "daily_serialization_bundle_invalid")
    before = sha(CUTOVER)
    if before == CUTOVER_PATCHED_SHA256:
        return False
    need(before == CUTOVER_PREIMAGE_SHA256, "daily_cutover_changed_before_patch")
    source = stage.joinpath(*PurePosixPath(name).parts)
    atomic_write(CUTOVER, source.read_bytes())
    need(sha(CUTOVER) == CUTOVER_PATCHED_SHA256, "daily_serialization_patch_failed")
    return True


def stop_task(service, name: str, wrapper: Path, port: int, script: Path) -> None:
    current = task(service, name, wrapper)
    need(current.State == 4, f"task_not_running_before_stop:{name}")
    verify_listener(port, script, True)
    current.Stop(0)
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        current = task(service, name, wrapper)
        if current.State == 3 and verify_listener(port, script, False) is None:
            return
        time.sleep(0.5)
    raise DeployError(f"task_stop_timeout:{name}")


def start_task(service, name: str, wrapper: Path, port: int, script: Path) -> None:
    current = task(service, name, wrapper)
    need(current.State == 3 and verify_listener(port, script, False) is None, f"task_not_ready_before_start:{name}")
    current.Run(None)
    deadline = time.monotonic() + 35
    while time.monotonic() < deadline:
        current = task(service, name, wrapper)
        if current.State == 4 and verify_listener(port, script, False) is not None:
            return
        time.sleep(0.5)
    raise DeployError(f"task_start_timeout:{name}")


def request(
    port: int,
    method: str,
    route: str,
    body: dict | None = None,
    extra_headers: dict[str, str] | None = None,
    response_limit: int = 8192,
) -> tuple[int, dict]:
    raw = None if body is None else json.dumps(body).encode("utf-8")
    headers = {} if raw is None else {"Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
    try:
        connection.request(method, route, body=raw, headers=headers)
        response = connection.getresponse()
        need(1024 <= response_limit <= 65536, "probe_response_limit_invalid")
        data = response.read(response_limit + 1)
        need(len(data) <= response_limit, "probe_response_too_large")
        return response.status, json.loads(data)
    finally:
        connection.close()


def projection_canary_identity(database: Path = DATABASE) -> dict[str, str]:
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    connection = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True, timeout=10)
    connection.row_factory = sqlite3.Row
    try:
        row = connection.execute(
            """WITH receipt_licenses AS (
                   SELECT license_id FROM web_legal_acceptance_receipts
                   UNION SELECT license_id FROM legal_acceptance_receipts
                   UNION SELECT license_id FROM text_legal_acceptance_receipts
               )
               SELECT p.license_id,l.customer_id,p.support_email
               FROM license_customer_profiles AS p
               JOIN licenses AS l ON l.license_id=p.license_id
               JOIN receipt_licenses AS r ON r.license_id=p.license_id
               WHERE l.status='active'
                 AND (l.starts_at IS NULL OR l.starts_at<=?)
                 AND (l.expires_at IS NULL OR l.expires_at>?)
               ORDER BY p.license_id LIMIT 1""",
            (now, now),
        ).fetchone()
    finally:
        connection.close()
    need(row is not None, "account_projection_canary_identity_missing")
    return {
        "principal_type": "web",
        "license_id": str(row["license_id"]),
        "customer_id": str(row["customer_id"]),
        "email": str(row["support_email"]),
    }


def canaries() -> dict:
    status, account = request(ACCOUNT_PORT, "GET", "/account/me")
    need(status == 401 and account.get("error") == "device_auth_invalid", "account_canary_failed")
    status, internal = request(
        ACCOUNT_PORT,
        "POST",
        "/internal/web-enrollment/prepare",
        {"license_code": "BB2-" + "A" * 43, "email": "canary@example.invalid"},
    )
    need(status == 401 and internal.get("error") == "internal_proof_invalid", "account_web_extension_canary_failed")
    proof = SECRETS["proof"].read_bytes().decode("ascii")
    status, projected = request(
        ACCOUNT_PORT,
        "POST",
        "/internal/web-account/project",
        {"auth_context": projection_canary_identity(), "payload": {"action": "refresh"}},
        {"X-BelgoBase-Internal-Proof": proof},
        65536,
    )
    need(
        status == 200 and projected.get("ok") is True and isinstance(projected.get("rows"), list),
        "account_projection_canary_failed",
    )
    status, health = request(API_PORT, "GET", "/health")
    need(status == 200 and health.get("ok") is True, "api_health_canary_failed")
    status, web = request(API_PORT, "GET", "/web/auth/session")
    need(status == 401 and web.get("error") == "session_invalid", "web_runtime_canary_failed")
    return {
        "account": True,
        "account_web_extension": True,
        "account_projection": True,
        "api": True,
        "web_session_boundary": True,
    }


def restore(backup: Path, records: dict) -> None:
    for name, record in records.items():
        if name.startswith("pipeline/"):
            # The bounded wait is a permanent serialization safety fix. Keeping
            # it also protects a cutover process that may already have loaded it.
            continue
        target = destination(name)
        source = backup / name
        if record["existed"]:
            atomic_write(target, source.read_bytes())
            need(sha(target) == record["sha256"], f"rollback_hash_invalid:{name}")
        elif target.exists():
            need(target.is_file(), f"rollback_new_path_not_file:{name}")
            target.unlink()


def main() -> int:
    contract = json.loads(sys.stdin.buffer.readline())
    raw = read_bundle(contract)
    run_id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "_" + uuid.uuid4().hex[:8]
    service = scheduler()
    verify_preimages(contract)
    verify_secrets()
    need(DATABASE.is_file(), "license_database_missing")
    task(service, API_TASK, SERVER_WRAPPER)
    task(service, ACCOUNT_TASK, ACCOUNT_WRAPPER)
    stage = daily_stage(service)
    verify_listener(API_PORT, SERVER_ROOT / "30b_belgobase_windows_vps_api_server.py", True)
    verify_listener(ACCOUNT_PORT, ACCOUNT_ROOT / "run_account_service_production.py", True)
    if contract.get("action") == "preflight":
        emit(
            "result",
            status="PREFLIGHT_OK",
            changed=False,
            daily=stage,
            serialization_patch_required=sha(CUTOVER) != CUTOVER_PATCHED_SHA256,
        )
        return 0
    need(contract.get("action") == "deploy", "action_invalid")
    need(stage["safe"], "daily_stage_not_safe_for_serialized_restart")
    staged = stage_bundle(raw, contract, run_id)
    backup, records = make_backup(contract, run_id)
    serialization_updated = install_daily_serialization(staged, contract)
    import win32event
    mutex = win32event.CreateMutex(None, False, MAINTENANCE_MUTEX)
    acquired = False
    changed = False
    api_stopped = False
    account_stopped = False
    try:
        acquired = win32event.WaitForSingleObject(mutex, 0) in (win32event.WAIT_OBJECT_0, win32event.WAIT_ABANDONED)
        need(acquired, "daily_data_cutover_mutex_busy")
        refreshed_stage = daily_stage(service)
        need(refreshed_stage["safe"], "daily_stage_changed_before_restart")
        need(sha(CUTOVER) == CUTOVER_PATCHED_SHA256, "daily_serialization_not_active")
        api_stopped = True
        stop_task(service, API_TASK, SERVER_WRAPPER, API_PORT, SERVER_ROOT / "30b_belgobase_windows_vps_api_server.py")
        account_stopped = True
        stop_task(service, ACCOUNT_TASK, ACCOUNT_WRAPPER, ACCOUNT_PORT, ACCOUNT_ROOT / "run_account_service_production.py")
        changed = True
        install(staged, contract)
        start_task(service, ACCOUNT_TASK, ACCOUNT_WRAPPER, ACCOUNT_PORT, ACCOUNT_ROOT / "run_account_service_production.py")
        account_stopped = False
        start_task(service, API_TASK, SERVER_WRAPPER, API_PORT, SERVER_ROOT / "30b_belgobase_windows_vps_api_server.py")
        api_stopped = False
        proof = canaries()
        result = {
            "status": "DEPLOYED_WEB_ENABLED",
            "changed": True,
            "run_id": run_id,
            "backup": str(backup),
            "daily_serialization": "updated" if serialization_updated else "already_ready",
            "canaries": proof,
        }
        (backup / "deployment_result.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        emit("result", **result)
        return 0
    except Exception as error:
        rollback = {"attempted": changed, "ok": False}
        if changed:
            try:
                api = task(service, API_TASK, SERVER_WRAPPER)
                if api.State == 4:
                    stop_task(service, API_TASK, SERVER_WRAPPER, API_PORT, SERVER_ROOT / "30b_belgobase_windows_vps_api_server.py")
                account = task(service, ACCOUNT_TASK, ACCOUNT_WRAPPER)
                if account.State == 4:
                    stop_task(service, ACCOUNT_TASK, ACCOUNT_WRAPPER, ACCOUNT_PORT, ACCOUNT_ROOT / "run_account_service_production.py")
                restore(backup, records)
                if task(service, ACCOUNT_TASK, ACCOUNT_WRAPPER).State == 3:
                    start_task(service, ACCOUNT_TASK, ACCOUNT_WRAPPER, ACCOUNT_PORT, ACCOUNT_ROOT / "run_account_service_production.py")
                if task(service, API_TASK, SERVER_WRAPPER).State == 3:
                    start_task(service, API_TASK, SERVER_WRAPPER, API_PORT, SERVER_ROOT / "30b_belgobase_windows_vps_api_server.py")
                rollback = {"attempted": True, "ok": True}
            except Exception as rollback_error:
                rollback = {"attempted": True, "ok": False, "error": str(rollback_error)}
        elif api_stopped or account_stopped:
            try:
                if account_stopped and task(service, ACCOUNT_TASK, ACCOUNT_WRAPPER).State == 3:
                    start_task(service, ACCOUNT_TASK, ACCOUNT_WRAPPER, ACCOUNT_PORT, ACCOUNT_ROOT / "run_account_service_production.py")
                if api_stopped and task(service, API_TASK, SERVER_WRAPPER).State == 3:
                    start_task(service, API_TASK, SERVER_WRAPPER, API_PORT, SERVER_ROOT / "30b_belgobase_windows_vps_api_server.py")
                rollback = {"attempted": True, "ok": True, "code_unchanged": True}
            except Exception as rollback_error:
                rollback = {"attempted": True, "ok": False, "code_unchanged": True, "error": str(rollback_error)}
        emit(
            "error",
            message=str(error),
            changed=bool(changed or serialization_updated),
            backup=str(backup),
            daily_serialization=(
                "updated_and_retained" if serialization_updated else "already_ready"
            ),
            rollback=rollback,
        )
        return 2
    finally:
        if acquired:
            win32event.ReleaseMutex(mutex)
        mutex.Close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        emit("error", message=f"{type(error).__name__}:{error}", changed=False)
        raise SystemExit(2)
