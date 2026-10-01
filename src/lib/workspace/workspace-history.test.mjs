import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("./assets/frozen-ui.html", import.meta.url), "utf8");
const catalog = await readFile(new URL("./assets/premium_i18n.js", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1] ?? "";

function lineFunction(name) {
  const start = script.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const lineEnd = script.indexOf("\n", start);
  const firstLine = script.slice(start, lineEnd);
  if (firstLine.trimEnd().endsWith("}")) return firstLine;
  const end = script.indexOf("\n}", lineEnd);
  assert.ok(end > lineEnd, `${name} has a closing brace`);
  return script.slice(start, end + 2);
}

function translate(_key, fallback, vars = {}) {
  return String(fallback).replace(/\{(\w+)\}/g, (_match, name) => String(vars[name] ?? ""));
}

test("history rows show a compact condition count without flattening stored filters", () => {
  const originalFilters = {
    cities: ["Antwerpen", "Gent", "Brugge"],
    nace_codes: ["62010", "62020", "63110"],
  };
  const epochSeconds = Date.parse("2026-10-01T12:00:00Z") / 1000;
  const searchHistory = [
    { id: "h1", query: "Accountants", filters: structuredClone(originalFilters), total: 42, saved_at: epochSeconds },
    { id: "h2", query: "Bakkers", filters: {}, total: 12, saved_at: "2026-10-01T12:00:00Z" },
    { id: "h3", query: "Bouw", filters: {}, total: 7, searched_at: epochSeconds * 1000 },
  ];
  const timestamps = [];
  let rendered;
  const renderSearchHistory = Function(
    "t", "showDialog", "searchHistory", "esc", "historyTimestamp", "nf",
    `"use strict";${lineFunction("renderSearchHistory")};return renderSearchHistory;`,
  )(
    translate,
    (title, body, footer) => { rendered = { title, body, footer }; },
    searchHistory,
    value => String(value),
    value => { timestamps.push(value); return `date:${value}`; },
    new Intl.NumberFormat("nl-BE"),
  );

  renderSearchHistory();

  assert.match(rendered.body, /Zoekgeschiedenis van je gedeelde account/);
  assert.doesNotMatch(rendered.body, /laatste 50|lokaal in dit account/i);
  assert.match(rendered.body, /Selectie met 2 voorwaarden/);
  assert.doesNotMatch(rendered.body, /Antwerpen|62010/);
  assert.match(rendered.body, /data-history-load="h1"/);
  assert.match(rendered.body, /data-history-delete="h1"/);
  assert.deepEqual(searchHistory[0].filters, originalFilters, "rendering must retain every stored filter value");
  assert.deepEqual(timestamps, [epochSeconds, "2026-10-01T12:00:00Z", epochSeconds * 1000]);
});

test("history timestamps accept ISO text, epoch seconds and epoch milliseconds", () => {
  const historyTimestamp = Function(
    "locale",
    `"use strict";${lineFunction("historyTimestamp")};return historyTimestamp;`,
  )("nl-BE");
  const iso = "2026-10-01T12:00:00Z";
  const milliseconds = Date.parse(iso);
  const seconds = milliseconds / 1000;
  const values = [historyTimestamp(iso), historyTimestamp(seconds), historyTimestamp(milliseconds)];
  assert.ok(values[0]);
  assert.equal(new Set(values).size, 1);
});

test("opening any workspace dialog resets its scrolling body to the top", () => {
  const content = { innerHTML: "", scrollTop: 700, querySelector: () => null };
  const dialog = { open: true, classList: { remove() {} } };
  const nodes = {
    "#workspace-dialog": dialog,
    "#dialog-title": { textContent: "" },
    "#dialog-content": content,
    "#dialog-footer": { innerHTML: "" },
  };
  const showDialog = Function(
    "$", "document", "requestAnimationFrame",
    `"use strict";let dialogReturnFocus=null;${lineFunction("showDialog")};return showDialog;`,
  )(selector => nodes[selector] ?? null, { activeElement: null }, callback => callback());

  showDialog("Geschiedenis", "inhoud");

  assert.equal(content.scrollTop, 0);
  assert.equal(content.innerHTML, "inhoud");
});

test("history account copy is translated without local or fixed-limit claims", () => {
  const entry = catalog.match(/'history\.copy':\{[^}]+\}/)?.[0] ?? "";
  assert.match(entry, /gedeelde account/);
  assert.match(entry, /compte partagé/);
  assert.match(entry, /shared account/);
  assert.doesNotMatch(entry, /laatste 50|50 derni|last 50|lokaal|locales/i);
});
