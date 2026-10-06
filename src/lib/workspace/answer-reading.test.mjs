import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const web=await readFile(new URL('./assets/frozen-ui.html',import.meta.url),'utf8');
const pc=await readFile('C:/Users/David1/Desktop/1 codes/BelgoBase_CENTRAAL/BelgoBase_Project/PC1_WERKVERSIE/ui.html','utf8').catch(()=>null);
for(const [name,html] of [['web',web],['PC1',pc]]){
 if(!html)continue;
 const part=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
 function speech(){
  const nodes=new Map(),spoken=[],events={},timers=new Map(),notices=[];let timer=0,cancelled=0;
  const context=vm.createContext({$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},
   state:{conversation:[{role:'user',content:'Mijn vraag'},{role:'assistant',content:'Frituren zijn mogelijke klanten.'}],recording:false,busy:true},
   journey:{data:{last_advice:{assistant_message:'Frituren zijn mogelijke klanten.',question:'Waar lever je?'}}},
   i18n:{language:'nl',locales:{nl:'nl-BE',fr:'fr-BE',en:'en-GB'}},t:(_,text)=>text,
   notice:(...args)=>notices.push(args),clearTimeout:id=>timers.delete(id),setTimeout:fn=>{timers.set(++timer,fn);return timer;},
   window:{SpeechSynthesisUtterance:class {constructor(text){this.text=text;}},addEventListener:(name,fn)=>events[name]=fn,
    speechSynthesis:{getVoices:()=>[{lang:'en-US',localService:true},{lang:'nl-NL',localService:true}],speak:u=>spoken.push(u),cancel:()=>cancelled++}}
  });
  vm.runInContext(part('const assistantReading=','function renderConversation('),context);
  return {context,nodes,spoken,events,timers,notices,get cancelled(){return cancelled;}};
 }
 test(`${name}: play reads current answer and follow-up question even while searching`,()=>{
  const h=speech();assert.equal(h.spoken.length,0);assert.equal(h.context.startAssistantReading(),true);
  assert.equal(h.spoken.map(x=>x.text).join(' '),'Frituren zijn mogelijke klanten. Waar lever je?');
  assert.equal(h.spoken[0].voice.lang,'nl-NL');assert.equal(h.nodes.get('#stop-reading').disabled,false);
  assert.equal(h.context.startAssistantReading(),false);assert.equal(h.spoken.length,1);
  h.spoken[0].onstart();assert.equal(h.timers.size,0);h.spoken[0].onend();assert.equal(h.nodes.get('#stop-reading').hidden,true);
 });
 test(`${name}: newer answer does not interrupt playing text; stop cancels the full queue`,()=>{
  const h=speech();h.context.state.conversation.at(-1).content='Een lange zin over klanten. '.repeat(35);
  h.context.startAssistantReading();assert.ok(h.spoken.length>1);const old=h.spoken.at(-1);
  const snapshot=h.spoken.map(x=>x.text).join(' ');h.context.state.conversation.push({role:'assistant',content:'Nieuw antwoord'});h.context.renderAssistantReading();
  assert.equal(h.cancelled,0);assert.equal(h.spoken.map(x=>x.text).join(' '),snapshot);
  h.context.stopAssistantReading();assert.equal(h.cancelled,1);assert.equal(h.nodes.get('#stop-reading').hidden,true);
  h.context.startAssistantReading();old.onend();old.onerror();assert.equal(h.nodes.get('#stop-reading').hidden,false);assert.equal(h.notices.length,0);
 });
 test(`${name}: unsupported synthesis, engine error and silent start expose recoverable errors`,()=>{
  const unsupported=speech();delete unsupported.context.window.speechSynthesis;assert.equal(unsupported.context.startAssistantReading(),false);assert.equal(unsupported.notices.length,1);
  const h=speech();h.context.startAssistantReading();h.spoken[0].onerror();assert.equal(h.cancelled,1);assert.equal(h.notices.length,1);assert.equal(h.nodes.get('#read-answer').disabled,false);
  h.context.startAssistantReading();[...h.timers.values()][0]();assert.equal(h.notices.length,2);
 });
 test(`${name}: recording cannot start playback; page exit cancels it; no question repeated`,()=>{
  const h=speech();h.context.state.recording=true;assert.equal(h.context.startAssistantReading(),false);
  h.context.state.recording=false;h.context.state.conversation.at(-1).content+=' Waar lever je?';assert.equal(h.context.assistantReadText().match(/Waar lever je/g).length,1);
  h.context.startAssistantReading();h.events.pagehide();assert.equal(h.cancelled,1);
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
