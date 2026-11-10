import test from "node:test";
import assert from "node:assert/strict";
import {
  reportSubmissionStatus, reportReviewStatus, reportHistory,
  photoAvailabilityMessage, latestSubmittedAt, reportSeedlingItems, reportKpiCounts,
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
  assert.equal(reportReviewStatus(accepted), "Completed");
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
  const withStage = (stage) => ({ ...submitted, reviewStatus: stage });
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
