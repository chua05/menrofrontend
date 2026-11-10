import test from "node:test";
import assert from "node:assert/strict";
import {
  reportSubmissionStatus, reportReviewStatus, reportHistory,
  photoAvailabilityMessage, latestSubmittedAt, reportSeedlingItems, reportKpiCounts,
  reportReviewStages, reportMatchesStatusFilter, currentReports, REPORT_STATUS_FILTERS,
} from "../src/utils/plantingReportView.js";

const emptyParent = { id: "event_EVT-1", reportType: "parent", createdAt: "2026-11-09T13:07:00Z",
  reportingProgress: "Awaiting Submission", submissions: [] };
const submitted = {
  ...emptyParent,
  reportingProgress: "Partial",
  submissions: [
    { id: "c1", quantity: 10, species: "Narra", recordedAt: "2026-11-10T01:00:00Z", submittedByName: "A",
      staffReviewStatus: "Pending Review", verificationStatus: "Verified",
      photos: [
        { latitude: 12.66, longitude: 123.88, siteGpsValid: true, photoCapturedAt: "2026-11-10T00:59:00Z" },
        { metadata: {} },
      ] },
    { id: "c2", quantity: 5, species: "Mahogany", recordedAt: "2026-11-10T02:00:00Z", submittedByName: "B",
      staffReviewStatus: "Pending Review", verificationStatus: "Needs Review",
      photos: [{ metadata: { latitude: 12.67, longitude: 123.9 }, siteGpsValid: false }] },
  ],
};

test("a saved submission is Submitted while review stays Pending Review (never Approved/Completed)", () => {
  assert.equal(reportSubmissionStatus(emptyParent), "Awaiting Submission");
  assert.equal(reportReviewStatus(emptyParent), "Not Submitted");
  assert.equal(reportSubmissionStatus(submitted), "Submitted");
  assert.equal(reportReviewStatus(submitted), "Pending Review");
  const accepted = { ...submitted, submissions: submitted.submissions.map((s) => ({ ...s, staffReviewStatus: "Accepted" })) };
  // All submissions approved, but released seedlings remain unreported: not Completed.
  assert.equal(reportReviewStatus(accepted), "Awaiting Remaining Report");
  assert.equal(reportReviewStatus({ ...accepted, reportingProgress: "Completed" }), "Completed");
  const forwarded = { ...submitted, submissions: submitted.submissions.map((s) => ({ ...s, workflowStatus: "Reviewed" })) };
  assert.equal(reportReviewStatus(forwarded), "Reviewed");
  const returned = { ...submitted, submissions: [{ ...submitted.submissions[0], staffReviewStatus: "Rejected", workflowStatus: "Returned for Correction" }] };
  assert.equal(reportReviewStatus(returned), "Returned for Correction");
  assert.equal(reportReviewStatus({ ...submitted, reviewStatus: "Reviewed" }), "Reviewed", "backend stage is authoritative");
  const rejected = { ...submitted, submissions: submitted.submissions.map((s) => ({ ...s, staffReviewStatus: "Rejected" })) };
  assert.equal(reportSubmissionStatus(rejected), "Submitted");
  assert.equal(reportReviewStatus(rejected), "Rejected");
});

test("history does not present the release-time report shell as a submission", () => {
  const empty = reportHistory(emptyParent);
  assert.deepEqual(empty.map((item) => item.kind), ["opened", "awaiting"]);
  assert.equal(empty.some((item) => item.kind === "submitted"), false);
  const history = reportHistory(submitted);
  assert.deepEqual(history.map((item) => item.kind), ["opened", "submitted", "submitted"]);
  assert.equal(history[1].by, "A");
  assert.equal(latestSubmittedAt(emptyParent), null);
  assert.equal(latestSubmittedAt(submitted), "2026-11-10T02:00:00Z");
});

test("photo message distinguishes not-yet-submitted from missing evidence", () => {
  assert.equal(photoAvailabilityMessage(emptyParent).title, "No evidence submitted yet");
  assert.equal(photoAvailabilityMessage(submitted).title, "Photo unavailable");
});

test("seedling column lists every released type and quantity from the linked allocation", () => {
  const multi = { ...emptyParent, species: "", allocationSummary: [
    { inventoryId: "i1", species: "Narra", allocated: 10, recorded: 0 },
    { inventoryId: "i2", species: "Mahogany", allocated: 5, recorded: 0 },
  ] };
  assert.deepEqual(reportSeedlingItems(multi), [
    { species: "Narra", quantity: 10 }, { species: "Mahogany", quantity: 5 }]);
  // Single-type release with no submission still shows its real type (never "—").
  const single = { ...emptyParent, species: "", allocationSummary: [{ species: "Narra", allocated: 25 }] };
  assert.deepEqual(reportSeedlingItems(single), [{ species: "Narra", quantity: 25 }]);
  // Without allocation data, fall back to saved submissions, then stored species text.
  assert.deepEqual(reportSeedlingItems({ ...submitted, allocationSummary: [] }), [
    { species: "Narra", quantity: 10 }, { species: "Mahogany", quantity: 5 }]);
  assert.deepEqual(reportSeedlingItems({ ...emptyParent, species: "Narra, Molave" }), [
    { species: "Narra", quantity: null }, { species: "Molave", quantity: null }]);
  assert.deepEqual(reportSeedlingItems({ ...emptyParent, species: "" }), []);
});

test("KPI counts follow submission and review stages without double counting", () => {
  // Backend sends reviewStatus (primary label) and reviewStages (all open queues).
  const unfinished = ["Pending Review", "Reviewed", "Pending Admin Approval", "Returned for Correction"];
  const withStage = (stage) => ({ ...submitted, reviewStatus: stage, reviewStages: unfinished.includes(stage) ? [stage] : [] });
  const records = [
    emptyParent, emptyParent,
    submitted, // derives Pending Review
    withStage("Reviewed"), withStage("Pending Admin Approval"),
    withStage("Returned for Correction"),
    withStage("Completed"),
    withStage("Rejected"),
  ];
  assert.deepEqual(reportKpiCounts(records), {
    total: 8, awaiting: 2, pendingReview: 1, pendingApproval: 2, returned: 1, completed: 1,
  });
  assert.deepEqual(reportKpiCounts([]), {
    total: 0, awaiting: 0, pendingReview: 0, pendingApproval: 0, returned: 0, completed: 0 });
});

test("a report waiting on Staff and Admin counts in both queues and the filter agrees", () => {
  const mixed = { ...submitted, reviewStatus: "Pending Review", reviewStages: ["Pending Review", "Reviewed"] };
  assert.deepEqual(reportReviewStages(mixed), ["Pending Review", "Reviewed"]);
  const counts = reportKpiCounts([mixed]);
  assert.equal(counts.pendingReview, 1);
  assert.equal(counts.pendingApproval, 1);
  assert.equal(reportMatchesStatusFilter(mixed, "pendingReview"), true);
  assert.equal(reportMatchesStatusFilter(mixed, "pendingApproval"), true);
  assert.equal(reportMatchesStatusFilter(mixed, "completed"), false);
  // Without backend stages (older API), stages derive from the submissions themselves.
  const derived = { ...submitted, submissions: [submitted.submissions[0], { ...submitted.submissions[1], workflowStatus: "Reviewed" }] };
  assert.deepEqual(reportReviewStages(derived), ["Pending Review", "Reviewed"]);
});

test("approved-so-far legacy partial reports are not Completed in cards, filter or label", () => {
  const partial = { ...submitted, reportingProgress: "Partial", reviewStatus: "Awaiting Remaining Report", reviewStages: [] };
  assert.equal(reportReviewStatus(partial), "Awaiting Remaining Report");
  assert.equal(reportKpiCounts([partial]).completed, 0);
  assert.equal(reportMatchesStatusFilter(partial, "awaitingRemaining"), true);
  assert.equal(reportMatchesStatusFilter(partial, "completed"), false);
  const done = { ...submitted, reportingProgress: "Completed", reviewStatus: "Completed", reviewStages: [] };
  assert.equal(reportKpiCounts([done]).completed, 1);
  assert.equal(reportMatchesStatusFilter(done, "completed"), true);
});

test("legacy standalone reports filter by their review stage; superseded corrections are hidden", () => {
  const approved = { id: "r1", reportType: undefined, workflowStatus: "Completed", verificationStatus: "Approved" };
  const returnedOld = { id: "r2", workflowStatus: "Returned for Correction", correctedByReportId: "r3" };
  const correction = { id: "r3", workflowStatus: "Pending Review", correctionOf: "r2" };
  // Standalone reports have no reportingProgress; they must not read as Awaiting Submission.
  assert.equal(reportMatchesStatusFilter(approved, "awaiting"), false);
  assert.equal(reportMatchesStatusFilter(approved, "completed"), true);
  assert.deepEqual(currentReports([approved, returnedOld, correction]).map((r) => r.id), ["r1", "r3"]);
  assert.deepEqual(reportKpiCounts([approved, returnedOld, correction]), {
    total: 2, awaiting: 0, pendingReview: 1, pendingApproval: 0, returned: 0, completed: 1 });
  assert.deepEqual(REPORT_STATUS_FILTERS.map((f) => f.label), ["Awaiting Submission", "Pending Review", "Pending Approval",
    "Returned for Correction", "Awaiting Remaining Report", "Completed", "Rejected"]);
});
