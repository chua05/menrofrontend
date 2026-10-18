import assert from "node:assert/strict";
import test from "node:test";
import {
  CONDITION_SUM_ERROR,
  EMPTY_MONITORING_EVIDENCE,
  clearSharedCountError,
  monthlySurvivalRates,
  monitoringPreview,
  isOfficialMonitoringObservation,
  officialMonitoringHistoryEntries,
  monitoringScheduleLabel,
  weightedOfficialSurvivalRate,
} from "../src/utils/monitoringForm.js";

test("Phase 2 official eligibility requires Admin approval", () => {
  assert.equal(isOfficialMonitoringObservation({ workflowVersion: 2, reviewStatus: "Reviewed" }), false);
  assert.equal(isOfficialMonitoringObservation({ workflowVersion: 2, reviewStatus: "Approved",
    adminDecision: "Approve", adminDecidedBy: "admin-1", adminDecidedAt: "2026-10-14" }), true);
  assert.equal(isOfficialMonitoringObservation({ reviewStatus: "Reviewed" }), true);
});

test("weighted overall survival uses all official cohorts and excludes early observations", () => {
  const approved = (id, barangay, total, surviving) => ({ id, barangay, quantityPlanted: total, history: [{
    workflowVersion: 2, observationType: "official", reviewStatus: "Approved", adminDecision: "Approve",
    adminDecidedBy: "admin", adminDecidedAt: {}, monitoredDate: "2026-10-01",
    totalMonitored: total, healthyCount: surviving, damagedCount: 0, deadCount: total - surviving,
    isFullCohortAssessment: true,
  }] });
  const records = [approved("large", "A", 100, 90), approved("small", "B", 10, 1)];
  for (let index = 0; index < 7; index += 1) records.push(approved(`extra-${index}`, `X${index}`, 1, 1));
  records.push({ id: "early", quantityPlanted: 1000, history: [{ workflowVersion: 2,
    observationType: "early", reviewStatus: "Approved", adminDecision: "Approve", adminDecidedBy: "admin",
    adminDecidedAt: {}, monitoredDate: "2026-10-02", totalMonitored: 1000, healthyCount: 0,
    damagedCount: 0, deadCount: 1000, isFullCohortAssessment: true }] });
  assert.equal(weightedOfficialSurvivalRate(records), 84);
});

test("partial monitoring preview reports coverage, unassessed, survival, and mortality", () => {
  const preview = monitoringPreview({
    totalChecked: "25", healthy: "20", damaged: "3", dead: "2",
  }, 100);
  assert.deepEqual(preview, {
    validTotal: true, validCounts: true, verifiedQuantity: 100, totalChecked: 25,
    unassessed: 75, coverageRate: 25, survivalRate: 92, mortalityRate: 8,
    assessmentType: "Partial Observation",
  });
});

test("full cohort preview and invalid counts are classified safely", () => {
  assert.equal(monitoringPreview({
    totalChecked: "100", healthy: "90", damaged: "5", dead: "5",
  }, 100).assessmentType, "Full Cohort");
  const invalid = monitoringPreview({
    totalChecked: "25", healthy: "20", damaged: "3", dead: "1",
  }, 100);
  assert.equal(invalid.validCounts, false);
  assert.equal(invalid.survivalRate, null);
  assert.equal(invalid.mortalityRate, null);
});

test("editing any count clears only the shared condition-sum error", () => {
  assert.deepEqual(clearSharedCountError({ totalChecked: CONDITION_SUM_ERROR }, "healthy"), {});
  assert.deepEqual(clearSharedCountError({ totalChecked: "Must not exceed 100." }, "healthy"),
    { totalChecked: "Must not exceed 100." });
});

test("planting report evidence reset fields are empty", () => {
  assert.deepEqual({ ...EMPTY_MONITORING_EVIDENCE }, {
    latitude: "", longitude: "", accuracy: "", locationCapturedAt: "",
  });
});

test("monthly fallback uses monitoredDate, deduplicates a lifecycle, and weights cohorts", () => {
  const rates = monthlySurvivalRates([
    { lifecycleId: "a", monitoredDate: "2026-08-01", monitoredAt: "2026-10-01T00:00:00Z",
      healthyCount: 50, damagedCount: 10, deadCount: 40, totalMonitored: 100 },
    { lifecycleId: "a", monitoredDate: "2026-08-20", monitoredAt: "2026-08-21T00:00:00Z",
      healthyCount: 70, damagedCount: 10, deadCount: 20, totalMonitored: 100 },
    { lifecycleId: "b", monitoredDate: "2026-08-15", healthyCount: 40, damagedCount: 0,
      deadCount: 10, totalMonitored: 50 },
  ]);
  assert.equal(rates.get("2026-08"), 80);
  assert.equal(rates.has("2026-09"), false);
});

test("Dashboard pipeline selects a newer approved partial before applying full-cohort eligibility", () => {
  const entries = officialMonitoringHistoryEntries([{
    id: "lifecycle-a", quantityPlanted: 100,
    history: [
      { workflowVersion: 2, reviewStatus: "Approved", adminDecision: "Approve",
        adminDecidedBy: "admin", adminDecidedAt: "2026-08-06", monitoredDate: "2026-08-05",
        monitoredAt: "2026-08-06T00:00:00Z", totalMonitored: 100,
        healthyCount: 80, damagedCount: 10, deadCount: 10 },
      { workflowVersion: 2, reviewStatus: "Approved", adminDecision: "Approve",
        adminDecidedBy: "admin", adminDecidedAt: "2026-08-21", monitoredDate: "2026-08-20",
        monitoredAt: "2026-08-21T00:00:00Z", totalMonitored: 25,
        healthyCount: 20, damagedCount: 3, deadCount: 2 },
    ],
  }]);
  const rates = monthlySurvivalRates(entries);
  assert.equal(entries.length, 2, "the Dashboard must not discard the partial observation early");
  assert.equal(rates.has("2026-08"), false);
});

test("monitoring schedule wording reflects workflow and completion instead of history length", () => {
  const withStatus = (reviewStatus, extra = {}) => ({ history: [{ reviewStatus, ...extra }], ...extra });
  assert.equal(monitoringScheduleLabel({ history: [] }), "Available after first monitoring submission");
  assert.equal(monitoringScheduleLabel(withStatus("Pending Review")), "Pending MENRO Staff review");
  assert.equal(monitoringScheduleLabel(withStatus("Reviewed")), "Awaiting Admin decision");
  assert.equal(monitoringScheduleLabel(withStatus("Returned for Rechecking")), "Returned for rechecking");
  assert.equal(monitoringScheduleLabel(withStatus("Rejected")), "Available for a new observation");
  assert.equal(monitoringScheduleLabel(withStatus("Approved", {
    workflowVersion: 2, adminDecision: "Approve", adminDecidedBy: "admin",
    adminDecidedAt: "2026-08-21", isFullCohortAssessment: false,
  })), "No official next date — partial observation");
  assert.equal(monitoringScheduleLabel({ status: "Monitoring Completed", history: [{}] }),
    "No further monitoring required");
  assert.equal(monitoringScheduleLabel({ nextMonitoringDate: "2026-11-01", history: [] }), "");
});
