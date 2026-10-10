import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/pages/SeedlingRequestsPage.jsx", import.meta.url),
  "utf8",
);

test("request mutations use a non-blocking awaited refresh before success feedback", () => {
  assert.match(source, /loadRequests = useCallback\(async \(\{ background = false \} = \{\}\)/);
  assert.match(source, /const refreshed = await loadRequests\(\{ background: true \}\);/);
  assert.match(source, /setDecisionModal\(null\);[\s\S]*await loadRequests\(\{ background: true \}\);[\s\S]*await waitForUiPaint\(\);[\s\S]*showSuccess/);
  assert.doesNotMatch(source, /if \(action === "approve"\) void loadRequests\(\)/);
});

test("staff release refreshes before closing its modal and publishing feedback", () => {
  const releaseStart = source.indexOf("const releaseRequest = async");
  const releaseEnd = source.indexOf("const openReleaseModal", releaseStart);
  const releaseSource = source.slice(releaseStart, releaseEnd);

  assert.match(releaseSource, /refreshSelectedRequest\(updated\);[\s\S]*await loadRequests\(\{ background: true \}\);/);
  assert.match(releaseSource, /setReleaseModal\(null\);[\s\S]*await waitForUiPaint\(\);[\s\S]*showSuccess/);
});

test("confirmed mutations retain truthful feedback when a background refresh fails", () => {
  assert.match(source, /showWarning\([\s\S]*successfully, but the latest request list could not be refreshed/);
});
