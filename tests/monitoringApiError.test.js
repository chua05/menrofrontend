import test from "node:test";
import assert from "node:assert/strict";
import { monitoringApiErrorMessage, monitoringEvidenceErrorMessage, monitoringWriteErrorMessage, monitoringErrorSampleId } from "../src/utils/monitoringApiError.js";

test("monitoring evidence codes become specific recovery messages", () => {
  const expected = {
    CAPTURE_LOCATION_INACCURATE: /accuracy/i,
    CAPTURE_LOCATION_OUTSIDE_SITE: /outside the assigned planting site/i,
    CAPTURE_TIMESTAMP_INVALID: /timestamp/i,
    DUPLICATE_EVIDENCE: /already registered/i,
    CAPTURE_SESSION_EXPIRED: /expired/i,
    ORIGINAL_GPS_INVALID: /GPS/i,
    ORIGINAL_TIMESTAMP_FUTURE: /future/i,
    CAPTURE_LOCATION_INVALID: /valid device GPS location/i,
    CAPTURE_SESSION_REPLAYED: /already used/i,
    CAPTURE_IMAGE_MISMATCH: /no longer matches/i,
  };
  for (const [code, pattern] of Object.entries(expected)) assert.match(monitoringApiErrorMessage({ code }), pattern, code);
});

test("D-6: UNSUPPORTED_MEDIA_TYPE is not a backend code and is no longer mapped", () => {
  assert.equal(monitoringApiErrorMessage({ code: "UNSUPPORTED_MEDIA_TYPE" }), "Monitoring visits could not be loaded.");
});

test("D-6: the evidence-upload path maps backend codes and never shows raw internals for unknown codes", () => {
  assert.match(monitoringEvidenceErrorMessage({ code: "CAPTURE_SESSION_REPLAYED", message: "Camera capture session has already been used." }), /already used/i);
  assert.match(monitoringEvidenceErrorMessage({ code: "CAPTURE_IMAGE_MISMATCH", message: "Captured image integrity check failed." }), /no longer matches/i);
  assert.match(monitoringEvidenceErrorMessage({ code: "CAPTURE_LOCATION_OUTSIDE_SITE", message: "raw" }), /outside the assigned planting site/i);
  const unknown = monitoringEvidenceErrorMessage({ code: "EVIDENCE_RECONCILIATION_REQUIRED", message: "intent VPME-abc objectName gs://bucket/private" });
  assert.equal(unknown, "The photo could not be saved. Retry, or take a new photo if the problem continues.");
  assert.doesNotMatch(unknown, /VPME|gs:|objectName|_/);
  assert.equal(monitoringEvidenceErrorMessage({}), "The photo could not be saved. Retry, or take a new photo if the problem continues.");
});

test("D-2: only an uncoded 409 (the backend version conflict) becomes the generic reload message", () => {
  const reload = "This monitoring visit changed. Reload the current authorized visit before trying again.";
  assert.equal(monitoringWriteErrorMessage({ status: 409, message: "This monitoring visit is no longer editable." }, reload), reload);
  const missing = { status: 409, code: "CURRENT_SAMPLE_EVIDENCE_REQUIRED", message: "Current verified evidence with GPS is required for every permanent sample in the first monitoring visit.", missingSampleIds: ["TREE-B"] };
  assert.equal(monitoringWriteErrorMessage(missing, reload), missing.message);
  assert.equal(monitoringWriteErrorMessage({ status: 409, code: "CONFIRMED_DEAD_LOCKED", message: "Tree TREE-A is a confirmed death carried forward and cannot be edited.", sampleId: "TREE-A" }, reload), "Tree TREE-A is a confirmed death carried forward and cannot be edited.");
  assert.equal(monitoringWriteErrorMessage({ status: 409, code: "ORIGINAL_BINDING_STALE", message: "Refresh." }, reload), "Refresh.");
  assert.equal(monitoringWriteErrorMessage({ status: 400, message: "Needs Rechecking requires remarks." }, reload), "Needs Rechecking requires remarks.");
  assert.equal(monitoringErrorSampleId(missing), "TREE-B");
  assert.equal(monitoringErrorSampleId({ sampleId: "TREE-A" }), "TREE-A");
  assert.equal(monitoringErrorSampleId({ status: 409 }), "");
});

test("M5: uncoded evidence-upload errors show the safe upload message, never server wording or a visit-list message", () => {
  const fallback = "The photo could not be saved. Retry, or take a new photo if the problem continues.";
  for (const message of ["Private upload temporarily unavailable.", "Error: ENOENT /srv/app/uploads/VPME-123", "9 FAILED_PRECONDITION: The query requires an index. console.firebase.google.com create_composite",
    "firebasestorage.googleapis.com permission denied", "   "]) {
    const shown = monitoringEvidenceErrorMessage({ message });
    assert.equal(shown, fallback, message);
    assert.doesNotMatch(shown, /Monitoring visits could not be loaded|index|ENOENT|firebase/i);
  }
  // Mapped codes keep their specific messages.
  assert.match(monitoringEvidenceErrorMessage({ code: "CAPTURE_LOCATION_OUTSIDE_SITE", message: "raw" }), /outside the assigned planting site/);
  assert.match(monitoringEvidenceErrorMessage({ code: "COHORT_WORKFLOW_DISABLED" }), /not enabled on the MENRO server/);
  assert.match(monitoringEvidenceErrorMessage({ code: "MONITORING_QUERY_INDEX_MISSING" }), /index is not ready/);
});
