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

test("current and device migration choices use the explicit recoverable contract", async () => {
  assert.match(html, /Gedeelde versie behouden/);
  assert.match(html, /Versie van dit apparaat gebruiken/);
  assert.match(html, /De vorige gedeelde versie wordt eerst gearchiveerd/);
  assert.match(html, /De apparaatversie blijft herstelbaar/);
  assert.match(script, /active&&\(choice==='legacy'\|\|currentMissing\)/);
  assert.match(script, /owner_migration_resolve/);

  const calls = [];
  const context = vm.createContext({
    state: { busy: false },
    journey: { data: { last_advice: null } },
    busy: () => {},
    journeyMigrationText: key => key,
    journeyCall: async command => { calls.push(command); return { owner_migration: { journey: { status: "shared" }, memory: { status: "shared" } } }; },
    mergeJourneyResult: () => {},
    renderJourneyMigrationConflict: () => false,
    clearJourneyMigrationPresentation: () => {},
    renderJourneyAdvice: () => {},
    notice: () => {},
    journeyMigrationConflicts: () => [],
  });
  vm.runInContext(`${functionSource("resolveJourneyOwnerMigration")};this.resolveJourneyOwnerMigration=resolveJourneyOwnerMigration;`, context);
  await context.resolveJourneyOwnerMigration("journey", "current");
  await context.resolveJourneyOwnerMigration("memory", "legacy");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { command: "owner_migration_resolve", scope: "journey", choice: "current", confirmed: true },
    { command: "owner_migration_resolve", scope: "memory", choice: "legacy", confirmed: true },
  ]);
});

test("workspace refresh keeps the active query, filters and results", async () => {
  const oldWorkspace = { searches: [], lists: [{ id: "old", companies: [] }] };
  const state = {
    ready: true,
    workspace: oldWorkspace,
    saved: [],
    query: "bakker",
    filters: { regions: ["vlaanderen"] },
    rows: [{ number: "1" }],
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
      return { workspace: nextWorkspace };
    },
    acceptWorkspace: workspace => { state.workspace = workspace; state.saved = workspace.lists[0].companies; },
    renderRows: () => renders.push(true),
    showWorkspaceMigrationNotice: () => {},
    notice: () => {},
    t: (_key, fallback) => fallback,
    Array,
  });
  vm.runInContext(`let workspaceRefreshPromise=null;${functionSource("refreshWorkspace")};this.refreshWorkspace=refreshWorkspace;`, context);
  assert.equal(await context.refreshWorkspace(), true);
  assert.equal(state.workspace, nextWorkspace);
  assert.equal(state.query, "bakker");
  assert.deepEqual(state.filters, { regions: ["vlaanderen"] });
  assert.deepEqual(state.rows, [{ number: "1" }]);
  assert.equal(state.total, 1);
  assert.equal(state.searched, true);
  assert.equal(renders.length, 1);
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
