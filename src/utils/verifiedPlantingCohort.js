export const PROVISIONAL_SAMPLING_POLICY = "test-only-ceil-10-percent-min-1-v1";

export function resolveVerifiedPlantingCohortEnabled(env = import.meta.env) {
  return String(env?.VITE_VERIFIED_PLANTING_COHORT_ENABLED || "").trim().toLowerCase() === "true";
}

export function provisionalSampleTarget(quantity) {
  const value = Number(quantity);
  return Number.isInteger(value) && value > 0 ? Math.max(1, Math.ceil(value * 0.1)) : 0;
}

export function planDistribution(samples = []) {
  const groups = new Map();
  samples.forEach((sample) => {
    const species = String(sample.species || "").trim();
    const siteReference = String(sample.siteReference || "").trim();
    const key = `${species}\u0000${siteReference}`;
    if (!groups.has(key)) groups.set(key, { species, siteReference, sampleIds: [] });
    groups.get(key).sampleIds.push(String(sample.permanentId || "").trim());
  });
  return [...groups.values()];
}

export function visibleCohortMessage(enabled) {
  return enabled ? "" : "Verified planting cohort sampling is not available in this environment.";
}
