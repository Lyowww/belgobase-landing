import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./browser-adapter.js", import.meta.url), "utf8");
const AI_CONTRACT = "belgobase-premium-v1";
const AI_SESSION = "00000000-0000-4000-8000-000000000001";
function aiProposal(overrides = {}) {
  return {
    contract: AI_CONTRACT,
    session_id: AI_SESSION,
    expires_in_seconds: 900,
    status: "clarify",
    filters: {},
    summary: [],
    question: "Welke activiteit bedoel je?",
    choices: [],
    message: "",
    answer_context: {},
    activity_selection_complete: false,
    regions: [],
    preferences: [],
    ...overrides,
  };
}

function adapterHarness(replies, mediaError, language = "nl", enrich) {
  const calls = [];
  const messages = [];
  const links = [];
  let processor;
  let timeout;
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
  const document = {
    documentElement: { lang: language },
    body: { append(node) { links.push(node); } },
    createElement() { return { style: {}, click() { this.clicked = true; }, remove() { this.removed = true; } }; },
  };
  class AudioContext {
    constructor() { this.sampleRate = 48_000; this.destination = {}; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createScriptProcessor() { processor = { connect() {}, disconnect() {}, onaudioprocess: null }; return processor; }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
    async resume() {}
    async close() {}
  }
  const window = {
    parent: { postMessage(value, origin) { messages.push({ value, origin }); } },
    location: { origin: "https://app.example.test" },
    isSecureContext: true,
    AudioContext,
    crypto: webcrypto,
    addEventListener() {},
    setTimeout(callback) { timeout = callback; return 1; },
    clearTimeout() {},
  };
  if (enrich) window.BelgoBaseWebI18n = { enrich };
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const reply = replies.shift();
    assert.ok(reply, `unexpected request ${url}`);
    if (reply.wait) await reply.wait;
    if (reply.error) throw reply.error;
    return {
      ok: reply.status === undefined || (reply.status >= 200 && reply.status < 300),
      status: reply.status ?? 200,
      json: async () => reply.body,
      arrayBuffer: async () => Uint8Array.from(reply.raw || []).buffer,
    };
  };
  const context = vm.createContext({
    window, document, fetch, navigator: { mediaDevices: { getUserMedia: async () => { if (mediaError) throw mediaError; return { getTracks: () => tracks }; } } },
    URL, Blob, Proxy, Promise, Uint8Array, Int16Array, Float32Array, DataView, AbortController,
    performance: { now: () => 1_000 }, btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
  });
  vm.runInContext(source, context);
  return { api: window.pywebview.api, calls, links, messages, window, context, getProcessor: () => processor, fireTimeout: () => timeout(), tracks };
}

test("a failed audio engine releases the microphone and permits retry", async () => {
  const h = adapterHarness([]);
  let closed = 0;
  h.window.AudioContext.prototype.resume = async () => { throw new Error("audio engine failure"); };
  h.window.AudioContext.prototype.close = async () => { closed++; };
  await assert.rejects(h.api.voice_start());
  assert.equal(h.tracks[0].stopped, true, "failed start must release hardware");
  assert.equal(closed, 1, "failed audio context must close");
  h.window.AudioContext.prototype.resume = async () => {};
  await h.api.voice_start();
  await h.api.voice_cancel();
});

test("cancelling while permission is pending never starts a late recording", async () => {
  const h = adapterHarness([]);
  let grant;
  h.context.navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { grant = resolve; });
  const starting = h.api.voice_start();
  await h.api.voice_cancel();
  grant({getTracks:()=>h.tracks});
  await starting;
  assert.equal(h.tracks[0].stopped, true);
  assert.equal((await h.api.voice_status()).state, "idle");
  assert.equal(h.calls.length, 0);
});

test("cancellation during session lookup never submits a transcription", async () => {
  const h=adapterHarness([]);
  let release;
  h.context.fetch=async url=>{
    h.calls.push({url});
    assert.equal(url,"/api/web/auth/session");
    await new Promise(resolve=>{release=resolve;});
    return {ok:true,status:200,json:async()=>({authenticated:true,csrf:"c".repeat(32)})};
  };
  await h.api.voice_start();
  h.getProcessor().onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(24000).fill(.1)}});
  const stopping=h.api.voice_stop();
  await new Promise(resolve=>setImmediate(resolve));
  await h.api.voice_cancel();
  release();
  assert.equal((await stopping).cancelled,true);
  assert.equal(h.calls.length,1);
});

test("exports without a valid same-origin file never report success", async () => {
  for(const url of [undefined,"https://outside.example/file.xlsx","http://[","/api/web/download/file#fragment"]){
    const h=adapterHarness([{body:{authenticated:true,csrf:"d".repeat(32)}},{body:{ok:true,...(url===undefined?{}:{download_url:url})}}]);
    await assert.rejects(h.api.export_results({}),/opnieuw/);
    assert.equal(h.links.length,0);
  }
});

test("a malformed successful transcription becomes a recoverable error rather than endless processing", async () => {
  const h=adapterHarness([{body:{authenticated:true,csrf:"v".repeat(32)}},{body:{ok:true}}]);
  await h.api.voice_start();
  h.getProcessor().onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(24000).fill(.1)}});
  h.fireTimeout();
  await new Promise(resolve=>setImmediate(resolve));
  const status=await h.api.voice_status();
  assert.equal(status.state,"idle");
  assert.match(status.error,/opnieuw/);
  await h.api.voice_start();await h.api.voice_cancel();
});

test("microphone failures explain permission recovery, missing hardware and busy input", async () => {
  for (const [name, language, expected] of [
    ["NotAllowedError", "nl", /instellingenicoon/],
    ["NotAllowedError", "fr", /Microphone bloqué/],
    ["NotAllowedError", "en", /Microphone blocked/],
    ["NotFoundError", "nl", /Geen microfoon/],
    ["NotReadableError", "nl", /andere opname/],
  ]) {
    const h = adapterHarness([], { name }, language);
    await assert.rejects(h.api.voice_start(), expected);
    assert.equal(h.calls.length, 0);
  }
});

test("bridge forwards an authenticated method and starts a same-origin download", async () => {
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "a".repeat(32) } },
    { body: { ok: true, total: 2, download_url: "/api/web/download/abcdefghijklmnop" } },
  ]);
  const result = await h.api.export_results({ filters: {} });
  assert.equal(result.total, 2);
  assert.equal(h.calls[1].url, "/api/web/bridge/export_results");
  assert.equal(h.calls[1].options.headers["X-BelgoBase-CSRF"], "a".repeat(32));
  assert.equal(h.links[0].href, "https://app.example.test/api/web/download/abcdefghijklmnop");
  assert.equal(h.links[0].clicked, true);
});

test("journey throttles request starts without blocking pause behind slow advice", async () => {
  let releaseAdvice;
  const slowAdvice = new Promise(resolve => { releaseAdvice = resolve; });
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "j".repeat(32) } },
    { wait: slowAdvice, body: { ok: true, proposal: { status: "journey", contract: AI_CONTRACT, journey: { advice: {} } } } },
    { body: { ok: true, proposal: { status: "journey", contract: AI_CONTRACT, journey: { job: { status: "paused" } } } } },
  ]);
  h.window.setTimeout = callback => { queueMicrotask(callback); return 1; };

  let adviceDone = false;
  const advice = h.api.journey({ command: "advise", text: "test" }).then(result => {
    adviceDone = true;
    return result;
  });
  await new Promise(resolve => setImmediate(resolve));
  const paused = await h.api.journey({ command: "job_pause", job_id: "job-1" });

  assert.equal(paused.job.status, "paused");
  assert.equal(adviceDone, false, "pause must not await the slow advice response");
  assert.equal(JSON.parse(h.calls[2].options.body).journey.command, "job_pause");
  releaseAdvice();
  await advice;
});

test("journey returns the real service state view without adding a state layer", async () => {
  const savedAdvice = {
    assistant_message: "Bewaard advies", profile: {}, question: "Volgende vraag",
    hypotheses: [], search_brief: "Zoekbrief",
  };
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "k".repeat(32) } },
    { body: { ok: true, proposal: {
      status: "journey", contract: AI_CONTRACT,
      journey: {
        profile: {}, history: [
          { role: "user", content: "Mijn bedrijf" },
          { role: "assistant", content: "Bewaard advies" },
        ],
        last_advice: savedAdvice, list: null, job: null,
        retention_days: 7, google_available: false,
      },
    } } },
  ]);

  const result = await h.api.journey({ command: "state" });

  assert.deepEqual(JSON.parse(JSON.stringify(result.last_advice)), savedAdvice);
  assert.equal("state" in result, false);
  assert.equal(JSON.parse(h.calls[1].options.body).journey.command, "state");
});

test("contact download needs customer receipt before marking any company treated", async () => {
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "d".repeat(32) } },
    { body: { ok: true, proposal: { status: "journey", contract: AI_CONTRACT,
      journey: { data: "AQID", offset: 3 } } } },
  ]);
  const result = await h.api.journey_save_export({ export_id: "export-1", size: 3, rows: 1, filename: "Contacten.xlsx" });
  assert.equal(result.delivery_pending, true);
  assert.equal(result.export_id, "export-1");
  assert.equal(h.links[0].clicked, true);
  assert.equal(h.calls.length, 2);
  assert.equal(JSON.parse(h.calls[1].options.body).journey.command, "export_chunk");
  h.fireTimeout();
});

test("invalid journey uploads explain file recovery instead of claiming an outage", async () => {
  for (const language of ["nl", "fr", "en"]) {
    const h = adapterHarness([
      { body: { authenticated: true, csrf: "d".repeat(32) } },
      { status: 400, body: { error: "journey_invalid_request" } },
    ], undefined, language);
    await assert.rejects(h.api.journey({ command: "upload_finish", upload_id: "x" }), error =>
      /CSV/.test(error.message) && !/journey_invalid_request|temporarily unavailable|tijdelijk niet beschikbaar/.test(error.message));
  }
});

test("journey selection import preserves the exact count and marks the upload as prospects", async () => {
  const journeyReply = journey => ({ body: { ok: true, proposal: { status: "journey", contract: AI_CONTRACT, journey } } });
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "p".repeat(32) } },
    { body: { ok: true, total: 2, rows: 2, download_url: "/api/web/download/selection-file" } },
    { raw: [1, 2, 3] },
    journeyReply({ upload_id: "upload-1" }),
    journeyReply({ offset: 3 }),
    journeyReply({ list: { purpose: "prospects", unique_count: 2 }, job: null }),
  ]);
  h.window.setTimeout = callback => { queueMicrotask(callback); return 1; };

  const result = await h.api.journey_prepare_selection({ numbers: ["0123456789", "0987654321"], expected_count: 2 });

  assert.equal(result.list.purpose, "prospects");
  const exported = JSON.parse(h.calls[1].options.body);
  assert.deepEqual(exported.numbers, ["0123456789", "0987654321"]);
  const upload = JSON.parse(h.calls[3].options.body).journey;
  assert.deepEqual(upload, { command: "upload_begin", filename: "BelgoBase_selectie.xlsx", size: 3, purpose: "prospects" });
});

test("journey selection import rejects truncation and over 5,000 before uploading", async () => {
  const oversized = adapterHarness([]);
  await assert.rejects(
    oversized.api.journey_prepare_selection({ filters: {}, expected_count: 5001 }),
    /maximaal 5\.000/,
  );
  assert.equal(oversized.calls.length, 0);

  const empty = adapterHarness([]);
  await assert.rejects(
    empty.api.journey_prepare_selection({ numbers: [], expected_count: 1 }),
    /selectie is gewijzigd/,
  );
  assert.equal(empty.calls.length, 0);

  const limited = adapterHarness([
    { body: { authenticated: true, csrf: "l".repeat(32) } },
    { body: { ok: true, total: 5, rows: 3, download_url: "/api/web/download/short" } },
  ]);
  await assert.rejects(
    limited.api.journey_prepare_selection({ filters: {}, query: "bouw", expected_count: 5 }),
    /kapt de lijst niet stil af/,
  );
  assert.equal(limited.calls.length, 2, "a truncated export must never be downloaded or uploaded");
});

test("journey rejects missing or malformed BFF proposal envelopes", async () => {
  for (const body of [
    { ok: true, status: "journey", contract: AI_CONTRACT, journey: {} },
    { ok: true, proposal: { status: "journey", contract: "wrong", journey: {} } },
    { ok: true, proposal: { status: "search", contract: AI_CONTRACT, journey: {} } },
    { ok: true, proposal: { status: "journey", contract: AI_CONTRACT, journey: [] } },
  ]) {
    const h = adapterHarness([
      { body: { authenticated: true, csrf: "j".repeat(32) } },
      { body },
    ]);
    await assert.rejects(h.api.journey({ command: "state" }), error => error.code === "ai_invalid_response");
  }
});

test("AI sends the live canonical contract and merges selection metadata back into UI filters", async () => {
  const preference = { field: "omzet", direction: "high", priority: 1, evidence: "hoogste omzet eerst" };
  const wallet = { available_eur: 7.25, entries: [] };
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "a".repeat(32) } },
    { body: { ok: true, proposal: aiProposal({
      status: "ready", filters: { nace_prefix: "41", ondernemingsnummers_exclude: ["1111111111"] }, question: "", summary: ["Bouw"],
      activity_selection_complete: true, regions: ["vlaanderen"], preferences: [preference],
      selection_contract: "belgobase-selection-v2", wallet,
    }) } },
  ], undefined, "fr");
  const result = await h.api.ai({
    text: "  bouwbedrijven  ", conversation: [], operation_id: "ui-operation",
    filters: { juridical_situation_exclude: ["J003"], ondernemingsnummers_exclude: ["0123456789", "0987654321"], regions: ["vlaanderen"], preferences: [preference] },
  });
  const payload = JSON.parse(h.calls[1].options.body);
  assert.equal(h.calls[1].url, "/api/web/bridge/ai");
  assert.equal(payload.contract, AI_CONTRACT);
  assert.equal(payload.action, "ask");
  assert.match(payload.request_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(payload.assistant, true);
  assert.equal(payload.language, "fr");
  assert.equal(payload.text, "bouwbedrijven");
  assert.equal(payload.reset, true);
  assert.deepEqual(payload.current_filters, { juridical_situation_exclude: ["J003"], ondernemingsnummers_exclude: ["0123456789", "0987654321"] });
  assert.deepEqual(payload.current_regions, ["vlaanderen"]);
  assert.deepEqual(payload.current_preferences, [preference]);
  assert.equal("operation_id" in payload, false);
  assert.equal("conversation" in payload, false);
  assert.equal("filters" in payload, false);
  assert.deepEqual(JSON.parse(JSON.stringify(result.proposal.filters)), { nace_prefix: "41", ondernemingsnummers_exclude: ["0123456789", "0987654321"], regions: ["vlaanderen"], preferences: [preference] });
  assert.deepEqual(JSON.parse(JSON.stringify(result.wallet)), wallet);
  assert.deepEqual(JSON.parse(JSON.stringify(result.proposal.wallet)), wallet);
  assert.equal("session_id" in result.proposal, false, "canonical session metadata stays inside the adapter");
});

test("AI rejects more than 10,000 persistent enterprise exclusions before transport", async () => {
  const h = adapterHarness([]);
  const exclusions = Array.from({ length: 10_001 }, (_, index) => String(index).padStart(10, "0"));
  await assert.rejects(
    h.api.ai({ text: "bedrijven", filters: { ondernemingsnummers_exclude: exclusions } }),
    error => error?.code === "invalid_ai_request",
  );
  assert.equal(h.calls.length, 0);
});

test("AI follow-ups keep one session and a new UI conversation sends reset without forwarding conversation", async () => {
  const ready = overrides => ({ body: { ok: true, proposal: aiProposal(overrides) } });
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "s".repeat(32) } },
    ready({ choices: [{ value: "41", label: "Bouw" }] }),
    ready({ status: "ready", question: "", activity_selection_complete: true }),
    ready({ reference_choices: [{ choice_id: "company-1", label: "Voorbeeld" }] }),
    ready({ status: "ready", question: "", activity_selection_complete: true }),
    ready({}),
  ], undefined, "en");
  await h.api.ai({ text: "builders", conversation: [], filters: {} });
  await h.api.ai({ selected_codes: ["41"] });
  await h.api.ai({ text: "near Ghent", conversation: [{ role: "user", content: "builders" }], filters: {} });
  await h.api.ai({ selected_company_choice: "company-1" });
  await h.api.ai({ text: "new conversation", conversation: [], filters: {} });
  const payloads = h.calls.slice(1).map(call => JSON.parse(call.options.body));
  assert.deepEqual(payloads.map(payload => payload.action), ["ask", "select", "ask", "choose", "ask"]);
  assert.equal(payloads[0].session_id, undefined);
  for (const payload of payloads.slice(1)) assert.equal(payload.session_id, AI_SESSION);
  assert.deepEqual(payloads[1].codes, ["41"]);
  assert.equal(payloads[3].choice_id, "company-1");
  assert.equal(payloads[2].reset, undefined);
  assert.equal(payloads[4].reset, true);
  assert.ok(payloads.every(payload => !("conversation" in payload)));
});

test("journey target search starts without the prior AI session or filters", async () => {
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "f".repeat(32) } },
    { body: { ok: true, proposal: aiProposal() } },
    { body: { ok: true, proposal: aiProposal() } },
  ]);
  await h.api.ai({ text: "oude zoekvraag", conversation: [], filters: { nace_prefix: "41" } });
  await h.api.ai({
    text: "bevestigde doelgroep", conversation: [{ role: "user", content: "zichtbaar gesprek" }],
    filters: {}, fresh_session: true,
  });
  const payload = JSON.parse(h.calls.at(-1).options.body);
  assert.equal(payload.action, "ask");
  assert.equal(payload.session_id, undefined);
  assert.equal(payload.reset, true);
  assert.deepEqual(payload.current_filters, {});
  assert.equal("fresh_session" in payload, false);
  assert.equal("conversation" in payload, false);
});

test("AI rejects malformed canonical responses without retaining their session", async () => {
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "r".repeat(32) } },
    { body: { ok: true, proposal: aiProposal({ expires_in_seconds: 0 }) } },
    { body: { ok: true, proposal: aiProposal({ session_id: "00000000-0000-4000-8000-000000000002" }) } },
  ]);
  await assert.rejects(h.api.ai({ text: "test", conversation: [], filters: {} }), error => {
    assert.equal(error.code, "ai_invalid_response");
    assert.match(error.message, /geen geldig antwoord/);
    return true;
  });
  await h.api.ai({ text: "retry", conversation: [{ role: "user", content: "test" }], filters: {} });
  const retry = JSON.parse(h.calls[2].options.body);
  assert.equal(retry.session_id, undefined);
});

test("AI balance errors are human in every language and a paid request is never retried automatically", async () => {
  for (const [language, expected] of [["nl", /AI-tegoed/], ["fr", /solde IA/], ["en", /AI balance/]]) {
    const h = adapterHarness([
      { body: { authenticated: true, csrf: "b".repeat(32) } },
      { status: 402, body: { ok: false, error: "insufficient_balance" } },
    ], undefined, language);
    await assert.rejects(h.api.ai({ text: "bouw", conversation: [], filters: {} }), error => {
      assert.equal(error.code, "insufficient_balance");
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /insufficient_balance/);
      return true;
    });
    assert.equal(h.calls.filter(call => call.url.endsWith("/bridge/ai")).length, 1);
  }
  const retry = adapterHarness([
    { body: { authenticated: true, csrf: "m".repeat(32) } },
    { status: 402, body: { ok: false, error: "insufficient_balance" } },
    { body: { ok: true, proposal: aiProposal() } },
  ]);
  await assert.rejects(retry.api.ai({ text: "behouden tekst", conversation: [], filters: {} }));
  await retry.api.ai({ text: "behouden tekst", conversation: [], filters: {} });
  const paid = retry.calls.filter(call => call.url.endsWith("/bridge/ai")).map(call => JSON.parse(call.options.body));
  assert.equal(paid.length, 2, "only the explicit manual retry creates a second paid request");
  assert.notEqual(paid[0].request_id, paid[1].request_id);
  assert.deepEqual(paid.map(payload => payload.text), ["behouden tekst", "behouden tekst"]);
});

test("AI maps session and invalid-request protocol errors to typed human messages", async () => {
  for (const [status, code, language, expected] of [
    [409, "ai_session_expired", "nl", /zoekgesprek is verlopen/],
    [400, "invalid_ai_request", "fr", /Vérifiez votre saisie/],
    [400, "invalid_ai_request", "en", /Check your input/],
    [400, "ai_invalid_proposal", "nl", /bruikbaar zoekvoorstel/],
    [400, "ai_invalid_proposal", "fr", /proposition de recherche/],
    [400, "ai_invalid_proposal", "en", /No usable search proposal/],
  ]) {
    const h = adapterHarness([
      { body: { authenticated: true, csrf: "e".repeat(32) } },
      { status, body: { ok: false, error: code } },
    ], undefined, language);
    await assert.rejects(h.api.ai({ text: "query", conversation: [], filters: {} }), error => {
      assert.equal(error.code, code);
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, new RegExp(code));
      return true;
    });
  }
});

test("AI cancellation rejects concurrent work, ignores the late session and closes it once", async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const nextSession = "00000000-0000-4000-8000-000000000002";
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "c".repeat(32) } },
    { wait: gate, body: { ok: true, proposal: aiProposal() } },
    { body: { ok: true, cancelled: true } },
    { body: { ok: true, proposal: { contract: AI_CONTRACT, session_id: AI_SESSION, expires_in_seconds: 900, status: "closed" } } },
    { body: { ok: true, proposal: aiProposal({ session_id: nextSession }) } },
  ]);
  const late = h.api.ai({ text: "first", conversation: [], filters: {}, operation_id: "op-1" });
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(h.api.ai({ text: "concurrent", conversation: [], filters: {} }), error => error.code === "ai_session_busy");
  await h.api.cancel_operation({ operation_id: "op-1" });
  release();
  await assert.rejects(late, error => error.code === "ai_session_closed");
  await h.api.ai({ text: "after cancel", conversation: [{ role: "user", content: "old" }], filters: {} });
  const payloads = h.calls.filter(call => call.url.endsWith("/bridge/ai")).map(call => JSON.parse(call.options.body));
  assert.deepEqual(payloads.map(payload => payload.action), ["ask", "close", "ask"]);
  assert.equal(payloads[1].session_id, AI_SESSION);
  assert.equal(payloads[2].session_id, undefined, "a late response cannot resurrect the cancelled session");
});

test("workspace logout clears the AI session before another browser request", async () => {
  const nextSession = "00000000-0000-4000-8000-000000000002";
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "l".repeat(32) } },
    { body: { ok: true, proposal: aiProposal() } },
    { body: { ok: true } },
    { body: { authenticated: true, csrf: "n".repeat(32) } },
    { body: { ok: true, proposal: aiProposal({ session_id: nextSession }) } },
  ]);
  await h.api.ai({ text: "before logout", conversation: [], filters: {} });
  await h.api.account_action({ action: "deactivate", confirmed: true });
  await h.api.ai({ text: "after logout", conversation: [{ role: "user", content: "old" }], filters: {} });
  const last = JSON.parse(h.calls.at(-1).options.body);
  assert.equal(last.session_id, undefined);
});

test("voice creates a 16 kHz WAV request and cancellation stops browser tracks", async () => {
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "b".repeat(32) } },
    { body: { ok: true, text: "bouwbedrijven in Gent" } },
  ]);
  await h.api.voice_start({ text: "" });
  const samples = new Float32Array(24_000).fill(0.15);
  h.getProcessor().onaudioprocess({ inputBuffer: { getChannelData: () => samples } });
  const result = await h.api.voice_stop();
  assert.equal(result.text, "bouwbedrijven in Gent");
  const payload = JSON.parse(h.calls[1].options.body);
  assert.deepEqual(Object.keys(payload).sort(), ["audio_wav", "request_id"]);
  assert.match(payload.request_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(payload.audio_wav, /^[A-Za-z0-9+/]+=*$/);
  const wav = Buffer.from(payload.audio_wav, "base64");
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(24), 16000);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), wav.length - 44);
  if (process.env.BB_SYNTHETIC_VOICE_PROOF) await writeFile(process.env.BB_SYNTHETIC_VOICE_PROOF, JSON.stringify(payload));

  await h.api.voice_start({ text: "behouden concept" });
  await h.api.voice_cancel();
  assert.equal(h.tracks.at(-1).stopped, true);
});

test("rejected audio shows recovery advice rather than an internal error code", async () => {
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "b".repeat(32) } },
    { status: 400, body: { error: "voice_invalid_audio" } },
  ]);
  await h.api.voice_start();
  h.getProcessor().onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(24_000).fill(0.1) } });
  await assert.rejects(h.api.voice_stop(), /Neem opnieuw op/);
  assert.equal(h.tracks[0].stopped, true);
  await h.api.voice_start();
  await h.api.voice_cancel();
});

test("insufficient voice balance names the actual reason without claiming bad audio", async () => {
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "b".repeat(32) } },
    { status: 402, body: { error: "insufficient_balance" } },
  ]);
  await h.api.voice_start();
  h.getProcessor().onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(24_000).fill(0.1) } });
  await assert.rejects(h.api.voice_stop(), /Onvoldoende AI-tegoed/);
  assert.equal(h.tracks[0].stopped, true);
});

test("workspace deactivation logs out the web session rather than a Windows device", async () => {
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "c".repeat(32) } },
    { body: { ok: true } },
  ]);
  const result = await h.api.account_action({ action: "deactivate", confirmed: true });
  assert.equal(result.deactivated, true);
  assert.equal(h.calls[1].url, "/api/web/auth/logout");
  assert.equal(h.messages[0].value.type, "belgobase-web-logout");
});

test("a bridge 401 tells the containing login screen that the session expired", async () => {
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "d".repeat(32) } },
    { status: 401, body: { ok: false, error: "expired" } },
  ]);
  await assert.rejects(h.api.search({}), /sessie is verlopen/);
  assert.equal(h.messages[0].value.type, "belgobase-web-auth-expired");
});

test("a temporary session lookup failure keeps the containing session intact", async () => {
  const h = adapterHarness([{ status: 503, body: { error: "internal_error" } }], undefined, "en");
  await assert.rejects(h.api.search({}), /temporarily unavailable/i);
  assert.equal(h.messages.length, 0);
});

test("bridge errors are localized before display and protocol codes stay private", async () => {
  const translated = adapterHarness([
    { body: { authenticated: true, csrf: "t".repeat(32) } },
    { status: 400, body: { ok: false, error: "Ongeldig verzoek." } },
  ], undefined, "fr", (_method, data) => ({ ...data, error: "Requête non valide." }));
  await assert.rejects(translated.api.search({}), /Requête non valide/);

  for (const [status, code, expected] of [
    [403, "csrf_invalid", /not available for your account/i],
    [500, "internal_error", /temporarily unavailable/i],
  ]) {
    const h = adapterHarness([
      { body: { authenticated: true, csrf: "p".repeat(32) } },
      { status, body: { ok: false, error: code } },
    ], undefined, "en");
    await assert.rejects(h.api.search({}), error => {
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, new RegExp(code));
      return true;
    });
    assert.equal(h.messages.length, 0);
  }
});

test("a bridge network interruption gives retry guidance without signing out", async () => {
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "n".repeat(32) } },
    { error: new TypeError("network details") },
  ], undefined, "fr");
  await assert.rejects(h.api.search({}), /temporairement indisponible/i);
  assert.equal(h.messages.length, 0);
});

test("rapid saves use successive revisions while preserving each edit snapshot", async () => {
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "e".repeat(32) } },
    { body: { ok: true, workspace_revision: 4 } },
    { body: { ok: true, workspace_revision: 5 } },
    { body: { ok: true, workspace_revision: 6 } },
  ]);
  await h.api.bootstrap({});
  const payload = { workspace: { lists: ["first"] } };
  const first = h.api.workspace_save(payload);
  payload.workspace.lists.push("second");
  const second = h.api.workspace_save(payload);
  await Promise.all([first, second]);
  assert.deepEqual(JSON.parse(h.calls[2].options.body), {
    workspace: { lists: ["first"] }, workspace_revision: 4,
  });
  assert.deepEqual(JSON.parse(h.calls[3].options.body), {
    workspace: { lists: ["first", "second"] }, workspace_revision: 5,
  });
});

test("the login component retains the public auth contract", async () => {
  const component = await readFile(new URL("../../components/workspace/WorkspaceApp.tsx", import.meta.url), "utf8");
  assert.match(component, /\/api\/web\/auth\/start/);
  assert.match(component, /license_code/);
  assert.match(component, /\/api\/web\/auth\/verify/);
  assert.match(component, /one-time-code/);
  assert.match(component, /X-BelgoBase-CSRF/);
  assert.match(component, /customer_number/);
  assert.match(component, /license_id/);
  assert.match(component, /referenceUnavailable/);
  assert.match(component, /desktop-download\?lang=\$\{shellLanguage\}&format=json/);
  assert.equal(component.match(/language: shellLanguage/g)?.length, 3);
  assert.match(component, /setAccountBusy\(true\); setBrowserSessions\(\[\]\);/);
  assert.match(component, /closeAccount: "Close panel"/);
  assert.match(component, /mail_unavailable: t\.unavailable/);
  assert.match(component, /setPhase\("serviceUnavailable"\)/);
  assert.match(component, /if \(response\.ok\) \{ setAccount\(undefined\); setCsrf\(""\); setError\(""\); setSessionRetryAvailable\(false\); setPhase\("login"\); return; \}/);
  assert.match(component, /setSessionRetryAvailable\(true\); throw reason;/);
  assert.match(component, /retrySession\(true\)/);
  assert.match(component, /disabled=\{codeInputLocked\}/);
  assert.match(component, /accountIntro: "Manage your account and signed-in browsers\."/);
});


test("logout sends valid JSON and never claims success on a server failure", async () => {
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "c".repeat(32) } },
    { status: 503, body: { ok: false } },
  ]);
  await assert.rejects(h.api.account_action({ action: "deactivate" }), /Afmelden/);
  assert.equal(h.calls[1].options.headers["content-type"], "application/json");
  assert.equal(h.calls[1].options.body, "{}");
  assert.equal(h.messages.length, 0);
});

test("automatic voice completion releases recording for the next request", async () => {
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "v".repeat(32) } },
    { body: { ok: true, text: "Gent" } },
  ]);
  await h.api.voice_start();
  h.getProcessor().onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(24_000).fill(.1) } });
  h.fireTimeout();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await h.api.voice_status()).text, "Gent");
  await h.api.voice_start();
  await h.api.voice_cancel();
});

test("automatic recording error becomes visible and allows retry", async () => {
  const h = adapterHarness([]);
  await h.api.voice_start();
  h.fireTimeout();
  await new Promise(resolve => setImmediate(resolve));
  assert.match((await h.api.voice_status()).error, /te kort/);
  await h.api.voice_start();
  await h.api.voice_cancel();
});

test("manual stop while automatic transcription runs shares the same result", async () => {
  const h = adapterHarness([
    { body: { authenticated: true, csrf: "v".repeat(32) } },
    { body: { ok: true, text: "Antwerpen" } },
  ]);
  await h.api.voice_start();
  h.getProcessor().onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(24_000).fill(.1) } });
  h.fireTimeout();
  assert.equal((await h.api.voice_stop()).text, "Antwerpen");
  assert.equal(h.calls.filter(call => call.url === "/api/web/voice").length, 1);
});
