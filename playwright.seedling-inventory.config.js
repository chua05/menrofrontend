import base from "./playwright.ui-layout.config.js";
export default { ...base, testMatch: "seedling-distribution-tracking.spec.js", workers: 1, timeout: 60000 };
