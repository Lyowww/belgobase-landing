from __future__ import annotations

import hashlib


def credential_proof_hash(value: str) -> str:
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()


def activation_message(
    license_code: str,
    device_id: str,
    public_key_b64: str,
    machine_fingerprint_hash: str,
    device_credential: str,
    client_nonce: str,
    client_timestamp: int,
) -> bytes:
    values = (
        "BelgoBase-43A",
        "activate",
        str(device_id),
        str(public_key_b64),
        str(machine_fingerprint_hash),
        credential_proof_hash(device_credential),
        credential_proof_hash(license_code),
        str(client_nonce),
        str(int(client_timestamp)),
    )
    return "\n".join(values).encode("utf-8")


def token_message(
    device_id: str,
    machine_fingerprint_hash: str,
    device_credential: str,
    client_nonce: str,
    client_timestamp: int,
) -> bytes:
    values = (
        "BelgoBase-43A",
        "token",
        str(device_id),
        str(machine_fingerprint_hash),
        credential_proof_hash(device_credential),
        str(client_nonce),
        str(int(client_timestamp)),
    )
    return "\n".join(values).encode("utf-8")


def deactivation_message(
    device_id: str,
    machine_fingerprint_hash: str,
    device_credential: str,
    reason: str,
    client_nonce: str,
    client_timestamp: int,
) -> bytes:
    values = (
        "BelgoBase-44A",
        "deactivate",
        str(device_id),
        str(machine_fingerprint_hash),
        credential_proof_hash(device_credential),
        str(reason),
        str(client_nonce),
        str(int(client_timestamp)),
    )
    return "\n".join(values).encode("utf-8")
