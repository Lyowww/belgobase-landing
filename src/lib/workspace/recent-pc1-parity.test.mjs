import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(new URL("./assets/frozen-ui.html", import.meta.url), "utf8");
const i18n = await readFile(new URL("./assets/premium_i18n.js", import.meta.url), "utf8");

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

function element() {
  return {
    value: "", hidden: false, disabled: false, innerHTML: "", title: "",
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {},
  };
}

test("manual mode keeps a labelled search button and submits empty filters", async () => {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  };
  $("#ai-mode").checked = false;
  const calls = [];
  const context = vm.createContext({
    filterDraft: null, filterRefreshPending: false, filterRefreshTimer: null,
    $, state: { ready: true, busy: false, conversation: [], aiScope: "new" },
    voice: { phase: "idle" }, guidedModeActive: () => false,
    quickFiltersValid: () => true,
    t: (_key, fallback) => fallback, icon: name => `[${name}]`, esc: String,
    renderGuidedFlow() {}, snapshotFilters: () => ({ postcode_include: ["2150"] }),
    search: async (...args) => calls.push(["search", ...args]),
    startVoice: () => calls.push(["voice"]), stopVoice: send => calls.push(["stop", send]),
    dispatchComposerText: async text => calls.push(["text", text]), notice: (...args) => calls.push(["notice", ...args]),
  });
  const submit = html.split("\n").find(line => line.startsWith("$('#search-form').onsubmit="));
  vm.runInContext(`${functionSource("renderComposer")}\n${submit}`, context);
  context.renderComposer();
  assert.match($("#search-button").innerHTML, /Zoeken/);
  assert.equal($("#voice-start").hidden, false, "manual search keeps a separate microphone action");
  await $("#search-form").onsubmit({ preventDefault() {} });
  assert.deepEqual(calls, [["search", 1, { postcode_include: ["2150"] }, ""]]);
});

test("guided empty submit retains the voice route and submit failures are visible", async () => {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  };
  $("#ai-mode").checked = false;
  const calls = [];
  const context = vm.createContext({
    filterDraft: null, filterRefreshPending: false, filterRefreshTimer: null,
    $, state: { ready: true, busy: false, conversation: [], aiScope: "new" },
    voice: { phase: "idle" }, guidedModeActive: () => true,
    t: (_key, fallback) => fallback, icon: name => `[${name}]`, esc: String,
    renderGuidedFlow() {}, snapshotFilters: () => ({}), search: async () => { throw new Error("private detail"); },
    startVoice: () => calls.push(["voice"]), stopVoice() {}, dispatchComposerText() {},
    notice: (...args) => calls.push(["notice", ...args]),
  });
  const submit = html.split("\n").find(line => line.startsWith("$('#search-form').onsubmit="));
  vm.runInContext(`${functionSource("renderComposer")}\n${submit}`, context);
  context.renderComposer();
  assert.equal($("#search-button").innerHTML, "[mic]");
  await $("#search-form").onsubmit({ preventDefault() {} });
  assert.deepEqual(calls, [["voice"]]);

  calls.length = 0;
  context.guidedModeActive = () => false;
  await $("#search-form").onsubmit({ preventDefault() {} });
  assert.deepEqual(calls, [["notice", "Deze actie kon niet worden afgerond. Probeer het opnieuw.", true]]);
});

test("operation identity has a secure fallback and mutates state only after success", () => {
  const source = `${functionSource("operationToken")}\n${functionSource("beginOperation")}`;
  const calls = [];
  const state = { request: 0, operation: null };
  const context = vm.createContext({
    operationKind: null,
    crypto: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) }, state,
    t: (_key, fallback) => fallback, busy: (...args) => calls.push(["busy", ...args]),
    pollOperation: id => calls.push(["poll", id]), Uint8Array,
  });
  vm.runInContext(source, context);
  const ids = new Set();
  for (let index = 0; index < 100; index += 1) {
    context.beginOperation("zoeken");
    assert.match(state.operation, /^ui-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    ids.add(state.operation);
  }
  assert.equal(ids.size, 100);

  const missingState = { request: 0, operation: null };
  const missing = vm.createContext({
    operationKind: null,
    crypto: undefined, state: missingState, t: (_key, fallback) => fallback,
    busy() { throw new Error("must not run"); }, pollOperation() { throw new Error("must not run"); }, Uint8Array,
  });
  vm.runInContext(source, missing);
  assert.throws(() => missing.beginOperation("zoeken"), /Deze actie/);
  assert.deepEqual(missingState, { request: 0, operation: null });
});

test("guided upload, feedback and goal context stay visible until a successful apply", async () => {
  const { guidedStage } = (() => {
    const context = vm.createContext({});
    vm.runInContext(`${functionSource("guidedStage")}\nglobalThis.result={guidedStage};`, context);
    return context.result;
  })();
  assert.equal(guidedStage({ searched: true, proposal: { status: "ready" } }, { mode: "upload" }), "clarify");
  assert.equal(guidedStage({ searched: true, proposal: { status: "ready" } }, { mode: "feedback" }), "clarify");
  assert.equal(guidedStage({ searched: true, proposal: null }, { mode: "goal" }), "clarify");
  assert.equal(guidedStage({ searched: true, proposal: { status: "ready" } }, { mode: "goal" }), "confirm");
  assert.equal(guidedStage({ searched: true, proposal: null }, { mode: null }), "results");

  const nodes = { "#journey-panel": element(), "#ai-panel": element(), "#query": element(), "#ai-mode": element() };
  const state = { busy: false, recording: false, proposal: { status: "ready", filters: { kbo_status: "AC" } }, total: 1, refining: false, aiScope: "new" };
  const journey = { mode: "upload", data: { filename: "context.xlsx" }, contextRevision: 0, estimateRevision: 0, busyContext: null };
  const navigations = [];
  const context = vm.createContext({
    state, journey, guidedStageOverride: "confirm", $: selector => nodes[selector],
    search: async () => true, navigate: view => navigations.push(view), guidedModeActive: () => true,
    appendConversation() {}, t: (_key, fallback) => fallback, nf: new Intl.NumberFormat("nl-BE"), renderComposer() {},
    stopJourneyPoll() {}, busy(value) { state.busy = value; },
  });
  vm.runInContext(`${functionSource("journeySetContext")}\n${functionSource("applyAiProposal")}`, context);
  const preserved = journey.data;
  assert.equal(await context.applyAiProposal(), true);
  assert.deepEqual(navigations, ["search"]);
  assert.equal(journey.mode, null);
  assert.equal(journey.data, preserved);
  assert.equal(nodes["#journey-panel"].hidden, true);
  assert.equal(journey.contextRevision, 1);
});

test("large filter choices are compact, escaped and translated without changing filters", () => {
  const filters = { nace_exact_exclude: ["<unsafe>", "2", "3", "4"] };
  const chips = element();
  const context = vm.createContext({
    state: { filters }, filterDraft: null, renderRegionButtons() {},
    $: selector => { assert.equal(selector, "#chips"); return chips; },
    filterLabel: (_key, value) => `Activiteit uitsluiten: ${Array.isArray(value) ? value.join(", ") : value}`,
    t: (_key, fallback, values = {}) => fallback.replace("{label}", values.label ?? "{label}").replace("{count}", values.count ?? "{count}"),
    nf: new Intl.NumberFormat("nl-BE"),
    esc: value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
    icon: () => "[close]",
  });
  vm.runInContext(functionSource("renderChips"), context);
  context.renderChips();
  assert.match(chips.innerHTML, /4 gekozen/);
  assert.match(chips.innerHTML, /title="Activiteit uitsluiten: &lt;unsafe>/);
  assert.doesNotMatch(chips.innerHTML, /<unsafe>/);
  assert.deepEqual(filters.nace_exact_exclude, ["<unsafe>", "2", "3", "4"]);
  assert.match(html, /\.filterline \.filter-chip-label\{[^}]*text-overflow:ellipsis/);

  const match = i18n.match(/"filter\.choiceCount":(\{[^\n]+\}),/);
  assert.ok(match);
  const translations = JSON.parse(match[1]);
  for (const language of ["nl", "fr", "en"]) assert.equal((translations[language].match(/\{count\}/g) || []).length, 1);
});
