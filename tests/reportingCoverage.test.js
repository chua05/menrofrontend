import test from "node:test";
import assert from "node:assert/strict";
import { reportingCoverage } from "../src/utils/reportingCoverage.js";
test("reporting coverage excludes exemptions and optional reporting, and missing documentation remains unknown", () => {
  const requests = ["REQUIRED", "NOT_REQUIRED", "OPTIONAL"].map((reporting, index) => ({ id: String(index), status: "Released", reportingPolicy: { reporting, reportingStatus: reporting }, releasedItems: [{ releasedQuantity: 100 }] }));
  const summary = reportingCoverage(requests);
  assert.equal(summary.required, 1); assert.equal(summary.noReportRequired, 1); assert.equal(summary.optional, 1); assert.equal(summary.coverage, 0);
  assert.equal(summary.rows[0].confirmedPlanted, null); assert.equal(summary.rows[0].reportedPlanted, null);
});
test("partial confirmations distinguish future balance, pending planting and approved final leftovers", () => {
  const request = [{ id: "release", status: "Released", reportingPolicy: { reporting: "REQUIRED" }, releasedItems: [{ releasedQuantity: 100 }] }];
  const partial = reportingCoverage(request, [{ reportType: "parent", requestId: "release", reportingProgress: "Partial", activeSubmittedQuantity: 60, acceptedQuantity: 60, acceptedLeftoverQuantity: 0, remainingAvailableQuantity: 40 }]);
  assert.equal(partial.rows[0].finalLeftovers, 0); assert.equal(partial.rows[0].remainingForFuturePlanting, 40); assert.equal(partial.coverage, 0);
  const final = reportingCoverage(request, [{ reportType: "parent", requestId: "release", reportingProgress: "Completed", activeSubmittedQuantity: 90, acceptedQuantity: 90, acceptedLeftoverQuantity: 10, remainingAvailableQuantity: 0 }]);
  assert.equal(final.rows[0].confirmedPlanted, 90); assert.equal(final.rows[0].finalLeftovers, 10); assert.equal(final.coverage, 1);
});
