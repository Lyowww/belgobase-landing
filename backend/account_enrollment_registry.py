"""Account-service extension for web-first B2B enrollment.

This module is copied into the isolated account-service candidate.  It creates
web-channel claims, preflights and signed receipts without manufacturing a
Windows device, installer version or desktop acceptance.  The existing
``license_customer_profiles`` row remains the account identity source of truth.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import sqlite3
import uuid
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives import serialization

from belgobase_account_registry_56a import (
    AcceptanceConflictError,
    AcceptanceValidationError,
    FIRST_USE_LEGAL_SET_ID,
    _b64encode,
    _canonical_json,
    _normal_text,
    _normalize_hash,
    _render_choice_texts,
    load_legal_bundle,
    load_signing_private_key,
    normalize_customer_number,
    normalize_email,
    normalize_enterprise_number,
    require_account_registry_v3,
    verify_signed_receipt,
)
from belgobase_license_registry_42a import (
    DEFAULT_DATABASE_PATH,
    DEFAULT_PEPPER_PATH,
    connect_database,
    iso_utc,
    validate_credential,
)


WEB_RECEIPT_SCHEMA = "belgobase-web-legal-acceptance-receipt-v1"
CLAIM_TTL_SECONDS = 70 * 60
PREFLIGHT_TTL_SECONDS = 15 * 60
WEB_CURRENT_LEGAL_SET_ID = "belgobase-commercial-legal-v1.2-20260919"
WEB_CURRENT_MANIFEST_FILE = "05_BELGOBASE_COMMERCIELE_EERSTE_GEBRUIK_MANIFEST_V1.2.json"
WEB_CURRENT_MANIFEST_SCHEMA = "belgobase-legal-text-first-use-manifest-v1"
WEB_CURRENT_MANIFEST_SHA256 = "4609918a391402fa2dfc5299bf28847896c1f5ad7a81675e52f0eb6de7eed75d"


class WebEnrollmentUnavailable(AcceptanceValidationError):
    pass


WEB_SCHEMA = """
CREATE TABLE IF NOT EXISTS web_account_enrollment_claims (
    claim_id TEXT PRIMARY KEY,
    license_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    email_normalized TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active','cancelled','expired','completed')),
    created_at_utc TEXT NOT NULL,
    expires_at_utc TEXT NOT NULL,
    completed_acceptance_id TEXT,
    FOREIGN KEY(license_id) REFERENCES licenses(license_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_web_claim_active_license
    ON web_account_enrollment_claims(license_id) WHERE status='active';
CREATE TABLE IF NOT EXISTS web_account_legal_preflights (
    preflight_id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    license_id TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    snapshot_sha256 TEXT NOT NULL,
    issued_at_utc TEXT NOT NULL,
    expires_at_utc TEXT NOT NULL,
    consumed_at_utc TEXT,
    FOREIGN KEY(claim_id) REFERENCES web_account_enrollment_claims(claim_id),
    FOREIGN KEY(license_id) REFERENCES licenses(license_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_web_preflight_claim_active
    ON web_account_legal_preflights(claim_id) WHERE consumed_at_utc IS NULL;
CREATE TABLE IF NOT EXISTS web_legal_acceptance_receipts (
    acceptance_id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL UNIQUE,
    preflight_id TEXT NOT NULL UNIQUE,
    license_id TEXT NOT NULL UNIQUE,
    customer_number TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    enterprise_number TEXT NOT NULL,
    acceptant_name TEXT NOT NULL,
    business_email TEXT NOT NULL,
    acceptant_function TEXT NOT NULL,
    legal_set_id TEXT NOT NULL,
    manifest_sha256 TEXT NOT NULL,
    accepted_at_utc TEXT NOT NULL,
    canonical_receipt_json TEXT NOT NULL,
    signing_key_id TEXT NOT NULL,
    signature_b64 TEXT NOT NULL,
    public_key_b64 TEXT NOT NULL,
    FOREIGN KEY(claim_id) REFERENCES web_account_enrollment_claims(claim_id),
    FOREIGN KEY(preflight_id) REFERENCES web_account_legal_preflights(preflight_id),
    FOREIGN KEY(license_id) REFERENCES licenses(license_id)
);
CREATE TRIGGER IF NOT EXISTS web_legal_receipts_no_update
BEFORE UPDATE ON web_legal_acceptance_receipts
BEGIN SELECT RAISE(ABORT, 'web legal receipts are append-only'); END;
CREATE TRIGGER IF NOT EXISTS web_legal_receipts_no_delete
BEFORE DELETE ON web_legal_acceptance_receipts
BEGIN SELECT RAISE(ABORT, 'web legal receipts are append-only'); END;
"""


def _load_current_web_legal_bundle(legal_dir: Path) -> dict[str, Any]:
    root = Path(legal_dir)
    manifest_path = root / WEB_CURRENT_MANIFEST_FILE
    manifest_bytes = manifest_path.read_bytes()
    manifest_sha256 = hashlib.sha256(manifest_bytes).hexdigest()
    if manifest_sha256 != WEB_CURRENT_MANIFEST_SHA256:
        raise AcceptanceValidationError("Webmanifest is niet de officieel gepinde productieset.")
    manifest = json.loads(manifest_bytes.decode("utf-8-sig"))
    if (
        manifest.get("schema") != WEB_CURRENT_MANIFEST_SCHEMA
        or manifest.get("contractset_id") != WEB_CURRENT_LEGAL_SET_ID
        or manifest.get("manifest_version") != "1.2-first-use"
        or manifest.get("base_contractset_id") != "belgobase-b2b-commercial-1.2"
        or manifest.get("language") != "nl-BE"
        or manifest.get("document_date") != "2026-09-19"
    ):
        raise AcceptanceValidationError("Webmanifest bevat ongeldige setmetadata.")
    flow = manifest.get("acceptance_flow")
    required_flow_flags = {
        "all_choices_default_unchecked",
        "all_choices_required_before_first_use",
        "central_positive_record_required_before_first_use",
        "fail_closed_when_recording_fails",
    }
    if (
        not isinstance(flow, dict)
        or flow.get("version") != "3.0-three-text-pages-first-use"
        or any(flow.get(flag) is not True for flag in required_flow_flags)
    ):
        raise AcceptanceValidationError("Webmanifest bevat een ongeldige acceptatieflow.")

    role_keys = {
        "contractual_terms": "terms",
        "acceptable_use_terms": "usage_terms",
        "privacy_notice": "privacy",
    }
    expected_documents = {
        "terms": ("BB-AV-B2B-NL-1.2", "01_BELGOBASE_ALGEMENE_VOORWAARDEN_B2B_V1.2.txt"),
        "usage_terms": ("BB-GV-B2B-NL-1.2", "02_BELGOBASE_GEBRUIKSVOORWAARDEN_V1.2.txt"),
        "privacy": ("BB-PRIVACY-NL-1.2", "03_BELGOBASE_PRIVACYVERKLARING_V1.2.txt"),
    }
    documents: dict[str, dict[str, Any]] = {}
    document_items: list[dict[str, Any]] = []
    for entry in manifest.get("documents") or []:
        if not isinstance(entry, dict) or entry.get("role") not in role_keys:
            raise AcceptanceValidationError("Webmanifest bevat een ongeldig document.")
        key = role_keys[str(entry["role"])]
        if key in documents or not isinstance(entry.get("canonical_text"), dict):
            raise AcceptanceValidationError("Webmanifest bevat dubbele of onvolledige documenten.")
        canonical = entry["canonical_text"]
        file_name = _normal_text(canonical.get("file"), f"tekstbestand voor {key}", 200)
        document_id = _normal_text(entry.get("document_id"), "document-ID", 150)
        if (
            Path(file_name).name != file_name
            or (document_id, file_name) != expected_documents[key]
            or entry.get("version") != "1.2"
        ):
            raise AcceptanceValidationError("Webmanifest bevat ongeldige documentmetadata.")
        raw = (root / file_name).read_bytes()
        expected_size = canonical.get("bytes")
        expected_hash = _normalize_hash(canonical.get("sha256"), f"teksthash voor {key}")
        if type(expected_size) is not int or len(raw) != expected_size or hashlib.sha256(raw).hexdigest() != expected_hash:
            raise AcceptanceValidationError(f"Webdocument {key} wijkt af.")
        item = {
            "key": key,
            "document_id": document_id,
            "title": _normal_text(entry.get("title"), "documenttitel", 200),
            "role": str(entry["role"]),
            "version": _normal_text(entry.get("version"), "documentversie", 50),
            "text_file": file_name,
            "text_sha256": expected_hash,
        }
        documents[key] = item
        document_items.append(item)
    if set(documents) != {"terms", "usage_terms", "privacy"}:
        raise AcceptanceValidationError("Webmanifest mist een verplicht document.")

    choices: dict[str, dict[str, str]] = {}
    document_ids = {item["document_id"] for item in document_items}
    expected_choices = {
        "general_terms": ("active_acceptance", "BB-AV-B2B-NL-1.2", "Algemene voorwaarden gelezen en goedgekeurd."),
        "usage_terms": ("active_acceptance", "BB-GV-B2B-NL-1.2", "Gebruiksvoorwaarden gelezen en goedgekeurd."),
        "privacy_notice": ("acknowledgement_not_consent", "BB-PRIVACY-NL-1.2", "Privacyverklaring ontvangen en gelezen."),
    }
    for choice in flow.get("choices") or []:
        if not isinstance(choice, dict) or choice.get("document_id") not in document_ids:
            raise AcceptanceValidationError("Webmanifest bevat een ongeldige acceptatiekeuze.")
        choice_id = _normal_text(choice.get("id"), "keuze-ID", 100)
        template = _normal_text(choice.get("text_template"), "keuzetekst", 1000)
        template_hash = _normalize_hash(choice.get("text_template_sha256"), "keuzeteksthash")
        if (
            choice_id in choices
            or choice_id not in expected_choices
            or (choice.get("kind"), choice.get("document_id"), template) != expected_choices[choice_id]
            or hashlib.sha256(template.encode("utf-8")).hexdigest() != template_hash
        ):
            raise AcceptanceValidationError("Webmanifest bevat een afwijkende acceptatiekeuze.")
        choices[choice_id] = {
            "kind": _normal_text(choice.get("kind"), "keuzetype", 100),
            "text_template": template,
            "text_template_sha256": template_hash,
        }
    if set(choices) != {"general_terms", "usage_terms", "privacy_notice"}:
        raise AcceptanceValidationError("Webmanifest mist een verplichte acceptatiekeuze.")
    return {
        "manifest_schema": WEB_CURRENT_MANIFEST_SCHEMA,
        "manifest_file": WEB_CURRENT_MANIFEST_FILE,
        "manifest_sha256": manifest_sha256,
        "legal_set_id": WEB_CURRENT_LEGAL_SET_ID,
        "language": "nl-BE",
        "effective_date": _normal_text(manifest.get("document_date"), "documentdatum", 30),
        "acceptance_flow_version": str(flow["version"]),
        "terms_version": documents["terms"]["version"],
        "usage_terms_version": documents["usage_terms"]["version"],
        "privacy_version": documents["privacy"]["version"],
        "terms_text_sha256": documents["terms"]["text_sha256"],
        "usage_terms_text_sha256": documents["usage_terms"]["text_sha256"],
        "privacy_text_sha256": documents["privacy"]["text_sha256"],
        "documents": documents,
        "document_items": document_items,
        "choices": choices,
    }


def _bundle_key(legal_set_id: Any, manifest_sha256: Any) -> str:
    return f"{str(legal_set_id or '')}:{str(manifest_sha256 or '').lower()}"


def _compatible_web_bundle(
    legal_bundle: dict[str, Any], legal_set_id: Any, manifest_sha256: Any
) -> dict[str, Any]:
    key = _bundle_key(legal_set_id, manifest_sha256)
    if key == _bundle_key(legal_bundle.get("legal_set_id"), legal_bundle.get("manifest_sha256")):
        return legal_bundle
    compatible = legal_bundle.get("_compatible_web_bundles")
    result = compatible.get(key) if isinstance(compatible, dict) else None
    if not isinstance(result, dict):
        raise WebEnrollmentUnavailable("unsupported_web_legal_set")
    return result


def load_web_legal_bundle(legal_dir: Path) -> dict[str, Any]:
    root = Path(legal_dir)
    previous = load_legal_bundle(root, legal_set_id=FIRST_USE_LEGAL_SET_ID)
    if not (root / WEB_CURRENT_MANIFEST_FILE).is_file():
        return previous
    current = _load_current_web_legal_bundle(root)
    result = dict(current)
    result["_compatible_web_bundles"] = {
        _bundle_key(previous["legal_set_id"], previous["manifest_sha256"]): previous,
        _bundle_key(current["legal_set_id"], current["manifest_sha256"]): current,
    }
    return result


def trusted_public_key_from_signing_key(path: Path) -> str:
    key = load_signing_private_key(path)
    return _b64encode(
        key.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
    )


def initialize_web_enrollment(database_path: Path) -> None:
    require_account_registry_v3(database_path)
    connection = connect_database(Path(database_path))
    try:
        connection.executescript(WEB_SCHEMA)
        connection.commit()
    finally:
        connection.close()


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _active_claim(
    connection: sqlite3.Connection, claim_id: str, email: str, now_text: str
) -> sqlite3.Row:
    row = connection.execute(
        "SELECT * FROM web_account_enrollment_claims WHERE claim_id=?",
        (str(claim_id or "").strip(),),
    ).fetchone()
    if (
        row is None
        or row["status"] != "active"
        or row["expires_at_utc"] <= now_text
        or row["email_normalized"] != normalize_email(email)
    ):
        raise WebEnrollmentUnavailable("enrollment_expired")
    return row


def _active_license_row(connection: sqlite3.Connection, license_id: str, now_text: str) -> sqlite3.Row:
    row = connection.execute(
        "SELECT license_id,customer_id,status,plan,starts_at,expires_at FROM licenses WHERE license_id=?",
        (license_id,),
    ).fetchone()
    if (
        row is None
        or row["status"] != "active"
        or (row["starts_at"] and row["starts_at"] > now_text)
        or (row["expires_at"] and row["expires_at"] <= now_text)
    ):
        raise WebEnrollmentUnavailable("license_inactive")
    return row


def prepare_web_enrollment(
    license_code: str,
    email: str,
    *,
    database_path: Path = DEFAULT_DATABASE_PATH,
    pepper_path: Path = DEFAULT_PEPPER_PATH,
) -> dict[str, Any]:
    normalized_email = normalize_email(email)
    license_record = validate_credential(
        license_code, database_path=database_path, pepper_path=pepper_path
    )
    initialize_web_enrollment(database_path)
    now = _now()
    now_text = iso_utc(now)
    expires = iso_utc(now + dt.timedelta(seconds=CLAIM_TTL_SECONDS))
    claim_id = str(uuid.uuid4())
    connection = connect_database(Path(database_path))
    try:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute(
            """UPDATE web_account_enrollment_claims SET status='expired'
               WHERE status='active' AND expires_at_utc<=?""",
            (now_text,),
        )
        profile = connection.execute(
            "SELECT support_email FROM license_customer_profiles WHERE license_id=?",
            (license_record["license_id"],),
        ).fetchone()
        if profile is not None:
            raise AcceptanceConflictError("binding_conflict")
        active = connection.execute(
            "SELECT 1 FROM web_account_enrollment_claims WHERE license_id=? AND status='active'",
            (license_record["license_id"],),
        ).fetchone()
        if active is not None:
            raise AcceptanceConflictError("claim_unavailable")
        connection.execute(
            """INSERT INTO web_account_enrollment_claims(
                   claim_id,license_id,customer_id,email_normalized,status,
                   created_at_utc,expires_at_utc
               ) VALUES(?,?,?,?,'active',?,?)""",
            (
                claim_id,
                license_record["license_id"],
                license_record["customer_id"],
                normalized_email,
                now_text,
                expires,
            ),
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "ok": True,
        "claim_id": claim_id,
        "license_id": license_record["license_id"],
        "customer_id": license_record["customer_id"],
        "email": normalized_email,
    }


def cancel_web_enrollment(
    claim_id: str, *, database_path: Path = DEFAULT_DATABASE_PATH
) -> dict[str, Any]:
    initialize_web_enrollment(database_path)
    connection = connect_database(Path(database_path))
    try:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute(
            "UPDATE web_account_enrollment_claims SET status='cancelled' WHERE claim_id=? AND status='active'",
            (str(claim_id or "").strip(),),
        )
        connection.commit()
    finally:
        connection.close()
    return {"ok": True}


def _web_snapshot(
    claim: sqlite3.Row,
    license_row: sqlite3.Row,
    company: dict[str, Any],
    legal_bundle: dict[str, Any],
    preflight_id: str,
) -> dict[str, Any]:
    if legal_bundle.get("legal_set_id") not in {
        WEB_CURRENT_LEGAL_SET_ID,
        FIRST_USE_LEGAL_SET_ID,
    }:
        raise WebEnrollmentUnavailable("unsupported_web_legal_set")
    choice_ids = set(legal_bundle.get("choices") or {})
    required_choices = {"general_terms", "usage_terms", "privacy_notice"}
    if choice_ids not in (required_choices, required_choices | {"business_authority"}):
        raise WebEnrollmentUnavailable("unsupported_web_legal_set")
    legal_name = _normal_text(company.get("legal_name"), "wettelijke klantnaam", 300)
    enterprise = normalize_enterprise_number(company.get("enterprise_number"))
    authority_text = f"Ik verklaar dat ik bevoegd ben om {legal_name} te vertegenwoordigen."
    authority = {
        "version": "web-business-authority-1",
        "text": authority_text,
        "sha256": hashlib.sha256(authority_text.encode("utf-8")).hexdigest(),
    }
    documents = []
    for item in legal_bundle.get("document_items") or []:
        document_id = _normal_text(item.get("document_id"), "document-ID", 150)
        documents.append(
            {
                "document_id": document_id,
                "title": _normal_text(item.get("title"), "documenttitel", 200),
                "role": _normal_text(item.get("role"), "documentrol", 100),
                "version": _normal_text(item.get("version"), "documentversie", 50),
                "view_url": f"/api/web/enrollment/legal/{preflight_id}/{document_id}",
                "download_url": f"/api/web/enrollment/legal/{preflight_id}/{document_id}?format=pdf",
                "sha256": _normalize_hash(item.get("text_sha256"), "documenthash"),
            }
        )
    if len(documents) != 3:
        raise WebEnrollmentUnavailable("unsupported_web_legal_set")
    return {
        "channel": "web",
        "claim_id": claim["claim_id"],
        "customer": {
            "customer_id": claim["customer_id"],
            "customer_number": normalize_customer_number(claim["customer_id"]),
            "legal_name": legal_name,
            "enterprise_number": enterprise,
            "support_email": claim["email_normalized"],
            "address": company.get("address") if isinstance(company.get("address"), dict) else {},
        },
        "license": {
            "license_id": license_row["license_id"],
            "status": license_row["status"],
            "plan": license_row["plan"],
            "starts_at": license_row["starts_at"],
            "expires_at": license_row["expires_at"],
        },
        "legal": {
            "legal_set_id": legal_bundle["legal_set_id"],
            "language": legal_bundle["language"],
            "manifest_sha256": legal_bundle["manifest_sha256"],
            "documents": documents,
            "choice_texts": _render_choice_texts(legal_bundle, legal_name),
            "authority_declaration": authority,
        },
    }


def web_enrollment_preflight(
    claim_id: str,
    email: str,
    company: dict[str, Any],
    legal_bundle: dict[str, Any],
    *,
    database_path: Path = DEFAULT_DATABASE_PATH,
) -> dict[str, Any]:
    initialize_web_enrollment(database_path)
    if not isinstance(company, dict) or company.get("company_type") != "business":
        raise AcceptanceValidationError("company_invalid")
    now = _now()
    now_text = iso_utc(now)
    preflight_id = str(uuid.uuid4())
    connection = connect_database(Path(database_path))
    try:
        connection.execute("BEGIN IMMEDIATE")
        claim = _active_claim(connection, claim_id, email, now_text)
        license_row = _active_license_row(connection, claim["license_id"], now_text)
        if connection.execute(
            "SELECT 1 FROM license_customer_profiles WHERE license_id=?",
            (claim["license_id"],),
        ).fetchone() is not None:
            raise AcceptanceConflictError("binding_conflict")
        connection.execute(
            "DELETE FROM web_account_legal_preflights WHERE claim_id=? AND consumed_at_utc IS NULL",
            (claim["claim_id"],),
        )
        snapshot = _web_snapshot(claim, license_row, company, legal_bundle, preflight_id)
        canonical = _canonical_json(snapshot)
        fingerprint = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        expires = iso_utc(now + dt.timedelta(seconds=PREFLIGHT_TTL_SECONDS))
        connection.execute(
            """INSERT INTO web_account_legal_preflights(
                   preflight_id,claim_id,license_id,snapshot_json,snapshot_sha256,
                   issued_at_utc,expires_at_utc
               ) VALUES(?,?,?,?,?,?,?)""",
            (
                preflight_id,
                claim["claim_id"],
                claim["license_id"],
                canonical,
                fingerprint,
                now_text,
                expires,
            ),
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "ok": True,
        "company": {
            "company_type": "business",
            **snapshot["customer"],
        },
        "legal": snapshot["legal"],
        "preflight_id": preflight_id,
        "preflight_fingerprint": fingerprint,
    }


def complete_web_enrollment(
    claim_id: str,
    email: str,
    payload: dict[str, Any],
    legal_bundle: dict[str, Any],
    signing_private_key_path: Path,
    *,
    database_path: Path = DEFAULT_DATABASE_PATH,
) -> dict[str, Any]:
    initialize_web_enrollment(database_path)
    normalized_email = normalize_email(email)
    expected_declarations = {
        "terms_accepted",
        "usage_terms_accepted",
        "privacy_acknowledged",
        "authority_declared",
    }
    declarations = payload.get("declarations")
    if (
        payload.get("company_type") != "business"
        or not isinstance(declarations, dict)
        or set(declarations) != expected_declarations
        or any(value is not True for value in declarations.values())
    ):
        raise AcceptanceValidationError("legal_acceptance_invalid")
    acceptant = payload.get("acceptant")
    if not isinstance(acceptant, dict) or set(acceptant) != {"name", "function"}:
        raise AcceptanceValidationError("legal_acceptance_invalid")
    acceptant_name = _normal_text(acceptant.get("name"), "naam", 200)
    acceptant_function = _normal_text(acceptant.get("function"), "functie", 200)
    preflight_id = _normal_text(payload.get("preflight_id"), "preflight-ID", 128)
    supplied_fingerprint = _normalize_hash(
        payload.get("preflight_fingerprint"), "preflightvingerafdruk"
    )
    enterprise = normalize_enterprise_number(payload.get("enterprise_number"))
    legal_name = _normal_text(payload.get("legal_name"), "wettelijke klantnaam", 300)
    choices = payload.get("choice_texts")
    if not isinstance(choices, dict):
        raise AcceptanceValidationError("legal_acceptance_invalid")

    key = load_signing_private_key(signing_private_key_path)
    public_bytes = key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    public_key_b64 = _b64encode(public_bytes)
    key_id = hashlib.sha256(public_bytes).hexdigest()[:24]
    now_text = iso_utc(_now())
    connection = connect_database(Path(database_path))
    try:
        connection.execute("BEGIN IMMEDIATE")
        existing = connection.execute(
            "SELECT * FROM web_legal_acceptance_receipts WHERE claim_id=?",
            (claim_id,),
        ).fetchone()
        if existing is not None:
            stored = json.loads(existing["canonical_receipt_json"])
            if (
                stored.get("preflight", {}).get("id") != preflight_id
                or stored.get("preflight", {}).get("snapshot_sha256") != supplied_fingerprint
                or stored.get("acceptant", {}).get("name") != acceptant_name
                or stored.get("acceptant", {}).get("function") != acceptant_function
                or stored.get("declarations") != declarations
                or {
                    key: value.get("text")
                    for key, value in (stored.get("choice_confirmations") or {}).items()
                }
                != choices
            ):
                raise AcceptanceConflictError("binding_conflict")
            connection.rollback()
            return {
                "ok": True,
                "completion_id": existing["acceptance_id"],
                "claim_id": claim_id,
                "license_id": existing["license_id"],
                "customer_id": stored["customer"]["customer_id"],
                "email": existing["business_email"],
            }
        claim = _active_claim(connection, claim_id, normalized_email, now_text)
        license_row = _active_license_row(connection, claim["license_id"], now_text)
        preflight = connection.execute(
            "SELECT * FROM web_account_legal_preflights WHERE preflight_id=? AND claim_id=?",
            (preflight_id, claim_id),
        ).fetchone()
        if (
            preflight is None
            or preflight["consumed_at_utc"] is not None
            or preflight["expires_at_utc"] <= now_text
            or preflight["snapshot_sha256"] != supplied_fingerprint
        ):
            raise AcceptanceValidationError("legal_acceptance_invalid")
        snapshot = json.loads(preflight["snapshot_json"])
        customer = snapshot["customer"]
        snapshot_bundle = _compatible_web_bundle(
            legal_bundle,
            snapshot.get("legal", {}).get("legal_set_id"),
            snapshot.get("legal", {}).get("manifest_sha256"),
        )
        if (
            customer["enterprise_number"] != enterprise
            or customer["legal_name"] != legal_name
            or customer["support_email"] != normalized_email
            or choices != snapshot["legal"]["choice_texts"]
        ):
            raise AcceptanceValidationError("legal_acceptance_invalid")
        if connection.execute(
            "SELECT 1 FROM license_customer_profiles WHERE license_id=?",
            (claim["license_id"],),
        ).fetchone() is not None:
            raise AcceptanceConflictError("binding_conflict")

        acceptance_id = str(uuid.uuid4())
        choice_confirmations = {
            choice_id: {
                "kind": snapshot_bundle["choices"][choice_id]["kind"],
                "text": text,
                "text_template_sha256": snapshot_bundle["choices"][choice_id][
                    "text_template_sha256"
                ],
                "rendered_text_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
                "confirmed": True,
            }
            for choice_id, text in choices.items()
        }
        receipt = {
            "schema": WEB_RECEIPT_SCHEMA,
            "receipt_id": acceptance_id,
            "acceptance_id": acceptance_id,
            "accepted_at_utc": now_text,
            "result": "accepted",
            "product_id": "belgobase-web",
            "channel": "web",
            "legal_set_id": snapshot["legal"]["legal_set_id"],
            "language": snapshot["legal"]["language"],
            "manifest_sha256": snapshot["legal"]["manifest_sha256"],
            "preflight": {"id": preflight_id, "snapshot_sha256": supplied_fingerprint},
            "customer": customer,
            "license": dict(snapshot["license"]),
            "acceptant": {
                "name": acceptant_name,
                "business_email": normalized_email,
                "function": acceptant_function,
            },
            "declarations": dict(declarations),
            "authority_declaration": snapshot["legal"].get("authority_declaration"),
            "choice_confirmations": choice_confirmations,
            "documents": snapshot["legal"]["documents"],
        }
        canonical = _canonical_json(receipt)
        signature = _b64encode(key.sign(canonical.encode("utf-8")))
        connection.execute(
            """INSERT INTO license_customer_profiles(
                   license_id,customer_number,legal_name,enterprise_number,
                   support_email,created_at,updated_at
               ) VALUES(?,?,?,?,?,?,?)""",
            (
                claim["license_id"],
                customer["customer_number"],
                legal_name,
                enterprise,
                normalized_email,
                now_text,
                now_text,
            ),
        )
        profile = connection.execute(
            "SELECT * FROM license_customer_profiles WHERE license_id=?",
            (claim["license_id"],),
        ).fetchone()
        connection.execute(
            """INSERT INTO customer_profile_audit(
                   license_id,action,actor,reason,occurred_at,before_json,after_json
               ) VALUES(?,?,?,?,?,?,?)""",
            (
                claim["license_id"],
                "profile_created",
                "web-legal-acceptance",
                "Eerste klantkoppeling via geverifieerde webinschrijving.",
                now_text,
                _canonical_json({}),
                _canonical_json(dict(profile)),
            ),
        )
        connection.execute(
            """INSERT INTO web_legal_acceptance_receipts(
                   acceptance_id,claim_id,preflight_id,license_id,customer_number,
                   legal_name,enterprise_number,acceptant_name,business_email,
                   acceptant_function,legal_set_id,manifest_sha256,accepted_at_utc,
                   canonical_receipt_json,signing_key_id,signature_b64,public_key_b64
               ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                acceptance_id,
                claim_id,
                preflight_id,
                claim["license_id"],
                customer["customer_number"],
                legal_name,
                enterprise,
                acceptant_name,
                normalized_email,
                acceptant_function,
                snapshot["legal"]["legal_set_id"],
                snapshot["legal"]["manifest_sha256"],
                now_text,
                canonical,
                key_id,
                signature,
                public_key_b64,
            ),
        )
        connection.execute(
            "UPDATE web_account_legal_preflights SET consumed_at_utc=? WHERE preflight_id=?",
            (now_text, preflight_id),
        )
        connection.execute(
            """UPDATE web_account_enrollment_claims
               SET status='completed',completed_acceptance_id=? WHERE claim_id=?""",
            (acceptance_id, claim_id),
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "ok": True,
        "completion_id": acceptance_id,
        "claim_id": claim_id,
        "license_id": license_row["license_id"],
        "customer_id": claim["customer_id"],
        "email": normalized_email,
    }


def web_enrollment_document(
    claim_id: str,
    email: str,
    preflight_id: str,
    document_id: str,
    legal_bundle: dict[str, Any],
    legal_dir: Path,
    *,
    database_path: Path = DEFAULT_DATABASE_PATH,
) -> dict[str, Any]:
    now_text = iso_utc(_now())
    connection = connect_database(Path(database_path))
    try:
        claim = _active_claim(connection, claim_id, email, now_text)
        row = connection.execute(
            "SELECT snapshot_json,expires_at_utc FROM web_account_legal_preflights WHERE preflight_id=? AND claim_id=?",
            (str(preflight_id or "").strip(), claim["claim_id"]),
        ).fetchone()
    finally:
        connection.close()
    if row is None or row["expires_at_utc"] <= now_text:
        raise WebEnrollmentUnavailable("enrollment_expired")
    snapshot = json.loads(row["snapshot_json"])
    snapshot_bundle = _compatible_web_bundle(
        legal_bundle,
        snapshot.get("legal", {}).get("legal_set_id"),
        snapshot.get("legal", {}).get("manifest_sha256"),
    )
    allowed = {
        item["document_id"]: item
        for item in snapshot.get("legal", {}).get("documents", [])
        if isinstance(item, dict) and isinstance(item.get("document_id"), str)
    }
    expected = allowed.get(str(document_id or ""))
    source = next(
        (
            item
            for item in snapshot_bundle.get("document_items") or []
            if item.get("document_id") == document_id
        ),
        None,
    )
    if expected is None or source is None:
        raise AcceptanceValidationError("document_not_found")
    path = Path(legal_dir) / str(source["text_file"])
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected["sha256"]:
        raise WebEnrollmentUnavailable("legal_document_changed")
    return {
        "ok": True,
        "title": expected["title"],
        "text": raw.decode("utf-8-sig"),
        "sha256": expected["sha256"],
    }


def project_web_account(
    auth_context: dict[str, Any],
    payload: dict[str, Any],
    legal_bundle: dict[str, Any],
    legal_dir: Path,
    trusted_public_key_b64: str,
    *,
    database_path: Path = DEFAULT_DATABASE_PATH,
) -> dict[str, Any]:
    license_id = str(auth_context.get("license_id") or "")
    customer_id = str(auth_context.get("customer_id") or "")
    email = normalize_email(auth_context.get("email"))
    if (
        auth_context.get("principal_type") != "web"
        or not license_id
        or not customer_id
    ):
        raise AcceptanceValidationError("authorization_denied")
    action = str(payload.get("action") or "refresh")
    if action not in {"refresh", "receipt", "document"}:
        raise AcceptanceValidationError("account_action_invalid")
    connection = connect_database(Path(database_path))
    try:
        profile = connection.execute(
            "SELECT * FROM license_customer_profiles WHERE license_id=?",
            (license_id,),
        ).fetchone()
        license_row = connection.execute(
            "SELECT * FROM licenses WHERE license_id=? AND customer_id=?",
            (license_id, customer_id),
        ).fetchone()
        web_receipt = connection.execute(
            """SELECT * FROM web_legal_acceptance_receipts
               WHERE license_id=? ORDER BY accepted_at_utc DESC LIMIT 1""",
            (license_id,),
        ).fetchone()
        legacy_receipt = connection.execute(
            """SELECT * FROM legal_acceptance_receipts
               WHERE license_id=? ORDER BY accepted_at_utc DESC LIMIT 1""",
            (license_id,),
        ).fetchone()
        text_receipt = connection.execute(
            """SELECT * FROM text_legal_acceptance_receipts
               WHERE license_id=? ORDER BY accepted_at_utc DESC LIMIT 1""",
            (license_id,),
        ).fetchone()
    finally:
        connection.close()
    if (
        profile is None
        or license_row is None
        or profile["support_email"] != email
    ):
        raise AcceptanceValidationError("account_not_ready")
    available_receipts = [
        row for row in (web_receipt, legacy_receipt, text_receipt) if row is not None
    ]
    receipt_row = max(
        available_receipts,
        key=lambda row: (str(row["accepted_at_utc"]), str(row["acceptance_id"])),
    ) if available_receipts else None
    if receipt_row is None:
        raise AcceptanceValidationError("account_not_ready")
    receipt = json.loads(receipt_row["canonical_receipt_json"])
    try:
        receipt_bundle = _compatible_web_bundle(
            legal_bundle,
            receipt.get("legal_set_id"),
            receipt.get("manifest_sha256"),
        )
    except WebEnrollmentUnavailable:
        if receipt.get("channel") == "web":
            raise
        receipt_bundle = None
    envelope = {
        "receipt": receipt,
        "signature": {
            "algorithm": "Ed25519",
            "key_id": receipt_row["signing_key_id"],
            "value": receipt_row["signature_b64"],
            "public_key_b64": receipt_row["public_key_b64"],
        },
    }
    if not verify_signed_receipt(envelope, trusted_public_key_b64):
        raise AcceptanceValidationError("receipt_integrity_invalid")
    receipt_customer = receipt.get("customer")
    receipt_license = receipt.get("license")
    receipt_acceptant = receipt.get("acceptant")
    if (
        not isinstance(receipt_customer, dict)
        or not isinstance(receipt_license, dict)
        or not isinstance(receipt_acceptant, dict)
        or receipt.get("acceptance_id") != receipt_row["acceptance_id"]
        or receipt.get("accepted_at_utc") != receipt_row["accepted_at_utc"]
        or receipt_license.get("license_id") != license_id
        or receipt_customer.get("customer_number") != profile["customer_number"]
        or receipt_customer.get("legal_name") != profile["legal_name"]
        or receipt_customer.get("enterprise_number") != profile["enterprise_number"]
        or receipt_customer.get("support_email") != profile["support_email"]
        or receipt_acceptant.get("business_email") != profile["support_email"]
        or (
            receipt_customer.get("customer_id") is not None
            and receipt_customer.get("customer_id") != customer_id
        )
    ):
        raise AcceptanceValidationError("receipt_identity_invalid")
    documents = (
        [
            {"key": item["document_id"], "label": item["title"]}
            for item in receipt_bundle.get("document_items") or []
            if isinstance(item, dict)
            and isinstance(item.get("document_id"), str)
            and isinstance(item.get("title"), str)
        ] if isinstance(receipt_bundle, dict) else []
    )
    if action == "refresh":
        return {
            "ok": True,
            "rows": [
                {"label": "Onderneming", "value": profile["legal_name"]},
                {"label": "KBO-nummer", "value": profile["enterprise_number"]},
                {"label": "Benoemde gebruiker", "value": receipt["acceptant"]["name"]},
                {"label": "Zakelijk e-mailadres", "value": profile["support_email"]},
                {"label": "Functie", "value": receipt["acceptant"]["function"]},
                {"label": "Licentiestatus", "value": license_row["status"]},
                {"label": "Licentieplan", "value": license_row["plan"]},
                {"label": "Licentie geldig vanaf", "value": license_row["starts_at"] or ""},
                {"label": "Licentie geldig tot", "value": license_row["expires_at"] or ""},
            ],
            "documents": documents,
        }
    if action == "receipt":
        return {
            "ok": True,
            "title": "Licentiebewijs",
            "receipt_summary": [
                {"label": "Onderneming", "value": profile["legal_name"]},
                {"label": "KBO-nummer", "value": profile["enterprise_number"]},
                {"label": "Geaccepteerd op", "value": receipt["accepted_at_utc"]},
                {"label": "Juridische set", "value": receipt["legal_set_id"]},
                {
                    "label": "Kanaal",
                    "value": "Web" if receipt.get("channel") == "web" else "Desktop",
                },
            ],
            "details_title": "Gesigneerd ontvangstbewijs",
            "details": _canonical_json(
                {
                    "receipt": receipt,
                    "signature": {
                        "algorithm": "Ed25519",
                        "key_id": receipt_row["signing_key_id"],
                        "value": receipt_row["signature_b64"],
                        "public_key_b64": receipt_row["public_key_b64"],
                    },
                }
            ),
        }
    key = str(payload.get("key") or "")
    item = next(
        (
            item
            for item in receipt_bundle.get("document_items") or []
            if item.get("document_id") == key
        ),
        None,
    ) if isinstance(receipt_bundle, dict) else None
    if item is None or key not in {entry["key"] for entry in documents}:
        raise AcceptanceValidationError("document_not_found")
    path = Path(legal_dir) / str(item["text_file"])
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != str(item["text_sha256"]):
        raise WebEnrollmentUnavailable("legal_document_changed")
    return {
        "ok": True,
        "title": str(item["title"]),
        "text": raw.decode("utf-8-sig"),
    }
