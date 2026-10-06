import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(new URL("./assets/frozen-ui.html", import.meta.url), "utf8");
const desktopPath = process.env.BELGOBASE_PC1_UI || "C:/Users/David1/Desktop/1 codes/BelgoBase_CENTRAAL/BelgoBase_Project/PC1_WERKVERSIE/ui.html";
const desktop = await readFile(desktopPath, "utf8").catch(error => {
  if (error.code === "ENOENT") return null;
  throw error;
});

function source(name, next, document = html) {
  const marker = new RegExp(`(?:async )?function ${name}\\(`);
  const start = document.search(marker);
  assert.ok(start >= 0, `${name} exists`);
  const end = document.indexOf(next, start + 1);
  assert.ok(end > start, `${name} has its expected following declaration`);
  return document.slice(start, end);
}

function nodes() {
  const elements = new Map();
  return selector => {
    if (!elements.has(selector)) elements.set(selector, { value: "", checked: false, hidden: false, focus() {} });
    return elements.get(selector);
  };
}

test("microphone preserves the chosen workspace AI route", async () => {
  for (const checked of [true, false]) {
    const $ = nodes();
    $("#ai-mode").checked = checked;
    const context = vm.createContext({
      $, state: { ready: true, busy: false }, voice: { phase: "idle", revision: 0 }, assistantReading: {active:false},
      guidedModeActive: () => false, renderVoiceLevel() {}, controls() {},
      bridge: async () => ({ ok: true }), voiceCurrent: () => true,
      scheduleVoicePoll() {}, voiceFailure() { assert.fail("microphone should start"); },
    });
    vm.runInContext(source("startVoice", "async function stopVoice("), context);
    await context.startVoice();
    assert.equal($("#ai-mode").checked, checked, "dictation must preserve how the question will be dispatched");
    assert.equal(context.voice.phase, "recording");
  }
});

test("accepted speech preserves its text and shows dispatch errors exactly once", async () => {
  const $ = nodes(), notices = [], sends = [];
  const voice = { revision: 1, consumed: false, draft: "Mijn vraag", phase: "transcribing" };
  const context = vm.createContext({
    $, voice, voiceCurrent: revision => revision === voice.revision && !voice.consumed,
    endVoice() { voice.phase = "idle"; }, voiceFailure() { assert.fail("accepted speech must not be discarded"); },
    dispatchComposerText: async text => { sends.push(text); $("#query").value = ""; throw new Error("Vraag verwerken mislukt"); },
    loadWallet: async () => {}, notice: (...args) => notices.push(args), t: (_key, fallback) => fallback,
  });
  vm.runInContext(source("acceptVoice", "function scheduleVoicePoll("), context);
  await assert.doesNotReject(context.acceptVoice({ text: "zoek bedrijven" }, 1, true));
  assert.equal($("#query").value, "Mijn vraag zoek bedrijven");
  assert.equal(voice.phase, "idle");
  assert.ok(notices.some(([message, error]) => error === true && typeof message === "string" && message.length > 0), "send failure is visible");
  await context.acceptVoice({ text: "zoek bedrijven" }, 1, true);
  assert.deepEqual(sends, ["Mijn vraag zoek bedrijven"], "a competing stop/poll completion cannot send twice");
});

test("guided advice retains the visible question even when its answer includes it", () => {
  let panel;
  const question = "Welke bedrijven zoek je?";
  const context = vm.createContext({
    journey: { data: {} }, guidedModeActive: () => true,
    journeySourcesMarkup: () => "", journeyProfileMarkup: () => "", journeyText: key => key,
    esc: String, journeyPanel: (title, copy, content) => { panel = { title, copy, content }; },
  });
  vm.runInContext(source("renderJourneyAdvice", "function renderJourneyFeedback("), context);
  context.renderJourneyAdvice({ assistant_message: `Ik help je verder. ${question}`, question });
  assert.equal(panel.copy, question, "clarify CSS hides the longer message, so the caption must retain the question");
});

test("desktop workspace dispatch respects its selected AI mode", { skip: desktop === null ? "PC1 source unavailable; set BELGOBASE_PC1_UI for local parity" : false }, async () => {
  for (const ai of [true, false]) {
    const $ = nodes(), calls = [];
    $("#ai-mode").checked = ai;
    const dispatch = desktop.split(/\r?\n/).find(line => /^\s*async function dispatchComposerText\(/.test(line));
    assert.ok(dispatch, "desktop dispatcher exists");
    const context = vm.createContext({
      $, state: {}, journey: { mode: null }, guidedStageOverride: null,
      guidedModeActive: () => false, guidedStage: () => "results", guidedInputRoute: () => "ai",
      looksLikeBusinessIntro: () => false, isExplicitContactRequest: () => false, routeJourneyRequest: () => false,
      quickFiltersValid: () => true, snapshotFilters: () => ({}),
      journeyAdvise: async () => calls.push("advice"), aiSearch: async () => calls.push("ai"), search: async () => calls.push("search"),
    });
    vm.runInContext(dispatch, context);
    await context.dispatchComposerText("bedrijven in Antwerpen");
    assert.deepEqual(calls, [ai ? "ai" : "search"]);
  }
});


const potatoQuestion = "Aardappelen verkopen. Gigantische veel aardappelen. Ik ben zelf aardappelboer. Help me eigenlijk om ideale klanten te vinden. Aan wie zou ik dat eigenlijk kunnen verkopen, mijn aardappelen?";
test("workspace submit sends dictated advice questions to conversation, not company-name search", async () => {
  for (const document of [html, ...(desktop ? [desktop] : [])]) {
    for (const text of [potatoQuestion, "Je suis agriculteur. Aidez-moi à trouver des clients.", "I am a potato farmer. Help me find ideal customers.", "Hoe kan ik geschikte klanten vinden?"]) {
      const $=nodes(), calls=[];
      $("#query").value=text;
      let guided=false;
      const context=vm.createContext({
        $, state:{ready:true,busy:false}, voice:{phase:"idle"}, filterDraft:null,
        journey:{mode:null},guidedStageOverride:null,
        guidedModeActive:()=>guided,
        setGuidedMode:enabled=>{guided=enabled;$("#ai-mode").checked=enabled;calls.push("conversation");},
        isExplicitContactRequest:()=>false,routeJourneyRequest:()=>false,
        quickFiltersValid:()=>true,snapshotFilters:()=>({kbo_status:"AC"}),
        journeyAdvise:async value=>{calls.push(value);return true;},
        search:async()=>calls.push("company-name-search"),
        notice:()=>assert.fail("submit must not fail"),t:(_key,fallback)=>fallback,
      });
      for(const prefix of ["function looksLikeBusinessIntro(","async function dispatchComposerText(","$('#search-form').onsubmit="]){
        vm.runInContext(document.split(/\r?\n/).find(line=>line.startsWith(prefix)),context);
      }
      await $("#search-form").onsubmit({preventDefault(){}});
      assert.deepEqual(calls,["conversation",text]);
      assert.equal($("#query").value,text,"routing itself must not discard dictation");
    }
  }
});

test("workspace company names and enterprise numbers remain direct searches", async () => {
  for(const document of [html,...(desktop?[desktop]:[])]){
    for(const text of ["NovaVenture","Aardappelhandel Janssens","1006303437","BE 1006.303.437"]){
      const $=nodes(),calls=[];
      const context=vm.createContext({$,state:{},guidedModeActive:()=>false,
        setGuidedMode:()=>assert.fail("ordinary names must not switch to paid AI"),
        isExplicitContactRequest:()=>false,routeJourneyRequest:()=>false,
        quickFiltersValid:()=>true,snapshotFilters:()=>({}),search:async()=>calls.push("search")});
      for(const prefix of ["function looksLikeBusinessIntro(","async function dispatchComposerText("]){vm.runInContext(document.split(/\r?\n/).find(line=>line.startsWith(prefix)),context);}
      await context.dispatchComposerText(text);assert.deepEqual(calls,["search"]);
    }
  }
});
