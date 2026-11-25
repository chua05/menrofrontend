import test from "node:test";
import assert from "node:assert/strict";
import { installJsxHarness, expand, textOf } from "./helpers/jsxHarness.js";

// The drawer's read-only Monitoring Status finds a cohort that sits on a later readiness page.
const requests = [];
globalThis.__statusResponses = path => {
  requests.push(path);
  if (path === "/verified-planting-cohorts") return [{ id: "VPC-z", source: { plantingReportId: "report-1" }, samplingPlan: { status: "DRAFT" }, baselineStatus: "NOT_STARTED" }];
  if (path === "/verified-sample-monitoring/readiness") return { cohorts: [{ cohortId: "VPC-a", canCreateVisit: false, reasons: [] }], truncated: true, nextCursor: "VPC-a" };
  if (path === "/verified-sample-monitoring/readiness?cursor=VPC-a") return { cohorts: [{ cohortId: "VPC-z", canCreateVisit: false, reasons: [{ code: "VISIT_SCHEDULING_POLICY_PENDING" }] }], truncated: false, nextCursor: null };
  throw new Error(`Unexpected ${path}`);
};
const harness = installJsxHarness({ modules: {
  "react-icons/fi": "export const FiActivity = () => null;",
  "authenticatedApi": "export const authenticatedFetch = async path => ({ ok: true, json: async () => ({ success: true, data: globalThis.__statusResponses(path) }) });",
} });
const { default: MonitoringStatusSection } = await import("../src/components/MonitoringStatusSection.jsx");

test("Monitoring Status reads later readiness pages", async () => {
  const props = { report: { id: "report-1", reportingPolicy: { monitoring: "PERMANENT_SAMPLE" } }, cohortEnabled: true };
  harness.render(MonitoringStatusSection, props);
  await new Promise(resolve => setTimeout(resolve, 20));
  const text = textOf(expand(harness.render(MonitoringStatusSection, props)));
  assert.match(text, /Not ready for a monitoring visit\./);
  assert.match(text, /only after MENRO approves the visit scheduling policy/);
  assert.deepEqual(requests, ["/verified-planting-cohorts", "/verified-sample-monitoring/readiness", "/verified-sample-monitoring/readiness?cursor=VPC-a"]);
});
