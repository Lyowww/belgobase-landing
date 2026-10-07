import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const html=readFileSync(new URL('./assets/frozen-ui.html',import.meta.url),'utf8');
const polish=readFileSync(new URL('./browser-polish.css',import.meta.url),'utf8');
const i18n=readFileSync(new URL('./assets/premium_i18n.js',import.meta.url),'utf8');
function source(name){
 const start=html.indexOf(`function ${name}(`);assert.ok(start>=0,`${name} exists`);
 let begin=html.indexOf('{',html.indexOf(')',start)),depth=0,quote='',escaped=false;
 for(let i=begin;i<html.length;i++){const c=html[i];if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue;}if(['"',"'",'`'].includes(c)){quote=c;continue;}if(c==='{')depth++;if(c==='}'&&!--depth)return html.slice(start,i+1);}
 throw new Error('function not closed '+name);
}
function saveHarness(){
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,textContent:''});return nodes.get(id);};
 const state={filters:{regions:['vlaanderen']},query:'nieuwe tekst',workspace:{lists:[],searches:[{id:'existing',name:'Mijn selectie',query:'oude tekst',filters:{kbo_status:'AC'}}]}};
 const results={saved:null,closed:false,error:'',fail:false};
 const context=vm.createContext({structuredClone,state,$:node,esc:String,t:(_key,fallback)=>fallback,dialogAction:null,showDialog(){},dialogError:message=>results.error=message,closeDialog(){results.closed=true;},notice(){},uniqueId:()=> 'new-id',async persistWorkspace(draft){if(results.fail)return false;results.saved=structuredClone(draft);state.workspace=structuredClone(draft);return true;}});
 vm.runInContext(source('saveSearchDialog')+';saveSearchDialog();',context);return {nodes,node,state,results,context};
}
test('replace saved search retains id and name and commits current filters/query',async()=>{
 const h=saveHarness();h.node('#saved-search-target').value='existing';h.node('#saved-search-target').onchange();
 assert.equal(h.node('#saved-search-name').disabled,true);assert.equal(h.node('#save-search-confirm').textContent,'Vervangen');
 await h.context.dialogAction();assert.equal(h.results.saved.searches.length,1);assert.equal(h.results.saved.searches[0].id,'existing');assert.equal(h.results.saved.searches[0].name,'Mijn selectie');assert.deepEqual(h.results.saved.searches[0].filters,{regions:['vlaanderen']});assert.equal(h.results.saved.searches[0].query,'nieuwe tekst');
});
test('failed replacement retains old saved search and dialog for retry',async()=>{
 const h=saveHarness(),before=structuredClone(h.state.workspace);h.results.fail=true;h.node('#saved-search-target').value='existing';h.node('#saved-search-target').onchange();await h.context.dialogAction();assert.deepEqual(h.state.workspace,before);assert.equal(h.results.closed,false);
});
test('duplicate new name cannot silently replace a saved search',async()=>{
 const h=saveHarness(),before=structuredClone(h.state.workspace);h.node('#saved-search-name').value='MIJN SELECTIE';await h.context.dialogAction();assert.equal(h.results.saved,null);assert.deepEqual(h.state.workspace,before);assert.match(h.results.error,/bestaande zoekopdracht/);
});
test('AI drawer is removed and wallet stays on Account with browser email handoff',()=>{
 assert.doesNotMatch(html,/id="assistant-dock"|id="assistant-nav"|id="wallet-tab"/);
 assert.match(source('renderUsage'),/walletPanel/);
 assert.match(source('refreshWalletContact'),/mailto:david@belgobase\.be/);
 assert.doesNotMatch(html,/bridge\(['"]open_wallet_topup_email/);
});
test('workspace cleanup keeps only actionable copy and places mode and voice controls consistently',()=>{
 assert.doesNotMatch(html,/Belgische bedrijven\. De cijfers erachter\. De kansen ervoor\./);
 assert.doesNotMatch(html,/id="version"|Geen filters ingesteld|Nog geen zoekopdracht uitgevoerd|Volgens het KBO-bedrijfsadres|begin met een naam of filter/);
 assert.match(html,/class="app-mode-tabs side-mode-tabs"[\s\S]*?<nav>/);
 assert.doesNotMatch(html,/<header class="guided-global"|id="conversation-tab"|id="guided-advanced"/);
 assert.match(html,/body\.guided-mode \.top,body\.guided-mode \.side nav\{display:none\}/,'conversation keeps the shared sidebar and hides only workspace navigation');
 assert.match(html,/aria-labelledby="side-conversation-tab"/);
 assert.match(html,/id="ai-mode"[^>]+hidden/);
 const composer=html.indexOf('id="search-form"'),voice=html.indexOf('id="voice-info"'),context=html.indexOf('class="guided-context-actions"');
 assert.ok(composer>=0&&voice>composer&&voice<context,'voice information follows the microphone composer');
 assert.match(polish,/\.side-mode-tabs[\s\S]*?grid-template-columns:\s*1fr 1fr/);
 assert.match(polish,/\.voice-info \{[^}]*margin:[^;}]*auto/);
 assert.match(polish,/\.region-button \{[^}]*border-radius:\s*8px/);
 assert.match(polish,/#journey-close[\s\S]*?color:\s*#b42318/);
 assert.match(polish,/\.chip \{[^}]*border-radius:\s*8px/);
 assert.match(i18n,/"guided\.goalTitle":\{"nl":"Vertel wat je doet","fr":"Parlez-nous de votre activité","en":"Tell us what you do"\}/);
 assert.match(i18n,/"guided\.uploadContext":\{"nl":"Klantenlijst toevoegen","fr":"Ajouter une liste de clients","en":"Add customer list"\}/);
});
test('new assignment clears transient results while preserving explicitly saved work',()=>{
 const nodes=new Map(),node=selector=>{if(!nodes.has(selector))nodes.set(selector,{value:'old',hidden:false,checked:true,disabled:false,classList:{remove(){}},setAttribute(){},focus(){}});return nodes.get(selector);};
 const state={ready:true,recording:false,busy:false,operation:null,filters:{regions:['vlaanderen']},query:'oude opdracht',rows:[{number:'1'}],total:1,page:4,searched:true,detail:{},selectedRows:{1:true},sort:{key:'name',direction:-1},refining:true,aiScope:'refine',aiPending:true,aiDraft:'draft',conversationCollapsed:true,saved:[{number:'saved'}],workspace:{searches:[{id:'saved-search'}],lists:[{id:'saved-list'}]}};
 const work={filters:{kbo_status:'AC'},similar:{},criteria:[{}]},selectionHistory={entries:[{}],index:0};
 const context=vm.createContext({state,work,selectionHistory,$:node,bridge(){throw new Error('no operation should be cancelled');},filterRevision:0,filterRefreshTimer:null,filterDraft:{},filterRefreshPending:true,operationKind:null,operationPoll:null,clearTimeout(){},resetConversation(){},syncFilters(){},busy(){},navigate(){},guidedModeActive:()=>false,document:{scrollingElement:{scrollTop:99}}});
 vm.runInContext(`${source('newSearch')};newSearch();`,context);
 assert.equal(Object.keys(state.filters).length,0);assert.equal(state.rows.length,0);assert.equal(state.total,0);assert.equal(state.searched,false);assert.equal(state.query,'');
 assert.deepEqual(state.saved,[{number:'saved'}]);assert.deepEqual(state.workspace,{searches:[{id:'saved-search'}],lists:[{id:'saved-list'}]});
 assert.equal(node('#ai-mode').checked,false,'workspace mode determines direct-search behavior');
});
test('year result columns render without grouping while ordinary numbers keep locale grouping',()=>{
 const resultColumns={year:{format:'number'},jaar:{format:'number'},financial_jaar:{format:'number'},ebitda_jaar:{format:'number'},ordinary:{format:'number'}};
 const context=vm.createContext({
  resultColumns,
  resultValue:(row,key)=>Object.hasOwn(row,key)?row[key]:row.values?.[key],
  esc:String,display:value=>value??'—',fmt:value=>value==null?'—':new Intl.NumberFormat('nl-BE').format(value),
  money:String,negativeClass:()=>'',initials:String,activityLabel:String,present:String,
  filterValueLabels:{},optionLabel:(_selector,value)=>String(value??'')
 });
 vm.runInContext(source('financialResultCell')+';'+source('companyCell'),context);
 for(const key of ['year','jaar','financial_jaar','ebitda_jaar']){
  assert.equal(context.companyCell({values:{[key]:2025}},key),'2025',key);
  assert.equal(context.companyCell({values:{[key]:null}},key),'—',`${key} missing`);
 }
 assert.equal(context.companyCell({values:{ordinary:2025}},'ordinary'),'<span class="">2.025</span>');
});
