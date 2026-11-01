import test from "node:test";
import assert from "node:assert/strict";
import { planDistribution, provisionalSampleTarget, resolveVerifiedPlantingCohortEnabled } from "../src/utils/verifiedPlantingCohort.js";

test("Phase 2 provisional sampling target is ceil ten percent with a minimum of one", () => {
  assert.equal(provisionalSampleTarget(0), 0);
  assert.equal(provisionalSampleTarget(1), 1);
  assert.equal(provisionalSampleTarget(20), 2);
  assert.equal(provisionalSampleTarget(35), 4);
});

test("Phase 2 frontend gate is disabled unless explicitly true", () => {
  assert.equal(resolveVerifiedPlantingCohortEnabled({}), false);
  assert.equal(resolveVerifiedPlantingCohortEnabled({ VITE_VERIFIED_PLANTING_COHORT_ENABLED: "false" }), false);
  assert.equal(resolveVerifiedPlantingCohortEnabled({ VITE_VERIFIED_PLANTING_COHORT_ENABLED: "true" }), true);
});

test("sample distribution groups planned sample IDs by species and site", () => {
  assert.deepEqual(planDistribution([
    { permanentId: "TREE-001", species: "Narra", siteReference: "Plot A" },
    { permanentId: "TREE-002", species: "Narra", siteReference: "Plot A" },
    { permanentId: "TREE-003", species: "Mahogany", siteReference: "Plot B" },
  ]), [
    { species: "Narra", siteReference: "Plot A", sampleIds: ["TREE-001", "TREE-002"] },
    { species: "Mahogany", siteReference: "Plot B", sampleIds: ["TREE-003"] },
  ]);
});
