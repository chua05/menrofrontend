export function validatePlantingReportForm(form, { distributions = [], photos = [], previews = [], hasGps, municipalityScopeStatus } = {}) {
  const errors = {};
  if (!form.submittedByName?.trim()) errors.submittedByName = "Enter your full name.";
  if (!form.submittedBySector) errors.submittedBySector = "Select your sector.";
  if (!/^(?:\+63|0)9\d{9}$/.test(String(form.submittedByContactNumber || "").replace(/[\s-]/g, ""))) errors.submittedByContactNumber = "Enter a valid Philippine mobile number.";
  if (!form.barangay) errors.barangay = "Select a barangay with a planting site.";
  if (!form.siteId || !form.siteName) errors.siteId = "Select a registered planting site.";
  if (!form.eventId) errors.eventId = "Select a planting event.";
  if (!distributions.some(row => String(row.id) === String(form.distributionId) && row.status === "Released")) errors.distributionId = "Select a valid released seedling distribution.";
  if (!form.inventoryId) errors.distributionItemKey = "Select the released seedling species.";
  if (!form.plantingDate) errors.plantingDate = "The planting event needs a valid date.";
  const quantity = Number(form.quantity);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) errors.quantity = "Enter a whole number greater than zero.";
  else if (Number.isFinite(Number(form.remainingQuantity)) && quantity > Number(form.remainingQuantity)) errors.quantity = `Only ${Number(form.remainingQuantity)} seedlings are available for reporting.`;
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
