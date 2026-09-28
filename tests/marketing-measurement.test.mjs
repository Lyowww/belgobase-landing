import assert from "node:assert/strict";
import test from "node:test";
import {
  extractGoogleClickIds,
  getMarketingMeasurementConfig,
  initializeMarketingMeasurement,
  isMarketingPublicPathname,
  MARKETING_CONSENT_MAX_AGE_SECONDS,
  readMarketingConsent,
  sanitizePageUrl,
  setMarketingConsent,
  syncMarketingMeasurementForPath,
  trackGoogleAdsConversion,
} from "../src/lib/marketing-measurement.ts";

const config = getMarketingMeasurementConfig("AW-828167396", "XPY8CP6Gj4kdEOSp84oD");

function installBrowser(pathname = "/nl", search = "") {
  const cookieJar = new Map();
  const scripts = new Map();
  const session = new Map();
  const cookieWrites = [];
  let reloads = 0;

  const document = {
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
        remove() {
          scripts.delete(this.id);
        },
      };
    },
    getElementById(id) {
      return scripts.get(id) ?? null;
    },
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
    reload() {
      reloads += 1;
    },
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

test("measurement configuration and route allowlist fail closed", () => {
  assert.deepEqual(config, {
    adsId: "AW-828167396",
    conversionLabel: "XPY8CP6Gj4kdEOSp84oD",
    conversionDestination: "AW-828167396/XPY8CP6Gj4kdEOSp84oD",
  });
  assert.equal(getMarketingMeasurementConfig("G-123", "validLabel"), null);
  assert.equal(getMarketingMeasurementConfig("AW-828167396", "bad/label"), null);
  assert.equal(getMarketingMeasurementConfig("", ""), null);
  assert.equal(getMarketingMeasurementConfig("", "XPY8CP6Gj4kdEOSp84oD"), null);
  assert.equal(isMarketingPublicPathname("/nl"), true);
  assert.equal(isMarketingPublicPathname("/en/prospectielijsten"), true);
  assert.equal(isMarketingPublicPathname("/nl/app"), false);
  assert.equal(isMarketingPublicPathname("/en/account"), false);
  assert.equal(isMarketingPublicPathname("/nl/privacy"), false);
  assert.equal(MARKETING_CONSENT_MAX_AGE_SECONDS, 15_552_000);
});

test("an explicit empty public environment value remains a kill switch", () => {
  const originalId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const originalLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL;
  try {
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "";
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL = "";
    assert.equal(getMarketingMeasurementConfig(), null);
  } finally {
    if (originalId === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    else process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = originalId;
    if (originalLabel === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL;
    else process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL = originalLabel;
  }
});

test("page URL drops every query value while allowlisted click IDs remain available locally", () => {
  const raw = "https://www.belgobase.be/nl?gclid=abc_123&utm_term=private+search&email=person@example.com#contact";
  assert.equal(sanitizePageUrl(raw), "https://www.belgobase.be/nl");
  assert.deepEqual(extractGoogleClickIds(raw), { gclid: "abc_123" });
  assert.deepEqual(extractGoogleClickIds("https://www.belgobase.be/nl?gclid=bad%20value"), {});
});

test("reject makes no Google object or network-capable script", () => {
  const browser = installBrowser();
  assert.equal(initializeMarketingMeasurement(config), false);
  assert.equal(setMarketingConsent("denied"), true);
  assert.equal(readMarketingConsent(), "denied");
  assert.equal(browser.scripts.size, 0);
  assert.equal(browser.window.dataLayer, undefined);
  assert.equal(browser.window.gtag, undefined);
});

test("grant initializes Basic consent, sends one sanitized conversion, and withdrawal stops it", () => {
  const browser = installBrowser("/nl", "?gclid=click_123&email=person@example.com#contact");
  assert.equal(setMarketingConsent("granted", config), true);
  assert.equal(browser.scripts.size, 1);
  assert.equal(browser.window.__bbGoogleAdsActive, true);

  const commands = browser.window.dataLayer;
  assert.deepEqual(commands[0], ["consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  }]);
  assert.deepEqual(commands[2], ["consent", "update", {
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "denied",
    analytics_storage: "denied",
  }]);
  assert.equal(
    commands.some((command) => command[0] === "set" && command[1] === "user_data"),
    false,
  );
  assert.equal(JSON.stringify(commands).includes("person@example.com"), false);

  const conversionId = "f343d8ee-d4ad-4cab-9f49-a45d85f05132";
  assert.equal(trackGoogleAdsConversion(conversionId, config), true);
  assert.equal(trackGoogleAdsConversion(conversionId, config), false);
  const conversion = commands.find((command) => command[0] === "event");
  assert.deepEqual(conversion, ["event", "conversion", {
    currency: "EUR",
    page_location: "https://www.belgobase.be/nl",
    page_referrer: "",
    send_to: "AW-828167396/XPY8CP6Gj4kdEOSp84oD",
    transaction_id: conversionId,
    value: 0,
  }]);

  browser.document.cookie = "_gcl_au=marketing-cookie; Path=/";
  assert.equal(setMarketingConsent("denied"), true);
  assert.equal(browser.window.__bbGoogleAdsActive, false);
  assert.equal(browser.scripts.size, 0);
  assert.equal(browser.cookieJar.has("_gcl_au"), false);
  assert.equal(browser.reloads(), 1);
  assert.deepEqual(
    commands.filter((command) => command[0] === "consent" && command[1] === "update").at(-1),
    ["consent", "update", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    }],
  );
  assert.equal(
    browser.cookieWrites.some((write) => write.includes("Domain=.belgobase.be")),
    true,
  );
  assert.equal(trackGoogleAdsConversion("2fc534ef-f51f-42c8-8aec-3596efff1ff3", config), false);
});

test("client navigation to a private route unloads the inherited tag with one hard reload", () => {
  const browser = installBrowser();
  setMarketingConsent("granted", config);
  browser.location.pathname = "/nl/app";
  browser.location.href = "https://www.belgobase.be/nl/app";
  assert.equal(syncMarketingMeasurementForPath("/nl/app"), false);
  assert.equal(browser.scripts.size, 0);
  assert.equal(browser.reloads(), 1);
});

test("a vendor exception stays isolated from the delivered form", () => {
  const browser = installBrowser();
  setMarketingConsent("granted", config);
  browser.window.gtag = () => { throw new Error("vendor unavailable"); };
  assert.equal(
    trackGoogleAdsConversion("95975f43-fcc6-4fc6-83f0-f16fb37253cd", config),
    false,
  );
});
