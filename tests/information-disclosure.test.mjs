import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isProtocolErrorCode,
  looksLikeInternalErrorMessage,
  sanitizeClientErrorMessage,
} from "../src/lib/safe-client-error.ts";
import { redactLogDetail } from "../src/lib/email/log-redaction.ts";
import { serverDebugLog } from "../src/lib/server-log.ts";

test("client error sanitizer keeps protocol codes and product copy", () => {
  assert.equal(isProtocolErrorCode("csrf_invalid"), true);
  assert.equal(isProtocolErrorCode("Selecteer eerst bedrijven."), false);
  assert.equal(sanitizeClientErrorMessage("csrf_invalid"), "csrf_invalid");
  assert.equal(
    sanitizeClientErrorMessage("Selecteer eerst bedrijven."),
    "Selecteer eerst bedrijven.",
  );
});

test("client error sanitizer strips stacks, paths, and provider secrets", () => {
  const internal = [
    'Traceback (most recent call last):\n  File "/Users/ops/app/backend/web_core.py", line 1',
    "Error: ENOENT: no such file or directory, open 'C:\\\\Secrets\\\\keys.env'",
    "Resend rejected with key re_live_example_key_value_123456",
    "Authorization Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig",
    "at Object.<anonymous> (/app/node_modules/next/dist/server.js:10:1)",
  ];
  for (const message of internal) {
    assert.equal(looksLikeInternalErrorMessage(message), true, message);
    assert.equal(sanitizeClientErrorMessage(message), "temporarily_unavailable");
  }
});

test("log redaction removes emails, keys, tokens, and filesystem paths", () => {
  const detail = redactLogDetail(
    'owner@example.test used re_live_example_key_value_123456 Bearer abcdefghijklmnop File "/Users/ops/secret.py" path C:\\\\Users\\\\ops\\\\key.pem',
  );
  assert.equal(detail.includes("owner@example.test"), false);
  assert.equal(detail.includes("re_live_example_key_value_123456"), false);
  assert.equal(detail.includes("abcdefghijklmnop"), false);
  assert.equal(detail.includes("/Users/ops"), false);
  assert.equal(detail.includes("C:\\\\Users"), false);
  assert.match(detail, /\[redacted-email\]/);
  assert.match(detail, /\[redacted-key\]/);
  assert.match(detail, /\[redacted-token\]/);
  assert.match(detail, /\[redacted-path\]/);
});

test("production debug logging is a no-op", () => {
  const previous = process.env.NODE_ENV;
  const calls = [];
  const original = console.debug;
  console.debug = (...args) => calls.push(args);
  try {
    process.env.NODE_ENV = "production";
    serverDebugLog("audit", { secret: "should-not-print" });
    assert.equal(calls.length, 0);
    process.env.NODE_ENV = "development";
    serverDebugLog("audit", "visible-in-dev");
    assert.equal(calls.length, 1);
  } finally {
    console.debug = original;
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("production build config disables browser source maps and X-Powered-By", async () => {
  const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /productionBrowserSourceMaps:\s*false/);
  assert.match(config, /poweredByHeader:\s*false/);
});

test("workspace version fingerprint requires an authenticated session", async () => {
  const route = await readFile(
    new URL("../src/app/api/web/version/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /proxyWebRequest\(request,\s*\["auth",\s*"session"\]\)/);
  assert.match(route, /authenticated !== true/);
  assert.doesNotMatch(route, /export async function GET\(\)/);
});

test("backend never forwards raw exception strings to workspace clients", async () => {
  const core = await readFile(new URL("../backend/web_core.py", import.meta.url), "utf8");
  assert.doesNotMatch(core, /WorkspaceError\(str\(exc\)\)/);
});

test("adapter rejects internal free-text bridge failures", async () => {
  const source = await readFile(
    new URL("../src/lib/workspace/browser-adapter.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /function looksLikeInternalError/);
  assert.match(source, /function bridgeFailure/);
  assert.match(source, /looksLikeInternalError\(raw\)/);
});

test("env example documents public vs secret variables", async () => {
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(example, /NEVER put secrets in NEXT_PUBLIC_/);
  assert.match(example, /TURNSTILE_SECRET_KEY/);
  assert.match(example, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  assert.match(example, /NEXT_PUBLIC_GA4_MEASUREMENT_ID/);
  assert.match(example, /BELGOBASE_WEB_BACKEND_URL/);
  assert.doesNotMatch(example, /NEXT_PUBLIC_.*SECRET/);
});
