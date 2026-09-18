import sys, tempfile, unittest, threading
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from web_workspace import AtomicTenantStore, AuthContext, CoreCallbacks, WorkspaceService

class WorkspaceServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); root = Path(self.temp.name)
        self.calls=[]
        def search(payload, auth): self.calls.append((payload, auth)); return {'rows':[{'number':'BE1'}],'total':1,'page':1,'page_size':50,'filters':payload['filters']}
        self.service=WorkspaceService(CoreCallbacks(bootstrap=lambda p,a:{'version':'test'}, search=search, export=lambda p,a:{'download_reference':'opaque','rows':2}), AtomicTenantStore(root/'store'), root/'assets')
        self.a=AuthContext('lic-a','user-a','A'); self.b=AuthContext('lic-b','user-b','B')
    def tearDown(self): self.temp.cleanup()
    def test_search_preserves_ui_dto_and_is_core_backed(self):
        r=self.service.execute('search',{'query':'','filters':{'regions':['vlaanderen']},'page':1},self.a)
        self.assertTrue(r['ok']); self.assertEqual(r['rows'][0]['number'],'BE1'); self.assertEqual(self.calls[0][0]['filters']['regions'],['vlaanderen'])
    def test_workspace_is_scoped_to_authenticated_tenant(self):
        self.assertTrue(self.service.execute('workspace_save',{'workspace':{'lists':[{'id':'a'}]},'workspace_revision':0},self.a)['ok'])
        self.assertEqual(self.service.execute('bootstrap',{},self.a)['workspace']['lists'][0]['id'],'a')
        self.assertEqual(self.service.execute('bootstrap',{},self.b)['workspace']['lists'],[])
    def test_second_browser_sees_account_and_stale_write_is_rejected(self):
        same_account=AuthContext('lic-a','user-a','A on laptop')
        first=self.service.execute('workspace_save',{'workspace':{'lists':[{'id':'one'}]},'workspace_revision':0},self.a)
        self.assertTrue(first['ok'])
        self.assertEqual(self.service.execute('bootstrap',{},same_account)['workspace_revision'],1)
        stale=self.service.execute('workspace_save',{'workspace':{'lists':[]},'workspace_revision':0},same_account)
        self.assertFalse(stale['ok'])
        self.assertEqual(self.service.execute('bootstrap',{},self.a)['workspace']['lists'][0]['id'],'one')
    def test_operations_are_tenant_scoped(self):
        self.service.execute('search',{'operation_id':'same','filters':{}},self.a)
        self.assertNotIn('stage',self.service.execute('operation_status',{'operation_id':'same'},self.b))
        self.service.execute('cancel_operation',{'operation_id':'same'},self.b)
        self.assertFalse(self.service.execute('operation_status',{'operation_id':'same'},self.a)['cancelled'])
        self.assertEqual(self.service.execute('operation_status',{'operation_id':'same'},self.a)['completed'],1)
    def test_cancelled_lookup_does_not_deliver_a_late_result(self):
        started=threading.Event(); finish=threading.Event(); result=[]
        def lookup(payload,auth):
            started.set(); finish.wait(2); return {'company':{'name':'Late result'}}
        self.service.core=CoreCallbacks(company=lookup)
        worker=threading.Thread(target=lambda:result.append(self.service.execute('company',{'operation_id':'lookup'},self.a)))
        worker.start()
        self.assertTrue(started.wait(2))
        self.service.execute('cancel_operation',{'operation_id':'lookup'},self.a)
        finish.set(); worker.join(2)
        self.assertFalse(result[0]['ok'])
        self.assertIn('geannuleerd',result[0]['error'])
    def test_export_returns_session_owned_url_and_no_path(self):
        r=self.service.execute('export_results',{'filters':{}},self.a)
        self.assertTrue(r['ok']); self.assertRegex(r['download_url'],r'^/api/web/download/[0-9a-f]+$'); self.assertNotIn('output_path',r)
    def test_language_is_tenant_persisted_and_wallet_uses_explicit_core_callback(self):
        self.service.core=CoreCallbacks(
            bootstrap=lambda p,a:{'version':'test'},
            ai_wallet=lambda p,a:{'wallet':{'currency':'EUR','available_eur':4}},
        )
        self.assertEqual('fr',self.service.execute('set_language',{'language':'fr'},self.a)['language'])
        self.assertEqual('fr',self.service.execute('bootstrap',{},self.a)['language'])
        self.assertEqual('nl',self.service.execute('bootstrap',{},self.b)['language'])
        wallet=self.service.execute('ai_wallet',{},self.a)
        self.assertTrue(wallet['ok']); self.assertEqual(4,wallet['wallet']['available_eur'])
        self.assertFalse(self.service.execute('set_language',{'language':'de'},self.a)['ok'])

    def test_missing_core_fails_closed(self):
        r=self.service.execute('company',{'number':'BE1'},self.a)
        self.assertFalse(r['ok']); self.assertIn('Core integration ontbreekt',r['error'])

if __name__ == '__main__': unittest.main()
