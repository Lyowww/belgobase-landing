"""Fail if tracked files match a few high-confidence secret patterns.

Prints the file path and rule name only. A clean result is not a security proof:
it does not decode history, detect rotated credentials, or understand custom formats.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RULES = (
    ("private_key", re.compile(r"-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----")),
    ("resend_key", re.compile(r"\bre_[A-Za-z0-9]{24,}\b")),
    ("aws_access_key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("github_token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b")),
    ("slack_token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    # Real Turnstile secrets are longer than the placeholder in .env.example.
    ("turnstile_secret", re.compile(r"\b0x4[A-Za-z0-9_-]{40,}\b")),
)
SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".woff", ".woff2", ".ico", ".pdf"}


def tracked_files() -> list[Path]:
    completed = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    names = [name.decode("utf-8", "surrogateescape") for name in completed.stdout.split(b"\0") if name]
    return [ROOT / name for name in names]


def main() -> int:
    findings: list[str] = []
    for path in tracked_files():
        if path.suffix.lower() in SKIP_SUFFIXES or not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        relative = path.relative_to(ROOT)
        for name, pattern in RULES:
            if pattern.search(text):
                findings.append(f"{relative}: {name}")
    if findings:
        print("Tracked secret patterns found (values omitted):", file=sys.stderr)
        for finding in findings:
            print(finding, file=sys.stderr)
        return 1
    print(f"No high-confidence secret patterns in {len(list(tracked_files()))} tracked files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
