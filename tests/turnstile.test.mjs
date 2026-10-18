import assert from "node:assert/strict";
import test from "node:test";
import {
  TURNSTILE_ACTIONS,
  expectedTurnstileHostnames,
  resetTurnstileReplayGuardForTests,
  verifyTurnstileToken,
} from "../src/lib/security/turnstile.ts";
import { publicPageSecurityHeaders, workspaceShellSecurityHeaders } from "../src/lib/security-headers.ts";

const TEST_NONCE = "dGVzdC1ub25jZS12YWx1ZQ==";
import { proxyWebRequest } from "../src/lib/workspace/gateway.ts";

const SECRET = "test-turnstile-secret-value-for-unit-tests";

function request(path, body, headers = {}) {
  const url = new URL("https://belgobase.com/api/web/" + path);
  return {
    nextUrl: url,
    method: "POST",
    headers: new Headers({
      origin: url.origin,
      "content-type": "application/json",
      ...headers,
    }),
    cookies: { getAll: () => [] },
    body: new Response(JSON.stringify(body)).body,
  };
}

test("missing secret fails closed in production and bypasses elsewhere", async () => {
  resetTurnstileReplayGuardForTests();
  const production = await verifyTurnstileToken({
    token: "any-token-value-here",
    action: TURNSTILE_ACTIONS.contact,
    secret: "",
    nodeEnv: "production",
  });
  assert.deepEqual(production, { ok: false, reason: "not_configured" });

  const development = await verifyTurnstileToken({
    token: undefined,
    action: TURNSTILE_ACTIONS.contact,
    secret: "",
    nodeEnv: "development",
  });
  assert.deepEqual(development, { ok: true, bypassed: true });
});

test("missing, invalid, action, hostname, timeout, and replay are rejected", async () => {
  resetTurnstileReplayGuardForTests();

  const missing = await verifyTurnstileToken({
    token: "   ",
    action: TURNSTILE_ACTIONS.login,
    secret: SECRET,
    nodeEnv: "production",
  });
  assert.deepEqual(missing, { ok: false, reason: "missing_token" });

  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), body: String(options.body) });
    return Response.json({ success: false, "error-codes": ["invalid-input-response"] });
  };
  const invalid = await verifyTurnstileToken({
    token: "token-one-abcdefghijklmnopqrstuvwxyz",
    action: TURNSTILE_ACTIONS.login,
    secret: SECRET,
    fetchImpl,
    nodeEnv: "production",
  });
  assert.deepEqual(invalid, { ok: false, reason: "invalid_token" });
  assert.match(calls[0].url, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
  assert.match(calls[0].body, /secret=test-turnstile-secret-value-for-unit-tests/);
  assert.match(calls[0].body, /response=token-one/);

  resetTurnstileReplayGuardForTests();
  const actionMismatch = await verifyTurnstileToken({
    token: "token-two-abcdefghijklmnopqrstuvwxyz",
    action: TURNSTILE_ACTIONS.login,
    secret: SECRET,
    fetchImpl: async () =>
      Response.json({
        success: true,
        action: "contact",
        hostname: "www.belgobase.com",
      }),
    nodeEnv: "production",
  });
  assert.deepEqual(actionMismatch, { ok: false, reason: "action_mismatch" });

  resetTurnstileReplayGuardForTests();
  const hostnameMismatch = await verifyTurnstileToken({
    token: "token-three-abcdefghijklmnopqrstuvwxyz",
    action: TURNSTILE_ACTIONS.enrollment,
    secret: SECRET,
    fetchImpl: async () =>
      Response.json({
        success: true,
        action: "enrollment",
        hostname: "evil.example",
      }),
    nodeEnv: "production",
  });
  assert.deepEqual(hostnameMismatch, { ok: false, reason: "hostname_mismatch" });

  resetTurnstileReplayGuardForTests();
  const timeout = await verifyTurnstileToken({
    token: "token-four-abcdefghijklmnopqrstuvwxyz",
    action: TURNSTILE_ACTIONS.contact,
    secret: SECRET,
    fetchImpl: async () => {
      const error = new Error("Aborted");
      error.name = "TimeoutError";
      throw error;
    },
    nodeEnv: "production",
  });
  assert.deepEqual(timeout, { ok: false, reason: "timeout" });

  resetTurnstileReplayGuardForTests();
  const token = "token-five-abcdefghijklmnopqrstuvwxyz";
  const ok = await verifyTurnstileToken({
    token,
    action: TURNSTILE_ACTIONS.contact,
    secret: SECRET,
    fetchImpl: async () =>
      Response.json({
        success: true,
        action: "contact",
        hostname: "belgobase.com",
      }),
    nodeEnv: "production",
  });
  assert.deepEqual(ok, { ok: true });

  const replay = await verifyTurnstileToken({
    token,
    action: TURNSTILE_ACTIONS.contact,
    secret: SECRET,
    fetchImpl: async () => {
      throw new Error("should not call provider on replay");
    },
    nodeEnv: "production",
  });
  assert.deepEqual(replay, { ok: false, reason: "replay" });
});

test("expected hostnames include the canonical site and local defaults", () => {
  const hosts = expectedTurnstileHostnames("https://preview.belgobase.com");
  assert.equal(hosts.has("preview.belgobase.com"), true);
  assert.equal(hosts.has("www.belgobase.com"), true);
  assert.equal(hosts.has("localhost"), true);
});

test("CSP allows Cloudflare Turnstile on public and workspace shell pages", () => {
  for (const headers of [
    publicPageSecurityHeaders(TEST_NONCE),
    workspaceShellSecurityHeaders(TEST_NONCE),
  ]) {
    const csp = headers["Content-Security-Policy"];
    assert.match(csp, /https:\/\/challenges\.cloudflare\.com/);
    assert.match(csp, /script-src[^;]*https:\/\/challenges\.cloudflare\.com/);
    assert.match(csp, /script-src[^;]*'nonce-/);
    assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
    assert.match(csp, /frame-src[^;]*https:\/\/challenges\.cloudflare\.com/);
    assert.match(csp, /connect-src[^;]*https:\/\/challenges\.cloudflare\.com/);
  }
});

test("gateway rejects auth start without a valid Turnstile token when configured", async () => {
  resetTurnstileReplayGuardForTests();
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;
  const originalFetch = globalThis.fetch;
  const calls = [];
  process.env.TURNSTILE_SECRET_KEY = SECRET;
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    if (String(url).includes("siteverify")) {
      return Response.json({ success: false, "error-codes": ["invalid-input-response"] });
    }
    return Response.json({ ok: true, challenge_id: "should-not-reach" });
  };
  try {
    const denied = await proxyWebRequest(
      request("auth/start", { email: "qa@example.test", language: "en" }),
      ["auth", "start"],
    );
    assert.equal(denied.status, 403);
    const body = await denied.json();
    assert.equal(body.error, "captcha_failed");
    assert.equal(calls.some((url) => url.includes("api.belgobase.be")), false);

    resetTurnstileReplayGuardForTests();
    globalThis.fetch = async (url, options) => {
      calls.push(String(url));
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          action: "login",
          hostname: "belgobase.com",
        });
      }
      return Response.json({ ok: true, challenge_id: "opaque_challenge" });
    };
    const allowed = await proxyWebRequest(
      request("auth/start", {
        email: "qa@example.test",
        language: "en",
        turnstile_token: "token-six-abcdefghijklmnopqrstuvwxyz",
      }),
      ["auth", "start"],
    );
    assert.equal(allowed.status, 200);
    assert.equal(calls.some((url) => url.includes("api.belgobase.be/web/auth/login")), true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalSecret;
    resetTurnstileReplayGuardForTests();
  }
});
