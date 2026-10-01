import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(new URL("./assets/frozen-ui.html", import.meta.url), "utf8");
const catalog = await readFile(new URL("./assets/premium_i18n.js", import.meta.url), "utf8");
const stageSource = html.split(/\r?\n/).find(line => /^\s*function guidedStage\(/.test(line));
assert.ok(stageSource, "the shared guided route must expose its pure stage calculation");
const stage = Function(`${stageSource}; return guidedStage;`)();
const inputRouteSource = html.split(/\r?\n/).find(line => /^\s*function guidedInputRoute\(/.test(line));
assert.ok(inputRouteSource, "the guided composer must expose one pure input route");
const inputRoute = Function(`${inputRouteSource}; return guidedInputRoute;`)();
const previousStageSource = html.split(/\r?\n/).find(line => /^\s*function guidedPreviousStage\(/.test(line));
assert.ok(previousStageSource, "guided back navigation must expose its pure previous-stage calculation");
const previousStage = Function(`${previousStageSource}; return guidedPreviousStage;`)();
const leaveContactSource = html.split(/\r?\n/).find(line => /^\s*function leaveGuidedContactContext\(/.test(line));
assert.ok(leaveContactSource, "guided back navigation must isolate leaving the contact presentation");
const contextSource = html.split(/\r?\n/).find(line => /^\s*function journeySetContext\(/.test(line));
assert.ok(contextSource, "journey navigation must invalidate prior response context");
function contextFor(journey, stopJourneyPoll = () => {}) {
  journey.contextRevision ??= 0;
  journey.estimateRevision ??= 0;
  journey.busyContext ??= null;
  return Function("journey", "stopJourneyPoll", "busy", `${contextSource}; return journeySetContext;`)(journey, stopJourneyPoll, () => {});
}

test("first use begins with the business question, without requiring prior data", () => {
  assert.equal(stage({ searched: false, conversation: [] }, { data: null }), "goal");
  assert.equal(stage({ conversation: [{ role: "user", content: "Fruit voor kantoren" }] }, { mode: "goal" }), "clarify");
});

test("ready targeting precedes the first result and successful search shows results", () => {
  assert.equal(stage({ proposal: { status: "ready" }, conversation: [] }, {}), "confirm");
  assert.equal(stage({ searched: true, total: 2, conversation: [] }, {}), "results");
  assert.equal(stage({ searched: true, total: 0, conversation: [] }, {}), "results", "zero matches still require an actionable results state");
});

test("unfinished contact work stays in research rather than claiming the download step", () => {
  for (const status of ["created", "queued", "running", "pausing", "paused", "error", "review"]) {
    assert.equal(stage({ searched: true }, { mode: "contacts", job: { status, can_resume: status === "paused" } }), "contacts", status);
  }
});

test("completed research and a pending delivery have an explicit download step", () => {
  assert.equal(stage({ searched: true }, { mode: "contacts", job: { status: "completed" } }), "download");
  assert.equal(stage({ searched: true }, { mode: "contacts", job: { job_id: "A", status: "paused" }, pendingExport: { job_id: "A", export_id: "pending" } }), "download");
  assert.equal(stage({ searched: true }, { mode: "contacts", job: { job_id: "B", status: "paused" }, pendingExport: { job_id: "A", export_id: "pending" } }), "contacts", "a previous task delivery must not change the current task stage");
});

test("choosing a new contact source is not mistaken for downloading an older completed task", () => {
  const flow = { mode: "contacts", contactView: "home", job: { status: "completed" } };
  assert.equal(stage({ searched: true, total: 397 }, flow), "contacts");
  flow.contactView = "job";
  assert.equal(stage({ searched: true, total: 397 }, flow), "download");
});

test("going back changes presentation without mutating saved selection or pending delivery", () => {
  const app = { searched: true, rows: [{ number: "0123456789" }], selectedRows: { "0123456789": { name: "Test" } }, conversation: [{ role: "user", content: "Mechelen" }] };
  const flow = { mode: "contacts", job: { job_id: "job", status: "completed" }, pendingExport: { export_id: "delivery" } };
  const before = JSON.stringify({ app, flow });
  assert.equal(stage(app, flow, "results"), "results");
  assert.equal(JSON.stringify({ app, flow }), before);
  assert.equal(stage(app, flow), "download", "the existing delivery can still be resumed after the presentation override");
});

test("step-one advice remains step-one advice when older search results still exist", () => {
  const app = { searched: true, rows: [{ number: "0123456789" }], conversation: [{ role: "assistant", content: "Oud resultaat" }] };
  assert.equal(stage(app, {}, "goal"), "goal", "back may show step one without deleting recoverable results");
  assert.equal(inputRoute("goal", null, false), "advice", "the visible goal step, rather than searched state, chooses advice");
  assert.equal(inputRoute("results", null, false), "ai");
});

test("new step-one advice retires an older ready proposal before rendering the reply", async () => {
  const dispatchSource = html.split(/\r?\n/).find(line => /^\s*async function dispatchComposerText\(/.test(line));
  assert.ok(dispatchSource, "the shared composer dispatcher must remain inspectable");
  const state = { proposal: { status: "ready", filters: { gemeente_nl: "Antwerpen" } } };
  const journey = { mode: null };
  let adviceCalls = 0;
  let aiCalls = 0;
  const harness = Function(
    "state", "journey", "guidedStage", "guidedModeActive", "guidedInputRoute", "looksLikeBusinessIntro", "isExplicitContactRequest", "routeJourneyRequest", "journeyAdvise", "aiSearch", "$", "search", "snapshotFilters",
    `let guidedStageOverride = "goal"; ${dispatchSource}; return { dispatchComposerText, override: () => guidedStageOverride };`,
  )(
    state,
    journey,
    () => "goal",
    () => true,
    inputRoute,
    () => false,
    () => false,
    () => false,
    async () => { adviceCalls += 1; },
    async () => { aiCalls += 1; },
    () => ({ checked: true }),
    async () => {},
    () => ({}),
  );

  await harness.dispatchComposerText("fruitmanden voor kantoren");
  assert.equal(adviceCalls, 1);
  assert.equal(aiCalls, 0);
  assert.equal(state.proposal, null, "the previous confirmation must not reappear over the new advice");
  assert.equal(harness.override(), "clarify", "the advice reply remains visible even while older results are recoverable");
});

test("reviewing a resumed target clears clarify override and reaches confirmation over older results", async () => {
  const targetSource = html.split(/\r?\n/).find(line => /^\s*function searchJourneyTarget\(/.test(line));
  assert.ok(targetSource, "the resumed target transition must remain inspectable");
  const state = { searched: true, proposal: null, aiScope: "refine" };
  const journey = { mode: "goal" };
  const elements = { "#query": { value: "" }, "#ai-mode": { checked: false } };
  let composerRenders = 0;
  const harness = Function(
    "state", "journey", "$", "renderComposer", "aiSearch", "journeySetContext",
    `let guidedStageOverride = "clarify"; ${targetSource}; return { searchJourneyTarget, override: () => guidedStageOverride };`,
  )(
    state,
    journey,
    selector => elements[selector],
    () => { composerRenders += 1; },
    async () => { state.proposal = { status: "ready", filters: { nace_prefix: "56" } }; },
    contextFor(journey),
  );

  await harness.searchJourneyTarget("horecaleveranciers in Antwerpen");
  assert.equal(harness.override(), null, "the resume-only clarify presentation must not mask the ready proposal");
  assert.equal(journey.mode, null);
  assert.equal(state.aiScope, "new");
  assert.equal(elements["#query"].value, "horecaleveranciers in Antwerpen");
  assert.equal(elements["#ai-mode"].checked, true);
  assert.equal(composerRenders, 1);
  assert.equal(stage(state, journey, harness.override()), "confirm", "ready proposal must win even when older search results remain loaded");
});

test("guided confirmation and clarification keep conversation history collapsed", () => {
  const lines = html.split(/\r?\n/);
  const proposalLine = lines.findIndex(line => /const p=r\.proposal\|\|\{\}/.test(line));
  const titleLine = lines.findIndex((line, index) => index > proposalLine && /#ai-title/.test(line));
  assert.ok(proposalLine >= 0 && titleLine > proposalLine, "AI proposal rendering block must remain inspectable");
  const responseRender = lines.slice(proposalLine, titleLine).join("\n");
  const assignment = responseRender.match(/state\.conversationCollapsed=([^;]+);renderConversation\(\)/);
  assert.ok(assignment, "the final collapse decision must precede conversation rendering");
  const collapsed = Function("p", "guidedModeActive", `return ${assignment[1]};`);
  for (const status of ["ready", "clarify"]) {
    assert.equal(collapsed({ status }, () => true), true, status);
    assert.equal(collapsed({ status }, () => false), false, `advanced ${status}`);
  }
});

test("typed and spoken sends use the same composer dispatcher", () => {
  const lines = html.split(/\r?\n/);
  const submitSource = lines.find(line => /#search-form.*onsubmit/.test(line));
  const acceptStart = lines.findIndex(line => /^\s*async function acceptVoice\(/.test(line));
  const acceptEnd = lines.findIndex((line, index) => index > acceptStart && /^\s*function mergeVoiceText\(/.test(line));
  assert.ok(submitSource?.includes("dispatchComposerText(text)"), "typed submit must use the shared dispatcher");
  assert.ok(acceptStart >= 0 && acceptEnd > acceptStart, "voice acceptance must remain inspectable");
  assert.match(lines.slice(acceptStart, acceptEnd).join("\n"), /await dispatchComposerText\(text\)/, "spoken submit must use the shared dispatcher");
});

test("leaving contacts for results preserves resumable work and allows a new proposal", () => {
  const flow = {
    mode: "contacts",
    contactView: "job",
    job: { job_id: "job-1", status: "paused", can_resume: true },
    data: { job: { job_id: "job-1", status: "paused", can_resume: true }, marker: "keep" },
    pendingExport: { export_id: "delivery-1" },
  };
  const preserved = structuredClone({ job: flow.job, data: flow.data, pendingExport: flow.pendingExport });
  let pollStopped = 0;
  const leaveContact = Function("journey", "journeySetContext", `${leaveContactSource}; return leaveGuidedContactContext;`)(flow, contextFor(flow, () => { pollStopped += 1; }));

  assert.equal(previousStage("contacts", true), "results");
  leaveContact();
  assert.equal(flow.mode, null);
  assert.equal(flow.contactView, "home");
  assert.equal(pollStopped, 1);
  assert.deepEqual({ job: flow.job, data: flow.data, pendingExport: flow.pendingExport }, preserved, "job, server state and pending delivery must remain resumable");
  assert.equal(stage({ searched: true, proposal: { status: "ready" } }, flow), "confirm", "preserved contact work must not hide a new search proposal");
});

test("download backtracking keeps contact delivery context until the user returns to results", () => {
  assert.equal(previousStage("download", true), "contacts");
  assert.equal(previousStage("download", false), "results");
  const backSource = html.split(/\r?\n/).find(line => /#guided-back.*onclick/.test(line));
  assert.match(backSource || "", /leaveGuidedContactContext\(\)/, "contacts-to-results back navigation must leave only the contact presentation");
});

test("guided clarification asks one question while advanced mode retains the full explanation", () => {
  const source = html.split(/\r?\n/).find(line => line.trim().startsWith("const explanation="));
  assert.ok(source);
  const explain = Function("p", "summary", "guidedModeActive", `${source};return explanation;`);
  const proposal = { status: "clarify", question: "Bedoel je minstens 10 VTE?", assistant_message: "Ik stel Mechelen voor. Bedoel je minstens 10 VTE?", message: "Technische toelichting" };
  assert.equal(explain(proposal, ["Personeelsfilter"], () => true), proposal.question);
  assert.match(explain(proposal, ["Personeelsfilter"], () => false), /Technische toelichting/);
});

test("all guided labels have Dutch French and English text", () => {
  const document = { documentElement: { lang: "nl" }, querySelectorAll: () => [] };
  const window = { document, dispatchEvent() {}, localStorage: { getItem: () => null, setItem() {} } };
  vm.runInNewContext(catalog, { window, document, CustomEvent: class {} });
  const keys = new Set([...html.matchAll(/["'](guided\.[A-Za-z][\w.]*)["']/g)].map(match => match[1]));
  assert.ok(keys.size >= 10);
  for (const key of keys) for (const language of ["nl", "fr", "en"]) {
    assert.ok(window.BelgoBaseI18n.messages[key]?.[language]?.trim(), `${key}: ${language}`);
  }
});
