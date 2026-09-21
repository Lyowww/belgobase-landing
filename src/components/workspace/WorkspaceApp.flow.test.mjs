import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("./WorkspaceApp.tsx", import.meta.url), "utf8");
const module = { exports: {} };
const output = ts.transpileModule(source, {
  compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(output, {
  module,
  exports: module.exports,
  require(id) {
    if (id === "react") return {};
    if (id === "react/jsx-runtime") return { Fragment: Symbol("Fragment"), jsx() {}, jsxs() {} };
    if (id.endsWith(".module.css")) return {};
    throw new Error(`Unexpected import: ${id}`);
  },
  URL,
});

const { accountReferences, desktopDownloadHref, retryLocksCodeInput, sessionPollOutcome, validSessionProjection } = module.exports;

test("authenticated workspace projection requires exact authentication and a bounded CSRF token", () => {
  const valid = "A_1234567890-bcde";
  assert.equal(validSessionProjection({ authenticated: true, csrf: valid }), true);
  assert.equal(validSessionProjection({ authenticated: "true", csrf: valid }), false);
  assert.equal(validSessionProjection({ authenticated: true }), false);
  assert.equal(validSessionProjection({ authenticated: true, csrf: "too-short" }), false);
  assert.equal(validSessionProjection({ authenticated: true, csrf: "123456789012345!" }), false);
});

test("a login recovery lock cannot disable an enrollment code", () => {
  assert.equal(retryLocksCodeInput("loginCode", true), true);
  for (const phase of ["enrollCode", "login", "enroll", "profile", "workspace"]) {
    assert.equal(retryLocksCodeInput(phase, true), false, phase);
  }
  assert.equal(retryLocksCodeInput("loginCode", false), false);
});

test("session polling handles the documented logged-out projection without treating outages as logout", () => {
  assert.equal(sessionPollOutcome(200, { authenticated: false }), "signedOut");
  assert.equal(sessionPollOutcome(401, {}), "signedOut");
  assert.equal(sessionPollOutcome(403, { error: "license_inactive" }), "accessDenied");
  assert.equal(sessionPollOutcome(403, { error: "csrf_invalid" }), "unchanged");
  assert.equal(sessionPollOutcome(503, {}), "unchanged");
  assert.equal(sessionPollOutcome(200, {}), "unchanged");
});

test("desktop installer navigation accepts only the exact signed-download URL shape", () => {
  const valid = "https://api.belgobase.be/client-updates/download/BelgoBase_CloudClient_Setup_BUILD103_UPDATE51.exe";
  assert.equal(desktopDownloadHref(valid), valid);
  for (const value of [
    "http://api.belgobase.be/client-updates/download/BelgoBase_CloudClient_Setup_BUILD103_UPDATE51.exe",
    "https://api.belgobase.be.evil.example/client-updates/download/BelgoBase_CloudClient_Setup_BUILD103_UPDATE51.exe",
    "https://user@api.belgobase.be/client-updates/download/BelgoBase_CloudClient_Setup_BUILD103_UPDATE51.exe",
    "https://api.belgobase.be:444/client-updates/download/BelgoBase_CloudClient_Setup_BUILD103_UPDATE51.exe",
    `${valid}?token=unexpected`,
    `${valid}#fragment`,
    "https://api.belgobase.be/client-updates/download/BelgoBase_CloudClient_Setup_BUILD99_UPDATE51.exe",
    "https://api.belgobase.be/client-updates/download/other.exe",
  ]) assert.equal(desktopDownloadHref(value), undefined, value);
});

test("account references prefer the structured projection and support labeled-row fallback", () => {
  const projected = accountReferences({
    customer: { customer_number: " C-100 " },
    license: { license_id: " L-200 " },
    rows: [{ label: "Klantnummer", value: "old" }],
  });
  assert.equal(projected.customerNumber, "C-100");
  assert.equal(projected.licenseId, "L-200");
  const rows = accountReferences({ rows: [{ key: "customer_number", value: "C-300" }, { label: "Licence ID", value: "L-400" }] });
  assert.equal(rows.customerNumber, "C-300");
  assert.equal(rows.licenseId, "L-400");
});

test("enrollment transitions clear stale recovery and one-time-code state", () => {
  const start = source.slice(source.indexOf("async function startEnrollment"), source.indexOf("async function resendEnrollmentCode"));
  const resend = source.slice(source.indexOf("async function resendEnrollmentCode"), source.indexOf("async function verifyEnrollment"));
  const create = source.slice(source.indexOf("{phase === \"login\" ? <p className={styles.createAccount}"), source.indexOf("{documentView ?"));
  assert.match(start, /setCode\(""\).*setSessionRetryAvailable\(false\).*setPhase\("enrollCode"\)/s);
  assert.match(resend, /setChallengeId\(result\.challenge_id\).*setCode\(""\).*setSessionRetryAvailable\(false\).*setResendIn\(30\)/s);
  assert.match(create, /setSessionRetryAvailable\(false\).*setPhase\("enroll"\)/s);
});

test("an expired download session closes account state and returns to sign-in", () => {
  const download = source.slice(source.indexOf("async function downloadDesktop"), source.indexOf("async function revokeBrowser"));
  assert.match(download, /if \(response\.status === 401\)/);
  assert.match(download, /setAccount\(undefined\).*setCsrf\(""\).*setAccountOpen\(false\).*setBrowserSessions\(\[\]\).*setError\("session_expired"\).*setPhase\("login"\)/s);
});

test("successful enrollment completion recovers through the service screen when session refresh fails", () => {
  const complete = source.slice(source.indexOf("async function complete"), source.indexOf("async function logout"));
  assert.match(complete, /clearEnrollment\(\)/);
  assert.match(complete, /try \{ await loadSession\(\); \}\s*catch \(reason\) \{ setPhase\("serviceUnavailable"\); throw reason; \}/);
});

test("explicit logout closes account-only state before the next sign-in", () => {
  const logout = source.slice(source.indexOf("async function logout"), source.indexOf("async function loadBrowserSessions"));
  assert.match(logout, /setAccountOpen\(false\)/);
  assert.match(logout, /setBrowserSessions\(\[\]\).*setReferences\(\{\}\).*setCopyFeedback\(undefined\).*setDownloadError\(false\)/s);
});

test("a browser-list failure is not presented as an empty successful list", () => {
  const loader = source.slice(source.indexOf("async function loadBrowserSessions"), source.indexOf("async function loadAccountReferences"));
  assert.match(loader, /setBrowserSessionsError\(false\)/);
  assert.match(loader, /catch \{ setBrowserSessions\(\[\]\); setBrowserSessionsError\(true\); \}/);
  assert.match(source, /!accountBusy && browserSessionsError \? <p[^>]+role="alert">\{t\.browserLoadFailed\}/);
  assert.match(source, /!accountBusy && !browserSessionsError && browserSessions\.length === 0 \? <p[^>]*>\{t\.noBrowsers\}/);
  for (const copy of [
    "De aangemelde browsers konden niet worden geladen.",
    "The signed-in browsers could not be loaded.",
    "Les navigateurs connectés n’ont pas pu être chargés.",
  ]) assert.match(source, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
