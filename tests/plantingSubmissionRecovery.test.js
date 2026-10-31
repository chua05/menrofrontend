import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const plantingPage = readFileSync(new URL("../src/pages/PlantingPage.jsx", import.meta.url), "utf8");
test("planting submission has a bounded recovery path", () => {
  assert.match(plantingPage, /const PLANTING_SUBMISSION_TIMEOUT_MS = 60_000/);
  assert.match(plantingPage, /new AbortController\(\)/);
  assert.match(plantingPage, /The report submission timed out before MENRO could confirm it/);
  assert.match(plantingPage, /timeoutMs: PLANTING_SUBMISSION_TIMEOUT_MS/);
  assert.match(plantingPage, /void Promise\.all\(\[loadReports\(\), loadMyDistributions\(\), loadEvents\(\)\]\)\.catch/);
});

test("missing EXIF accuracy is not displayed as perfect accuracy", () => {
  assert.match(plantingPage, /function optionalFiniteNumber\(value\)/);
  assert.match(plantingPage, /const evidenceMapAccuracy = optionalFiniteNumber\(primaryLocationPreview\?\.accuracy\)/);
});

test("planting location metadata uses the 50 metre fallback consistently", () => {
  assert.match(plantingPage, /const SITE_GPS_TOLERANCE_METERS = 50/);
  assert.match(plantingPage, /"50m-fallback"/);
  assert.doesNotMatch(plantingPage, /"20m-fallback"/);
});
