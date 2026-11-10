import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WORKFLOW_STATUS,
  WORKFLOW_STATUS_CLASS,
  availableDecisions,
  buildEvidenceMarkers,
  decisionReasonError,
  evidenceState,
  historyEntries,
  submissionWorkflowStatus,
  waitingMessage,
} from "../src/utils/plantingReviewWorkflow.js";

const source = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
const participant = (overrides = {}) => ({ id: "sub-1", staffReviewStatus: "Pending Review", ...overrides });
const official = (overrides = {}) => ({ id: "off-1", officialStaffReport: true, staffReviewStatus: "Pending Review", ...overrides });

test("legacy records derive their stage without a stored workflow status", () => {
  assert.equal(submissionWorkflowStatus(participant()), WORKFLOW_STATUS.PENDING_REVIEW);
  assert.equal(submissionWorkflowStatus(participant({ staffReviewStatus: "Accepted" })), WORKFLOW_STATUS.COMPLETED);
  assert.equal(submissionWorkflowStatus(participant({ staffReviewStatus: "Not Required" })), WORKFLOW_STATUS.COMPLETED);
  assert.equal(submissionWorkflowStatus(participant({ staffReviewStatus: "Rejected" })), WORKFLOW_STATUS.REJECTED);
  assert.equal(submissionWorkflowStatus(official()), WORKFLOW_STATUS.PENDING_ADMIN_APPROVAL);
  assert.equal(submissionWorkflowStatus(official({ staffReviewStatus: "Rejected" })), WORKFLOW_STATUS.RETURNED,
    "legacy official rejections were returns the submitter could correct");
  assert.equal(submissionWorkflowStatus(participant({ workflowStatus: "Reviewed" })), WORKFLOW_STATUS.REVIEWED);
});

test("Staff forwards or returns participant reports; only Admin decides after Staff review", () => {
  assert.deepEqual(availableDecisions(participant(), "staff"), ["forward", "return"]);
  assert.deepEqual(availableDecisions(participant(), "admin"), [], "Admin waits for Staff review");
  assert.deepEqual(availableDecisions(participant({ workflowStatus: "Reviewed" }), "admin"), ["approve", "reject"]);
  assert.deepEqual(availableDecisions(participant({ workflowStatus: "Reviewed" }), "staff"), []);
  assert.deepEqual(availableDecisions(participant(), "participant"), []);
  for (const status of ["Completed", "Rejected", "Returned for Correction"]) {
    assert.deepEqual(availableDecisions(participant({ workflowStatus: status }), "admin"), []);
    assert.deepEqual(availableDecisions(participant({ workflowStatus: status }), "staff"), []);
  }
});

test("Staff-submitted reports go directly to Admin with approve, reject and return", () => {
  assert.deepEqual(availableDecisions(official(), "admin"), ["approve", "reject", "return"]);
  assert.deepEqual(availableDecisions(official(), "staff"), [], "Staff never reviews its own official report");
  assert.deepEqual(availableDecisions(official({ workflowStatus: "Rejected" }), "admin"), []);
});

test("return and reject require a bounded reason; forward and approve remarks are optional", () => {
  assert.match(decisionReasonError("return", "   "), /reason for returning/);
  assert.match(decisionReasonError("reject", ""), /reason for rejecting/);
  assert.equal(decisionReasonError("return", "Retake the photos"), "");
  assert.equal(decisionReasonError("forward", ""), "");
  assert.equal(decisionReasonError("approve", ""), "");
  assert.match(decisionReasonError("reject", "x".repeat(1001)), /at most 1000/);
});

test("status colors follow the approved palette", () => {
  assert.equal(WORKFLOW_STATUS_CLASS["Pending Review"], "pr-status-pending");
  assert.equal(WORKFLOW_STATUS_CLASS["Returned for Correction"], "pr-status-returned");
  assert.equal(WORKFLOW_STATUS_CLASS.Reviewed, "pr-status-reviewed");
  assert.equal(WORKFLOW_STATUS_CLASS["Pending Admin Approval"], "pr-status-reviewed");
  assert.equal(WORKFLOW_STATUS_CLASS.Completed, "pr-status-approved");
  assert.equal(WORKFLOW_STATUS_CLASS.Rejected, "pr-status-rejected");
  const css = source("styles/planting-reports.css");
  assert.match(css, /\.pr-status-pending \{\s*color: #92400e;\s*background: #fef3c7;/, "Pending Review is amber");
  assert.match(css, /\.pr-status-returned \{\s*color: #9a3412;/, "Returned is amber");
  assert.match(css, /\.pr-status-reviewed \{\s*color: #1d4ed8;/, "Reviewed is blue");
});

test("evidence is verified only when every saved check passed; returned and rejected evidence is marked", () => {
  const passed = { gpsValid: true, siteGpsValid: true, timestampValid: true };
  assert.equal(evidenceState(passed, participant()), "verified");
  assert.equal(evidenceState({ ...passed, siteGpsValid: false }, participant()), "unverified");
  assert.equal(evidenceState({}, participant()), "unverified");
  assert.equal(evidenceState(passed, participant({ workflowStatus: "Rejected" })), "rejected");
  assert.equal(evidenceState(passed, participant({ workflowStatus: "Returned for Correction" })), "rejected");
});

test("map markers use only saved photo coordinates", () => {
  const markers = buildEvidenceMarkers([
    { id: "a", workflowStatus: "Reviewed", indexedPhotos: [
      { reportPhotoIndex: 0, latitude: 12.66, longitude: 123.92, locationAccuracyMeters: 8, gpsValid: true, siteGpsValid: true, timestampValid: true },
      { reportPhotoIndex: 1, metadata: { latitude: "12.661", longitude: "123.921" } },
      { reportPhotoIndex: 2 },
      { reportPhotoIndex: 3, latitude: 120, longitude: 123 },
    ] },
    { id: "b", staffReviewStatus: "Rejected", indexedPhotos: [{ reportPhotoIndex: 4, latitude: 12.67, longitude: 123.93 }] },
  ]);
  assert.deepEqual(markers.map((marker) => [marker.label, marker.state]), [["Photo 1", "verified"], ["Photo 2", "unverified"], ["Photo 5", "rejected"]]);
  assert.equal(markers[0].accuracy, 8);
});

test("history keeps the server order and highlights returns and rejections", () => {
  const entries = historyEntries([
    { id: "1", action: "Staff Review — Forwarded to Admin", performedByName: "Staff", performedByRole: "staff", previousStatus: "Pending Review", newStatus: "Reviewed" },
    { id: "2", action: "Admin Rejection", performedBy: "admin-uid", remarks: "Outside site" },
    { id: "3", action: "Staff Return for Correction" },
  ]);
  assert.deepEqual(entries.map((entry) => entry.tone), ["default", "rejected", "returned"]);
  assert.equal(entries[1].by, "admin-uid");
  assert.equal(waitingMessage(participant(), "admin"), "Awaiting MENRO Staff review before Admin approval.");
  assert.equal(waitingMessage(official(), "staff"), "Awaiting MENRO Admin approval.");
});

test("View Report never shows the upload prompt and uses the read-only evidence map", () => {
  const page = source("pages/PlantingPage.jsx");
  const drawer = page.slice(page.indexOf("{showViewModal && selectedRecord && ("), page.indexOf("{cameraOpen && <ModalDialog"));
  assert.ok(drawer.length > 1000, "View Report drawer located");
  assert.doesNotMatch(drawer, /Upload or take a photo first/);
  assert.match(drawer, /<PlantingEvidenceMap/);
  assert.doesNotMatch(source("components/PlantingEvidenceMap.jsx"), /Upload or take a photo first/);
});
