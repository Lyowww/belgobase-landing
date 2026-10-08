import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(process.env.BB_AUDIT_UI_SOURCE || new URL("../src/lib/workspace/assets/frozen-ui.html", import.meta.url), "utf8");
function functionSource(name) {
  const start = [`function ${name}(`, `async function ${name}(`].map(x=>html.indexOf(x)).filter(x=>x>=0).sort((a,b)=>a-b)[0];
  assert.notEqual(start, undefined, `${name} exists`); const open=html.indexOf("{",html.indexOf("(",start)); let depth=0,quote="",esc=false;
  for(let i=open;i<html.length;i++){const c=html[i];if(quote){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===quote)quote="";continue;}if(["'",'"','`'].includes(c)){quote=c;continue;}if(c==="{")depth++;if(c==="}"&&--depth===0)return html.slice(start,i+1);}throw Error(`unterminated ${name}`);
}
function contextWith(names, globals){const c=vm.createContext({structuredClone, ...globals});vm.runInContext(`${names.map(functionSource).join("\n")}\nglobalThis.result={${names.join(",")}};`,c);return c.result;}
function dom(){const nodes={"#query":{value:""},"#ai-mode":{checked:false},".results":{classList:{add(){}}},"#result-caption":{textContent:""}};return {nodes,$:s=>nodes[s]||{value:""},$$:()=>[]};}

test("cancelled history restore keeps A,B,C,D and confirmed D", async()=>{
 const query={value:"D"}; const state={busy:false,recording:false,query:"D",page:4,rows:[{number:"D"}],sort:{key:"year",direction:1},request:10};
 const history={entries:[{query:"A",filters:{},page:1,sort:{key:"name",direction:1}},{query:"B",filters:{},page:2,sort:{key:"name",direction:1}},{query:"C",filters:{},page:3,sort:{key:"name",direction:-1}},{query:"D",filters:{},page:4,sort:{key:"year",direction:1}}],index:3};
 let resolve; const pending=new Promise(r=>resolve=r); const c=vm.createContext({structuredClone,state,selectionHistory:history,filterRevision:0,$:s=>query,search:async()=>pending,resetConversation(){throw Error("cancelled must not reset")},renderRows(){throw Error("cancelled must not render")},refreshSelectionNavigation(){}});
 vm.runInContext(`${functionSource("selectionSnapshot")}\n${functionSource("moveSelection")};globalThis.run=moveSelection;`,c);
 const task=c.run(-1); state.request+=1; resolve(false); await task;
 assert.equal(history.index,3); assert.deepEqual(history.entries.map(x=>x.query),["A","B","C","D"]); assert.equal(state.query,"D"); assert.equal(query.value,"D");
});

test("successful pending restore commits exactly C and retains page/sort", async()=>{
 const query={value:"D"}; const state={busy:false,recording:false,query:"D",page:4,rows:[{number:"D"}],sort:{key:"year",direction:1},request:10}; const history={entries:[{query:"A",filters:{},page:1,sort:{key:"name",direction:1}},{query:"B",filters:{},page:2,sort:{key:"name",direction:1}},{query:"C",filters:{},page:3,sort:{key:"name",direction:-1}},{query:"D",filters:{},page:4,sort:{key:"year",direction:1}}],index:3};
 const c=vm.createContext({structuredClone,state,selectionHistory:history,filterRevision:0,$:s=>query,search:async()=>{state.query="C";state.page=3;return true;},resetConversation(){},renderRows(){},refreshSelectionNavigation(){}}); vm.runInContext(`${functionSource("selectionSnapshot")}\n${functionSource("moveSelection")};globalThis.run=moveSelection;`,c); await c.run(-1); assert.equal(history.index,2); assert.equal(query.value,"C"); assert.equal(state.sort.direction,-1); assert.deepEqual(history.entries.map(x=>x.query),["A","B","C","D"]);
});

test("actual toggleRegion and removeFilter preserve selected IDs before search success",()=>{
 const d=dom(); const state={ready:true,busy:false,recording:false,filters:{kbo_postcode:"2000",regions:["vlaanderen"]},query:"bevestigd",selectedRows:{A:{number:"A"},B:{number:"B"}},quickFilterDirty:new Set(),quickCityDirty:new Set()}; const inputs=[{dataset:{filter:"kbo_postcode"},value:"2000",type:"text",reportValidity:()=>true}]; const c=vm.createContext({structuredClone,Set,state,filterDraft:null,filterDraftQuery:"",filterRevision:0,filterRefreshPending:false,filterRefreshTimer:null,quickCityDirty:new Set(),quickCityKeys:[],quickFilterDirty:new Set(),quickCityDirtySet:new Set(),filterDirty:new Set(),$:d.$,$$:()=>inputs,guidedModeActive:()=>false,journeyApplyExclusions:x=>structuredClone(x),regionLabels:()=>({vlaanderen:"Vlaanderen"}),renderChips(){},controls(){},scheduleFilterRefresh(){}}); vm.runInContext(["quickFiltersValid","snapshotFilters","toggleRegion","removeFilter"].map(functionSource).join("\n"),c); c.toggleRegion("wallonie"); assert.deepEqual(Object.keys(state.selectedRows),["A","B"]); c.filterDraft=null; c.removeFilter("kbo_postcode"); assert.deepEqual(Object.keys(state.selectedRows),["A","B"]);
});




