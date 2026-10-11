import test from "node:test";
import assert from "node:assert/strict";
import { peersPayload } from "../src/lib/public-company/peers.ts";

function fixture() {
  const examples = ["0123456789", "0234567890", "0345678901", "0456789012", "0567890123"].map((number) => ({ number, name: `Company ${number}`, municipality: "Gent", privatePhone: "never forward" }));
  const revenue = { revenueMin: 1000000, revenueMax: 2000000, financialYear: 2024 };
  const fte = { ...revenue, fteMin: 10, fteMax: 20 };
  return { ok: true, referenceNumber: "0869703978", activity: { code: "62010", version: "2008", label: "Software" }, sources: { kboDate: "2026-08-13", secret: "no" },
    tiers: [
      { key: "activity", available: true, count: 100, criteria: {}, examples },
      { key: "revenue", available: true, count: 20, criteria: revenue, examples },
      { key: "fte", available: true, count: 5, criteria: fte, examples },
      { key: "legalForm", available: true, count: 2, criteria: { ...fte, legalForm: "BV" }, examples: examples.slice(0, 2) },
    ], privateExport: ["hidden"] };
}

test("only the bounded public cohort fields survive projection", () => {
  const data = peersPayload(fixture());
  assert.ok(data);
  assert.equal(data.tiers.length, 4);
  assert.equal(data.tiers[0].examples.length, 5);
  assert.equal(data.tiers[3].examples.length, 2);
  assert.equal(JSON.stringify(data).includes("never forward"), false);
  assert.equal(JSON.stringify(data).includes("privateExport"), false);
  assert.equal(JSON.stringify(data).includes("secret"), false);
});

test("increasing counts, duplicate examples, self matches and excess examples are rejected", () => {
  for (const change of [
    (d) => { d.tiers[1].count = 101; },
    (d) => { d.tiers[0].examples[1] = d.tiers[0].examples[0]; },
    (d) => { d.tiers[0].examples[0].number = d.referenceNumber; },
    (d) => { d.tiers[0].examples.push({ number: "0678901234", name: "Extra" }); },
    (d) => { d.tiers[2].criteria.revenueMin = 999; },
    (d) => { delete d.tiers[3].criteria.legalForm; },
    (d) => { d.tiers[1].criteria.financialYear = 1800; },
  ]) { const data = fixture(); change(data); assert.equal(peersPayload(data), null); }
});

test("missing data remains unknown and prevents unsupported later refinements", () => {
  const data = fixture();
  for (const tier of data.tiers.slice(1)) Object.assign(tier, { available: false, count: null, examples: [], unavailableReason: "no_revenue" });
  assert.equal(peersPayload(data)?.tiers[1].count, null);
  data.tiers[2] = fixture().tiers[2];
  assert.equal(peersPayload(data), null);
});

test("a real zero count has no fictional examples", () => {
  const data = fixture(); Object.assign(data.tiers[3], { count: 0, examples: [] });
  assert.equal(peersPayload(data)?.tiers[3].count, 0);
  data.tiers[3].examples.push({ number: "0678901234", name: "Fake" });
  assert.equal(peersPayload(data), null);
});
