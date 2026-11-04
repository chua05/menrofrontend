import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(new URL("../src/pages/DashboardPage.jsx", import.meta.url), "utf8");

test("dashboard bounds both token acquisition and API requests", () => {
  assert.match(dashboard, /DASHBOARD_TOKEN_TIMEOUT_MS\s*=\s*10_000/);
  assert.match(dashboard, /firebaseUser\.getIdToken\(\)\.then\(resolve, reject\)/);
  assert.match(dashboard, /window\.clearTimeout\(timeoutId\)/);
  assert.match(dashboard, /if \(!hasLoadedData\.current\) setFatalLoadError\(DASHBOARD_UNAVAILABLE_MESSAGE\)/);
  assert.match(dashboard, /setLoading\(false\)/);
});
