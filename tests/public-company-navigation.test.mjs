import assert from 'node:assert/strict';
import test from 'node:test';
import { companyLocaleTag, consumeLookupTransfer, lookupTransferKey, saveLookupTransfer } from '../src/lib/public-company/navigation.ts';

function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, removeItem: key => values.delete(key), setItem: (key, value) => values.set(key, value) };
}
const company = { number: '0400378485', name: 'Eigen bronbedrijf', activities: [{code:'47114',label:'Exact bronlabel'}], metrics: [{key:'fte',value:4127.8,year:2025,unit:'VTE',label:'FTE'}], sources: {} };
const state = { query: 'Eigen nieuw concept', matches: [{number:'0400378485',name:'Eigen bronbedrijf'}], company, error: '', officialNumber: '' };

test('explicit language handoff preserves draft, chosen identity and results without another request', () => {
  const box = storage();
  for (const locale of ['fr','en','nl']) {
    saveLookupTransfer(box, locale, state, 1000);
    const received = consumeLookupTransfer(box, locale, 1001);
    assert.equal(received.query, state.query);
    assert.equal(received.company.number, company.number);
    assert.equal(received.company.metrics[0].value, 4127.8);
    assert.equal(received.matches[0].number, company.number);
    assert.equal(box.values.size, 0, 'handoff is consumed once');
    assert.equal(consumeLookupTransfer(box, locale, 1002), null, 'normal reopening cannot inject an old profile');
  }
});

test('old, different-route and malformed state cannot silently reopen another profile', () => {
  const box = storage();
  saveLookupTransfer(box, 'fr', state, 1000);
  assert.equal(consumeLookupTransfer(box, 'en', 1001), null);
  saveLookupTransfer(box, 'fr', state, 1000);
  assert.equal(consumeLookupTransfer(box, 'fr', 121001), null);
  saveLookupTransfer(box, 'fr', {...state, company:{...company,number:'invalid'}}, 1000);
  assert.throws(() => consumeLookupTransfer(box, 'fr', 1001));
  assert.equal(box.values.size, 0);
  box.setItem(lookupTransferKey, '{broken');
  assert.throws(() => consumeLookupTransfer(box, 'fr', 1001));
});

test('known errors and a deliberately stopped request retain their meaning across languages', () => {
  const box = storage();
  for (const error of ['short','error','rate','notFound','interrupted']) {
    saveLookupTransfer(box, 'en', {...state, company:undefined, matches:[], error}, 1000);
    const received = consumeLookupTransfer(box, 'en', 1001);
    assert.equal(received.error, error);
    assert.equal(received.company, undefined);
  }
});

test('English numeric notation differs from Dutch and French while preserving actual FTE', () => {
  const rendered = locale => new Intl.NumberFormat(companyLocaleTag(locale), {maximumFractionDigits:1}).format(4127.8);
  assert.equal(rendered('en'), '4,127.8');
  assert.equal(rendered('nl'), '4.127,8');
  assert.match(rendered('fr'), /^4\s127,8$/u);
});
