import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const plantingPage = readFileSync(new URL("../src/pages/PlantingPage.jsx", import.meta.url), "utf8");
test("planting submission has a bounded recovery path", () => {
  assert.match(plantingPage, /const PLANTING_SUBMISSION_TIMEOUT_MS = 60_000/);
  assert.match(plantingPage, /new AbortController\(\)/);
  assert.match(plantingPage, /timeoutMs: PLANTING_SUBMISSION_TIMEOUT_MS/);
  // Every request is bounded, including sign-in and list refreshes.
  assert.match(plantingPage, /requestedTimeout \?\? \(!write \? READ_TIMEOUT_MS/);
  assert.match(plantingPage, /withDeadline\(readAuthToken\(forceRefresh\), AUTH_TIMEOUT_MS/);
  // A timed-out write is reconciled before anything is sent again.
  assert.match(plantingPage, /const pending = \{ eventId: form\.eventId, knownSubmissionIds/);
  assert.match(plantingPage, /findReconciledSubmission\(rows, unconfirmedSubmission\)/);
  // A confirmed save is announced before, and independently of, the list refresh.
  assert.match(plantingPage, /async function refreshAfterSave\(successMessage\) \{\s+showPopup\(successMessage\);/);
  assert.match(plantingPage, /loadReports\(\{ background: true \}\)/);
  assert.doesNotMatch(plantingPage, /onSaved=\{async \(\) => \{ await loadReports\(\)/);
});

test("closing or reopening the form keeps an unconfirmed submission", () => {
  const staffForm = readFileSync(new URL("../src/components/StaffPlantingReportForm.jsx", import.meta.url), "utf8");
  // Participant: close and open keep the locked form; a correction cannot relink it.
  assert.match(plantingPage, /function closeSubmitModal\(\) \{\s+if \(submitting\) return;\s+if \(unconfirmedSubmission\) \{/);
  assert.match(plantingPage, /async function openSubmitModal\(options\) \{[\s\S]{0,200}if \(unconfirmedSubmission\) \{/);
  assert.match(plantingPage, /function startCorrection\(submission\) \{\s+if \(!submission \|\| !selectedRecord\) return;\s+if \(unconfirmedSubmission\) \{/);
  assert.match(plantingPage, /savePendingSubmission\("participant", pending\.contributorId, pending\)/);
  // A 409 caused by the participant's own pending report is not shown as a balance change.
  assert.match(plantingPage, /error\?\.status === 409[\s\S]{0,200}findOwnPendingSubmission/);
  // Staff: the pending save lives outside the form and is replayed with its original body and key.
  assert.match(plantingPage, /pending=\{pendingOfficialSubmission === undefined \? loadPendingSubmission\("staff"/);
  assert.match(staffForm, /body: JSON\.stringify\(pending\.body\)/);
  assert.match(staffForm, /if \(isAmbiguousWriteFailure\(failure\)\) onPendingChange\(\{ body,/);
});

test("missing EXIF accuracy is not displayed as perfect accuracy", () => {
  assert.match(plantingPage, /function optionalFiniteNumber\(value\)/);
  assert.match(plantingPage, /const evidenceMapAccuracy = optionalFiniteNumber\(primaryLocationPreview\?\.accuracy\)/);
});

test("planting location metadata uses the 50 metre fallback consistently", () => {
  assert.match(readFileSync(new URL("../src/utils/plantingLocationPreview.js", import.meta.url), "utf8"), /const SITE_GPS_TOLERANCE_METERS = 50/);
  assert.match(plantingPage, /"50m-fallback"/);
  assert.doesNotMatch(plantingPage, /"20m-fallback"/);
});

test("photo verification problems are specific, shown in place, and never silent", () => {
  const staffForm = readFileSync(new URL("../src/components/StaffPlantingReportForm.jsx", import.meta.url), "utf8");
  const photos = readFileSync(new URL("../src/components/OfficialPlantingPhotos.jsx", import.meta.url), "utf8");
  // Staff: every photo is checked and a failure stays on that photo, beside Verify Photo Location.
  assert.match(photos, /next\.push\(\{ \.\.\.row, status: "failed", failure: failure\.message/);
  assert.match(photos, /className="pr-field-error pr-gps-verification-error" role="alert"/);
  // Submit keeps the photo's own reason instead of a generic message.
  assert.match(staffForm, /: failedPhoto \? failedPhoto\.failure/);
  // A confirmed report is never reported as unconfirmed when only an upload is unknown.
  assert.match(staffForm, /if \(report\) setError\(stage === "attendance"/);
  assert.match(staffForm, /else \{ setUnconfirmed\(true\); setError\(failure\.message\); \}/);
  // Form-level messages sit beside the buttons and are scrolled into view.
  assert.match(staffForm, /errorRef\.current\?\.scrollIntoView/);
  // Participant: the failed photo's reason is inline, and submit-form errors are revealed.
  assert.match(plantingPage, /error=\{formErrors\.photos \|\| photoPreviews\.find\(preview => preview\.verificationStatus === "failed"/);
  assert.match(plantingPage, /submitAlertRef\.current\?\.scrollIntoView/);
  assert.match(plantingPage, /isGatewayWriteFailure\(requestOptions\.method, response\.status, payload\)/);
});
