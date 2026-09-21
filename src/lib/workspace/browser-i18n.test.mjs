import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("./browser-i18n.js", import.meta.url), "utf8");

function load(language = "fr", messages = {}, domSlots = []) {
  const listeners = new Map();
  const window = {
    BelgoBaseI18n: { language, messages, apply() {} },
    addEventListener(name, callback) { listeners.set(name, callback); },
  };
  class MutationObserver { observe() {} }
  const document = {
    documentElement: {}, body: null,
    querySelectorAll(selector) {
      const selectors = new Set(selector.split(","));
      return domSlots.filter(slot => selectors.has(slot.selector)).flatMap(slot => slot.elements);
    },
  };
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

test("web sign-out wording describes the browser session rather than a device", () => {
  const messages = {
    "account.deactivate": { nl: "Dit apparaat afmelden", fr: "Désenregistrer cet appareil", en: "Unregister this device" },
    "account.deactivatedTitle": { nl: "Dit apparaat is afgemeld.", fr: "Cet appareil est désenregistré.", en: "This device is unregistered." },
  };
  load("en", messages);
  assert.equal(messages["account.deactivate"].nl, "Deze browser afmelden");
  assert.equal(messages["account.deactivate"].fr, "Déconnecter ce navigateur");
  assert.equal(messages["account.deactivate"].en, "Sign out this browser");
  assert.equal(messages["account.deactivatedTitle"].nl, "Deze browser is afgemeld.");
  assert.equal(messages["account.deactivatedTitle"].fr, "Ce navigateur est déconnecté.");
  assert.equal(messages["account.deactivatedTitle"].en, "This browser is signed out.");
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

test("round-trips the rendered dossier status after repeated language switches", () => {
  const optionText = { nodeType: 3, nodeValue: "Actief" };
  const dossierText = { nodeType: 3, nodeValue: "Actief" };
  const window = load("nl", {}, [
    { selector: "#f-status option", elements: [{ childNodes: [optionText] }] },
    { selector: "#dossier-meta > span:last-child", elements: [{ childNodes: [dossierText] }] },
  ]);
  const i18n = window.BelgoBasePresentationI18n;
  const expected = { fr: "Actif", en: "Active", nl: "Actief" };
  for (const language of ["fr", "en", "nl"]) {
    window.BelgoBaseI18n.language = language;
    i18n.apply();
    assert.equal(optionText.nodeValue, expected[language]);
    assert.equal(dossierText.nodeValue, expected[language]);
  }
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
  assert.equal(workspace.schema.fields.find(f=>f.key==="revenue").label, "Chiffre d’affaires");
  assert.equal(workspace.schema.fields.find(f=>f.key==="revenue").note, "Personnel");
  assert.equal(workspace.schema.fields.find(f=>f.key==="company_name").label, "NV onbekend");
  assert.equal(workspace.company.name, "Personeel BV");
  assert.equal(workspace.user_question, "Personeel");
});

const filterMetadata=JSON.parse(await readFile(new URL("../../../backend/workspace_assets/workspace_metadata.json",import.meta.url),"utf8"));
test("every filter keeps its values and distinct option meanings in all languages",()=>{
  const original=structuredClone(filterMetadata.filter_schema);
  for(const language of ["nl","fr","en"]){
    const result=load(language).BelgoBaseWebI18n.enrich("workspace_data",{schema:original});
    assert.equal(result.schema.fields.length,original.fields.length);
    for(const field of result.schema.fields){
      const before=original.fields.find(f=>f.key===field.key);
      assert.deepEqual(field.options.map(o=>o.value),before.options.map(o=>o.value));
      if(field.type==='select'){
        assert.equal(new Set(field.options.map(o=>o.label)).size,field.options.length,field.key+': distinct choices');
        assert.ok(field.options.every(o=>o.label!==field.label),field.key+': choices must not repeat field label');
      }
    }
    assert.equal(result.schema.fields.find(f=>f.key==='min_omzet').group,'financieel');
    assert.equal(result.schema.fields.find(f=>f.key==='kbo_postcode').group,'locatie');
    const staff=result.schema.fields.filter(f=>f.group==='personeel').map(f=>f.key);
    assert.equal(staff.indexOf('max_personeel_vte'),staff.indexOf('min_personeel_vte')+1);
    const choices=result.schema.fields.find(f=>f.key==='ebitda_missing_mode').options;
    assert.equal(choices[1].label,{nl:'Aanwezig',fr:'Disponible',en:'Available'}[language]);
  }
  assert.deepEqual(original,filterMetadata.filter_schema,'source schema untouched');
});
test("option translations cannot replace actual company or financial labels",()=>{
  const result=load('en').BelgoBaseWebI18n.enrich('company',{fields:[{key:'naam',label:'Naam',value:'true'}],metrics:[{key:'profit',label:'Resultaat',value:0}]});
  assert.equal(result.fields[0].label,'Name');assert.equal(result.fields[0].value,'true');
  assert.equal(result.metrics[0].label,'Result');assert.equal(result.metrics[0].value,0);
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
