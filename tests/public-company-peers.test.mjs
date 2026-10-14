import test from "node:test";
import assert from "node:assert/strict";
import { peersPayload } from "../src/lib/public-company/peers.ts";

function fixture() {
  const examples = ["0123456789", "0234567890", "0345678901", "0456789012", "0567890123"].map((number) => ({ number, name: `Company ${number}`, municipality: "Gent", privatePhone: "never forward" }));
  return { ok: true, referenceNumber: "0869703978", activity: { code: "62010", version: "2008", label: "Software" }, sources: { kboDate: "2026-08-13", secret: "no" },
    tiers: [
      { key: "activity", available: true, count: 100, criteria: {}, examples },
      { key: "municipality", available: true, count: 20, criteria: {municipality:"Gent"}, examples },
      { key: "postcode", available: true, count: 5, criteria: {postcode:"9000"}, examples },
      { key: "fte", available: true, count: 70, criteria: {fteMin:0,fteMax:1,financialYear:2025}, examples },
    ], privateExport: ["hidden"] };
}

test("public subsets are independent and private fields are removed", () => {
  const data = peersPayload(fixture());
  assert.ok(data);
  assert.deepEqual(data.tiers.map(t => t.count), [100,20,5,70]);
  assert.equal(data.tiers[3].criteria.fteMin, 0);
  assert.equal(JSON.stringify(data).includes("never forward"), false);
  assert.equal(JSON.stringify(data).includes("privateExport"), false);
  assert.equal(JSON.stringify(data).includes("secret"), false);
});

test("invalid counts, examples, geography and workforce bounds are rejected", () => {
  for (const change of [
    d => { d.tiers[1].count = 101; },
    d => { d.tiers[0].examples[1] = d.tiers[0].examples[0]; },
    d => { d.tiers[0].examples[0].number = d.referenceNumber; },
    d => { d.tiers[0].examples.push({ number: "0678901234", name: "Extra" }); },
    d => { delete d.tiers[1].criteria.municipality; },
    d => { d.tiers[2].criteria.postcode = "province"; },
    d => { delete d.tiers[3].criteria.fteMin; },
    d => { d.tiers[3].criteria.fteMax = 0; },
    d => { d.tiers[3].criteria.financialYear = 1800; },
  ]) { const data = fixture(); change(data); assert.equal(peersPayload(data), null); }
});

test("unknown geography does not suppress available workforce or other geography", () => {
  const data = fixture();
  Object.assign(data.tiers[1], {available:false,count:null,examples:[],criteria:{},unavailableReason:"no_municipality"});
  assert.equal(peersPayload(data)?.tiers[2].count, 5);
  assert.equal(peersPayload(data)?.tiers[3].count, 70);
  Object.assign(data.tiers[2], {available:false,count:null,examples:[],criteria:{},unavailableReason:"no_postcode"});
  assert.equal(peersPayload(data)?.tiers[3].count, 70);
});

test("missing workforce is unknown while geography keeps its actual counts", () => {
  const data = fixture();
  Object.assign(data.tiers[3], {available:false,count:null,examples:[],criteria:{},unavailableReason:"no_fte"});
  assert.equal(peersPayload(data)?.tiers[3].count, null);
  assert.equal(peersPayload(data)?.tiers[1].count, 20);
  assert.equal(peersPayload(data)?.tiers[2].count, 5);
  data.tiers[3].count = 0;
  assert.equal(peersPayload(data), null);
});

test("a real zero has no fictional examples and the old funnel is not relabelled", () => {
  const data = fixture();
  Object.assign(data.tiers[2], {count:0,examples:[]});
  assert.equal(peersPayload(data)?.tiers[2].count, 0);
  data.tiers[2].examples.push({number:"0678901234",name:"Fake"});
  assert.equal(peersPayload(data), null);
  const legacy = fixture(); legacy.tiers[1].key = "revenue";
  assert.equal(peersPayload(legacy), null);
});
