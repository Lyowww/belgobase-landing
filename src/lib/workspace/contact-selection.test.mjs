import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const web=await readFile(new URL('./assets/frozen-ui.html',import.meta.url),'utf8');
const pc1=await readFile('C:/Users/David1/Desktop/1 codes/BelgoBase_CENTRAAL/BelgoBase_Project/PC1_WERKVERSIE/ui.html','utf8').catch(()=>null);
for(const [surface,html] of [['web',web],['PC1',pc1]]){
 if(!html)continue;
 function harness(selection={count:1889},error=null){
  const calls=[],filters={kbo_postcode:'3090',juridical_form_exclude:'TYPE:1',latest_only:true},journey={contextRevision:1,exclusionsReady:true,onlyNew:true},state={query:'',filters,total:1889,rows:['unchanged']};
  const h={calls,journey,state,selection,filters,nf:new Intl.NumberFormat('nl-BE'),esc:String,$:()=>({scrollIntoView(){}}),journeyText:k=>k,
   journeyStart:()=>{state.busy=true;return 1;},journeyEnd:()=>{state.busy=false;},journeyCurrent:r=>r===journey.contextRevision,
   journeyPanel:(...a)=>calls.push(['panel',...a]),ensureJourneyState:async()=>true,journeySelectionContext:()=>selection,currentSearchFilters:()=>filters,
   notice:(...a)=>calls.push(['notice',...a]),renderJourneyContactChoices:()=>calls.push(['choices']),updateJourney:r=>calls.push(['update',r]),
   bridge:async(action,payload)=>{calls.push([action,payload]);if(error)throw error;return {list:{unique_count:1889}};},
   journeyCall:async request=>{calls.push(['journey',request]);return {job:{counts:{total:1889}}};},requestJourneyEstimate:async()=>{calls.push(['estimate']);return true;}
  };
  vm.createContext(h);const a=html.indexOf('async function prepareJourneySelection('),b=html.indexOf('async function openJourneyContacts(',a);vm.runInContext(html.slice(a,b),h);return h;
 }
 test(`${surface}: all 1889 filtered companies prepare one list and one job`,async()=>{
  const h=harness();assert.equal(await h.prepareJourneySelection(true),true);
  const request=h.calls.find(c=>c[0]==='journey_prepare_selection')[1];assert.equal(request.expected_count,1889);assert.equal(request.filters,h.filters);assert.equal('numbers' in request,false);
  assert.equal(h.calls.filter(c=>c[0]==='journey').length,1);assert.equal(h.calls.find(c=>c[0]==='journey')[1].command,'job_create');assert.equal(h.calls.filter(c=>c[0]==='estimate').length,1);
  assert.equal(h.state.total,1889);assert.deepEqual(h.state.rows,['unchanged']);assert.equal(h.state.busy,false);assert.equal(h.calls.some(c=>c[0]==='choices'),false);
 });
 test(`${surface}: preparation timeout unlocks controls and permits retry with same selection`,async()=>{
  const h=harness({count:1889},new Error('timeout'));assert.equal(await h.prepareJourneySelection(true),false);
  assert.equal(h.state.busy,false);assert.equal(h.calls.filter(c=>c[0]==='choices').length,1);assert.equal(h.calls.some(c=>c[0]==='journey'),false);assert.equal(h.state.filters,h.filters);assert.equal(h.state.total,1889);
  h.bridge=async(action,payload)=>{h.calls.push([action,payload]);return {list:{unique_count:1889}};};assert.equal(await h.prepareJourneySelection(true),true);
 });
 test(`${surface}: checked-selection limit and empty selection never leave a spinner`,async()=>{
  for(const selection of [{count:0},{count:1001,numbers:Array(1001).fill('x')},{count:5001}]){
   const h=harness(selection);assert.equal(await h.prepareJourneySelection(true),false);assert.equal(h.calls.some(c=>c[0]==='journey_prepare_selection'),false);assert.equal(h.calls.filter(c=>c[0]==='choices').length,1);assert.equal(h.state.busy,false);
  }
 });
 test(`${surface}: late failure cannot repaint a newer journey`,async()=>{
  const h=harness();h.bridge=async()=>{h.journey.contextRevision=2;throw new Error('old failure');};assert.equal(await h.prepareJourneySelection(true),false);assert.equal(h.calls.some(c=>c[0]==='choices'||c[0]==='notice'),false);
 });
}
