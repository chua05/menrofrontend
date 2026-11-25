import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/PermanentSampleMonitoringPage.jsx", import.meta.url), "utf8");

test("D-10: the empty-form footer names its disabled submit button Submit Monitoring Visit", () => {
  assert.doesNotMatch(page, /aria-label="Submit Visit"/);
  assert.doesNotMatch(page, />Submit Visit</);
});

test("D-6: evidence upload errors go through the monitoring error mapper, never the raw backend message", () => {
  assert.match(page, /monitoringEvidenceErrorMessage\(payload\)/);
  assert.doesNotMatch(page, /payload\.message \|\|/);
});

test("D-2: save and evidence 409s use the version-conflict helper instead of replacing every coded 409", () => {
  assert.match(page, /monitoringWriteErrorMessage\(requestError, "This monitoring visit changed\./);
  assert.match(page, /monitoringWriteErrorMessage\(requestError, "Evidence changed while uploading\./);
  assert.match(page, /monitoringErrorSampleId\(requestError\)/);
});

test("M3: a timed-out Save Tree Assessment remembers its tree and reconcile keeps other trees' unsaved edits", () => {
  assert.match(page, /setUnconfirmed\(\{ visitId: detail\.id, savedSampleId, \.\.\.payload \}\)/);
  const reconcile = page.slice(page.indexOf("const reconcile = async"), page.indexOf("const cameraBinding"));
  assert.match(reconcile, /setAssessments\(current => keepUnsavedEdits\(data\.sampleAssessments\.map\(formAssessment\), current, unconfirmed\.savedSampleId\)\)/);
  // The confirmed save path uses the same merge.
  assert.match(page, /setAssessments\(current => keepUnsavedEdits\(\(data\.sampleAssessments \|\| \[\]\)\.map\(formAssessment\), current, savedSampleId\)\)/);
});

test("D-B: the report selector has one accessible name, Verified Planting Report *, with or without an open visit", () => {
  assert.equal((page.match(/className="psm-field"><span className="psm-label">Verified Planting Report \*<\/span><select/g) || []).length, 2);
  assert.doesNotMatch(page, /Verified Planting Report<select/);
});

test("readiness cards, options and selection show schedule status labels, never raw codes such as DUE", () => {
  assert.match(page, /Status: \{scheduleStatusLabel\(cohort\.scheduleStatus\)\}/);
  assert.match(page, /<dd>\{scheduleStatusLabel\(selectedReadiness\.scheduleStatus\)\}<\/dd>/);
  assert.match(page, /row\.scheduleStatus \? scheduleStatusLabel\(row\.scheduleStatus\)/);
  assert.doesNotMatch(page, /\{cohort\.scheduleStatus \|\| "Pending"\}|\{selectedReadiness\.scheduleStatus \|\| "Pending"\}/);
});

test("the picker de-duplicates Setup Pending rows against eligible readiness rows", () => {
  assert.match(page, /const pendingReports = withoutEligibleDuplicates\(offeredPendingReports, readiness\?\.data\?\.eligible \|\| \[\]\)/);
});

test("the empty state describes Visit 1 and never asks for an approved sampling plan or baseline", () => {
  assert.match(page, /\{firstVisitReadiness && <p>Select a verified planting report and start Visit 1\. Visit 1 registers the automatic 10% sample/);
  assert.match(page, /\{nothingAvailable && <p role="status">No authorized monitoring visits are available\.<\/p>\}/);
  assert.match(page, /const legacyReadiness = userRole === "admin" &&/);
  assert.match(page, /\{legacyReadiness && <p>A visit appears here after MENRO creates it from an approved sampling plan and baseline/);
});
