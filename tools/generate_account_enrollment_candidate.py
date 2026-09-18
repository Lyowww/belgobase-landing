from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PREIMAGE = ROOT / ".local" / "account_preimage"
DEFAULT_OUTPUT = ROOT / "tools" / "generated_account_enrollment_candidate"
EXPECTED = {
    "belgobase_account_registry_56a.py": "292507cc656a2c42b1352f1c165b97b2fe647208a04f27e421d424410f365adb",
    "belgobase_account_api_56a.py": "2e8c797ac7388665da5a94e745d99819fbde3d4346497b2424b1ffafb6d98d8f",
    "run_account_service_production.py": "ce0ed604328ed9c61f9052d6523c0af54b1ecf8224b7a89c73d22e48ac0a58dd",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one exact match, found {count}")
    return text.replace(old, new, 1)


def patch_api(text: str) -> str:
    text = replace_once(
        text,
        "from belgobase_license_registry_42a import LicenseValidationError\n",
        "from belgobase_license_registry_42a import LicenseValidationError\n"
        "from belgobase_web_enrollment_1a import (\n"
        "    WebEnrollmentUnavailable, cancel_web_enrollment,\n"
        "    complete_web_enrollment, load_web_legal_bundle,\n"
        "    prepare_web_enrollment, project_web_account,\n"
        "    trusted_public_key_from_signing_key,\n"
        "    web_enrollment_document, web_enrollment_preflight,\n"
        ")\n",
        "web enrollment imports",
    )
    text = replace_once(
        text,
        'PROXY_CLIENT_IP_HEADER = "X-BelgoBase-Client-IP"\n',
        'PROXY_CLIENT_IP_HEADER = "X-BelgoBase-Client-IP"\n'
        'INTERNAL_PROOF_HEADER = "X-BelgoBase-Internal-Proof"\n',
        "internal proof header",
    )
    text = replace_once(
        text,
        '        "/account/link-acceptance",\n',
        '        "/account/link-acceptance",\n'
        '        "/internal/web-enrollment/prepare",\n'
        '        "/internal/web-enrollment/cancel",\n'
        '        "/internal/web-enrollment/autofill",\n'
        '        "/internal/web-enrollment/complete",\n'
        '        "/internal/web-enrollment/document",\n'
        '        "/internal/web-account/project",\n',
        "internal routes",
    )
    marker = '    if route in {\n        "/auth/device/activate",\n'
    validation = '''    if route == "/internal/web-enrollment/prepare":
        _require_exact_fields(payload, {"license_code", "email"})
        _validate_license_code(payload["license_code"])
        _require_string(payload["email"], maximum=320)
        return payload
    if route == "/internal/web-enrollment/cancel":
        _require_exact_fields(payload, {"claim_id"})
        _require_string(payload["claim_id"], maximum=128)
        return payload
    if route == "/internal/web-enrollment/autofill":
        _require_exact_fields(payload, {"claim_id", "email", "enterprise_number", "company"})
        for key in ("claim_id", "email", "enterprise_number"):
            _require_string(payload[key], maximum=320)
        company = _require_object(payload["company"])
        _require_exact_fields(company, {"company_type", "enterprise_number", "legal_name", "address"})
        for key in ("company_type", "enterprise_number", "legal_name"):
            _require_string(company[key], maximum=300)
        _require_object(company["address"])
        return payload
    if route == "/internal/web-enrollment/complete":
        _require_exact_fields(payload, {
            "claim_id", "email", "company_type", "enterprise_number", "legal_name",
            "acceptant", "declarations", "choice_texts", "preflight_id", "preflight_fingerprint",
        })
        return payload
    if route == "/internal/web-enrollment/document":
        _require_exact_fields(payload, {"claim_id", "email", "preflight_id", "document_id"})
        for key in payload:
            _require_string(payload[key], maximum=320)
        return payload
    if route == "/internal/web-account/project":
        _require_exact_fields(payload, {"auth_context", "payload"})
        _require_object(payload["auth_context"])
        _require_object(payload["payload"])
        return payload
'''
    text = replace_once(text, marker, validation + marker, "internal request validation")
    old_ctor = '''        signing_private_key_path: Path,
    ) -> None:
        self.database_path = Path(database_path)
'''
    new_ctor = '''        signing_private_key_path: Path,
        internal_proof: str,
    ) -> None:
        self.database_path = Path(database_path)
        self.internal_proof = str(internal_proof or "")
        if len(self.internal_proof) < 32:
            raise RuntimeError("Interne webaccount-proofsleutel ontbreekt.")
'''
    text = replace_once(text, old_ctor, new_ctor, "service internal proof")
    text = replace_once(
        text,
        "        self.legal_bundle = load_legal_bundle(self.legal_dir)\n",
        "        self.legal_bundle = load_legal_bundle(self.legal_dir)\n"
        "        self.web_legal_bundle = load_web_legal_bundle(self.legal_dir)\n"
        "        self.web_trusted_public_key_b64 = trusted_public_key_from_signing_key(\n"
        "            self.signing_private_key_path\n"
        "        )\n",
        "web legal bundle and trusted receipt key",
    )
    marker = "    def device_activate(\n"
    methods = '''    def authorize_internal(self, headers: Any) -> None:
        values = request_header_values(headers, INTERNAL_PROOF_HEADER)
        if len(values) != 1 or not hmac.compare_digest(values[0], self.internal_proof):
            raise AuthenticationRequired("internal_proof_invalid")

    def web_internal(self, route: str, headers: Any, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
        try:
            self.authorize_internal(headers)
            if route == "/internal/web-enrollment/prepare":
                result = prepare_web_enrollment(
                    payload["license_code"], payload["email"],
                    database_path=self.database_path, pepper_path=self.pepper_path,
                )
            elif route == "/internal/web-enrollment/cancel":
                result = cancel_web_enrollment(payload["claim_id"], database_path=self.database_path)
            elif route == "/internal/web-enrollment/autofill":
                result = web_enrollment_preflight(
                    payload["claim_id"], payload["email"], payload["company"],
                    self.web_legal_bundle, database_path=self.database_path,
                )
            elif route == "/internal/web-enrollment/complete":
                result = complete_web_enrollment(
                    payload["claim_id"], payload["email"], payload,
                    self.web_legal_bundle, self.signing_private_key_path,
                    database_path=self.database_path,
                )
            elif route == "/internal/web-enrollment/document":
                result = web_enrollment_document(
                    payload["claim_id"], payload["email"], payload["preflight_id"],
                    payload["document_id"], self.web_legal_bundle, self.legal_dir,
                    database_path=self.database_path,
                )
            else:
                result = project_web_account(
                    payload["auth_context"], payload["payload"], self.web_legal_bundle,
                    self.legal_dir, self.web_trusted_public_key_b64,
                    database_path=self.database_path,
                )
            return 200, result
        except AuthenticationRequired:
            return 401, {"ok": False, "error": "internal_proof_invalid"}
        except AcceptanceConflictError as exc:
            code = str(exc) if str(exc) in {"binding_conflict", "claim_unavailable"} else "binding_conflict"
            return 409, {"ok": False, "error": code}
        except WebEnrollmentUnavailable as exc:
            code = str(exc)
            status = 401 if code == "enrollment_expired" else 503
            return status, {"ok": False, "error": code}
        except AcceptanceValidationError as exc:
            code = str(exc)
            if code == "document_not_found":
                return 404, {"ok": False, "error": code}
            return 400, {"ok": False, "error": "legal_acceptance_invalid"}
        except LicenseValidationError:
            return 409, {"ok": False, "error": "claim_unavailable"}

'''
    text = replace_once(text, marker, methods + marker, "internal service methods")
    dispatch_old = '''                if route == "/installer/legal/preflight":
                    status, result = service.preflight(self.headers, payload, source_ip)
'''
    dispatch_new = '''                if route.startswith("/internal/web-"):
                    status, result = service.web_internal(route, self.headers, payload)
                elif route == "/installer/legal/preflight":
                    status, result = service.preflight(self.headers, payload, source_ip)
'''
    return replace_once(text, dispatch_old, dispatch_new, "internal route dispatch")


def patch_runner(text: str) -> str:
    text = replace_once(
        text,
        '    signing_key = _required_path("BELGOBASE_ACCEPTANCE_SIGNING_KEY")\n',
        '    signing_key = _required_path("BELGOBASE_ACCEPTANCE_SIGNING_KEY")\n'
        '    internal_proof_path = _required_path("BELGOBASE_ACCOUNT_INTERNAL_PROOF_FILE")\n'
        '    internal_proof = internal_proof_path.read_text(encoding="ascii").strip()\n'
        '    if len(internal_proof) < 32:\n'
        '        raise RuntimeError("Interne webaccount-proofsleutel is ongeldig.")\n',
        "runner internal proof",
    )
    return replace_once(
        text,
        "        signing_private_key_path=signing_key,\n",
        "        signing_private_key_path=signing_key,\n"
        "        internal_proof=internal_proof,\n",
        "runner service proof",
    )


PATCHERS = {
    "belgobase_account_registry_56a.py": lambda text: text,
    "belgobase_account_api_56a.py": patch_api,
    "run_account_service_production.py": patch_runner,
}


def generate(output: Path) -> Path:
    output = output.resolve()
    if (ROOT / "tools").resolve() not in output.parents:
        raise RuntimeError("output must remain below tools")
    if output.exists():
        raise RuntimeError(f"output already exists: {output}")
    for name, expected in EXPECTED.items():
        actual = sha256(PREIMAGE / name)
        if actual != expected:
            raise RuntimeError(f"preimage hash changed for {name}: {actual}")
    output.mkdir(parents=True)
    diff: list[str] = []
    candidate_hashes: dict[str, str] = {}
    for name, patcher in PATCHERS.items():
        source = PREIMAGE / name
        before = source.read_text(encoding="utf-8")
        after = patcher(before)
        target = output / name
        target.write_text(after, encoding="utf-8", newline="\n")
        candidate_hashes[name] = sha256(target)
        diff.extend(
            difflib.unified_diff(
                before.splitlines(keepends=True),
                after.splitlines(keepends=True),
                fromfile=f"account_preimage/{name}",
                tofile=f"account_candidate/{name}",
            )
        )
    extension = output / "belgobase_web_enrollment_1a.py"
    shutil.copy2(ROOT / "backend" / "account_enrollment_registry.py", extension)
    candidate_hashes[extension.name] = sha256(extension)
    (output / "account_enrollment.patch").write_text("".join(diff), encoding="utf-8", newline="\n")
    (output / "manifest.json").write_text(
        json.dumps(
            {
                "kind": "local-unpublished-account-enrollment-candidate",
                "preimage_sha256": EXPECTED,
                "candidate_sha256": candidate_hashes,
                "production_modified": False,
                "channel": "web-b2b",
                "consumer_registration": "blocked-no-compatible-legal-bundle",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return output


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    result = generate(parser.parse_args().output)
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
