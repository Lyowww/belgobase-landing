import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  publicPageSecurityHeaders,
  workspaceShellSecurityHeaders,
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
  assert.equal(
    publicPageSecurityHeaders["Permissions-Policy"],
    "camera=(), geolocation=(), microphone=(self)",
  );
});

test("client-side login navigation inherits a microphone-capable document", () => {
  assert.equal(publicPageSecurityHeaders["Permissions-Policy"], workspaceShellSecurityHeaders["Permissions-Policy"]);
});

test("workspace shell can delegate microphone only to its same-origin iframe", async () => {
  assert.equal(
    workspaceShellSecurityHeaders["Permissions-Policy"],
    "camera=(), geolocation=(), microphone=(self)",
  );
  assert.equal(workspaceShellSecurityHeaders["X-Frame-Options"], "DENY");

  const [component, route] = await Promise.all([
    readFile(
      new URL("../src/components/workspace/WorkspaceApp.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/api/web/workspace/route.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(component, /src="\/api\/web\/workspace"/);
  assert.match(component, /allow="microphone"/);
  assert.match(route, /\.\.\.workspaceSecurityHeaders/);
});

test("authenticated workspace iframe remains same-origin frameable with a complete CSP", () => {
  const csp = workspaceSecurityHeaders["Content-Security-Policy"];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.doesNotMatch(csp, /frame-ancestors 'none'/);
  assert.equal(workspaceSecurityHeaders["X-Frame-Options"], "SAMEORIGIN");
});
