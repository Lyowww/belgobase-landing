import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  getMarketingMeasurementConfig, setMarketingConsent, suspendMarketingMeasurement,
  syncMarketingMeasurementForPath, trackPublicCompanyAction,
} from "../src/lib/marketing-measurement.ts";

const config = getMarketingMeasurementConfig();
const consent = (analytics, ads = false) => ({ version: 2, analytics, ads });
const events = () => (window.dataLayer ?? []).map((command) => Array.from(command)).filter((item) => item[0] === "event");

class TestElement {
  constructor(action, parent = null) { this.action = action; this.parent = parent; }
  closest(selector) { return selector === "a[href]" ? this.parent ?? this : null; }
  getAttribute(name) {
    if (name === "data-company-action") return this.action;
    // A tracked mail URL could contain an enterprise identity: never read it.
    throw new Error(`Unexpected link content read: ${name}`);
  }
}

function browser(locale = "nl") {
  const cookies = new Map();
  const scripts = new Map();
  const document = new EventTarget();
  const listeners = [];
  const add = document.addEventListener.bind(document);
  document.addEventListener = (type, handler, capture) => { listeners.push({ type, capture }); add(type, handler, capture); };
  Object.defineProperty(document, "cookie", {
    get: () => [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
    set: (raw) => {
      const [pair] = raw.split(";"); const [key, value] = pair.split("=");
      if (raw.includes("Max-Age=0")) cookies.delete(key); else cookies.set(key, value);
    },
  });
  document.referrer = "https://www.google.com/search?q=private_search";
  document.getElementById = (id) => scripts.get(id);
  document.createElement = () => ({ remove() { scripts.delete(this.id); } });
  document.head = { appendChild: (script) => scripts.set(script.id, script) };
  const window = new EventTarget();
  window.location = {
    protocol: "https:", hostname: "www.belgobase.com", pathname: `/${locale}/bedrijf-zoeken`,
    href: `https://www.belgobase.com/${locale}/bedrijf-zoeken?query=PRIVATE_COMPANY&email=private@example.com#PRIVATE_NUMBER`,
    reload() {},
  };
  window.sessionStorage = { length: 0 };
  globalThis.window = window; globalThis.document = document; globalThis.Element = TestElement;
  return { listeners, scripts, click(action) {
    const event = new Event("click", { cancelable: true });
    Object.defineProperty(event, "target", { value: new TestElement(null, new TestElement(action)) });
    document.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, "measurement never blocks a phone, email or page link");
  } };
}

afterEach(() => { suspendMarketingMeasurement(); });

test("lookup actions are absent without analytics consent, including ads-only consent", () => {
  browser();
  for (const preference of [consent(false), consent(false, true)]) {
    setMarketingConsent(preference, config);
    assert.equal(trackPublicCompanyAction("success"), false);
    assert.equal(trackPublicCompanyAction("email"), false);
  }
  assert.equal(events().length, 0);
});

test("all lookup steps and contact destinations use fixed safe events in all three languages", () => {
  for (const locale of ["nl", "fr", "en"]) {
    browser(locale); setMarketingConsent(consent(true), config);
    for (const action of ["submit", "success", "matches", "not_found", "limited", "error", "peers_open", "peer_select", "copy_number", "belgobase", "phone", "email", "kbo", "nbb", "website"]) {
      assert.equal(trackPublicCompanyAction(action), true);
    }
    assert.equal(events().length, 16); // one page view plus fifteen real actions
    const payload = JSON.stringify(events());
    assert.doesNotMatch(payload, /PRIVATE_|private@example|private_search|nummer=|mailto:|tel:/);
    assert.equal(events().some((event) => event[1] === "conversion" || event[1] === "generate_lead"), false);
    assert.equal(trackPublicCompanyAction("constructor"), false);
    assert.equal(trackPublicCompanyAction("PRIVATE_COMPANY"), false);
    suspendMarketingMeasurement();
  }
});

test("nested-icon link clicks are captured once without reading href or blocking navigation", () => {
  const state = browser(); setMarketingConsent(consent(true), config);
  assert.deepEqual(state.listeners.find((entry) => entry.type === "click"), { type: "click", capture: true });
  for (const action of ["belgobase", "phone", "email"]) state.click(action);
  assert.deepEqual(events().filter((event) => event[1] === "cta_click").map((event) => event[2].cta_name), ["lookup_belgobase", "lookup_phone", "lookup_email"]);
  syncMarketingMeasurementForPath(window.location.pathname);
  state.click("email");
  assert.equal(events().filter((event) => event[1] === "cta_click").length, 4);
});

test("history updates do not duplicate page views; navigation and withdrawal end lookup collection", () => {
  const state = browser(); setMarketingConsent(consent(true), config);
  syncMarketingMeasurementForPath(window.location.pathname);
  assert.equal(events().filter((event) => event[1] === "page_view").length, 1);
  window.location.pathname = "/nl/prospectielijsten";
  window.location.href = "https://www.belgobase.com/nl/prospectielijsten";
  syncMarketingMeasurementForPath(window.location.pathname);
  assert.equal(trackPublicCompanyAction("email"), false);
  assert.equal(events().filter((event) => event[1] === "page_view").length, 2);
  window.location.pathname = "/nl/bedrijf-zoeken";
  window.location.href = "https://www.belgobase.com/nl/bedrijf-zoeken";
  syncMarketingMeasurementForPath(window.location.pathname);
  setMarketingConsent(consent(false), config);
  const before = events().length;
  state.click("phone");
  assert.equal(events().length, before);
  assert.equal(state.scripts.size, 0);
  window.location.pathname = "/nl/app";
  assert.equal(syncMarketingMeasurementForPath(window.location.pathname), false);
  assert.equal(trackPublicCompanyAction("success"), false);
});
