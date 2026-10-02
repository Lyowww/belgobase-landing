import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("src/lib/workspace/assets/frozen-ui.html", root), "utf8");


function functionSource(name) {
  const markers = [`function ${name}(`, `async function ${name}(`];
  const start = markers.map(marker => html.indexOf(marker)).filter(index => index >= 0).sort((a, b) => a - b)[0];
  assert.notEqual(start, undefined, `function ${name} exists`);
  const parameters = html.indexOf("(", start);
  let parameterDepth = 0;
  let bodyStart = -1;
  for (let index = parameters; index < html.length; index += 1) {
    if (html[index] === "(") parameterDepth += 1;
    else if (html[index] === ")" && --parameterDepth === 0) {
      bodyStart = html.indexOf("{", index);
      break;
    }
  }
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (["'", '"', "`"].includes(char)) { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`unterminated function ${name}`);
}

function loadFunctions(names, globals = {}) {
  const context = vm.createContext({ structuredClone, ...globals });
  vm.runInContext(`${names.map(functionSource).join("\n")}\nglobalThis.result={${names.join(",")}};`, context);
  return context.result;
}

function domFixture() {
  const classList = () => ({ remove() {}, toggle() {}, add() {} });
  const node = () => ({ hidden: false, disabled: false, textContent: "", value: "", classList: classList(), setAttribute() {} });
  const nodes = Object.fromEntries([
    "#tools-view", "#search-view", "#dossier-view", "#search-controls", "#reset",
    "#page-title", "#page-subtitle", "#breadcrumb", "#query",
  ].map(selector => [selector, node()]));
  return { nodes, $: selector => nodes[selector] || node(), $$: () => [] };
}

test("automatic location changes retain unapplied inputs and the appropriate query", () => {
  for (const aiMode of [false, true]) {
    const dom = domFixture();
    dom.nodes["#query"].value = aiMode ? "Zoek nu klanten in heel België" : "Alpha";
    dom.nodes["#ai-mode"] = { checked: aiMode };
    const inputs = [
      { dataset: { filter: "kbo_postcode" }, value: "2150", type: "text", reportValidity: () => true },
      { dataset: { filter: "gemeente_nl" }, value: "Borsbeek", type: "text", reportValidity: () => true },
    ];
    const context = vm.createContext({
      structuredClone, Set, state: { ready: true, busy: false, recording: false, filters: {}, query: "confirmed", selectedRows: {} },
      filterDraft: null, filterDraftQuery: "", filterRevision: 0, filterRefreshPending: false,
      quickCityDirty: true, quickCityKeys: ["gemeente_nl", "gemeente_fr"],
      quickFilterDirty: new Set(["kbo_postcode", "gemeente_nl"]),
      $: dom.$, $$: () => inputs, guidedModeActive: () => false,
      journeyApplyExclusions: filters => structuredClone(filters), regionLabels: () => ({ vlaanderen: "Vlaanderen" }),
      renderChips() {}, controls() {}, scheduleFilterRefresh() {},
    });
    vm.runInContext(["quickFiltersValid", "snapshotFilters", "toggleRegion", "removeFilter"].map(functionSource).join("\n"), context);
    context.toggleRegion("vlaanderen");
    assert.deepEqual(JSON.parse(JSON.stringify(context.filterDraft)), {
      kbo_postcode: "2150", gemeente_nl: "Borsbeek", regions: ["vlaanderen"],
    });
    assert.equal(context.filterDraftQuery, aiMode ? "confirmed" : "Alpha");
    context.filterDraft = null;
    context.state.filters = { kbo_postcode: "2150", regions: ["vlaanderen"] };
    inputs[0].value = "2160";
    inputs[1].value = "Antwerpen";
    context.removeFilter("kbo_postcode");
    assert.deepEqual(JSON.parse(JSON.stringify(context.filterDraft)), {
      gemeente_nl: "Antwerpen", regions: ["vlaanderen"],
    });
    assert.equal(context.filterDraftQuery, aiMode ? "confirmed" : "Alpha");
  }
});

test("website and discovery replies stay in the same advisory conversation", async () => {
  const calls = [];
  const app = { proposal: { status: "ready" } };
  const context = vm.createContext({
    state: app, journey: { mode: "upload" }, guidedStageOverride: null,
    guidedStage: () => "clarify", guidedModeActive: () => true,
    routeJourneyRequest: () => { calls.push("contact-panel"); return true; },
    journeyAdvise: async text => calls.push(text),
    aiSearch: async () => calls.push("filter-search"),
  });
  vm.runInContext(["guidedInputRoute", "looksLikeBusinessIntro", "isExplicitContactRequest", "dispatchComposerText"].map(functionSource).join("\n"), context);
  await context.dispatchComposerText("Hier is mijn website https://voorbeeld.be/contact, help mijn klanten vinden");
  await context.dispatchComposerText("Nee, vooral organisaties met een eigen verkoopteam");
  assert.deepEqual(calls, [
    "Hier is mijn website https://voorbeeld.be/contact, help mijn klanten vinden",
    "Nee, vooral organisaties met een eigen verkoopteam",
  ]);
  assert.equal(app.proposal, null);
  assert.equal(context.guidedInputRoute("results", null, false), "ai");
  assert.equal(context.guidedInputRoute("clarify", null, false), "ai");
  assert.equal(context.looksLikeBusinessIntro("Analyseer voorbeeld.be"), true);
  await context.dispatchComposerText("Contactgegevens aanvullen");
  assert.equal(calls.at(-1), "contact-panel");
  assert.equal(context.isExplicitContactRequest("Wij verkopen contactgegevens aan bedrijven"), false);
  context.guidedModeActive = () => false;
  context.$ = () => ({checked:false});
  context.quickFiltersValid = () => true;
  context.snapshotFilters = () => ({query:"voorbeeld.be"});
  context.search = async () => calls.push("manual-search");
  await context.dispatchComposerText("voorbeeld.be");
  assert.equal(calls.at(-1), "manual-search");
  for (const text of ["Contactgegevens aanvullen", "Compléter les coordonnées", "Complete contact details", "Download contactgegevens", "Zoek telefoonnummer"]) {
    await context.dispatchComposerText(text);
    assert.equal(calls.at(-1), "contact-panel", text);
  }
});

test("advisory sources allow only safe public web links", () => {
  const { safeJourneySources } = loadFunctions(["safeJourneySources"], { URL });
  const sources = safeJourneySources([
    { url: "https://research.example/path", title: "Verified research" },
    { url: "http://public.example", title: "Public source" },
    { url: "javascript:alert(1)", title: "Script" },
    { url: "https://user:secret@private.example", title: "Credentials" },
    { url: "https://research.example/path", title: "Duplicate" },
    { url: "https://example.test/1" }, { url: "https://example.test/2" },
    { url: "https://example.test/3" }, { url: "https://example.test/4" },
    { url: "https://example.test/5" }, { url: "https://example.test/6" },
  ]);

  assert.equal(sources.length, 6);
  assert.deepEqual(JSON.parse(JSON.stringify(sources.slice(0, 2))), [
    { url: "https://research.example/path", title: "Verified research" },
    { url: "http://public.example/", title: "Public source" },
  ]);
  assert.equal(sources.some(source => source.url.includes("secret") || source.url.startsWith("javascript:")), false);
  assert.equal(sources[2].title, "example.test");
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /journeySourcesMarkup\(advice\?\.sources\)/);
});

test("saved assistant turns keep their compact source row in the conversation DOM", () => {
  const { nodes, $, $$ } = domFixture();
  nodes["#ai-conversation"] = { hidden: false, classList: { toggle() {} } };
  nodes["#toggle-conversation"] = { textContent: "", setAttribute() {} };
  nodes["#ai-turns"] = { innerHTML: "", scrollTop: 0, scrollHeight: 42 };
  const state = { conversationCollapsed: false, conversation: [
    { role: "assistant", content: "Onderzoek afgerond", sources: [{ url: "https://research.example", title: "Research" }] },
    { role: "user", content: "Dank je" },
  ] };
  const { renderConversation } = loadFunctions(["renderConversation"], {
    state, $, $$,
    t: (_key, fallback) => fallback,
    esc: value => String(value).replace(/[<>&]/g, ""),
    journeySourcesMarkup: sources => sources?.length ? '<div class="journey-sources">Research</div>' : "",
    renderGuidedFlow() {},
  });

  renderConversation();

  assert.match(nodes["#ai-turns"].innerHTML, /journey-sources/);
  assert.equal((nodes["#ai-turns"].innerHTML.match(/journey-sources/g) || []).length, 1);
  assert.equal(nodes["#ai-turns"].scrollTop, 42);
});

test("route inventory covers the non-AI workspace contract", () => {
  const called = new Set([
    ...html.matchAll(/(?:bridge|action)\(['"]([a-z_]+)['"]/g),
  ].map(match => match[1]));
  for (const route of [
    "bootstrap", "search", "company", "compare_companies", "relaxation_suggestions",
    "workspace_data", "filters_apply", "xbrl_catalog", "similar_company", "similar_apply",
    "export_columns", "workspace_save", "search_history", "operation_status",
    "cancel_operation", "export_results", "export_selection",
  ]) assert.equal(called.has(route) || html.includes(`'${route}'`), true, `${route} is wired from the UI`);
});

test("returning from tools keeps the user's checked companies", () => {
  const { nodes, $, $$ } = domFixture();
  const state = { request: 0, view: "tools", selectedRows: { "0123456789": { number: "0123456789" } } };
  const { navigate } = loadFunctions(["navigate"], {
    state, work: { returnView: "search" }, $, $$, t: (_key, fallback) => fallback,
    renderRows() {}, renderAssistantContext() {},
  });

  navigate("search");

  assert.deepEqual(Object.keys(state.selectedRows), ["0123456789"]);
  assert.equal(state.view, "search");
  assert.equal(nodes["#tools-view"].hidden, true);
});

test("a rejected stored search stages its draft without showing stale checked rows", async () => {
  const { nodes, $, $$ } = domFixture();
  const state = {
    request: 0,
    view: "saved",
    filters: { kbo_status: "ST" }, query: "oud", rows: [{ number: "0123456789" }],
    total: 1, page: 3, searched: true, sort: { key: "name", direction: -1 },
    selectedRows: { "0123456789": { number: "0123456789" } },
    workspace: { searches: [{ id: "stored", query: "Gent", filters: { kbo_status: "AC" } }] },
  };
  let editor;
  const { loadSavedSearch } = loadFunctions(["navigate", "stageSavedSearchDraft", "loadStoredSearch", "loadSavedSearch"], {
    state, $, $$, t: (_key, fallback) => fallback,
    closeDialog() {}, renderRows() {}, renderAssistantContext() {}, renderComposer() {},
    syncFilters() {}, clearTimeout() {}, resetConversation() {},
    filterRevision: 0,
    savedSearchIssue: null, filterDraft: null, filterRefreshPending: false, filterRefreshTimer: null,
    lastSearchError: "De bewaarde selectie bevat een tegenstrijdigheid.",
    search: async () => false,
    openSavedSearchEditor: async (...args) => { editor = args; return true; },
  });

  await loadSavedSearch("stored");

  assert.equal(state.view, "search");
  assert.equal(state.searched, false);
  assert.equal(state.rows.length, 0);
  assert.equal(state.total, 0);
  assert.deepEqual(Object.keys(state.selectedRows), []);
  assert.equal(nodes["#query"].value, "Gent");
  assert.deepEqual(editor, [{ kbo_status: "AC" }, "Gent", "De bewaarde selectie bevat een tegenstrijdigheid."]);
});

test("a rejected history search restores the stored conditions for explicit repair", async () => {
  const { nodes, $, $$ } = domFixture();
  const state = { request: 0, view: "saved", filters: { kbo_status: "ST" }, query: "old", rows: [{ number: "0123456789" }], total: 1, searched: true, selectedRows: { "0123456789": { number: "0123456789" } } };
  let editor;
  const { loadHistory } = loadFunctions(["navigate", "stageSavedSearchDraft", "loadStoredSearch", "loadHistory"], {
    state, $, $$, t: (_key, fallback) => fallback,
    searchHistory: [{ id: "history", query: "Gent", filters: { kbo_status: "AC", min_omzet: 100, juridical_situation: "000", juridical_situation_exclude: "000" } }],
    closeDialog() {}, renderRows() {}, renderAssistantContext() {}, renderComposer() {}, syncFilters() {}, clearTimeout() {}, resetConversation() {},
    filterRevision: 0, savedSearchIssue: null, filterDraft: null, filterRefreshPending: false, filterRefreshTimer: null,
    lastSearchError: "Dezelfde rechtstoestand is opgenomen en uitgesloten.",
    search: async () => false,
    openSavedSearchEditor: async (...args) => { editor = args; return true; },
  });
  await loadHistory("history");
  assert.equal(state.view, "search");assert.equal(state.searched, false);assert.equal(state.total, 0);assert.deepEqual(Object.keys(state.selectedRows), []);
  assert.equal(nodes["#query"].value, "Gent");assert.equal(editor[0].min_omzet, 100);assert.equal(editor[0].kbo_status, "AC");
  assert.equal(editor[0].juridical_situation, "000");assert.equal(editor[0].juridical_situation_exclude, "000");assert.match(editor[2], /opgenomen en uitgesloten/);
});

test("a cancelled stored search never opens a stale repair editor", async () => {
  const state = { busy: false, recording: false, request: 0 };
  let editors = 0;
  const { loadStoredSearch } = loadFunctions(["loadStoredSearch"], {
    state, filterRevision: 0, lastSearchError: "stale", closeDialog() {},
    stageSavedSearchDraft: item => ({ filters: item.filters, query: item.query }),
    search: async () => { await Promise.resolve();state.request++;return false; },
    openSavedSearchEditor: async () => { editors++; },
  });
  assert.equal(await loadStoredSearch({ filters: { kbo_status: "AC" }, query: "Gent" }), false);
  assert.equal(editors, 0);
});

test("relaxation keeps the active query and commits UI changes only after search succeeds", async () => {
  const query = { value: "Acme" };
  const state = { query: "Acme", aiScope: "new", refining: false };
  const searches = [];
  let resets = 0;
  const { applyRelaxation } = loadFunctions(["applyRelaxation"], {
    state,
    filterRevision: 0,
    $: selector => { assert.equal(selector, "#query"); return query; },
    search: async (...args) => { searches.push(args); return searches.length > 1; },
    renderComposer() {}, resetConversation() { resets += 1; },
  });

  assert.equal(await applyRelaxation({ filters: { min_omzet: 1 } }), false);
  assert.equal(query.value, "Acme");
  assert.equal(resets, 0);
  assert.equal(await applyRelaxation({ filters: { min_omzet: 1 }, query: "Acme" }), true);
  assert.equal(searches[1][2], "Acme");
  assert.equal(resets, 1);
  assert.equal(state.aiScope, "refine");
  assert.equal(state.refining, true);
});

test("new conversation resets server context before clearing visible work", async () => {
  for (const fails of [false, true]) {
    const events=[]; const state={busy:false,conversation:[{role:'user',content:'Old company'}]};
    const ctx=vm.createContext({state,journey:{mode:'goal'},guidedStageOverride:null,
      journeyStart:()=>{state.busy=true;return 1;},journeyCurrent:()=>true,journeyEnd:()=>{state.busy=false;},journeyText:()=>'',
      journeyCall:async command=>{events.push(command.command);if(fails)throw new Error('offline');return {profile:{},history:[],last_advice:null};},
      mergeJourneyResult:()=>events.push('merged'),resetConversation:()=>{events.push('cleared');state.conversation=[];},
      renderJourneyAdvice:()=>{},notice:message=>events.push(message),$:()=>({value:'',focus(){}})});
    vm.runInContext(functionSource('startNewConversation'),ctx);
    await ctx.startNewConversation();
    assert.deepEqual(events,fails?['reset_profile','offline']:['reset_profile','merged','cleared']);
    assert.equal(state.conversation.length,fails?1:0);assert.equal(state.busy,false);
  }
});


test("invalid numeric drafts cannot erase an existing bound through another action", async () => {
  const calls = [];
  const context = vm.createContext({
    structuredClone, Set, state: {ready:true,busy:false,recording:false,filters:{min_omzet:100,kbo_postcode:"2150"},selectedRows:{}},
    filterDraft:null,filterDraftQuery:"",filterRevision:0,filterRefreshPending:false,
    $$:()=>[{reportValidity:()=>false}], $:()=>({checked:false,value:"Alpha"}),
    regionLabels:()=>({vlaanderen:"Vlaanderen"}),renderRegionButtons:()=>calls.push("reset-checkbox"),
    guidedModeActive:()=>false,isExplicitContactRequest:()=>false,
    snapshotFilters:()=>{throw Error("Invalid draft must never be snapshotted");},
    search:async()=>calls.push("search"),
  });
  vm.runInContext(["quickFiltersValid","toggleRegion","removeFilter","dispatchComposerText"].map(functionSource).join("\n"),context);
  context.toggleRegion("vlaanderen");
  context.removeFilter("kbo_postcode");
  assert.equal(await context.dispatchComposerText("Alpha"),false);
  assert.equal(context.filterDraft,null);
  assert.deepEqual(JSON.parse(JSON.stringify(context.state.filters)),{min_omzet:100,kbo_postcode:"2150"});
  assert.equal(calls.includes("search"),false);
});
