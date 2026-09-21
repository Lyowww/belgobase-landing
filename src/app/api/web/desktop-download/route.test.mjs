import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { desktopRelease } from "../../../../lib/workspace/desktop-release.mjs";

const route = await readFile(new URL("./route.ts", import.meta.url), "utf8");
const component = await readFile(new URL("../../../../components/workspace/WorkspaceApp.tsx", import.meta.url), "utf8");

test("desktop download metadata remains behind session and signed-release validation", () => {
  assert.match(route, /new Set\(\["nl", "fr", "en"\]\)/);
  assert.match(route, /Connectez-vous pour télécharger BelgoBase pour Windows/);
  assert.match(route, /Sign in to download BelgoBase for Windows/);
  assert.match(route, /session\.status === 401 \? text\.signIn : text\.unavailable/);
  assert.match(route, /if \(!response\.ok\) throw new Error\("Release unavailable"\)/);
  assert.match(route, /return webError\(text\.unavailable, 503\)/);
  const verified = route.indexOf("const release = desktopRelease(await response.json())");
  const metadata = route.indexOf('searchParams.get("format") === "json"');
  assert.ok(verified >= 0 && metadata > verified, "JSON metadata is returned only after signature validation");
  assert.match(route, /Response\.json\(\{ ok: true, \.\.\.release \}/);
  assert.match(route, /status: 307/);
  assert.throws(() => desktopRelease({ signed: {}, signature: { algorithm: "Ed25519", key_id: "belgobase-update-ed25519-2026-01", value: "invalid" } }), /Invalid update signature/);
});

function loadRoute({
  sessionResponse,
  manifestResponse = () => Response.json({}),
  releaseResult = { url: "https://api.belgobase.be/client-updates/download/BelgoBase_CloudClient_Setup_BUILD103_UPDATE51.exe", build: 103, update: 51 },
  releaseError,
} = {}) {
  const calls = { session: 0, manifest: 0, release: 0 };
  const module = { exports: {} };
  const output = ts.transpileModule(route, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require(id) {
      if (id === "@/lib/workspace/gateway") return {
        privateHeaders: { "Cache-Control": "private, no-store" },
        proxyWebRequest: async () => { calls.session += 1; return sessionResponse(); },
        webError: (message, status) => Response.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "private, no-store" } }),
      };
      if (id === "@/lib/workspace/desktop-release.mjs") return {
        desktopRelease: () => { calls.release += 1; if (releaseError) throw releaseError; return releaseResult; },
      };
      throw new Error(`Unexpected import: ${id}`);
    },
    fetch: async () => { calls.manifest += 1; return manifestResponse(); },
    Response,
    Headers,
    URL,
    AbortSignal,
  });
  return { GET: module.exports.GET, calls };
}

function request(query = "?lang=en&format=json") {
  return { nextUrl: new URL(`https://belgobase.com/api/web/desktop-download${query}`) };
}

test("desktop download route fails closed before any manifest lookup", async (t) => {
  const cases = [
    { name: "expired session", session: () => Response.json({}, { status: 401 }), status: 401, error: "Sign in to download BelgoBase for Windows." },
    { name: "session service unavailable", session: () => Response.json({}, { status: 503 }), status: 503, error: "The Windows download is temporarily unavailable. Try again later." },
    { name: "malformed session JSON", session: () => new Response("not-json", { status: 200 }), status: 503, error: "The Windows download is temporarily unavailable. Try again later." },
    { name: "non-boolean authentication projection", session: () => Response.json({ authenticated: "false" }), status: 401, error: "Sign in to download BelgoBase for Windows." },
    { name: "logged-out session", session: () => Response.json({ authenticated: false }), status: 401, error: "Sign in to download BelgoBase for Windows." },
  ];
  for (const item of cases) await t.test(item.name, async () => {
    const loaded = loadRoute({ sessionResponse: item.session });
    const response = await loaded.GET(request());
    const body = await response.json();
    assert.equal(response.status, item.status);
    assert.equal(body.error, item.error);
    assert.equal(loaded.calls.session, 1);
    assert.equal(loaded.calls.manifest, 0);
    assert.equal(loaded.calls.release, 0);
  });
});

test("desktop download route validates a release before JSON metadata or redirect", async (t) => {
  await t.test("manifest outage is localized and does not validate a release", async () => {
    const loaded = loadRoute({ sessionResponse: () => Response.json({ authenticated: true }), manifestResponse: () => Response.json({}, { status: 503 }) });
    const response = await loaded.GET(request("?lang=fr&format=json"));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "Le téléchargement Windows est temporairement indisponible. Réessayez plus tard.");
    assert.deepEqual(loaded.calls, { session: 1, manifest: 1, release: 0 });
  });
  await t.test("signature failure returns no metadata", async () => {
    const loaded = loadRoute({ sessionResponse: () => Response.json({ authenticated: true }), releaseError: new Error("Invalid update signature") });
    const response = await loaded.GET(request());
    assert.equal(response.status, 503);
    assert.equal(loaded.calls.release, 1);
    assert.equal(response.headers.get("location"), null);
  });
  await t.test("validated JSON metadata is private", async () => {
    const loaded = loadRoute({ sessionResponse: () => Response.json({ authenticated: true }) });
    const response = await loaded.GET(request());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.url, "https://api.belgobase.be/client-updates/download/BelgoBase_CloudClient_Setup_BUILD103_UPDATE51.exe");
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.deepEqual(loaded.calls, { session: 1, manifest: 1, release: 1 });
  });
  await t.test("legacy clients receive the validated redirect", async () => {
    const loaded = loadRoute({ sessionResponse: () => Response.json({ authenticated: true }) });
    const response = await loaded.GET(request("?lang=nl"));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://api.belgobase.be/client-updates/download/BelgoBase_CloudClient_Setup_BUILD103_UPDATE51.exe");
    assert.deepEqual(loaded.calls, { session: 1, manifest: 1, release: 1 });
  });
});

test("workspace fetches metadata, bounds the installer URL and keeps failures in the account panel", () => {
  assert.match(component, /desktop-download\?lang=\$\{shellLanguage\}&format=json/);
  assert.match(component, /url\.origin === "https:\/\/api\.belgobase\.be"/);
  assert.match(component, /client-updates\\\/download\\\/BelgoBase_CloudClient_Setup_BUILD/);
  assert.match(component, /downloadLock\.current/);
  assert.match(component, /link\.click\(\)/);
  const downloadFlow = component.slice(component.indexOf("async function downloadDesktop()"), component.indexOf("async function revokeBrowser"));
  assert.doesNotMatch(downloadFlow, /fetch\(href/);
  assert.match(component, /downloadUnavailable: "The Windows download is temporarily unavailable\. Try again later\."/);
  assert.match(component, /downloadError \? <p className=\{styles\.referenceError\} role="alert">/);
});
