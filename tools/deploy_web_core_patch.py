"""Bounded web-core/workspace correction, reusing the established VPS deployment helpers.

No account, database, dataset, wrapper or desktop release changes. The expected
preimage is an explicit argument; deployment refuses drift or a running daily.
"""
from pathlib import Path
import argparse
import base64
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
HELPER = Path(r'C:\Users\David1\Desktop\1 codes\BelgoBase_CENTRAAL\BelgoBase_Project\TOOLS\draaiboek_pc1')

REMOTE = r'''
import base64, datetime, hashlib, json, win32event
items = CONTRACT['files']
need(set(items) <= {'web_core.py', 'web_workspace.py'} and 'web_core.py' in items, 'invalid_patch_scope')
for name, item in items.items():
    item['raw'] = base64.b64decode(item['source'])
    item['target'] = SERVER_ROOT / 'backend' / name
    compile(item['raw'], str(item['target']), 'exec')
    need(sha(item['target']) == item['expected'], 'preimage_drift:' + name)
service = scheduler()
daily = task(service, DAILY_TASK, PIPELINE_ROOT / '31K_vps_daily_master_task.ps1')
need(daily.State == 3, 'daily_not_idle')
verify_listener(API_PORT, SERVER_ROOT / '30b_belgobase_windows_vps_api_server.py', True)
if CONTRACT['action'] == 'preflight':
    print(json.dumps({'status':'PREFLIGHT_OK','changed':False,'files':{name: {'before':item['expected'],'after':hashlib.sha256(item['raw']).hexdigest()} for name,item in items.items()}}))
else:
    mutex = win32event.CreateMutex(None, False, MAINTENANCE_MUTEX)
    acquired = False
    stopped = False
    changed = False
    folder = None
    try:
        acquired = win32event.WaitForSingleObject(mutex, 0) in (win32event.WAIT_OBJECT_0, win32event.WAIT_ABANDONED)
        need(acquired, 'maintenance_busy')
        need(task(service, DAILY_TASK, PIPELINE_ROOT / '31K_vps_daily_master_task.ps1').State == 3, 'daily_started')
        need(sha(CUTOVER) == CUTOVER_PATCHED_SHA256, 'cutover_serialization_not_active')
        folder = BACKUP_ROOT / ('web_core_' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
        folder.mkdir(exist_ok=False)
        for name,item in items.items():
            need(sha(item['target']) == item['expected'], 'preimage_changed:' + name)
            backup = folder / name
            backup.write_bytes(item['target'].read_bytes())
            need(sha(backup) == item['expected'], 'backup_invalid:' + name)
        stopped = True
        stop_task(service, API_TASK, SERVER_WRAPPER, API_PORT, SERVER_ROOT / '30b_belgobase_windows_vps_api_server.py')
        changed = True
        for name,item in items.items():
            atomic_write(item['target'], item['raw'])
            need(sha(item['target']) == hashlib.sha256(item['raw']).hexdigest(), 'installed_hash_invalid:' + name)
        start_task(service, API_TASK, SERVER_WRAPPER, API_PORT, SERVER_ROOT / '30b_belgobase_windows_vps_api_server.py')
        stopped = False
        status, health = request(API_PORT, 'GET', '/health')
        need(status == 200 and health.get('ok') is True, 'health_failed')
        status, session = request(API_PORT, 'GET', '/web/auth/session')
        need(status == 401 and session.get('error') == 'session_invalid', 'session_boundary_failed')
        result = {'status':'DEPLOYED','changed':True,'hashes':{name:sha(item['target']) for name,item in items.items()},'backup':str(folder),'health':True}
        (folder/'result.json').write_text(json.dumps(result),encoding='utf-8')
        print(json.dumps(result))
    except Exception:
        if changed:
            if task(service, API_TASK, SERVER_WRAPPER).State == 4:
                stop_task(service, API_TASK, SERVER_WRAPPER, API_PORT, SERVER_ROOT / '30b_belgobase_windows_vps_api_server.py')
            for name,item in items.items():
                atomic_write(item['target'], (folder/name).read_bytes())
                need(sha(item['target']) == item['expected'], 'rollback_hash_failed:' + name)
        if (changed or stopped) and task(service, API_TASK, SERVER_WRAPPER).State == 3:
            start_task(service, API_TASK, SERVER_WRAPPER, API_PORT, SERVER_ROOT / '30b_belgobase_windows_vps_api_server.py')
        if changed or stopped:
            status, health = request(API_PORT, 'GET', '/health')
            need(status == 200 and health.get('ok') is True, 'rollback_health_failed')
        raise
    finally:
        if acquired: win32event.ReleaseMutex(mutex)
        mutex.Close()
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected', required=True)
    parser.add_argument('--deploy', action='store_true')
    parser.add_argument('--expected-workspace')
    args = parser.parse_args()
    if len(args.expected) != 64 or any(c not in '0123456789abcdef' for c in args.expected):
        parser.error('expected must be a SHA256')
    files = {'web_core.py': {'expected':args.expected,'source':base64.b64encode((ROOT/'backend/web_core.py').read_bytes()).decode()}}
    if args.expected_workspace:
        if len(args.expected_workspace)!=64 or any(c not in '0123456789abcdef' for c in args.expected_workspace):
            parser.error('expected-workspace must be a SHA256')
        files['web_workspace.py']={'expected':args.expected_workspace,'source':base64.b64encode((ROOT/'backend/web_workspace.py').read_bytes()).decode()}
    contract = {'files':files,'action':'deploy' if args.deploy else 'preflight'}
    helpers = (ROOT/'tools/deploy_web_runtime_remote.py').read_text(encoding='utf-8')
    source = ("scope={'__name__':'web_patch_helpers'}\nexec(" + repr(helpers) + ",scope)\n"
              + 'scope["CONTRACT"]=' + repr(contract) + '\nexec(' + repr(REMOTE) + ',scope)').encode()
    sys.path.insert(0, str(HELPER))
    from vps_verbinding import Vps, REMOTE_PYTHON
    vps = Vps(lambda _: None, lambda _: None)
    vps.connect()
    p = vps.protocol
    shell = p.open_shell(codepage=65001, env_vars={'PYTHONDONTWRITEBYTECODE':'1'})
    command = p.run_command(shell, REMOTE_PYTHON,
        [subprocess.list2cmdline(['-B','-X','utf8','-c','import sys;exec(sys.stdin.buffer.read())'])],
        console_mode_stdin=False, skip_cmd_shell=True)
    for offset in range(0,len(source),32768):
        p.send_command_input(shell,command,source[offset:offset+32768],end=False)
    p.send_command_input(shell,command,b'',end=True)
    out, err, code = p.get_command_output(shell,command)
    p.cleanup_command(shell,command)
    p.close_shell(shell,close_session=False)
    print(out.decode('utf-8'))
    if code:
        print(err.decode('utf-8')[-1500:])
        raise SystemExit(code)


if __name__ == '__main__':
    main()
