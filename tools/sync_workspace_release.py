"""Prepare web assets from a named desktop freeze; never deploy or change live data."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from extract_workspace_contract import main as extract_metadata


def synchronize(frozen: Path, release: str, expected_ui_sha256: str, root: Path) -> None:
    frozen = frozen.resolve(strict=True)
    ui = (frozen / 'ui.html').read_bytes()
    logo = (frozen / 'source/assets/belgobase_bb_logo.png').read_bytes()
    digest = hashlib.sha256(ui).hexdigest()
    if digest != expected_ui_sha256.lower():
        raise ValueError('De gekozen UI wijkt af van de goedgekeurde release.')
    if not logo.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('Het releaselogo is geen PNG.')
    if not release.strip() or any(c in release for c in '\r\n'):
        raise ValueError('Geef een eenduidige release-identiteit.')
    assets = root / 'src/lib/workspace/assets'
    assets.mkdir(parents=True, exist_ok=True)
    extract_metadata(frozen)
    metadata_path = root / 'backend/workspace_assets/workspace_metadata.json'
    metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
    metadata['provenance']['baseline'] = release
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
    (assets / 'frozen-ui.html').write_bytes(ui)
    (assets / 'belgobase_bb_logo.png').write_bytes(logo)
    manifest = {'release': release, 'ui_sha256': digest,
                'logo_sha256': hashlib.sha256(logo).hexdigest(),
                'contract_sha256': metadata['provenance']['sha256']}
    (assets / 'release.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    (assets / 'PROVENANCE.md').write_text(
        '# Gedeelde BelgoBase-release\n\n'
        f'Release: `{release}`. UI en logo zijn byte-identiek aan de aangewezen desktopfreeze.\n\n'
        'De hashes staan in `release.json`. De browseradapter wordt afzonderlijk getest. '
        'Deze voorbereiding publiceert niets; frontend, backend en registratie moeten samen slagen.\n',
        encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--freeze', required=True, type=Path)
    parser.add_argument('--release', required=True)
    parser.add_argument('--expected-ui-sha256', required=True)
    args = parser.parse_args()
    synchronize(args.freeze, args.release, args.expected_ui_sha256, Path(__file__).resolve().parents[1])
