import base from "./vite.workflow-test.config.js";

// Explicit test config only; normal development/production config is untouched.
export default { ...base, define: { ...base.define,
  "import.meta.env.VITE_MONITORING_INFORMATION_ENABLED": JSON.stringify("true"),
} };
