import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const assets = new URL('../src/lib/workspace/assets/', import.meta.url);
const html = await readFile(new URL('frozen-ui.html', assets), 'utf8');
const i18nSource = await readFile(new URL('premium_i18n.js', assets), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const tree = ts.createSourceFile('actual-ui.js', scripts.sort((a,b)=>b.length-a.length)[0], ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function completeFunction(name) {
  let found;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) found=node; if (!found) ts.forEachChild(node,visit); }
  visit(tree); assert.ok(found, name); return found.getText(tree);
}
const labels = {'TYPE:1':'1 — Eenmanszaak / natuurlijke persoon', 'TYPE:2':'2 — Rechtspersoon (alle rechtsvormen)', '610':'610 — BV — Besloten Vennootschap'};
const expected = {
  nl: [labels['TYPE:1'], labels['TYPE:2']],
  fr: ['1 — Entreprise individuelle / personne physique', '2 — Personne morale (toutes formes juridiques)'],
  en: ['1 — Sole trader / natural person', '2 — Legal entity (all legal forms)']
};
function customerContext() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {value:'',textContent:'',options:[],dataset:{},hidden:true,appendChild(option){this.options.push(option);}});
    return elements.get(id);
  };
  const document = {documentElement:{},createElement:()=>({dataset:{},textContent:'',value:''}),querySelectorAll:selector=>selector.includes('#f-legal')?element('#f-legal').options:[],addEventListener(){}};
  const window = {dispatchEvent(){}};
  const state = {ready:false,view:'search',filters:{juridical_form:'TYPE:1',juridical_form_exclude:'TYPE:2'},selectedRows:{own:'keep'},query:'own',enumLabels:{},filterLabels:{}};
  const ctx = vm.createContext({window,document,CustomEvent:class{},Intl,console});
  vm.runInContext(i18nSource,ctx);
  Object.assign(ctx,{i18n:window.BelgoBaseI18n,presentationDictionary:{},$:element,$$:selector=>selector==='[data-filter]'?[element('#f-legal')]:[],state,work:{section:null},filterDraft:null,assistantUi:{},journey:{},filterValueLabels:{},filterNames:{juridical_form:'Rechtsvorm',juridical_form_exclude:'Rechtsvorm uitsluiten'},preferenceLabels:{},number:Number.isFinite,multilineFilterKey:()=>false,configureQuickCity(){},refreshQuickSectorOptions(){},refreshQuickMultipleLabels(){},renderChips(){},renderAssistantContext(){},renderComposer(){},renderConversation(){},t:(...args)=>window.BelgoBaseI18n.t(...args)});
  vm.runInContext(['canonicalPresentation','present','options','optionLabel','fieldOptionLabel','filterDirectionalLabel','filterLabel','refreshLanguage'].map(completeFunction).join('\n'),ctx);
  element('#f-legal').dataset.filter='juridical_form'; element('#f-legal').tagName='SELECT';
  return {ctx, element, state};
}
test('language cycles translate synthetic include/exclude options without changing criteria, query, selected IDs or source labels',()=>{
  const {ctx,element,state}=customerContext();
  ctx.options('#f-legal',Object.entries(labels).map(([value,label])=>({value,label})));
  const before=JSON.stringify(state);
  for(const language of ['nl','fr','en','nl']) {
    ctx.refreshLanguage(language,{persist:false});
    for(const [index,key] of ['TYPE:1','TYPE:2'].entries()) {
      const wanted=expected[language][index];
      assert.equal(element('#f-legal').options.find(o=>o.value===key).textContent,wanted);
      assert.equal(ctx.optionLabel('#f-legal',key),wanted);
      for(const field of ['juridical_form','juridical_form_exclude']) assert.equal(ctx.fieldOptionLabel({key:field},{value:key,label:labels[key]}),wanted);
    }
    assert.equal(JSON.stringify(state),before);
    assert.equal(ctx.optionLabel('#f-legal','610'),labels['610']);
    assert.equal(ctx.present('SOURCE: eigen bronlabel'),'SOURCE: eigen bronlabel');
  }
});
test('legal catalogue loaded after French language restoration presents French options immediately',()=>{
  const {ctx,element,state}=customerContext();const before=JSON.stringify(state);
  ctx.refreshLanguage('fr',{persist:false});
  ctx.options('#f-legal',Object.entries(labels).map(([value,label])=>({value,label})));
  assert.deepEqual(['TYPE:1','TYPE:2'].map(key=>element('#f-legal').options.find(o=>o.value===key).textContent),expected.fr);
  assert.equal(JSON.stringify(state),before);
});
