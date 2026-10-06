import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const web=await readFile(new URL('./assets/frozen-ui.html',import.meta.url),'utf8');
const pc=await readFile('C:/Users/David1/Desktop/1 codes/BelgoBase_CENTRAAL/BelgoBase_Project/PC1_WERKVERSIE/ui.html','utf8').catch(()=>null);
for(const [name,html] of [['web',web],['PC1',pc]]){
 if(!html)continue;
 const part=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
 function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
 function audioHarness(){
  const nodes=new Map(),events={},timers=new Map(),notices=[],calls=[],sources=[],decoded=[],base64Inputs=[];let timer=0,resumeCalls=0,starts=0;
  const resumeGate=deferred(),fetchGate=deferred();let bridgeImpl=()=>fetchGate.promise;
  const audio={state:'suspended',destination:{},resume(){resumeCalls++;this.state='running';return resumeGate.promise;},
   decodeAudioData(bytes){decoded.push([...new Uint8Array(bytes)]);return Promise.resolve({duration:1,bytes:[...new Uint8Array(bytes)]});},
   createBufferSource(){const source={connect(){},disconnect(){},start(){starts++;},stop(){source.stopped=true;},onended:null};sources.push(source);return source;}};
  const context=vm.createContext({$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},
   state:{conversation:[{role:'user',content:'Mijn vraag'},{role:'assistant',content:'Frituren zijn mogelijke klanten.'}],recording:false,busy:true},
   journey:{data:{last_advice:{assistant_message:'Frituren zijn mogelijke klanten.',question:'Waar lever je?'}}},
   i18n:{language:'nl',locales:{nl:'nl-BE',fr:'fr-BE',en:'en-GB'}},t:(_,text)=>text,
   notice:(...args)=>notices.push(args),clearTimeout:id=>timers.delete(id),setTimeout:fn=>{timers.set(++timer,fn);return timer;},
   bridge:async(...args)=>{calls.push(args);return bridgeImpl(...args);},
   atob:value=>{base64Inputs.push(value);return Buffer.from(value,'base64').toString('binary');},
   Buffer,
   window:{AudioContext:class {constructor(){return audio;}},addEventListener:(name,fn)=>events[name]=fn}
  });
  vm.runInContext(part('const assistantReading=','function renderConversation('),context);
  const encoded=bytes=>Buffer.from(bytes).toString('base64');
  return {context,nodes,events,timers,notices,calls,sources,decoded,base64Inputs,audio,fetchGate,resumeGate,encoded,
   get resumeCalls(){return resumeCalls;},get starts(){return starts;},setBridge(fn){bridgeImpl=fn;}};
 }
 const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
 test(`${name}: unlock is synchronous in the click; decode returned base64 bytes before first play`,async()=>{
  const h=audioHarness(),bytes=[0,1,127,128,255],order=[];
  h.audio.resume=()=>{order.push('resume');h.audio.state='running';return h.resumeGate.promise;};
  h.setBridge(()=>{order.push('bridge');return h.fetchGate.promise;});
  assert.equal(h.context.startAssistantReading(),true);assert.deepEqual(order,['resume']);assert.equal(h.resumeCalls,0);
  assert.equal(h.nodes.get('#stop-reading').hidden,false);assert.equal(h.starts,0);
  h.resumeGate.resolve();await flush();assert.deepEqual(order,['resume','bridge']);assert.equal(h.starts,0);
  h.fetchGate.resolve({audio_base64:h.encoded(bytes),mime_type:'audio/wav'});await flush();
  assert.deepEqual(h.base64Inputs,[h.encoded(bytes)]);assert.deepEqual(h.decoded,[bytes]);assert.equal(h.starts,1);
 });
 test(`${name}: play remains available while search is busy and waits for a real click before playback`,async()=>{
  const h=audioHarness();assert.equal(h.context.state.busy,true);assert.equal(h.context.startAssistantReading(),true);
  assert.equal(h.starts,0);h.resumeGate.resolve();await flush();h.fetchGate.resolve({audio_base64:h.encoded([1,2]),mime_type:'audio/mpeg'});await flush();
  assert.equal(h.starts,1);assert.equal(h.nodes.get('#read-answer').hidden,true);assert.equal(h.nodes.get('#stop-reading').hidden,false);
 });
 test(`${name}: stop before fetch resolves prevents playback; replay shares pending audio`,async()=>{
  const h=audioHarness();h.context.startAssistantReading();h.resumeGate.resolve();await flush();assert.equal(h.calls.length,1);
  h.context.stopAssistantReading();assert.equal(h.nodes.get('#stop-reading').hidden,true);
  assert.equal(h.context.startAssistantReading(),true);await flush();assert.equal(h.calls.length,1);assert.equal(h.starts,0);
  h.fetchGate.resolve({audio_base64:h.encoded([9,8,7]),mime_type:'audio/wav'});await flush();
  assert.equal(h.starts,1);assert.equal(h.nodes.get('#stop-reading').hidden,false);
 });
 test(`${name}: timeout and invalid audio restore the play control with a visible error`,async()=>{
  const timeout=audioHarness();timeout.context.startAssistantReading();timeout.resumeGate.resolve();await flush();
  const timer=[...timeout.timers.values()][0];timer();assert.equal(timeout.nodes.get('#stop-reading').hidden,true);assert.equal(timeout.nodes.get('#read-answer').disabled,false);assert.equal(timeout.notices.length,1);
  timeout.fetchGate.resolve({audio_base64:'!',mime_type:'audio/wav'});await flush();assert.equal(timeout.starts,0);
  const invalid=audioHarness();invalid.context.startAssistantReading();invalid.resumeGate.resolve();await flush();
  invalid.fetchGate.resolve({audio_base64:invalid.encoded([1]),mime_type:'text/plain'});await flush();
  assert.equal(invalid.nodes.get('#stop-reading').hidden,true);assert.equal(invalid.notices.length,1);assert.equal(invalid.starts,0);
 });
 test(`${name}: a later assistant reply does not interrupt audio already started`,async()=>{
  const h=audioHarness();h.context.startAssistantReading();h.resumeGate.resolve();await flush();h.fetchGate.resolve({audio_base64:h.encoded([4,5]),mime_type:'audio/mpeg'});await flush();
  const source=h.sources[0];h.context.state.conversation.push({role:'assistant',content:'Nieuw antwoord'});h.context.renderAssistantReading();
  assert.equal(source.stopped,undefined);assert.equal(h.starts,1);assert.equal(h.nodes.get('#stop-reading').hidden,false);assert.equal(h.notices.length,0);
  h.context.stopAssistantReading();assert.equal(source.stopped,true);
 });
 test(`${name}: page deactivation cancels pending playback and clears cached audio`,async()=>{
  const h=audioHarness();h.context.startAssistantReading();h.resumeGate.resolve();await flush();assert.equal(h.calls.length,1);
  h.events.pagehide();h.fetchGate.resolve({audio_base64:h.encoded([6]),mime_type:'audio/wav'});await flush();
  assert.equal(h.starts,0);assert.equal(h.nodes.get('#stop-reading').hidden,true);
 });
 test(`${name}: long answer chunks cover all source text in order`,async()=>{
  const h=audioHarness(),text=('Zin met unieke inhoud. '.repeat(500)).trim();h.context.state.conversation.at(-1).content=text;
  h.setBridge(async(_route,payload)=>({audio_base64:h.encoded([payload.text.length%255]),mime_type:'audio/wav'}));
  h.context.startAssistantReading();h.resumeGate.resolve();await flush();
  let ended=0,guard=0;while(!h.nodes.get('#stop-reading').hidden&&guard++<12){await flush();if(h.sources[ended]?.onended){h.sources[ended].onended();ended++;}}
  await flush();assert.ok(h.calls.length>1);const requested=h.calls.map(args=>args[1].text);
  assert.ok(requested.every(chunk=>chunk.length<=3500));assert.equal(requested.join('').replace(/\s/g,'').length,text.replace(/\s/g,'').length);
  assert.equal(h.sources.length,requested.length);
 });
 test(`${name}: follow-up with no new criteria refreshes previous filters and marks them retained`,async()=>{
  const prior={status:'ready',brief:'Frituren in Antwerpen',filters:{naam:'frituur',gemeente_nl:'Antwerpen'}};
  const calls=[],journey={autoSelection:prior},context=vm.createContext({journey,structuredClone,$:()=>({focus(){}}),
   journeyText:x=>x,journeyStart:()=>1,journeyEnd(){},journeyCurrent:()=>true,appendConversation(){},renderGuidedFlow(){},
   journeyCall:async()=>({advice:{assistant_message:'Dat bekijken we.',search_brief:''}}),updateJourney(){},
   searchAdviceSelection:async(advice,revision,options)=>calls.push({advice,revision,options,previous:journey.autoSelection})});
  vm.runInContext(part('async function journeyAdvise(','async function uploadJourneyFile('),context);
  assert.equal(await context.journeyAdvise('Waarom die bedrijven?'),true);assert.equal(calls.length,1);
  assert.equal(calls[0].advice.search_brief,prior.brief);assert.equal(calls[0].options.retained,true);assert.deepEqual(calls[0].previous.filters,prior.filters);
 });
 test(`${name}: no context never fabricates companies; a real new brief replaces the prior selection`,async()=>{
  let brief='';const calls=[],journey={autoSelection:null},context=vm.createContext({journey,structuredClone,$:()=>({focus(){}}),
   journeyText:x=>x,journeyStart:()=>1,journeyEnd(){},journeyCurrent:()=>true,appendConversation(){},renderGuidedFlow(){},
   journeyCall:async()=>({advice:{search_brief:brief}}),updateJourney(){},searchAdviceSelection:async(advice)=>calls.push(advice.search_brief)});
  vm.runInContext(part('async function journeyAdvise(','async function uploadJourneyFile('),context);
  await context.journeyAdvise('Hallo');assert.equal(calls.length,0);
  journey.autoSelection={status:'ready',brief:'Antwerpen',filters:{gemeente_nl:'Antwerpen'}};brief='Frituren in Mechelen';
  await context.journeyAdvise('Toch Mechelen');assert.deepEqual(calls,['Frituren in Mechelen']);
 });
}

for(const [name,html] of [['web',web],['PC1',pc]]){
 if(!html)continue;
 test(`${name}: reopening displays saved conversation and resumes advice without calling providers`,()=>{
  const advice={assistant_message:'Frituren zijn mogelijke klanten.',search_brief:'Frituren'},seen=[];
  const context=vm.createContext({state:{conversation:[{role:'assistant',content:advice.assistant_message}]},journey:{mode:null,data:{last_advice:advice}},
   guidedModeActive:()=>true,renderJourneyAdvice:value=>seen.push(value),renderConversation:()=>seen.push('conversation')});
  vm.runInContext(html.slice(html.indexOf('function restoreJourneyConversation('),html.indexOf('let booting=false;')),context);
  context.restoreJourneyConversation();assert.equal(context.journey.mode,'goal');assert.deepEqual(seen,[advice,'conversation']);
  seen.length=0;context.guidedModeActive=()=>false;context.restoreJourneyConversation();assert.deepEqual(seen,['conversation']);
  context.state.conversation=[];context.journey.mode=null;context.restoreJourneyConversation();assert.equal(context.journey.mode,null);
  assert.match(html,/setGuidedMode\(\(r.display_tab\|\|storedDisplayTab\(\)\)!=='workspace',\{persist:false\}\);restoreJourneyConversation\(\)/);
 });
}
