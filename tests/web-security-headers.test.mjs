import assert from "node:assert/strict";
import test from "node:test";
import {
  publicPageSecurityHeaders,
  workspaceSecurityHeaders,
} from "../src/lib/security-headers.ts";

test("public pages deny framing and restrict active content", () => {
  const csp = publicPageSecurityHeaders["Content-Security-Policy"];
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
  assert.equal(publicPageSecurityHeaders["X-Frame-Options"], "DENY");
  assert.equal(publicPageSecurityHeaders["X-Content-Type-Options"], "nosniff");
  assert.ok(publicPageSecurityHeaders["Referrer-Policy"]);
});

test("authenticated workspace remains same-origin frameable with a complete CSP", () => {
  const csp = workspaceSecurityHeaders["Content-Security-Policy"];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.doesNotMatch(csp, /frame-ancestors 'none'/);
  assert.equal(workspaceSecurityHeaders["X-Frame-Options"], "SAMEORIGIN");
});
