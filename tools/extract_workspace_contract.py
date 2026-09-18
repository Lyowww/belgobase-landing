"""Extract non-secret frozen UI metadata with a content hash for provenance."""
from __future__ import annotations
import ast, hashlib, importlib.util, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = Path(r"C:\Users\David1\Desktop\1 codes\BelgoBase_CENTRAAL\BelgoBase_Project\QA_AUDITS\2026-09-17_consistent_product\build98\candidates\PC1_PREMIUM_20260917_FREEZE98_FINAL3\input")

def literal_assignment(source: str, name: str):
    tree = ast.parse(source)
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in node.targets):
            try: return ast.literal_eval(node.value)
            except ValueError: return None
    return None

def source_literal(frozen: Path, name: str):
    """Find a frozen literal once, without importing its Tk runtime."""
    paths = [frozen / 'premium_ai.py', *(frozen / 'source').glob('*.py')]
    for path in paths:
        value = literal_assignment(path.read_text(encoding='utf-8-sig'), name)
        if value is not None:
            return value
    return None

def frozen_ai_sets(frozen: Path):
    """Load the pure frozen filter contract only; never import Tk/main."""
    sys.path.insert(0, str(frozen))
    try:
        spec = importlib.util.spec_from_file_location('_frozen_workspace_ai', frozen / 'premium_ai.py')
        module = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(module)
        return (set(module.FILTER_FIELDS), set(module.NUMERIC_FIELDS),
                set(module.DATE_FIELDS), set(module.YEAR_FIELDS),
                dict(getattr(module, 'DEFAULT_ENUMS', {})))
    finally:
        sys.path.pop(0)

def frozen_logical_groups(frozen: Path):
    """AST-only mapping used by PremiumWorkspace.schema, with no Tk import."""
    source = next((frozen / 'source').glob('*.py'))
    tree = ast.parse(source.read_text(encoding='utf-8-sig'))
    aliases = {'winst_status': 'winst_verlies_status', 'sector_quick': 'nace_prefix'}
    result = {}
    for node in tree.body:
        if not isinstance(node, ast.Assign) or not any(isinstance(t, ast.Name) and t.id == 'LOGICAL_FILTERS' for t in node.targets):
            continue
        for call in node.value.elts if isinstance(node.value, ast.List) else []:
            if not isinstance(call, ast.Call) or len(call.args) < 3 or not isinstance(call.args[0], ast.Constant): continue
            for name in (item.id for arg in call.args[2:] for item in ast.walk(arg) if isinstance(item, ast.Name) and item.id.endswith('_var')):
                key = aliases.get(name[:-4], name[:-4])
                result.setdefault(key, str(call.args[0].value))
    return result

def main(frozen: Path = DEFAULT) -> None:
    bridge = (frozen / 'bridge.py').read_bytes(); workspace = (frozen / 'premium_workspace.py').read_bytes(); ui = (frozen / 'ui.html').read_bytes()
    ai_source = (frozen / 'premium_ai.py').read_text(encoding='utf-8')
    labels = literal_assignment(ai_source, 'LABELS') or {}
    fields, numeric, dates, years, enums = frozen_ai_sets(frozen)
    logical_groups = frozen_logical_groups(frozen)
    sectors = source_literal(frozen, 'SECTOR_PREFIXES') or {}
    legal = source_literal(frozen, 'LEGAL_FORM_OPTIONS') or []
    # This static fallback mirrors PremiumWorkspace.schema's types.  Groups and
    # choice lists are derived below from the frozen public catalogues; query
    # validation remains the 30b normalizer.
    schema_fields = []
    for key in sorted(set(fields) | {'regions'}):
        typ = 'number' if key in numeric or key in years else 'date' if key in dates else 'boolean' if key == 'latest_only' else 'text'
        options = []
        multiple = key in {'juridical_form', 'juridical_form_exclude', 'regions'}
        if key in {'juridical_form', 'juridical_form_exclude'}:
            options = [{'value': value, 'label': label} for value, label in legal]
        elif key in {'gemeente_nl_match', 'gemeente_fr_match'}:
            typ, options = 'select', [{'value': 'contains', 'label': 'Naam bevat (bestaande zoekwijze)'}, {'value': 'exact', 'label': 'Exacte gemeentenaam'}]
        elif key in enums:
            options = [{'value': str(value), 'label': str(value) or 'Geen beperking'} for value in enums[key]]
            typ = 'select'
        schema_fields.append({'key': key, 'label': 'Gewest' if key == 'regions' else labels.get(key, key.replace('_', ' ')),
                              'group': 'locatie' if key in {'regions','gemeente_nl_match','gemeente_fr_match'} else logical_groups.get(key, 'geavanceerd'),
                              'type': typ, 'options': options, 'multiple': multiple, 'hint': ''})
    methods = sorted(set(re.findall(rb"(?:bridge|action)\('([a-z_]+)'", ui)))
    state = (frozen / 'premium_state.py').read_text(encoding='utf-8')
    result_columns = re.findall(r"\('([^']+)',\s*'([^']+)'\)", state.split('RESULT_COLUMN_OPTIONS', 1)[1].split('DEFAULT_COLUMNS', 1)[0])
    # The frozen desktop obtains the complete XBRL catalogue from this route.
    # Keep the route/pagination contract as metadata; values remain core-owned.
    data = {'provenance': {'baseline': 'PC1_PREMIUM_20260917_FREEZE98_FINAL3',
            'sha256': hashlib.sha256(bridge + workspace + ui).hexdigest()},
            'filter_labels': labels,
            'filter_schema': {'fields': schema_fields,
                              'groups': [{'key':'bedrijf','label':'Bedrijfsgegevens'}, {'key':'locatie','label':'Locatie'}, {'key':'sector','label':'Activiteiten'}, {'key':'jaarrekening','label':'Jaarrekening en datums'}, {'key':'personeel','label':'Personeel'}, {'key':'financieel','label':'Financiële cijfers'}, {'key':'geavanceerd','label':'Aanvullende filters'}],
                              'source': 'frozen premium_workspace.schema type rules; full validation remains core-owned'},
            'catalogs': {'sectors': [{'value': value, 'label': label} for label, value in sectors.items()],
                         'legal_forms': [{'value': value, 'label': label} for value, label in legal]},
            'catalog': {'source': '/xbrl/metrics/browse', 'page_size': 50,
                        'value_types': ['', 'numeric', 'text'],
                        'hierarchy': ['group', 'section', 'topic']},
            'column_groups': {'result_columns': [{'key': key, 'label': label} for key, label in result_columns],
                              'default_selected': ['name', 'city', 'revenue', 'profit', 'fte', 'year']},
            'ui_methods': [m.decode() for m in methods]}
    out = ROOT / 'backend' / 'workspace_assets' / 'workspace_metadata.json'
    out.parent.mkdir(parents=True, exist_ok=True); out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

if __name__ == '__main__': main(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT)
