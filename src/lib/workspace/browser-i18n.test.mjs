import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("./browser-i18n.js", import.meta.url), "utf8");

function load(language = "fr") {
  const listeners = new Map();
  const window = {
    BelgoBaseI18n: { language, apply() {} },
    addEventListener(name, callback) { listeners.set(name, callback); },
  };
  class MutationObserver { observe() {} }
  const document = { documentElement: {}, body: null };
  vm.runInNewContext(source, { window, document, MutationObserver, queueMicrotask: callback => callback(), structuredClone: value => JSON.parse(JSON.stringify(value)), Array, Object, Set, String });
  return window;
}

test("translates only fixed BUILD100 presentation text", () => {
  const i18n = load("fr").BelgoBasePresentationI18n;
  assert.equal(i18n.translate("Omzet"), "Chiffre d’affaires");
  assert.equal(i18n.translate("Bedrijf"), "Entreprise");
  assert.equal(i18n.translate("Kerkstraat BV"), "Kerkstraat BV");
});

test("uses the fixed key catalogue for Excel/result labels", () => {
  const i18n = load("en").BelgoBasePresentationI18n;
  assert.equal(i18n.translate("irrelevant", "fte"), "Staff (FTE)");
  assert.equal(i18n.translate("Forme juridique officielle inconnue"), "Forme juridique officielle inconnue");
});

test("round-trips known presentation text between French, English and Dutch", () => {
  const window = load("fr");
  const i18n = window.BelgoBasePresentationI18n;
  const french = i18n.translate("Omzet");
  window.BelgoBaseI18n.language = "en";
  const english = i18n.translate(french);
  window.BelgoBaseI18n.language = "nl";
  assert.equal(french, "Chiffre d’affaires");
  assert.equal(english, "Revenue");
  assert.equal(i18n.translate(english), "Omzet");
});

test("keeps source provenance in the delivered browser layer", () => {
  assert.match(source, /BUILD100_FINAL_V1 input\/premium_translations\.py/);
  assert.match(source, /source sha256: [a-f0-9]{64}/);
  assert.match(source, /#financial-rows td:first-child/);
  assert.doesNotMatch(source, /MutationObserver/);
});

test("enriches only fixed bootstrap and workspace presentation labels", () => {
  const window = load("fr");
  const bootstrap = window.BelgoBaseWebI18n.enrich("bootstrap", { language: "fr", filter_labels: { revenue: "Omzet" } });
  assert.equal(bootstrap.filter_labels.revenue, "Chiffre d’affaires");
  assert.equal(bootstrap.presentation_dictionary.canonicalNL.Omzet.fr, "Chiffre d’affaires");
  const workspace = window.BelgoBaseWebI18n.enrich("workspace_data", { schema: { fields: [{ key: "revenue", label: "Omzet", note: "Personeel" }, { key: "company_name", label: "NV onbekend" }] }, company: { name: "Personeel BV" }, user_question: "Personeel" });
  assert.equal(workspace.schema.fields[0].label, "Chiffre d’affaires");
  assert.equal(workspace.schema.fields[0].note, "Personnel");
  assert.equal(workspace.schema.fields[1].label, "NV onbekend");
  assert.equal(workspace.company.name, "Personeel BV");
  assert.equal(workspace.user_question, "Personeel");
});
