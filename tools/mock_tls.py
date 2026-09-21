"""Ephemeral loopback-only TLS material for the production browser test.

No OS trust-store changes; only the child Next process trusts this certificate.
"""
from pathlib import Path
import datetime as dt
import ipaddress
import sys
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

destination = Path(sys.argv[1])
destination.mkdir(parents=True, exist_ok=True)
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "BelgoBase loopback test")])
now = dt.datetime.now(dt.timezone.utc)
cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
        .public_key(key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(now-dt.timedelta(minutes=1)).not_valid_after(now+dt.timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]), critical=False)
        .sign(key, hashes.SHA256()))
(destination/"cert.pem").write_bytes(cert.public_bytes(serialization.Encoding.PEM))
(destination/"key.pem").write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
