import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('./WorkspaceApp.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('WorkspaceApp.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const app = tree.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === 'WorkspaceApp');
const selected = ['loadBrowserSessions', 'loadAccountReferences', 'logout', 'revokeBrowser', 'copyReference', 'downloadDesktop'];
const declarations = ['downloadLock', 'accountReadGeneration', 'browserLoadGeneration', 'referenceLoadGeneration', 'sessionLoadGeneration', 'accountSessionKey', 'invalidateAccountReads', 'acceptSession', 'loadSession'];
const statements = app.body.statements.filter(s =>
  ts.isFunctionDeclaration(s) && selected.includes(s.name?.text) ||
  ts.isVariableStatement(s) && s.declarationList.declarations.some(d => declarations.includes(d.name.getText(tree))) ||
  ts.isExpressionStatement(s) && s.getText(tree).includes('const checkSession ='));
const js = ts.transpileModule(statements.map(s => s.getText(tree)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function response(status, body) { return { ok: status >= 200 && status < 300, status, json: async () => body }; }
function harness({ deferredLogout = false } = {}) {
  const state = { phase: 'workspace', references: {}, browserSessions: [], account: { name: 'synthetic A' } };
  const refs = [], sessions = [], callbacks = [], copies = [], links = [];
  const context = {
    useRef: value => ({ current: value }), useCallback: fn => fn,
    useEffect: callback => callback(), phase: 'workspace', shellLanguage: 'nl', t: { expired: 'own expired', revokeConfirm: 'Own revoke', copiedReference: 'Copied {label}', copyFailed: 'Failed {label}' },
    validSessionProjection: value => value.authenticated === true && typeof value.csrf === 'string',
    sessionPollOutcome: (status, value) => status === 401 || value.authenticated === false ? 'signedOut' : 'unchanged',
    window: { confirm: () => true, setInterval: fn => { callbacks.push(fn); return 1; }, clearInterval() {}, addEventListener() {}, removeEventListener() {} },
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, body: { append() {} }, createElement: () => ({ click() { links.push(this.href); }, remove() {} }) },
    navigator: { clipboard: { writeText: () => { const task = deferred(); copies.push(task); return task.promise; } } },
    desktopDownloadHref: value => value, URL,
    csrf: 'synthetic-test-token', accountReferences: value => ({ customerNumber: value.customer?.customer_number }),
    json: async res => res.json(), clearEnrollment() {},
    request: async path => { if (path.endsWith('/logout') && !deferredLogout) return { response: response(200, {}), result: {} }; const task = deferred(); refs.push(task); return task.promise; },
    fetch: () => { const task = deferred(); sessions.push(task); return task.promise; },
  };
  for (const key of ['AccountBusy','AccountReferenceBusy','BrowserSessions','BrowserSessionsError','References','CopyFeedback','Error','Account','Csrf','AccountOpen','Phase','LicenseCode','ChallengeId','Code','DownloadError','DownloadBusy','Busy','AccountReferenceError','SessionRetryAvailable']) {
    const name = key[0].toLowerCase() + key.slice(1); context['set' + key] = value => { state[name] = value; };
  }
  vm.createContext(context); vm.runInContext(js + '\nthis.handlers = {loadBrowserSessions,loadAccountReferences,logout,acceptSession,loadSession,revokeBrowser,copyReference,downloadDesktop};', context);
  return { state, refs, sessions, copies, links, checkSession: callbacks[0], ...context.handlers };
}
const reference = number => ({ response: response(200, {}), result: { ok: true, customer: { customer_number: number } } });
test('a late former-account reference cannot overwrite the new account', async () => {
  const h = harness(), old = h.loadAccountReferences(); await h.logout(); h.state.phase = 'workspace';
  const next = h.loadAccountReferences(); h.refs[1].resolve(reference('own B')); await next;
  h.refs[0].resolve(reference('former A')); await old;
  assert.equal(h.state.references.customerNumber, 'own B');
});
test('a late former-account 401 cannot sign the new account out', async () => {
  const h = harness(), old = h.loadBrowserSessions(); await h.logout(); h.state.phase = 'workspace';
  const next = h.loadBrowserSessions(); h.sessions[1].resolve(response(200, { ok: true, sessions: [{ browser_id: 'own B' }] })); await next;
  h.sessions[0].resolve(response(401, {})); await old;
  assert.equal(h.state.phase, 'workspace'); assert.equal(h.state.browserSessions[0].browser_id, 'own B');
});
test('logout invalidates a late 401 even before the new panel is opened', async () => {
  const h = harness(), old = h.loadBrowserSessions(); await h.logout(); h.state.phase = 'workspace';
  h.sessions[0].resolve(response(401, {})); await old;
  assert.equal(h.state.phase, 'workspace'); assert.equal(h.state.accountBusy, false);
});
test('a current browser-list failure stays explicit and a next read recovers', async () => {
  const h = harness(), failed = h.loadBrowserSessions(); h.sessions[0].reject(new Error('own current failure')); await failed;
  assert.equal(h.state.browserSessionsError, true); assert.equal(h.state.accountBusy, false);
  const next = h.loadBrowserSessions(); h.sessions[1].resolve(response(200, { ok: true, sessions: [] })); await next;
  assert.equal(h.state.browserSessionsError, false); assert.equal(h.state.accountBusy, false);
});
test('an old failed read cannot finish or fail the current pending read', async () => {
  const h = harness(), old = h.loadAccountReferences(); await h.logout(); h.state.phase = 'workspace';
  const next = h.loadAccountReferences(); h.refs[0].reject(new Error('own delayed transport failure')); await old;
  assert.equal(h.state.accountReferenceBusy, true); assert.equal(h.state.accountReferenceError, false);
  h.refs[1].resolve(reference('own B')); await next; assert.equal(h.state.accountReferenceBusy, false);
});
test('a changed session for the same email invalidates old reads before a new pane opens', async () => {
  const h = harness();
  h.acceptSession({ authenticated: true, csrf: 'own session A', account: { email: 'shared@example.invalid' } });
  h.state.accountOpen = true; const old = h.loadAccountReferences(), sessions = h.loadBrowserSessions();
  h.acceptSession({ authenticated: true, csrf: 'own session B', account: { email: 'shared@example.invalid' } });
  assert.equal(h.state.accountOpen, false); assert.equal(Object.keys(h.state.references).length, 0);
  assert.equal(h.state.accountBusy, false); assert.equal(h.state.accountReferenceBusy, false);
  h.refs[0].resolve(reference('former A')); h.sessions[0].resolve(response(401, {})); await Promise.all([old, sessions]);
  assert.equal(h.state.phase, 'workspace'); assert.equal(Object.keys(h.state.references).length, 0);
  const next = h.loadAccountReferences(); h.refs[1].resolve(reference('own B')); await next;
  assert.equal(h.state.references.customerNumber, 'own B');
});
test('an unchanged session projection does not cancel a current read', async () => {
  const h = harness(), session = { authenticated: true, csrf: 'own unchanged session', account: { email: 'same@example.invalid' } };
  h.acceptSession(session); const current = h.loadAccountReferences(); h.acceptSession(session);
  h.refs[0].resolve(reference('current')); await current;
  assert.equal(h.state.references.customerNumber, 'current');
});
test('a former session poll cannot restore account A after explicit logout and login B', async () => {
  const h = harness(); h.acceptSession({ authenticated: true, csrf: 'own A', account: { email: 'shared@example.invalid' } });
  const old = h.checkSession(); await h.logout();
  h.acceptSession({ authenticated: true, csrf: 'own B', account: { email: 'shared@example.invalid' } });
  h.sessions[0].resolve(response(200, { authenticated: true, csrf: 'own A', account: { email: 'shared@example.invalid' } })); await old;
  assert.equal(h.state.csrf, 'own B');
});
test('the newest same-account panel read wins, and current failure can recover', async () => {
  const h = harness(), old = h.loadAccountReferences(), newer = h.loadAccountReferences();
  h.refs[1].resolve(reference('newest')); await newer; h.refs[0].resolve(reference('older')); await old;
  assert.equal(h.state.references.customerNumber, 'newest');
  const failure = h.loadAccountReferences(); h.refs[2].reject(new Error('own current failure')); await failure;
  assert.equal(h.state.accountReferenceError, true); assert.equal(h.state.accountReferenceBusy, false);
  const recovery = h.loadAccountReferences(); h.refs[3].resolve(reference('recovered')); await recovery;
  assert.equal(h.state.references.customerNumber, 'recovered'); assert.equal(h.state.accountReferenceError, false);
});
const ownSession = name => ({ authenticated: true, csrf: 'own ' + name, account: { email: name + '@example.invalid' } });
for (const [label, result] of [['authenticated A', response(200, ownSession('A'))], ['old 401', response(401, {})]]) {
  test('an old initial session response cannot replace B: ' + label, async () => {
    const h = harness(); h.acceptSession(ownSession('A')); const old = h.loadSession();
    await h.logout(); h.acceptSession(ownSession('B')); h.state.phase = 'workspace';
    h.sessions[0].resolve(result); await old;
    assert.equal(h.state.csrf, 'own B'); assert.equal(h.state.phase, 'workspace');
  });
}
test('an old initial session network failure is ignored after switching account', async () => {
  const h = harness(), old = h.loadSession(); await h.logout(); h.acceptSession(ownSession('B'));
  h.sessions[0].reject(new Error('own former network failure')); await assert.doesNotReject(old);
});
for (const [label, result] of [['401', { response: response(401, {}), result: {} }], ['current revoked', { response: response(200, {}), result: { ok: true, current_session_revoked: true } }]]) {
  test('a late revocation result cannot sign B out: ' + label, async () => {
    const h = harness(); h.acceptSession(ownSession('A')); const old = h.revokeBrowser({ browser_id: 'own A', current: true });
    await h.logout(); h.acceptSession(ownSession('B')); h.state.phase = 'workspace';
    const current = h.loadBrowserSessions(); h.refs[0].resolve(result); await old;
    assert.equal(h.state.csrf, 'own B'); assert.equal(h.state.phase, 'workspace'); assert.equal(h.state.accountBusy, true);
    h.sessions[0].resolve(response(200, { ok: true, sessions: [] })); await current;
  });
}
test('a late revocation transport failure cannot overwrite B or finish its read', async () => {
  const h = harness(), old = h.revokeBrowser({ browser_id: 'own A' }); await h.logout(); h.acceptSession(ownSession('B'));
  const current = h.loadBrowserSessions(); h.refs[0].reject(new Error('own former revoke failure')); await old;
  assert.equal(h.state.error, ''); assert.equal(h.state.accountBusy, true);
  h.sessions[0].resolve(response(200, { ok: true, sessions: [] })); await current;
});
test('a clipboard completion from account A cannot show feedback in account B', async () => {
  const h = harness(), old = h.copyReference('Own reference', 'own A'); await h.logout(); h.acceptSession(ownSession('B'));
  h.copies[0].resolve(); await old; assert.equal(h.state.copyFeedback, undefined);
});
test('an old desktop download response cannot start an A download or unlock B', async () => {
  const h = harness(), old = h.downloadDesktop(); await h.logout(); h.acceptSession(ownSession('B'));
  const current = h.downloadDesktop(); h.sessions[0].resolve(response(200, { ok: true, url: 'https://example.invalid/own-A.exe' })); await old;
  assert.equal(h.links.length, 0); assert.equal(h.state.downloadBusy, true);
  h.sessions[1].resolve(response(200, { ok: true, url: 'https://example.invalid/own-B.exe' })); await current;
  assert.equal(h.links[0], 'https://example.invalid/own-B.exe'); assert.equal(h.state.downloadBusy, false);
});
test('a delayed logout response cannot clear a newly accepted account', async () => {
  const h = harness({ deferredLogout: true }); h.acceptSession(ownSession('A')); const old = h.logout();
  h.acceptSession(ownSession('B'));
  h.refs[0].resolve({ response: response(200, {}), result: {} }); await old;
  assert.equal(h.state.csrf, 'own B'); assert.equal(h.state.phase, 'workspace'); assert.equal(h.state.busy, false);
});
test('a former logout cannot release the pending logout of the new account', async () => {
  const h = harness({ deferredLogout: true }); h.acceptSession(ownSession('A')); const old = h.logout();
  h.acceptSession(ownSession('B')); const current = h.logout();
  h.refs[0].resolve({ response: response(200, {}), result: {} }); await old;
  assert.equal(h.state.csrf, 'own B'); assert.equal(h.state.busy, true);
  h.refs[1].resolve({ response: response(200, {}), result: {} }); await current;
  assert.equal(h.state.phase, 'login'); assert.equal(h.state.busy, false);
});
test('the newest initial session read wins over an older authenticated response', async () => {
  const h = harness(), older = h.loadSession(), newest = h.loadSession();
  h.sessions[1].resolve(response(200, ownSession('B'))); await newest;
  h.sessions[0].resolve(response(200, ownSession('A'))); await older; assert.equal(h.state.csrf, 'own B');
});
test('a current initial session error is still reported and a retry recovers', async () => {
  const h = harness(), failure = h.loadSession(); h.sessions[0].reject(new Error('own current failure'));
  await assert.rejects(failure); const retry = h.loadSession(); h.sessions[1].resolve(response(200, ownSession('B'))); await retry;
  assert.equal(h.state.phase, 'workspace'); assert.equal(h.state.csrf, 'own B');
});
test('a current own-browser revocation still signs out and releases busy state', async () => {
  const h = harness(), current = h.revokeBrowser({ browser_id: 'own current', current: true });
  h.refs[0].resolve({ response: response(200, {}), result: { ok: true, current_session_revoked: true } }); await current;
  assert.equal(h.state.phase, 'login'); assert.equal(h.state.accountBusy, false);
});
