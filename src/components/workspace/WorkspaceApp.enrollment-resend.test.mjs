import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("./WorkspaceApp.tsx", import.meta.url), "utf8");
const handler = source.slice(source.indexOf("async function resendEnrollmentCode"), source.indexOf("async function verifyEnrollment"));
function harness(ok) {
  const state = { challenge: "existing-owned-challenge", code: "123456", error: "", busy: false };
  const calls = [];
  const context = vm.createContext({ busy: false, resendIn: 0, challengeId: state.challenge, licenseCode: " synthetic-license ", email: " example@example.invalid ", remember: true, shellLanguage: "fr",
    setBusy(value) { state.busy = value; }, setError(value) { state.error = value; },
    setChallengeId(value) { state.challenge = value; }, setCode(value) { state.code = value; },
    setSessionRetryAvailable() {}, setResendIn(value) { state.resendIn = value; },
    request: async (path, body) => { calls.push({ path, body }); return { response: { ok }, result: ok ? { ok: true, challenge_id: "existing-owned-challenge" } : { ok: false, error: "rate_limited" } }; },
  });
  const invoke = vm.runInContext(handler + "\nresendEnrollmentCode", context);
  return { state, calls, invoke };
}
test("resend uses the existing challenge and updates code state only on success", async () => {
  const h = harness(true); await h.invoke();
  assert.equal(h.calls[0].path, "/api/web/enrollment/start");
  assert.equal(h.calls[0].body.challenge_id, "existing-owned-challenge");
  assert.equal(h.calls[0].body.email, "example@example.invalid");
  assert.equal(h.state.challenge, "existing-owned-challenge");
  assert.equal(h.state.code, ""); assert.equal(h.state.resendIn, 30); assert.equal(h.state.busy, false);
});
test("a failed resend preserves the previous challenge and usable code", async () => {
  const h = harness(false); await h.invoke();
  assert.equal(h.calls[0].body.challenge_id, "existing-owned-challenge");
  assert.equal(h.state.challenge, "existing-owned-challenge");
  assert.equal(h.state.code, "123456"); assert.equal(h.state.error, "rate_limited"); assert.equal(h.state.busy, false);
});
