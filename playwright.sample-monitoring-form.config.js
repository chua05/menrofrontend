import base from "./playwright.phase3c.config.js";

export default { ...base, testMatch: "permanent-sample-form.spec.js", timeout: 45000, workers: 1,
  webServer: { ...base.webServer,
    command: "node node_modules/vite/bin/vite.js --config vite.sample-monitoring-form-test.config.js --host 127.0.0.1 --port 5184",
    reuseExistingServer: false, timeout: 60000,
  },
};
