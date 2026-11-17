import test from "node:test";
import assert from "node:assert/strict";
import { canResubmitObservation, canStaffReviewObservation, isOwnPendingObservation, observationReporterIds }
  from "../src/utils/monitoringObservationPermissions.js";

const returned = { workflowVersion: 2, reviewStatus: "Returned for Rechecking", returnReason: "Recheck", originalReporterId: "staff-a" };
const pending = { workflowVersion: 2, reviewStatus: "Pending Review", originalReporterId: "staff-a",
  revisionHistory: [{ submittedBy: "staff-a" }, { submittedBy: "staff-b" }] };

test("only the original Staff reporter may resubmit a returned observation", () => {
  assert.equal(canResubmitObservation({ entry: returned, role: "staff", userId: "staff-a" }), true);
  for (const [role, userId] of [["staff", "staff-other"], ["admin", "staff-a"], ["participant", "staff-a"], ["staff", ""], ["staff", undefined]]) {
    assert.equal(canResubmitObservation({ entry: returned, role, userId }), false, `${role}/${userId}`);
  }
  // A Participant who reported a historical observation no longer gets a (broken) resubmit action.
  assert.equal(canResubmitObservation({ entry: { ...returned, originalReporterId: "participant-1" }, role: "participant", userId: "participant-1" }), false);
  assert.equal(canResubmitObservation({ entry: { ...returned, reviewStatus: "Pending Review" }, role: "staff", userId: "staff-a" }), false);
  assert.equal(canResubmitObservation({ entry: { ...returned, workflowVersion: 1 }, role: "staff", userId: "staff-a" }), false);
});

test("Staff never review their own observation, including ones they resubmitted", () => {
  assert.deepEqual([...observationReporterIds(pending)].sort(), ["staff-a", "staff-b"]);
  for (const userId of ["staff-a", "staff-b"]) {
    assert.equal(canStaffReviewObservation({ entry: pending, role: "staff", userId }), false);
    assert.equal(isOwnPendingObservation({ entry: pending, role: "staff", userId }), true);
  }
  assert.equal(canStaffReviewObservation({ entry: pending, role: "staff", userId: "staff-reviewer" }), true);
  assert.equal(isOwnPendingObservation({ entry: pending, role: "staff", userId: "staff-reviewer" }), false);
  assert.equal(canStaffReviewObservation({ entry: pending, role: "admin", userId: "admin-1" }), false);
  assert.equal(canStaffReviewObservation({ entry: pending, role: "staff", userId: "" }), false);
  // Historical Participant-reported observations remain reviewable by Staff.
  assert.equal(canStaffReviewObservation({ entry: { ...pending, originalReporterId: "participant-1", revisionHistory: [] }, role: "staff", userId: "staff-a" }), true);
});
