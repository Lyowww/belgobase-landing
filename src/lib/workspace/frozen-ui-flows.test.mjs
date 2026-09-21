import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(new URL("./assets/frozen-ui.html", import.meta.url), "utf8");

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
  const open = bodyStart;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = open; index < html.length; index += 1) {
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

test("history reader deduplicates, caps at 50 and renders epoch seconds", () => {
  const { normalizeSearchHistory, searchHistoryDate } = loadFunctions(
    ["normalizeSearchHistory", "searchHistoryDate"],
    { locale: "nl-BE" },
  );
  const rows = [
    { id: "new", query: "zelfde", filters: { status: "AC" }, saved_at: 1_788_220_800 },
    { id: "old", query: "zelfde", filters: { status: "AC" }, saved_at: 1 },
    ...Array.from({ length: 55 }, (_, index) => ({ id: String(index), query: `q${index}`, filters: {} })),
  ];
  const normalized = normalizeSearchHistory(rows);
  assert.equal(normalized.length, 50);
  assert.equal(normalized[0].id, "new");
  assert.equal(normalized.some(item => item.id === "old"), false);
  assert.match(searchHistoryDate(rows[0]), /2026/);
  assert.equal(searchHistoryDate({}), "—");
});

test("voice transcript is appended to an existing typed draft", () => {
  const { mergeVoiceText } = loadFunctions(["mergeVoiceText"]);
  assert.equal(mergeVoiceText("bouwbedrijven", "in Gent"), "bouwbedrijven in Gent");
  assert.equal(mergeVoiceText("bouwbedrijven", ""), "bouwbedrijven");
  assert.equal(mergeVoiceText("", "in Gent"), "in Gent");
  assert.equal(mergeVoiceText("bouwbedrijven", "bouwbedrijven in Gent"), "bouwbedrijven in Gent");
  assert.match(functionSource("acceptVoice"), /mergeVoiceText\(voice\.draft/);
});

test("confirmed AI export applies the newly selected row limit", () => {
  const { exportContextWithLimit } = loadFunctions(["exportContextWithLimit"]);
  const original = { filters: { kbo_status: "AC", max_rows: 5000 }, query: "bouw" };
  const updated = exportContextWithLimit(original, 7);
  assert.equal(updated.filters.max_rows, 7);
  assert.equal(updated.filters.kbo_status, "AC");
  assert.equal(original.filters.max_rows, 5000);
  assert.match(functionSource("confirmProposalExport"), /exportContextWithLimit\(original/);
});

test("failed filter and history transitions keep the previous visible state", async () => {
  const apply = functionSource("applyWorkspaceFilters");
  assert.match(apply, /const applied=await search/);
  assert.doesNotMatch(apply, /state\.filters\s*=/);
  assert.match(functionSource("moveSelection"), /state\.sort=previousSort/);
  assert.match(functionSource("moveSelection"), /\$\('#query'\)\.value=previousInput/);
  assert.match(functionSource("loadSavedSearch"), /else\{\$\('#query'\)\.value=previousInput/);
  assert.match(functionSource("loadHistory"), /else\{\$\('#query'\)\.value=previousInput/);

  const query = { value: "oude zoektekst" };
  const state = {
    busy: false,
    recording: false,
    query: "oude zoektekst",
    filters: { kbo_status: "AC", regions: ["vlaanderen"] },
    rows: [{ number: "0123456789", name: "Bestaand bedrijf" }],
    sort: { key: "name", direction: -1 },
    workspace: {
      searches: [{ id: "saved", query: "nieuwe bewaarde zoektekst", filters: { kbo_status: "ST" } }],
    },
  };
  const selectionHistory = {
    entries: [
      { query: "oude zoektekst", filters: structuredClone(state.filters), sort: structuredClone(state.sort), page: 1 },
      { query: "andere geschiedenisselectie", filters: { regions: ["wallonie"] }, sort: { key: "number", direction: 1 }, page: 2 },
    ],
    index: 0,
  };
  const searchHistory = [
    { id: "history", query: "nieuwe geschiedeniszoektekst", filters: { kbo_status: "JU" } },
  ];
  const searchCalls = [];
  const { applyWorkspaceFilters, loadSavedSearch, loadHistory, moveSelection } = loadFunctions(
    ["applyWorkspaceFilters", "loadSavedSearch", "loadHistory", "moveSelection"],
    {
      state,
      work: { filters: { kbo_status: "ST" } },
      selectionHistory,
      searchHistory,
      $: selector => {
        assert.equal(selector, "#query");
        return query;
      },
      $$: selector => selector === "#tools-content input" ? [{ reportValidity: () => true }] : [],
      action: async () => ({ filters: { kbo_status: "ST" } }),
      search: async (...args) => { searchCalls.push(args); return false; },
      t: (_key, fallback) => fallback,
      closeDialog: () => {},
      navigate: () => {},
      resetConversation: () => { throw new Error("failed transition must not reset the conversation"); },
      renderComposer: () => {},
      renderRows: () => {},
      refreshSelectionNavigation: () => {},
    },
  );
  const expected = JSON.stringify({
    query: state.query,
    filters: state.filters,
    rows: state.rows,
    sort: state.sort,
    navigationIndex: selectionHistory.index,
    visibleQuery: query.value,
  });
  const assertOldState = () => assert.equal(JSON.stringify({
    query: state.query,
    filters: state.filters,
    rows: state.rows,
    sort: state.sort,
    navigationIndex: selectionHistory.index,
    visibleQuery: query.value,
  }), expected);

  await applyWorkspaceFilters({ kbo_status: "ST" });
  assertOldState();
  await loadSavedSearch("saved");
  assertOldState();
  await loadHistory("history");
  assertOldState();
  await moveSelection(1);
  assertOldState();
  assert.equal(searchCalls.length, 4, "each transition reaches the rejected search path");
});

test("a rejected AI proposal search leaves the proposal and visible query unchanged", async () => {
  const nodes = {
    "#ai-panel": { hidden: false },
    "#query": { value: "bouwbedrijven in Gent" },
    "#ai-mode": { checked: false },
  };
  const state = {
    proposal: { status: "ready", filters: { gemeente_nl: "Gent", kbo_status: "AC" } },
    query: "bouwbedrijven in Gent",
    filters: { kbo_status: "AC" },
    rows: [{ number: "0123456789", name: "Bestaand bedrijf" }],
    sort: { key: "name", direction: 1 },
    refining: false,
    aiScope: "new",
    conversationCollapsed: false,
  };
  let renderCount = 0;
  const { applyAiProposal } = loadFunctions(["applyAiProposal"], {
    state,
    $: selector => nodes[selector],
    search: async () => false,
    renderConversation: () => { renderCount += 1; },
    renderComposer: () => { renderCount += 1; },
  });
  const expectedState = JSON.stringify(state);

  await applyAiProposal();

  assert.equal(JSON.stringify(state), expectedState);
  assert.equal(nodes["#query"].value, "bouwbedrijven in Gent");
  assert.equal(nodes["#ai-panel"].hidden, false);
  assert.equal(nodes["#ai-mode"].checked, false);
  assert.equal(renderCount, 0);
});

test("opening Wallet preserves normal search mode and an explicit assistant tab enables AI mode", () => {
  const classList = () => ({ add() {}, remove() {}, toggle() {} });
  const node = () => ({ hidden: false, checked: false, classList: classList(), setAttribute() {}, append() {}, focus() {} });
  const nodes = Object.fromEntries([
    "#search-form", "#search-modes", "#ai-scope", "#voice-info", "#ai-conversation", "#ai-panel",
    "#assistant-tab", "#wallet-tab", "#assistant-dock-body", "#wallet-panel", "#assistant-dock",
    "#assistant-nav", "#ai-mode", "#query", "#assistant-home-slot",
  ].map(selector => [selector, node()]));
  const shell = node();
  const returnFocus = { focusCalls: 0, focus() { this.focusCalls += 1; } };
  let composerRenders = 0;
  const selector = selector => selector === ".shell" ? shell : nodes[selector];
  const loaded = loadFunctions(
    ["setAssistantTab", "openAssistant", "closeAssistant"],
    {
      assistantUi: { open: false, tab: "assistant", returnFocus: null },
      document: { activeElement: returnFocus },
      $: selector,
      assistantNodes: () => ["#search-form", "#search-modes", "#ai-scope", "#voice-info", "#ai-conversation", "#ai-panel"].map(selector),
      work: { wallet: {} },
      renderWallet() {}, loadWallet() {}, renderAssistantContext() {}, renderAssistantCredit() {},
      renderComposer() { composerRenders += 1; },
    },
  );

  loaded.openAssistant("wallet");
  assert.equal(nodes["#ai-mode"].checked, false);
  loaded.closeAssistant();
  assert.equal(nodes["#ai-mode"].checked, false);
  loaded.openAssistant("wallet");
  loaded.setAssistantTab("assistant", true);
  assert.equal(nodes["#ai-mode"].checked, true);
  assert.ok(composerRenders > 0, "explicit assistant selection refreshes the composer controls");
});

test("similar-company seed values format money and FTE without changing their numeric values", () => {
  const target = { innerHTML: "" };
  const criteria = [
    { key: "rest_na_schulden", label: "Rest na schulden", kind: "number", value: 638209.8200000001, tolerance: 50, selected: false, mode: "seed" },
    { key: "personeel", label: "Personeel VTE", kind: "number", value: 12.5, tolerance: 30, selected: false, mode: "seed" },
  ];
  const before = structuredClone(criteria);
  const formatter = new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 2 });
  const { renderSimilarCriteria } = loadFunctions(["renderSimilarCriteria"], {
    $: selector => { assert.equal(selector, "#similar-criteria"); return target; },
    work: { similar: { company: { name: "DEKOMPANIE", number: "0123456789" } }, criteria },
    esc: value => String(value),
    t: (_key, fallback) => fallback,
    filterValueLabels: {},
    number: value => typeof value === "number" && Number.isFinite(value),
    money: value => `€ ${formatter.format(value)}`,
    fmt: value => formatter.format(value),
    display: value => value == null || value === "" ? "—" : String(value),
    controls() {},
  });
  renderSimilarCriteria();
  assert.match(target.innerHTML, /€ 638\.209,82/);
  assert.match(target.innerHTML, /12,5 VTE/);
  assert.deepEqual(criteria, before, "formatting must not change the seed or submitted values");
});

test("annual latest-only filter stays visible and selected exports state exact scope", () => {
  assert.doesNotMatch(functionSource("renderChips"), /latest_only/);
  assert.doesNotMatch(functionSource("renderAiChanges"), /latest_only/);
  assert.match(html, /!\['max_rows','selected_output_cols'\]\.includes\(key\)/);
  assert.match(functionSource("renderExportColumns"), /export\.exactSelectionCount/);
  assert.match(functionSource("renderExportColumns"), /explicitExportCount\(\)/);
});

test("French and English chips translate municipality and enterprise values before concatenation", () => {
  const translations = {
    "Exacte gemeentenaam": "Nom exact de la commune",
    "Naam bevat (bestaande zoekwijze)": "Name contains (existing search)",
    "Natuurlijke persoon": "Natural person",
    "Rechtspersoon": "Legal entity",
    Ja: "Yes",
  };
  const { filterLabel } = loadFunctions(["filterLabel"], {
    state: { filters: {}, activityLabels: {}, enumLabels: {}, filterLabels: {
      gemeente_nl_match: "Sélection de commune",
      type_of_enterprise: "Enterprise type",
      latest_only: "Latest NBB record only",
    } },
    $$: () => [],
    multilineFilterKey: () => false,
    present: value => translations[value] || value,
    t: (_key, fallback) => fallback,
    number: () => false,
    money: value => String(value),
    fmt: value => String(value),
    naceLabel: value => value,
    filterValueLabels: {},
    filterNames: {},
  });
  assert.equal(filterLabel("gemeente_nl_match", "exact"), "Sélection de commune: Nom exact de la commune");
  assert.equal(filterLabel("type_of_enterprise", "1"), "Enterprise type: Natural person");
  assert.equal(filterLabel("latest_only", true), "Latest NBB record only: Yes");
});

test("quick filters preserve untouched arrays and replace only a field the user edits", () => {
  const option = value => ({ value, textContent: value, dataset: {}, remove() {} });
  const control = (tagName, key, values = []) => ({
    tagName,
    type: "text",
    dataset: { filter: key },
    value: "",
    options: values.map(option),
    appendChild(item) { this.options.push(item); },
  });
  const city = control("INPUT", "gemeente_nl");
  const sector = control("SELECT", "nace_prefix", ["62", "63"]);
  const legal = control("SELECT", "juridical_form", ["014", "017"]);
  const controls = [city, sector, legal];
  const state = { filters: {
    gemeente_nl: ["Gent", "Antwerpen"],
    nace_prefix: ["62", "63"],
    juridical_form: ["014", "017"],
  } };
  const quickFilterDirty = new Set();
  const { snapshotFilters, syncFilters } = loadFunctions(
    ["snapshotFilters", "syncFilters"],
    {
      state,
      quickCityDirty: false,
      quickCityKeys: ["gemeente_nl", "gemeente_fr"],
      quickFilterDirty,
      $$: selector => selector === "[data-filter]" ? controls : [],
      configureQuickCity: () => {},
      renderChips: () => {},
      multilineFilterKey: key => key.startsWith("gemeente_"),
      listSeparator: () => "; ",
      normalizeMultilineList: value => String(value),
      document: { createElement: () => option("") },
      t: (_key, fallback, vars = {}) => fallback.replace("{count}", String(vars.count)),
    },
  );

  syncFilters();
  assert.equal(city.value, "Gent; Antwerpen");
  assert.equal(sector.value, "__bb_multiple__");
  assert.equal(legal.value, "__bb_multiple__");
  assert.equal(JSON.stringify(snapshotFilters()), JSON.stringify(state.filters));

  legal.value = "017";
  quickFilterDirty.add("juridical_form");
  const edited = snapshotFilters();
  assert.equal(JSON.stringify(edited.gemeente_nl), JSON.stringify(["Gent", "Antwerpen"]));
  assert.equal(JSON.stringify(edited.nace_prefix), JSON.stringify(["62", "63"]));
  assert.equal(edited.juridical_form, "017");
});

test("catalogue failure replaces loading state with a retry action", async () => {
  const nodes = new Map([
    ["#catalog-query", { value: "omzet" }],
    ["#catalog-type", { value: "numeric" }],
    ["#catalog-list", { innerHTML: "Catalogus laden…" }],
    ["#catalog-range", { textContent: "" }],
    ["#catalog-prev", { disabled: false }],
    ["#catalog-next", { disabled: false }],
  ]);
  const work = {
    catalog: [{ key: "old" }], catalogOffset: 50, catalogTotal: 1, catalogMore: true,
    catalogError: false, catalogGroup: "", catalogSection: "", catalogTopic: "",
  };
  const { loadCatalog } = loadFunctions(["loadCatalog", "renderCatalogRows"], {
    $: selector => nodes.get(selector),
    work,
    state: { busy: false },
    action: async () => null,
    controls: () => {},
    esc: String,
    t: (_key, fallback) => fallback,
    number: value => typeof value === "number" && Number.isFinite(value),
    nf: new Intl.NumberFormat("nl-BE"),
  });

  assert.equal(await loadCatalog(0), false);
  assert.equal(work.catalogError, true);
  assert.equal(work.catalog.length, 0);
  assert.match(nodes.get("#catalog-list").innerHTML, /data-tool="catalog-retry"/);
  assert.doesNotMatch(nodes.get("#catalog-list").innerHTML, /Catalogus laden/);
  assert.match(html, /'catalog-retry':\(\)=>loadCatalog\(work\.catalogOffset\)/);
});

test("assistant context follows the visible company dossier", () => {
  const context = { textContent: "" };
  const dossier = { hidden: false };
  const { renderAssistantContext } = loadFunctions(["renderAssistantContext"], {
    $: selector => selector === "#assistant-context" ? context : dossier,
    state: {
      selectedRows: {}, view: "search", searched: true, total: 42,
      detail: { company: { name: "Auditbedrijf" } },
    },
    t: (_key, fallback, vars = {}) => fallback.replace("{count}", String(vars.count)),
    nf: new Intl.NumberFormat("nl-BE"),
  });

  renderAssistantContext();
  assert.equal(context.textContent, "Bedrijfsfiche · Auditbedrijf");
  assert.match(functionSource("openCompany"), /setTab\('overview'\);renderAssistantContext\(\)/);
});

test("failed saved-list switch rerenders the persisted selector value", async () => {
  const select = { value: "secondary" };
  const state = {
    workspace: { active_list_id: "main", lists: [{ id: "main" }, { id: "secondary" }] },
    selectedRows: { A: { number: "A" } },
  };
  let renders = 0;
  const { switchActiveList } = loadFunctions(["switchActiveList"], {
    state,
    persistWorkspace: async () => false,
    renderRows: () => { renders += 1; select.value = state.workspace.active_list_id; },
  });

  assert.equal(await switchActiveList("secondary"), false);
  assert.equal(state.workspace.active_list_id, "main");
  assert.equal(select.value, "main");
  assert.equal(renders, 1);
  assert.equal(Object.keys(state.selectedRows).length, 1);
});

test("language rerender restores the active dossier tab after rebuilding its chart", () => {
  const calls = [];
  const language = { value: "nl" };
  const dossier = { hidden: false };
  const state = { ready: true, view: "search", detail: { company: {} }, tab: "finance", filters: {} };
  const { refreshLanguage } = loadFunctions(["refreshLanguage"], {
    i18n: { locales: { nl: "nl-BE", fr: "fr-BE", en: "en-GB" }, setLanguage: () => {} },
    locale: "nl-BE",
    nf: new Intl.NumberFormat("nl-BE"),
    compact: new Intl.NumberFormat("nl-BE"),
    state,
    filterDraft: null,
    work: { section: null, wallet: null },
    assistantUi: { tab: "assistant" },
    $: selector => selector === "#language-switch" ? language : dossier,
    $$: () => [],
    configureQuickCity: () => {},
    renderAssistantContext: () => {},
    renderConversation: () => {},
    renderRows: () => {},
    renderDetail: () => { calls.push("render"); },
    setTab: tab => { calls.push(`tab:${tab}`); },
    workspaceTitles: () => ({}),
    renderAssistantCredit: () => {},
    bridge: async () => {},
    notice: () => {},
  });

  refreshLanguage("fr");
  assert.equal(language.value, "fr");
  assert.equal(JSON.stringify(calls), JSON.stringify(["render", "tab:finance"]));
});


test("company activity labels require the record NACE edition, never a guessed current edition", () => {
  const {activityLabel} = loadFunctions(["naceLabel", "activityLabel"], {
    state: {filters:{nace_version:"2025"}, naceLanguageCatalog:{
      "2008":{"12345":{nl:"Historische activiteit"}},
      "2025":{"12345":{nl:"Andere activiteit"}}
    }}, i18n:{language:"nl"}
  });
  assert.equal(activityLabel({nace:"12345",nace_version:"2008"}),"Historische activiteit");
  assert.equal(activityLabel({nace:"12345",activity_label:"Bronlabel"}),"Bronlabel");
  assert.equal(activityLabel({nace:"12345"}),"12345");
});

test("voice cancel releases the UI even while the browser permission prompt is unanswered", async () => {
  const input={value:"",focus(){}};
  const voice={phase:"starting",revision:1,draft:"bestaande tekst",startPromise:new Promise(()=>{})};
  const calls=[];
  const {cancelVoice}=loadFunctions(["cancelVoice"],{voice,$:()=>input,stopVoiceTimer(){},renderVoiceLevel(){},controls(){},notice(){},t:(_key,fallback)=>fallback,bridge:async method=>{calls.push(method);return {ok:true};},endVoice(){voice.phase="idle";}});
  const cancelled=cancelVoice();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,["voice_cancel"]);
  await cancelled;
  assert.equal(voice.phase,"idle");
  assert.equal(input.value,"bestaande tekst");
});
