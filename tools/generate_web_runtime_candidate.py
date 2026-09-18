from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PREIMAGE = ROOT / ".local" / "preimage"
DEFAULT_OUTPUT = ROOT / "tools" / "generated_vps_candidate"
EXPECTED_SHA256 = {
    "30b_belgobase_windows_vps_api_server.py": "6757d6de5972df7e43c4d81839f7879df12a10f8648497ffd9e4575548433961",
    "belgobase_authorization_45a.py": "3936e516e34c644a07785293aaac3a1dbe9f569766f1cee7c5939882b06caf7a",
    "belgobase_device_registry_43a.py": "ddd44fe12657f85bea0b84589849660ecf6684fb5a683e8b269595cc7d18bb22",
    "belgobase_license_registry_42a.py": "6a2c7822902994269cf0b270355f77fe5d5fdc3b6d3afaf017c04b462ee6820f",
    "belgobase_usage_limits_46a.py": "bd61dc186570de35628e354247bba6efa90459f229c0dc195ac811446a95914b",
    "belgobase_premium_ai_server.py": "7bd5f835d8654edfedfdaef8455954ed1dd52bc3ae51e78c11e76d8f1a99d8d2",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    amount = text.count(old)
    if amount != 1:
        raise RuntimeError(f"{label}: expected one exact match, found {amount}")
    return text.replace(old, new, 1)


def patch_device(text: str) -> str:
    text = replace_once(
        text,
        "from belgobase_device_protocol_43a import activation_message, deactivation_message, token_message\n",
        "from belgobase_device_protocol_43a import activation_message, deactivation_message, token_message\n"
        "from backend.seat_policy import count_all_allocated\n",
        "device seat-policy import",
    )
    text = replace_once(
        text,
        """            allocated = connection.execute(
                "SELECT COUNT(*) FROM devices WHERE license_id = ? AND status IN ('active','suspended')",
                (license_row["license_id"],),
            ).fetchone()[0]
""",
        """            allocated = count_all_allocated(
                connection, license_row["license_id"], current_text
            )
""",
        "new Windows activation combined seat count",
    )
    text = replace_once(
        text,
        """            allocated = connection.execute(
                "SELECT COUNT(*) FROM devices WHERE license_id = ? AND status IN ('active','suspended') AND device_id <> ?",
                (row["license_id"], normalized),
            ).fetchone()[0]
""",
        """            allocated = count_all_allocated(
                connection, row["license_id"], current_text,
                exclude_device_id=normalized,
            )
""",
        "Windows reactivation combined seat count",
    )
    return text


def patch_license(text: str) -> str:
    text = replace_once(
        text,
        "from typing import Any\n",
        "from typing import Any\n\nfrom backend.seat_policy import count_all_allocated\n",
        "license seat-policy import",
    )
    old = """def _allocated_device_count(connection: sqlite3.Connection, license_id: str) -> int:
    table = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='devices'"
    ).fetchone()
    if table is None:
        return 0
    return int(
        connection.execute(
            "SELECT COUNT(*) FROM devices WHERE license_id=? AND status IN ('active','suspended')",
            (license_id,),
        ).fetchone()[0]
    )
"""
    new = """def _allocated_device_count(connection: sqlite3.Connection, license_id: str) -> int:
    table = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='devices'"
    ).fetchone()
    if table is None:
        return 0
    return count_all_allocated(connection, license_id, iso_utc())
"""
    return replace_once(text, old, new, "licence update combined seat count")


def patch_usage(text: str) -> str:
    return replace_once(
        text,
        '            device_id = str(context.get("device_id") or "")\n',
        """            device_id = str(
                context.get("device_id") or context.get("quota_subject_id") or ""
            )
            if not device_id:
                raise UsageLimitExceeded("usage_subject_missing", status=403)
""",
        "web usage subject fallback",
    )


def patch_authorization(text: str) -> str:
    marker = "\ndef customer_route_matrix() -> list[dict[str, Any]]:\n"
    addition = '''
def authorize_preauthenticated_customer(
    method: str,
    route: str,
    context: dict[str, Any],
    source_ip: str = "",
    decision_recorder: DecisionRecorder = record_authorization_decision,
) -> dict[str, Any]:
    """Authorize a live server-created web session against an existing route."""
    policy = resolve_route_policy(method, route)
    supplied = dict(context) if isinstance(context, dict) else {}
    if policy is None or policy.access_class != "customer":
        raise _context_error(AuthorizationDenied, AUTHORIZATION_ERROR, supplied)
    if (
        supplied.get("access_class") != "customer"
        or supplied.get("principal_type") != "web"
        or not str(supplied.get("license_id") or "")
        or not str(supplied.get("customer_id") or "")
        or not str(supplied.get("user_id") or "")
        or not str(supplied.get("browser_id") or "")
        or not str(supplied.get("quota_subject_id") or "").startswith("web:")
    ):
        _record(decision_recorder, policy, method, route, False, "invalid_web_context", supplied, frozenset(), source_ip)
        raise _context_error(AuthenticationRequired, AUTHENTICATION_ERROR, supplied)
    scopes = effective_scopes(supplied)
    plan = str(supplied.get("plan") or "").strip().lower()
    if plan not in PLAN_SCOPE_CEILINGS or not policy.required_scopes.issubset(scopes):
        _record(decision_recorder, policy, method, route, False, "scope_denied", supplied, scopes, source_ip)
        raise _context_error(AuthorizationDenied, AUTHORIZATION_ERROR, supplied)
    authz_id = _record(decision_recorder, policy, method, route, True, "allowed", supplied, scopes, source_ip)
    result = dict(supplied)
    result["required_scopes"] = sorted(policy.required_scopes)
    result["effective_scopes"] = sorted(scopes)
    result["authorization_decision_id"] = authz_id
    return result

'''
    return replace_once(text, marker, "\n" + addition + marker.lstrip("\n"), "preauthenticated authorizer")


def patch_premium_ai(text: str) -> str:
    old = """        license_id, device_id = context.get('license_id'), context.get('device_id')
        if (context.get('access_class') != 'customer' or
                not all(isinstance(value, str) and 0 < len(value) <= 200 for value in (license_id, device_id))):
            fail(403, 'ai_access_denied', 'Meld je opnieuw aan om Slim Zoeken te gebruiken.')
"""
    new = """        license_id = context.get('license_id')
        if context.get('principal_type') == 'web':
            principal_id = context.get('quota_subject_id')
            principal_valid = (
                isinstance(principal_id, str)
                and principal_id.startswith('web:')
                and 4 < len(principal_id) <= 204
                and principal_id == context.get('principal_id')
            )
        else:
            principal_id = context.get('device_id')
            principal_valid = isinstance(principal_id, str) and 0 < len(principal_id) <= 200
        if (context.get('access_class') != 'customer'
                or not isinstance(license_id, str) or not 0 < len(license_id) <= 200
                or not principal_valid):
            fail(403, 'ai_access_denied', 'Meld je opnieuw aan om Slim Zoeken te gebruiken.')
"""
    text = replace_once(text, old, new, "premium AI browser principal authorization")
    return replace_once(
        text,
        "        owner = (license_id, device_id)\n",
        "        owner = (license_id, principal_id)\n",
        "premium AI session owner",
    )


def patch_main(text: str) -> str:
    text = replace_once(
        text,
        "from belgobase_update_trust_48a import verify_installer, verify_manifest_envelope\n",
        "from belgobase_update_trust_48a import verify_installer, verify_manifest_envelope\n"
        "from backend.runtime import (\n"
        "    DisabledWebRuntime, RuntimeConfigurationError,\n"
        "    build_web_runtime_from_environment,\n"
        ")\n",
        "main web runtime import",
    )
    text = replace_once(
        text,
        'BASE_URL = f"http://{HOST}:{PORT}"\n',
        'BASE_URL = f"http://{HOST}:{PORT}"\nWEB_RUNTIME = DisabledWebRuntime()\n',
        "main disabled runtime default",
    )
    get_hook = '''            web_result = WEB_RUNTIME.handle_base_request(self, "GET", source_ip)
            if web_result.handled:
                authorization_context = web_result.auth_context or {}
                return
'''
    text = replace_once(
        text,
        """        try:
            self.connection.settimeout(30)
            admin_validator = (
""",
        """        try:
            self.connection.settimeout(30)
""" + get_hook + """            admin_validator = (
""",
        "main GET web hook",
    )
    post_hook = '''            web_result = WEB_RUNTIME.handle_base_request(self, "POST", source_ip)
            if web_result.handled:
                authorization_context = web_result.auth_context or {}
                return
'''
    text = replace_once(
        text,
        """        try:
            self.connection.settimeout(60)
            authorization_context = authorize_route(
""",
        """        try:
            self.connection.settimeout(60)
""" + post_hook + """            authorization_context = authorize_route(
""",
        "main POST web hook",
    )
    text = replace_once(
        text,
        """def main() -> int:
    print("=== BELGOBASE 30B: WINDOWS VPS/SERVER 14ZA API SERVER ===")
""",
        """def main() -> int:
    global WEB_RUNTIME
    print("=== BELGOBASE 30B: WINDOWS VPS/SERVER 14ZA API SERVER ===")
""",
        "main global runtime",
    )
    text = replace_once(
        text,
        """    if not device_health.get("ready"):
        print("STATUS: FAIL - device registry niet klaar; server start niet.")
        return 1

    data_exists = INDEX_LATEST.exists()
""",
        """    if not device_health.get("ready"):
        print("STATUS: FAIL - device registry niet klaar; server start niet.")
        return 1
    try:
        WEB_RUNTIME = build_web_runtime_from_environment(sys.modules[__name__])
    except RuntimeConfigurationError:
        print("STATUS: FAIL - web runtime configuratie ongeldig; server start niet.")
        return 1

    data_exists = INDEX_LATEST.exists()
""",
        "main runtime construction",
    )
    return text


PATCHERS = {
    "30b_belgobase_windows_vps_api_server.py": patch_main,
    "belgobase_authorization_45a.py": patch_authorization,
    "belgobase_device_registry_43a.py": patch_device,
    "belgobase_license_registry_42a.py": patch_license,
    "belgobase_usage_limits_46a.py": patch_usage,
    "belgobase_premium_ai_server.py": patch_premium_ai,
}


def copy_backend(destination: Path) -> list[str]:
    source = ROOT / "backend"
    copied: list[str] = []
    for path in sorted(source.rglob("*")):
        if not path.is_file() or "__pycache__" in path.parts or "tests" in path.parts:
            continue
        if path.name == "account_enrollment_registry.py":
            continue
        relative = path.relative_to(source)
        target = destination / "backend" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        copied.append(str(Path("backend") / relative))
    return copied


def generate(output: Path) -> Path:
    output = output.resolve()
    tools_root = (ROOT / "tools").resolve()
    if tools_root not in output.parents:
        raise RuntimeError("output must stay below the repository tools directory")
    if output.exists():
        raise RuntimeError(f"output already exists: {output}")
    for name, expected in EXPECTED_SHA256.items():
        actual = sha256(PREIMAGE / name)
        if actual != expected:
            raise RuntimeError(f"preimage hash changed for {name}: {actual}")

    output.mkdir(parents=True)
    diffs: list[str] = []
    generated_hashes: dict[str, str] = {}
    for name, patcher in PATCHERS.items():
        source = PREIMAGE / name
        before = source.read_text(encoding="utf-8")
        after = patcher(before)
        target = output / name
        target.write_text(after, encoding="utf-8", newline="\n")
        generated_hashes[name] = sha256(target)
        diffs.extend(
            difflib.unified_diff(
                before.splitlines(keepends=True),
                after.splitlines(keepends=True),
                fromfile=f"preimage/{name}",
                tofile=f"candidate/{name}",
            )
        )

    backend_files = copy_backend(output)
    (output / "web_runtime.patch").write_text("".join(diffs), encoding="utf-8", newline="\n")
    manifest = {
        "kind": "local-unpublished-vps-web-runtime-candidate",
        "source": str(PREIMAGE.relative_to(ROOT)),
        "preimage_sha256": EXPECTED_SHA256,
        "candidate_sha256": generated_hashes,
        "backend_files": backend_files,
        "backend_sha256": {Path(name).as_posix(): sha256(output / name) for name in backend_files},
        "production_modified": False,
        "feature_default": "BELGOBASE_WEB_ENABLED=0",
        "known_gate": "requires the matching account-service candidate, deployment secrets and a fresh integration proof before enabling the feature",
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return output


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    result = generate(args.output)
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
