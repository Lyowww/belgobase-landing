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

test("a rejected stored search stays in Saved and keeps its checked rows", async () => {
  const { $, $$ } = domFixture();
  const state = {
    request: 0,
    view: "saved",
    selectedRows: { "0123456789": { number: "0123456789" } },
    workspace: { searches: [{ id: "stored", query: "Gent", filters: { kbo_status: "AC" } }] },
  };
  const { loadSavedSearch } = loadFunctions(["navigate", "loadSavedSearch"], {
    state, $, $$, t: (_key, fallback) => fallback,
    closeDialog() {}, renderRows() {}, renderAssistantContext() {}, renderComposer() {},
    search: async () => false,
    resetConversation() { throw new Error("must not reset after a rejected search"); },
  });

  await loadSavedSearch("stored");

  assert.equal(state.view, "saved");
  assert.deepEqual(Object.keys(state.selectedRows), ["0123456789"]);
});

test("a rejected history search stays in Saved and keeps its checked rows", async () => {
  const { $, $$ } = domFixture();
  const state = {
    request: 0,
    view: "saved",
    selectedRows: { "0123456789": { number: "0123456789" } },
  };
  const { loadHistory } = loadFunctions(["navigate", "loadHistory"], {
    state, work: { returnView: "saved" }, $, $$, t: (_key, fallback) => fallback,
    searchHistory: [{ id: "history", query: "Gent", filters: { kbo_status: "AC" } }],
    closeDialog() {}, renderRows() {}, renderAssistantContext() {}, renderComposer() {},
    search: async () => false,
    resetConversation() { throw new Error("must not reset after a rejected search"); },
  });

  await loadHistory("history");

  assert.equal(state.view, "saved");
  assert.deepEqual(Object.keys(state.selectedRows), ["0123456789"]);
});

test("relaxation keeps the active query and commits UI changes only after search succeeds", async () => {
  const query = { value: "Acme" };
  const state = { query: "Acme", aiScope: "new", refining: false };
  const searches = [];
  let resets = 0;
  const { applyRelaxation } = loadFunctions(["applyRelaxation"], {
    state,
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
