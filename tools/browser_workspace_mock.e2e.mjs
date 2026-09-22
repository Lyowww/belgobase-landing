/*
 * Real-browser proof for the Next web shell. It intentionally uses a local
 * HTTP mock: no real license, mail provider, customer data or VPS is touched.
 *
 * Run from the worktree with:
 *   pnpm exec next build
 *   node tools/browser_workspace_mock.e2e.mjs
 */
import assert from "node:assert/strict";
import { auditPublicSite } from './public_site_flows.mjs';
import { auditAccountFinal } from './account_final_flows.mjs';
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPort = 3107;
const mockPort = 4191;
const appOrigin = `http://localhost:${appPort}`;
const mockOrigin = `https://127.0.0.1:${mockPort}`;
const artifactDirectory = path.join(root, "tools", "test-artifacts");
const screenshotPath = path.join(artifactDirectory, "browser-workspace-mock.png");
const enrollmentScreenshotPath = path.join(artifactDirectory, "browser-enrollment-mock.png");
const documentScreenshotPath = path.join(artifactDirectory, "browser-enrollment-document-mock.png");
const runtimeNodeModules = "C:/Users/David1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const chromiumExecutable = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const runtimeRequire = createRequire(path.join(runtimeNodeModules, "playwright", "package.json"));
const { chromium } = runtimeRequire("playwright");

const metadata = JSON.parse(await readFile(path.join(root,"backend/workspace_assets/workspace_metadata.json"),"utf8"));
// Mirror the core schema enrichment; backend regression verifies its source contract.
metadata.filter_schema.fields.find(f=>f.key==="regions").options=[{value:"vlaanderen",label:"Vlaanderen"},{value:"wallonie",label:"Wallonië"},{value:"brussel",label:"Brussel"}];
const resultColumnOptions = JSON.parse(await readFile(path.join(root,"tools/fixtures/result-column-options.json"),"utf8"));
assert.equal(resultColumnOptions.length,60,"the production output contract offers 60 visible columns");
const state = {
  bridgeCalls: [],
  workspaceRevision: 0,
  unhandledMethods: [],
  claimCalls: [],
  loginCalls: [],
  enrollmentCalls: [],
  enrollmentComplete: undefined,
  logoutCsrf: "",
  versionCalls: 0,
  requests: [],
  appLog: [],
  expireNextBridge: false,
  expireNextDocument: false,
  wallet: {currency:"EUR",balance_eur:0,available_eur:0,reserved_eur:0,spent_eur:0,entries:[]},
  walletUnavailable: false,
  failNextSearch: false,
  history: [],
  workspace: { lists: [], searches: [], active_list_id: null, result_columns: ["name", "city", "revenue", "profit", "fte", "year"] },
};
const csrf = "mock-csrf-token-0123456789";
const sessionCookie = "belgobase_session=mock-browser-session";
const enrollmentCookie = "belgobase_enrollment=mock-browser-enrollment";
const logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLkNwAAAABJRU5ErkJggg==";

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (part) => { raw += part; });
    request.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); }
    });
  });
}

function json(response, status, body, headers = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(body));
}

function hasSession(request) {
  return request.headers.cookie?.includes(sessionCookie) === true;
}

function hasEnrollment(request) {
  return request.headers.cookie?.includes(enrollmentCookie) === true;
}

function enrollmentAutofill() {
  return {
    ok: true,
    company: { company_type: "business", enterprise_number: "0123456789", legal_name: "Voorbeeld Bouw BV", address: { street: "Voorbeeldstraat", house_number: "1", postal_code: "9000", municipality: "Gent" } },
    legal: {
      documents: [
        { document_id: "terms-v1", title: "Algemene voorwaarden B2B", role: "contractual_terms", version: "1.1", view_url: "/api/web/enrollment/legal/mock-preflight-id/terms-v1", sha256: "a".repeat(64) },
        { document_id: "use-v1", title: "Gebruiksvoorwaarden", role: "acceptable_use_terms", version: "1.1", view_url: "/api/web/enrollment/legal/mock-preflight-id/use-v1", sha256: "b".repeat(64) },
        { document_id: "privacy-v1", title: "Privacyverklaring", role: "privacy_notice", version: "1.1", view_url: "/api/web/enrollment/legal/mock-preflight-id/privacy-v1", sha256: "c".repeat(64) },
      ],
      authority_declaration: { text: "Ik ben bevoegd deze onderneming te vertegenwoordigen." },
      choice_texts: {
        general_terms: "Ik aanvaard de algemene voorwaarden B2B.",
        usage_terms: "Ik aanvaard de gebruiksvoorwaarden.",
        privacy_notice: "Ik heb de privacyverklaring gelezen.",
      },
    },
    preflight_id: "mock-preflight-id",
    preflight_fingerprint: "mock-preflight-fingerprint",
  };
}

function bootstrap() {
  return {
    ok: true,
    account: { name: "Mock BelgoBase" },
    brand_logo: logo,
    version: "Mock web 1.0",
    workspace_revision: state.workspaceRevision,
    result_column_options: resultColumnOptions,
    sectors: [{ value: "56", label: "Horeca" }],
    legal_forms: [{ value: "BV", label: "Besloten vennootschap" }],
    statuses: [{ value: "", label: "Alle statussen" }, { value: "AC", label: "Actief" }],
    saved: [],
    workspace: state.workspace,
    filter_labels: {}, enum_labels: {}, activity_labels_by_version: { "2025": {} },
  };
}

function company() {
  return {
    ok: true,
    company: { number: "0123456789", name: "Voorbeeld Bouw BV", city: "Gent", postcode: "9000", nace: "41201", status: "AC", legal_form: "BV", revenue: 1250000, profit: 145000, fte: 12, year: 2024, values: {straat_nl:"Voorbeeldstraat",balanstotaal:510000} },
    fields: [{ label: "Adres", value: "Voorbeeldstraat 1, 9000 Gent" }, { label: "Activiteit", value: "Algemene bouwwerken" }],
    metrics: [{ key: "revenue", label: "Omzet", value: 1250000, unit: "€", year: 2024, note: "reported" }, { key: "profit", label: "Resultaat", value: 145000, unit: "€", year: 2024, note: "reported" }, { key: "fte", label: "Personeel", value: 12, unit: "VTE", year: 2024, note: "reported" }],
    history: { years: [2023, 2024], series: { revenue: [980000, 1250000], profit: [100000, 145000], fte: [10, 12], assets: [400000, 510000] }, label: "Financi\u00eble evolutie", note: "Mock bronjaren." },
    financial: [{ label: "Omzet", value: 1250000, year: 2024, status: "reported", source: "Mock bron", explanation: "" }],
  };
}

const tlsDirectory = await mkdtemp(path.join(os.tmpdir(), "belgobase-browser-tls-"));
execFileSync(process.env.PYTHON || "C:/Users/David1/AppData/Local/Programs/Python/Python313/python.exe", [path.join(root,"tools/mock_tls.py"),tlsDirectory], {windowsHide:true});
const mock = https.createServer({key:await readFile(path.join(tlsDirectory,"key.pem")),cert:await readFile(path.join(tlsDirectory,"cert.pem"))}, async (request, response) => {
  const url = new URL(request.url || "/", mockOrigin);
  state.requests.push(`${request.method} ${url.pathname}`);
  try {
    if (url.pathname === "/version" && request.method === "GET") {
      state.versionCalls += 1;
      return json(response, 200, { ok: true, version: "Mock web 1.0", latest: true });
    }
    if (url.pathname === "/auth/sessions" && request.method === "GET") {
      return hasSession(request) ? json(response, 200, { ok: true, sessions: [{browser_id:"test-browser", label:"Testbrowser", current:true, last_seen_at:"2026-09-18T17:00:00Z"}] }) : json(response, 401, {ok:false});
    }
    if (url.pathname === "/auth/session" && request.method === "GET") {
      if (state.rawSession !== undefined) {
        response.writeHead(200,{"content-type":"application/json"});response.end(state.rawSession);return;
      }
      return hasSession(request)
        ? json(response, 200, { ok: true, authenticated: true, account: { name: "Mock BelgoBase", email: "owner@example.test" }, csrf })
        : json(response, 401, { ok: false, error: "session_invalid" });
    }
    if (url.pathname === "/enrollment/start" && request.method === "POST") {
      const body = await readBody(request);
      state.enrollmentCalls.push({ method: "start", body });
      return json(response, 202, { ok: true, delivery: "if_license_available", challenge_id: "enrollment-otp" });
    }
    if (url.pathname === "/enrollment/verify" && request.method === "POST") {
      const body = await readBody(request);
      state.enrollmentCalls.push({ method: "verify", body });
      if (body.code !== "123456") return json(response, 400, { ok: false, error: "code_invalid" });
      return json(response, 200, { ok: true, enrollment_verified: true, next: "profile", email: "new@example.test", csrf }, { "set-cookie": enrollmentCookie + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600" });
    }
    if (url.pathname === "/enrollment/autofill" && request.method === "POST") {
      const body = await readBody(request);
      state.enrollmentCalls.push({ method: "autofill", body, csrf: request.headers["x-belgobase-csrf"] });
      if (!hasEnrollment(request) || request.headers["x-belgobase-csrf"] !== csrf) return json(response, 401, { ok: false, error: "enrollment_invalid" });
      if (body.enterprise_number !== "0123456789") return json(response, 404, { ok: false, error: "company_not_found" });
      return json(response, 200, enrollmentAutofill());
    }
    if (url.pathname.startsWith("/enrollment/legal/mock-preflight-id/") && request.method === "GET") {
      const documentId = url.pathname.split("/").at(-1);
      if (state.expireNextDocument) {
        state.expireNextDocument = false;
        return json(response, 401, { ok: false, error: "enrollment_expired" });
      }
      const document = enrollmentAutofill().legal.documents.find((item) => item.document_id === documentId);
      if (!hasEnrollment(request)) return json(response, 401, { ok: false, error: "enrollment_invalid" });
      if (!document) return json(response, 404, { ok: false, error: "document_not_found" });
      return json(response, 200, { ok: true, title: document.title, text: "Mock juridische tekst voor " + document.title + ".", sha256: document.sha256 }, { "cache-control": "no-store" });
    }
    if (url.pathname === "/enrollment/complete" && request.method === "POST") {
      const body = await readBody(request);
      state.enrollmentCalls.push({ method: "complete", body, csrf: request.headers["x-belgobase-csrf"] });
      if (!hasEnrollment(request) || request.headers["x-belgobase-csrf"] !== csrf) return json(response, 401, { ok: false, error: "enrollment_invalid" });
      state.enrollmentComplete = body;
      if (!Object.values(body.declarations || {}).every(Boolean)) return json(response, 400, { ok: false, error: "legal_acceptance_invalid" });
      return json(response, 200, { ok: true, authenticated: true, account: { name: "New Mock BelgoBase", email: "new@example.test" }, csrf }, { "set-cookie": [sessionCookie + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600", "belgobase_enrollment=; Path=/; HttpOnly; Max-Age=0"] });
    }
    if ((url.pathname === "/auth/claim" || url.pathname === "/auth/login") && request.method === "POST") {
      const body = await readBody(request);
      (url.pathname === "/auth/claim" ? state.claimCalls : state.loginCalls).push(body);
      return json(response, 202, { ok: true, challenge_id: url.pathname === "/auth/claim" ? "claim-otp" : "login-otp" });
    }
    if (url.pathname === "/auth/verify" && request.method === "POST") {
      const body = await readBody(request);
      if (body.code !== "123456") return json(response, 400, { ok: false, error: "otp_invalid" });
      return json(response, 200, { ok: true }, { "set-cookie": `${sessionCookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600` });
    }
    if (url.pathname === "/auth/logout" && request.method === "POST") {
      state.logoutCsrf = String(request.headers["x-belgobase-csrf"] || "");
      if (state.logoutCsrf !== csrf) return json(response, 403, { ok: false, error: "csrf_invalid" });
      return json(response, 200, { ok: true }, { "set-cookie": "belgobase_session=; Path=/; HttpOnly; Max-Age=0" });
    }
    if (url.pathname === "/bridge" && request.method === "POST") {
      if (state.expireNextBridge) {
        state.expireNextBridge = false;
        return json(response, 401, { ok: false, error: "session_expired" });
      }
      if (!hasSession(request) || request.headers["x-belgobase-csrf"] !== csrf) return json(response, 401, { ok: false, error: "session_invalid" });
      const body = await readBody(request);
      state.bridgeCalls.push(body);
      if (body.method === "bootstrap") return json(response, 200, bootstrap());
      if (body.method === "ai_wallet") return state.walletUnavailable?json(response,503,{ok:false,error:"temporarily_unavailable"}):json(response,200,{ok:true,wallet:state.wallet});
      if (body.method === "account_action" && body.payload.action === "refresh") return json(response,200,{ok:true,rows:[{label:"Klantnummer",value:"KL-MOCK-001"},{label:"Licentie-ID",value:"LIC-MOCK-001"},{label:"Onderneming",value:"Mock BelgoBase"}],documents:[]});
      if (body.method === "ai_usage") return json(response,200,{ok:true,usage:{mode:"server",wallet:state.wallet}});
      if (body.method === "cancel_operation") return json(response,200,{ok:true,cancelled:true});
      if (body.method === "ai" && state.aiGate) await state.aiGate;
      if (body.method === "ai") {
        const p=body.payload, uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
        const allowed=new Set(['contract','action','request_id','session_id','text','current_filters','current_regions','current_preferences','reset','codes','assistant','choice_id','language']);
        assert.equal(p.contract,'belgobase-premium-v1','AI must use the real server contract');
        assert.ok(uuid.test(p.request_id),'AI requests require unique UUID identity');
        assert.ok(Object.keys(p).every(key=>allowed.has(key)),'UI-only fields must not leak to AI service');
        assert.equal(p.assistant,true); assert.ok(['nl','fr','en'].includes(p.language));
        state.aiRequestIds??=new Set(); assert.ok(!state.aiRequestIds.has(p.request_id),'no automatic duplicate paid call');state.aiRequestIds.add(p.request_id);
        if(p.action==='ask'){
          assert.equal(typeof p.text,'string');assert.equal(typeof p.current_filters,'object');
          assert.ok(Array.isArray(p.current_regions));assert.ok(Array.isArray(p.current_preferences));
        } else if(p.action==='select') { assert.ok(Array.isArray(p.codes)); assert.ok(uuid.test(p.session_id)); }
        else if(p.action==='choose') { assert.equal(typeof p.choice_id,'string'); assert.ok(uuid.test(p.session_id)); }
        else assert.ok(['close','reset'].includes(p.action));
        if(state.aiFailureOnce){const failure=state.aiFailureOnce;state.aiFailureOnce=null;return json(response,failure.status,{ok:false,error:failure.code});}
        const session=p.session_id||'00000000-0000-4000-8000-000000000001';
        const proposal={contract:'belgobase-premium-v1',session_id:session,expires_in_seconds:900,
          filters:{},summary:[],question:'',choices:[],message:'',answer_context:{},activity_selection_complete:false,regions:[],preferences:[],wallet:state.wallet,
          ...(p.action==='select'?{status:'ready',assistant_message:'Ik stel bouwbedrijven in Gent voor.',filters:{kbo_postcode:'9000',nace_prefix:'41'},summary:['Bouwbedrijven in Gent'],activity_selection_complete:true}:{status:'clarify',assistant_message:'Welke activiteit bedoel je?',choices:[{value:'41',label:'Bouwbedrijven'}]})};
        return json(response,200,{ok:true,proposal});
      }
      if (body.method === "set_language") {
        if (!["nl", "fr", "en"].includes(body.payload.language)) return json(response, 400, { ok: false, error: "invalid_request" });
        return json(response, 200, { ok: true, language: body.payload.language });
      }
      if (body.method === "workspace_save") {state.workspace=structuredClone(body.payload.workspace);return json(response,200,{ok:true,workspace:state.workspace,workspace_revision:++state.workspaceRevision});}
      if (body.method === "workspace_data") return json(response,200,{ok:true,schema:metadata.filter_schema,filters:body.payload.filters||{},criteria:[],columns:metadata.column_groups.result_columns,selected:["name"]});
      if (body.method === "export_columns") return json(response,200,{ok:true,columns:metadata.column_groups.result_columns,selected:body.payload.columns||["name"]});
      if (body.method === "filters_apply") return json(response,200,{ok:true,filters:body.payload.filters});
      if (body.method === "xbrl_catalog") return json(response,200,{ok:true,metrics:[{key:"test_wages",label:"Bezoldigingen",value_type:"numeric",path:["Kosten","Personeel"],company_count:10}],total:1,offset:0,has_more:false});
      if (body.method === "similar_company") return json(response,200,{ok:true,company:company().company,criteria:[{key:'postcode',label:'Postcode',kind:'text',value:'9000',default_selected:true},{key:'nace_prefix',label:'Activiteit',kind:'text',value:'41',default_selected:true}]});
      if (body.method === "similar_apply") return json(response,200,{ok:true,filters:{...body.payload.filters,kbo_postcode:'9000',nace_prefix:'41'}});
      if (body.method === "search") {
        if(state.failNextSearch){state.failNextSearch=false;return json(response,503,{ok:false,error:"temporarily_unavailable"});}
        return json(response, 200, { ok: true, rows: [company().company], total: 1, page: 1, page_size: 50, filters: body.payload.filters || {} });
      }
      if (body.method === "company") return json(response, 200, company());
      if (["export_results","export_selection"].includes(body.method)) return json(response, 200, { ok: true, download_url: "/api/web/download/mock-download-token", rows: 1, total: 1, message: "1 bedrijf opgeslagen." });
      if (body.method === "operation_status") return json(response, 200, { ok: true });
      if (body.method === "search_history") {
        if(body.payload.action==='record'){
          state.history.unshift({id:String(state.bridgeCalls.length),...body.payload,saved_at:Math.floor(Date.now()/1000)});
          const signatures=new Set();state.history=state.history.filter(item=>{const signature=JSON.stringify([item.query,item.filters]);if(signatures.has(signature))return false;signatures.add(signature);return true;}).slice(0,50);
        }
        if(body.payload.action==='delete')state.history=state.history.filter(item=>item.id!==body.payload.id);
        if(body.payload.action==='clear'&&body.payload.confirmed)state.history=[];
        return json(response,200,{ok:true,history:state.history});
      }
      state.unhandledMethods.push(body.method);
      return json(response, 400, {ok:false,error:"Unhandled mock method"});
    }
    if (url.pathname === "/download/mock-download-token" && request.method === "GET") {
      response.writeHead(200, { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": "attachment; filename=BelgoBase_mock.xlsx" });
      return response.end(Buffer.from("mock-xlsx"));
    }
    return json(response, 404, { ok: false, error: "not_found" });
  } catch (error) {
    return json(response, 500, { ok: false, error: String(error) });
  }
});

function waitForServer(url, timeout = 40_000) {
  const deadline = Date.now() + timeout;
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const response = await fetch(url);
        if (response.status < 500) return resolve();
      } catch {}
      if (Date.now() >= deadline) return reject(new Error(`server did not start: ${url}`));
      setTimeout(attempt, 250);
    };
    void attempt();
  });
}

function stopProcess(child) {
  if (!child?.pid) return;
  try { execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" }); } catch {}
}

async function loadedWorkspaceFrame(page) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const frame = page.frames().find((item) => item.url().includes("/api/web/workspace"));
    if (frame) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error("authenticated workspace iframe did not load");
}

await mkdir(artifactDirectory, { recursive: true });
await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));
const app = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `pnpm.cmd exec next start -p ${appPort}`], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "production", BELGOBASE_WEB_BACKEND_URL: `${mockOrigin}/`, RESEND_API_KEY: "", NODE_EXTRA_CA_CERTS:path.join(tlsDirectory,"cert.pem"), NODE_OPTIONS:[process.env.NODE_OPTIONS||'',`--import=${pathToFileURL(path.join(root,'tools/browser_mock_network.mjs')).href}`].join(' ').trim() },
  stdio: "pipe",
  windowsHide: true,
});
app.stdout.on("data", (chunk) => state.appLog.push(String(chunk)));
app.stderr.on("data", (chunk) => state.appLog.push(String(chunk)));

let browser;
try {
  await waitForServer(`${appOrigin}/nl/app`);
  for(const [raw,status] of [['{"authenticated":"false"}',401],['null',401],['{bad-json',503]]) {
    state.rawSession=raw;
    for(const endpoint of ['/api/web/workspace','/api/web/desktop-download?format=json']){
      const response=await fetch(appOrigin+endpoint);
      assert.equal(response.status,status,'malformed session fails closed at '+endpoint);
      assert.equal((await response.json()).ok,false);
    }
  }
  delete state.rawSession;
  browser = await chromium.launch({ headless: true, executablePath: chromiumExecutable });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 960 } });
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    return ['localhost','127.0.0.1','[::1]'].includes(url.hostname)?route.continue():route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  const runtimeErrors=[];
  page.on('pageerror',error=>runtimeErrors.push(error.stack||error.message));
  const workspaceResponses = [];
  page.on("response", (response) => {
    if (response.url().endsWith("/api/web/workspace")) workspaceResponses.push(response);
  });
  await page.route('**/api/web/auth/session',route=>route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"error":"temporarily_unavailable"}'}));
  await page.goto(`${appOrigin}/nl/app`, { waitUntil: "networkidle" });
  await page.getByRole('heading',{name:'BelgoBase is tijdelijk niet bereikbaar'}).waitFor();
  assert.equal(await page.getByLabel('E-mailadres',{exact:true}).count(),0,'unknown session status does not invite another login');
  await page.unroute('**/api/web/auth/session');
  await page.getByRole('button',{name:'Opnieuw proberen'}).click();
  await page.getByLabel("E-mailadres", { exact: true }).waitFor();
  assert.equal((await page.request.get(appOrigin + "/api/web/desktop-download", { maxRedirects: 0 })).status(), 401, "desktop account download requires login");
  await page.getByLabel("E-mailadres", { exact: true }).fill("draft@example.test");
  await page.getByLabel("Taal / Language / Langue", { exact: true }).selectOption("fr");
  assert.equal(await page.getByLabel("Adresse e-mail", { exact: true }).inputValue(), "draft@example.test", "language switch retains form input");
  await page.getByLabel("Taal / Language / Langue", { exact: true }).selectOption("nl");

  await page.getByRole("button", { name: "Maak een account aan" }).click();
  for (const [language, label] of [["nl", "Toegang aanvragen"], ["fr", "Demander un accès"], ["en", "Request access"]]) {
    await page.getByRole("combobox", { name: "Taal / Language / Langue", exact: true }).selectOption(language);
    const requestLink = page.getByRole("link", { name: label, exact: true });
    const href = await requestLink.getAttribute("href");
    assert.ok(href.startsWith("mailto:david@belgobase.be?"), "license requests go to David in every language");
    assert.ok(new URL(href).searchParams.get("subject"), "request has a clear subject");
  }
  await page.getByRole("combobox", { name: "Taal / Language / Langue", exact: true }).selectOption("nl");
  const enrollmentEmail = page.getByLabel("E-mailadres", { exact: true });
  try {
    await enrollmentEmail.waitFor({ timeout: 10_000 });
  } catch (error) {
    await page.screenshot({ path: path.join(artifactDirectory, "browser-workspace-mock-failure.png"), fullPage: true });
    throw new Error(`login did not render: ${await page.locator("body").innerText()}; mock requests: ${state.requests.join(", ")}; app: ${state.appLog.join("")}`, { cause: error });
  }
  await enrollmentEmail.fill("new@example.test");
  await page.getByLabel("BelgoBase-licentiecode").fill("NEW-MOCK-LICENSE");
  await page.getByRole("button", { name: "Code per e-mail ontvangen" }).click();
  await page.getByLabel("Beveiligingscode").fill("123456");
  await page.getByRole("button", { name: "E-mailadres bevestigen" }).click();
  await page.getByRole("heading", { name: "Bevestig je bedrijfsgegevens" }).waitFor();
  assert.match(await page.locator("#enterprise-help").innerText(), /met of zonder BE/);
  await page.getByLabel("Ondernemingsnummer (KBO)").fill("BE 0123.456.789");
  await page.getByRole("button", { name: "Bedrijfsgegevens ophalen" }).click();
  await page.getByLabel("Wettelijke bedrijfsnaam").waitFor();
  assert.equal(await page.getByLabel("Wettelijke bedrijfsnaam").inputValue(), "Voorbeeld Bouw BV", "KBO autofill matches the verified company");
  assert.equal(await page.getByLabel("Wettelijke bedrijfsnaam").getAttribute("readonly"), "", "verified legal name cannot diverge from the signed snapshot");
  assert.equal(await page.getByText("Ik aanvaard de algemene voorwaarden B2B.").count(), 1, "server legal text is displayed");
  const legalButtons = page.getByRole("button", { name: "Lees document" });
  assert.equal(await legalButtons.count(), 3, "the three server document links are available");
  for (let index = 0; index < 3; index += 1) {
    await legalButtons.nth(index).click();
    await page.getByRole("dialog").getByText("Mock juridische tekst voor").waitFor();
    if (index === 0) await page.screenshot({ path: documentScreenshotPath, fullPage: true });
    if (index === 0) {
      assert.equal(await page.getByRole("dialog").getByRole("button", { name: "Sluiten" }).evaluate(el => el === document.activeElement), true, "legal dialog receives keyboard focus");
      await page.getByRole("dialog").press("Escape");
      assert.equal(await page.getByRole("dialog").count(), 0, "Escape closes the legal document");
    } else await page.getByRole("dialog").getByRole("button", { name: "Sluiten" }).click();
  }
  assert.equal(state.requests.filter((request) => request.startsWith("GET /enrollment/legal/mock-preflight-id/")).length, 3, "each displayed document uses its returned legal route");
  await page.screenshot({ path: enrollmentScreenshotPath, fullPage: true });
  state.expireNextDocument = true;
  await legalButtons.first().click();
  await page.getByRole("alert").getByText("Je inschrijving is niet meer geldig. Begin opnieuw.").waitFor();
  const missingDocument = await page.request.get(appOrigin + "/api/web/enrollment/legal/mock-preflight-id/missing");
  assert.equal(missingDocument.status(), 404, "a missing legal document remains a safe not-found response");
  const enrollmentChecks = page.locator("form").last().locator('input[type="checkbox"]');
  assert.equal(await enrollmentChecks.count(), 4, "all four deliberate legal declarations are required");
  for (let index = 0; index < 4; index += 1) await enrollmentChecks.nth(index).check();
  await page.getByLabel("Telefoonnummer voor ondersteuning (optioneel)").fill("0471 12 34 56");
  await page.getByLabel("Naam van de aanvaarder").fill("Nieuw Account");
  await page.getByLabel("Functie van de aanvaarder").fill("Bestuurder");
  await page.route("**/api/web/enrollment/complete", route => route.fulfill({status:409,contentType:"application/json",body:JSON.stringify({ok:false,error:"legal_preflight_expired"})}));
  await page.getByRole("button", { name: "Zakelijke inschrijving voltooien" }).click();
  await page.getByRole("alert").getByText("Deze controle is verlopen.", {exact:false}).waitFor();
  for (const [language, message] of [["fr", "Cette vérification a expiré."], ["en", "This check has expired."], ["nl", "Deze controle is verlopen."]]) {
    await page.getByLabel("Taal / Language / Langue", {exact:true}).selectOption(language);
    assert.ok((await page.locator('p[role="alert"]').innerText()).startsWith(message), "existing error follows current language");
  }
  await page.unroute("**/api/web/enrollment/complete");
  await page.getByRole("button", { name: "Bedrijfsgegevens ophalen" }).click();
  await page.getByLabel("Naam van de aanvaarder").waitFor();
  assert.equal(await page.getByLabel("Naam van de aanvaarder").inputValue(), "Nieuw Account");
  assert.equal(await page.getByLabel("Functie van de aanvaarder").inputValue(), "Bestuurder");
  for (let index = 0; index < 4; index += 1) {
    assert.equal(await enrollmentChecks.nth(index).isChecked(), false, "refreshed documents require fresh confirmation");
    await enrollmentChecks.nth(index).check();
  }
  await page.getByRole("button", { name: "Zakelijke inschrijving voltooien" }).click();
  await page.locator('iframe[title="BelgoBase workspace"]').waitFor();
  assert.equal(state.enrollmentCalls[0].body.remember_browser, true, "enrollment preserves the remember choice");
  assert.deepEqual(state.enrollmentComplete.declarations, { terms_accepted: true, usage_terms_accepted: true, privacy_acknowledged: true, authority_declared: true });
  assert.equal(state.enrollmentComplete.support_phone, "0471 12 34 56", "optional Belgian phone is submitted only during completion");
  assert.deepEqual(state.enrollmentComplete.choice_texts, enrollmentAutofill().legal.choice_texts, "server legal text is echoed unchanged");
  if (process.env.BELGOBASE_PHONE_ENROLLMENT_ONLY === "1") {
    const report = { ok: true, checkedAt: new Date().toISOString(), network: "loopback mocks only; synthetic enrollment", supportPhone: state.enrollmentComplete.support_phone };
    await writeFile(path.join(artifactDirectory, "phone-enrollment-proof.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
  if (process.env.BELGOBASE_PHONE_ENROLLMENT_ONLY !== "1") {
  await page.getByRole("button", { name: "Afmelden" }).click();
  await page.getByLabel("E-mailadres", { exact: true }).waitFor();
  const emailField = page.getByLabel("E-mailadres", { exact: true });
  await emailField.fill("owner@example.test");
  assert.equal(await page.getByLabel("Licentiecode (optioneel)").count(), 0, "login no longer asks for registration license");
  await page.getByRole("button", { name: "Code per e-mail ontvangen" }).click();
  const codeField = page.getByLabel("Beveiligingscode");
  try {
    await codeField.waitFor({ timeout: 10_000 });
  } catch (error) {
    throw new Error(`OTP did not render: ${await page.locator("body").innerText()}; mock requests: ${state.requests.join(", ")}; app: ${state.appLog.join("")}`, { cause: error });
  }
  await codeField.fill("000000");
  await page.getByRole("button", { name: "Aanmelden" }).click();
  await page.getByRole("alert").getByText("De code is ongeldig of verlopen.").waitFor();
  assert.equal(await page.locator('iframe').count(), 0, "invalid code gives no workspace");
  await codeField.fill("123456");
  await page.route('**/api/web/auth/session',route=>route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"error":"temporarily_unavailable"}'}));
  await page.getByRole("button", { name: "Aanmelden" }).click();
  await page.getByRole('button',{name:'Opnieuw proberen',exact:true}).waitFor();
  assert.equal(await codeField.isDisabled(),true,'verified code cannot be consumed again during session recovery');
  await page.unroute('**/api/web/auth/session');
  await page.getByRole('button',{name:'Opnieuw proberen',exact:true}).click();
  const iframe = page.locator('iframe[title="BelgoBase workspace"]');
  await iframe.waitFor();
  const frame = await loadedWorkspaceFrame(page);
  await frame.locator("#query").waitFor();
  await page.getByRole('button',{name:'Account',exact:true}).click();
  const accountPanel=page.getByRole('region',{name:'Account',exact:true});
  await accountPanel.getByText('KL-MOCK-001',{exact:true}).waitFor();
  await accountPanel.getByText('LIC-MOCK-001',{exact:true}).waitFor();
  await accountPanel.getByRole('button',{name:'Kopiëren',exact:true}).first().click();
  await accountPanel.getByRole('status').getByText('Klantnummer gekopieerd.').waitFor();
  await page.screenshot({path:path.join(artifactDirectory,'account-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'account panel fits mobile width');
  await page.screenshot({path:path.join(artifactDirectory,'account-mobile.png')});
  await page.setViewportSize({width:1440,height:960});
  await accountPanel.getByRole('button',{name:'Paneel sluiten'}).click();
  await frame.locator("#account-name").getByText("Mock BelgoBase").waitFor();
  assert.equal(state.claimCalls.length, 0, "registered customer signs in by verified email");
  assert.equal(state.loginCalls[0].remember_browser, true);
  assert.ok(state.bridgeCalls.some((call) => call.method === "bootstrap"), "frozen bootstrap reached the bridge");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByText("Testbrowser", { exact: false }).waitFor();
  const installerButton = page.getByRole("button", { name: "BelgoBase voor Windows downloaden" });
  await installerButton.click();
  await accountPanel.getByRole('alert').getByText('De Windows-download is tijdelijk niet beschikbaar.',{exact:false}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/nl/app','failed installer download never leaves the workspace');
  const fakeInstaller='https://api.belgobase.be/client-updates/download/BelgoBase_CloudClient_Setup_BUILD999_UPDATE999.exe';
  await page.route('**/api/web/desktop-download?*format=json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,url:fakeInstaller})}));
  await page.route(fakeInstaller,route=>route.fulfill({status:200,headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="BelgoBase_mock_installer.exe"'},body:'SYNTHETIC TEST FILE — NOT AN INSTALLER'}));
  const installerDownload=page.waitForEvent('download');
  await installerButton.click();
  assert.equal((await installerDownload).suggestedFilename(),'BelgoBase_mock_installer.exe','valid metadata starts browser download without fetching installer into JavaScript');
  assert.equal(new URL(page.url()).pathname,'/nl/app');
  await page.unroute('**/api/web/desktop-download?*format=json');
  await page.unroute(fakeInstaller);
  await page.getByText("Alleen voor Windows.", { exact: true }).waitFor();
  const installerResponse = await page.request.get(appOrigin + "/api/web/desktop-download", { maxRedirects: 0 });
  assert.equal(installerResponse.status(), 503,'local suite blocks production manifest access and download fails closed');
  assert.match((await installerResponse.json()).error,/Windows-download is tijdelijk niet beschikbaar/);
  await page.getByRole("button", { name: "Paneel sluiten", exact: true }).click();

  assert.equal(await iframe.getAttribute("allow"), "microphone");
  assert.match(await frame.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content"), /connect-src 'self'/);
  assert.match(workspaceResponses.at(-1).headers()["permissions-policy"] || "", /microphone=\(self\)/);
  const release = await frame.locator('meta[name="belgobase-release"]').getAttribute("content");
  assert.match(release || "", /^[a-f0-9]{64}$/);
  const versionResponse = await page.request.get(`${appOrigin}/api/web/version`);
  assert.equal((await versionResponse.json()).version, release, "the version endpoint matches the active iframe release");
  await frame.locator('[data-workspace="account"]').click();
  await frame.getByText("Saldo").waitFor();
  assert.ok(state.bridgeCalls.some((call) => call.method === "ai_wallet"), "wallet reads the server snapshot through the bridge");
  await frame.locator('[data-wallet-refresh]').waitFor({state:'visible'});
  await frame.locator('.wallet-primary strong').getByText('€ 0',{exact:true}).waitFor();
  state.wallet={currency:"EUR",balance_eur:10,available_eur:10,reserved_eur:0,spent_eur:0,entries:[{type:"topup",amount_eur:10,date:"2026-09-21"}]};
  await frame.locator('[data-wallet-refresh]').click();
  await frame.locator('.wallet-primary strong').getByText('€ 10',{exact:true}).waitFor();
  assert.equal(await frame.locator('#assistant-dock').count(),0,'AI side panel has been removed');
  state.walletUnavailable=true;
  await frame.locator('[data-wallet-refresh]').click();
  await frame.getByText('Vernieuwen is niet gelukt. De bedragen hieronder zijn van de vorige controle.').waitFor();
  assert.match(await frame.locator('.wallet-primary strong').innerText(),/10/,'failed refresh retains explicitly stale amount');
  state.walletUnavailable=false;
  await frame.locator('[data-wallet-refresh]').click();
  await frame.locator('[data-wallet-contact]').click();
  await frame.locator('#wallet-topup-reference').getByText('KL-MOCK-001',{exact:false}).waitFor();
  await frame.locator('#wallet-topup-amount').fill('20,50');
  const topupHref=await frame.locator('#wallet-topup-mail').getAttribute('href');
  assert.equal(new URL(topupHref).pathname,'david@belgobase.be');
  assert.match(new URL(topupHref).searchParams.get('body'),/20\.50[\s\S]*KL-MOCK-001[\s\S]*LIC-MOCK-001/,'request contains exact amount and authenticated public references');
  await page.screenshot({path:path.join(artifactDirectory,'wallet-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'wallet request fits mobile width');
  await frame.locator('#wallet-topup-amount').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(artifactDirectory,'wallet-request-mobile.png')});
  await frame.locator('#wallet-topup-mail').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(artifactDirectory,'wallet-request-actions-mobile.png')});
  await page.setViewportSize({width:1440,height:960});
  await frame.locator('#wallet-topup-amount').fill('-10');
  assert.equal(await frame.locator('#wallet-topup-mail').getAttribute('href'),null,'invalid amount cannot create request');
  await frame.locator('#wallet-topup-amount').fill('10');
  assert.match(await frame.locator('#wallet-topup-form').innerText(),/Verstuur de aanvraag/,'no false sent confirmation');
  const languageRequest = page.waitForRequest((request) => request.url().endsWith("/api/web/bridge/set_language"));
  const languageResponse = page.waitForResponse((response) => response.url().endsWith("/api/web/bridge/set_language"));
  await page.getByRole("combobox", { name: "Taal / Language / Langue", exact: true }).selectOption("fr");
  await languageRequest;
  await languageResponse;
  assert.equal(await frame.locator("#language-switch").inputValue(), "fr", "the selected workspace language changes immediately");
  assert.ok(state.bridgeCalls.some((call) => call.method === "set_language" && call.payload.language === "fr"), "language preference is persisted through the bridge");
  assert.notEqual(await frame.locator("#new-search").innerText(), "Nieuwe zoekopdracht", "French changes visible labels, not just the dropdown");
  await frame.locator('[data-wallet-contact]').click();
  await frame.locator('#wallet-topup-reference').getByText('KL-MOCK-001',{exact:false}).waitFor();
  assert.match(decodeURIComponent(await frame.locator('#wallet-topup-mail').getAttribute('href')),/KL-MOCK-001/,'French account row translation retains customer number in request');
  await page.getByRole("combobox", { name: "Taal / Language / Langue", exact: true }).selectOption("en");
  await frame.locator("#new-search").getByText("New search", { exact: true }).waitFor();
  await page.getByRole("combobox", { name: "Taal / Language / Langue", exact: true }).selectOption("nl");
  await frame.locator("#new-search").getByText("Nieuwe zoekopdracht", { exact: true }).waitFor();
  await frame.locator("#tools-back").click();
  await frame.locator("#query").waitFor();

  await frame.locator("#ai-mode").uncheck();
  await frame.locator("#query").fill("Voorbeeld Bouw");
  await frame.locator("#search-form").press("Enter");
  await frame.locator('button[data-company="0123456789"]').first().waitFor();
  assert.ok(state.bridgeCalls.some((call) => call.method === "search"), "search reached the bridge");
  const visibleSelection=async()=>({query:await frame.locator('#query').inputValue(),filters:await frame.locator('#chips').textContent(),rows:await frame.locator('#company-rows').textContent(),total:await frame.locator('#result-total').textContent()});
  const beforeFailedFilters=await visibleSelection();
  await frame.getByRole("button", {name:"Alle filters openen",exact:true}).click();
  await frame.locator("#filter-finder").waitFor();
  const renderedFields = await frame.locator("[data-workspace-field]").evaluateAll(els => [...new Set(els.map(e=>e.dataset.workspaceField))]);
  const omittedFields = metadata.filter_schema.fields.filter(f=>!renderedFields.includes(f.key));
  const retired = new Set(['naam_missing_mode','type_of_enterprise','adres_type','gemeente_nl_match','gemeente_fr_match','activity_classification','nace_missing_mode','personeel_missing_mode']);
  assert.ok(omittedFields.every(field=>retired.has(field.key)), "only the eight explicitly retired inactive fields are omitted");
  await frame.locator('[data-filter-group]').evaluateAll(els=>els.forEach(el=>el.open=true));
  const ebitdaSelect=frame.locator('[data-workspace-field="ebitda_missing_mode"]');
  assert.deepEqual(await ebitdaSelect.locator('option').allTextContents(),['','Aanwezig','Ontbreekt']);
  assert.equal(await frame.locator('[data-workspace-field="gemeente_nl_match"]').count(),0,'inactive legacy municipality mode is hidden');
  assert.equal(await frame.locator('[placeholder="Geen beperking"]').count(),0);
  assert.deepEqual(await frame.locator('[data-workspace-field="regions"]').evaluateAll(els=>els.map(el=>el.parentElement.textContent.trim())),['Vlaanderen','Wallonië','Brussel']);
  assert.ok(await ebitdaSelect.evaluate(el=>parseFloat(getComputedStyle(el.parentElement.querySelector('span')).fontSize)>=16));
  for(const [language,label] of [['fr','Disponible'],['en','Available'],['nl','Aanwezig']]){
    await page.getByLabel('Taal / Language / Langue',{exact:true}).selectOption(language);
    await page.waitForFunction(({language})=>document.querySelector('iframe').contentWindow.BelgoBaseI18n.language===language,{language});
    assert.equal(await ebitdaSelect.locator('option[value="alleen_met_waarde"]').textContent(),label);
  }
  await frame.locator('[data-filter-group]').evaluateAll(els=>els.forEach(el=>el.open=true));
  await ebitdaSelect.selectOption('alleen_met_waarde');
  await frame.locator('[data-workspace-field="regions"][value="vlaanderen"]').check();
  await frame.locator('[data-workspace-field="min_omzet"]').fill('10000');
  await frame.locator('[data-workspace-field="max_omzet"]').fill('900000');
  await frame.locator('[data-filter-group]').evaluateAll(els=>els.forEach(el=>el.open=el.querySelector('[data-workspace-field="regions"]')!==null));
  await frame.locator('body').evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(artifactDirectory,'filters-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'filter page fits mobile width');
  await frame.locator('body').evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(artifactDirectory,'filters-mobile.png')});
  await page.setViewportSize({width:1440,height:960});
  state.failNextSearch=true;
  await frame.locator('[data-tool="apply-workspace-filters"]').click();
  await frame.locator('#notice').getByText('De eerder geladen resultaten en filters blijven behouden.',{exact:false}).waitFor();
  assert.deepEqual(await visibleSelection(),beforeFailedFilters,'failed advanced search retains the exact previous visible data/filter pair');
  assert.equal(await frame.locator('#filter-finder').isVisible(),true,'failed apply keeps the editable filter form');
  await frame.locator('[data-tool="apply-workspace-filters"]').click();
  await frame.locator('#query').waitFor();
  const applied=state.bridgeCalls.filter(c=>c.method==='filters_apply').at(-1).payload.filters;
  assert.equal(applied.ebitda_missing_mode,'alleen_met_waarde');
  assert.equal(applied.min_omzet,10000);assert.equal(applied.max_omzet,900000);
  assert.deepEqual(applied.regions,['vlaanderen']);
  await frame.locator('#ai-mode').check();
  await frame.locator('#query').fill('Zoek mijn ideale klant');
  const beforeAiSearches=state.bridgeCalls.filter(c=>c.method==='search').length;
  state.aiFailureOnce={status:402,code:'insufficient_balance'};
  await frame.locator('#search-form').press('Enter');
  await frame.locator('#notice').filter({hasText:/tegoed/i}).waitFor();
  assert.equal(await frame.locator('#query').inputValue(),'Zoek mijn ideale klant','rejected AI request keeps the typed question');
  assert.doesNotMatch(await frame.locator('#notice').innerText(),/insufficient_balance|Deze actie kon niet/);
  await page.waitForFunction(()=>!document.querySelector('iframe').contentDocument.querySelector('#query').disabled);
  await frame.locator('#search-form').press('Enter');
  try { await frame.locator('[data-choice="41"]').waitFor(); } catch(error) { console.error(JSON.stringify({runtimeErrors,notice:await frame.locator("#notice").textContent(),calls:state.bridgeCalls.slice(-5)},null,2)); throw error; }
  assert.equal(state.bridgeCalls.filter(c=>c.method==='search').length,beforeAiSearches,'clarification never silently starts a search');
  await frame.locator('#answer-ai').click();
  await frame.locator('#notice').getByText('Vink minstens één activiteit aan.').waitFor();
  await frame.locator('[data-choice="41"]').check();
  for(const [language,title,role] of [['fr','Précisez votre recherche','Vous'],['en','Clarify your search','You'],['nl','Maak je zoekopdracht concreet','Jij']]){
    await page.getByRole('combobox',{name:'Taal / Language / Langue',exact:true}).selectOption(language);
    await frame.locator('#ai-title').getByText(title,{exact:true}).waitFor();
    assert.equal(await frame.locator('[data-choice="41"]').isChecked(),true,'language switch retains pending activity choice');
    assert.equal(await frame.locator('#ai-turns li.user strong').last().innerText(),role);
  }

  await frame.locator('#answer-ai').click();
  await frame.locator('#apply-ai').waitFor();
  const beforeFailedAi=await visibleSelection();
  state.failNextSearch=true;
  await frame.locator('#apply-ai').click();
  await frame.locator('#notice').getByText('De eerder geladen resultaten en filters blijven behouden.',{exact:false}).waitFor();
  assert.deepEqual(await visibleSelection(),beforeFailedAi,'failed AI apply retains old selection');
  assert.equal(await frame.locator('#ai-panel').isVisible(),true,'failed AI apply preserves proposal for retry');
  await frame.locator('#apply-ai').click();
  await frame.locator('#ai-panel').waitFor({state:'hidden'});
  assert.equal(state.bridgeCalls.filter(c=>c.method==='search').at(-1).payload.filters.nace_prefix,'41');
  const priorConversation=await frame.locator('#ai-turns').innerText();
  let releaseAi;
  state.aiGate=new Promise(resolve=>{releaseAi=resolve;});
  await frame.locator('#query').fill('Behoud mijn vorige gesprek');
  const lateAiResponse=page.waitForResponse(r=>r.url().endsWith('/api/web/bridge/ai'));
  const aiRequest=page.waitForRequest(r=>r.url().endsWith('/api/web/bridge/ai'));
  await frame.locator('#search-form').press('Enter');await aiRequest;
  await frame.locator('#cancel-request').click();
  releaseAi();state.aiGate=null;await lateAiResponse;
  await page.waitForFunction(()=>!document.querySelector('iframe').contentDocument.querySelector('#query').disabled);
  assert.equal(await frame.locator('#query').inputValue(),'Behoud mijn vorige gesprek');
  assert.equal(await frame.locator('#ai-turns').innerText(),priorConversation,'cancelled follow-up keeps prior conversation and ignores late response');

  await frame.locator('#ai-mode').uncheck();
  await frame.getByRole('button',{name:'Alle filters openen',exact:true}).click();
  await frame.locator('#filter-finder').waitFor();
  await frame.locator('[data-tool="clear-filters"]').click();
  assert.equal(await ebitdaSelect.inputValue(),'');
  assert.equal(await frame.locator('[data-workspace-field="regions"]:checked').count(),0);
  const postcodeInput = frame.locator('[data-workspace-field="kbo_postcode"]');
  await frame.locator("#filter-finder").fill("Postcode");
  const manyPostcodes = Array.from({length:300},(_,i)=>String(1000+i)).join("; ");
  await postcodeInput.fill(manyPostcodes);
  assert.equal(await postcodeInput.inputValue(),manyPostcodes,"300 postcode values are not truncated");
  await frame.locator("#tools-back").click();
  await frame.getByRole("button",{name:"Jaarrekeningen",exact:true}).click();
  await frame.locator("#catalog-query").waitFor();
  await frame.locator("#catalog-query").fill("bezoldigingen");
  await frame.locator("#catalog-form").press("Enter");
  await page.waitForFunction(() => !document.querySelector('iframe').contentDocument.querySelector('#tools-back').disabled);
  await frame.locator('[data-add-metric="test_wages"]').click();
  await frame.locator('[data-xbrl-field="numeric_min"]').fill('50000');
  await frame.locator('[data-xbrl-field="year_min"]').fill('2023');
  for(const language of ['fr','en','nl']){
    await page.getByLabel('Taal / Language / Langue',{exact:true}).selectOption(language);
    await page.waitForFunction(({language})=>document.querySelector('iframe').contentWindow.BelgoBaseI18n.language===language,{language});
    assert.equal(await frame.locator('[data-add-metric="test_wages"]').count(),1,'catalog remains visible after language switch');
    assert.equal(await frame.locator('[data-xbrl-field="numeric_min"]').inputValue(),'50000');
  }
  await frame.locator('body').evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(artifactDirectory,'annual-accounts-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'annual accounts fits mobile width');
  await frame.locator('body').evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(artifactDirectory,'annual-accounts-mobile.png')});
  await page.setViewportSize({width:1440,height:960});
  await frame.locator('[data-tool="apply-workspace-filters"]').click();
  await frame.locator('#query').waitFor();
  const annual=state.bridgeCalls.filter(c=>c.method==='filters_apply').at(-1).payload.filters.xbrl_metric_filters[0];
  assert.equal(annual.xbrl_metric_key,'test_wages');assert.equal(annual.numeric_min,50000);assert.equal(annual.year_min,2023);
  await frame.locator('#new-search').click();
  await frame.locator('#query').fill('Voorbeeld Bouw');
  await frame.locator('#search-form').press('Enter');
  await frame.locator('button[data-company="0123456789"]').first().waitFor();
  await frame.getByRole('button',{name:'Jaarrekeningen',exact:true}).click();
  await frame.locator('#catalog-query').waitFor();
  await frame.locator("#tools-back").click();
  await frame.getByRole("button",{name:"Vergelijkbaar",exact:true}).click();
  await frame.locator("#similar-number").fill("0123456789");
  await frame.locator("#similar-form").press("Enter");
  await frame.locator("#similar-criteria").getByRole("heading",{name:"Voorbeeld Bouw BV"}).waitFor();
  await frame.locator('[data-tool="apply-similar"]').click();
  await frame.locator('#query').waitFor();
  assert.equal(state.bridgeCalls.filter(c=>c.method==='similar_apply').at(-1).payload.criteria.length,2,'selected similarity criteria reach the service');
  const saveResponse = page.waitForResponse(r=>r.url().endsWith("/api/web/bridge/workspace_save"));
  await frame.locator('[data-save="0123456789"]').click();
  await saveResponse;
  await frame.getByRole("button",{name:"Bewaard 1",exact:true}).click();
  await frame.locator('button[data-company="0123456789"]').first().waitFor();
  await frame.getByRole("button",{name:"Bedrijven",exact:true}).first().click();
  await frame.locator("#save-search").click();
  await page.waitForFunction(()=>['saved-search-target','saved-search-name'].includes(document.querySelector('iframe').contentDocument.activeElement?.id));
  await frame.locator('#saved-search-name').press('Escape');
  await frame.locator('#workspace-dialog').waitFor({state:'hidden'});
  assert.equal(await frame.locator('#save-search').evaluate(element=>element.ownerDocument.activeElement===element),true,'closing a workspace dialog restores keyboard focus');
  await frame.locator('#save-search').click();
  await frame.locator("#saved-search-name").fill("Joël testselectie");
  await frame.locator('[data-dialog="submit"]').click();
  await frame.locator("#workspace-dialog").waitFor({state:"hidden"});
  const savedIdentity=state.workspace.searches.find(row=>row.name==="Joël testselectie").id;
  await frame.locator('#save-search').click();
  await frame.locator('#saved-search-target').selectOption(savedIdentity);
  assert.equal(await frame.locator('#saved-search-name').isDisabled(),true);
  assert.equal(await frame.locator('#save-search-confirm').innerText(),'Vervangen');
  await frame.locator('#save-search-confirm').click();
  await frame.locator('#workspace-dialog').waitFor({state:'hidden'});
  assert.equal(state.workspace.searches.filter(row=>row.name==="Joël testselectie").length,1);
  assert.equal(state.workspace.searches.find(row=>row.name==="Joël testselectie").id,savedIdentity);
  await frame.locator('#result-columns').click();
  await frame.locator('[data-column-catalog]').click();
  assert.equal(await frame.locator('[data-result-column]').count(),60);
  await frame.locator('#column-catalog-search').fill('Straat');
  await frame.locator('[data-result-column="straat_nl"]').check();
  await frame.locator('[data-dialog="submit"]').click();
  await frame.locator('#workspace-dialog').waitFor({state:'hidden'});
  await frame.locator('#company-rows').getByText('Voorbeeldstraat',{exact:true}).waitFor();
  assert.ok(state.bridgeCalls.filter(c=>c.method==='search').at(-1).payload.result_columns.includes('straat_nl'));
  await frame.locator("#open-searches").click();
  await frame.getByText("Joël testselectie",{exact:true}).waitFor();
  await frame.locator("#dialog-close").click();
  await frame.locator('#open-history').click();
  await frame.locator('[data-history-load]').first().waitFor();
  assert.doesNotMatch(await frame.locator('#dialog-content').innerText(),/Invalid Date|1970/,'history dates use backend seconds');
  const historyCount=await frame.locator('[data-history-load]').count();
  await frame.locator('[data-history-delete]').first().click();
  await page.waitForFunction(count=>document.querySelector('iframe').contentDocument.querySelectorAll('[data-history-load]').length<count,historyCount);
  await frame.locator('[data-history-load]').first().click();
  await frame.locator('#workspace-dialog').waitFor({state:'hidden'});
  await frame.locator("#filter-toggle").click();
  await frame.locator("#f-postcode").fill("9000");
  const postcodeResponse = page.waitForResponse(r => r.url().endsWith("/api/web/bridge/search"));
  await frame.locator("#apply-filters").click();
  await postcodeResponse;
  await frame.locator('button[data-company="0123456789"]').first().waitFor();
  await page.waitForFunction(() => !document.querySelector('iframe').contentDocument.querySelector('#search-button').disabled);
  assert.equal(state.bridgeCalls.filter(c => c.method === "search").at(-1).payload.filters.kbo_postcode, "9000", "postcode reaches backend");
  const regionResponse = page.waitForResponse(r => r.url().endsWith("/api/web/bridge/search"));
  await frame.locator('[data-region="vlaanderen"]').click();
  await regionResponse;
  await page.waitForFunction(() => !document.querySelector('iframe').contentDocument.querySelector('#search-button').disabled);
  assert.ok(state.bridgeCalls.filter(c => c.method === "search").at(-1).payload.filters.regions.includes("vlaanderen"), "regional selection reaches backend");
  await frame.locator("#new-search").click();
  assert.equal(await frame.locator("#query").inputValue(), "", "new search clears query");
  await frame.locator("#query").fill("Voorbeeld Bouw");
  await frame.locator("#search-form").press("Enter");
  await frame.locator('button[data-company="0123456789"]').first().waitFor();
  await frame.locator('button[data-company="0123456789"]').first().click();
  await frame.getByRole("heading", { name: "Voorbeeld Bouw BV" }).waitFor();
  assert.ok(state.bridgeCalls.some((call) => call.method === "company"), "company detail reached the bridge");
  await frame.locator('#finance-tab').click();
  for (const [language, revenue] of [["fr", "Chiffre d’affaires"], ["en", "Revenue"], ["nl", "Omzet"]]) {
    await page.getByRole("combobox", { name: "Taal / Language / Langue", exact: true }).selectOption(language);
    await frame.locator('[data-metric="revenue"]').getByText(revenue,{exact:true}).waitFor();
    assert.equal(await frame.locator('[data-metric="revenue"]').innerText(), revenue, "financial chart labels follow selected language");
    await frame.locator('#dossier-meta > span:last-child').getByText({fr:'Actif',en:'Active',nl:'Actief'}[language],{exact:true}).waitFor();
    assert.equal(await frame.locator('#finance-chart-slot #financial-chart').isVisible(),true,'financial chart stays on active tab after '+language+' switch');
    assert.equal(await frame.getByRole("heading", { name: "Voorbeeld Bouw BV" }).count(), 1, "company identity is never translated");
  }
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await frame.locator('body').evaluate(el => el.scrollWidth <= innerWidth), true, 'mobile workspace fits viewport');
  assert.equal(await frame.locator('[data-view="search"] [data-i18n="nav.companies"]').isVisible(), true, 'mobile navigation has readable labels');
  await page.screenshot({ path: path.join(artifactDirectory, 'mobile-dossier.png'), fullPage: true });
  assert.equal(await frame.locator('#assistant-nav').count(),0,'mobile has no obsolete assistant navigation');
  assert.equal(await frame.locator('#assistant-dock').count(),0,'mobile has no obsolete assistant drawer');
  await page.setViewportSize({ width: 1440, height: 900 });


  await frame.locator("#back").click();
  await frame.getByRole("button",{name:"Excel-kolommen",exact:true}).click();
  await frame.locator('[data-tool="columns-none"]').click();
  await frame.locator('[data-export-column="name"]').check();
  await frame.locator('[data-export-column="revenue"]').check();
  const columnsResponse = page.waitForResponse(r=>r.url().endsWith("/api/web/bridge/export_columns"));
  await frame.locator('[data-tool="columns-apply"]').click();
  await columnsResponse;
  assert.deepEqual(state.bridgeCalls.filter(c=>c.method==="export_columns").at(-1).payload.columns.sort(),["name","revenue"],"chosen export columns reach the service");
  const downloadPromise = page.waitForEvent("download");
  await frame.locator("#export").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "BelgoBase_mock.xlsx");
  assert.ok(state.bridgeCalls.some((call) => call.method === "export_results"), "export reached the bridge");

  await page.route("**/api/web/version", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ version: "f".repeat(64) }),
  }));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByRole("status").getByText("Een nieuwe versie van BelgoBase staat klaar. Rond je huidige werk af en vernieuw.").waitFor();
  assert.equal(await page.locator('iframe[title="BelgoBase workspace"]').count(), 1, "a version notice never reloads active work automatically");
  await page.unroute("**/api/web/version");

  state.expireNextBridge = true;
  await frame.locator("#query").fill("verlopen sessie");
  await frame.locator("#search-form").press("Enter");
  await page.getByRole("heading", { name: "Inloggen" }).waitFor();
  assert.equal(await page.locator('iframe[title="BelgoBase workspace"]').count(), 0, "401 in iframe returns to parent login");

  await page.getByLabel("E-mailadres", { exact: true }).fill("owner@example.test");
  await page.getByRole("button", { name: "Code per e-mail ontvangen" }).click();
  await page.getByLabel("Beveiligingscode").fill("123456");
  await page.getByRole("button", { name: "Aanmelden" }).click();
  await page.locator('iframe[title="BelgoBase workspace"]').waitFor();
  assert.equal(state.loginCalls.length, 2, "both sign-ins use email only login");
  await page.route("**/api/web/auth/sessions", route => route.fulfill({status:401,contentType:"application/json",body:'{"ok":false,"error":"session_invalid"}'}));
  await page.getByRole("button", { name: "Account", exact:true }).click();
  await page.getByRole("heading", { name: "Inloggen" }).waitFor();
  assert.equal(await page.locator('iframe').count(),0,"expired account listing removes workspace");
  await page.unroute("**/api/web/auth/sessions");
  await page.getByLabel("E-mailadres", { exact:true }).fill("owner@example.test");
  await page.getByRole("button", { name:"Code per e-mail ontvangen" }).click();
  await page.getByLabel("Beveiligingscode").fill("123456");
  await page.getByRole("button", { name:"Aanmelden", exact:true }).click();
  await page.locator('iframe[title="BelgoBase workspace"]').waitFor();
  await page.getByRole("button", { name: "Afmelden" }).click();
  await page.getByRole("heading", { name: "Inloggen" }).waitFor();
  assert.equal(state.logoutCsrf, csrf, "logout carries the session CSRF token");
  await page.goto(appOrigin + "/en/app", { waitUntil: "networkidle" });
  await page.getByLabel("Email address", { exact: true }).waitFor();
  await page.setViewportSize({ width: 768, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "English tablet sign-in has no horizontal overflow");

  if (process.env.WORKSPACE_ONLY !== "1") {
  const marketingErrors=[];
  const marketingPageError=error=>marketingErrors.push(error.message);
  const marketingConsoleError=message=>{if(message.type()==='error') marketingErrors.push(message.text());};
  page.on('pageerror', marketingPageError);
  page.on('console', marketingConsoleError);
  for (const language of ['nl','en']) {
    await page.goto(appOrigin + '/' + language, {waitUntil: 'networkidle'});
    assert.doesNotMatch(await page.locator('main').innerText(), /Lorem ipsum|Dolor sit amet/);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'marketing mobile width '+language);
    const menuToggle = page.locator('button[aria-controls="site-navigation-mobile"]');
    assert.equal(await page.locator('#site-navigation-mobile').evaluate(el=>el.parentElement.inert),true,"closed mobile menu is not keyboard-focusable");
    await menuToggle.click();
    assert.equal(await menuToggle.getAttribute('aria-expanded'),'true');
    await page.locator('#site-navigation-mobile a[href="#contact"]').click();
    assert.equal(await menuToggle.getAttribute('aria-expanded'),'false',"contact CTA closes mobile menu");
    assert.equal(new URL(page.url()).hash,'#contact');
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(artifactDirectory,'marketing-'+language+'-mobile.png')});
    await page.setViewportSize({width:1440,height:900});
    await page.screenshot({path:path.join(artifactDirectory,'marketing-'+language+'-desktop.png')});
  }

  await auditPublicSite({page, context, appOrigin, artifactDirectory});
  page.off('pageerror',marketingPageError);
  page.off('console',marketingConsoleError);
  await writeFile(path.join(artifactDirectory,"marketing-errors.json"),JSON.stringify(marketingErrors,null,2));
  assert.equal(marketingErrors.length,0,"marketing renders without browser errors; see marketing-errors.json");
  }
  await auditAccountFinal({page, context, appOrigin, state, artifactDirectory});
  assert.deepEqual(runtimeErrors,[],"all authenticated and public flows finish without uncaught browser errors");
  assert.deepEqual(state.unhandledMethods,[],"the browser never receives fake success for an unimplemented mock route");
  const report = { ok: true, checkedAt: new Date().toISOString(), network: "loopback mocks only; synthetic installer", aiRequests: state.bridgeCalls.filter(call=>call.method==="ai").map(call=>call.payload), enrollmentScreenshot: enrollmentScreenshotPath, documentScreenshot: documentScreenshotPath, screenshot: screenshotPath, bridgeMethods: state.bridgeCalls.map((call) => call.method), version: release };
  await writeFile(path.join(artifactDirectory,"workspace-proof.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report, null, 2));
  await context.close();
  }
} finally {
  await browser?.close();
  stopProcess(app);
  await new Promise((resolve) => mock.close(resolve));
  await rm(tlsDirectory, {recursive:true,force:true});
  if (process.env.KEEP_BROWSER_ARTIFACT !== "1") await rm(path.join(artifactDirectory, "unused"), { recursive: true, force: true });
}
