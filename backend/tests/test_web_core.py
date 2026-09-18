import sys, tempfile, unittest, json
from datetime import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from web_core import WebCore
from web_workspace import AuthContext

class Main:
    FILTER_KEYS=['naam','min_omzet','start_date_min','latest_only']
    FLOAT_KEYS={'min_omzet'}; INT_KEYS=set(); DATE_KEYS={'start_date_min'}
    def normalize_premium_ai_filters(self, value): self.normalized=dict(value); return dict(value)
    def premium_ai_enum_values(self): return {'nace_prefix':[('Sector','70')], 'juridical_form':[('BV','001')]}
    def normalize_filters(self, value): return dict(value)
    def extract_selection(self, filters, payload): self.selected=dict(filters); return (dict(filters), (), (), ())
    def run_count(self, filters, regions=()): return (2, Path('index'))
    def run_results(self, payload): return ([{'ondernemingsnummer':'0123456789','naam':'Voorbeeld','gemeente_nl':'Brussel','omzet':12}],0,50,False)
    def run_xbrl_count(self, payload):
        assert payload['xbrl_metric_filters']; self.xbrl_count_payload=dict(payload); return (1, [])
    def run_xbrl_results(self, payload):
        assert payload['xbrl_metric_filters']; self.xbrl_results_payload=dict(payload); return ([{'ondernemingsnummer':'0123456789','naam':'Voorbeeld'}],0,50,False)
    def lookup_company(self, number): return ('0123456789', {'ondernemingsnummer':'0123456789','naam':'Voorbeeld','omzet':12,'kbo_postcode':'1000','nace_code':'70200','kbo_status':'AC'}, Path('index'))
    def build_autofill_filters(self, record): return {'min_omzet':'6'}
    PREMIUM_HISTORY_SOURCE='history'
    duckdb=object()
    def request_duckdb_connect(self, value): return object()
    def read_company_history(self, number, source, connect): return {'records':[{'jaar':2024,'omzet':0,'winst_verlies':None,'personeel_vte':2,'balanstotaal':5}]}
    def xbrl_metric_browse(self, payload): return {'metrics':[{'xbrl_metric_key':'m1','human_display_label_nl':'Omzet','filter_value_type':'numeric','tree_group_label_nl':'G','tree_section_label_nl':'S','tree_topic_label_nl':'T'}],'total':1,'offset':0,'has_more':False}
    def run_export(self, filters, offset, preferences=None, postcodes=()):
        self.export_filters=dict(filters); return (['ondernemingsnummer'], [('0123456789',)] if offset == 0 else [], Path('index'))
    def run_xbrl_export(self, payload, page_offset=0, deterministic_results_order=False, preferences=None):
        assert payload['xbrl_metric_filters']; self.xbrl_export_payload=dict(payload); return (['ondernemingsnummer'], [('0123456789',)] if page_offset == 0 else [], [])
    def write_xlsx_bytes(self, columns, rows): return b'xlsx'

class WebCoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.seen=[]
        logo=Path(self.tmp.name)/'logo.png'; logo.write_bytes(b'\x89PNG\r\n\x1a\n')
        metadata=json.loads((Path(__file__).resolve().parents[1] / 'workspace_assets' / 'workspace_metadata.json').read_text(encoding='utf-8'))
        self.core=WebCore(Main(), lambda auth, action, payload:self.seen.append((auth.user_id,action)), Path(self.tmp.name), metadata, logo)
        self.auth=AuthContext('license','u1','Een klant', quota_subject_id='web:browser-1')
    def tearDown(self): self.tmp.cleanup()
    def test_search_and_company_use_real_core_shapes(self):
        result=self.core.search({'filters':{},'query':'','page':1},self.auth)
        self.assertEqual(result['rows'][0]['name'],'Voorbeeld'); self.assertEqual(result['total'],2)
        self.assertEqual(self.core.company({'number':'0123456789'},self.auth)['company']['number'],'0123456789')
    def test_frozen_financial_rules_keep_missing_distinct_from_zero(self):
        self.assertIsNone(self.core._financial_value({'omzet': 44, 'omzet_status':'missing'},'omzet'))
        self.assertEqual(self.core._financial_value({'omzet': 0, 'omzet_status':'exact'},'omzet'),0.0)
        self.assertEqual(self.core._row({'personeel_vte':3,'personeel_status':'exact'})['fte'],3.0)
    def test_company_history_keeps_zero_and_missing_separate(self):
        history=self.core.company({'number':'0123456789'},self.auth)['history']
        self.assertEqual(history['years'],[2024]); self.assertEqual(history['series']['revenue'],[0]); self.assertEqual(history['series']['profit'],[None])
    def test_frozen_dossier_and_compare_consumers_receive_required_shapes(self):
        dossier=self.core.company({'number':'0123456789'},self.auth)
        self.assertEqual(set(dossier),{'company','fields','metrics','history','financial'})
        self.assertTrue({'key','label','value','unit','year','note','explanation'} <= set(dossier['metrics'][0]))
        self.assertTrue({'label','value','year','status','source','explanation'} <= set(dossier['financial'][0]))
        compared=self.core.compare_companies({'numbers':['0123456789','0123456790']},self.auth)
        self.assertEqual(len(compared['companies']),2); self.assertIsInstance(datetime.fromisoformat(compared['retrieved_at']),datetime)
    def test_xbrl_and_export_are_scoped(self):
        self.assertEqual(self.core.xbrl_catalog({'query':'','offset':0},self.auth)['metrics'][0]['key'],'m1')
        job=self.core.export({'filters':{'max_rows':2}},self.auth)['download_reference']
        self.assertTrue(self.core.resolve_download(job,self.auth).is_file())
        with self.assertRaises(Exception): self.core.resolve_download(job,AuthContext('other','u2'))
    def test_xbrl_uses_actual_30b_top_level_metric_contract_for_results_and_export(self):
        filters={'xbrl_metric_filters':[{'xbrl_metric_key':'m1','numeric_min':1}]}
        result=self.core.search({'filters':filters,'page':1},self.auth)
        self.assertEqual(result['total'],1); self.assertIn('xbrl_metric_filters',self.core.main.xbrl_count_payload)
        self.core.export({'filters':dict(filters, max_rows=2)},self.auth)
        self.assertIn('xbrl_metric_filters',self.core.main.xbrl_export_payload)
    def test_export_selection_uses_number_selection_not_unbounded_filters(self):
        self.core.export({'numbers':['0123456789']},self.auth)
        self.assertEqual(self.core.main.selected['ondernemingsnummers'],['0123456789'])
        self.assertEqual(self.core.main.export_filters['max_rows'],1)
    def test_export_preserves_ui_column_choice_as_existing_server_column(self):
        self.core.export({'filters':{'max_rows':2},'columns':['number','revenue']},self.auth)
        self.assertEqual(self.core.main.export_filters['selected_output_cols'],['ondernemingsnummer','omzet'])
    def test_similar_ports_frozen_icp_seed_and_apply(self):
        data=self.core.similar_company({'number':'0123456789'},self.auth)
        postcode=next(item for item in data['criteria'] if item['key']=='postcode')
        omzet=next(item for item in data['criteria'] if item['key']=='omzet')
        self.assertTrue(postcode['default_selected']); self.assertEqual(omzet['kind'],'number')
        filters=self.core.similar_apply({'filters':{},'criteria':[{'key':'omzet','mode':'seed','tolerance':50}]},self.auth)['filters']
        self.assertEqual(filters['min_omzet'],'6'); self.assertEqual(filters['max_omzet'],'18')
    def test_every_action_requires_authorization(self):
        self.core.export_columns({},self.auth); self.assertIn(('u1','export_columns'),self.seen)
    def test_negative_result_similarity_keeps_lower_bound_below_upper(self):
        self.core.main.lookup_company=lambda number:(number,{'winst_verlies':-100},Path('index'))
        self.core.similar_company({'number':'0123456789'},self.auth)
        filters=self.core.similar_apply({'filters':{},'criteria':[{'key':'resultaat','mode':'seed','tolerance':75}]},self.auth)['filters']
        self.assertEqual(filters['min_winst'],'-175'); self.assertEqual(filters['max_winst'],'-25')
    def test_account_projection_uses_trusted_identity_and_never_fabricates_profile(self):
        with self.assertRaisesRegex(Exception,'tijdelijk niet beschikbaar'):
            self.core.account_action({},self.auth)
        seen=[]
        def project(auth,payload):
            seen.append((auth,payload)); return {'rows':[{'label':'Onderneming','value':'Voorbeeld'}]}
        self.core.account_projector=project
        self.assertEqual(self.core.account_action({'action':'refresh'},self.auth)['rows'][0]['value'],'Voorbeeld')
        self.assertIs(seen[0][0],self.auth)
    def test_bootstrap_has_frozen_ui_catalog_and_data_uri(self):
        result=self.core.bootstrap({},self.auth)
        self.assertEqual(result['sectors'][0]['value'],''); self.assertEqual(result['legal_forms'][0]['label'],'1 — Eenmanszaak / natuurlijke persoon')
        self.assertTrue(result['brand_logo'].startswith('data:image/png;base64,'))
    def test_filter_schema_follows_server_filter_keys(self):
        schema=self.core.workspace_data({'section':'filters','filters':{}},self.auth)['schema']
        types={f['key']:f['type'] for f in schema['fields']}
        self.assertEqual(types['min_omzet'],'number'); self.assertEqual(types['start_date_min'],'date'); self.assertEqual(types['latest_only'],'boolean')
    def test_query_and_selection_metadata_are_not_lost_before_core_query(self):
        self.core.search({'filters':{'regions':['vlaanderen']},'query':'Voorbeeld','page':1},self.auth)
        self.assertEqual(self.core.main.selected['naam'],'Voorbeeld'); self.assertEqual(self.core.main.selected['regions'],['vlaanderen'])

if __name__ == '__main__': unittest.main()
