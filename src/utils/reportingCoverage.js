// Uses the existing server-owned release and parent-report balances. Missing
// verification remains unknown; it is never relabeled as zero planted.
export function reportingCoverage(requests = [], reports = [], distributions = []) {
  const releases = new Map(distributions.map(row => [row.requestId || row.id, row]));
  const parents = new Map(reports.filter(row => row.reportType === "parent").map(row => [row.requestId || row.distributionId, row]));
  const rows = requests.filter(request => request.reportingPolicy && ["Released", "Saplings Released"].includes(request.status)).map(request => {
    const release = releases.get(request.id), report = parents.get(request.id);
    const items = release?.items || request.releasedItems;
    const released = Array.isArray(items) ? items.reduce((sum, item) => sum + Number(item.releasedQuantity ?? item.quantity ?? 0), 0) : null;
    const accepted = report && (report.reportingProgress === "Completed" || Number(report.acceptedQuantity) > 0) ? Number(report.acceptedQuantity) : null;
    return { requestId: request.id, requirement: request.reportingPolicy.reporting, status: report?.reportingProgress === "Completed" ? "Planting Confirmation Verified" : Number(report?.pendingReviewQuantity || 0) + Number(report?.pendingReviewLeftoverQuantity || 0) > 0 ? "Planting Confirmation Awaiting Review" : request.reportingPolicy.reportingStatus,
      released, reportedPlanted: report ? Number(report.activeSubmittedQuantity ?? report.quantityPlanted ?? 0) : null,
      confirmedPlanted: accepted, finalLeftovers: report ? Number(report.acceptedLeftoverQuantity || 0) : null,
      remainingForFuturePlanting: report?.remainingAvailableQuantity ?? released,
      completed: report?.reportingProgress === "Completed" };
  });
  const required = rows.filter(row => row.requirement === "REQUIRED");
  return { rows, required: required.length, completedRequired: required.filter(row => row.completed).length,
    coverage: required.length ? required.filter(row => row.completed).length / required.length : null,
    noReportRequired: rows.filter(row => row.requirement === "NOT_REQUIRED").length,
    optional: rows.filter(row => row.requirement === "OPTIONAL").length,
    pendingPolicy: rows.filter(row => !["REQUIRED", "NOT_REQUIRED", "OPTIONAL"].includes(row.requirement)).length };
}
