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

test("localises fixed finance copy during loading and live language switches", () => {
  const financeCopy = {
    assets: ["Activa", "Actifs", "Assets"],
    note: [
      "NBB-kerncijfers per bronjaar via BelgoBase. Ontbrekende cijfers blijven leeg.",
      "Chiffres clés BNB par année source via BelgoBase. Les chiffres manquants restent vides.",
      "NBB key figures by source year via BelgoBase. Missing figures remain empty.",
    ],
    explanation: [
      "Geen bruikbare waarde in de gebruikte bron. Ontbrekend betekent niet nul.",
      "Aucune valeur exploitable dans la source utilisée. Une valeur manquante ne signifie pas zéro.",
      "No usable value in the source used. Missing does not mean zero.",
    ],
    status: ["Overgenomen uit de bron", "Repris de la source", "Taken from the source"],
  };
  const languages = ["nl", "fr", "en"];
  for (const [index, language] of languages.entries()) {
    const window = load(language);
    const i18n = window.BelgoBasePresentationI18n;
    assert.equal(i18n.translate(financeCopy.assets[0]), financeCopy.assets[index]);
    assert.equal(i18n.translate(financeCopy.note[0]), financeCopy.note[index]);
    assert.equal(i18n.translate(financeCopy.explanation[0]), financeCopy.explanation[index]);
    assert.equal(i18n.translate(financeCopy.status[0]), financeCopy.status[index]);
    assert.equal(i18n.translate("Officiële NBB-rubriek 10/20"), "Officiële NBB-rubriek 10/20");
  }

  const nodes = Object.fromEntries(Object.entries(financeCopy).map(([key, values]) => [key, { nodeType: 3, nodeValue: values[0] }]));
  const sourceLabel = { nodeType: 3, nodeValue: "Officiële NBB-rubriek 10/20" };
  const window = load("nl", {}, [
    { selector: ".chart-head .segment button", elements: [{ childNodes: [nodes.assets] }] },
    { selector: "#chart-note", elements: [{ childNodes: [nodes.note] }] },
    { selector: ".value-explanation", elements: [{ childNodes: [nodes.explanation] }, { childNodes: [sourceLabel] }] },
    { selector: "#financial-rows td:nth-child(4)", elements: [{ childNodes: [nodes.status] }] },
  ]);
  for (const [index, language] of languages.entries()) {
    window.BelgoBaseI18n.language = language;
    window.BelgoBasePresentationI18n.apply();
    for (const [key, values] of Object.entries(financeCopy)) assert.equal(nodes[key].nodeValue, values[index]);
    assert.equal(sourceLabel.nodeValue, "Officiële NBB-rubriek 10/20");
  }
});

test("formats only known account status and dates while retaining account identifiers and plan", () => {
  const source = { rows: [
    { label: "Licentiestatus", value: "active" },
    { label: "Licentie geldig vanaf", value: "2026-09-14T19:54:36.337249Z" },
    { label: "Licentie geldig tot", value: "2027-09-14T21:54:36+02:00" },
    { label: "Licentieplan", value: "internal-full" },
    { label: "Licentie-ID", value: "licence-public-reference" },
  ] };
  const expectedStatus = { nl: "Actief", fr: "Actif", en: "Active" };
  for (const language of ["nl", "fr", "en"]) {
    const result = load(language).BelgoBaseWebI18n.enrich("workspace_data", source);
    assert.equal(result.rows[0].value, expectedStatus[language]);
    assert.equal(result.rows[1].value, "14/09/2026 19:54 UTC");
    assert.equal(result.rows[2].value, "14/09/2027 19:54 UTC");
    assert.equal(result.rows[3].value, "internal-full");
    assert.equal(result.rows[4].value, "licence-public-reference");
  }
  assert.equal(source.rows[0].value, "active", "account source payload stays intact");
  assert.equal(source.rows[1].value, "2026-09-14T19:54:36.337249Z");
});

test("uses singular company wording only for an exact count of one", () => {
  const resultText = { nodeType: 3, nodeValue: "1 Bedrijven" };
  const window = load("nl", {}, [{ selector: "#result-total", elements: [{ childNodes: [resultText] }] }]);
  const expected = { nl: "1 bedrijf", fr: "1 entreprise", en: "1 company" };
  for (const language of ["nl", "fr", "en"]) {
    window.BelgoBaseI18n.language = language;
    window.BelgoBasePresentationI18n.apply();
    assert.equal(resultText.nodeValue, expected[language]);
  }
  assert.equal(load("nl").BelgoBaseWebI18n.enrich("workspace_save", { message: "1 bedrijven opgeslagen." }).message, "Excel met 1 bedrijf is voorbereid; de browserdownload is gestart.");
  assert.equal(load("fr").BelgoBaseWebI18n.enrich("workspace_save", { message: "1 bedrijven opgeslagen." }).message, "Le fichier Excel contenant 1 entreprise est prêt ; le téléchargement dans le navigateur a démarré.");
  assert.equal(load("en").BelgoBaseWebI18n.enrich("workspace_save", { message: "1 bedrijven opgeslagen." }).message, "The Excel file with 1 company is ready; the browser download has started.");
  assert.equal(load("nl").BelgoBaseWebI18n.enrich("workspace_save", { message: "2 bedrijven opgeslagen." }).message, "Excel met 2 bedrijven is voorbereid; de browserdownload is gestart.");
});

test("live language switches update only known company identity labels", () => {
  const labels = [
    ["Straat (NL)", "Rue (NL)", "Street (NL)"],
    ["Huisnummer", "Numéro", "House number"],
    ["Bus", "Boîte", "Box"],
    ["Postcode (KBO)", "Code postal (BCE)", "Postcode (CBE)"],
  ];
  const nodes = labels.map(values => ({ nodeType: 3, nodeValue: values[0] }));
  const window = load("nl", {}, [{ selector: "#overview-info .info-row > span", elements: nodes.map(child => ({ childNodes: [child] })) }]);
  for (const [index, language] of ["nl", "fr", "en"].entries()) {
    window.BelgoBaseI18n.language = language;
    window.BelgoBasePresentationI18n.apply();
    nodes.forEach((node, labelIndex) => assert.equal(node.nodeValue, labels[labelIndex][index]));
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
  assert.equal(fr.message, "Le fichier Excel contenant 12 entreprises sur 40 est prêt ; le téléchargement dans le navigateur a démarré (limite d’export configurée).");
  assert.equal(fr.error, "Le fichier Excel contenant 3 entreprises est prêt ; le téléchargement dans le navigateur a démarré.");
  assert.equal(en.message, "The Excel file with 12 of 40 companies is ready; the browser download has started (configured export limit).");
  assert.equal(en.error, "The Excel file with 3 companies is ready; the browser download has started.");
  assert.equal(nl.message, "Excel met 12 van 40 bedrijven is voorbereid; de browserdownload is gestart (ingestelde exportlimiet).");
  assert.equal(nl.error, "Excel met 3 bedrijven is voorbereid; de browserdownload is gestart.");
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


test("fixed finance aliases and account credit copy follow the selected language", () => {
  const messages={};
  const win=load("fr",messages);
  assert.equal(messages["account.walletLinked"].fr,"Votre crédit IA est lié à votre licence BelgoBase.");
  assert.equal(win.BelgoBasePresentationI18n.translate("Resultaat boekjaar"),"Résultat de l’exercice");
  assert.equal(win.BelgoBasePresentationI18n.translate("Bronjaar kerncijfers"),"Année source des chiffres clés");
  win.BelgoBaseI18n.language="en";
  assert.equal(win.BelgoBasePresentationI18n.translate("Resultaat boekjaar"),"Financial-year result");
  assert.equal(win.BelgoBasePresentationI18n.translate("Bronjaar kerncijfers"),"Key figures source year");
  assert.equal(messages["account.walletLinked"].en,"Your AI balance is linked to your BelgoBase licence.");
});
