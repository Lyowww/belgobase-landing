import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, sign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { verifyLoginMail, loginMailContent } from '../src/lib/workspace/mail-relay.ts';
import {
  isAllowedRoute,
  proxyWebRequest,
  backendUrl,
  readBoundedBytes,
  MAX_BRIDGE_RESPONSE_BYTES,
  MAX_IDENTITY_RESPONSE_BYTES,
} from '../src/lib/workspace/gateway.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function captureConsoleErrors(run) {
  const lines = [];
  const original = console.error;
  console.error = (...args) => { lines.push(args.map(String).join(' ')); };
  return Promise.resolve()
    .then(run)
    .finally(() => { console.error = original; })
    .then((result) => ({ result, lines }));
}

test('login mail requires the server signature, correct purpose and a fresh challenge', () => {
  const {privateKey, publicKey}=generateKeyPairSync('ed25519');
  const key=publicKey.export({type:'spki',format:'der'}).toString('base64');
  const now=1800000000;
  const message={purpose:'belgobase-login-v1',email:'qa@example.test',code:'123456',challenge_id:'example_challenge_1234',issued_at:now,expires_at:now+600,language:'nl'};
  const raw=JSON.stringify(message), signature=sign(null,Buffer.from(raw),privateKey).toString('base64');
  assert.deepEqual(verifyLoginMail(raw,signature,key,now),message);
  assert.equal(verifyLoginMail(raw.replace('123456','654321'),signature,key,now),null);
  assert.equal(verifyLoginMail(raw,signature,key,now+61),null);
  assert.equal(verifyLoginMail(raw,signature,'',now),null);
  const wrong=JSON.stringify({...message,purpose:'other-purpose'});
  assert.equal(verifyLoginMail(wrong,sign(null,Buffer.from(wrong),privateKey).toString('base64'),key,now),null);
  const invalidLanguage=JSON.stringify({...message,language:'de'});
  assert.equal(verifyLoginMail(invalidLanguage,sign(null,Buffer.from(invalidLanguage),privateKey).toString('base64'),key,now),null);
  const localized={nl:/vervalt binnen 10 minuten/,fr:/expire dans 10 minutes/,en:/expires in 10 minutes/};
  for (const [language, expected] of Object.entries(localized)) {
    const content=loginMailContent({...message,language});
    assert.match(content.text,/123456/);
    assert.match(content.text,expected);
  }
});

function request(path,body,headers={}) {
  const url=new URL('https://belgobase.com/api/web/'+path);
  return {nextUrl:url,method:'POST',headers:new Headers({origin:url.origin,'content-type':'application/json',...headers}),
    cookies:{getAll:()=>[{name:'__Host-belgobase_session',value:'opaque_session'},{name:'unrelated',value:'private_other_app'}]},
    body:new Response(JSON.stringify(body)).body};
}

test('gateway routes only known functions and never arbitrary URLs or admin methods', () => {
  assert.equal(isAllowedRoute(['bridge','search'],'POST'),true);
  assert.equal(isAllowedRoute(['bridge','ai_wallet'],'POST'),true);
  assert.equal(isAllowedRoute(['bridge','set_language'],'POST'),true);
  assert.equal(isAllowedRoute(['bridge','admin_topup'],'POST'),false);
  assert.equal(isAllowedRoute(['https://elsewhere.test'],'POST'),false);
  assert.equal(isAllowedRoute(['auth','session'],'POST'),false);
  assert.equal(isAllowedRoute(['enrollment','legal','preflight_id','terms-v1'],'GET'),true);
  assert.equal(isAllowedRoute(['enrollment','legal','preflight_id','../secret'],'GET'),false);
  assert.equal(backendUrl('bridge').href,'https://api.belgobase.be/web/bridge');
});

test('gateway preserves filters and forwards only the dedicated cookie and CSRF',async()=>{
  const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url:String(url),options});return Response.json({ok:true,count:12},{headers:{'set-cookie':'foreign=ignore; Domain=example.test','cache-control':'public'}});};
  try {
    const filters={kbo_postcode:Array.from({length:5000},(_,i)=>String(1000+i)).join(',')};
    const response=await proxyWebRequest(request('bridge/search',{filters},{'x-belgobase-csrf':'1234567890abcdefghijklmnop','authorization':'Bearer never-forward'}),['bridge','search']);
    assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
    assert.equal(response.headers.get('set-cookie'),null);
    assert.equal(calls[0].url,'https://api.belgobase.be/web/bridge');
    assert.deepEqual(JSON.parse(new TextDecoder().decode(calls[0].options.body)),{method:'search',payload:{filters}});
    assert.equal(calls[0].options.headers.get('authorization'),null);
    assert.equal(calls[0].options.headers.get('cookie'),'__Host-belgobase_session=opaque_session');
    assert.equal(calls[0].options.headers.get('x-belgobase-csrf'),'1234567890abcdefghijklmnop');
    const denied=await proxyWebRequest(request('auth/start',{email:'qa@example.test'},{origin:'https://attacker.test'}),['auth','start']);
    assert.equal(denied.status,403);assert.equal(calls.length,1);
  } finally {globalThis.fetch=original;}
});

test('auth and enrollment starts forward a validated mail language',async()=>{
  const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push([String(url),JSON.parse(new TextDecoder().decode(options.body))]);return Response.json({ok:true,challenge_id:'opaque_challenge'});};
  try {
    await proxyWebRequest(request('auth/start',{email:'qa@example.test',license_code:'TEST-NOT-A-REAL-LICENCE',remember:true,language:'fr'}),['auth','start']);
    await proxyWebRequest(request('auth/start',{email:'qa@example.test',remember:false,language:'en'}),['auth','start']);
    await proxyWebRequest(request('enrollment/start',{email:'qa@example.test',license_code:'TEST-NOT-A-REAL-LICENCE',remember_browser:false,language:'de',source:'attacker',customer_id:'other-tenant'}),['enrollment','start']);
    assert.equal(calls[0][0],'https://api.belgobase.be/web/auth/claim');
    assert.equal(calls[0][1].remember_browser,true);
    assert.equal(calls[0][1].language,'fr');
    assert.equal(calls[1][0],'https://api.belgobase.be/web/auth/login');
    assert.equal('license_code' in calls[1][1],false);
    assert.equal(calls[1][1].language,'en');
    assert.equal(calls[2][0],'https://api.belgobase.be/web/enrollment/start');
    assert.deepEqual(calls[2][1], {
      email: 'qa@example.test',
      license_code: 'TEST-NOT-A-REAL-LICENCE',
      remember_browser: false,
      language: 'nl',
    });
  } finally {globalThis.fetch=original;}
});

test('bounded reads stop when a body exceeds its limit', async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(3000));
      controller.enqueue(new Uint8Array(3000));
      controller.close();
    },
  });
  await assert.rejects(() => readBoundedBytes(stream, 4096), RangeError);
  const small = new ReadableStream({
    start(controller) {
      controller.enqueue(Uint8Array.from([65, 66]));
      controller.close();
    },
  });
  assert.deepEqual(await readBoundedBytes(small, 4096), Uint8Array.from([65, 66]));
  assert.equal((await readBoundedBytes(null, 4096)).byteLength, 0);
});

test('enrollment completion retains both session issuance and enrollment-cookie clearing',async()=>{
  const original=globalThis.fetch; const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push([String(url),options]);
    const headers=new Headers();
    headers.append('Set-Cookie','__Host-belgobase_session=new_session; Secure; HttpOnly; Path=/; SameSite=Lax');
    headers.append('Set-Cookie','__Host-belgobase_enrollment=; Secure; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
    return Response.json({ok:true,authenticated:true},{headers});
  };
  try {
    const req=request('enrollment/complete',{company_type:'business'});
    req.cookies.getAll=()=>[{name:'__Host-belgobase_enrollment',value:'enrollment_only'}];
    const response=await proxyWebRequest(req,['enrollment','complete']);
    assert.equal(calls[0][0],'https://api.belgobase.be/web/enrollment/complete');
    assert.equal(calls[0][1].headers.get('cookie'),'__Host-belgobase_enrollment=enrollment_only');
    assert.equal(response.headers.getSetCookie().length,2);
    assert.match(response.headers.getSetCookie()[1],/Max-Age=0/);
    assert.equal(isAllowedRoute(['enrollment','session'],'GET'),true);
    assert.equal(isAllowedRoute(['enrollment','complete'],'GET'),false);
  } finally {globalThis.fetch=original;}
});

test('browser responses omit server identity and bridge calls cannot set it', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: options.body ? JSON.parse(new TextDecoder().decode(options.body)) : null });
    if (String(url).endsWith('/auth/session')) {
      return Response.json({
        ok: true,
        authenticated: true,
        account: { email: 'owner@example.test' },
        csrf: 'csrf-token-value',
        auth_context: { license_id: 'lic-secret', customer_id: 'tenant-secret', rights: { exports: true } },
      });
    }
    return Response.json({ ok: true });
  };
  try {
    const session = await proxyWebRequest({
      nextUrl: new URL('https://belgobase.com/api/web/auth/session'),
      method: 'GET',
      headers: new Headers(),
      cookies: { getAll: () => [{ name: '__Host-belgobase_session', value: 'opaque_session' }] },
      body: null,
    }, ['auth', 'session']);
    const revealed = await session.json();
    assert.equal(revealed.authenticated, true);
    assert.equal(revealed.csrf, 'csrf-token-value');
    assert.equal('auth_context' in revealed, false);
    assert.equal(JSON.stringify(revealed).includes('lic-secret'), false);
    await proxyWebRequest(request('bridge/search', {
      filters: { postcode: '1000' },
      license_id: 'other-licence',
      customer_id: 'other-tenant',
      rights: { exports: true },
    }), ['bridge', 'search']);
    assert.deepEqual(calls.at(-1).body, {
      method: 'search',
      payload: { filters: { postcode: '1000' } },
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('gateway sanitizes internal bridge error text before it reaches the browser', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    ok: false,
    error: 'Traceback (most recent call last):\n  File "/Users/ops/app/backend/web_core.py", line 42, in lookup\nKeyError: secret_table',
  });
  try {
    const response = await proxyWebRequest(
      request('bridge/company', { number: '0123456789' }, { 'x-belgobase-csrf': '1234567890abcdefghijklmnop' }),
      ['bridge', 'company'],
    );
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, 'temporarily_unavailable');
    assert.doesNotMatch(JSON.stringify(body), /Traceback|web_core\.py|secret_table|\/Users\//);
  } finally {
    globalThis.fetch = original;
  }
});

test('gateway keeps curated product bridge errors for the UI', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    ok: false,
    error: 'Selecteer eerst bedrijven.',
  });
  try {
    const response = await proxyWebRequest(
      request('bridge/export_results', { numbers: [] }, { 'x-belgobase-csrf': '1234567890abcdefghijklmnop' }),
      ['bridge', 'export_results'],
    );
    assert.deepEqual(await response.json(), { ok: false, error: 'Selecteer eerst bedrijven.' });
  } finally {
    globalThis.fetch = original;
  }
});

test('gateway accepts successful bridge JSON larger than the identity sanitization limit', async () => {
  assert.ok(MAX_BRIDGE_RESPONSE_BYTES > MAX_IDENTITY_RESPONSE_BYTES);
  const brandLogo = `data:image/png;base64,${'A'.repeat(MAX_IDENTITY_RESPONSE_BYTES)}`;
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    ok: true,
    version: 'BelgoBase web',
    brand_logo: brandLogo,
    workspace: { lists: [], searches: [] },
  });
  try {
    const response = await proxyWebRequest(
      request('bridge/bootstrap', {}, { 'x-belgobase-csrf': '1234567890abcdefghijklmnop' }),
      ['bridge', 'bootstrap'],
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.brand_logo, brandLogo);
    assert.ok(JSON.stringify(body).length > MAX_IDENTITY_RESPONSE_BYTES);
  } finally {
    globalThis.fetch = original;
  }
});

test('gateway accepts production-sized bootstrap JSON around 1.9 MiB through sanitization', async () => {
  assert.equal(MAX_BRIDGE_RESPONSE_BYTES, 4 * 1024 * 1024);
  const oneMiB = 1 * 1024 * 1024;
  const productionBytes = 1_888_418;
  const logo = readFileSync(join(repoRoot, 'backend/workspace_assets/belgobase_bb_logo.png'));
  const meta = JSON.parse(readFileSync(join(repoRoot, 'backend/workspace_assets/workspace_metadata.json'), 'utf8'));
  const bootstrap = {
    ok: true,
    version: 'BelgoBase web',
    brand_logo: `data:image/png;base64,${logo.toString('base64')}`,
    sectors: meta.catalogs?.sectors ?? [],
    legal_forms: meta.catalogs?.legal_forms ?? [],
    workspace: { lists: [], searches: [] },
    filter_labels: meta.filter_labels ?? {},
    result_column_options: meta.column_groups?.result_columns ?? [],
    catalog_padding: '',
  };
  let encoded = JSON.stringify(bootstrap);
  const pad = Math.max(0, productionBytes - Buffer.byteLength(encoded));
  bootstrap.catalog_padding = 'P'.repeat(pad);
  encoded = JSON.stringify(bootstrap);
  assert.ok(Buffer.byteLength(encoded) > oneMiB, 'fixture must exceed the former 1 MiB limit');
  assert.ok(Buffer.byteLength(encoded) >= productionBytes - 32);
  assert.ok(Buffer.byteLength(encoded) < MAX_BRIDGE_RESPONSE_BYTES);
  assert.ok(Buffer.byteLength(encoded) < 2 * 1024 * 1024, 'fixture stays around the observed ~1.9 MiB production size');

  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(encoded, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(Buffer.byteLength(encoded)),
    },
  });
  try {
    const response = await proxyWebRequest(
      request('bridge/bootstrap', {}, { 'x-belgobase-csrf': '1234567890abcdefghijklmnop' }),
      ['bridge', 'bootstrap'],
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.version, 'BelgoBase web');
    assert.equal(body.brand_logo, bootstrap.brand_logo);
    assert.equal(body.catalog_padding.length, pad);
    assert.equal(Array.isArray(body.sectors), true);
    assert.equal('auth_context' in body, false);
  } finally {
    globalThis.fetch = original;
  }
});

test('gateway rejects bridge JSON that exceeds the 4 MiB bridge response sanitization limit', async () => {
  assert.equal(MAX_BRIDGE_RESPONSE_BYTES, 4 * 1024 * 1024);
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      ok: true,
      brand_logo: `data:image/png;base64,${'B'.repeat(MAX_BRIDGE_RESPONSE_BYTES)}`,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
  try {
    const response = await proxyWebRequest(
      request('bridge/bootstrap', {}, { 'x-belgobase-csrf': '1234567890abcdefghijklmnop' }),
      ['bridge', 'bootstrap'],
    );
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: 'BelgoBase heeft niet op tijd geantwoord. Controleer de huidige status voordat je de actie opnieuw uitvoert.',
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('gateway keeps the tighter identity-route response sanitization limit', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      ok: true,
      authenticated: true,
      padding: 'C'.repeat(MAX_IDENTITY_RESPONSE_BYTES),
      auth_context: { license_id: 'lic-secret' },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
  try {
    const response = await proxyWebRequest({
      nextUrl: new URL('https://belgobase.com/api/web/auth/session'),
      method: 'GET',
      headers: new Headers(),
      cookies: { getAll: () => [{ name: '__Host-belgobase_session', value: 'opaque_session' }] },
      body: null,
    }, ['auth', 'session']);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: 'BelgoBase heeft niet op tijd geantwoord. Controleer de huidige status voordat je de actie opnieuw uitvoert.',
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('gateway sanitizes a realistic logo-bearing bootstrap payload under the bridge limit', async () => {
  const logo = readFileSync(join(repoRoot, 'backend/workspace_assets/belgobase_bb_logo.png'));
  const meta = JSON.parse(readFileSync(join(repoRoot, 'backend/workspace_assets/workspace_metadata.json'), 'utf8'));
  const brandLogo = `data:image/png;base64,${logo.toString('base64')}`;
  const bootstrap = {
    ok: true,
    version: 'BelgoBase web',
    brand_logo: brandLogo,
    sectors: meta.catalogs?.sectors ?? [],
    legal_forms: meta.catalogs?.legal_forms ?? [],
    workspace: { lists: [], searches: [] },
    filter_labels: meta.filter_labels ?? {},
    result_column_options: meta.column_groups?.result_columns ?? [],
  };
  const encoded = JSON.stringify(bootstrap);
  assert.ok(encoded.length > MAX_IDENTITY_RESPONSE_BYTES);
  assert.ok(encoded.length < MAX_BRIDGE_RESPONSE_BYTES);
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(encoded, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(Buffer.byteLength(encoded)),
    },
  });
  try {
    const response = await proxyWebRequest(
      request('bridge/bootstrap', {}, { 'x-belgobase-csrf': '1234567890abcdefghijklmnop' }),
      ['bridge', 'bootstrap'],
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.brand_logo, brandLogo);
    assert.equal(body.sectors.length, bootstrap.sectors.length);
  } finally {
    globalThis.fetch = original;
  }
});

test('gateway logs safe diagnostics when bridge body exceeds the sanitization limit', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      ok: true,
      brand_logo: `data:image/png;base64,${'B'.repeat(MAX_BRIDGE_RESPONSE_BYTES)}`,
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-length': String(MAX_BRIDGE_RESPONSE_BYTES + 64),
      },
    },
  );
  try {
    const { result: response, lines } = await captureConsoleErrors(() => proxyWebRequest(
      request('bridge/bootstrap', {}, { 'x-belgobase-csrf': '1234567890abcdefghijklmnop' }),
      ['bridge', 'bootstrap'],
    ));
    assert.equal(response.status, 502);
    const joined = lines.join('\n');
    assert.match(joined, /\[gateway\]/);
    assert.match(joined, /route=bridge\/bootstrap/);
    assert.match(joined, /upstream_status=200/);
    assert.match(joined, /content_type=application\/json/);
    assert.match(joined, /content_length=\d+/);
    assert.match(joined, /reason=body_limit/);
    assert.match(joined, /error_name=RangeError/);
    assert.match(joined, new RegExp(`sanitize_limit=${MAX_BRIDGE_RESPONSE_BYTES}`));
    assert.doesNotMatch(joined, /brand_logo|Bearer|Cookie|__Host-|opaque_session|abcdefghijklmnop/);
  } finally {
    globalThis.fetch = original;
  }
});

test('gateway logs safe diagnostics for invalid bridge JSON and non-object payloads', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('{"ok":true,', {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-length': '11' },
    });
    const parseCase = await captureConsoleErrors(() => proxyWebRequest(
      request('bridge/bootstrap', {}, { 'x-belgobase-csrf': '1234567890abcdefghijklmnop' }),
      ['bridge', 'bootstrap'],
    ));
    assert.equal(parseCase.result.status, 502);
    assert.match(parseCase.lines.join('\n'), /reason=json_parse/);
    assert.match(parseCase.lines.join('\n'), /error_name=SyntaxError/);
    assert.match(parseCase.lines.join('\n'), /upstream_status=200/);

    globalThis.fetch = async () => new Response(JSON.stringify(['not', 'an', 'object']), {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-length': '20' },
    });
    const shapeCase = await captureConsoleErrors(() => proxyWebRequest(
      request('bridge/bootstrap', {}, { 'x-belgobase-csrf': '1234567890abcdefghijklmnop' }),
      ['bridge', 'bootstrap'],
    ));
    assert.equal(shapeCase.result.status, 502);
    assert.match(shapeCase.lines.join('\n'), /reason=non_object_json/);
    assert.match(shapeCase.lines.join('\n'), /upstream_status=200/);
  } finally {
    globalThis.fetch = original;
  }
});

test('gateway forwards upstream 502 and logs status without response bodies', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json(
    { ok: false, error: 'Selecteer eerst bedrijven.', secret_token: 'should-not-be-logged' },
    { status: 502, headers: { 'content-type': 'application/json', 'content-length': '80' } },
  );
  try {
    const { result: response, lines } = await captureConsoleErrors(() => proxyWebRequest(
      request('bridge/bootstrap', {}, { 'x-belgobase-csrf': '1234567890abcdefghijklmnop' }),
      ['bridge', 'bootstrap'],
    ));
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, 'Selecteer eerst bedrijven.');
    const joined = lines.join('\n');
    assert.match(joined, /reason=forward_upstream_status/);
    assert.match(joined, /upstream_status=502/);
    assert.match(joined, /route=bridge\/bootstrap/);
    assert.doesNotMatch(joined, /should-not-be-logged|Selecteer eerst bedrijven/);
  } finally {
    globalThis.fetch = original;
  }
});
