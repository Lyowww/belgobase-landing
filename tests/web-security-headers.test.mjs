import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyHtmlScriptNonce,
  createCspNonce,
  publicPageSecurityHeaders,
  workspaceShellSecurityHeaders,
  workspaceSecurityHeaders,
} from "../src/lib/security-headers.ts";

const TEST_NONCE = "dGVzdC1ub25jZS12YWx1ZQ==";

test("createCspNonce returns unique base64 nonces", () => {
  const a = createCspNonce();
  const b = createCspNonce();
  assert.match(a, /^[A-Za-z0-9+/_-]+=*$/);
  assert.match(b, /^[A-Za-z0-9+/_-]+=*$/);
  assert.notEqual(a, b);
});

test("public pages deny framing and restrict active content", () => {
  const headers = publicPageSecurityHeaders(TEST_NONCE);
  const csp = headers["Content-Security-Policy"];
  for (const directive of [
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ]) {
    assert.match(csp, new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(csp, new RegExp(`script-src[^;]*'nonce-${TEST_NONCE}'`));
  assert.match(csp, /script-src[^;]*'strict-dynamic'/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.ok(headers["Referrer-Policy"]);
  assert.equal(
    headers["Permissions-Policy"],
    "camera=(), geolocation=(), microphone=(self)",
  );
});

test("client-side login navigation inherits a microphone-capable document", () => {
  const publicHeaders = publicPageSecurityHeaders(TEST_NONCE);
  const shellHeaders = workspaceShellSecurityHeaders(TEST_NONCE);
  assert.equal(publicHeaders["Permissions-Policy"], shellHeaders["Permissions-Policy"]);
  assert.match(publicHeaders["Content-Security-Policy"], /https:\/\/www\.googletagmanager\.com/);
  assert.match(publicHeaders["Content-Security-Policy"], /https:\/\/www\.googleadservices\.com/);
  assert.match(publicHeaders["Content-Security-Policy"], /https:\/\/challenges\.cloudflare\.com/);
  assert.match(shellHeaders["Content-Security-Policy"], /https:\/\/challenges\.cloudflare\.com/);
  assert.match(shellHeaders["Content-Security-Policy"], new RegExp(`'nonce-${TEST_NONCE}'`));
  assert.doesNotMatch(shellHeaders["Content-Security-Policy"], /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(shellHeaders["Content-Security-Policy"], /google|doubleclick/);
});

test("workspace shell can delegate microphone only to its same-origin iframe", async () => {
  const shellHeaders = workspaceShellSecurityHeaders(TEST_NONCE);
  assert.equal(
    shellHeaders["Permissions-Policy"],
    "camera=(), geolocation=(), microphone=(self)",
  );
  assert.equal(shellHeaders["X-Frame-Options"], "DENY");

  const [component, route, frozenUi] = await Promise.all([
    readFile(
      new URL("../src/components/workspace/WorkspaceApp.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/api/web/workspace/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/workspace/assets/frozen-ui.html", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(component, /src="\/api\/web\/workspace"/);
  assert.match(component, /allow="microphone"/);
  assert.match(route, /workspaceSecurityHeaders\(/);
  assert.match(route, /applyHtmlScriptNonce/);
  assert.match(route, /createCspNonce/);
  assert.doesNotMatch(frozenUi, /http-equiv=["']Content-Security-Policy["']/);
});

test("authenticated workspace iframe remains same-origin frameable with a complete CSP", () => {
  const headers = workspaceSecurityHeaders(TEST_NONCE);
  const csp = headers["Content-Security-Policy"];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /frame-src 'self'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, new RegExp(`script-src 'nonce-${TEST_NONCE}' 'strict-dynamic'`));
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(csp, /frame-ancestors 'none'/);
  assert.equal(headers["X-Frame-Options"], "SAMEORIGIN");
});

test("applyHtmlScriptNonce tags every script element exactly once", () => {
  const html = '<script src="a.js"></script><script>1</script><script nonce="keep">2</script>';
  const out = applyHtmlScriptNonce(html, TEST_NONCE);
  assert.equal(
    out,
    `<script nonce="${TEST_NONCE}" src="a.js"></script><script nonce="${TEST_NONCE}">1</script><script nonce="keep">2</script>`,
  );
  assert.throws(() => applyHtmlScriptNonce(html, "bad nonce!"));
});

test("proxy forwards request CSP nonce for Next.js script stamping", async () => {
  const proxySource = await readFile(
    new URL("../src/proxy.ts", import.meta.url),
    "utf8",
  );
  assert.match(proxySource, /createCspNonce/);
  assert.match(proxySource, /CSP_NONCE_HEADER/);
  assert.match(proxySource, /requestHeaders\.set\("Content-Security-Policy"/);
  assert.match(proxySource, /requestHeaders\.set\(CSP_NONCE_HEADER/);
});

test("numberfinder reuses the document script nonce for srcdoc scripts", async () => {
  const source = await readFile(
    new URL("../src/lib/workspace/assets/numberfinder-view.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /const SCRIPT_NONCE/);
  assert.match(source, /document\.currentScript\.nonce/);
  assert.match(source, /nonceAttr/);
});
