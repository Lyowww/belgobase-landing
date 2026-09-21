import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const LOCALES = {
  nl: {
    languageTrigger: "Taal kiezen",
    otherLanguage: "English",
    themeDark: "Donkere modus",
    themeSystem: "Systeemthema",
    faqQuestion: "Hoe snel kunnen we starten?",
    formLabel: "Demo-aanvraagformulier",
    submit: "Boek mijn demo",
    nameError: /Naam moet minstens 2 tekens bevatten/i,
    phoneError: /Telefoonnummer is te lang/i,
    privacyError: /Vink het akkoordvakje aan om door te gaan/i,
  },
  en: {
    languageTrigger: "Select language",
    otherLanguage: "Nederlands",
    themeDark: "Dark mode",
    themeSystem: "System theme",
    faqQuestion: "How quickly can we get started?",
    formLabel: "Demo request form",
    submit: "Book My Demo",
    nameError: /Name must be at least 2 characters/i,
    phoneError: /Phone number is too long/i,
    privacyError: /Please check the agreement box to continue/i,
  },
};

const EXPECTED_HOME_TARGETS = [
  "process",
  "industries",
  "database",
  "pricing",
  "faq",
  "contact",
  "product-demonstration",
];

const LEGAL_ROUTES = ["privacy", "terms", "cookies", "legal"];

async function goto(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.locator("main").waitFor({ state: "visible" });
}

async function assertActiveElement(locator, message) {
  await locator.evaluate(
    (element) =>
      new Promise((resolve) => {
        const deadline = performance.now() + 1_000;
        const check = () => {
          if (document.activeElement === element || performance.now() >= deadline) {
            resolve(undefined);
            return;
          }
          requestAnimationFrame(check);
        };
        check();
      }),
  );
  assert.equal(
    await locator.evaluate((element) => document.activeElement === element),
    true,
    message,
  );
}

async function assertHomeTargets(page, appOrigin, locale) {
  const pathname = `/${locale}`;
  const anchors = await page.locator('a[href*="#"]').evaluateAll((elements) =>
    elements.map((element) => ({
      href: element.getAttribute("href"),
      text: element.textContent?.replace(/\s+/g, " ").trim() ?? "",
    })),
  );

  const discoveredTargets = new Set();
  for (const anchor of anchors) {
    assert.ok(anchor.href, `Anchor without href on ${pathname}: ${anchor.text}`);
    const url = new URL(anchor.href, `${appOrigin}${pathname}`);
    if (url.origin !== appOrigin || url.pathname !== pathname || !url.hash) continue;

    const targetId = decodeURIComponent(url.hash.slice(1));
    discoveredTargets.add(targetId);
    assert.equal(
      await page.locator(`[id="${targetId}"]`).count(),
      1,
      `${pathname} CTA "${anchor.text}" must resolve once to ${url.hash}`,
    );
  }

  for (const targetId of EXPECTED_HOME_TARGETS) {
    assert.ok(
      discoveredTargets.has(targetId),
      `${pathname} is missing a public CTA link to #${targetId}`,
    );
  }

  return [...discoveredTargets].sort();
}

async function assertFaq(page, copy) {
  const faq = page.locator("section#faq");
  const buttons = faq.locator('button[aria-controls^="faq-answer-"]');
  assert.equal(await buttons.count(), 9, "FAQ must expose all nine questions");

  assert.equal(await faq.getByRole("button", { name: copy.faqQuestion, exact: true }).count(), 1);
  for (let index = 0; index < await buttons.count(); index++) {
  const question = buttons.nth(index);
  assert.equal(await question.getAttribute("aria-expanded"), "false");
  const answerId = await question.getAttribute("aria-controls");
  assert.ok(answerId, "FAQ question must reference its answer");

  await question.click();
  assert.equal(await question.getAttribute("aria-expanded"), "true");
  await page.locator(`#${answerId}`).waitFor({ state: "visible" });

  await question.click();
  assert.equal(await question.getAttribute("aria-expanded"), "false");
  await page.locator(`#${answerId}`).waitFor({ state: "hidden" });
  }
}

async function assertProductVideo(page) {
  const toggle = page.locator('button[aria-controls="hero-product-demo"]');
  assert.equal(await toggle.count(), 1, "Product demonstration needs one toggle");
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert.equal(await page.locator("#hero-product-demo video").count(), 0);

  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  await page.locator("#hero-product-demo video[controls]").waitFor({ state: "visible" });

  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  await page.locator("#hero-product-demo video").waitFor({ state: "detached" });
}

async function assertMobileControls(page, copy) {
  await page.setViewportSize({ width: 390, height: 844 });

  const menuToggle = page.locator('button[aria-controls="site-navigation-mobile"]');
  await menuToggle.click();
  assert.equal(await menuToggle.getAttribute("aria-expanded"), "true");
  assert.equal(
    await page.locator("body").evaluate((element) => element.style.overflow),
    "hidden",
    "Open mobile menu must lock body scrolling",
  );
  await page.locator("#site-navigation-mobile a").first().focus();
  await page.keyboard.press("Escape");
  assert.equal(await menuToggle.getAttribute("aria-expanded"), "false");
  await assertActiveElement(menuToggle, "Escape must return focus to the menu toggle");

  const languageTrigger = page.getByRole("button", {
    name: copy.languageTrigger,
    exact: true,
  });
  await languageTrigger.click();
  await page.getByRole("listbox").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.getByRole("listbox").waitFor({ state: "hidden" });
  await assertActiveElement(
    languageTrigger,
    "Escape must return focus to the language trigger",
  );

  const themeTrigger = page.getByRole("button", {
    name: /^(Lichte modus|Donkere modus|Systeemthema|Light mode|Dark mode|System theme)$/,
  });
  await themeTrigger.click();
  await page.getByRole("listbox").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.getByRole("listbox").waitFor({ state: "hidden" });
  await assertActiveElement(themeTrigger, "Escape must return focus to the theme trigger");
}

async function submitAndReadAlert(form, submitName) {
  await form.getByRole("button", { name: submitName, exact: true }).click();
  const alert = form.getByRole("alert");
  await alert.waitFor({ state: "visible" });
  return (await alert.innerText()).trim();
}

async function assertContactClientValidation(page, copy) {
  const form = page.getByRole("form", { name: copy.formLabel, exact: true });

  assert.match(await submitAndReadAlert(form, copy.submit), copy.nameError);

  await form.locator("#default-name").fill("Browser Audit");
  await form.locator("#default-company").fill("BelgoBase Audit");
  await form.locator("#default-email").fill("audit@example.test");

  const phone = form.locator("#default-phone");
  await phone.evaluate((element) => element.removeAttribute("maxlength"));
  await phone.fill("1".repeat(51));
  assert.match(await submitAndReadAlert(form, copy.submit), copy.phoneError);

  await phone.fill("");
  assert.equal(await form.locator('input[type="checkbox"]').isChecked(), false);
  assert.match(await submitAndReadAlert(form, copy.submit), copy.privacyError);
}

async function auditMarketingLocale({ page, appOrigin, artifactDirectory, locale }) {
  const copy = LOCALES[locale];
  await goto(page, `${appOrigin}/${locale}`);

  const targets = await assertHomeTargets(page, appOrigin, locale);
  await assertFaq(page, copy);
  await assertProductVideo(page);
  await assertMobileControls(page, copy);
  await assertContactClientValidation(page, copy);

  // Visit the page as a person scrolling would; off-screen reveal animations
  // must not leave a section's heading invisible when it reaches the viewport.
  const headings=page.locator('main h2, main h3');
  for(let index=0;index<await headings.count();index++) {
    const heading=headings.nth(index);
    if(!await heading.isVisible()) continue;
    await heading.scrollIntoViewIfNeeded();
    const revealed=await heading.evaluate(async element=>{
      const deadline=performance.now()+2500;
      while(performance.now()<deadline) {
        let current=element, opacity=1;
        while(current){opacity*=Number(getComputedStyle(current).opacity);current=current.parentElement;}
        if(opacity>.98)return true;
        await new Promise(resolve=>requestAnimationFrame(resolve));
      }
      return false;
    });
    assert.equal(revealed,true,'Heading remains visible after scrolling: '+await heading.innerText());
  }
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));

  await page.screenshot({
    path: path.join(artifactDirectory, `public-site-${locale}-mobile.png`),
    fullPage: true,
  });

  return {
    locale,
    sectionTargets: targets,
    faqQuestions: 9,
    productVideoToggle: "open-close",
    mobileControls: "menu-language-theme Escape focus",
    contactValidation: "empty-name, oversized-phone, unchecked-privacy",
  };
}

async function assertLanguageSwitch(page, appOrigin) {
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, `${appOrigin}/nl?audit=public#pricing`);
  await page.getByRole("button", { name: "Taal kiezen", exact: true }).click();
  await Promise.all([
    page.waitForURL(`${appOrigin}/en?audit=public#pricing`),
    page.getByRole("option", { name: /English$/ }).click(),
  ]);
  assert.equal(new URL(page.url()).pathname, "/en");
  assert.equal(new URL(page.url()).search, "?audit=public");
  assert.equal(new URL(page.url()).hash, "#pricing");

  await page.getByRole("button", { name: "Select language", exact: true }).click();
  await Promise.all([
    page.waitForURL(`${appOrigin}/nl?audit=public#pricing`),
    page.getByRole("option", { name: /Nederlands$/ }).click(),
  ]);
  assert.equal(new URL(page.url()).pathname, "/nl");
  assert.equal(new URL(page.url()).search, "?audit=public");
  assert.equal(new URL(page.url()).hash, "#pricing");
}

async function cookieValue(context, appOrigin, name) {
  const cookies = await context.cookies(appOrigin);
  return cookies.find((cookie) => cookie.name === name)?.value;
}

async function selectTheme(page, label) {
  const trigger = page.getByRole("button", {
    name: /^(Lichte modus|Donkere modus|Systeemthema|Light mode|Dark mode|System theme)$/,
  });
  await trigger.click();
  const option = page.getByRole("option", { name: label, exact: true });
  await option.click();
  await assertActiveElement(trigger, `Selecting ${label} must return focus to the trigger`);
}

async function assertThemePersistence(page, context, appOrigin) {
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, `${appOrigin}/nl`);

  await selectTheme(page, LOCALES.nl.themeDark);
  await page.locator("html.dark").waitFor({ state: "attached" });
  assert.equal(await cookieValue(context, appOrigin, "belgobase-theme"), "dark");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("html.dark").waitFor({ state: "attached" });
  assert.equal(await cookieValue(context, appOrigin, "belgobase-theme"), "dark");

  await page.emulateMedia({ colorScheme: "dark" });
  await selectTheme(page, LOCALES.nl.themeSystem);
  await page.locator("html.dark").waitFor({ state: "attached" });
  assert.equal(await cookieValue(context, appOrigin, "belgobase-theme"), "system");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("html.dark").waitFor({ state: "attached" });
  assert.equal(await cookieValue(context, appOrigin, "belgobase-theme"), "system");

  return { darkReload: true, systemDarkReload: true, cookie: "system" };
}

async function auditLegalRoutes(page, appOrigin) {
  const pdfHrefs = new Set();
  const routes = [];

  for (const locale of Object.keys(LOCALES)) {
    for (const route of LEGAL_ROUTES) {
      await goto(page, `${appOrigin}/${locale}/${route}`);
      const links = await page.locator('a[href^="/legal/current/"]').evaluateAll((elements) =>
        elements.map((element) => ({
          href: element.getAttribute("href"),
          hrefLang: element.getAttribute("hreflang"),
          target: element.getAttribute("target"),
          rel: element.getAttribute("rel"),
          download: element.hasAttribute("download"),
        })),
      );

      const expectedCount = route === "terms" ? 12 : 6;
      assert.equal(
        links.length,
        expectedCount,
        `/${locale}/${route} must expose all translated PDF read/download links`,
      );
      for (const link of links) {
        assert.ok(link.href?.endsWith(".pdf"), `Invalid PDF href on /${locale}/${route}`);
        assert.match(link.hrefLang ?? "", /^(nl|fr|en)$/);
        pdfHrefs.add(link.href);
        if (link.download) {
          assert.equal(link.target, null, "Download links should not open a new tab");
        } else {
          assert.equal(link.target, "_blank", "Read links should open in a new tab");
          assert.match(link.rel ?? "", /noreferrer/);
        }
      }

      routes.push({ locale, route, pdfLinks: links.length });
    }
  }

  for (const href of [...pdfHrefs].sort()) {
    const response = await page.request.head(`${appOrigin}${href}`);
    assert.equal(response.status(), 200, `${href} must be served locally`);
    assert.match(
      response.headers()["content-type"] ?? "",
      /application\/pdf/i,
      `${href} must have a PDF content type`,
    );
  }

  return { routes, uniquePdfFiles: pdfHrefs.size };
}

export async function auditPublicSite({ page, context, appOrigin, artifactDirectory }) {
  assert.ok(page, "auditPublicSite requires a Playwright page");
  assert.ok(context, "auditPublicSite requires a Playwright browser context");
  assert.ok(appOrigin, "auditPublicSite requires appOrigin");
  assert.ok(artifactDirectory, "auditPublicSite requires artifactDirectory");

  const origin = new URL(appOrigin).origin;
  assert.match(origin, /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i, "Public-site audit is loopback-only");
  await mkdir(artifactDirectory, { recursive: true });

  const originalViewport = page.viewportSize();
  const publicPosts = [];
  const onRequest = (request) => {
    if (request.method() !== "POST") return;
    const requestUrl = new URL(request.url());
    if (requestUrl.origin === origin) {
      publicPosts.push({ url: request.url(), nextAction: request.headers()["next-action"] ?? null });
    }
  };
  page.on("request", onRequest);

  try {
    const marketing = [];
    for (const locale of Object.keys(LOCALES)) {
      marketing.push(
        await auditMarketingLocale({
          page,
          appOrigin: origin,
          artifactDirectory,
          locale,
        }),
      );
    }

    await assertLanguageSwitch(page, origin);
    const theme = await assertThemePersistence(page, context, origin);
    const legal = await auditLegalRoutes(page, origin);

    assert.deepEqual(
      publicPosts,
      [],
      "Client-invalid contact submissions must not invoke a public POST or server action",
    );

    const report = {
      appOrigin: origin,
      marketing,
      languageSwitch: "NL to EN and EN to NL preserve query and hash",
      theme,
      legal,
      contactDeliveryStates: {
        status: "not exercised",
        reason: "Success and server-failure UI require a controlled Next server-action stub; no real or valid contact submission was made.",
      },
      publicPostRequests: publicPosts,
    };
    await writeFile(
      path.join(artifactDirectory, "public-site-flows.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    return report;
  } catch (error) {
    await writeFile(path.join(artifactDirectory,'public-site-failure.json'),JSON.stringify({url:page.url(),error:String(error),options:await page.getByRole('option').allTextContents()},null,2));
    await page
      .screenshot({ path: path.join(artifactDirectory, "public-site-flows-failure.png"), fullPage: true })
      .catch(() => {});
    throw error;
  } finally {
    page.off("request", onRequest);
    await page.emulateMedia({ colorScheme: "light" }).catch(() => {});
    if (originalViewport) {
      await page.setViewportSize(originalViewport).catch(() => {});
    }
  }
}
