import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('./assets/frozen-ui.html', import.meta.url), 'utf8');
const code = html.slice(html.indexOf('function storedDisplayTab('), html.indexOf('const selectionHistory='));
function fixture({ conversation = true } = {}) {
  const classes = new Set(conversation ? ['guided-mode'] : ['advanced-mode']);
  const classList = set => ({ contains: x => set.has(x), toggle: (x, yes) => yes ? set.add(x) : set.delete(x) });
  const nodes = new Map();
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: false, value: '', textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() { this.focused = true; } });
    return nodes.get(id);
  };
  const tabs = ['conversation', 'workspace', 'conversation', 'workspace'].map(mode => ({ dataset: { appMode: mode }, classList: classList(new Set()), attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() { this.focused = true; } }));
  $('#tools-view').hidden = $('#dossier-view').hidden = true;
  const state = { view: 'search', rows: [{ number: '0123456789' }], filters: { min_personeel_vte: 10 }, query: 'Mechelen', selectedRows: { '0123456789': true }, conversation: [{ role: 'user', content: 'Mijn verhaal' }], desktopCapabilities: new Set(), busy: false, recording: false };
  const storage = new Map();
  const calls = [];
  const context = { state, work: { returnView: 'search', filters: { draft: true } }, document: { body: { classList: classList(classes) } }, window: { localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) } }, $, $$: () => tabs, guidedModeActive: () => classes.has('guided-mode'), renderRows() {}, renderAssistantContext() {}, renderGuidedFlow() {}, guidedStageOverride: null, bridge: async (...args) => { calls.push(args); }, notice() {}, t: (key, fallback) => fallback };
  vm.createContext(context);
  vm.runInContext(code, context);
  return { context, state, $, tabs, storage, calls, classes };
}

test('tabs switch presentation without altering selection, conversation or typed text', () => {
  const f = fixture();
  f.$('#query').value = 'Nog niet verstuurd';
  const before = JSON.stringify(f.state);
  f.context.setGuidedMode(false);
  assert.equal(f.classes.has('advanced-mode'), true);
  f.context.setGuidedMode(true);
  assert.equal(JSON.stringify(f.state), before);
  assert.equal(f.$('#query').value, 'Nog niet verstuurd');
  assert.equal(f.calls.length, 0, 'switching a web tab must not call a provider or start work');
  assert.equal(f.tabs[0].attrs['aria-selected'], 'true');
  assert.equal(f.tabs[1].attrs.tabindex, '-1');
});

test('conversation opens from a workspace tool and returning restores its unsubmitted form', () => {
  const f = fixture({ conversation: false });
  f.state.view = 'tools';
  f.$('#search-view').hidden = true;
  f.$('#tools-view').hidden = false;
  f.$('#breadcrumb').textContent = 'Alle filters';
  f.context.setGuidedMode(true);
  assert.equal(f.state.view, 'search');
  assert.equal(f.$('#tools-view').hidden, true);
  f.context.setGuidedMode(false);
  assert.equal(f.state.view, 'tools');
  assert.equal(f.$('#tools-view').hidden, false);
  assert.equal(f.context.work.filters.draft, true);
});

test('a new search in the conversation takes precedence over an older workspace tool', () => {
  const f = fixture({ conversation: false });
  f.state.view = 'tools'; f.$('#tools-view').hidden = false;
  f.context.setGuidedMode(true);
  f.state.rows = [{ number: '0234567890' }];
  f.context.setGuidedMode(false);
  assert.equal(f.state.view, 'search');
  assert.equal(f.$('#tools-view').hidden, true);
});

test('preference survives a reload and blocked storage safely defaults to conversation', () => {
  const f = fixture(); f.context.setGuidedMode(false);
  assert.equal(f.context.storedDisplayTab(), 'workspace');
  f.context.setGuidedMode(true, { persist: false });
  assert.equal(f.context.storedDisplayTab(), 'workspace');
  f.context.window.localStorage.getItem = () => { throw Error('Unavailable'); };
  assert.equal(f.context.storedDisplayTab(), 'conversation');
});

test('rapid desktop tab changes save in order and busy work cannot be switched away', async () => {
  const f = fixture(); f.state.desktopCapabilities.add('set_display_tab');
  f.context.setGuidedMode(false); f.context.setGuidedMode(true);
  await vm.runInContext('displayTabSave', f.context);
  assert.deepEqual(f.calls.map(x => x[1].tab), ['workspace', 'conversation']);
  f.state.busy = true; f.context.setGuidedMode(false);
  assert.equal(f.classes.has('guided-mode'), true);
});

test('keyboard tabs select the destination and update the shared panel label', () => {
  const f = fixture(); let prevented = false;
  f.context.handleModeKey({ key: 'End', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(f.tabs[3].focused, true);
  assert.equal(f.$('#app-panel').attrs['aria-labelledby'], 'workspace-tab');
});
