import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(new URL("./assets/frozen-ui.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1] ?? "";
const ids = new Set(Array.from(html.matchAll(/\sid="([^"]+)"/g), match => match[1]));

function node(id = "") {
  const classes = new Set();
  return {
    id,
    tagName: "DIV",
    dataset: {},
    style: {},
    options: [],
    children: [],
    hidden: false,
    disabled: false,
    checked: false,
    open: false,
    value: "",
    textContent: "",
    innerHTML: "",
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle(name, force) {
        const enabled = force === undefined ? !classes.has(name) : Boolean(force);
        enabled ? classes.add(name) : classes.delete(name);
        return enabled;
      },
    },
    addEventListener() {},
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; },
    remove() {},
    removeAttribute(name) { delete this[name]; },
    setAttribute(name, value) { this[name] = String(value); },
    getAttribute(name) { return this[name] ?? null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    focus() {},
    select() {},
    scrollIntoView() {},
    matches() { return false; },
    reportValidity() { return true; },
  };
}

test("the complete web workspace script completes bootstrap with desktop-only markup absent", async () => {
  assert.equal(ids.has("local-excel-open"), false);
  assert.doesNotMatch(script, /localExcel|local-excel/);

  const nodes = new Map(Array.from(ids, id => [id, node(id)]));
  const body = node("body");
  const document = {
    body,
    scrollingElement: node("scrolling-element"),
    activeElement: null,
    querySelector(selector) {
      if (/^#[A-Za-z][\w:-]*$/.test(selector)) return nodes.get(selector.slice(1)) ?? null;
      return null;
    },
    querySelectorAll() { return []; },
    createElement(tagName) { const element = node(); element.tagName = String(tagName).toUpperCase(); return element; },
    addEventListener() {},
  };
  const calls = [];
  const window = {
    document,
    addEventListener() {},
    localStorage: { getItem() { return null; }, setItem() {} },
    pywebview: { api: {
      async bootstrap() {
        calls.push("bootstrap");
        return {
          ok: true,
          language: "nl",
          presentation_dictionary: {},
          result_column_options: [],
          default_result_columns: ["name", "city"],
          desktop_capabilities: [],
          saved: [],
          workspace: {
            searches: [],
            lists: [{ id: "default", name: "Mijn bedrijven", companies: [] }],
            active_list_id: "default",
            result_columns: ["name", "city"],
          },
          filter_labels: {},
          enum_labels: {},
          activity_labels_by_version: {},
          nace_language_catalog: {},
          sectors: [],
          legal_forms: [],
          statuses: [],
          account: { name: "Testaccount" },
          display_tab: "workspace",
        };
      },
      async journey() {
        calls.push("journey");
        return { ok: true, history: [], exclusions: {}, owner_migration: { journey: { status: "shared" }, memory: { status: "shared" } } };
      },
    } },
  };
  const context = {
    window,
    document,
    navigator: {},
    console,
    Intl,
    Set,
    Map,
    WeakMap,
    URL,
    Uint8Array,
    structuredClone,
    performance: { now: () => 1000 },
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
    requestAnimationFrame: callback => callback(),
    setTimeout: () => 1,
    clearTimeout() {},
    CustomEvent: class {},
    HTMLElement: class {},
  };
  context.globalThis = context;

  assert.doesNotThrow(() => vm.runInNewContext(script, context));
  for (let index = 0; index < 5; index += 1) await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.querySelector("#local-excel-open"), null, "absent desktop markup must stay absent in the DOM stub");
  assert.deepEqual(calls, ["bootstrap", "journey"]);
  assert.equal(nodes.get("connection").hidden, true, "a successful bootstrap must leave the connection warning hidden");
  assert.equal(nodes.get("connection").textContent, "");
  assert.equal(nodes.get("search-button").disabled, false, "successful bootstrap must unlock the primary search route");
});
