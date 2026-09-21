import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { buildAdminNotificationHtml } from "../src/lib/email/templates.ts";
import { contactDeliveryState } from "../src/lib/contact-state.ts";
import {
  buildThemePreferenceCookie,
  isTheme,
  resolveTheme,
} from "../src/lib/theme.ts";
import {
  getLocalizedBrowserHref,
  getLocalizedPath,
} from "../src/lib/locale-path.ts";
import {
  CONTACT_FIELD_LIMITS,
  contactFormSchema,
} from "../src/lib/validations/contact.ts";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("public routes and section controls resolve to owned targets", async () => {
  const [header, hero, sections, footer] = await Promise.all([
    source("src/components/layout/Header.tsx"),
    source("src/components/visuals/HeroVisualization.tsx"),
    Promise.all([
      "Process",
      "Industries",
      "Results",
      "Pricing",
      "FAQ",
      "FinalCTA",
    ].map((name) => source(`src/components/sections/${name}.tsx`))).then((parts) => parts.join("\n")),
    source("src/components/layout/Footer.tsx"),
  ]);
  const targets = `${hero}\n${sections}`;

  for (const id of ["process", "industries", "database", "pricing", "faq", "contact", "product-demonstration"]) {
    assert.match(targets, new RegExp(`id=["']${id}["']`), id);
  }
  for (const href of ["#process", "#industries", "#database", "#pricing", "#contact"]) {
    assert.equal(
      header.includes(`href: "${href}"`) || header.includes(`href="${href}"`),
      true,
      href,
    );
  }
  assert.equal(footer.includes('href={`/${locale}#faq`}'), true);

  for (const route of ["", "privacy", "terms", "cookies", "legal", "app"]) {
    const suffix = route ? `/${route}` : "";
    await access(new URL(`src/app/[locale]${suffix}/page.tsx`, root));
  }
});

test("current legal documents exist in every language offered by the legal page", async () => {
  const basenames = [
    "belgobase-algemene-voorwaarden-b2b",
    "belgobase-gebruiksvoorwaarden",
    "belgobase-privacyverklaring",
    "belgobase-cookieverklaring",
    "belgobase-website-legal-notice",
  ];
  await Promise.all(
    ["nl", "fr", "en"].flatMap((locale) =>
      basenames.map((basename) =>
        access(new URL(`public/legal/current/${locale}/${basename}.pdf`, root)),
      ),
    ),
  );
});

test("locale changes retain the current route, query and section", () => {
  assert.equal(getLocalizedPath("/en/privacy", "nl"), "/nl/privacy");
  assert.equal(getLocalizedPath("/legal", "en"), "/en/legal");
  assert.equal(
    getLocalizedBrowserHref("/en", "nl", "?source=demo", "#pricing"),
    "/nl?source=demo#pricing",
  );
});

test("light, dark and system theme preferences survive cookie round trips", () => {
  for (const theme of ["light", "dark", "system"]) {
    const cookie = buildThemePreferenceCookie(theme, true);
    assert.match(cookie, new RegExp(`^belgobase-theme=${theme};`));
    assert.match(cookie, /max-age=15552000/);
    assert.match(cookie, /;Secure$/);
    assert.equal(isTheme(theme), true);
  }
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});

test("contact validation, failure UI and notification HTML remain safe without sending mail", async () => {
  const oversizedPhone = contactFormSchema.safeParse({
    name: "Ada Lovelace",
    email: "ada@example.test",
    company: "Analytical Engines",
    phone: "1".repeat(CONTACT_FIELD_LIMITS.phone + 1),
    gdprConfirm: "on",
    requestType: "sample",
    website: "",
  });
  assert.equal(oversizedPhone.success, false);
  assert.deepEqual(contactDeliveryState(false), {
    success: false,
    message: "errorMessage",
  });
  assert.deepEqual(contactDeliveryState(true), {
    success: true,
    message: "successMessage",
  });

  const html = buildAdminNotificationHtml({
    name: "<script>alert(1)</script>",
    email: "ada@example.test",
    company: "A&B",
    phone: null,
    requestType: "sample",
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /A&amp;B/);

  const [form, action] = await Promise.all([
    source("src/components/forms/ProgressiveContactForm.tsx"),
    source("src/app/actions/contact.ts"),
  ]);
  assert.match(form, /state\.errors\?\.phone/);
  assert.match(form, /translateError\("phoneMax"\)/);
  assert.match(form, /state\.message && !state\.errors/);
  assert.match(action, /if \(!result\.ok\)/);
  assert.match(action, /contactDeliveryState\(true\)/);
});

test("English legal metadata describes the actually offered translations", async () => {
  const pages = await Promise.all(
    ["privacy", "terms", "cookies", "legal"].map((route) =>
      source(`src/app/[locale]/${route}/page.tsx`),
    ),
  );
  for (const page of pages) {
    assert.doesNotMatch(page, /available in Dutch\./);
    assert.match(page, /Dutch, French or English/);
  }
});

test("English and Dutch public dictionaries expose the same controls", async () => {
  const [english, dutch] = await Promise.all([
    source("src/messages/en.json").then(JSON.parse),
    source("src/messages/nl.json").then(JSON.parse),
  ]);
  const keys = (value, prefix = "") => Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? keys(child, path)
      : [path];
  });
  assert.deepEqual(keys(english).sort(), keys(dutch).sort());
  for (const key of [
    "nav.openMenu",
    "nav.closeMenu",
    "form.submit",
    "form.successTitle",
    "validation.errorMessage",
    "theme.system",
    "language.select",
  ]) {
    const read = (value) => key.split(".").reduce((current, part) => current?.[part], value);
    assert.equal(typeof read(english), "string", `en ${key}`);
    assert.equal(typeof read(dutch), "string", `nl ${key}`);
  }
});

test("mobile and preference controls retain their keyboard escape path", async () => {
  const [header, language, theme, hero, legal] = await Promise.all([
    source("src/components/layout/Header.tsx"),
    source("src/components/i18n/LanguageSwitcher.tsx"),
    source("src/components/theme/ThemeToggle.tsx"),
    source("src/components/visuals/HeroVisualization.tsx"),
    source("src/components/legal/LegalPage.tsx"),
  ]);
  assert.match(header, /event\.key === "Escape" && mobileOpen/);
  assert.match(header, /mobileMenuButtonRef\.current\?\.focus\(\)/);
  assert.match(header, /document\.body\.style\.overflow = "hidden"/);
  assert.match(header, /100dvh/);
  assert.match(header, /overscroll-contain/);
  for (const dropdown of [language, theme]) {
    assert.match(dropdown, /event\.key !== "Escape"/);
    assert.match(dropdown, /triggerRef\.current\?\.focus\(\)/);
  }
  assert.match(hero, /aria-expanded={demoOpen}/);
  assert.match(hero, /aria-controls="hero-product-demo"/);
  assert.match(legal, /target="_blank" rel="noreferrer"/);
  assert.match(legal, /download hrefLang=/);
});

test("SEO routing keeps localized canonicals public and the app out of sitemap discovery", async () => {
  const [metadata, routes, robots] = await Promise.all([
    source("src/lib/seo/metadata.ts"),
    source("src/lib/seo/routes.ts"),
    source("src/app/robots.ts"),
  ]);
  assert.match(metadata, /en:\s*`\$\{siteUrl\}\/en\$\{suffix\}`/);
  assert.match(metadata, /nl:\s*`\$\{siteUrl\}\/nl\$\{suffix\}`/);
  assert.match(metadata, /"x-default":\s*`\$\{siteUrl\}\/en\$\{suffix\}`/);
  assert.match(routes, /IGNORED_ROUTE_DIRS = new Set\(\["api", "app"\]\)/);
  assert.match(robots, /isProduction/);
  assert.match(robots, /disallow:\s*"\/"/);
  assert.match(robots, /allow:\s*"\/"/);
});
