import test from "node:test";
import assert from "node:assert/strict";
import { publicPayload } from "../src/lib/public-company/model.ts";

const company = (metrics) => ({ ok: true, matches: [], company: {
  number: "0400853488", name: "Audit meeteenheden", activities: [], metrics, sources: {},
} });
const metric = (key, unit, value = 12.5) => ({ key, label: key, value, year: 2025, unit });

test("personeel is VTE; omzet, resultaat, eigen vermogen en EBITDA zijn EUR", () => {
  assert.equal(publicPayload(company([metric("fte", "VTE")])).company.metrics[0].value, 12.5);
  for (const key of ["revenue", "profit", "equity", "ebitda"]) {
    assert.equal(publicPayload(company([metric(key, "EUR", -12.5)])).company.metrics[0].value, -12.5);
  }
});

test("een geldbedrag kan niet als personeelsaantal worden gepresenteerd", () => {
  assert.equal(publicPayload(company([metric("fte", "EUR")])), null);
});

test("een personeelseenheid kan geen geldmetriek vervangen", () => {
  for (const key of ["revenue", "profit", "equity", "ebitda"]) {
    assert.equal(publicPayload(company([metric(key, "VTE")])), null);
  }
});

test("ontbrekende waarden blijven ontbrekend, nul en verlies blijven getallen", () => {
  for (const value of [null, 0, -12.5]) {
    assert.equal(publicPayload(company([metric("profit", "EUR", value)])).company.metrics[0].value, value);
  }
});

test("onvolledige antwoorden falen; een geldige lege uitkomst en beperkte natuurlijke persoon behouden hun betekenis", () => {
  for (const value of [{ ok: true }, { ok: true, matches: null }, { ok: true, matches: [], company: {} }]) {
    assert.equal(publicPayload(value), null);
  }
  assert.deepEqual(publicPayload({ ok: true, matches: [] }), { ok: true, matches: [] });
  assert.deepEqual(publicPayload({ ok: true, matches: [], error: "natural_person_unavailable" }), {
    ok: true, matches: [], error: "natural_person_unavailable",
  });
});
