import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("./browser-i18n.js", import.meta.url), "utf8");

function load(language = "fr", messages = {}) {
  const listeners = new Map();
  const window = {
    BelgoBaseI18n: { language, messages, apply() {} },
    addEventListener(name, callback) { listeners.set(name, callback); },
  };
  class MutationObserver { observe() {} }
  const document = { documentElement: {}, body: null };
  vm.runInNewContext(source, { window, document, MutationObserver, queueMicrotask: callback => callback(), structuredClone: value => JSON.parse(JSON.stringify(value)), Array, Object, Set, String });
  return window;
}

test("uses account-workspace wording for web saves without changing frozen desktop text", () => {
  const messages = { "dialog.localWorkspace": { nl: "Bewaard in je lokale BelgoBase-werkruimte.", fr: "Enregistré dans votre espace de travail BelgoBase local.", en: "Saved in your local BelgoBase workspace." } };
  load("nl", messages);
  assert.equal(messages["dialog.localWorkspace"].nl, "Opgeslagen in je BelgoBase-accountwerkruimte.");
  assert.equal(messages["dialog.localWorkspace"].fr, "Enregistré dans l’espace de travail de votre compte BelgoBase.");
  assert.equal(messages["dialog.localWorkspace"].en, "Saved in your BelgoBase account workspace.");
});

test("company metadata has readable labels without exposing missing-value sentinels", () => {
  const original={fields:[{label:"Straat nl",value:"Kerkstraat"},{label:"Bus",value:"None"},{label:"Naam",value:"None"},{label:"Kbo postcode",value:"2640"}],metrics:[{value:0}]};
  const data=load("nl").BelgoBaseWebI18n.enrich("company",original);
  assert.equal(data.fields[0].label,"Straat (NL)");
  assert.equal(data.fields[1].value,null);
  assert.equal(data.fields[2].value,"None", "company identity must remain untouched");
  assert.equal(data.fields[3].label,"Postcode (KBO)");
  assert.equal(data.metrics[0].value,0);
  assert.equal(original.fields[1].value,"None", "source payload stays intact");
});

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


test("localises saved-row statuses while preserving counters and source payload", () => {
  const source = {
    message: "12 van 40 bedrijven opgeslagen (ingestelde exportlimiet).",
    error: "3 bedrijven opgeslagen.",
    company: { name: "Bedrijven opgeslagen BV" },
  };
  const fr = load("fr").BelgoBaseWebI18n.enrich("workspace_save", source);
  const en = load("en").BelgoBaseWebI18n.enrich("workspace_save", source);
  const nl = load("nl").BelgoBaseWebI18n.enrich("workspace_save", source);
  assert.equal(fr.message, "12 entreprises sur 40 enregistrées (limite d’export configurée).");
  assert.equal(fr.error, "3 entreprises enregistrées.");
  assert.equal(en.message, "12 of 40 companies saved (configured export limit).");
  assert.equal(en.error, "3 companies saved.");
  assert.equal(nl.message, source.message);
  assert.equal(nl.error, source.error);
  assert.equal(fr.company, source.company, "non-status customer data remains untouched");
  assert.deepEqual(source, {
    message: "12 van 40 bedrijven opgeslagen (ingestelde exportlimiet).",
    error: "3 bedrijven opgeslagen.",
    company: { name: "Bedrijven opgeslagen BV" },
  }, "enrich must not mutate the server payload");
});

test("does not translate unrelated dynamic messages", () => {
  const source = { message: "Bedrijven opgeslagen BV vraagt een terugbelverzoek." };
  const result = load("en").BelgoBaseWebI18n.enrich("workspace_save", source);
  assert.equal(result.message, source.message);
});
