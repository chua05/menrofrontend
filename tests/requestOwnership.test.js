import assert from "node:assert/strict";
import test from "node:test";
import { ownsSeedlingRequest, canProcessSeedlingRequest, canReleaseSeedlingRequest, plantingReportRequirement, createdSeedlingRequest, isStaffDirectRequest, needsAdminSiteVerification } from "../src/utils/requestOwnership.js";

test("requester ownership never includes encoder identity (self-processing rules)", () => {
  const assisted = { participantId: "citizen", walkIn: { encodedBy: "staff" } };
  assert.equal(ownsSeedlingRequest(assisted, { uid: "staff" }), false);
  assert.equal(ownsSeedlingRequest({ participantId: "staff" }, { uid: "staff" }), true);
  assert.equal(ownsSeedlingRequest(assisted, null), false);
});
test("self and assisted-encoder processing controls stay unavailable across role changes", () => {
  const assisted = { participantId: "citizen", walkIn: { encodedBy: "encoder" } };
  for (const role of ["staff", "admin"]) {
    for (const uid of ["citizen", "encoder"]) assert.equal(canProcessSeedlingRequest(assisted, { uid, role }), false);
    assert.equal(canProcessSeedlingRequest(assisted, { uid: "independent", role }), true);
  }
});

test("Staff My Requests includes their own requests and walk-ins they encoded, never another Staff member's", () => {
  const assisted = { participantId: "walkin_citizen", walkIn: { encodedBy: "staff-a" }, submittedByUid: "staff-a" };
  const historicalAssisted = { participantId: "walkin_old", walkIn: { encodedBy: "staff-a" } };
  assert.equal(createdSeedlingRequest(assisted, { uid: "staff-a" }), true);
  assert.equal(createdSeedlingRequest(historicalAssisted, { uid: "staff-a" }), true, "pre-fix walk-ins (no submittedByUid) are included via encoder");
  assert.equal(createdSeedlingRequest({ participantId: "staff-a" }, { uid: "staff-a" }), true);
  for (const request of [assisted, historicalAssisted, { participantId: "staff-a" }]) assert.equal(createdSeedlingRequest(request, { uid: "staff-b" }), false);
  assert.equal(createdSeedlingRequest(assisted, null), false);
  // The citizen stays the requester; the encoder still may not process it.
  assert.equal(ownsSeedlingRequest(assisted, { uid: "staff-a" }), false);
  assert.equal(canProcessSeedlingRequest(assisted, { uid: "staff-a", role: "staff" }), false);
});

test("direct-to-Admin requests and Admin site verification are recognized only from the stored submission path", () => {
  const proposed = { siteMode: "proposed" };
  assert.equal(isStaffDirectRequest({ submissionPath: "STAFF_DIRECT_TO_ADMIN" }), true);
  assert.equal(isStaffDirectRequest({ requesterRole: "staff", createdByRole: "staff" }), false, "historical Staff requests without the stored path are not reclassified");
  assert.equal(needsAdminSiteVerification({ submissionPath: "STAFF_DIRECT_TO_ADMIN", workflow: proposed }), true);
  assert.equal(needsAdminSiteVerification({ submissionPath: "STAFF_DIRECT_TO_ADMIN", workflow: { ...proposed, officialSiteId: "site-1" } }), false);
  assert.equal(needsAdminSiteVerification({ submissionPath: "STAFF_DIRECT_TO_ADMIN", workflow: proposed, proposedSiteVerification: { areaHectares: 1 } }), false);
  assert.equal(needsAdminSiteVerification({ submissionPath: "PARTICIPANT_STAFF_REVIEW", workflow: proposed }), false, "Participant sites are verified in Staff review");
  assert.equal(needsAdminSiteVerification({ submissionPath: "STAFF_DIRECT_TO_ADMIN", workflow: { siteMode: "existing" } }), false);
});

test("releasing an approved request is separate from reviewing it: the walk-in encoder may release, the requester never may", () => {
  const assisted = { status: "Approved", participantId: "citizen", walkIn: { encodedBy: "encoder" }, approvedBy: "admin" };
  for (const uid of ["encoder", "independent"]) assert.equal(canReleaseSeedlingRequest(assisted, { uid, role: "staff" }), true);
  assert.equal(canProcessSeedlingRequest(assisted, { uid: "encoder", role: "staff" }), false, "review and approval stay independent");
  for (const [request, user] of [[assisted, { uid: "citizen" }], [{ participantId: "staff" }, { uid: "staff" }], [{ ...assisted, approvedBy: "encoder" }, { uid: "encoder" }], [assisted, null], [assisted, {}]]) assert.equal(canReleaseSeedlingRequest(request, user), false);
});

test("the planting report requirement is stated only after release and only from the stored policy", () => {
  const released = (reporting, extra = {}) => ({ status: "Saplings Released", walkIn: { encodedBy: "encoder" }, reportingPolicy: { reporting }, ...extra });
  assert.deepEqual(plantingReportRequirement(released("REQUIRED")), { label: "Planting Report Required", staffAction: "Submit Planting Report" });
  assert.deepEqual(plantingReportRequirement(released("OPTIONAL")), { label: "Planting Report Optional", staffAction: "Submit Planting Report (Optional)" });
  assert.deepEqual(plantingReportRequirement(released("NOT_REQUIRED")), { label: "No Planting Report Required", staffAction: null });
  assert.deepEqual(plantingReportRequirement(released("PENDING_POLICY")), { label: "Reporting Policy Pending", staffAction: null });
  assert.equal(plantingReportRequirement(released("REQUIRED", { walkIn: undefined })).staffAction, null, "participants submit their own reports");
  for (const status of ["Approved", "Reviewed", "Pending Review"]) assert.equal(plantingReportRequirement(released("REQUIRED", { status })), null);
  assert.equal(plantingReportRequirement({ status: "Saplings Released", walkIn: {} }), null); assert.equal(plantingReportRequirement(null), null);
});
