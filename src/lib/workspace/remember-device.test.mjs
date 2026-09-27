import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync(new URL('../../components/workspace/WorkspaceApp.tsx',import.meta.url),'utf8');
const loginFunction=source.slice(source.indexOf('  async function sendLoginCode()'),source.indexOf('  async function startLogin('));
const projection=source.slice(source.indexOf('export function validSessionProjection'),source.indexOf('export function retryLocksCodeInput'));
async function start(result,status=200){
  const state={phase:'login',calls:0};
  const context={Error,email:' test@example.test ',remember:true,shellLanguage:'nl',request:async(path,body)=>{
    state.calls++;assert.equal(path,'/api/web/auth/start');assert.equal(body.email,'test@example.test');
    return {response:{ok:status>=200&&status<300},result};
  }};
  for(const key of ['Busy','Error','Account','Csrf','ChallengeId','Code','SessionRetryAvailable','ResendIn','Phase'])context['set'+key]=value=>{state[key[0].toLowerCase()+key.slice(1)]=value;};
  vm.createContext(context);
  const code=ts.transpileModule(projection.replace('export ', '')+loginFunction+'\nthis.run=sendLoginCode;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  vm.runInContext(code,context);await context.run();return state;
}
test('recognized device opens workspace directly without a second request or code phase',async()=>{
  const result={ok:true,authenticated:true,csrf:'a'.repeat(32),account:{email:'test@example.test'}};
  const state=await start(result);assert.equal(state.phase,'workspace');assert.equal(state.calls,1);assert.equal(state.csrf,result.csrf);assert.equal(state.challengeId,'');assert.equal(state.busy,false);
});
test('new or unrecognized device keeps the email code route',async()=>{
  const state=await start({ok:true,challenge_id:'test-challenge'},202);assert.equal(state.phase,'loginCode');assert.equal(state.resendIn,30);assert.equal(state.challengeId,'test-challenge');
});
test('malformed trusted response and backend refusal never grant local access',async()=>{
  for(const [result,status] of [[{ok:true,authenticated:true,csrf:''},200],[{ok:false,error:'license_inactive'},403]]){
    const state=await start(result,status);assert.equal(state.phase,'login');assert.ok(state.error);assert.equal(state.busy,false);assert.equal(state.calls,1);
  }
});

const gatewaySource=fs.readFileSync(new URL('./gateway.ts',import.meta.url),'utf8');
function gateway(fetch){
  const exports={};const context={exports,Headers,Response,URL,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortSignal,process:{env:{NODE_ENV:'production'}},fetch};
  vm.createContext(context);vm.runInContext(ts.transpileModule(gatewaySource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);return exports;
}
function request(origin='https://www.belgobase.com'){
  const value=new Request('https://www.belgobase.com/api/web/auth/start',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'test@example.test',remember:true})});
  value.nextUrl=new URL(value.url);value.cookies={getAll:()=>[{name:'__Host-bb_trust',value:'opaque-test-token'},{name:'unrelated',value:'do-not-forward'}]};return value;
}
test('gateway forwards only allowed cookies and preserves two distinct host cookies',async()=>{
  let calls=0;
  const api=gateway(async(url,options)=>{
    calls++;assert.equal(url.pathname,'/web/auth/login');assert.equal(options.headers.get('Cookie'),'__Host-bb_trust=opaque-test-token');
    assert.equal(JSON.parse(new TextDecoder().decode(options.body)).remember_browser,true);
    const headers=new Headers({'content-type':'application/json'});
    headers.append('Set-Cookie','__Host-belgobase_session=session-test; Path=/; HttpOnly; Secure; SameSite=Lax');
    headers.append('Set-Cookie','__Host-bb_trust=rotated-test; Path=/; HttpOnly; Secure; SameSite=Lax');
    headers.append('Set-Cookie','unexpected=no; Path=/');
    headers.append('Set-Cookie','__Host-bb_trust=bad-domain; Domain=example.test; Path=/');
    return new Response('{}',{headers});
  });
  const response=await api.proxyWebRequest(request(),['auth','start']);assert.equal(calls,1);assert.equal(response.headers.getSetCookie().length,2);assert.match(response.headers.getSetCookie()[1],/^__Host-bb_trust=rotated-test;/);
});
test('cross-origin login never reaches the trusted-device endpoint',async()=>{
  const api=gateway(()=>{throw Error('must not call backend');});const response=await api.proxyWebRequest(request('https://evil.example'),['auth','start']);assert.equal(response.status,403);
});
