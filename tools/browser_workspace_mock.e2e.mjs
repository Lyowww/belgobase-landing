/*
 * Real-browser proof for the Next web shell. It intentionally uses a local
 * HTTP mock: no real license, mail provider, customer data or VPS is touched.
 *
 * Run from the worktree with:
 *   node tools/browser_workspace_mock.e2e.mjs
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { access, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPort = 3107;
const mockPort = 4191;
const appOrigin = `http://localhost:${appPort}`;
const mockOrigin = `http://127.0.0.1:${mockPort}`;
const artifactDirectory = path.join(root, "tools", "test-artifacts");
const screenshotPath = path.join(artifactDirectory, "browser-workspace-mock.png");
const enrollmentScreenshotPath = path.join(artifactDirectory, "browser-enrollment-mock.png");
const documentScreenshotPath = path.join(artifactDirectory, "browser-enrollment-document-mock.png");
const temporaryEnvPath = path.join(root, ".env.local");
const runtimeNodeModules = "C:/Users/David1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const chromiumExecutable = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const runtimeRequire = createRequire(path.join(runtimeNodeModules, "playwright", "package.json"));
const { chromium } = runtimeRequire("playwright");

const metadata = JSON.parse(await readFile(path.join(root,"backend/workspace_assets/workspace_metadata.json"),"utf8"));
// Mirror the core schema enrichment; backend regression verifies its source contract.
metadata.filter_schema.fields.find(f=>f.key==="regions").options=[{value:"vlaanderen",label:"Vlaanderen"},{value:"wallonie",label:"Wallonië"},{value:"brussel",label:"Brussel"}];
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
      choice_texts: {
        general_terms: "Ik aanvaard de algemene voorwaarden B2B.",
        usage_terms: "Ik aanvaard de gebruiksvoorwaarden.",
        privacy_notice: "Ik heb de privacyverklaring gelezen.",
        business_authority: "Ik ben bevoegd deze onderneming te vertegenwoordigen.",
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
    sectors: [{ value: "56", label: "Horeca" }],
    legal_forms: [{ value: "BV", label: "Besloten vennootschap" }],
    statuses: [{ value: "", label: "Alle statussen" }, { value: "AC", label: "Actief" }],
    saved: [],
    workspace: { lists: [], searches: [], active_list_id: null, result_columns: ["name", "city", "revenue", "profit", "fte", "year"] },
    filter_labels: {}, enum_labels: {}, activity_labels_by_version: { "2025": {} },
  };
}

function company() {
  return {
    ok: true,
    company: { number: "0123456789", name: "Voorbeeld Bouw BV", city: "Gent", postcode: "9000", nace: "41201", status: "AC", legal_form: "BV", revenue: 1250000, profit: 145000, fte: 12, year: 2024 },
    fields: [{ label: "Adres", value: "Voorbeeldstraat 1, 9000 Gent" }, { label: "Activiteit", value: "Algemene bouwwerken" }],
    metrics: [{ key: "revenue", label: "Omzet", value: 1250000, unit: "€", year: 2024, note: "reported" }, { key: "profit", label: "Resultaat", value: 145000, unit: "€", year: 2024, note: "reported" }, { key: "fte", label: "Personeel", value: 12, unit: "VTE", year: 2024, note: "reported" }],
    history: { years: [2023, 2024], series: { revenue: [980000, 1250000], profit: [100000, 145000], fte: [10, 12], assets: [400000, 510000] }, label: "Financi\u00eble evolutie", note: "Mock bronjaren." },
    financial: [{ label: "Omzet", value: 1250000, year: 2024, status: "reported", source: "Mock bron", explanation: "" }],
  };
}

const mock = http.createServer(async (request, response) => {
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
      if (body.method === "ai_wallet") return json(response, 200, { ok: true, wallet: { currency: "EUR", balance_eur: 12, available_eur: 10, reserved_eur: 1, spent_eur: 2, entries: [] } });
      if (body.method === "set_language") {
        if (!["nl", "fr", "en"].includes(body.payload.language)) return json(response, 400, { ok: false, error: "invalid_request" });
        return json(response, 200, { ok: true, language: body.payload.language });
      }
      if (body.method === "workspace_save") return json(response,200,{ok:true,workspace:body.payload.workspace,workspace_revision:++state.workspaceRevision});
      if (body.method === "workspace_data") return json(response,200,{ok:true,schema:metadata.filter_schema,filters:body.payload.filters||{},criteria:[],columns:metadata.column_groups.result_columns,selected:["name"]});
      if (body.method === "export_columns") return json(response,200,{ok:true,columns:metadata.column_groups.result_columns,selected:body.payload.columns||["name"]});
      if (body.method === "filters_apply") return json(response,200,{ok:true,filters:body.payload.filters});
      if (body.method === "xbrl_catalog") return json(response,200,{ok:true,metrics:[],total:0,offset:0,has_more:false});
      if (body.method === "similar_company") return json(response,200,{ok:true,company:company().company,criteria:[]});
      if (body.method === "search") return json(response, 200, { ok: true, rows: [company().company], total: 1, page: 1, page_size: 50, filters: body.payload.filters || {} });
      if (body.method === "company") return json(response, 200, company());
      if (["export_results","export_selection"].includes(body.method)) return json(response, 200, { ok: true, download_url: "/api/web/download/mock-download-token", rows: 1, total: 1, message: "1 bedrijf opgeslagen." });
      if (body.method === "operation_status") return json(response, 200, { ok: true });
      if (body.method === "search_history") return json(response,200,{ok:true,history:[]});
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
try {
  await access(temporaryEnvPath);
  throw new Error("Refusing to overwrite an existing .env.local during the browser mock test.");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
await writeFile(temporaryEnvPath, `BELGOBASE_WEB_BACKEND_URL=${mockOrigin}/\n`, { encoding: "utf8", flag: "wx" });
await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));
const app = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `pnpm.cmd exec next dev -p ${appPort}`], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "development" },
  stdio: "pipe",
  windowsHide: true,
});
app.stdout.on("data", (chunk) => state.appLog.push(String(chunk)));
app.stderr.on("data", (chunk) => state.appLog.push(String(chunk)));

let browser;
try {
  await waitForServer(`${appOrigin}/nl/app`);
  browser = await chromium.launch({ headless: true, executablePath: chromiumExecutable });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const workspaceResponses = [];
  page.on("response", (response) => {
    if (response.url().endsWith("/api/web/workspace")) workspaceResponses.push(response);
  });
  await page.goto(`${appOrigin}/nl/app`, { waitUntil: "networkidle" });
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
  await page.getByLabel("Ondernemingsnummer (KBO)").fill("BE 0123.456.789");
  await page.getByRole("button", { name: "Bedrijfsgegevens ophalen" }).click();
  await page.getByLabel("Wettelijke bedrijfsnaam").waitFor();
  assert.equal(await page.getByLabel("Wettelijke bedrijfsnaam").inputValue(), "Voorbeeld Bouw BV", "KBO autofill remains editable");
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
  await page.getByLabel("Naam van de aanvaarder").fill("Nieuw Account");
  await page.getByLabel("Functie van de aanvaarder").fill("Bestuurder");
  await page.getByRole("button", { name: "Zakelijke inschrijving voltooien" }).click();
  await page.locator('iframe[title="BelgoBase workspace"]').waitFor();
  assert.equal(state.enrollmentCalls[0].body.remember_browser, true, "enrollment preserves the remember choice");
  assert.deepEqual(state.enrollmentComplete.declarations, { terms_accepted: true, usage_terms_accepted: true, privacy_acknowledged: true, authority_declared: true });
  assert.deepEqual(state.enrollmentComplete.choice_texts, enrollmentAutofill().legal.choice_texts, "server legal text is echoed unchanged");
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
  await page.getByRole("button", { name: "Aanmelden" }).click();
  const iframe = page.locator('iframe[title="BelgoBase workspace"]');
  await iframe.waitFor();
  const frame = await loadedWorkspaceFrame(page);
  await frame.locator("#query").waitFor();
  await frame.locator("#account-name").getByText("Mock BelgoBase").waitFor();
  assert.equal(state.claimCalls.length, 0, "registered customer signs in by verified email");
  assert.equal(state.loginCalls[0].remember_browser, true);
  assert.ok(state.bridgeCalls.some((call) => call.method === "bootstrap"), "frozen bootstrap reached the bridge");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByText("Testbrowser", { exact: false }).waitFor();
  const installerLink = page.getByRole("link", { name: "BelgoBase voor Windows downloaden" });
  assert.equal(await installerLink.getAttribute("href"), "/api/web/desktop-download");
  await page.getByText("Alleen voor Windows.", { exact: true }).waitFor();
  const installerResponse = await page.request.get(appOrigin + "/api/web/desktop-download", { maxRedirects: 0 });
  assert.equal(installerResponse.status(), 307);
  assert.match(installerResponse.headers().location, /^https:\/\/api\.belgobase\.be\/client-updates\/download\/BelgoBase_CloudClient_Setup_BUILD\d+_UPDATE\d+\.exe$/);
  await page.getByRole("button", { name: "Account", exact: true }).click();

  assert.equal(await iframe.getAttribute("allow"), "microphone");
  assert.match(await frame.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content"), /connect-src 'self'/);
  assert.match(workspaceResponses.at(-1).headers()["permissions-policy"] || "", /microphone=\(self\)/);
  const release = await frame.locator('meta[name="belgobase-release"]').getAttribute("content");
  assert.match(release || "", /^[a-f0-9]{64}$/);
  const versionResponse = await page.request.get(`${appOrigin}/api/web/version`);
  assert.equal((await versionResponse.json()).version, release, "the version endpoint matches the active iframe release");
  await frame.locator("#assistant-nav").click();
  await frame.locator("#wallet-tab").click();
  await frame.getByText("Saldo").waitFor();
  assert.ok(state.bridgeCalls.some((call) => call.method === "ai_wallet"), "wallet reads the server snapshot through the bridge");
  const languageRequest = page.waitForRequest((request) => request.url().endsWith("/api/web/bridge/set_language"));
  const languageResponse = page.waitForResponse((response) => response.url().endsWith("/api/web/bridge/set_language"));
  await page.getByRole("combobox", { name: "Taal / Language / Langue", exact: true }).selectOption("fr");
  await languageRequest;
  await languageResponse;
  assert.equal(await frame.locator("#language-switch").inputValue(), "fr", "the selected workspace language changes immediately");
  assert.ok(state.bridgeCalls.some((call) => call.method === "set_language" && call.payload.language === "fr"), "language preference is persisted through the bridge");
  assert.notEqual(await frame.locator("#new-search").innerText(), "Nieuwe zoekopdracht", "French changes visible labels, not just the dropdown");
  await page.getByRole("combobox", { name: "Taal / Language / Langue", exact: true }).selectOption("en");
  await frame.locator("#new-search").getByText("New search", { exact: true }).waitFor();
  await page.getByRole("combobox", { name: "Taal / Language / Langue", exact: true }).selectOption("nl");
  await frame.locator("#new-search").getByText("Nieuwe zoekopdracht", { exact: true }).waitFor();
  await frame.locator("#assistant-close").click();
  await frame.locator("#query").waitFor();

  await frame.locator("#ai-mode").uncheck();
  await frame.locator("#query").fill("Voorbeeld Bouw");
  await frame.locator("#search-form").press("Enter");
  await frame.locator('button[data-company="0123456789"]').first().waitFor();
  assert.ok(state.bridgeCalls.some((call) => call.method === "search"), "search reached the bridge");
  await frame.getByRole("button", {name:"Alle filters openen",exact:true}).click();
  await frame.locator("#filter-finder").waitFor();
  const renderedFields = await frame.locator("[data-workspace-field]").evaluateAll(els => [...new Set(els.map(e=>e.dataset.workspaceField))]);
  const omittedFields = metadata.filter_schema.fields.filter(f=>!renderedFields.includes(f.key));
  assert.deepEqual(omittedFields, [], "every server filter renders a usable control");
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
  await frame.locator("#tools-back").click();
  await frame.getByRole("button",{name:"Vergelijkbaar",exact:true}).click();
  await frame.locator("#similar-number").fill("0123456789");
  await frame.locator("#similar-form").press("Enter");
  await frame.locator("#similar-criteria").getByRole("heading",{name:"Voorbeeld Bouw BV"}).waitFor();
  await frame.locator("#tools-back").click();
  const saveResponse = page.waitForResponse(r=>r.url().endsWith("/api/web/bridge/workspace_save"));
  await frame.locator('[data-save="0123456789"]').click();
  await saveResponse;
  await frame.getByRole("button",{name:"Bewaard 1",exact:true}).click();
  await frame.locator('button[data-company="0123456789"]').first().waitFor();
  await frame.getByRole("button",{name:"Bedrijven",exact:true}).first().click();
  await frame.locator("#save-search").click();
  await frame.locator("#workspace-name").fill("Joël testselectie");
  await frame.locator('[data-dialog="submit"]').click();
  await frame.locator("#workspace-dialog").waitFor({state:"hidden"});
  await frame.locator("#open-searches").click();
  await frame.getByText("Joël testselectie",{exact:true}).waitFor();
  await frame.locator("#dialog-close").click();
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
  for (const [language, revenue] of [["fr", "Chiffre d’affaires"], ["en", "Revenue"], ["nl", "Omzet"]]) {
    await page.getByRole("combobox", { name: "Taal / Language / Langue", exact: true }).selectOption(language);
    assert.equal(await frame.locator('[data-metric="revenue"]').innerText(), revenue, "financial chart labels follow selected language");
    assert.equal(await frame.getByRole("heading", { name: "Voorbeeld Bouw BV" }).count(), 1, "company identity is never translated");
  }
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.getByRole("button", { name: "Account sluiten", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await frame.locator('body').evaluate(el => el.scrollWidth <= innerWidth), true, 'mobile workspace fits viewport');
  assert.equal(await frame.locator('[data-view="search"] [data-i18n="nav.companies"]').isVisible(), true, 'mobile navigation has readable labels');
  await page.screenshot({ path: path.join(artifactDirectory, 'mobile-dossier.png'), fullPage: true });
  await frame.locator('#assistant-nav').click();
  const assistantBox = await frame.locator('#assistant-dock').boundingBox();
  assert.ok(assistantBox && assistantBox.width >= 380 && assistantBox.height > 400, 'mobile assistant opens as usable full-width panel: '+JSON.stringify(assistantBox));
  await page.screenshot({ path: path.join(artifactDirectory, 'mobile-assistant.png'), fullPage: true });
  await frame.locator('#assistant-close').click();
  await page.setViewportSize({ width: 1440, height: 900 });


  await frame.locator("#back").click();
  await frame.getByRole("button",{name:"Exportkolommen instellen",exact:true}).click();
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

  const marketingErrors=[];
  page.on('pageerror', error=>marketingErrors.push(error.message));
  page.on('console', message=>{if(message.type()==='error') marketingErrors.push(message.text());});
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

  await writeFile(path.join(artifactDirectory,"marketing-errors.json"),JSON.stringify(marketingErrors,null,2));
  assert.equal(marketingErrors.length,0,"marketing renders without browser errors; see marketing-errors.json");
  assert.deepEqual(state.unhandledMethods,[],"the browser never receives fake success for an unimplemented mock route");
  console.log(JSON.stringify({ ok: true, enrollmentScreenshot: enrollmentScreenshotPath, documentScreenshot: documentScreenshotPath, screenshot: screenshotPath, bridgeMethods: state.bridgeCalls.map((call) => call.method), version: release }, null, 2));
  await context.close();
} finally {
  await browser?.close();
  stopProcess(app);
  await new Promise((resolve) => mock.close(resolve));
  await rm(temporaryEnvPath, { force: true });
  if (process.env.KEEP_BROWSER_ARTIFACT !== "1") await rm(path.join(artifactDirectory, "unused"), { recursive: true, force: true });
}
