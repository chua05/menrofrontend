import test from "node:test";
import assert from "node:assert/strict";
import { loadReadiness, mergeReadiness, readinessPath, withoutEligibleCohort } from "../src/utils/sampleReadinessLoader.js";

const row = (id, canCreateVisit = false, extra = {}) => ({ cohortId: id, canCreateVisit, reasons: [], ...extra });
const ids = rows => rows.map(entry => entry.cohortId);
// A backend with `total` cohorts (ID order, 25 per page, every third one eligible) following the API contract.
const backend = (total, { failAt = null, perPage = 25 } = {}) => {
  const all = Array.from({ length: total }, (_, index) => row(`cohort-${String(index).padStart(3, "0")}`, index % 3 === 0));
  const calls = [];
  const fetchPage = async cursor => {
    calls.push(cursor);
    if (failAt !== null && calls.length === failAt) throw new Error("page failed");
    const start = cursor ? all.findIndex(entry => entry.cohortId === cursor) + 1 : 0;
    const cohorts = all.slice(start, start + perPage), more = start + perPage < total;
    return { cohorts, eligible: cohorts.filter(entry => entry.canCreateVisit), notEligible: cohorts.filter(entry => !entry.canCreateVisit),
      truncated: more, nextCursor: more ? cohorts.at(-1).cohortId : null, visitCreationAvailable: true, schedulingPolicyStatus: "ACTIVE",
      gates: { writesPaused: false, firstVisitBaselineEnabled: true, scheduleEnabled: true, pilotRestricted: false } };
  };
  return { all, calls, fetchPage };
};

test("the first page uses the unchanged readiness path; later pages send only the cursor", () => {
  assert.equal(readinessPath(), "/verified-sample-monitoring/readiness");
  assert.equal(readinessPath(""), "/verified-sample-monitoring/readiness");
  assert.equal(readinessPath("VPC_a-1"), "/verified-sample-monitoring/readiness?cursor=VPC_a-1");
});

for (const [total, requests] of [[0, 1], [25, 1], [26, 2], [51, 3]]) test(`${total} cohorts load completely without gaps or duplicates`, async () => {
  const source = backend(total);
  const result = await loadReadiness(source.fetchPage);
  assert.deepEqual(ids(result.cohorts), ids(source.all));
  assert.deepEqual(ids(result.eligible), ids(source.all.filter(entry => entry.canCreateVisit)));
  assert.equal(result.eligible.length + result.notEligible.length, total);
  assert.deepEqual([result.truncated, result.nextCursor, result.partial], [false, null, false]);
  assert.equal(source.calls.length, requests);
});

test("page following is bounded; nextCursor continues exactly where it stopped", async () => {
  const source = backend(60, { perPage: 10 });
  const first = await loadReadiness(source.fetchPage, { maxPages: 2 });
  assert.deepEqual([first.cohorts.length, first.truncated, first.nextCursor, source.calls.length], [20, true, "cohort-019", 2]);
  const second = await loadReadiness(source.fetchPage, { cursor: first.nextCursor });
  assert.equal(source.calls[2], "cohort-019");
  const merged = mergeReadiness(first, second);
  assert.deepEqual(ids(merged.cohorts), ids(source.all));
  assert.deepEqual([merged.truncated, merged.nextCursor, merged.partial], [false, null, false]);
});

test("the default bound is eight pages", async () => {
  const source = backend(300);
  const result = await loadReadiness(source.fetchPage);
  assert.equal(source.calls.length, 8);
  assert.deepEqual([result.cohorts.length, result.nextCursor, result.truncated], [200, "cohort-199", true]);
});

test("a later page failure keeps the earlier pages, reports partial and can be continued", async () => {
  const source = backend(60, { failAt: 3 });
  const result = await loadReadiness(source.fetchPage);
  assert.deepEqual([result.cohorts.length, result.partial, result.truncated, result.nextCursor], [50, true, true, "cohort-049"]);
  const merged = mergeReadiness(result, await loadReadiness(source.fetchPage, { cursor: result.nextCursor }));
  assert.deepEqual([merged.cohorts.length, merged.partial, merged.truncated], [60, false, false]);
});

test("a first page failure rejects, so the caller can say readiness could not be loaded", async () => {
  await assert.rejects(loadReadiness(backend(5, { failAt: 1 }).fetchPage), /page failed/);
});

test("cohorts repeated on a later page are kept once, in their first-seen group", async () => {
  const pages = { "": { cohorts: [row("a"), row("b")], eligible: [], notEligible: [row("a"), row("b")], nextCursor: "b", gates: { writesPaused: true } },
    b: { cohorts: [row("b", true), row("c", true)], eligible: [row("b", true), row("c", true)], notEligible: [], nextCursor: null, gates: { writesPaused: false } } };
  const result = await loadReadiness(async cursor => pages[cursor || ""]);
  assert.deepEqual([ids(result.cohorts), ids(result.eligible), ids(result.notEligible)], [["a", "b", "c"], ["c"], ["a", "b"]]);
  assert.deepEqual(result.gates, { writesPaused: true }, "the first page's gates are kept");
});

test("a cohort repeated inside one page is kept once", async () => {
  const result = await loadReadiness(async () => ({ cohorts: [row("a", true), row("a", true)], eligible: [row("a", true), row("a", true)], notEligible: [], nextCursor: null }));
  assert.deepEqual([ids(result.cohorts), ids(result.eligible)], [["a"], ["a"]]);
});

test("a repeated or malformed cursor never loops and is reported as incomplete", async () => {
  let calls = 0;
  const looping = await loadReadiness(async () => { calls += 1; return { cohorts: [row(`c${calls}`)], eligible: [], notEligible: [], truncated: true, nextCursor: "same" }; });
  assert.equal(calls, 2);
  assert.deepEqual([looping.truncated, looping.nextCursor, looping.partial], [true, null, true]);
  calls = 0;
  const malformed = await loadReadiness(async () => { calls += 1; return { cohorts: [], truncated: true, nextCursor: "../x?y" }; });
  assert.deepEqual([calls, malformed.truncated, malformed.nextCursor, malformed.partial], [1, true, null, true]);
});

test("a backend without the new keys behaves as before: one request, its own truncated flag, no gates", async () => {
  let calls = 0;
  const legacy = { cohorts: [row("a", true)], eligible: [row("a", true)], notEligible: [], truncated: true, visitCreationAvailable: true, schedulingPolicyStatus: "ACTIVE" };
  const result = await loadReadiness(async () => { calls += 1; return legacy; });
  assert.equal(calls, 1);
  assert.deepEqual([ids(result.cohorts), ids(result.eligible), result.truncated, result.nextCursor, result.partial, result.gates], [["a"], ["a"], true, null, false, undefined]);
  // Older responses without eligible/notEligible stay non-selectable.
  const bare = await loadReadiness(async () => ({ cohorts: [row("a", true)], truncated: false }));
  assert.deepEqual([bare.eligible, bare.truncated], [[], false]);
});

test("a started cohort leaves the selectable rows immediately", async () => {
  const source = backend(6);
  const result = withoutEligibleCohort(await loadReadiness(source.fetchPage), "cohort-003");
  assert.deepEqual(ids(result.eligible), ["cohort-000"]);
  assert.equal(withoutEligibleCohort(undefined, "cohort-003"), undefined);
});
