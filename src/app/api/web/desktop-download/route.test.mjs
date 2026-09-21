import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
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
