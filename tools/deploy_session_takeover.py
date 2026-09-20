"""Bounded authenticated session replacement patch. No dataset or installer changes."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
REMOTE = r'''
import base64,datetime,json,sqlite3,win32event
targets = {
 'web': SERVER_ROOT/'backend/web_auth.py',
 'server_device': SERVER_ROOT/'belgobase_device_registry_43a.py',
 'account_device': ACCOUNT_ROOT/'belgobase_device_registry_43a.py',
 'server_policy': SERVER_ROOT/'belgobase_session_policy_1a.py',
 'account_policy': ACCOUNT_ROOT/'belgobase_session_policy_1a.py',
}
need(set(CONTRACT['files']) == set(targets),'patch_scope_invalid')
gates=[targets[k].with_suffix('.pending') for k in ('server_policy','account_policy')]
need(not any(p.exists() for p in gates),'pending_deployment_exists')
service=scheduler()
def check_policy_absent():
    connection=sqlite3.connect('file:'+DATABASE.as_posix()+'?mode=ro',uri=True)
    try:
        need(connection.execute("SELECT 1 FROM sqlite_master WHERE name='license_session_owner'").fetchone() is None,'database_policy_drift')
    finally: connection.close()
check_policy_absent()
need(task(service,DAILY_TASK,PIPELINE_ROOT/'31K_vps_daily_master_task.ps1').State==3,'daily_running')
for key,item in CONTRACT['files'].items():
    path=targets[key]
    need((sha(path) if path.exists() else None)==item['before'],'preimage_drift:'+key)
    item['raw']=base64.b64decode(item['source'])
    compile(item['raw'],str(path),'exec')
if not CONTRACT['deploy']:
    print(json.dumps({'status':'PREFLIGHT_OK','changed':False}))
else:
    mutex=win32event.CreateMutex(None,False,MAINTENANCE_MUTEX)
    acquired=False
    stopped=False
    changed=False
    committed=False
    folder=None
    specs=[(API_TASK,SERVER_WRAPPER,API_PORT,SERVER_ROOT/'30b_belgobase_windows_vps_api_server.py'),
           (ACCOUNT_TASK,ACCOUNT_WRAPPER,ACCOUNT_PORT,ACCOUNT_ROOT/'run_account_service_production.py')]
    try:
        acquired=win32event.WaitForSingleObject(mutex,0) in (win32event.WAIT_OBJECT_0,win32event.WAIT_ABANDONED)
        need(acquired,'maintenance_busy')
        need(task(service,DAILY_TASK,PIPELINE_ROOT/'31K_vps_daily_master_task.ps1').State==3,'daily_started')
        need(sha(CUTOVER)==CUTOVER_PATCHED_SHA256,'cutover_drift')
        folder=BACKUP_ROOT/('session_takeover_'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
        folder.mkdir(exist_ok=False)
        for key,item in CONTRACT['files'].items():
            path=targets[key]
            need((sha(path) if path.exists() else None)==item['before'],'preimage_changed:'+key)
            if path.exists():
                (folder/key).write_bytes(path.read_bytes())
                need(sha(folder/key)==item['before'],'backup_invalid:'+key)
        stopped=True
        for spec in specs: stop_task(service,*spec)
        check_policy_absent()
        src=sqlite3.connect(str(DATABASE));dst=sqlite3.connect(str(folder/'licenses_before.sqlite3'))
        try: src.backup(dst)
        finally: dst.close();src.close()
        changed=True
        for gate in gates: gate.write_text("pending",encoding="ascii")
        for key,item in CONTRACT['files'].items():
            atomic_write(targets[key],item['raw'])
            need(sha(targets[key])==item['after'],'installed_hash_invalid:'+key)
        for spec in reversed(specs): start_task(service,*spec)
        stopped=False
        status,health=request(API_PORT,'GET','/health')
        need(status==200 and health.get('ok') is True,'api_health_failed')
        status,data=request(API_PORT,'GET','/web/auth/session')
        need(status==401 and data.get('error')=='session_invalid','session_canary_failed')
        status,data=request(ACCOUNT_PORT,'GET','/account/me')
        need(status==401 and data.get('error')=='device_auth_invalid','account_canary_failed')
        result={'status':'DEPLOYED','backup':str(folder),'hashes':{key:sha(path) for key,path in targets.items()}}
        (folder/'result.json').write_text(json.dumps(result),encoding='utf-8')
        committed=True  # Never undo code after authenticated traffic is admitted.
        for gate in gates: gate.unlink()
        print(json.dumps(result))
    except Exception:
        if committed:
            raise RuntimeError('deployment_committed_check_pending_markers:'+str(folder))
        if changed:
            for spec in specs:
                if task(service,spec[0],spec[1]).State==4: stop_task(service,*spec)
            for key,item in CONTRACT['files'].items():
                if item['before'] is None:
                    if targets[key].exists(): targets[key].unlink()
                else:
                    atomic_write(targets[key],(folder/key).read_bytes())
                    need(sha(targets[key])==item['before'],'rollback_hash_failed:'+key)
            for gate in gates:
                if gate.exists(): gate.unlink()
        if stopped or changed:
            for spec in reversed(specs):
                if task(service,spec[0],spec[1]).State==3: start_task(service,*spec)
        raise
    finally:
        if acquired: win32event.ReleaseMutex(mutex)
        mutex.Close()
'''


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--deploy',action='store_true')
    args=parser.parse_args()
    items={
        'web': ('backend/web_auth.py','9f43bedb1e2afa181d4848d8a824645e0bfbd833e997bee04b02574fead9243d'),
        'server_device':('tools/session_takeover_payloads/server_devices.py','a1441b6a4fbd840081d675ab90a6d06580e0afa19a205e0a3ac735925d13128d'),
        'account_device':('tools/session_takeover_payloads/account_devices.py','715a3ee1ea66098ce360e7bec9c9c9c01321502ef762d11adc4a3f6a557fd8f4'),
        'server_policy':('belgobase_session_policy_1a.py',None),
        'account_policy':('belgobase_session_policy_1a.py',None),
    }
    files={}
    for key,(name,before) in items.items():
        raw=(ROOT/name).read_bytes()
        files[key]={'before':before,'after':hashlib.sha256(raw).hexdigest(),'source':base64.b64encode(raw).decode()}
    contract={'files':files,'deploy':args.deploy}
    helpers=(ROOT/'tools/deploy_web_runtime_remote.py').read_text(encoding='utf-8')
    source=("scope={'__name__':'session_helpers'}\nexec("+repr(helpers)+",scope)\nscope['CONTRACT']="+repr(contract)+"\nexec("+repr(REMOTE)+",scope)").encode()
    sys.path.insert(0,r'C:\Users\David1\Desktop\1 codes\BelgoBase_CENTRAAL\BelgoBase_Project\TOOLS\draaiboek_pc1')
    from vps_verbinding import Vps,REMOTE_PYTHON
    v=Vps(lambda _:None,lambda _:None);v.connect();p=v.protocol
    shell=p.open_shell(codepage=65001,env_vars={'PYTHONDONTWRITEBYTECODE':'1'})
    command=p.run_command(shell,REMOTE_PYTHON,[subprocess.list2cmdline(['-B','-X','utf8','-c','import sys;exec(sys.stdin.buffer.read())'])],console_mode_stdin=False,skip_cmd_shell=True)
    for offset in range(0,len(source),32768): p.send_command_input(shell,command,source[offset:offset+32768],end=False)
    p.send_command_input(shell,command,b'',end=True)
    out,err,code=p.get_command_output(shell,command)
    p.cleanup_command(shell,command);p.close_shell(shell,close_session=False)
    print(out.decode('utf-8'))
    if code:
        print(err.decode('utf-8')[-1800:]);raise SystemExit(code)


if __name__=='__main__': main()
