import test from "node:test";
import assert from "node:assert/strict";
import { buildEvidenceLocationView } from "../src/utils/evidenceLocationView.js";
import { readFileSync } from "node:fs";

const planting = readFileSync(new URL("../src/pages/PlantingPage.jsx", import.meta.url), "utf8");

test("valid and outside-site evidence retain the detected marker", () => {
  const valid = buildEvidenceLocationView({ gpsStatus: "valid", latitude: 12.67, longitude: 123.87 });
  assert.deepEqual(valid, { code: "valid", label: "Valid", marker: { latitude: 12.67, longitude: 123.87 } });
  const outside = buildEvidenceLocationView({ gpsStatus: "valid", latitude: 12.68, longitude: 123.88,
    outsideSite: true });
  assert.equal(outside.code, "outside_site");
  assert.deepEqual(outside.marker, { latitude: 12.68, longitude: 123.88 });
});

test("browser accuracy is separate from site distance and rejects only above 50 metres", () => {
  for (const accuracy of [49, 50]) {
    assert.equal(buildEvidenceLocationView({ gpsStatus: "valid", latitude: 12.67, longitude: 123.87,
      accuracy, evidenceSource: "browser-camera" }).code, "valid");
  }
  const inaccurate = buildEvidenceLocationView({ gpsStatus: "valid", latitude: 12.67, longitude: 123.87,
    accuracy: 51, evidenceSource: "browser-camera", outsideSite: false });
  assert.equal(inaccurate.code, "low_accuracy");
  assert.ok(inaccurate.marker);
  const outside = buildEvidenceLocationView({ gpsStatus: "valid", latitude: 12.67, longitude: 123.87,
    accuracy: 10, evidenceSource: "browser-camera", outsideSite: true });
  assert.equal(outside.code, "outside_site");
});

test("missing, unreadable, and invalid GPS never invent a marker", () => {
  assert.deepEqual(buildEvidenceLocationView({ gpsStatus: "missing" }).marker, null);
  assert.deepEqual(buildEvidenceLocationView({ gpsStatus: "unparseable", latitude: 12, longitude: 123 }).marker, null);
  assert.deepEqual(buildEvidenceLocationView({ gpsStatus: "invalid", latitude: 91, longitude: 123 }).marker, null);
});

test("planting map selects the requested evidence and fits evidence with site geometry", () => {
  assert.match(planting, /selectedLocationPreviewId/);
  assert.match(planting, /Detected Evidence Location/);
  assert.match(planting, /fitPoints\.push\(\[latitude, longitude\]\)/);
  assert.match(planting, /map\.fitBounds\(bounds\.pad\(0\.4\)/);
  assert.match(planting, /cameraLocationDiagnostic \|\| photoPreviews\[0\]/);
});
