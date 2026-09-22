import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const html=readFileSync(new URL('./assets/frozen-ui.html',import.meta.url),'utf8');
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
