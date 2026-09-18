import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./browser-adapter.js", import.meta.url), "utf8");

function adapterHarness(replies) {
  const calls = [];
  const messages = [];
  const links = [];
  let processor;
  let timeout;
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
  const document = {
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
    addEventListener() {},
    setTimeout(callback) { timeout = callback; return 1; },
    clearTimeout() {},
  };
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const reply = replies.shift();
    assert.ok(reply, `unexpected request ${url}`);
    return {
      ok: reply.status === undefined || (reply.status >= 200 && reply.status < 300),
      status: reply.status ?? 200,
      json: async () => reply.body,
    };
  };
  const context = vm.createContext({
    window, document, fetch, navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => tracks }) } },
    URL, Proxy, Promise, Uint8Array, Int16Array, Float32Array, DataView, AbortController,
    performance: { now: () => 1_000 }, btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  });
  vm.runInContext(source, context);
  return { api: window.pywebview.api, calls, links, messages, getProcessor: () => processor, fireTimeout: () => timeout(), tracks };
}

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
  assert.match(payload.wav_base64, /^[A-Za-z0-9+/]+=*$/);

  await h.api.voice_start({ text: "behouden concept" });
  await h.api.voice_cancel();
  assert.equal(h.tracks.at(-1).stopped, true);
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
