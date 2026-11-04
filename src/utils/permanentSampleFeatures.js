import { resolveVerifiedPlantingCohortEnabled } from "./verifiedPlantingCohort.js";

export const informationEnabled = (env = import.meta.env) => resolveVerifiedPlantingCohortEnabled(env)
  && env?.VITE_MONITORING_INFORMATION_ENABLED === "true";
export const sampleAnalyticsEnabled = (env = import.meta.env) => resolveVerifiedPlantingCohortEnabled(env)
  && env?.VITE_PERMANENT_SAMPLE_ANALYTICS_ENABLED === "true";
