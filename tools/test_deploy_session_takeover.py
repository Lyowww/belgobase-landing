import base64
import hashlib
import sqlite3
import sys
import tempfile
import types
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch
from tools.deploy_session_takeover import REMOTE


class DeployTests(unittest.TestCase):
    def run_case(self, failure=None, deploy=True):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            server=root/'server'; account=root/'account'; pipeline=root/'pipeline'; backup=root/'backups'
            for p in (server/'backend',account,pipeline,backup): p.mkdir(parents=True,exist_ok=True)
            targets={'web':server/'backend/web_auth.py','server_device':server/'belgobase_device_registry_43a.py',
                'account_device':account/'belgobase_device_registry_43a.py',
                'server_policy':server/'belgobase_session_policy_1a.py','account_policy':account/'belgobase_session_policy_1a.py'}
            sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
            items={}
            for k,p in targets.items():
                if 'policy' not in k:p.write_bytes(b'# original\n')
                raw=b'# candidate\n'
                items[k]={'before':sha(p) if p.exists() else None,'after':hashlib.sha256(raw).hexdigest(),'source':base64.b64encode(raw).decode()}
            db=root/'registry.db';c=sqlite3.connect(db);c.execute('CREATE TABLE proof(value)');c.commit();c.close()
            cutover=pipeline/'cutover.py';cutover.write_bytes(b'# serialized')
            states={'daily':3,'api':4,'account':4}
            calls=[]
            def need(ok,why):
                if not ok:raise RuntimeError(why)
            def task(_s,name,_path):return types.SimpleNamespace(State=states[name])
            def stop(_s,name,*_):states[name]=3;calls.append(('stop',name))
            tripped=[]
            def start(_s,name,*_):
                if failure=='start' and not tripped:
                    tripped.append(True);raise RuntimeError('injected start')
                states[name]=4;calls.append(('start',name))
            def write(path,raw):
                path.write_bytes(raw)
                if failure=='write' and not tripped:
                    tripped.append(True);raise RuntimeError('injected write')
            def request(_port,_method,url):
                self.assertTrue(all(targets[k].with_suffix('.pending').exists() for k in ('server_policy','account_policy')))
                if url=='/health':return 200,{'ok':True}
                if url=='/account/me':return (500,{}) if failure=='health' else (401,{'error':'device_auth_invalid'})
                return 401,{'error':'session_invalid'}
            mutex=types.SimpleNamespace(Close=lambda:None)
            win=types.SimpleNamespace(CreateMutex=lambda *_:mutex,WaitForSingleObject=lambda *_:0,
                WAIT_OBJECT_0=0,WAIT_ABANDONED=128,ReleaseMutex=lambda *_:None)
            scope=dict(SERVER_ROOT=server,ACCOUNT_ROOT=account,PIPELINE_ROOT=pipeline,BACKUP_ROOT=backup,DATABASE=db,
                SERVER_WRAPPER=server/'run.cmd',ACCOUNT_WRAPPER=account/'run.cmd',API_TASK='api',ACCOUNT_TASK='account',DAILY_TASK='daily',
                API_PORT=8770,ACCOUNT_PORT=8765,MAINTENANCE_MUTEX='test',CUTOVER=cutover,CUTOVER_PATCHED_SHA256=sha(cutover),
                CONTRACT={'files':items,'deploy':deploy},need=need,sha=sha,scheduler=lambda:None,task=task,
                stop_task=stop,start_task=start,atomic_write=write,request=request)
            if failure=='drift':targets['web'].write_bytes(b'# other writer')
            if failure=='daily':states['daily']=4
            if failure=='policy':
                c=sqlite3.connect(db);c.execute('CREATE TABLE license_session_owner(license_id)');c.commit();c.close()
            with patch.dict(sys.modules,{'win32event':win}),redirect_stdout(StringIO()):
                if failure:
                    with self.assertRaises(RuntimeError):exec(REMOTE,scope)
                else:exec(REMOTE,scope)
            if failure in ('start','write','health'):
                for k,p in targets.items():
                    self.assertEqual(p.read_bytes(),b'# original\n') if 'policy' not in k else self.assertFalse(p.exists())
                self.assertEqual(states['api'],4);self.assertEqual(states['account'],4)
            elif failure in ('drift','daily','policy') or not deploy:self.assertEqual(calls,[])
            else:
                for p in targets.values():self.assertEqual(p.read_bytes(),b'# candidate\n')
                self.assertEqual(len(list(backup.glob('*/licenses_before.sqlite3'))),1)
            self.assertFalse(any(targets[k].with_suffix('.pending').exists() for k in ('server_policy','account_policy')))

    def test_preflight_no_mutations(self):self.run_case(deploy=False)
    def test_deploy(self):self.run_case()
    def test_drift_blocks(self):self.run_case('drift')
    def test_daily_blocks(self):self.run_case('daily')
    def test_existing_policy_blocks(self):self.run_case('policy')
    def test_start_failure_restores(self):self.run_case('start')
    def test_partial_write_restores(self):self.run_case('write')
    def test_failed_health_restores(self):self.run_case('health')


if __name__=='__main__':unittest.main()
