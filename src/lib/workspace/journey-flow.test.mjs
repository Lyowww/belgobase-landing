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
  assert.match(script, /actionName==='resume-job'\)startJourneyJob\(\{command:'job_resume'/);
  assert.match(script, /actionName==='start-job'\)startJourneyJob\(\{command:'job_start'/);
  assert.match(script, /command:'state'.*last_advice/s);
  assert.match(script, /if\(history\[index\]\?\.role==='user'\)/);
  assert.match(script, /linkedAssistant\.content===savedAdvice\?\.assistant_message/);
  assert.match(script, /command:'job_remove'.*confirmed:true/);
  assert.match(script, /Exporteer eerst wat je wilt bewaren/);
  assert.match(script, /data-journey-action="search-target"/);
  assert.match(script, /searchJourneyTarget\(button\.dataset\.brief\)/);
  assert.match(script, /filters:freshSession\?journeyApplyExclusions\(\{\}\)/);
  assert.match(script, /freshSession\?\{fresh_session:true\}/);
  assert.doesNotThrow(() => new Function(script));
});

test("web renders service-shaped saved advice and list metadata", () => {
  let panel;
  const journeyPanel = (title, copy, body) => { panel = { title, copy, body }; };
  const esc = value => String(value ?? "");
  const journey = { data: {} };
  const advice = scriptFunction("renderJourneyAdvice", "renderJourneyFeedback", {
    journey, journeyPanel, esc, journeyProfileMarkup: () => "",
  });
  advice({ assistant_message: "Bewaard advies", question: "Volgende vraag", hypotheses: [], search_brief: "Zoekbrief" });
  assert.match(panel.body, /Bewaard advies/);

  journey.data = null; journey.selectionImported = true; journey.file = null;
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

test("web profile prefers a current draft and ignores an empty confirmed profile", () => {
  const journeyProfileFields = [["business", "Bedrijf"], ["offering", "Aanbod"], ["goal", "Doel"], ["geography", "Regio"], ["ideal_customer", "Ideale klant"], ["exclusions", "Uitsluitingen"]];
  const journey = { data: {
    profile_confirmed: true,
    confirmed_profile: {},
    last_advice: { profile: { business: "Adviesprofiel" } },
  } };
  const journeyProfileState = scriptFunction("journeyProfileState", "journeyProfile", { journey, journeyProfileFields });
  assert.deepEqual(journeyProfileState(), { profile: { business: "Adviesprofiel" }, confirmed: false });

  journey.data = {
    profile_confirmed: true,
    profile: { business: "Nieuw concept" },
    confirmed_profile: { business: "Eerder bevestigd" },
    last_advice: { profile: { business: "Ouder advies" } },
  };
  assert.deepEqual(journeyProfileState(), { profile: { business: "Nieuw concept" }, confirmed: false });

  journey.data.profile = { business: "   " };
  assert.deepEqual(journeyProfileState(), { profile: { business: "Eerder bevestigd" }, confirmed: true });
});

test("web journey controls switch through the shared NL FR EN catalog", () => {
  const controls = ["goalAction", "uploadAction", "contactsAction"].map(key => ({
    dataset: { i18n: `journey.${key}` }, textContent: "oude tekst",
  }));
  const document = {
    documentElement: { lang: "nl" },
    querySelectorAll: selector => selector === "[data-i18n]" ? controls : [],
  };
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
  assert.deepEqual(controls.map(control => control.textContent), [
    "Discuter de l’objectif", "Ajouter une liste de clients", "Compléter les coordonnées",
  ]);
  assert.equal(journeyText("enrichSelection", { count: 12 }), "Enrichir cette sélection (12)");
  assert.equal(journeyText("prospects"), "Sélection de prospects");
  assert.equal(journeyText("source"), "Source");
  assert.equal(journeyText("chooseAnotherFile"), "Choisir un autre fichier");
  assert.equal(journeyText("taskReady"), "La sélection a été reprise et la tâche de contact est prête.");
  assert.equal(journeyText("onlyNew"), "Exclure les entreprises déjà traitées ou livrées");
  assert.equal(journeyText("feedbackAdvise"), "Proposition de profil basée sur le retour");
  assert.equal(journeyText("maxBudget"), "Budget maximal (€)");
  assert.equal(journeyTaskStatus("running"), "En cours");

  i18n.setLanguage("en", { persist: false });
  assert.deepEqual(controls.map(control => control.textContent), [
    "Discuss your goal", "Add customer list", "Complete contact details",
  ]);
  assert.equal(journeyText("currentSelection"), "Current search selection");
  assert.equal(journeyText("customers"), "Customer list");
  assert.equal(journeyText("openJob"), "Open task");
  assert.equal(journeyText("chooseAnotherFile"), "Choose another file");
  assert.equal(journeyText("selectionReady"), "The selection has been imported.");
  assert.equal(journeyText("profileSave"), "Confirm profile");
  assert.equal(journeyText("customExport"), "Configure Excel");
  assert.equal(journeyText("maxBudget"), "Maximum budget (€)");
  assert.equal(journeyTaskStatus("completed"), "Completed");
  assert.match(html, /id="journey-goal"[^>]+data-i18n="journey\.goalAction"/);
  assert.match(html, /id="journey-upload"[^>]+data-i18n="journey\.uploadAction"/);
  assert.match(html, /id="journey-contacts"[^>]+data-i18n="journey\.contactsAction"/);
});

test("web clears stale job state and sends the exact selected count to the prospects import", async () => {
  const journey = { mode: null, data: {}, job: { job_id: "old" }, viewingHistory: true };
  const mergeJourneyResult = scriptFunction("mergeJourneyResult", "updateJourney", {
    journey, acceptWalletSnapshot() {},
  });
  mergeJourneyResult({ job: null });
  assert.equal(journey.job, null);

  const requests = [], notices = [];
  let attempts = 0;
  const prepareJourneySelection = scriptFunction("prepareJourneySelection", "openJourneyContacts", {
    journey,
    ensureJourneyState: async () => true,
    journeySelectionContext: () => ({ count: 2, numbers: ["0123456789", "0987654321"] }),
    journeyText: key => key, nf: new Intl.NumberFormat("nl-BE"),
    notice(message, isError = false) { notices.push({ message, isError }); }, busy() {},
    async bridge(method, payload) {
      if (attempts++ === 0) throw new Error("oude fout");
      requests.push({ method, payload });
      return { list: { purpose: "prospects" }, job: null };
    },
    updateJourney() {},
    async requestJourneyEstimate() { requests.push({ command: "estimate_requested" }); return true; },
    async journeyCall(command) { requests.push(command); return { job: { job_id: "new" } }; },
  });
  await prepareJourneySelection(true);
  await prepareJourneySelection(true);
  assert.deepEqual(requests[0], { method: "journey_prepare_selection", payload: { numbers: ["0123456789", "0987654321"], expected_count: 2 } });
  assert.deepEqual(requests[1], { command: "job_create", only_new: true });
  assert.deepEqual(requests[2], { command: "estimate_requested" });
  assert.equal(journey.mode, "contacts");
  assert.deepEqual(notices, [
    { message: "oude fout", isError: true },
    { message: "taskReady", isError: false },
  ]);
});

test("web requests the server estimate with the selected options before paid start", async () => {
  const job = { job_id: "11111111-1111-4111-8111-111111111111", status: "created" };
  const journey = { job, data: { job }, estimateRevision: 0 };
  const calls = [], notices = [];
  const requestJourneyEstimate = scriptFunction("requestJourneyEstimate", "startJourneyJob", {
    journey,
    journeyContactOptions: () => ({ google_enabled: false, max_calls: 0, max_cost_eur: 0 }),
    async journeyCall(command) { calls.push(command); return { estimate: { rows: 3, estimated_cost_min_eur: 0, estimated_cost_max_eur: 0 } }; },
    renderJourneyJob() {},
    notice(message, isError) { notices.push({ message, isError }); },
  });
  assert.equal(await requestJourneyEstimate(), true);
  assert.deepEqual(calls, [{
    command: "job_estimate",
    job_id: job.job_id,
    options: { google_enabled: false, max_calls: 0, max_cost_eur: 0 },
  }]);
  assert.equal(journey.job.estimate.rows, 3);
  assert.deepEqual(journey.job.options, { google_enabled: false, max_calls: 0, max_cost_eur: 0 });
  assert.deepEqual(notices, []);
  assert.match(script, /actionName==='start-job'\)startJourneyJob\(\{command:'job_start'/);
  assert.match(script, /async function startJourneyJob[\s\S]*?requestJourneyEstimate\(options\)[\s\S]*?journeyCall\(\{\.\.\.command,options\}\)/);
  assert.match(script, /journeyText\('maxBudget'\)/);
});

test("web loads persistent exclusions once before a search boundary and blocks on a missing state", async () => {
  const exclusions = { customer_enterprise_numbers: ["0123456789"], treated_enterprise_numbers: [], rejected_enterprise_numbers: [] };
  const journey = { data: null, exclusionsReady: false };
  const calls = [], notices = [];
  const ensureJourneyState = scriptFunction("ensureJourneyState", "journeyPanel", {
    journey,
    async journeyCall(command) { calls.push(command); return { exclusions }; },
    mergeJourneyResult(result) { journey.data = result; },
    notice(message, isError) { notices.push({ message, isError }); },
    journeyText: key => key,
  });
  assert.equal(await ensureJourneyState(), true);
  assert.equal(await ensureJourneyState(), true);
  assert.deepEqual(calls, [{ command: "state" }]);
  assert.deepEqual(journey.data.exclusions, exclusions);
  assert.deepEqual(notices, []);

  journey.data = null; journey.exclusionsReady = false;
  const blocked = scriptFunction("ensureJourneyState", "journeyPanel", {
    journey,
    async journeyCall() { return {}; },
    mergeJourneyResult(result) { journey.data = result; },
    notice(message, isError) { notices.push({ message, isError }); },
    journeyText: key => key,
  });
  assert.equal(await blocked(), false);
  assert.deepEqual(notices.at(-1), { message: "exclusionsUnavailable", isError: true });
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
  const evidence = scriptFunction("journeyEvidenceLabel", "journeyCandidateReason", { journeyWebsiteEvidence });
  assert.deepEqual(status("pending"), { key: "pending", label: "Nog te verwerken" });
  assert.equal(status("private-provider-state").label, "Status niet beschikbaar");
  assert.equal(evidence({ website_status: "not_supplied" }), "Geen website aangeleverd");

  const journey = { job: { job_id: "job-1" } };
  let savedPayload;
  const exportJourney = scriptFunction("exportJourney", "journeyExportConfiguration", {
    journey, busy() {},
    async journeyCall() { return { ok: true, export_id: "export-1", size: 123, rows: 2, filename: "Contacten.xlsx" }; },
    async bridge(method, payload) { assert.equal(method, "journey_save_export"); savedPayload = payload; return { ok: true, message: "opgeslagen" }; },
    notice() {},
  });
  await exportJourney(true);
  assert.deepEqual(savedPayload, { export_id: "export-1", size: 123, rows: 2, filename: "Contacten.xlsx" });
  assert.equal("ok" in savedPayload, false);
});

test("web journey applies persistent exclusions and exposes review, feedback and export controls", () => {
  const journey = { onlyNew: true, data: { exclusions: {
    customer_enterprise_numbers: ["0111111111"], rejected_enterprise_numbers: ["0222222222"],
    treated_enterprise_numbers: ["0333333333"],
  } } };
  const exclusions = scriptFunction("journeyExclusionNumbers", "journeyApplyExclusions", { journey });
  assert.deepEqual(exclusions(), ["0111111111", "0222222222", "0333333333"]);
  journey.onlyNew = false;
  assert.deepEqual(exclusions(), ["0111111111", "0222222222"]);

  const candidateReason = scriptFunction("journeyCandidateReason", "journeyExportMarkup", {});
  assert.equal(candidateReason({ city: "Mechelen", nace: "62", fte: 10, year: 2025 }),
    "Voldoet aan jouw selectie: locatie Mechelen · sector 62 · 10 VTE · bronjaar 2025");
  assert.doesNotMatch(candidateReason({ city: "Mechelen" }), /koopkans|ranking/i);

  const configuration = scriptFunction("journeyExportConfiguration", "journeyProfileInput", {
    $$: selector => selector.includes("column") ? [{ value: "phone" }, { value: "source" }] : [{ value: "found" }],
    $: selector => ({ checked: selector.includes("evidence") }),
  });
  assert.deepEqual(configuration(), {
    columns: ["phone", "source"], statuses: ["found"], include_evidence: true, include_alternatives: false,
  });
  assert.match(script, /command:'profile_confirm'.*confirmed:true/);
  assert.match(script, /command:'feedback_advise'/);
  assert.match(script, /command:'feedback_confirm'.*proposal_id/);
  assert.match(script, /command:'candidate_review'.*reason:/);
  assert.match(script, /command:'identity_memory_remove'/);
  assert.match(script, /command:'candidates_mark_treated'/);
  assert.match(script, /usageItems=\[\['chat_analysis'/);
  assert.match(script, /\['contact_research'/);
  assert.match(script, /\['voice'/);
  assert.match(script, /max_spend_under_budget_eur/);
});
