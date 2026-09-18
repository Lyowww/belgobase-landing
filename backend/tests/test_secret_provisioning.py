import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    'web_secret_provision', Path(__file__).resolve().parents[2] / 'tools/provision_web_secrets.py')
provisioning = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provisioning)


class SecretProvisioningTest(unittest.TestCase):
    def test_running_daily_changes_nothing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'secrets'
            with patch.object(provisioning, 'ROOT', root), \
                 patch.object(provisioning.os, 'name', 'nt'), \
                 patch.object(Path, 'is_dir', return_value=True), \
                 patch.object(provisioning.subprocess, 'run', return_value=
                              subprocess.CompletedProcess([], 0, 'Running\n', '')):
                self.assertEqual(provisioning.provision(),
                                 {'status': 'WAIT_FOR_DAILY', 'changed': False})
            self.assertFalse(root.exists())

    def test_repeat_preserves_keys_and_output_is_public_only(self):
        def process(command, **_kwargs):
            return subprocess.CompletedProcess(command, 0,
                'Ready\n' if 'Get-ScheduledTask' in str(command) else '', '')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'secrets'
            with patch.object(provisioning, 'ROOT', root), \
                 patch.object(provisioning.os, 'name', 'nt'), \
                 patch.object(Path, 'is_dir', return_value=True), \
                 patch.object(provisioning.subprocess, 'run', side_effect=process):
                first = provisioning.provision()
                before = {p.name: p.read_bytes() for p in root.iterdir()}
                second = provisioning.provision()
                self.assertEqual(before, {p.name: p.read_bytes() for p in root.iterdir()})
            self.assertEqual(first['public_key_spki_der_base64'], second['public_key_spki_der_base64'])
            self.assertEqual(second['created'], [])
            self.assertNotIn('PRIVATE KEY', json.dumps(first))
            self.assertEqual(set(first['created']), {'auth', 'proof', 'mail'})


if __name__ == '__main__':
    unittest.main()
