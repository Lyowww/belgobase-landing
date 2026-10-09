import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const targets = process.env.BB_FILTER_TEST_FILES
  ? JSON.parse(process.env.BB_FILTER_TEST_FILES)
  : [new URL('../src/lib/workspace/assets/frozen-ui.html', import.meta.url)];

function extract(html, name) {
  const start = html.indexOf(`async function ${name}(`) >= 0
    ? html.indexOf(`async function ${name}(`) : html.indexOf(`function ${name}(`);
  if (start < 0) return '';
  let index = html.indexOf('(', start), depth = 0;
  do { if (html[index] === '(') depth++; if (html[index] === ')') depth--; index++; } while (depth);
  index = html.indexOf('{', index);
  let quote = '', escaped = false;
  for (; index < html.length; index++) {
    const c = html[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (['"', "'", '`'].includes(c)) { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`Unterminated ${name}`);
}

function harness(html, { query = '', accepted = '', filters = {}, ai = false, guided = false } = {}) {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      value: '', checked: false, hidden: false, textContent: '',
      classList: { remove() {}, toggle() {} }, setAttribute() {}, focus() {},
    });
    return nodes.get(selector);
  };
  $('#query').value = query; $('#ai-mode').checked = ai;
  const calls = [];
  const context = vm.createContext({
    structuredClone, state: { view: 'search', filters, query: accepted },
    work: { filters: {}, schema: {} }, savedSearchIssue: null, lastActionError: '',
    $, $$: () => [], numberfinderController: null, guidedModeActive: () => guided,
    journeyApplyExclusions: value => structuredClone(value),
    t: (key, fallback) => fallback, renderFullFilters() {}, controls() {},
    workspaceTitles: () => ({ filters: ['Filters', ''], xbrl: ['Jaarrekeningen', ''] }),
    navigate() {}, resetConversation() {}, renderComposer() {},
    action: async (method, payload) => { calls.push({ method, payload }); return { filters: payload.filters }; },
    search: async (page, criteria, q) => { calls.push({ method: 'search', criteria, query: q }); return true; },
  });
  vm.runInContext(['currentSearchFilters', 'workspaceFilterSource', 'openWorkspace', 'applyWorkspaceFilters'].map(name => extract(html, name)).join('\n'), context);
  return { context, calls, $ };
}
const plain = value => JSON.parse(JSON.stringify(value));

for (const target of targets) {
  const html = await readFile(target, 'utf8');
  const label = /PC1|[\\/]pc1[\\/]/.test(String(target)) ? 'PC1' : 'website';
  test(`${label}: unsent manual name survives opening advanced filters`, async () => {
    const { context } = harness(html, { query: 'Delhaize', filters: { kbo_postcode: '1730', kbo_postcode_exclude: '6220' } });
    await context.openWorkspace('filters');
    assert.deepEqual(plain(context.work.filters), { naam: 'Delhaize', kbo_postcode: '1730', kbo_postcode_exclude: '6220' });
    assert.equal(context.state.query, ''); // opening a draft is not executing it
  });
  test(`${label}: changed or cleared name replaces the previously executed query`, async () => {
    for (const query of ['Delhaize', '']) {
      const { context } = harness(html, { query, accepted: 'Colruyt' });
      await context.openWorkspace('filters');
      assert.deepEqual(plain(context.work.filters), query ? { naam: query } : {});
    }
  });
  test(`${label}: enterprise-number draft remains an identity criterion`, async () => {
    const { context } = harness(html, { query: 'BE 0402.206.045', accepted: 'Colruyt' });
    await context.openWorkspace('filters');
    assert.deepEqual(plain(context.work.filters), { ondernemingsnummer: 'BE 0402.206.045' });
  });
  test(`${label}: blank main input retains a name entered in the filter form`, async () => {
    const { context } = harness(html, { filters: { naam: 'Delhaize', kbo_postcode: '1730' } });
    await context.openWorkspace('filters');
    assert.deepEqual(plain(context.work.filters), { naam: 'Delhaize', kbo_postcode: '1730' });
  });
  test(`${label}: assistant draft never becomes a literal company-name criterion`, async () => {
    for (const mode of [{ ai: true }, { guided: true }]) {
      const { context } = harness(html, { query: 'Zoek nu meer klanten', accepted: 'Delhaize', ...mode });
      await context.openWorkspace('filters');
      assert.deepEqual(plain(context.work.filters), { naam: 'Delhaize' });
    }
  });
  test(`${label}: paid/contact and other selection consumers ignore unsubmitted drafts`, () => {
    const { context } = harness(html, { query: 'Colruyt', accepted: 'Delhaize', filters: { kbo_postcode: '1730' } });
    assert.deepEqual(plain(context.currentSearchFilters()), { naam: 'Delhaize', kbo_postcode: '1730' });
    if (context.workspaceFilterSource) {
      for (const section of ['export_columns', 'account', 'similar']) {
        assert.deepEqual(plain(context.workspaceFilterSource(section)), { naam: 'Delhaize', kbo_postcode: '1730' });
      }
    }
  });
  test(`${label}: moving between filter tools retains edited criteria`, async () => {
    const { context } = harness(html, { query: 'Colruyt', accepted: 'Delhaize' });
    context.work.filters = { naam: 'Edited name', kbo_postcode: '1730' };
    await context.openWorkspace('filters', true);
    assert.deepEqual(plain(context.work.filters), { naam: 'Edited name', kbo_postcode: '1730' });
  });
  test(`${label}: metadata-validation fallback retains the current manual draft`, async () => {
    const { context } = harness(html, { query: 'Delhaize', accepted: 'Colruyt', filters: { kbo_postcode: '1730', kbo_postcode_exclude: '1730' } });
    let attempt = 0;
    context.action = async () => { context.lastActionError = 'Conflicting postcodes'; return ++attempt === 1 ? null : { filters: {} }; };
    await context.openWorkspace('filters');
    assert.deepEqual(plain(context.work.filters), { naam: 'Delhaize', kbo_postcode: '1730', kbo_postcode_exclude: '1730' });
    assert.equal(context.savedSearchIssue.query, '');
  });
  test(`${label}: correcting a manual conflict cannot revive the previous search name`, async () => {
    const { context, calls } = harness(html, { accepted: 'Colruyt' });
    context.work.filters = { naam: 'Delhaize', kbo_postcode: '1730', kbo_postcode_exclude: '1730' };
    context.action = async () => { context.lastActionError = 'Conflicting postcodes'; return null; };
    await context.applyWorkspaceFilters();
    context.work.filters.kbo_postcode_exclude = '6220';
    context.action = async (_, payload) => ({ filters: payload.filters });
    await context.applyWorkspaceFilters();
    assert.deepEqual(plain(calls.at(-1)), { method: 'search', criteria: { naam: 'Delhaize', kbo_postcode: '1730', kbo_postcode_exclude: '6220' }, query: '' });
  });
  test(`${label}: a genuine saved-search repair retains its stored separate query`, async () => {
    const { context, calls } = harness(html);
    context.savedSearchIssue = { query: 'Delhaize', message: 'Conflict' };
    context.work.filters = { kbo_postcode: '1730' };
    context.action = async () => { context.lastActionError = 'Still invalid'; return null; };
    await context.applyWorkspaceFilters();
    assert.equal(context.savedSearchIssue.query, 'Delhaize');
    context.action = async (_, payload) => ({ filters: payload.filters });
    await context.applyWorkspaceFilters();
    assert.equal(calls.at(-1).query, 'Delhaize');
  });
}
