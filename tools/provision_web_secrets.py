"""Provision isolated authentication secrets on the BelgoBase Windows VPS.

Explicit --create only; never outputs private material or changes live services.
Only the printed public key may be pinned in the website source.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
import secrets
import subprocess


ROOT = Path("C:/BelgoBase_App/secrets/web_auth")


def provision() -> dict:
    if os.name != "nt" or not Path("C:/BelgoBase_App/server").is_dir():
        raise RuntimeError("Run only on the BelgoBase Windows VPS")
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives import serialization

    # Refuse redirected paths; protect the directory before any secret is created.
    if ROOT.resolve() != ROOT:
        raise RuntimeError("Secret directory is redirected")
    ROOT.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["icacls", str(ROOT), "/inheritance:r", "/grant:r",
         "*S-1-5-18:(OI)(CI)F", "*S-1-5-32-544:(OI)(CI)F"],
        capture_output=True, check=True,
    )
    acl_check = subprocess.run(
        ["powershell", "-NoProfile", "-Command",
         "$acl=Get-Acl -LiteralPath 'C:\\BelgoBase_App\\secrets\\web_auth'; "
         "$bad=@($acl.Access | Where-Object {"
         "$_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value "
         "-notin @('S-1-5-18','S-1-5-32-544')}); if($bad.Count){exit 1}"],
        capture_output=True,
    )
    if acl_check.returncode:
        raise RuntimeError("Unexpected existing secret-directory permissions")
    paths = {"auth": ROOT / "auth_secret.bin",
             "proof": ROOT / "account_internal_proof.bin",
             "mail": ROOT / "mail_ed25519.pem"}
    created = []
    for path in paths.values():
        if path.exists():
            if path.resolve() != path:
                raise RuntimeError("Secret file is redirected")
            subprocess.run(["icacls", str(path), "/reset"],
                           capture_output=True, check=True)
    for kind in ("auth", "proof"):
        path = paths[kind]
        if not path.exists():
            with path.open("xb") as stream:
                stream.write(secrets.token_urlsafe(48).encode("ascii") if kind == "proof" else secrets.token_bytes(48))
            created.append(kind)
        if path.resolve() != path or len(path.read_bytes()) < 32:
            raise RuntimeError("Invalid existing secret; refusing replacement")
        if kind == "proof":
            value = path.read_bytes().decode("ascii").strip()
            if len(value) < 32 or any(ch.isspace() for ch in value):
                raise RuntimeError("Internal proof must be an ASCII header token")
    path = paths["mail"]
    if not path.exists():
        key = Ed25519PrivateKey.generate()
        raw = key.private_bytes(serialization.Encoding.PEM,
                                serialization.PrivateFormat.PKCS8,
                                serialization.NoEncryption())
        with path.open("xb") as stream:
            stream.write(raw)
        created.append("mail")
    if path.resolve() != path:
        raise RuntimeError("Signing key is redirected")
    key = serialization.load_pem_private_key(path.read_bytes(), password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise RuntimeError("Existing signing key has an unexpected type")
    public = key.public_key().public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    return {"status": "PREPARED_NOT_ENABLED", "created": created,
            "public_key_spki_der_base64": base64.b64encode(public).decode("ascii"),
            "paths": {kind: str(path) for kind, path in paths.items()}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--create", action="store_true", required=True)
    parser.parse_args()
    # Keep underlying OS/provider exceptions out of logs that may be archived.
    try:
        print(json.dumps(provision()))
    except Exception:
        print(json.dumps({"status": "PROVISIONING_NOT_CONFIRMED"}))
        raise SystemExit(1)
