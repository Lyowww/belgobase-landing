import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("./browser-adapter.js", import.meta.url), "utf8");
function harness(language, { changed = false, tooLarge = false, logoutFailed = false } = {}) {
  const calls = [];
  const window = { addEventListener() {}, setTimeout, clearTimeout, location: { origin: "https://example.invalid" }, parent: { postMessage() {} } };
  const document = { documentElement: { lang: language }, getElementById() { return { value: language }; } };
  const context = vm.createContext({ window, document, AbortController, URL, TextEncoder, TextDecoder, Uint8Array, performance,
    fetch: async (url, options) => {
      calls.push({ url: String(url), body: options?.body });
      if (String(url).endsWith("/auth/session")) return response({ authenticated: true, csrf: "synthetic-csrf-token" });
      if (String(url).includes("/download/")) return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(tooLarge ? 4 * 1024 * 1024 + 1 : 1) };
      if (String(url).endsWith("/auth/logout")) return response({ ok: !logoutFailed }, logoutFailed ? 503 : 200);
      return response({ ok: true, rows: 1, total: changed ? 2 : 1, download_url: "/api/web/download/0123456789abcdef0123456789abcdef" });
    },
  });
  vm.runInContext(source, context);
  return { api: window.pywebview.api, calls };
}
function response(data, status = 200) { return { ok: status === 200, status, json: async () => data, text: async () => JSON.stringify(data) }; }

const expected = {
  nl: { count: "Kies één", checked: "aangevinkte selectie", changed: "exportlimiet is gewijzigd", size: "maximaal 4 MB" },
  fr: { count: "Sélectionnez entre", checked: "sélection cochée", changed: "limite d’exportation a changé", size: "4 Mo maximum" },
  en: { count: "Choose between", checked: "checked selection", changed: "export limit has changed", size: "no more than 4 MB" },
};
for (const language of ["nl", "fr", "en"]) {
  test(`${language}: invalid count and changed checked rows stop before network`, async () => {
    const h = harness(language);
    await assert.rejects(h.api.journey_prepare_selection({ expected_count: 5001 }), error => error.message.includes(expected[language].count));
    await assert.rejects(h.api.journey_prepare_selection({ expected_count: 2, numbers: ["0123456789"] }), error => error.message.includes(expected[language].checked));
    assert.equal(h.calls.length, 0);
  });
  test(`${language}: real count-change route retains selection and prevents upload`, async () => {
    const h = harness(language, { changed: true });
    const request = { expected_count: 1, filters: { postcode: "2800" }, query: "software" };
    await assert.rejects(h.api.journey_prepare_selection(request), error => error.message.includes(expected[language].changed));
    assert.deepEqual(request, { expected_count: 1, filters: { postcode: "2800" }, query: "software" });
    assert.equal(h.calls.length, 2);
    assert.ok(h.calls.every(call => !call.url.includes("/download/") && !call.body?.includes("upload_begin")));
  });
  test(`${language}: oversized download reports the chosen language without upload`, async () => {
    const h = harness(language, { tooLarge: true });
    await assert.rejects(h.api.journey_prepare_selection({ expected_count: 1, filters: {}, query: "" }), error => error.message.includes(expected[language].size));
    assert.equal(h.calls.length, 3);
    assert.ok(h.calls.every(call => !call.body?.includes("upload_begin")));
  });
}
