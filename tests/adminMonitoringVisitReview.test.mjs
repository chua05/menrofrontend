import test from "node:test";
import assert from "node:assert/strict";
import { canDecideVisit, submittedVisits, visitMatchesRecordFilters, visitStatusLabel } from "../src/utils/adminMonitoringVisitReview.js";

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
