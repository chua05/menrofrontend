import test from "node:test";
import assert from "node:assert/strict";
import {
  finalReportRows, finalReportErrors, finalReportItems, finalReportFieldErrors, validatePlantingReportForm,
} from "../src/utils/plantingReportForm.js";
import { finalReportGroupRows, isFinalReportGroupLead, availableDecisions } from "../src/utils/plantingReviewWorkflow.js";

const items = [
  { inventoryId: "narra", species: "Narra", releasedQuantity: 25, remainingQuantity: 25 },
  { inventoryId: "mahogany", species: "Mahogany", releasedQuantity: 15, remainingQuantity: 15 },
  { inventoryId: "molave", species: "Molave", releasedQuantity: 5, remainingQuantity: 0 },
];

test("final report rows cover every released type with a balance; Planted = Available - Leftovers", () => {
  const rows = finalReportRows(items, { narra: { leftoverQuantity: "5", leftoverReason: "Wilted" } });
  assert.deepEqual(rows.map((row) => [row.inventoryId, row.remaining, row.planted, row.needsReason]),
    [["narra", 25, 20, true], ["mahogany", 15, 15, false]], "a fully reported type is not part of the final report");
  assert.deepEqual(finalReportItems(rows), [
    { inventoryId: "narra", leftoverQuantity: 5, leftoverReason: "Wilted" },
    { inventoryId: "mahogany", leftoverQuantity: 0, leftoverReason: "" }]);
  assert.equal(finalReportRows(items, { narra: { leftoverQuantity: "26" } })[0].planted, null, "invalid leftovers never show a planted number");
});

test("leftovers above zero require a reason; invalid leftovers are reported per type", () => {
  assert.deepEqual(finalReportErrors(finalReportRows(items, {})), {});
  assert.deepEqual(Object.keys(finalReportErrors(finalReportRows(items, { narra: { leftoverQuantity: "3" } }))), ["leftoverReason-narra"]);
  assert.ok(finalReportErrors(finalReportRows(items, { mahogany: { leftoverQuantity: "16" } }))["leftoverQuantity-mahogany"]);
  assert.ok(finalReportErrors(finalReportRows(items, { mahogany: { leftoverQuantity: "1.5" } }))["leftoverQuantity-mahogany"]);
  assert.ok(finalReportErrors(finalReportRows(items, { narra: { leftoverQuantity: "1", leftoverReason: "x".repeat(501) } }))["leftoverReason-narra"]);
  assert.equal(finalReportErrors([]).finalItems, "No seedlings remain to be reported for this planting event.");
  // Backend errors are indexed by item position; they land on that seedling type.
  const rows = finalReportRows(items, {});
  assert.deepEqual(finalReportFieldErrors({ "leftoverReason-1": "Enter the reason", photos: "x" }, rows), { "leftoverReason-mahogany": "Enter the reason", photos: "x" });
});

test("form validation uses the final-report rules when rows are given, and stays unchanged otherwise", () => {
  const form = { submittedByName: "A", submittedBySector: "Volunteer", submittedByContactNumber: "09123456789", barangay: "Bical",
    siteId: "s", siteName: "Site", eventId: "e", distributionId: "d", plantingDate: "2026-10-01", inventoryId: "", remainingQuantity: "" };
  const distributions = [{ id: "d", status: "Released" }];
  const finalErrors = validatePlantingReportForm(form, { distributions, finalRows: finalReportRows(items, { narra: { leftoverQuantity: "2" } }) });
  assert.equal(finalErrors.distributionItemKey, undefined, "no single species picker in a final report");
  assert.ok(finalErrors["leftoverReason-narra"]);
  assert.ok(validatePlantingReportForm(form, { distributions }).distributionItemKey, "legacy callers keep the old rule");
});

test("a final report's types are decided once, on its first row", () => {
  const rows = [
    { id: "g1-1", finalReportGroupId: "g1", finalReportGroupIndex: 1, staffReviewStatus: "Pending Review" },
    { id: "g1", finalReportGroupId: "g1", finalReportGroupIndex: 0, staffReviewStatus: "Pending Review" },
    { id: "legacy", staffReviewStatus: "Pending Review" },
  ];
  assert.deepEqual(finalReportGroupRows(rows[0], rows).map((row) => row.id), ["g1", "g1-1"]);
  assert.equal(isFinalReportGroupLead(rows[1], rows), true);
  assert.equal(isFinalReportGroupLead(rows[0], rows), false);
  assert.equal(isFinalReportGroupLead(rows[2], rows), true, "legacy rows are decided individually");
  assert.deepEqual(availableDecisions(rows[1], "staff"), ["forward", "return"]);
});

import { staffCorrectableFields, correctionSelectionErrors, editableCorrectionPaths, evidenceCarriedForward, evidenceState } from "../src/utils/plantingReviewWorkflow.js";

test("Admin can return only actual submitted fields; each selected field needs a comment", () => {
  const rows = [
    { inventoryId: "narra", species: "Narra", leftoverQuantity: 2, leftoverReason: "Wilted", confirmationBasis: "menro-field-report", remarks: "R", hasVerifiedPlantingEvidence: true },
    { inventoryId: "molave", species: "Molave", leftoverQuantity: 0 },
  ];
  assert.deepEqual(staffCorrectableFields(rows).map((field) => field.path),
    ["items.narra.leftoverQuantity", "items.narra.leftoverReason", "items.molave.leftoverQuantity", "confirmationBasis", "remarks", "evidence.photos"]);
  assert.equal(staffCorrectableFields([{ ...rows[0], hasVerifiedPlantingEvidence: false }]).some((field) => field.path === "evidence.photos"), false);
  assert.equal(correctionSelectionErrors({}).fields, "Select at least one field that needs correction.");
  assert.deepEqual(Object.keys(correctionSelectionErrors({ remarks: " ", "items.narra.leftoverQuantity": "Recount" })), ["fieldComment-remarks"]);
  assert.ok(correctionSelectionErrors({ remarks: "x".repeat(1001) })["fieldComment-remarks"]);
});

test("only returned fields are editable; unchanged verified evidence is carried forward", () => {
  const request = { fields: [{ path: "items.narra.leftoverQuantity" }, { path: "remarks" }] };
  assert.deepEqual([...editableCorrectionPaths(request)].sort(), ["items.narra.leftoverQuantity", "items.narra.leftoverReason", "remarks"]);
  assert.equal(evidenceCarriedForward(request, { hasVerifiedPlantingEvidence: true }), true);
  assert.equal(evidenceCarriedForward({ fields: [{ path: "evidence.photos" }] }, { hasVerifiedPlantingEvidence: true }), false);
  assert.equal(evidenceCarriedForward({ fields: [{ path: "confirmationBasis" }] }, { hasVerifiedPlantingEvidence: true }), false);
  assert.equal(evidenceCarriedForward(null, { hasVerifiedPlantingEvidence: true }), false, "older returns re-verify as before");
  const photo = { gpsValid: true, siteGpsValid: true, timestampValid: true };
  assert.equal(evidenceState(photo, { workflowStatus: "Returned for Correction" }), "rejected");
  assert.equal(evidenceState(photo, { workflowStatus: "Returned for Correction", evidenceCarriedForwardTo: "next" }), "verified", "carried evidence stays current on the map");
  assert.equal(evidenceState(photo, { workflowStatus: "Rejected", evidenceCarriedForwardTo: "next" }), "rejected");
});
