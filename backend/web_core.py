"""Concrete server-core callbacks for :mod:`web_workspace`.

``main`` is an injected instance of the existing 30b server module.  This keeps
the authoritative DuckDB query, XBRL and financial semantics in one place and
keeps browser authentication outside this module.
"""
from __future__ import annotations

import copy
import base64
import hashlib
import math
import os
import tempfile
import threading
from datetime import datetime, timezone
import uuid
from pathlib import Path
from typing import Any, Callable, Mapping

try:  # package import in the VPS; direct import keeps the focused tests standalone.
    from .web_workspace import AuthContext, CoreCallbacks, WorkspaceError
except ImportError:  # pragma: no cover - exercised only when run as a script path
    from web_workspace import AuthContext, CoreCallbacks, WorkspaceError

# Frozen FINAL3 source: ICP_CRITERIA_SPECS, minus Tk variables. Target names are
# the 30b normalized filter keys, so no desktop state is executed on the server.
_ICP_SPECS = (
 ('postcode','Postcode','text','kbo_postcode',('kbo_postcode',),None,'',False), ('gemeente','Gemeente','text','gemeente_nl',('gemeente_nl',),None,'',False), ('land','Land','text','land',('land',),None,'',False),
 ('nace_prefix','NACE-hoofdsector','text','nace_code',('nace_prefix',),'nace_prefix','',False), ('nace_exact','Exacte NACE-code','text','nace_code',('nace_exact',),'nace_exact','',False), ('rechtsvorm','Rechtsvorm','text','juridical_form',('juridical_form',),None,'',False), ('ondernemingstype','Type onderneming','text','type_of_enterprise',('type_of_enterprise',),None,'',False), ('rechtstoestand','Rechtstoestand','text','juridical_situation',('juridical_situation',),None,'',False), ('kbo_status','KBO-status','text','kbo_status',('kbo_status',),None,'',False),
 ('startdatum','Startdatum','date','start_date',('start_date_min','start_date_max'),None,3,False), ('personeel','Personeel VTE','number','personeel_vte',('min_personeel_vte','max_personeel_vte'),None,30,False), ('omzet','Omzet','number','omzet',('min_omzet','max_omzet'),None,50,False), ('resultaat','Resultaat boekjaar','number','winst_verlies',('min_winst','max_winst'),None,75,True), ('balanstotaal','Balanstotaal','number','balanstotaal',('min_balanstotaal','max_balanstotaal'),None,50,False), ('schulden','Schulden','number','schulden',('min_schulden','max_schulden'),None,50,False), ('rest_na_schulden','Rest na schulden','number','rest_na_schulden',('min_rest_na_schulden','max_rest_na_schulden'),None,50,True), ('ebitda','EBITDA','number','ebitda',('min_ebitda','max_ebitda'),None,50,True), ('brutomarge','Brutomarge','number','brutomarge',('min_brutomarge','max_brutomarge'),None,50,True), ('eigen_vermogen','Eigen vermogen','number','eigen_vermogen',('min_eigen_vermogen','max_eigen_vermogen'),None,50,True),
)


class WebCore:
    """Adapter over the existing main8770/30b Python module.

    ``authorize`` is called for every callback and must raise on a denied
    account. It receives the trusted context, action name and JSON payload.
    """
    def __init__(self, main: Any, authorize: Callable[[AuthContext, str, Mapping[str, Any]], None],
                 download_root: str | Path, metadata: Mapping[str, Any] | None = None,
                 brand_logo_path: str | Path | None = None,
                 account_projector: Callable[[AuthContext, dict[str, Any]], Mapping[str, Any]] | None = None):
        self.main, self.authorize, self.metadata = main, authorize, dict(metadata or {})
        self.download_root = Path(download_root); self.download_root.mkdir(parents=True, exist_ok=True)
        self.brand_logo_path = Path(brand_logo_path) if brand_logo_path else None
        self.account_projector = account_projector
        self._downloads: dict[str, tuple[str, Path]] = {}
        self._similar: dict[str, dict[str, Any]] = {}
        self._similar_applied: dict[str, dict[str, tuple[Any, Any]]] = {}
        self._lock = threading.RLock()

    def callbacks(self) -> CoreCallbacks:
        return CoreCallbacks(**{name: getattr(self, name) for name in (
            'bootstrap', 'search', 'company', 'compare_companies', 'relaxation_suggestions',
            'ai', 'workspace_data', 'filters_apply', 'xbrl_catalog', 'similar_company',
            'similar_apply', 'export_columns', 'account_action', 'export', 'ai_usage')})

    def _allow(self, action: str, payload: dict[str, Any], auth: AuthContext) -> None:
        if not callable(self.authorize):
            raise WorkspaceError('Webautorisatie is niet geconfigureerd.')
        self.authorize(auth, action, copy.deepcopy(payload))

    @staticmethod
    def _tenant(auth: AuthContext) -> str:
        return hashlib.sha256((auth.license_id+'\x1f'+auth.user_id).encode()).hexdigest()

    def _normal(self, filters: Any) -> dict[str, Any]:
        if not isinstance(filters, dict): raise WorkspaceError('De filters moeten een object zijn.')
        # Regions and preferences are selection metadata owned by the existing
        # server's extract_selection helper, not normal filter fields.
        selection = {key: filters[key] for key in ('regions', 'preferences') if key in filters}
        try: normalized = self.main.normalize_premium_ai_filters({k:v for k,v in filters.items() if k not in selection})
        except Exception as exc: raise WorkspaceError(str(exc)) from exc
        return {**normalized, **selection}

    @staticmethod
    def _finite(value: Any) -> float | None:
        if value is None or isinstance(value, bool): return None
        try: value=float(value)
        except (ValueError, TypeError, OverflowError): return None
        return value if math.isfinite(value) else None

    @classmethod
    def _financial_value(cls, record: Mapping[str, Any], key: str, status_key: str | None = None) -> float | None:
        """Faithful port of frozen premium_financial.financial_value."""
        enriched={'financial_omzet','financial_winst_verlies','ebitda','brutomarge','eigen_vermogen','operating_result','addback_total_bkd_m1'}
        status=str(record.get(status_key or {'personeel_vte':'personeel_status','addback_total_bkd_m1':'addback_total_status'}.get(key,key+'_status')) or '').strip().lower()
        accepted=status in {'ok','exact','exact_1','berekend','geschat'} if key in enriched else (not status or status in {'ok','exact','exact_1'})
        return cls._finite(record.get(key)) if accepted else None

    @classmethod
    def _row(cls, record: Mapping[str, Any]) -> dict[str, Any]:
        return {'number': str(record.get('ondernemingsnummer') or ''), 'name': str(record.get('naam') or ''),
                'city': str(record.get('gemeente_nl') or ''), 'postcode': str(record.get('kbo_postcode') or ''),
                'nace': str(record.get('nace_code') or ''), 'status': str(record.get('kbo_status') or ''),
                'legal_form': str(record.get('juridical_form') or ''),
                'revenue': cls._financial_value(record, 'omzet'), 'profit': cls._financial_value(record, 'winst_verlies'),
                'fte': cls._financial_value(record, 'personeel_vte', 'personeel_status'), 'year': record.get('jaar')}

    def bootstrap(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('bootstrap', payload, auth)
        catalogs = self.metadata.get('catalogs', {})
        sectors = catalogs.get('sectors', []) if isinstance(catalogs, dict) else []
        legal = catalogs.get('legal_forms', []) if isinstance(catalogs, dict) else []
        if not sectors or not legal:
            raise WorkspaceError('Core integration ontbreekt voor: bootstrap catalogi.')
        logo = ''
        if self.brand_logo_path and self.brand_logo_path.is_file():
            logo='data:image/png;base64,'+base64.b64encode(self.brand_logo_path.read_bytes()).decode('ascii')
        else:
            raise WorkspaceError('Core integration ontbreekt voor: merklogo.')
        return {'version': 'BelgoBase web', 'brand_logo':logo,
                'sectors': sectors, 'legal_forms': legal,
                'statuses': [{'value':'','label':'Alle statussen'}, {'value':'AC','label':'Actief'}, {'value':'ST','label':'Stopgezet'}],
                'saved': [], 'workspace': {'lists': [], 'searches': []},
                'result_column_options': self.metadata.get('column_groups', {}).get('result_columns', [])}

    def search(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('search', payload, auth); filters = self._normal(payload.get('filters', {}))
        query = payload.get('query', '')
        if not isinstance(query, str) or len(query) > 500: raise WorkspaceError('De zoektekst is ongeldig.')
        if query.strip():
            filters['ondernemingsnummer' if query.strip().replace(' ', '').replace('.', '').replace('-', '').removeprefix('BE').isdigit() else 'naam'] = query.strip()
        page = payload.get('page', 1)
        if type(page) is not int or page < 1: raise WorkspaceError('Ongeldig paginanummer.')
        request = {'filters': filters, 'offset': (page - 1) * 50, 'page_size': 50}
        try:
            if filters.get('xbrl_metric_filters'):
                # 30b reads XBRL criteria at the request top level, while the
                # browser keeps normal filters nested.  Preserve both shapes.
                request['xbrl_metric_filters'] = filters['xbrl_metric_filters']
                total, _ = self.main.run_xbrl_count(request)
                rows, _off, size, _next = self.main.run_xbrl_results(request)
            else:
                clean, _regions, preferences, region_postcodes = self.main.extract_selection(filters, request)
                total, _ = self.main.run_count(self.main.normalize_filters(clean), region_postcodes)
                # run_results consumes the selection metadata itself, including
                # regional postcode expansion and preference ordering.
                rows, _off, size, _next = self.main.run_results(request)
        except Exception as exc: raise WorkspaceError('Zoekresultaten konden niet worden geladen.') from exc
        return {'rows': [self._row(row) for row in rows], 'total': int(total), 'page': page, 'page_size': size, 'filters': filters}

    def _company_data(self, number: Any) -> dict[str, Any]:
        try: ondnr, company, _ = self.main.lookup_company(number)
        except Exception as exc: raise WorkspaceError(str(exc)) from exc
        record = dict(company); row = self._row(record)
        metric_specs = [('revenue','Omzet','omzet','€'),('profit','Resultaat','winst_verlies','€'),('fte','Personeel','personeel_vte','VTE'),('ebitda','EBITDA','ebitda','€'),('equity','Eigen vermogen','eigen_vermogen','€')]
        def fact_year(key: str): return record.get('ebitda_jaar' if key=='ebitda' else 'financial_jaar' if key in {'financial_omzet','financial_winst_verlies','eigen_vermogen','brutomarge'} else 'jaar')
        def explanation(key: str): return 'Geen bruikbare waarde in de gebruikte bron. Ontbrekend betekent niet nul.' if self._financial_value(record,key) is None else ''
        metrics = [{'key': output, 'label': label, 'value': self._financial_value(record,key), 'unit': unit, 'year': fact_year(key),
                    'note': ('Laatste financiële verrijking; geen historische jaarreeks. ' if key in {'ebitda','eigen_vermogen'} else '') + ' · '.join(str(v) for v in (record.get(key+'_status'),record.get(key+'_methode')) if v), 'explanation':explanation(key)} for output,label,key,unit in metric_specs]
        fields = [{'label': key.replace('_',' ').capitalize(), 'value': str(value), 'negative': False} for key,value in record.items() if key not in {spec[2] for spec in metric_specs}][:30]
        history = {'years': [], 'series': {'revenue': [], 'profit': [], 'fte': [], 'assets': []}, 'label':'Financiële evolutie', 'note':'Geen historische bron beschikbaar.'}
        if hasattr(self.main, 'read_company_history') and getattr(self.main, 'PREMIUM_HISTORY_SOURCE', None):
            try:
                raw = self.main.read_company_history(ondnr, self.main.PREMIUM_HISTORY_SOURCE, lambda: self.main.request_duckdb_connect(self.main.duckdb))
                records = [r for r in (raw.get('records', []) if isinstance(raw, dict) else []) if isinstance(r, dict) and isinstance(r.get('jaar'), int)]
                records.sort(key=lambda r:r['jaar']); years = [r['jaar'] for r in records]
                history = {'years': years, 'series': {'revenue':[self._financial_value(r,'omzet') for r in records], 'profit':[self._financial_value(r,'winst_verlies') for r in records], 'fte':[self._financial_value(r,'personeel_vte') for r in records], 'assets':[self._financial_value(r,'balanstotaal') for r in records]}, 'label':'Financiële evolutie per bronjaar', 'note':'NBB-kerncijfers per bronjaar via BelgoBase. Ontbrekende cijfers blijven leeg.'}
            except Exception: pass
        return {'company': row, 'fields': fields, 'metrics': metrics, 'history': history,
                'financial': [{'label': label,'value':self._financial_value(record,key),'year':fact_year(key),'status':str(record.get(key+'_status') or 'Niet vermeld'),'source':str(record.get(key+'_methode') or 'Financiële verrijking'),'explanation':explanation(key)} for key,label in [('financial_omzet','Financiële omzet'),('financial_winst_verlies','Financieel resultaat'),('ebitda','EBITDA'),('brutomarge','Brutomarge'),('eigen_vermogen','Eigen vermogen')]]}

    def company(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('company', payload, auth); return self._company_data(payload.get('number'))

    def compare_companies(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('compare_companies', payload, auth); numbers = payload.get('numbers')
        if not isinstance(numbers, list) or not 2 <= len(numbers) <= 4: raise WorkspaceError('Selecteer twee tot vier bedrijven.')
        if len({str(value) for value in numbers}) != len(numbers): raise WorkspaceError('Selecteer verschillende bedrijven.')
        return {'companies': [self._company_data(number) for number in numbers], 'retrieved_at': datetime.now(timezone.utc).isoformat()}

    def relaxation_suggestions(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('relaxation_suggestions', payload, auth); filters = self._normal(payload.get('filters', {})); items=[]
        for label, keys in [('Zonder personeelsgrens',('min_personeel_vte','max_personeel_vte')),('Zonder omzetgrens',('min_omzet','max_omzet')),('Zonder rechtsvormbeperking',('juridical_form','juridical_form_exclude'))]:
            if not any(filters.get(k) not in (None,'',[]) for k in keys): continue
            candidate={k:v for k,v in filters.items() if k not in keys}
            try:
                clean, _regions, _preferences, postcodes = self.main.extract_selection(candidate, {'filters':candidate})
                total,_=self.main.run_count(self.main.normalize_filters(clean), postcodes)
            except Exception: continue
            if total: items.append({'label':label,'filters':candidate,'total':int(total)})
        return {'suggestions':items, 'checked':len(items)}

    def ai(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('ai', payload, auth)
        if not hasattr(self.main, 'interpret_premium'): raise WorkspaceError('AI is niet geconfigureerd.')
        context = auth.authorization_context()
        if not context.get('quota_subject_id'):
            raise WorkspaceError('AI-identiteit is niet geconfigureerd.')
        try: return {'proposal': self.main.interpret_premium(payload, context, normalize_callback=self.main.normalize_premium_ai_filters)}
        except Exception as exc: raise WorkspaceError('De AI-zoekvraag kon niet worden verwerkt.') from exc

    def workspace_data(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('workspace_data', payload, auth); section=payload.get('section')
        if section in {'filters','xbrl'}: return {'schema': self._filter_schema(), 'filters': self._normal(payload.get('filters', {})), 'regions': [], 'xbrl_limit':10, 'metric_types':{}}
        if section=='export_columns': return self.export_columns({}, auth)
        if section=='similar': return {'criteria': []}
        if section=='account': return self.account_action({'action':'refresh'},auth)
        raise WorkspaceError('Onbekend onderdeel.')

    def _filter_schema(self) -> dict[str, Any]:
        """Server-derived field list; validation is still normalize_premium_ai_filters."""
        frozen = self.metadata.get('filter_schema')
        if isinstance(frozen, dict) and isinstance(frozen.get('fields'), list) and isinstance(frozen.get('groups'), list):
            return copy.deepcopy(frozen)
        labels = self.metadata.get('filter_labels', {})
        known = list(getattr(self.main, 'FILTER_KEYS', ())) + ['gemeente_nl_match','gemeente_fr_match','regions','preferences','xbrl_metric_filters']
        numeric = set(getattr(self.main, 'FLOAT_KEYS', ())) | set(getattr(self.main, 'INT_KEYS', ()))
        dates = set(getattr(self.main, 'DATE_KEYS', ()))
        fields=[]
        for key in dict.fromkeys(known):
            field_type='number' if key in numeric else 'date' if key in dates else 'boolean' if key=='latest_only' else 'text'
            fields.append({'key':key,'label':labels.get(key,key.replace('_',' ').capitalize()),'group':'geavanceerd','type':field_type,'options':[],'multiple':key in {'regions','juridical_form','juridical_form_exclude'},'hint':''})
        return {'fields':fields,'groups':[{'key':'geavanceerd','label':'Aanvullende filters'}], 'provenance':self.metadata.get('provenance')}

    def filters_apply(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('filters_apply', payload, auth); return {'filters':self._normal(payload.get('filters', {})), 'regions':[]}

    def xbrl_catalog(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('xbrl_catalog', payload, auth)
        request={'search_text':payload.get('query',''),'value_type':payload.get('value_type',''),'offset':payload.get('offset',0),'limit':50,'group':payload.get('group',''),'section':payload.get('section',''),'topic':payload.get('topic',''),'include_needs_review':True}
        try: data=self.main.xbrl_metric_browse(request)
        except Exception as exc: raise WorkspaceError('De boekhoudcatalogus kon niet worden geladen.') from exc
        metrics=[{'key':m.get('xbrl_metric_key'),'label':m.get('human_display_label_nl') or m.get('browse_label_nl') or m.get('xbrl_metric_key'),'value_type':m.get('filter_value_type',''),'code':m.get('xbrl_code',''),'path':[m.get('tree_group_label_nl',''),m.get('tree_section_label_nl',''),m.get('tree_topic_label_nl','')],'company_count':m.get('company_count')} for m in data.get('metrics',[])]
        paths=[m['path'] for m in metrics]
        return {'metrics':metrics,'total':data.get('total',0),'offset':data.get('offset',0),'has_more':data.get('has_more',False),'paths':paths}

    def similar_company(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('similar_company', payload, auth)
        try: number, company, _ = self.main.lookup_company(payload.get('number'))
        except Exception as exc: raise WorkspaceError(str(exc)) from exc
        with self._lock: self._similar[self._tenant(auth)] = dict(company)
        criteria=[]
        for key,label,kind,source,targets,transform,tolerance,allow_negative in _ICP_SPECS:
            value=company.get(source)
            if transform=='nace_prefix': value=str(value or '')[:2]
            elif transform=='nace_exact': value=str(value or '')
            if kind=='number': value=self._financial_value(company,source)
            criteria.append({'key':key,'label':label,'kind':kind,'value':value,
                             'default_selected':(key in {'postcode','nace_prefix'} and bool(value)) or (key=='kbo_status' and str(value or '').upper()=='AC'),
                             'tolerance':tolerance})
        return {'company':{'number':number,'name':str(company.get('naam') or '')},'criteria':criteria}

    def similar_apply(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('similar_apply', payload, auth)
        tenant=self._tenant(auth)
        with self._lock: company=copy.deepcopy(self._similar.get(tenant))
        if not company: raise WorkspaceError('Haal het voorbeeldbedrijf eerst opnieuw op.')
        criteria=payload.get('criteria')
        if not isinstance(criteria,list) or not criteria: raise WorkspaceError('Kies minstens één vergelijkingscriterium.')
        specs={spec[0]:spec for spec in _ICP_SPECS}; updates={}
        for item in criteria:
            if not isinstance(item,dict) or item.get('key') not in specs: raise WorkspaceError('Een vergelijkingscriterium is onbekend.')
            key,label,kind,source,targets,transform,default,allow_negative=specs[item['key']]; mode=item.get('mode','seed')
            value=company.get(source)
            if transform=='nace_prefix': value=str(value or '')[:2]
            elif transform=='nace_exact': value=str(value or '')
            if kind=='number': value=self._financial_value(company,source)
            if mode=='seed':
                if value in (None,''): raise WorkspaceError(label+': geen bruikbare voorbeeldwaarde beschikbaar.')
                if kind=='number':
                    try: pct=float(item.get('tolerance',default)); number=float(value)
                    except (TypeError,ValueError): raise WorkspaceError(label+': tolerantie of voorbeeldwaarde is ongeldig.')
                    if not 0 <= pct <= 500: raise WorkspaceError('De tolerantie moet tussen 0 en 500% liggen.')
                    lo,hi=sorted((number*(1-pct/100),number*(1+pct/100)))
                    if not allow_negative: lo=max(0,lo)
                    updates[targets[0]]=self._format_number(lo); updates[targets[1]]=self._format_number(hi)
                elif kind=='date':
                    try: years=int(item.get('tolerance',default)); date=datetime.fromisoformat(str(value)[:10]).date()
                    except (TypeError,ValueError): raise WorkspaceError(label+': datum of tolerantie is ongeldig.')
                    if not 0 <= years <=100: raise WorkspaceError('Kies een tolerantie van 0 tot 100 gehele jaren.')
                    updates[targets[0]]=date.replace(year=date.year-years).isoformat(); updates[targets[1]]=date.replace(year=date.year+years).isoformat()
                else: updates[targets[0]]=value
            elif mode=='manual':
                if kind in {'number','date'}:
                    low,high=item.get('min'),item.get('max')
                    if low in (None,'') and high in (None,''): raise WorkspaceError(label+': vul minstens één grens in.')
                    updates[targets[0]]=low; updates[targets[1]]=high
                else:
                    manual=item.get('value','')
                    if not isinstance(manual,str) or not manual.strip(): raise WorkspaceError(label+': vul een vergelijkingswaarde in.')
                    updates[targets[0]]=manual.strip()[:2] if transform=='nace_prefix' else manual.strip()
            else: raise WorkspaceError('Kies voorbeeldbedrijf of zelf instellen.')
        current=self._normal(payload.get('filters',{})); current.pop('ondernemingsnummer',None)
        with self._lock:
            for key,(before,applied) in self._similar_applied.get(tenant,{}).items():
                if key not in updates and current.get(key)==applied:
                    if before is None: current.pop(key,None)
                    else: current[key]=before
            tracked={key:(current.get(key),value) for key,value in updates.items()}
            current.update(updates); result=self._normal(current)
            self._similar_applied[tenant]={key:(before,result.get(key)) for key,(before,_value) in tracked.items()}
        return {'filters':result}

    @staticmethod
    def _format_number(value: float) -> str:
        return str(int(value)) if value == int(value) else f'{value:.8f}'.rstrip('0').rstrip('.')

    def export_columns(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('export_columns', payload, auth); columns=self.metadata.get('column_groups',{}).get('result_columns',[]); allowed={c['key'] for c in columns}
        selected=payload.get('columns') or self.metadata.get('column_groups',{}).get('default_selected',[])
        if not isinstance(selected,list) or any(c not in allowed for c in selected): raise WorkspaceError('Kies geldige exportkolommen.')
        return {'columns':columns,'selected':selected}

    def account_action(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('account_action', payload, auth)
        if not callable(self.account_projector):
            raise WorkspaceError('Je accountgegevens zijn tijdelijk niet beschikbaar. Probeer opnieuw.')
        result = self.account_projector(auth, copy.deepcopy(payload))
        if not isinstance(result, Mapping):
            raise WorkspaceError('Je accountgegevens konden niet worden geladen.')
        return dict(result)

    def export(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('export', payload, auth)
        raw_filters = payload.get('filters', {})
        if 'numbers' in payload:
            if not isinstance(payload['numbers'], list) or not payload['numbers']: raise WorkspaceError('Selecteer eerst bedrijven.')
            if len(payload['numbers']) > 1000: raise WorkspaceError('Selecteer maximaal 1000 bedrijven.')
            # The existing server contract permits at most 1000 explicit
            # enterprise numbers.  Tie the row limit to that exact list so a
            # selection is never silently cut to an unrelated default.
            raw_filters={'ondernemingsnummers':payload['numbers'],'max_rows':len(payload['numbers']),'latest_only':True}
        if not isinstance(raw_filters, dict): raise WorkspaceError('De filters moeten een object zijn.')
        ui_to_core={'name':'naam','number':'ondernemingsnummer','city':'gemeente_nl','postcode':'kbo_postcode','nace':'nace_code','status':'kbo_status','legal_form':'juridical_form','revenue':'omzet','profit':'winst_verlies','fte':'personeel_vte','year':'jaar'}
        requested=payload.get('columns', raw_filters.get('selected_output_cols'))
        if requested is None: requested=self.metadata.get('column_groups',{}).get('default_selected',[])
        if not isinstance(requested,list) or not requested: raise WorkspaceError('Kies minstens één exportkolom.')
        try: selected=[ui_to_core.get(value, value) for value in requested]
        except TypeError as exc: raise WorkspaceError('De exportkolommen zijn ongeldig.') from exc
        if any(not isinstance(value,str) or not value for value in selected) or len(set(selected)) != len(selected): raise WorkspaceError('De exportkolommen zijn ongeldig.')
        raw_filters=dict(raw_filters); raw_filters['selected_output_cols']=selected
        filters=self._normal(raw_filters); limit=int(filters.get('max_rows') or 5000); offset=0; all_rows=[]; columns=[]
        try:
            clean, _regions, preferences, postcodes = self.main.extract_selection(filters, {'filters':filters})
            while len(all_rows) < limit:
                page_filters=dict(filters); page_filters['max_rows']=min(1000,limit-len(all_rows))
                # Reuse the canonical writer/query and page through every
                # server page; no client-side data reconstruction occurs.
                if filters.get('xbrl_metric_filters'):
                    xbrl_request = {'filters': page_filters, 'xbrl_metric_filters': filters['xbrl_metric_filters'],
                                    'selected_output_cols': selected, 'max_rows': page_filters['max_rows']}
                    page_columns, rows, _ = self.main.run_xbrl_export(xbrl_request, offset, preferences=preferences)
                else:
                    normal = self.main.normalize_filters(clean)
                    normal['max_rows'] = page_filters['max_rows']
                    normal['selected_output_cols'] = selected
                    page_columns, rows, _ = self.main.run_export(normal, offset, preferences, postcodes)
                columns=page_columns; all_rows.extend(rows); offset += len(rows)
                if len(rows) < page_filters['max_rows']: break
            data=self.main.write_xlsx_bytes(columns, all_rows)
        except Exception as exc: raise WorkspaceError('Excel-export kon niet worden gemaakt.') from exc
        job=uuid.uuid4().hex; path=self.download_root/(job+'.xlsx'); fd,tmp=tempfile.mkstemp(dir=str(self.download_root),suffix='.xlsx')
        try:
            with os.fdopen(fd,'wb') as h: h.write(data); h.flush(); os.fsync(h.fileno())
            os.replace(tmp,path)
        finally:
            if os.path.exists(tmp): os.unlink(tmp)
        with self._lock: self._downloads[job]=(hashlib.sha256((auth.license_id+'\x1f'+auth.user_id).encode()).hexdigest(),path)
        return {'download_reference':job,'rows':len(all_rows),'total':len(all_rows),'message':f'{len(all_rows)} bedrijven opgeslagen.'}

    def resolve_download(self, reference: str, auth: AuthContext) -> Path:
        owner=hashlib.sha256((auth.license_id+'\x1f'+auth.user_id).encode()).hexdigest()
        with self._lock: value=self._downloads.get(reference)
        if value is None or value[0] != owner or not value[1].is_file(): raise WorkspaceError('Download niet beschikbaar.')
        return value[1]

    def ai_usage(self, payload: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
        self._allow('ai_usage', payload, auth); return {'usage':{'mode':'server','configurable':False,'message':'AI-gebruik wordt door BelgoBase beheerd.'}}
