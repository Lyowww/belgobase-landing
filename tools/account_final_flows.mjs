import assert from "node:assert/strict";
import path from "node:path";

const SESSION_ROUTE = "**/api/web/auth/session";
const ENROLLMENT_COMPLETE_ROUTE = "**/api/web/enrollment/complete";
const SESSIONS_ROUTE = "**/api/web/auth/sessions";
const DOWNLOAD_ROUTE = "**/api/web/desktop-download?*format=json";

async function openAuthenticatedWorkspace({ page, context, appOrigin }) {
  await context.addCookies([{
    name: "belgobase_session",
    value: "mock-browser-session",
    url: appOrigin,
    httpOnly: true,
    sameSite: "Lax",
  }]);
  await page.goto(`${appOrigin}/nl/app`, { waitUntil: "networkidle" });
  await page.locator('iframe[title="BelgoBase workspace"]').waitFor();
}

export async function auditAccountFinal({ page, context, appOrigin, state, artifactDirectory }) {
  assert.ok(page && context && appOrigin && state && artifactDirectory, "account audit requires the shared browser fixture");
  const enrollmentCallsBefore = state.enrollmentCalls.length;

  // A completed enrollment is already a server mutation. If the following
  // session projection is temporarily unavailable, recovery must not ask the
  // user to submit the legal enrollment again.
  await context.clearCookies();
  await page.goto(`${appOrigin}/nl/app`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Maak een account aan" }).click();
  await page.getByLabel("E-mailadres", { exact: true }).fill("recovery@example.test");
  await page.getByLabel("BelgoBase-licentiecode").fill("RECOVERY-MOCK-LICENSE");
  await page.getByRole("button", { name: "Code per e-mail ontvangen" }).click();
  await page.getByLabel("Beveiligingscode").fill("123456");
  await page.getByRole("button", { name: "E-mailadres bevestigen" }).click();
  await page.getByLabel("Ondernemingsnummer (KBO)").fill("BE 0123.456.789");
  await page.getByRole("button", { name: "Bedrijfsgegevens ophalen" }).click();
  await page.getByLabel("Naam van de aanvaarder").fill("Herstel Test");
  await page.getByLabel("Functie van de aanvaarder").fill("Bestuurder");
  const declarations = page.locator('form').last().locator('input[type="checkbox"]');
  assert.equal(await declarations.count(), 4, "recovery enrollment has all four declarations");
  for (let index = 0; index < 4; index += 1) await declarations.nth(index).check();

  await context.addCookies([{
    name: "belgobase_session",
    value: "mock-browser-session",
    url: appOrigin,
    httpOnly: true,
    sameSite: "Lax",
  }]);
  await page.route(ENROLLMENT_COMPLETE_ROUTE, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, authenticated: true, account: { name: "Herstel Test", email: "recovery@example.test" } }),
  }));
  await page.route(SESSION_ROUTE, (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, error: "temporarily_unavailable" }),
  }));
  try {
    await page.getByRole("button", { name: "Zakelijke inschrijving voltooien" }).click();
    await page.getByRole("heading", { name: "BelgoBase is tijdelijk niet bereikbaar" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Zakelijke inschrijving voltooien" }).count(), 0, "completed enrollment is not offered a second time");
  } finally {
    await page.unroute(ENROLLMENT_COMPLETE_ROUTE);
    await page.unroute(SESSION_ROUTE);
  }
  await page.getByRole("button", { name: "Opnieuw proberen" }).click();
  await page.locator('iframe[title="BelgoBase workspace"]').waitFor();
  assert.ok(state.enrollmentCalls.length >= enrollmentCallsBefore + 3, "enrollment start, verify and autofill reached only the local mock");

  // The session API deliberately permits a 200 authenticated:false response.
  // Focus polling must remove the workspace, while transient failures are
  // covered separately by the recovery case above.
  await page.waitForTimeout(100);
  await page.route(SESSION_ROUTE, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, authenticated: false }),
  }));
  try {
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByRole("heading", { name: "Inloggen" }).waitFor();
    assert.equal(await page.locator('iframe[title="BelgoBase workspace"]').count(), 0, "200 logged-out projection removes the workspace");
    await page.getByRole("alert").getByText("Je sessie is beëindigd.", { exact: false }).waitFor();
  } finally {
    await page.unroute(SESSION_ROUTE);
  }

  await openAuthenticatedWorkspace({ page, context, appOrigin });

  // A failed browser-list request must have its own error state and may not be
  // rendered as a successfully empty list.
  await page.route(SESSIONS_ROUTE, (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, error: "temporarily_unavailable" }),
  }));
  try {
    await page.getByRole("button", { name: "Account", exact: true }).click();
    const panel = page.getByRole("region", { name: "Account", exact: true });
    await panel.getByRole("alert").getByText("De aangemelde browsers konden niet worden geladen.", { exact: true }).waitFor();
    assert.equal(await panel.getByText("Geen actieve browsers gevonden.", { exact: true }).count(), 0, "failed list is not reported as empty");
  } finally {
    await page.unroute(SESSIONS_ROUTE);
  }

  // Invalid metadata exercises the client-side URL boundary. The user remains
  // in the account panel and sees the localized download error.
  await page.route(DOWNLOAD_ROUTE, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, url: "https://downloads.example.test/BelgoBase_CloudClient_Setup_BUILD999_UPDATE999.exe" }),
  }));
  try {
    await page.getByRole("button", { name: "BelgoBase voor Windows downloaden" }).click();
    const panel = page.getByRole("region", { name: "Account", exact: true });
    await panel.getByRole("alert").getByText("De Windows-download is tijdelijk niet beschikbaar.", { exact: false }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/nl/app", "invalid installer metadata never leaves the workspace");
    await page.screenshot({ path: path.join(artifactDirectory, "account-final-flows.png"), fullPage: true });
  } finally {
    await page.unroute(DOWNLOAD_ROUTE);
  }
}
