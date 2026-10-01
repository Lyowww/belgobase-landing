import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(new URL("./assets/frozen-ui.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1] ?? "";

function functionSource(name) {
  const start = script.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const bodyStart = script.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}" && --depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`${name} has no closing brace`);
}

test("workspace keeps the primary search and voice controls", () => {
  assert.equal((html.match(/id="search-form"/g) || []).length, 1);
  assert.equal((html.match(/id="search-button"/g) || []).length, 1);
  assert.equal((html.match(/id="voice-start"/g) || []).length, 1);
  assert.match(script, /function operationToken\(\)[\s\S]*?randomUUID/);
  assert.doesNotThrow(() => new Function(script));
});

test("secondary customer actions live in one compact menu with their existing routes", () => {
  const menuStart = html.indexOf('<details class="journey-menu" id="journey-menu">');
  const menuEnd = html.indexOf("</details>", menuStart);
  const menu = html.slice(menuStart, menuEnd);
  assert.ok(menuStart >= 0 && menuEnd > menuStart);
  for (const id of ["journey-goal", "journey-upload", "journey-contacts"]) {
    assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
    assert.match(menu, new RegExp(`id="${id}"[^>]+role="menuitem"`));
  }
  assert.match(script, /#journey-goal'\)\.onclick=\(\)=>\{closeJourneyMenu\(\);openJourneyGoal\(\);\}/);
  assert.match(script, /#journey-upload'\)\.onclick=\(\)=>\{closeJourneyMenu\(\);journeySetContext\('upload'\);renderJourneyList\(\);\}/);
  assert.match(script, /#journey-contacts'\)\.onclick=\(\)=>\{closeJourneyMenu\(\);openJourneyContacts\(\);\}/);
  assert.match(html, /\.journey-menu \.journey-actions\{display:grid;[\s\S]*?position:absolute/);
  assert.match(html, /body\.guided-mode \.journey-menu\{display:none!important\}/);
});

test("the three region checkboxes are inside Filters and stay three columns wide", () => {
  const panelStart = html.indexOf('<div class="filterpanel" id="filter-panel"');
  const panelEnd = html.indexOf('<div class="ai-panel"', panelStart);
  const panel = html.slice(panelStart, panelEnd);
  assert.ok(panelStart >= 0 && panelEnd > panelStart);
  for (const region of ["vlaanderen", "wallonie", "brussel"]) {
    assert.match(panel, new RegExp(`<input type="checkbox" data-region="${region}">`));
  }
  assert.equal((html.match(/data-region="/g) || []).length, 3);
  assert.match(html, /\.region-quick\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(script, /\$\$\('input\[data-region\]'\)/);
  assert.match(script, /#region-quick'\)\.onchange=[\s\S]*?toggleRegion\(input\.dataset\.region\)/);

  const inputs = ["vlaanderen", "wallonie", "brussel"].map(region => ({
    dataset: { region }, checked: false, disabled: false,
  }));
  const context = vm.createContext({
    filterDraft: null,
    state: { filters: { regions: ["vlaanderen", "brussel"] }, ready: true, recording: false, busy: false },
    operationKind: null,
    $$: selector => (assert.equal(selector, "input[data-region]"), inputs),
  });
  vm.runInContext(`${functionSource("renderRegionButtons")};renderRegionButtons();`, context);
  assert.deepEqual(inputs.map(input => input.checked), [true, false, true]);

  const changes = [];
  const regionControl = {};
  const eventWire = script.match(/\$\('#region-quick'\)\.onchange=e=>\{[^\n]*?\};/)?.[0];
  assert.ok(eventWire);
  vm.runInNewContext(eventWire, {
    $: selector => (assert.equal(selector, "#region-quick"), regionControl),
    toggleRegion: region => changes.push(region),
  });
  regionControl.onchange({ target: { closest: () => inputs[1] } });
  assert.deepEqual(changes, ["wallonie"]);
});
