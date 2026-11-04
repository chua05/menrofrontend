import test from "node:test";
import assert from "node:assert/strict";
import { informationEnabled, sampleAnalyticsEnabled } from "../src/utils/permanentSampleFeatures.js";
import { getNotificationPath } from "../src/utils/notificationRoutes.js";

test("new monitoring features default off and require the existing cohort gate", () => {
  for (const gate of [informationEnabled, sampleAnalyticsEnabled]) {
    assert.equal(gate({}), false);
    assert.equal(gate({ VITE_MONITORING_INFORMATION_ENABLED: "true", VITE_PERMANENT_SAMPLE_ANALYTICS_ENABLED: "true" }), false);
    assert.equal(gate({ VITE_VERIFIED_PLANTING_COHORT_ENABLED: "true" }), false);
  }
});
test("information and analytics gates are independent and explicitly enabled", () => {
  const cohort = { VITE_VERIFIED_PLANTING_COHORT_ENABLED: "true" };
  const info = { ...cohort, VITE_MONITORING_INFORMATION_ENABLED: "true" };
  assert.equal(informationEnabled(info), true); assert.equal(sampleAnalyticsEnabled(info), false);
  const analytics = { ...cohort, VITE_PERMANENT_SAMPLE_ANALYTICS_ENABLED: "true" };
  assert.equal(sampleAnalyticsEnabled(analytics), true); assert.equal(informationEnabled(analytics), false);
});
test("information notifications point only to role-protected records with encoded identifiers", () => {
  const notification = { relatedRecordType: "sampleMonitoringInformation", relatedRecordId: "request/with?characters" };
  for (const role of ["staff", "admin", "participant"]) {
    assert.equal(getNotificationPath(notification, role), `/${role}/monitoring-information?request=request%2Fwith%3Fcharacters`);
  }
  assert.equal(getNotificationPath(notification, "unknown"), null);
});
