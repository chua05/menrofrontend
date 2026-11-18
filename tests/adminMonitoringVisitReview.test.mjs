import test from "node:test";
import assert from "node:assert/strict";
import { canDecideVisit, createLatestRequestGate, loadSubmittedVisitPages, submittedVisits, visitMatchesRecordFilters, visitStatusLabel } from "../src/utils/adminMonitoringVisitReview.js";

const visit = (status, extra = {}) => ({ id: `V-${status}`, status, actions: { review: status === "PENDING_ADMIN_APPROVAL" }, ...extra });

test("drafts never enter the Admin Monitoring Records rows", () => {
  const rows = submittedVisits([visit("DRAFT"), visit("PENDING_ADMIN_APPROVAL"), visit("RETURNED"), visit("APPROVED"), { status: "APPROVED" }, null]);
  assert.deepEqual(rows.map((row) => row.status), ["PENDING_ADMIN_APPROVAL", "RETURNED", "APPROVED"]);
  assert.deepEqual(submittedVisits(undefined), []);
});

test("Approve/Return only for pending visits the backend marks reviewable and only while writes are open", () => {
  assert.equal(canDecideVisit(visit("PENDING_ADMIN_APPROVAL")), true);
  assert.equal(canDecideVisit(visit("PENDING_ADMIN_APPROVAL"), { writesPaused: true }), false);
  assert.equal(canDecideVisit(visit("PENDING_ADMIN_APPROVAL", { actions: { review: false } })), false);
  for (const status of ["DRAFT", "RETURNED", "APPROVED"]) assert.equal(canDecideVisit(visit(status, { actions: { review: true } })), false);
});

test("status labels are display-only and never say Verified", () => {
  assert.equal(visitStatusLabel("PENDING_ADMIN_APPROVAL"), "Pending Admin Review");
  assert.equal(visitStatusLabel("RETURNED"), "Returned for Correction");
  assert.equal(visitStatusLabel("APPROVED"), "Approved");
});

test("existing Monitoring Records filters apply to visit rows without guessing species or condition", () => {
  const row = visit("PENDING_ADMIN_APPROVAL", { reportNumber: "RPT-2026-001", siteName: "Bical Site", barangay: "Bical", submittedByName: "Ana Staff", dateMonitored: "2026-11-02", visitDate: "2026-11-05" });
  assert.equal(visitMatchesRecordFilters(row), true);
  assert.equal(visitMatchesRecordFilters(row, { search: "ana staff" }), true);
  assert.equal(visitMatchesRecordFilters(row, { search: "rpt-2026-001" }), true);
  assert.equal(visitMatchesRecordFilters(row, { search: "pending admin" }), true);
  assert.equal(visitMatchesRecordFilters(row, { search: "nothing" }), false);
  assert.equal(visitMatchesRecordFilters(row, { site: "Bical Site" }), true);
  assert.equal(visitMatchesRecordFilters(row, { site: "Other" }), false);
  assert.equal(visitMatchesRecordFilters(row, { species: "Narra" }), false);
  assert.equal(visitMatchesRecordFilters(row, { condition: "Healthy" }), false);
  assert.equal(visitMatchesRecordFilters(row, { from: "2026-11-01", to: "2026-11-02" }), true);
  assert.equal(visitMatchesRecordFilters(row, { from: "2026-11-03" }), false);
});

test("every page is read, so a pending visit behind many draft-only pages stays discoverable", async () => {
  // Six pages of drafts (more than the old 4-page cap), then the pending visit on page 7.
  const pages = Array.from({ length: 7 }, (_, index) => ({
    visits: index < 6 ? Array.from({ length: 50 }, (__, row) => visit("DRAFT", { id: `D-${index}-${row}` })) : [visit("PENDING_ADMIN_APPROVAL", { id: "PENDING-OLD" })],
    nextCursor: index < 6 ? `cursor-${index}` : null,
    writesPaused: false,
  }));
  const calls = [];
  const result = await loadSubmittedVisitPages(async ({ cursor, limit }) => { calls.push([cursor, limit]); return pages[calls.length - 1]; }, { pageSize: 50, maxPages: 200 });
  assert.deepEqual(result.rows.map((row) => row.id), ["PENDING-OLD"]);
  assert.equal(result.truncated, false);
  assert.deepEqual(calls.map(([cursor]) => cursor), ["", "cursor-0", "cursor-1", "cursor-2", "cursor-3", "cursor-4", "cursor-5"]);
  assert.ok(calls.every(([, limit]) => limit === 50));
});

test("paging stops on a repeated cursor or the runaway guard and reports truncation; flags accumulate", async () => {
  const looping = await loadSubmittedVisitPages(async () => ({ visits: [visit("APPROVED")], nextCursor: "same" }), { maxPages: 50 });
  assert.equal(looping.truncated, true);
  assert.equal(looping.rows.length, 2);
  let n = 0;
  const capped = await loadSubmittedVisitPages(async () => ({ visits: [], nextCursor: `c${++n}`, writesPaused: n === 2, labelsIncomplete: n === 1 }), { maxPages: 3 });
  assert.deepEqual([n, capped.truncated, capped.writesPaused, capped.labelsIncomplete], [3, true, true, true]);
});

test("a slower earlier load is discarded once a newer load (e.g. the post-decision refresh) begins", async () => {
  const gate = createLatestRequestGate();
  let releaseFirst;
  const firstPage = new Promise((resolve) => { releaseFirst = resolve; });
  const first = loadSubmittedVisitPages(() => firstPage, { isCurrent: gate.begin() });
  const second = await loadSubmittedVisitPages(async () => ({ visits: [visit("APPROVED", { id: "V" })], nextCursor: null }), { isCurrent: gate.begin() });
  releaseFirst({ visits: [visit("PENDING_ADMIN_APPROVAL", { id: "V" })], nextCursor: null });
  assert.equal(await first, null);
  assert.deepEqual(second.rows.map((row) => row.status), ["APPROVED"]);
  const afterUnmount = gate.begin();
  gate.cancel();
  assert.equal(afterUnmount(), false);
});
