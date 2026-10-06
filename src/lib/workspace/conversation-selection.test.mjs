import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const web=await readFile(new URL('./assets/frozen-ui.html',import.meta.url),'utf8');
const pc1=await readFile('C:/Users/David1/Desktop/1 codes/BelgoBase_CENTRAAL/BelgoBase_Project/PC1_WERKVERSIE/ui.html','utf8').catch(()=>null);
for(const [surface,html] of [['web',web],['PC1',pc1]]){
 if(!html)continue;
 function harness(proposal={status:'ready',filters:{nace_prefix:'56'}}){
  const calls=[],journey={contextRevision:1,mode:'goal',exclusionsReady:true},state={view:'search',request:0,busy:false,filters:{old:true},rows:[{number:'old'}],total:3};
  const context={journey,state,calls,operationKind:null,guidedStageOverride:null,lastSearchError:'server error',
   journeyCurrent:revision=>revision===journey.contextRevision,
   structuredClone,$:()=>({hidden:false}),t:(key,fallback)=>fallback,journeyText:key=>key,renderJourneyAdvice(){},renderConversation(){},
   beginOperation(){state.busy=true;return ++state.request;},endOperation(){state.busy=false;},
   ensureJourneyState:async()=>true,journeyApplyExclusions:filters=>({...filters,ondernemingsnummers_exclude:['excluded']}),
   navigate:view=>{state.view=view;state.request++;},acceptWalletSnapshot:wallet=>calls.push(['wallet',wallet]),
   bridge:async(action,request)=>{calls.push([action,request]);return {proposal,wallet:{balance:10}};},
   search:async(page,filters,query,options)=>{assert.equal(state.busy,false);assert.equal(options.isCurrent(),true);assert.equal(options.recordHistory,false);assert.equal(options.selectionMode,'preserve');calls.push(['search',filters,query]);state.filters=filters;state.rows=[{number:'real'}];state.total=1;return true;}
  };
  vm.createContext(context);
  const start=html.indexOf('async function searchAdviceSelection('),end=html.indexOf("window.addEventListener('pagehide'",start);
  vm.runInContext(html.slice(start,end),context);return context;
 }
 test(`${surface}: first reply and refinement execute real search without an apply click`,async()=>{
  const h=harness();await h.searchAdviceSelection({search_brief:'Frituren in BelgiÃ«'},1);
  assert.equal(h.journey.autoSelection.status,'ready');assert.equal(h.journey.mode,'goal');
  assert.equal(h.state.rows[0].number,'real');assert.equal(h.state.conversationCollapsed,false);
  const request=h.calls.find(([kind])=>kind==='ai')[1];assert.equal(request.text,'Frituren in BelgiÃ«');assert.equal(request.fresh_session,true);assert.deepEqual(Array.from(request.conversation),[]);
  h.bridge=async(action,request)=>{h.calls.push([action,request]);return {proposal:{status:'ready',filters:{nace_prefix:'56',gemeente_nl:'Antwerpen'}}};};
  await h.searchAdviceSelection({search_brief:'Frituren in Antwerpen'},1);
  assert.equal(h.state.filters.gemeente_nl,'Antwerpen');assert.equal(h.calls.filter(([kind])=>kind==='search').length,2);
 });
 test(`${surface}: saved view cannot masquerade as fresh search results`,async()=>{const h=harness();h.state.view='saved';await h.searchAdviceSelection({search_brief:'Frituren'},1);assert.equal(h.state.view,'search');assert.equal(h.state.rows[0].number,'real');});
 test(`${surface}: retrying failed database lookup reuses compiled filters`,async()=>{const h=harness();h.search=async()=>false;await h.searchAdviceSelection({search_brief:'Frituren'},1);const calls=h.calls.filter(([kind])=>kind==='ai').length;h.search=async()=>true;await h.searchAdviceSelection({search_brief:'Frituren'},1);assert.equal(h.calls.filter(([kind])=>kind==='ai').length,calls);assert.equal(h.journey.autoSelection.status,'ready');});
 test(`${surface}: greeting or missing brief never searches the entire database`,async()=>{
  const h=harness();assert.equal(await h.searchAdviceSelection({search_brief:''},1),false);assert.equal(h.calls.length,0);
 });
 test(`${surface}: ambiguous, empty and export proposals never execute`,async()=>{
  for(const p of [{status:'clarify',question:'Welke sector?'},{status:'ready',filters:{latest_only:true,max_rows:5000}},{status:'ready',action:'export_selection',filters:{nace_prefix:'56'},export_proposal:{}}]){
   const h=harness(p);await h.searchAdviceSelection({search_brief:'Een doelgroep'},1);assert.equal(h.journey.autoSelection.status,'error');assert.equal(h.calls.some(([kind])=>kind==='search'),false);
  }
 });
 test(`${surface}: API failure preserves advice and offers retry without old results`,async()=>{
  const h=harness();h.bridge=async()=>{throw new Error('Geen verbinding');};await h.searchAdviceSelection({search_brief:'Frituren'},1);
  assert.equal(h.journey.autoSelection.status,'error');assert.equal(h.journey.autoSelection.error,'Geen verbinding');assert.equal(h.state.rows[0].number,'old');assert.equal(h.state.busy,false);
 });
 test(`${surface}: stale compiler response cannot search or replace a newer conversation`,async()=>{
  const h=harness();h.bridge=async()=>{h.journey.contextRevision=2;return {proposal:{status:'ready',filters:{nace_prefix:'56'}}};};
  assert.equal(await h.searchAdviceSelection({search_brief:'Frituren'},1),false);assert.equal(h.calls.some(([kind])=>kind==='search'),false);
 });
 test(`${surface}: search error and zero matches remain distinguishable`,async()=>{
  const h=harness();h.search=async()=>false;await h.searchAdviceSelection({search_brief:'Frituren'},1);assert.equal(h.journey.autoSelection.status,'error');
  h.search=async()=>{h.state.rows=[];h.state.total=0;return true;};await h.searchAdviceSelection({search_brief:'Frituren'},1);assert.equal(h.journey.autoSelection.status,'ready');assert.equal(h.state.total,0);
 });
 test(`${surface}: result visibility is tied to the current successful advice selection`,()=>{
  assert.match(html,/toggle\('guided-live-selection',journey.mode==='goal'&&journey.autoSelection\?\.status==='ready'\)/);
  assert.match(html,/guided-stage-clarify\.guided-live-selection \.results\{display:block!important\}/);
  assert.match(html,/if\(answered&&journeyCurrent\(revision\)&&advice\?\.search_brief\)await searchAdviceSelection\(advice,revision\)/);
  assert.match(html,/revision===filterRevision&&isCurrent\(\)/);
 });
}

test('automatic selection labels exist in NL FR EN',async()=>{
 const catalog=await readFile(new URL('./assets/premium_i18n.js',import.meta.url),'utf8');
 const marker=catalog.indexOf('"conversation.selectionLoading"');assert.ok(marker>=0);
 const labels=catalog.slice(marker, catalog.indexOf('const locales=',marker));
 for(const key of ['selectionLoading','selectionRetry','liveSelection','selectionFilters','selectionUnclear','selectionFailed']){
  const found=labels.match(new RegExp('"conversation\\.'+key+'":\\s*(\\{[^}]+(?:\\}[^}]+)?\\})'));
  assert.ok(labels.includes('"conversation.'+key+'"'));
 }
 assert.match(labels,/Finding companies that match/);assert.match(labels,/Filtres utilisés/);
});
