import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(new URL("./assets/frozen-ui.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1] ?? "";

function functionSource(name) {
  const functionStart = script.indexOf(`function ${name}(`);
  assert.ok(functionStart >= 0, `${name} exists`);
  const start = script.slice(functionStart - 6, functionStart) === "async " ? functionStart - 6 : functionStart;
  const bodyStart = script.indexOf("){", functionStart) + 1;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < script.length; index += 1) {
    const char = script[index];
    if (escaped) { escaped = false; continue; }
    if (quote && char === "\\") { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ""; continue; }
    if (["'", '"', "`"].includes(char)) { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`${name} has no closing brace`);
}

test("startup has no session picker or resume entry and keeps shared account data", async () => {
  assert.doesNotMatch(html, /Kies welke bewaarde gegevens|Versie van dit apparaat gebruiken|id="guided-resume"|owner-migration-resolve/);
  assert.match(html, /id="open-history"/);
  assert.match(html, /id="open-searches"/);
  const calls=[];
  const shared={owner_migration:{journey:{status:"shared"},memory:{status:"shared"}},exclusions:{},history:[]};
  const context=vm.createContext({t:(_key,fallback)=>fallback,journeyRequest:async command=>{calls.push(command);return shared;}});
  vm.runInContext(`${functionSource("useSharedJourneyData")};this.useSharedJourneyData=useSharedJourneyData;`,context);
  assert.equal(await context.useSharedJourneyData(shared),shared);
  assert.equal(calls.length,0,"normal startup has no additional requests");
  const conflict={owner_migration:{journey:{status:"conflict"},memory:{status:"conflict"}}};
  assert.equal(await context.useSharedJourneyData(conflict),shared);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
    {command:"owner_migration_resolve",scope:"journey",choice:"current",confirmed:true},
    {command:"owner_migration_resolve",scope:"memory",choice:"current",confirmed:true},
  ]);
});

test("failed owner preparation never replaces shared data or retries a paid command", async()=>{
  const calls=[];
  const context=vm.createContext({t:(_key,fallback)=>fallback,journeyRequest:async command=>{calls.push(command);throw new Error("unavailable");}});
  vm.runInContext(`${functionSource("useSharedJourneyData")};this.useSharedJourneyData=useSharedJourneyData;`,context);
  await assert.rejects(context.useSharedJourneyData({owner_migration:{journey:{status:"conflict"}}}),/unavailable/);
  assert.equal(calls.length,1);
  assert.equal(calls[0].choice,"current");
});

test("workspace refresh keeps the active query, filters and results", async () => {
  const oldWorkspace = { searches: [], lists: [{ id: "old", companies: [] }], active_list_id: "old", result_columns: ["name"] };
  const state = {
    ready: true,
    view: "search",
    request: 0,
    workspaceRevision: 4,
    workspace: oldWorkspace,
    saved: [],
    query: "bakker",
    filters: { regions: ["vlaanderen"] },
    rows: [{ number: "1", name: "Fixture" }],
    total: 1,
    searched: true,
  };
  const nextWorkspace = { searches: [{ id: "search-1", name: "Bakkers" }], lists: [{ id: "new", companies: [] }], active_list_id: "new", result_columns: ["name"] };
  const renders = [];
  const context = vm.createContext({
    state,
    bridge: async (method, argument) => {
      assert.equal(method, "workspace_load");
      assert.equal(Object.keys(argument).length, 0);
      return { workspace: nextWorkspace, workspace_revision: 5 };
    },
    acceptWorkspace: (workspace, revision) => { state.workspace = workspace; state.workspaceRevision = revision; state.saved = workspace.lists[0].companies; },
    renderRows: () => renders.push(true),
    showWorkspaceMigrationNotice: () => {},
    notice: () => {},
    t: (_key, fallback) => fallback,
    Array,
    filterRevision: 0,
    filterDraft: null,
    quickCityDirty: false,
    quickFilterDirty: new Set(),
    document: { activeElement: null },
    $: () => ({ open: false }),
  });
  vm.runInContext(`let workspaceRefreshPromise=null;${functionSource("activeList")};${functionSource("workspaceFocusRefreshAllowed")};${functionSource("refreshWorkspace")};this.refreshWorkspace=refreshWorkspace;`, context);
  assert.equal(await context.refreshWorkspace(), true);
  assert.equal(state.workspace, nextWorkspace);
  assert.equal(state.query, "bakker");
  assert.deepEqual(state.filters, { regions: ["vlaanderen"] });
  assert.deepEqual(state.rows, [{ number: "1", name: "Fixture" }]);
  assert.equal(state.total, 1);
  assert.equal(state.searched, true);
  assert.equal(renders.length, 1);
  assert.equal(state.workspaceRevision, 5);
});

test("workspace routes refresh before opening shared saved data and parse epoch history", () => {
  assert.match(script, /dataset\.view==='saved'\)await refreshWorkspace/);
  assert.match(script, /#save-search'\)\.onclick=async\(\)=>\{await refreshWorkspace\(\{reportError:true\}\);saveSearchDialog\(\);\}/);
  assert.match(script, /#open-searches'\)\.onclick=async\(\)=>\{await refreshWorkspace/);
  assert.match(script, /window\.addEventListener\('focus',[\s\S]*workspaceFocusRefreshAllowed/);
  assert.match(script, /dialog\.sharedWorkspace/);
  assert.doesNotMatch(script, /Bewaard in je lokale BelgoBase-werkruimte/);

  const context = vm.createContext({ locale: "nl-BE" });
  vm.runInContext(`${functionSource("historyTimestamp")};this.historyTimestamp=historyTimestamp;`, context);
  assert.match(context.historyTimestamp(1_798_761_600), /2027|2026/);
  assert.notEqual(context.historyTimestamp("2026-10-01T12:00:00Z"), "");
});
