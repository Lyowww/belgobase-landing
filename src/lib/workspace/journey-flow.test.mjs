import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const adapter = await readFile(new URL("./browser-adapter.js", import.meta.url), "utf8");
const html = await readFile(new URL("./assets/frozen-ui.html", import.meta.url), "utf8");
const i18nSource = await readFile(new URL("./assets/premium_i18n.js", import.meta.url), "utf8");
const script = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));

function scriptFunction(name, nextName, dependencies) {
  const plainStart = script.indexOf(`function ${name}(`);
  const asyncStart = script.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 && asyncStart < plainStart ? asyncStart : plainStart;
  const boundaries = [
    script.indexOf(`\nfunction ${nextName}(`, start),
    script.indexOf(`\nasync function ${nextName}(`, start),
  ].filter(index => index > start);
  const end = boundaries.length ? Math.min(...boundaries) : -1;
  assert.ok(start >= 0 && end > start, `${name} must exist before ${nextName}`);
  return Function(...Object.keys(dependencies), `return (${script.slice(start, end).trim()});`)(...Object.values(dependencies));
}

test("browser journey bypasses the search proposal parser but uses authenticated AI bridge", () => {
  assert.match(adapter, /action:\s*"journey"/);
  assert.match(adapter, /journey:\s*snapshot/);
  assert.match(adapter, /sendBridge\("ai"/);
  assert.match(adapter, /JOURNEY_MIN_REQUEST_INTERVAL\s*=\s*800/);
  assert.match(adapter, /skipAutodownload:\s*true/);
});

test("browser imports owner download and exports service chunks as a Blob", () => {
  assert.match(adapter, /credentials:\s*"same-origin"/);
  assert.match(adapter, /JOURNEY_EXPORT_COLUMNS/);
  assert.match(adapter, /"straat_fr"/);
  assert.match(adapter, /"winst_verlies"/);
  assert.match(adapter, /command:\s*"upload_chunk"/);
  assert.match(adapter, /command:\s*"export_chunk"/);
  assert.match(adapter, /new Blob\(chunks/);
  assert.match(adapter, /URL\.revokeObjectURL/);
});

test("web journey UI exposes the same bounded explicit workflow", () => {
  assert.equal((html.match(/id="search-form"/g) || []).length, 1);
  assert.match(html, /id="journey-goal"/);
  assert.match(script, /looksLikeBusinessIntro\(text\)/);
  assert.match(script, /setTimeout\(async\(\)=>\{[\s\S]*?\},5000\)/);
  assert.match(script, /google_available===true/);
  assert.match(script, /missingWebsite=list\.website_missing_count/);
  assert.match(script, /missingWebsite===uniqueCount/);
  assert.match(script, /journey\.selectionImported=true/);
  assert.match(script, /Number\.isInteger\(mapping\[key\]\)\?headers\[mapping\[key\]\]/);
  assert.match(script, /input_phone/);
  assert.match(script, /email/);
  assert.match(script, /select\.value\|\|null/);
  assert.match(script, /command:'job_resume'.*options:journeyContactOptions\(\)/);
  assert.match(script, /command:'job_start'.*options:journeyContactOptions\(\)/);
  assert.match(script, /command:'state'.*last_advice/s);
  assert.match(script, /if\(history\[index\]\?\.role==='user'\)/);
  assert.match(script, /linkedAssistant\.content===savedAdvice\?\.assistant_message/);
  assert.match(script, /command:'job_remove'.*confirmed:true/);
  assert.match(script, /Exporteer eerst wat je wilt bewaren/);
  assert.match(script, /data-journey-action="search-target"/);
  assert.match(script, /searchJourneyTarget\(button\.dataset\.brief\)/);
  assert.match(script, /filters:freshSession\?\{\}/);
  assert.match(script, /freshSession\?\{fresh_session:true\}/);
  assert.doesNotThrow(() => new Function(script));
});

test("web renders service-shaped saved advice and list metadata", () => {
  let panel;
  const journeyPanel = (title, copy, body) => { panel = { title, copy, body }; };
  const esc = value => String(value ?? "");
  const advice = scriptFunction("renderJourneyAdvice", "renderJourneyContactChoices", { journeyPanel, esc });
  advice({ assistant_message: "Bewaard advies", question: "Volgende vraag", hypotheses: [], search_brief: "Zoekbrief" });
  assert.match(panel.body, /Bewaard advies/);

  const journey = { data: null, selectionImported: true, file: null };
  const journeyMappingMarkup = scriptFunction("journeyMappingMarkup", "renderJourneyList", { esc });
  const renderList = scriptFunction("renderJourneyList", "renderJourneyAdvice", {
    journey, journeyPanel, journeyMappingMarkup, esc, nf: new Intl.NumberFormat("nl-BE"),
    journeyText: key => key === "chooseAnotherFile" ? "Ander bestand kiezen" : key,
  });
  journey.data = { list: {
    filename: "BelgoBase_selectie.xlsx", unique_count: 2, website_missing_count: 2,
    summary: { missing: {} }, preview: [], headers: [], mapping: {},
  } };
  renderList();
  assert.match(panel.body, /nog geen website aangetroffen/);
  journey.data.list.website_missing_count = 1;
  renderList();
  assert.doesNotMatch(panel.body, /nog geen website aangetroffen/);
  assert.match(panel.body, /Ander bestand kiezen/);
});

test("web journey controls switch through the shared NL FR EN catalog", () => {
  const document = { documentElement: { lang: "nl" }, querySelectorAll: () => [] };
  const window = {
    document,
    dispatchEvent() {},
    localStorage: { setItem() {}, getItem() { return null; } },
  };
  vm.runInNewContext(i18nSource, {
    window, document,
    CustomEvent: class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } },
  });
  const i18n = window.BelgoBaseI18n;
  const textStart = script.indexOf("const journeyFallbacks=");
  const textEnd = script.indexOf("function journeySelectionContext", textStart);
  const journeyText = Function("i18n", "t", `${script.slice(textStart, textEnd)};return journeyText;`)(i18n, i18n.t);
  const statusStart = script.indexOf("const journeyTaskStatusFallbacks=");
  const statusEnd = script.indexOf("function journeyContactOptions", statusStart);
  const journeyTaskStatus = Function("t", `${script.slice(statusStart, statusEnd)};return journeyTaskStatus;`)(i18n.t);

  i18n.setLanguage("fr", { persist: false });
  assert.equal(journeyText("enrichSelection", { count: 12 }), "Enrichir cette sélection (12)");
  assert.equal(journeyText("prospects"), "Sélection de prospects");
  assert.equal(journeyText("source"), "Source");
  assert.equal(journeyText("chooseAnotherFile"), "Choisir un autre fichier");
  assert.equal(journeyTaskStatus("running"), "En cours");

  i18n.setLanguage("en", { persist: false });
  assert.equal(journeyText("currentSelection"), "Current search selection");
  assert.equal(journeyText("customers"), "Customer list");
  assert.equal(journeyText("openJob"), "Open task");
  assert.equal(journeyText("chooseAnotherFile"), "Choose another file");
  assert.equal(journeyTaskStatus("completed"), "Completed");
});

test("web clears stale job state and sends the exact selected count to the prospects import", async () => {
  const journey = { mode: null, data: {}, job: { job_id: "old" }, viewingHistory: true };
  const mergeJourneyResult = scriptFunction("mergeJourneyResult", "updateJourney", {
    journey, acceptWalletSnapshot() {},
  });
  mergeJourneyResult({ job: null });
  assert.equal(journey.job, null);

  const requests = [];
  const prepareJourneySelection = scriptFunction("prepareJourneySelection", "openJourneyContacts", {
    journey,
    journeySelectionContext: () => ({ count: 2, numbers: ["0123456789", "0987654321"] }),
    journeyText: key => key, nf: new Intl.NumberFormat("nl-BE"), notice() {}, busy() {},
    async bridge(method, payload) { requests.push({ method, payload }); return { list: { purpose: "prospects" }, job: null }; },
    updateJourney() {}, async journeyCall(command) { requests.push(command); return { job: { job_id: "new" } }; },
  });
  await prepareJourneySelection(true);
  assert.deepEqual(requests[0], { method: "journey_prepare_selection", payload: { numbers: ["0123456789", "0987654321"], expected_count: 2 } });
  assert.deepEqual(requests[1], { command: "job_create" });
  assert.equal(journey.mode, "contacts");
});

test("web recovers service-shaped user-assistant advice without a second advise", async () => {
  const savedAdvice = { assistant_message: "Bewaard antwoord", question: "Vervolgvraag", hypotheses: [], search_brief: "" };
  const calls = [], conversation = [], query = { value: "", focus() {} };
  let rendered = null;
  const journey = { mode: null, data: null };
  const journeyAdvise = scriptFunction("journeyAdvise", "uploadJourneyFile", {
    journey,
    notice() { throw new Error("recovery should suppress the original transport error"); },
    appendConversation(role, content) { conversation.push({ role, content }); },
    $: selector => { assert.equal(selector, "#query"); return query; },
    busy() {},
    updateJourney() { throw new Error("failed advise must not return a direct result"); },
    async journeyCall(command) {
      calls.push(command.command);
      if (command.command === "advise") throw new Error("masked transport failure");
      return {
        history: [
          { role: "user", content: "Mijn bedrijf" },
          { role: "assistant", content: "Bewaard antwoord" },
        ],
        last_advice: savedAdvice,
      };
    },
    renderJourneyAdvice(value) { rendered = value; },
    acceptWalletSnapshot() {},
  });

  await journeyAdvise("Mijn bedrijf");

  assert.deepEqual(calls, ["advise", "state"]);
  assert.equal(rendered, savedAdvice);
  assert.equal(conversation.at(-1).content, "Bewaard antwoord");
});

test("web maps contact statuses safely and strips transport fields before export", async () => {
  const journeyRowStatuses = { pending: "Nog te verwerken", found: "Gecontroleerd", unresolved: "Niet gevonden", review: "Nakijken" };
  const journeyWebsiteEvidence = { found: "Nummer op de website gecontroleerd", not_supplied: "Geen website aangeleverd" };
  const status = scriptFunction("journeyRowStatus", "journeyEvidenceLabel", { journeyRowStatuses });
  const evidence = scriptFunction("journeyEvidenceLabel", "renderJourneyJob", { journeyWebsiteEvidence });
  assert.deepEqual(status("pending"), { key: "pending", label: "Nog te verwerken" });
  assert.equal(status("private-provider-state").label, "Status niet beschikbaar");
  assert.equal(evidence({ website_status: "not_supplied" }), "Geen website aangeleverd");

  const journey = { job: { job_id: "job-1" } };
  let savedPayload;
  const exportJourney = scriptFunction("exportJourney", "openJourneyGoal", {
    journey, busy() {},
    async journeyCall() { return { ok: true, export_id: "export-1", size: 123, rows: 2, filename: "Contacten.xlsx" }; },
    async bridge(method, payload) { assert.equal(method, "journey_save_export"); savedPayload = payload; return { ok: true, message: "opgeslagen" }; },
    notice() {},
  });
  await exportJourney(true);
  assert.deepEqual(savedPayload, { export_id: "export-1", size: 123, rows: 2, filename: "Contacten.xlsx" });
  assert.equal("ok" in savedPayload, false);
});
