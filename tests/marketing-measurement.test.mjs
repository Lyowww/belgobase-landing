import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  clearDisabledMarketingStorage,
  extractGoogleClickIds,
  getMarketingMeasurementConfig,
  initializeMarketingMeasurement,
  isMarketingPublicPathname,
  marketingVideoId,
  MARKETING_CONSENT_MAX_AGE_SECONDS,
  readMarketingConsent,
  sanitizePageUrl,
  sanitizeMeasurementPageUrl,
  sanitizeReferrerHost,
  setMarketingConsent,
  syncMarketingMeasurementForPath,
  trackGoogleAdsConversion,
} from "../src/lib/marketing-measurement.ts";
import {
  publicPageSecurityHeaders,
  workspaceShellSecurityHeaders,
} from "../src/lib/security-headers.ts";

const adsId = "AW-828167396";
const label = "XPY8CP6Gj4kdEOSp84oD";
const ga4Id = "G-Q1NX0JS1G8";
const config = getMarketingMeasurementConfig(adsId, label, ga4Id, true);
const none = { version: 2, analytics: false, ads: false };
const analyticsOnly = { version: 2, analytics: true, ads: false };
const adsOnly = { version: 2, analytics: false, ads: true };
const all = { version: 2, analytics: true, ads: true };

function installBrowser(pathname = "/nl", search = "", referrer = "") {
  const cookieJar = new Map();
  const scripts = new Map();
  const session = new Map();
  const cookieWrites = [];
  let reloads = 0;
  const document = {
    referrer,
    get cookie() {
      return [...cookieJar].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    set cookie(raw) {
      cookieWrites.push(raw);
      const [pair, ...attributes] = raw.split(";").map((part) => part.trim());
      const separator = pair.indexOf("=");
      const name = decodeURIComponent(pair.slice(0, separator));
      const value = pair.slice(separator + 1);
      if (attributes.some((attribute) => attribute.toLowerCase() === "max-age=0")) {
        cookieJar.delete(name);
      } else {
        cookieJar.set(name, value);
      }
    },
    createElement(tagName) {
      assert.equal(tagName, "script");
      return {
        async: false,
        id: "",
        src: "",
        remove() { scripts.delete(this.id); },
      };
    },
    getElementById(id) { return scripts.get(id) ?? null; },
    head: {
      appendChild(element) {
        scripts.set(element.id, element);
        return element;
      },
    },
  };
  const location = {
    protocol: "https:",
    hostname: "www.belgobase.be",
    origin: "https://www.belgobase.be",
    pathname,
    href: `https://www.belgobase.be${pathname}${search}`,
    reload() { reloads += 1; },
  };
  const window = {
    location,
    sessionStorage: {
      get length() { return session.size; },
      getItem(key) { return session.get(key) ?? null; },
      setItem(key, value) { session.set(key, value); },
      removeItem(key) { session.delete(key); },
      key(index) { return [...session.keys()][index] ?? null; },
    },
  };
  globalThis.document = document;
  globalThis.window = window;
  return { cookieJar, cookieWrites, document, location, scripts, session, window, reloads: () => reloads };
}

const commands = (browser) =>
  (browser.window.dataLayer ?? []).map((command) => Array.from(command));

test("configuration, explicit kill switches and route allowlist fail closed", () => {
  assert.deepEqual(config, {
    adsId,
    conversionLabel: label,
    conversionDestination: `${adsId}/${label}`,
    ga4MeasurementId: ga4Id,
  });
  assert.equal(getMarketingMeasurementConfig(adsId, label, "", true)?.ga4MeasurementId, null);
  assert.equal(getMarketingMeasurementConfig(adsId, label, "G-bad", true), null);
  assert.equal(getMarketingMeasurementConfig(adsId, label, ga4Id, false), null);
  assert.equal(getMarketingMeasurementConfig("G-123", label, ga4Id, true), null);
  assert.equal(getMarketingMeasurementConfig(adsId, "bad/label", ga4Id, true), null);
  assert.equal(isMarketingPublicPathname("/nl"), true);
  assert.equal(isMarketingPublicPathname("/en/prospectielijsten"), true);
  assert.equal(isMarketingPublicPathname("/nl/app"), false);
  assert.equal(isMarketingPublicPathname("/en/account"), false);
  assert.equal(isMarketingPublicPathname("/nl/privacy"), false);
  assert.equal(MARKETING_CONSENT_MAX_AGE_SECONDS, 15_552_000);
});

test("safe URLs discard queries and referrers retain only a valid origin", () => {
  const raw = "https://www.belgobase.be/nl?gclid=abc_123&utm_term=private+search&email=person@example.com#contact";
  assert.equal(sanitizePageUrl(raw), "https://www.belgobase.be/nl");
  assert.equal(sanitizeMeasurementPageUrl(raw, false), "https://www.belgobase.be/nl");
  assert.equal(sanitizeMeasurementPageUrl(raw, true), "https://www.belgobase.be/nl?gclid=abc_123");
  assert.equal(
    sanitizeMeasurementPageUrl("https://www.belgobase.be/nl?gbraid=braid.1&wbraid=w~2&utm_term=secret&email=x@y.be#contact", true),
    "https://www.belgobase.be/nl?gbraid=braid.1&wbraid=w%7E2",
  );
  assert.equal(
    sanitizeMeasurementPageUrl("https://www.belgobase.be/nl?gclid=bad%20value&email=x@y.be", true),
    "https://www.belgobase.be/nl",
  );
  assert.equal(sanitizeReferrerHost("https://partner.example/private/path?email=x@y.be"), "https://partner.example");
  assert.equal(sanitizeReferrerHost("javascript:alert(1)"), "");
  assert.deepEqual(extractGoogleClickIds(raw), { gclid: "abc_123" });
  assert.deepEqual(extractGoogleClickIds("https://www.belgobase.be/nl?gclid=bad%20value"), {});
});

test("legacy consent is ignored and rejecting creates no Google network-capable object", () => {
  const browser = installBrowser();
  browser.document.cookie = "bb_marketing_consent=granted; Path=/";
  assert.equal(readMarketingConsent(), null);
  assert.equal(initializeMarketingMeasurement(config), false);
  assert.equal(setMarketingConsent(none, config), true);
  assert.deepEqual(readMarketingConsent(), none);
  assert.equal(browser.scripts.size, 0);
  assert.equal(browser.window.dataLayer, undefined);
  assert.equal(browser.window.gtag, undefined);
  assert.equal(browser.cookieJar.has("bb_marketing_consent"), false);
});

test("analytics-only consent configures privacy controls and one safe initial page view", () => {
  const browser = installBrowser(
    "/nl",
    "?email=person@example.com&utm_term=private#contact",
    "https://partner.example/private/path?client=secret",
  );
  assert.equal(setMarketingConsent(analyticsOnly, config), true);
  assert.equal(browser.scripts.size, 1);
  assert.match([...browser.scripts.values()][0].src, /G-Q1NX0JS1G8/);
  const queued = commands(browser);
  assert.deepEqual(queued.find((item) => item[0] === "consent" && item[1] === "update"), [
    "consent", "update", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted",
    },
  ]);
  const gaConfig = queued.find((item) => item[0] === "config" && item[1] === ga4Id);
  assert.deepEqual(gaConfig[2], {
    allow_ad_personalization_signals: false,
    allow_google_signals: false,
    anonymize_ip: true,
    cookie_expires: 15_552_000,
    page_location: "https://www.belgobase.be/nl",
    page_referrer: "https://partner.example",
    send_page_view: false,
  });
  const pageView = queued.find((item) => item[0] === "event" && item[1] === "page_view");
  assert.deepEqual(pageView[2], {
    page_referrer: "https://partner.example",
    page_location: "https://www.belgobase.be/nl",
    send_to: ga4Id,
  });
  assert.equal(JSON.stringify(queued).includes("person@example.com"), false);
  assert.equal(queued.some((item) => item[0] === "event" && item[1] === "engagement_time"), false);
  assert.equal(queued.some((item) => item[0] === "config" && item[1] === adsId), false);
});

test("GA4 collection hosts are limited to public pages", () => {
  const publicCsp = publicPageSecurityHeaders["Content-Security-Policy"];
  assert.match(publicCsp, /https:\/\/www\.google-analytics\.com/);
  assert.match(publicCsp, /https:\/\/region1\.google-analytics\.com/);
  assert.match(publicCsp, /https:\/\/region1\.analytics\.google\.com/);
  assert.doesNotMatch(workspaceShellSecurityHeaders["Content-Security-Policy"], /(?:google-analytics|analytics\.google)/);
});

test("ads-only consent never grants analytics and sends only the direct Ads lead", () => {
  const browser = installBrowser("/nl", "?gclid=click_123&email=person@example.com");
  setMarketingConsent(adsOnly, config);
  const id = "f343d8ee-d4ad-4cab-9f49-a45d85f05132";
  assert.equal(trackGoogleAdsConversion(id, config), true);
  assert.equal(trackGoogleAdsConversion(id, config), false);
  const queued = commands(browser);
  assert.equal(queued.some((item) => item[0] === "event" && item[1] === "generate_lead"), false);
  assert.deepEqual(queued.find((item) => item[0] === "event" && item[1] === "conversion"), [
    "event", "conversion", {
      currency: "EUR",
      page_location: "https://www.belgobase.be/nl?gclid=click_123",
      send_to: `${adsId}/${label}`,
      transaction_id: id,
      value: 0,
    },
  ]);
  assert.equal(JSON.stringify(queued).includes("person@example.com"), false);
});

test("combined consent preserves only a validated click ID for GA4 and Ads leads", () => {
  const browser = installBrowser("/nl", "?gclid=click_456&utm_term=secret&email=person@example.com#contact");
  setMarketingConsent(all, config);
  const id = "2fc534ef-f51f-42c8-8aec-3596efff1ff3";
  assert.equal(trackGoogleAdsConversion(id, config), true);
  assert.equal(trackGoogleAdsConversion(id, config), false);
  const leadEvents = commands(browser).filter((item) =>
    item[0] === "event" && (item[1] === "generate_lead" || item[1] === "conversion"));
  assert.equal(leadEvents.filter((item) => item[1] === "generate_lead").length, 1);
  assert.equal(leadEvents.filter((item) => item[1] === "conversion").length, 1);
  const gaLead = leadEvents.find((item) => item[1] === "generate_lead");
  assert.equal(gaLead[2].transaction_id, undefined);
  assert.equal(gaLead[2].page_location, "https://www.belgobase.be/nl?gclid=click_456");
  assert.equal(JSON.stringify(leadEvents).includes("person@example.com"), false);
  const pageView = commands(browser).find((item) => item[0] === "event" && item[1] === "page_view");
  assert.equal(pageView[2].page_location, "https://www.belgobase.be/nl?gclid=click_456");
});

test("only the two real demo wrappers map to fixed video event IDs", () => {
  assert.equal(marketingVideoId("product-demonstration"), "product_demonstration");
  assert.equal(marketingVideoId("list-cleanup-demo-card"), "list_cleanup");
  assert.equal(marketingVideoId("customer-supplied-id"), "");
});

test("SPA marketing navigation sends one page view per safe path and protects workspace", () => {
  const browser = installBrowser();
  setMarketingConsent(analyticsOnly, config);
  browser.location.pathname = "/nl/bedrijven-zoeken";
  browser.location.href = "https://www.belgobase.be/nl/bedrijven-zoeken?utm_source=secret";
  assert.equal(syncMarketingMeasurementForPath(browser.location.pathname), true);
  assert.equal(syncMarketingMeasurementForPath(browser.location.pathname), true);
  let pageViews = commands(browser).filter((item) => item[0] === "event" && item[1] === "page_view");
  assert.equal(pageViews.length, 2);
  assert.equal(pageViews[1][2].page_location, "https://www.belgobase.be/nl/bedrijven-zoeken");
  assert.equal(pageViews[1][2].page_referrer, "https://www.belgobase.be");
  browser.location.pathname = "/nl/app";
  browser.location.href = "https://www.belgobase.be/nl/app";
  assert.equal(syncMarketingMeasurementForPath("/nl/app"), false);
  assert.equal(browser.scripts.size, 0);
  assert.equal(browser.reloads(), 1);
});

test("withdrawal denies both storages, removes _ga and _gcl cookies, and reloads", () => {
  const browser = installBrowser();
  setMarketingConsent(all, config);
  browser.document.cookie = "_ga=analytics-cookie; Path=/";
  browser.document.cookie = "_gcl_au=ads-cookie; Path=/";
  assert.equal(setMarketingConsent(adsOnly, config), true);
  assert.equal(browser.window.__bbGoogleMeasurementActive, undefined);
  assert.equal(browser.scripts.size, 0);
  assert.equal(browser.cookieJar.has("_ga"), false);
  assert.equal(browser.cookieJar.has("_gcl_au"), false);
  assert.equal(browser.reloads(), 1);
  assert.deepEqual(
    commands(browser).filter((item) => item[0] === "consent" && item[1] === "update").at(-1),
    ["consent", "update", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    }],
  );
  assert.equal(browser.cookieWrites.some((write) => write.includes("Domain=.belgobase.be")), true);
});

test("disabled candidate cleans stored measurement state without loading Google", () => {
  const browser = installBrowser();
  browser.document.cookie = "bb_marketing_consent_v2=v2:a1:d1";
  browser.document.cookie = "_ga=old-analytics-cookie";
  browser.document.cookie = "_gcl_au=old-ads-cookie";
  browser.document.cookie = "bb_theme=dark";
  browser.session.set("bb-google-lead:ads:old", "sent");
  const disabled = getMarketingMeasurementConfig(adsId, label, ga4Id, false);
  assert.equal(initializeMarketingMeasurement(disabled), false);
  clearDisabledMarketingStorage();
  assert.equal(browser.scripts.size, 0);
  assert.equal(browser.window.gtag, undefined);
  assert.equal(browser.cookieJar.has("_ga"), false);
  assert.equal(browser.cookieJar.has("_gcl_au"), false);
  assert.equal(browser.cookieJar.has("bb_marketing_consent_v2"), false);
  assert.equal(browser.cookieJar.get("bb_theme"), "dark");
  assert.equal(browser.session.size, 0);
});

test("consent UI exposes equal reject, configure and allow-all choices", async () => {
  const source = await readFile(
    new URL("../src/components/marketing/MarketingConsent.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /reject: "Weigeren"/);
  assert.match(source, /acceptAll: "Alles toestaan"/);
  assert.match(source, /configure: "Instellen"/);
  assert.match(source, /analyticsTitle: "Website-analyse"/);
  assert.match(source, /adsTitle: "Advertentiemeting"/);
  assert.doesNotMatch(source, /person@example\.com|debug_mode|formData/);
});
