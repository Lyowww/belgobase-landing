from __future__ import annotations

import base64
import hashlib
import importlib
import json
import sqlite3
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PREIMAGE = ROOT / ".local" / "account_preimage"
if str(PREIMAGE) not in sys.path:
    sys.path.insert(0, str(PREIMAGE))

from belgobase_account_registry_56a import (  # noqa: E402
    AcceptanceValidationError,
    _canonical_json,
    installer_preflight,
    load_signing_private_key,
    migrate_account_registry_v3,
    write_test_signing_keypair,
)
from belgobase_device_registry_43a import initialize_device_registry  # noqa: E402
from belgobase_license_registry_42a import create_license  # noqa: E402
from backend.account_enrollment_registry import (  # noqa: E402
    complete_web_enrollment,
    load_web_legal_bundle,
    prepare_web_enrollment,
    project_web_account,
    web_enrollment_preflight,
)
from tools.generate_account_enrollment_candidate import generate  # noqa: E402
from backend.workspace_integration import workspace_auth_context


def legal_bundle(*, include_legacy_authority: bool = False) -> dict:
    documents = []
    for key, role, title in (
        ("terms", "contractual_terms", "Algemene voorwaarden"),
        ("usage", "acceptable_use_terms", "Gebruiksvoorwaarden"),
        ("privacy", "privacy_notice", "Privacyverklaring"),
    ):
        documents.append(
            {
                "key": key,
                "document_id": key,
                "title": title,
                "role": role,
                "version": "1.0",
                "text_file": key + ".txt",
                "text_sha256": hashlib.sha256(key.encode()).hexdigest(),
                "pdf_file": key + ".pdf",
                "pdf_sha256": hashlib.sha256((key + "pdf").encode()).hexdigest(),
            }
        )
    choices = {}
    choice_rows = [
        ("general_terms", "acceptance", "Ik aanvaard de voorwaarden voor [WETTELIJKE KLANTNAAM]."),
        ("usage_terms", "acceptance", "Ik aanvaard het gebruik voor [WETTELIJKE KLANTNAAM]."),
        ("privacy_notice", "acknowledgement", "Ik las de privacyverklaring voor [WETTELIJKE KLANTNAAM]."),
    ]
    if include_legacy_authority:
        choice_rows.append(
            ("business_authority", "declaration", "Ik mag [WETTELIJKE KLANTNAAM] vertegenwoordigen.")
        )
    for key, kind, text in choice_rows:
        choices[key] = {
            "kind": kind,
            "text_template": text,
            "text_template_sha256": hashlib.sha256(text.encode()).hexdigest(),
        }
    return {
        "legal_set_id": "belgobase-b2b-commercial-text-first-use-1.0",
        "language": "nl-BE",
        "manifest_sha256": "a" * 64,
        "manifest_file": "commercial-manifest.json",
        "document_items": documents,
        "choices": choices,
        "terms_version": "1.0",
        "usage_terms_version": "1.0",
        "privacy_version": "1.0",
        "terms_text_sha256": "1" * 64,
        "terms_pdf_sha256": "2" * 64,
        "usage_terms_text_sha256": "3" * 64,
        "usage_terms_pdf_sha256": "4" * 64,
        "privacy_text_sha256": "5" * 64,
        "privacy_pdf_sha256": "6" * 64,
        "acceptance_flow_version": "web-test-1",
        "effective_date": "2026-09-18",
    }


class AccountCandidateIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.database = root / "license.sqlite3"
        self.pepper = root / "pepper.bin"
        self.pepper.write_bytes(b"p" * 32)
        initialize_device_registry(self.database, self.pepper)
        migrate_account_registry_v3(self.database)
        self.license, self.code = create_license(
            "customer-1",
            "Example BV",
            "contract-1",
            "full",
            rights={"data_access": "all_current", "exports": True, "xbrl": True},
            max_devices=3,
            issued_credential="BB2-" + "A" * 43,
            database_path=self.database,
            pepper_path=self.pepper,
            actor="candidate-test",
            reason="Synthetic web enrollment integration test",
        )
        self.private_key = root / "acceptance.pem"
        keypair = write_test_signing_keypair(self.private_key, root / "acceptance.pub")
        self.trusted_public_key = keypair["public_key_b64"]
        self.legal = legal_bundle()
        for key in ("terms", "usage", "privacy"):
            (root / f"{key}.txt").write_text(key, encoding="utf-8")

    def test_original_registry_schema_gets_atomic_web_profile_and_signed_receipt(self) -> None:
        prepared = prepare_web_enrollment(
            self.code,
            "new@example.test",
            database_path=self.database,
            pepper_path=self.pepper,
        )
        with self.assertRaises(Exception):
            prepare_web_enrollment(
                self.code,
                "other@example.test",
                database_path=self.database,
                pepper_path=self.pepper,
            )
        preflight = web_enrollment_preflight(
            prepared["claim_id"],
            prepared["email"],
            {
                "company_type": "business",
                "enterprise_number": "0123456789",
                "legal_name": "Example BV",
                "address": {"municipality": "Brussel"},
            },
            self.legal,
            database_path=self.database,
        )
        self.assertEqual(
            {"general_terms", "usage_terms", "privacy_notice"},
            set(preflight["legal"]["choice_texts"]),
        )
        authority = preflight["legal"]["authority_declaration"]
        self.assertEqual("web-business-authority-1", authority["version"])
        self.assertEqual(
            "Ik verklaar dat ik bevoegd ben om Example BV te vertegenwoordigen.",
            authority["text"],
        )
        self.assertEqual(
            hashlib.sha256(authority["text"].encode("utf-8")).hexdigest(),
            authority["sha256"],
        )
        request = {
            "company_type": "business",
            "enterprise_number": "0123456789",
            "legal_name": "Example BV",
            "acceptant": {"name": "Ada Example", "function": "Bestuurder"},
            "declarations": {
                "terms_accepted": True,
                "usage_terms_accepted": True,
                "privacy_acknowledged": True,
                "authority_declared": True,
            },
            "choice_texts": preflight["legal"]["choice_texts"],
            "preflight_id": preflight["preflight_id"],
            "preflight_fingerprint": preflight["preflight_fingerprint"],
        }
        completed = complete_web_enrollment(
            prepared["claim_id"],
            prepared["email"],
            request,
            self.legal,
            self.private_key,
            database_path=self.database,
        )
        retried = complete_web_enrollment(
            prepared["claim_id"],
            prepared["email"],
            request,
            self.legal,
            self.private_key,
            database_path=self.database,
        )
        self.assertEqual(completed, retried)
        connection = sqlite3.connect(self.database)
        connection.row_factory = sqlite3.Row
        try:
            profile = connection.execute(
                "SELECT * FROM license_customer_profiles WHERE license_id=?",
                (self.license["license_id"],),
            ).fetchone()
            receipt = connection.execute(
                "SELECT * FROM web_legal_acceptance_receipts WHERE license_id=?",
                (self.license["license_id"],),
            ).fetchone()
            claim = connection.execute(
                "SELECT status,completed_acceptance_id FROM web_account_enrollment_claims WHERE claim_id=?",
                (prepared["claim_id"],),
            ).fetchone()
        finally:
            connection.close()
        self.assertEqual("new@example.test", profile["support_email"])
        self.assertEqual("completed", claim["status"])
        self.assertEqual(receipt["acceptance_id"], claim["completed_acceptance_id"])
        self.assertTrue(receipt["signature_b64"])
        self.assertNotIn("device", receipt["canonical_receipt_json"])
        self.assertNotIn("installer", receipt["canonical_receipt_json"])
        signed_receipt = json.loads(receipt["canonical_receipt_json"])
        self.assertEqual(authority, signed_receipt["authority_declaration"])
        self.assertEqual(
            {"general_terms", "usage_terms", "privacy_notice"},
            set(signed_receipt["choice_confirmations"]),
        )
        auth_context = {
            "principal_type": "web",
            "license_id": self.license["license_id"],
            "customer_id": "customer-1",
            "email": "new@example.test",
        }
        auth_context = workspace_auth_context({
            **auth_context, "user_id": "new-web-user", "browser_id": "browser-1",
            "plan": "full", "rights": {"data_access": "all_current"},
            "principal_id": "web:browser-1", "quota_subject_id": "web:browser-1",
        }).authorization_context()
        account = project_web_account(
            auth_context,
            {"action": "refresh"},
            self.legal,
            Path(self.temp.name),
            self.trusted_public_key,
            database_path=self.database,
        )
        proof = project_web_account(
            auth_context,
            {"action": "receipt"},
            self.legal,
            Path(self.temp.name),
            self.trusted_public_key,
            database_path=self.database,
        )
        self.assertEqual("Example BV", account["rows"][0]["value"])
        self.assertEqual("Licentiebewijs", proof["title"])
        self.assertIn('"schema":"belgobase-web-legal-acceptance-receipt-v1"', proof["details"])
        document = project_web_account(
            auth_context,
            {"action": "document", "key": "terms"},
            self.legal,
            Path(self.temp.name),
            self.trusted_public_key,
            database_path=self.database,
        )
        self.assertEqual("terms", document["text"])

        connection = sqlite3.connect(self.database)
        try:
            connection.execute(
                """INSERT INTO devices(
                       device_id,license_id,public_key_b64,public_key_fingerprint,
                       machine_fingerprint_hash,device_credential_hash,status,
                       device_name,client_version,activated_at,updated_at,reset_generation
                   ) VALUES(?,?,?,?,?,?,'active',?,?,?,?,0)""",
                (
                    "desktop-1",
                    self.license["license_id"],
                    "A" * 43,
                    "f" * 64,
                    "m" * 64,
                    "c" * 64,
                    "Desktop",
                    "1.0.0",
                    "2026-09-18T12:00:00+00:00",
                    "2026-09-18T12:00:00+00:00",
                ),
            )
            connection.commit()
        finally:
            connection.close()
        desktop = installer_preflight(
            self.code,
            self.legal,
            auth_context={
                "access_class": "customer",
                "license_id": self.license["license_id"],
                "device_id": "desktop-1",
            },
            database_path=self.database,
            pepper_path=self.pepper,
        )
        self.assertEqual("bound", desktop["binding_state"])
        self.assertEqual("new@example.test", desktop["customer"]["support_email"])

        # Simulate storage corruption in this synthetic database. Production keeps
        # the append-only trigger; dropping it here is the only way to prove that
        # account projection does not trust the newest database row by itself.
        original_canonical = receipt["canonical_receipt_json"]
        original_signature = receipt["signature_b64"]
        acceptance_id = receipt["acceptance_id"]
        connection = sqlite3.connect(self.database)
        try:
            connection.execute("DROP TRIGGER web_legal_receipts_no_update")
            connection.execute(
                "UPDATE web_legal_acceptance_receipts SET signature_b64=? WHERE acceptance_id=?",
                ("AAAA", acceptance_id),
            )
            connection.commit()
        finally:
            connection.close()
        with self.assertRaisesRegex(AcceptanceValidationError, "receipt_integrity_invalid"):
            project_web_account(
                auth_context,
                {"action": "refresh"},
                self.legal,
                Path(self.temp.name),
                self.trusted_public_key,
                database_path=self.database,
            )

        tampered = json.loads(original_canonical)
        tampered["result"] = "tampered"
        connection = sqlite3.connect(self.database)
        try:
            connection.execute(
                """UPDATE web_legal_acceptance_receipts
                   SET canonical_receipt_json=?,signature_b64=? WHERE acceptance_id=?""",
                (_canonical_json(tampered), original_signature, acceptance_id),
            )
            connection.commit()
        finally:
            connection.close()
        with self.assertRaisesRegex(AcceptanceValidationError, "receipt_integrity_invalid"):
            project_web_account(
                auth_context,
                {"action": "receipt"},
                self.legal,
                Path(self.temp.name),
                self.trusted_public_key,
                database_path=self.database,
            )

        identity_mismatch = json.loads(original_canonical)
        identity_mismatch["customer"]["legal_name"] = "Andere BV"
        forged_canonical = _canonical_json(identity_mismatch)
        forged_signature = base64.urlsafe_b64encode(
            load_signing_private_key(self.private_key).sign(forged_canonical.encode("utf-8"))
        ).decode("ascii").rstrip("=")
        connection = sqlite3.connect(self.database)
        try:
            connection.execute(
                """UPDATE web_legal_acceptance_receipts
                   SET canonical_receipt_json=?,signature_b64=? WHERE acceptance_id=?""",
                (forged_canonical, forged_signature, acceptance_id),
            )
            connection.commit()
        finally:
            connection.close()
        with self.assertRaisesRegex(AcceptanceValidationError, "receipt_identity_invalid"):
            project_web_account(
                auth_context,
                {"action": "document", "key": "terms"},
                self.legal,
                Path(self.temp.name),
                self.trusted_public_key,
                database_path=self.database,
            )

    def test_two_licenses_can_complete_for_same_enterprise_with_own_device_limits(self) -> None:
        second_license, second_code = create_license(
            "customer-2",
            "Example BV",
            "contract-2",
            "full",
            rights={"data_access": "all_current", "exports": True, "xbrl": True},
            max_devices=1,
            issued_credential="BB2-" + "B" * 43,
            database_path=self.database,
            pepper_path=self.pepper,
            actor="candidate-test",
            reason="Synthetic second web enrollment integration test",
        )

        def complete(license_code: str, email: str) -> dict:
            prepared = prepare_web_enrollment(
                license_code,
                email,
                database_path=self.database,
                pepper_path=self.pepper,
            )
            preflight = web_enrollment_preflight(
                prepared["claim_id"],
                prepared["email"],
                {
                    "company_type": "business",
                    "enterprise_number": "BE 1006.303.437",
                    "legal_name": "NovaVenture Group",
                    "address": {"municipality": "Brussel"},
                },
                self.legal,
                database_path=self.database,
            )
            return complete_web_enrollment(
                prepared["claim_id"],
                prepared["email"],
                {
                    "company_type": "business",
                    "enterprise_number": "1006303437",
                    "legal_name": "NovaVenture Group",
                    "acceptant": {"name": "Ada Example", "function": "Bestuurder"},
                    "declarations": {
                        "terms_accepted": True,
                        "usage_terms_accepted": True,
                        "privacy_acknowledged": True,
                        "authority_declared": True,
                    },
                    "choice_texts": preflight["legal"]["choice_texts"],
                    "preflight_id": preflight["preflight_id"],
                    "preflight_fingerprint": preflight["preflight_fingerprint"],
                },
                self.legal,
                self.private_key,
                database_path=self.database,
            )

        first = complete(self.code, "first@example.test")
        second = complete(second_code, "second@example.test")
        self.assertEqual(self.license["license_id"], first["license_id"])
        self.assertEqual(second_license["license_id"], second["license_id"])

        connection = sqlite3.connect(self.database)
        connection.row_factory = sqlite3.Row
        try:
            rows = connection.execute(
                """SELECT p.license_id,p.enterprise_number,l.max_devices
                   FROM license_customer_profiles AS p
                   JOIN licenses AS l ON l.license_id=p.license_id
                   WHERE p.enterprise_number=?
                   ORDER BY l.max_devices DESC""",
                ("1006303437",),
            ).fetchall()
            receipt_count = connection.execute(
                "SELECT COUNT(*) FROM web_legal_acceptance_receipts WHERE enterprise_number=?",
                ("1006303437",),
            ).fetchone()[0]
        finally:
            connection.close()
        self.assertEqual(2, receipt_count)
        self.assertEqual(
            [
                (self.license["license_id"], "1006303437", 3),
                (second_license["license_id"], "1006303437", 1),
            ],
            [(row["license_id"], row["enterprise_number"], row["max_devices"]) for row in rows],
        )

    def test_missing_required_legal_choice_is_rejected(self) -> None:
        prepared = prepare_web_enrollment(
            self.code,
            "new@example.test",
            database_path=self.database,
            pepper_path=self.pepper,
        )
        incomplete = legal_bundle()
        del incomplete["choices"]["privacy_notice"]
        with self.assertRaisesRegex(AcceptanceValidationError, "unsupported_web_legal_set"):
            web_enrollment_preflight(
                prepared["claim_id"],
                prepared["email"],
                {
                    "company_type": "business",
                    "enterprise_number": "1006303437",
                    "legal_name": "NovaVenture Group",
                    "address": {},
                },
                incomplete,
                database_path=self.database,
            )

    def test_false_authority_declaration_is_rejected_without_binding(self) -> None:
        prepared = prepare_web_enrollment(
            self.code,
            "new@example.test",
            database_path=self.database,
            pepper_path=self.pepper,
        )
        preflight = web_enrollment_preflight(
            prepared["claim_id"],
            prepared["email"],
            {
                "company_type": "business",
                "enterprise_number": "1006303437",
                "legal_name": "NovaVenture Group",
                "address": {},
            },
            self.legal,
            database_path=self.database,
        )
        with self.assertRaisesRegex(AcceptanceValidationError, "legal_acceptance_invalid"):
            complete_web_enrollment(
                prepared["claim_id"],
                prepared["email"],
                {
                    "company_type": "business",
                    "enterprise_number": "1006303437",
                    "legal_name": "NovaVenture Group",
                    "acceptant": {"name": "Ada Example", "function": "Bestuurder"},
                    "declarations": {
                        "terms_accepted": True,
                        "usage_terms_accepted": True,
                        "privacy_acknowledged": True,
                        "authority_declared": False,
                    },
                    "choice_texts": preflight["legal"]["choice_texts"],
                    "preflight_id": preflight["preflight_id"],
                    "preflight_fingerprint": preflight["preflight_fingerprint"],
                },
                self.legal,
                self.private_key,
                database_path=self.database,
            )
        connection = sqlite3.connect(self.database)
        try:
            profile_count = connection.execute(
                "SELECT COUNT(*) FROM license_customer_profiles WHERE license_id=?",
                (self.license["license_id"],),
            ).fetchone()[0]
            receipt_count = connection.execute(
                "SELECT COUNT(*) FROM web_legal_acceptance_receipts WHERE license_id=?",
                (self.license["license_id"],),
            ).fetchone()[0]
        finally:
            connection.close()
        self.assertEqual(0, profile_count)
        self.assertEqual(0, receipt_count)

    def test_legacy_four_choice_bundle_remains_supported(self) -> None:
        prepared = prepare_web_enrollment(
            self.code,
            "new@example.test",
            database_path=self.database,
            pepper_path=self.pepper,
        )
        preflight = web_enrollment_preflight(
            prepared["claim_id"],
            prepared["email"],
            {
                "company_type": "business",
                "enterprise_number": "1006303437",
                "legal_name": "NovaVenture Group",
                "address": {},
            },
            legal_bundle(include_legacy_authority=True),
            database_path=self.database,
        )
        self.assertIn("business_authority", preflight["legal"]["choice_texts"])
        self.assertEqual(
            "web-business-authority-1",
            preflight["legal"]["authority_declaration"]["version"],
        )

    def test_web_bundle_uses_existing_pinned_text_legal_set(self) -> None:
        with mock.patch(
            "backend.account_enrollment_registry.load_legal_bundle",
            return_value=self.legal,
        ) as loader:
            result = load_web_legal_bundle(Path(self.temp.name))
        self.assertIs(result, self.legal)
        loader.assert_called_once_with(
            Path(self.temp.name), legal_set_id="belgobase-b2b-commercial-text-first-use-1.0"
        )

    def test_generated_account_api_dispatches_internal_flow_with_proof(self) -> None:
        candidate_temp = tempfile.TemporaryDirectory(dir=ROOT / "tools")
        self.addCleanup(candidate_temp.cleanup)
        candidate = generate(Path(candidate_temp.name) / "candidate")
        sys.path.insert(0, str(candidate))
        self.addCleanup(lambda: sys.path.remove(str(candidate)))
        sys.modules.pop("belgobase_web_enrollment_1a", None)
        sys.modules.pop("belgobase_account_api_56a", None)
        api = importlib.import_module("belgobase_account_api_56a")
        service = object.__new__(api.AccountApiService)
        service.database_path = self.database
        service.pepper_path = self.pepper
        service.legal_dir = Path(self.temp.name)
        service.signing_private_key_path = self.private_key
        service.internal_proof = "q" * 64
        service.web_legal_bundle = self.legal
        service.web_trusted_public_key_b64 = self.trusted_public_key
        headers = {"X-BelgoBase-Internal-Proof": "q" * 64}

        denied_status, _ = service.web_internal(
            "/internal/web-enrollment/prepare",
            {},
            {"license_code": self.code, "email": "new@example.test"},
        )
        self.assertEqual(401, denied_status)
        status, prepared = service.web_internal(
            "/internal/web-enrollment/prepare",
            headers,
            {"license_code": self.code, "email": "new@example.test"},
        )
        self.assertEqual(200, status)
        status, preflight = service.web_internal(
            "/internal/web-enrollment/autofill",
            headers,
            {
                "claim_id": prepared["claim_id"],
                "email": prepared["email"],
                "enterprise_number": "0123456789",
                "company": {
                    "company_type": "business",
                    "enterprise_number": "0123456789",
                    "legal_name": "Example BV",
                    "address": {},
                },
            },
        )
        self.assertEqual(200, status)
        status, completed = service.web_internal(
            "/internal/web-enrollment/complete",
            headers,
            {
                "claim_id": prepared["claim_id"],
                "email": prepared["email"],
                "company_type": "business",
                "enterprise_number": "0123456789",
                "legal_name": "Example BV",
                "acceptant": {"name": "Ada Example", "function": "Bestuurder"},
                "declarations": {
                    "terms_accepted": True,
                    "usage_terms_accepted": True,
                    "privacy_acknowledged": True,
                    "authority_declared": True,
                },
                "choice_texts": preflight["legal"]["choice_texts"],
                "preflight_id": preflight["preflight_id"],
                "preflight_fingerprint": preflight["preflight_fingerprint"],
            },
        )
        self.assertEqual(200, status)
        self.assertEqual(self.license["license_id"], completed["license_id"])

    def test_generated_account_service_initializes_web_schema_before_requests(self) -> None:
        candidate_temp = tempfile.TemporaryDirectory(dir=ROOT / "tools")
        self.addCleanup(candidate_temp.cleanup)
        candidate = generate(Path(candidate_temp.name) / "candidate")
        sys.path.insert(0, str(candidate))
        self.addCleanup(lambda: sys.path.remove(str(candidate)))
        sys.modules.pop("belgobase_web_enrollment_1a", None)
        sys.modules.pop("belgobase_account_api_56a", None)
        api = importlib.import_module("belgobase_account_api_56a")
        api.load_legal_bundle = lambda _path: self.legal
        api.load_web_legal_bundle = lambda _path: self.legal
        api.trusted_public_key_from_signing_key = lambda _path: self.trusted_public_key
        api.AccountApiService(
            database_path=self.database,
            pepper_path=self.pepper,
            legal_dir=Path(self.temp.name),
            signing_private_key_path=self.private_key,
            internal_proof="q" * 64,
        )
        connection = sqlite3.connect(self.database)
        try:
            tables = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'web_%'"
                )
            }
        finally:
            connection.close()
        self.assertTrue(
            {
                "web_account_enrollment_claims",
                "web_account_legal_preflights",
                "web_legal_acceptance_receipts",
            }.issubset(tables)
        )

    def test_generated_registry_adds_only_build100_admission(self) -> None:
        candidate_temp = tempfile.TemporaryDirectory(dir=ROOT / "tools")
        self.addCleanup(candidate_temp.cleanup)
        candidate = generate(Path(candidate_temp.name) / "candidate")
        before = (PREIMAGE / "belgobase_account_registry_56a.py").read_text(encoding="utf-8")
        after = (candidate / "belgobase_account_registry_56a.py").read_text(encoding="utf-8")
        target = '        ("64-production", "1.0.0", 100, 48),\n'
        self.assertNotIn(target, before)
        self.assertEqual(1, after.count(target))
        self.assertEqual(before, after.replace(target, "", 1))


if __name__ == "__main__":
    unittest.main()
