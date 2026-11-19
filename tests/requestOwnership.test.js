import assert from "node:assert/strict";
import test from "node:test";
import { ownsSeedlingRequest, canProcessSeedlingRequest, createdSeedlingRequest, isStaffDirectRequest, needsAdminSiteVerification } from "../src/utils/requestOwnership.js";

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
