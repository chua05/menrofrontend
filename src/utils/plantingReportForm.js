import { leftoverQuantityError } from "./plantingQuantity.js";

export const MAX_LEFTOVER_REASON_LENGTH = 500;

// One final Planting Report covers every released type that still has a
// balance. Per type: Final Planted = Remaining - Final Leftovers (the backend
// recomputes it; this is the preview). `entries`: { [inventoryId]: { leftoverQuantity, leftoverReason } }.
export function finalReportRows(items = [], entries = {}) {
  return items.filter((item) => Number(item.remainingQuantity) > 0).map((item) => {
    const entry = entries[item.inventoryId] || {};
    const leftoverQuantity = entry.leftoverQuantity ?? "0";
    const remaining = Number(item.remainingQuantity);
    return {
      inventoryId: item.inventoryId, species: item.species || "Seedling",
      releasedQuantity: Number(item.releasedQuantity ?? 0), remaining,
      leftoverQuantity, leftoverReason: entry.leftoverReason ?? "",
      planted: leftoverQuantityError(leftoverQuantity, remaining) ? null : remaining - Number(leftoverQuantity),
      needsReason: !leftoverQuantityError(leftoverQuantity, remaining) && Number(leftoverQuantity) > 0,
    };
  });
}

export function finalReportErrors(rows = []) {
  const errors = {};
  if (!rows.length) errors.finalItems = "No seedlings remain to be reported for this planting event.";
  for (const row of rows) {
    const leftoverError = leftoverQuantityError(row.leftoverQuantity, row.remaining);
    if (leftoverError) errors[`leftoverQuantity-${row.inventoryId}`] = leftoverError;
    const reason = String(row.leftoverReason || "").trim();
    if (row.needsReason && !reason) errors[`leftoverReason-${row.inventoryId}`] = "Enter the reason for the leftover seedlings.";
    else if (reason.length > MAX_LEFTOVER_REASON_LENGTH) errors[`leftoverReason-${row.inventoryId}`] = `Use at most ${MAX_LEFTOVER_REASON_LENGTH} characters.`;
  }
  return errors;
}

// Request body for the final report: leftovers and reasons only; planted is
// computed by the backend from the authoritative balance.
export function finalReportItems(rows = []) {
  return rows.map((row) => ({ inventoryId: row.inventoryId, leftoverQuantity: Number(row.leftoverQuantity),
    leftoverReason: Number(row.leftoverQuantity) > 0 ? String(row.leftoverReason || "").trim() : "" }));
}

// Backend field errors are indexed by item position; show them on that type.
export function finalReportFieldErrors(fieldErrors = {}, rows = []) {
  return Object.fromEntries(Object.entries(fieldErrors).map(([key, value]) => {
    const match = /^(leftoverQuantity|leftoverReason)-(\d+)$/.exec(key);
    return match && rows[Number(match[2])] ? [`${match[1]}-${rows[Number(match[2])].inventoryId}`, value] : [key, value];
  }));
}

export function validatePlantingReportForm(form, { distributions = [], photos = [], previews = [], hasGps, municipalityScopeStatus, finalRows } = {}) {
  const errors = {};
  if (!form.submittedByName?.trim()) errors.submittedByName = "Enter your full name.";
  if (!form.submittedBySector) errors.submittedBySector = "Select your sector.";
  if (!/^(?:\+63|0)9\d{9}$/.test(String(form.submittedByContactNumber || "").replace(/[\s-]/g, ""))) errors.submittedByContactNumber = "Enter a valid Philippine mobile number.";
  if (!form.barangay) errors.barangay = "Select a barangay with a planting site.";
  if (!form.siteId || !form.siteName) errors.siteId = "Select a registered planting site.";
  if (!form.eventId) errors.eventId = "Select a planting event.";
  if (!distributions.some(row => String(row.id) === String(form.distributionId) && row.status === "Released")) errors.distributionId = "Select a valid released seedling distribution.";
  if (!form.plantingDate) errors.plantingDate = "The planting event needs a valid date.";
  if (Array.isArray(finalRows)) {
    // Final report: every released type with a balance, leftovers + reasons per type.
    if (form.distributionId) Object.assign(errors, finalReportErrors(finalRows));
  } else {
    if (!form.inventoryId) errors.distributionItemKey = "Select the released seedling species.";
    const hasBalance = form.remainingQuantity !== "" && form.remainingQuantity != null;
    const leftoverError = leftoverQuantityError(form.leftoverQuantity ?? "0", hasBalance ? form.remainingQuantity : Infinity);
    if (leftoverError) errors.leftoverQuantity = leftoverError;
    if (form.inventoryId && hasBalance && Number(form.remainingQuantity) <= 0) errors.quantity = "No seedlings remain available for reporting on this release.";
  }
  if (!photos.length) errors.photos = "Add at least one planting evidence photo.";
  else if (photos.length > 10) errors.photos = "A maximum of 10 evidence photos is allowed.";
  else {
    const invalid = previews.find(row => !["verified", "needs_review"].includes(row.verificationStatus) || row.submissionBlocked);
    if (invalid) errors.photos = invalid.verificationMessage || "Verify every photo before submitting.";
    else if (!hasGps) errors.photos = "Use an original geotagged photo or a verified camera capture.";
    else if (municipalityScopeStatus === "checking") errors.photos = "Wait for the photo location check to finish.";
    else if (municipalityScopeStatus === "outside") errors.photos = "Photo location must be within the Municipality of Bulan.";
  }
  return errors;
}
