import test from "node:test";
import assert from "node:assert/strict";
import {
  lookupHistoryKey,
  lookupHistoryTtlMs,
  pushLookupHistory,
  readInitialLookupHistory,
  readLookupPopState,
  replaceCurrentLookupHistory,
} from "../src/lib/public-company/history.ts";

const context = { locale: "nl", url: "/nl/bedrijf-zoeken" };
const company = {
  number: "0869703978", name: "Voorbeeld BV", status: "Actief", legalForm: "BV", startDate: "2020-01-01",
  address: "Teststraat 1, 9000 Gent", website: "https://example.com", activities: [{ code: "62010", label: "Software" }],
  metrics: [{ key: "fte", label: "Personeel", value: 4.5, year: 2025, unit: "VTE" }], sources: { kboDate: "2026-10-15" },
  officialUrl: "https://ignored.example/private", privatePhone: "never keep",
};

function view(overrides = {}) {
  return {
    query: "Voorbeeld", matches: [{ number: company.number, name: company.name, municipality: "Gent", privateEmail: "no" }], company,
    officialNumber: "", error: "", expandedPeers: ["activity"], infoExpanded: true, activitiesExpanded: false, peerMethodExpanded: false,
    scrollY: 640, privateToken: "no", ...overrides,
  };
}

class FakeHistory {
  entries = [{ __NA: true, tree: ["next"] }];
  index = 0;
  get state() { return this.entries[this.index]; }
  replaceState(data) { this.entries[this.index] = structuredClone(data); }
  pushState(data) { this.entries.splice(++this.index); this.entries.push(structuredClone(data)); }
  back() { if (this.index > 0) this.index--; return { state: this.state }; }
  forward() { if (this.index + 1 < this.entries.length) this.index++; return { state: this.state }; }
}

test("replace initializes the current entry and preserves Next metadata", () => {
  const history = new FakeHistory();
  assert.equal(replaceCurrentLookupHistory(history, context, view(), 1_000), true);
  assert.deepEqual(history.state.__NA, true);
  assert.deepEqual(history.state.tree, ["next"]);
  assert.equal(readInitialLookupHistory(history.state, context, 1_001)?.company?.number, company.number);
});

test("push entries restore complete independent back and forward views", () => {
  const history = new FakeHistory();
  replaceCurrentLookupHistory(history, context, view({ query: "eerste", expandedPeers: ["postcode"], infoExpanded: false, scrollY: 10 }), 1_000);
  pushLookupHistory(history, context, view({ query: "tweede", expandedPeers: ["municipality", "age", "fte"], activitiesExpanded: true, peerMethodExpanded: true, scrollY: 900 }), 2_000);
  const back = readLookupPopState(history.back(), context, 3_000);
  assert.equal(back?.query, "eerste");
  assert.deepEqual(back?.expandedPeers, ["postcode"]);
  const forward = readLookupPopState(history.forward(), context, 3_000);
  assert.equal(forward?.query, "tweede");
  assert.deepEqual(forward?.expandedPeers, ["municipality", "age", "fte"]);
  assert.equal(forward?.activitiesExpanded, true);
  assert.equal(forward?.peerMethodExpanded, true);
  assert.equal(forward?.scrollY, 900);
});

test("the public parsers strip private fields before history storage", () => {
  const history = new FakeHistory();
  replaceCurrentLookupHistory(history, context, view(), 1_000);
  const serialized = JSON.stringify(history.state[lookupHistoryKey]);
  assert.equal(serialized.includes("privatePhone"), false);
  assert.equal(serialized.includes("privateEmail"), false);
  assert.equal(serialized.includes("privateToken"), false);
  assert.equal(history.state[lookupHistoryKey].view.company.officialUrl.includes("kbopub.economie.fgov.be"), true);
});

test("version, locale, URL, TTL and malformed state mismatches are ignored", () => {
  const history = new FakeHistory();
  replaceCurrentLookupHistory(history, context, view(), 1_000);
  assert.equal(readInitialLookupHistory(history.state, { ...context, locale: "fr" }, 2_000), null);
  assert.equal(readInitialLookupHistory(history.state, { ...context, locale: "de" }, 2_000), null);
  assert.equal(readInitialLookupHistory(history.state, { ...context, url: "/nl/bedrijf-zoeken?ander=1" }, 2_000), null);
  assert.equal(readInitialLookupHistory(history.state, context, 1_000 + lookupHistoryTtlMs + 1), null);
  assert.equal(readInitialLookupHistory({ ...history.state, [lookupHistoryKey]: { ...history.state[lookupHistoryKey], version: 2 } }, context, 2_000), null);
  assert.equal(readInitialLookupHistory({ [lookupHistoryKey]: { version: 1, savedAt: 1_000, locale: "nl", url: context.url, view: { query: 4 } } }, context, 2_000), null);
  const incomplete = structuredClone(history.state);
  delete incomplete[lookupHistoryKey].view.peerMethodExpanded;
  assert.equal(readInitialLookupHistory(incomplete, context, 2_000), null);
  assert.equal(readInitialLookupHistory(history.state, { ...context, url: "https://evil.example/nl/bedrijf-zoeken" }, 2_000), null);
});

test("invalid writes fail without changing the current history entry", () => {
  const history = new FakeHistory();
  const before = structuredClone(history.state);
  assert.equal(pushLookupHistory(history, context, view({ expandedPeers: ["unknown"] }), 1_000), false);
  assert.deepEqual(history.state, before);
  assert.equal(history.entries.length, 1);
});
