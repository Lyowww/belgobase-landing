"""Deploy the reviewed BelgoBase web runtime through the existing WinRM helper.

The remote half owns the fixed production paths and recovery procedure.  This
launcher verifies the two generated candidates, streams one bounded ZIP and
never prints credentials or secret material.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VPS_CANDIDATE = ROOT / "tools" / "generated_vps_candidate_release_ready_auth"
ACCOUNT_CANDIDATE = ROOT / "tools" / "generated_account_enrollment_candidate_release_ready_firstuse"
REMOTE_SCRIPT = ROOT / "tools" / "deploy_web_runtime_remote.py"
CUTOVER_PREIMAGE = ROOT / ".local" / "daily_api_maintenance_dual_cutover.py"
VPS_HELPER_ROOT = Path(
    r"C:\Users\David1\Desktop\1 codes\BelgoBase_CENTRAAL\BelgoBase_Project\TOOLS\draaiboek_pc1"
)
EXPECTED_MANIFESTS = {
    "vps": "899508d6c0b6fd6fd7b9aa592c1528ac513157c9cddf56c522531b8bfc99f962",
    "account": "a7ffe655f045cdfac8ab466ea53a9e708c6f04c3d3119821a2532716eb215e17",
}
EXPECTED_WRAPPERS = {
    "server": "a7a915e72edc0b49ab992219614f20e7460431f5fab61566a3569e2200edef99",
    "account": "b9f05797bf7c6a35ab6cd90512fc1f59f85976871f9c5511cf3e6b05b73037fb",
}
CUTOVER_PREIMAGE_SHA256 = "ca48ba66e1f07fa9693684b26a74ed99dcfae850526b1731702aa4d648fe2a8b"
CUTOVER_PATCHED_SHA256 = "13ec83697156a07481d7e5cbc29f3937c38f0023ed58815bf60543cc25079c6b"
CUTOVER_WAIT_OLD = b"win32event.WaitForSingleObject(mutex, 0)"
CUTOVER_WAIT_NEW = b"win32event.WaitForSingleObject(mutex, 600000)"
CURRENT_31H_SHA256 = "a5cfa0fc7792bcab89dfb6067b38a971de3876a9417ec666c07a8382f6375549"


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def load_manifest(root: Path, expected: str) -> dict:
    path = root / "manifest.json"
    if sha256(path) != expected:
        raise RuntimeError(f"candidate manifest drift: {path}")
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or value.get("production_modified") is not False:
        raise RuntimeError(f"candidate manifest is invalid: {path}")
    return value


def candidate_files() -> tuple[dict[str, bytes], dict]:
    vps = load_manifest(VPS_CANDIDATE, EXPECTED_MANIFESTS["vps"])
    account = load_manifest(ACCOUNT_CANDIDATE, EXPECTED_MANIFESTS["account"])
    if (
        account.get("channel") != "web-b2b"
        or account.get("consumer_registration") != "blocked-no-compatible-legal-bundle"
    ):
        raise RuntimeError("account candidate B2B legal-channel contract drift")
    files: dict[str, bytes] = {}
    for name, expected in vps["candidate_sha256"].items():
        raw = (VPS_CANDIDATE / name).read_bytes()
        if sha256_bytes(raw) != expected:
            raise RuntimeError(f"VPS candidate drift: {name}")
        files[f"server/{name}"] = raw
    for relative, expected in vps["backend_sha256"].items():
        raw = (VPS_CANDIDATE / relative).read_bytes()
        if sha256_bytes(raw) != expected:
            raise RuntimeError(f"VPS backend candidate drift: {relative}")
        files[f"server/{relative}"] = raw
    for name, expected in account["candidate_sha256"].items():
        raw = (ACCOUNT_CANDIDATE / name).read_bytes()
        if sha256_bytes(raw) != expected:
            raise RuntimeError(f"account candidate drift: {name}")
        files[f"account/{name}"] = raw
    cutover = CUTOVER_PREIMAGE.read_bytes()
    if sha256_bytes(cutover) != CUTOVER_PREIMAGE_SHA256 or cutover.count(CUTOVER_WAIT_OLD) != 1:
        raise RuntimeError("daily cutover preimage drift")
    patched_cutover = cutover.replace(CUTOVER_WAIT_OLD, CUTOVER_WAIT_NEW, 1)
    if sha256_bytes(patched_cutover) != CUTOVER_PATCHED_SHA256:
        raise RuntimeError("daily cutover serialization candidate drift")
    files["pipeline/daily_api_maintenance_dual_cutover.py"] = patched_cutover
    return files, {"vps": vps, "account": account}


def build_bundle() -> tuple[bytes, dict]:
    files, manifests = candidate_files()
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in sorted(files):
            info = zipfile.ZipInfo(name, date_time=(2026, 9, 18, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o600 << 16
            archive.writestr(info, files[name])
    raw = output.getvalue()
    return raw, {
        "bundle_sha256": sha256_bytes(raw),
        "bundle_size": len(raw),
        "file_sha256": {name: sha256_bytes(value) for name, value in files.items()},
        "vps_preimage_sha256": manifests["vps"]["preimage_sha256"],
        "account_preimage_sha256": manifests["account"]["preimage_sha256"],
        "wrapper_preimage_sha256": EXPECTED_WRAPPERS,
        "daily_serialization": {
            "preimage_sha256": CUTOVER_PREIMAGE_SHA256,
            "candidate_sha256": CUTOVER_PATCHED_SHA256,
            "wait_milliseconds": 600000,
            "current_31h_sha256": CURRENT_31H_SHA256,
        },
    }


def validate_current_backend(contract: dict, root: Path = ROOT) -> None:
    """Never let a historical full-runtime bundle undo newer backend fixes."""
    files = contract.get("file_sha256", {})
    backend = {name: digest for name, digest in files.items() if name.startswith("server/backend/")}
    if not backend:
        raise RuntimeError("runtime bundle has no backend provenance")
    for name, expected in backend.items():
        relative = Path(name).relative_to("server")
        source = root / relative
        if not source.is_file() or sha256(source) != expected:
            raise RuntimeError(f"historical runtime candidate differs from current source: {relative}; prepare a newly reviewed candidate or use the current narrow patch route")


def remote_call(action: str) -> dict:
    bundle, contract = build_bundle()
    validate_current_backend(contract)
    if action == "preflight":
        bundle = b""
        contract["bundle_size"] = 0
        contract["bundle_sha256"] = sha256_bytes(bundle)
    contract["action"] = action
    if str(VPS_HELPER_ROOT) not in sys.path:
        sys.path.insert(0, str(VPS_HELPER_ROOT))
    from vps_verbinding import REMOTE_PYTHON, Vps  # type: ignore

    vps = Vps(lambda message: print(message), lambda _value: None)
    vps.connect()
    protocol = vps.protocol
    source = REMOTE_SCRIPT.read_bytes()
    bootstrap = "import sys;exec(sys.stdin.buffer.read(int(sys.stdin.buffer.readline())))"
    shell = protocol.open_shell(codepage=65001, env_vars={"PYTHONDONTWRITEBYTECODE": "1"})
    command = None
    ended = False
    try:
        command = protocol.run_command(
            shell,
            REMOTE_PYTHON,
            [subprocess.list2cmdline(["-B", "-X", "utf8", "-u", "-c", bootstrap])],
            console_mode_stdin=False,
            skip_cmd_shell=True,
        )
        header = str(len(source)).encode("ascii") + b"\n" + source + json.dumps(contract).encode("utf-8") + b"\n"
        for offset in range(0, len(header), 32768):
            protocol.send_command_input(shell, command, header[offset : offset + 32768], end=False)
        for offset in range(0, len(bundle), 65536):
            protocol.send_command_input(shell, command, bundle[offset : offset + 65536], end=False)
        protocol.send_command_input(shell, command, b"", end=True)
        stdout, stderr, code = protocol.get_command_output(shell, command)
        ended = True
        events = [json.loads(line) for line in stdout.decode("utf-8").splitlines() if line.strip()]
        result = next((item for item in reversed(events) if item.get("event") == "result"), None)
        failure = next((item for item in reversed(events) if item.get("event") == "error"), None)
        if code or failure or result is None:
            detail = json.dumps(failure, ensure_ascii=False) if failure else stderr.decode("utf-8", errors="replace")[:600]
            raise RuntimeError(f"web runtime deployment failed: {detail}")
        return result
    finally:
        if ended and command is not None:
            protocol.cleanup_command(shell, command)
            protocol.close_shell(shell, close_session=False)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--preflight", action="store_true")
    mode.add_argument("--deploy", action="store_true")
    args = parser.parse_args()
    action = "deploy" if args.deploy else "preflight"
    result = remote_call(action)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
