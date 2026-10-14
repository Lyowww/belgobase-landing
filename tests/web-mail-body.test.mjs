import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateKeyPairSync, sign } from 'node:crypto';
import ts from 'typescript';
import * as gateway from '../src/lib/workspace/gateway.ts';
import { verifyLoginMail, loginMailContent } from '../src/lib/workspace/mail-relay.ts';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const fixturePublicKey = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

function handler({ key = 'inert-fixture', providerError = false, providerThrow = false } = {}) {
  const calls = [], verifications = [];
  class InertResend {
    emails = { send: async (...args) => {
      calls.push(args);
      if (providerThrow) throw new Error('inert failure');
      return { error: providerError ? { message: 'inert failure' } : null };
    } };
  }
  const dependencies = {
    resend: { Resend: InertResend },
    '@/lib/email/resend': { resolveFromEmail: () => 'fixture@example.test' },
    '@/lib/workspace/mail-relay': { loginMailContent, verifyLoginMail: (...args) => {
      verifications.push(Buffer.byteLength(args[0], 'utf8'));
      return verifyLoginMail(...args);
    } },
    '@/lib/workspace/mail-relay-public-key': { mailRelayPublicKey: fixturePublicKey },
    '@/lib/workspace/gateway': gateway,
  };
  const source = fs.readFileSync(new URL('../src/app/api/web/mail/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const require = id => {
    assert.ok(Object.hasOwn(dependencies, id), 'Unexpected dependency must not reach a real provider');
    return dependencies[id];
  };
  new Function('require', 'module', 'exports', 'process', compiled)(require, module, module.exports, { env: { RESEND_API_KEY: key } });
  return { post: module.exports.POST, calls, verifications };
}

function streamRequest(bytes, { declared, signature = '', chunk = 1024, error = false } = {}) {
  let offset = 0, supplied = 0, cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      if (error) { controller.error(new Error('inert read failure')); return; }
      if (offset === bytes.length) { controller.close(); return; }
      const next = bytes.slice(offset, Math.min(offset + chunk, bytes.length));
      offset += next.length; supplied += next.length; controller.enqueue(next);
    },
    cancel() { cancelled = true; },
  });
  const headers = new Headers();
  if (declared !== undefined) headers.set('content-length', declared);
  if (signature) headers.set('x-belgobase-mail-signature', signature);
  const request = new Request('https://example.test/api/web/mail', { method: 'POST', headers, body, duplex: 'half' });
  return { request, supplied: () => supplied, cancelled: () => cancelled, body };
}

function signedFixture(language = 'nl') {
  const issued_at = Math.floor(Date.now() / 1000);
  const mail = { purpose: 'belgobase-login-v1', email: 'qa@example.test', code: '123456',
    challenge_id: 'inert_challenge_1234', issued_at, expires_at: issued_at + 600, language };
  const raw = JSON.stringify(mail);
  return { mail, bytes: new TextEncoder().encode(raw), signature: sign(null, Buffer.from(raw), privateKey).toString('base64') };
}

test('mail bounds actual streamed bytes before verification with missing, false and malformed length', async () => {
  for (const declared of [undefined, '1', 'bad']) {
    const fixture = streamRequest(new Uint8Array(16384), { declared });
    const h = handler();
    const response = await h.post(fixture.request);
    assert.equal(response.status, 413);
    assert.equal(fixture.cancelled(), true);
    assert.ok(fixture.supplied() < 16384, 'Must stop before consuming the complete oversized stream');
    assert.equal(fixture.body.locked, false);
    assert.deepEqual(h.verifications, []);
    assert.deepEqual(h.calls, []);
  }
});

test('mail preserves the header fast rejection and rejects a huge first chunk without verification', async () => {
  for (const settings of [{ declared: '16384' }, { chunk: 131072 }]) {
    const fixture = streamRequest(new Uint8Array(131072), settings);
    const h = handler();
    assert.equal((await h.post(fixture.request)).status, 413);
    assert.deepEqual(h.verifications, []);
    assert.deepEqual(h.calls, []);
  }
});

test('4096 actual bytes reach signature verification; 4097 and multibyte UTF8 exceed the byte bound', async () => {
  for (const bytes of [new Uint8Array(4096), new Uint8Array(4097), new TextEncoder().encode('é'.repeat(4097))]) {
    const fixture = streamRequest(bytes, { chunk: 513 });
    const h = handler();
    assert.equal((await h.post(fixture.request)).status, bytes.length === 4096 ? 403 : 413);
    assert.deepEqual(h.verifications, bytes.length === 4096 ? [4096] : []);
    assert.deepEqual(h.calls, []);
  }
});

test('body read failure is rejected without verification or provider use', async () => {
  const fixture = streamRequest(new Uint8Array(), { error: true });
  const h = handler();
  assert.equal((await h.post(fixture.request)).status, 400);
  assert.equal(fixture.body.locked, false);
  assert.deepEqual(h.verifications, []);
  assert.deepEqual(h.calls, []);
});

test('legitimate ephemeral signed fixtures retain exact verification, language and idempotency without real mail', async () => {
  for (const language of ['nl', 'fr', 'en']) {
    const { mail, bytes, signature } = signedFixture(language);
    const h = handler();
    const response = await h.post(streamRequest(bytes, { signature, chunk: 7 }).request);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0][0].to, mail.email);
    assert.deepEqual(h.calls[0][1], { idempotencyKey: 'belgobase-login/' + mail.challenge_id });
    assert.deepEqual(h.calls[0][0], { from: 'fixture@example.test', to: mail.email, ...loginMailContent(mail) });
  }
  const { bytes, signature } = signedFixture();
  const withBom = new Uint8Array(bytes.length + 3);
  withBom.set([239, 187, 191]); withBom.set(bytes, 3);
  assert.equal((await handler().post(streamRequest(withBom, { signature, chunk: 1 }).request)).status, 200);
});

test('existing missing-key and provider failure responses stay 503 using inert dependencies', async () => {
  const { bytes, signature } = signedFixture();
  for (const options of [{ key: '' }, { providerError: true }, { providerThrow: true }]) {
    const h = handler(options);
    assert.equal((await h.post(streamRequest(bytes, { signature }).request)).status, 503);
    assert.equal(h.calls.length, options.key === '' ? 0 : 1);
  }
});

test('shared reader keeps the existing 8MiB default and releases its lock on excess', async () => {
  const limit = 8 * 1024 * 1024;
  for (const length of [limit, limit + 1]) {
    const fixture = streamRequest(new Uint8Array(length), { chunk: 65536 });
    if (length === limit) assert.equal((await gateway.boundedBody(fixture.request)).byteLength, limit);
    else { await assert.rejects(gateway.boundedBody(fixture.request), RangeError); assert.equal(fixture.cancelled(), true); }
    assert.equal(fixture.body.locked, false);
  }
});

