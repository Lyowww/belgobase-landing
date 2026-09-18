import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyLoginMail, loginMailContent } from '../src/lib/workspace/mail-relay.ts';
import { isAllowedRoute, proxyWebRequest, backendUrl } from '../src/lib/workspace/gateway.ts';

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
  assert.match(loginMailContent(message).text,/123456/);
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

test('first use claims a licence; later sign-in needs only the registered email',async()=>{
  const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push([String(url),JSON.parse(new TextDecoder().decode(options.body))]);return Response.json({ok:true,challenge_id:'opaque_challenge'});};
  try {
    await proxyWebRequest(request('auth/start',{email:'qa@example.test',license_code:'TEST-NOT-A-REAL-LICENCE',remember:true}),['auth','start']);
    await proxyWebRequest(request('auth/start',{email:'qa@example.test',remember:false}),['auth','start']);
    assert.equal(calls[0][0],'https://api.belgobase.be/web/auth/claim');
    assert.equal(calls[0][1].remember_browser,true);
    assert.equal(calls[1][0],'https://api.belgobase.be/web/auth/login');
    assert.equal('license_code' in calls[1][1],false);
  } finally {globalThis.fetch=original;}
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
