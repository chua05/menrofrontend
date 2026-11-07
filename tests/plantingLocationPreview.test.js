import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildLocationPreviewStatus, calculateDistanceMeters, compareEvidenceToSite, isPointInBulanBoundary, isPointInPolygon } from "../src/utils/plantingLocationPreview.js";

const site = { latitude: 12.6598, longitude: 123.918, coverageRadiusMeters: 50 };
const square = [{ lat: 0, lng: 0 }, { lat: 0, lng: 2 }, { lat: 2, lng: 2 }, { lat: 2, lng: 0 }];
const boundary = { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon",
  coordinates: [[[123.8, 12.5], [124, 12.5], [124, 12.8], [123.8, 12.8], [123.8, 12.5]]] } }] };
const base = { hasSite: true, hasGps: true, municipalityStatus: "inside", radiusMeters: 50, distanceMeters: 10, insidePolygon: null };
const source = file => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("site geometry helpers match registered coverage and Bulan scope", () => {
  assert.ok(calculateDistanceMeters(12.6598, 123.918, 12.6598, 123.918) < 0.001);
  assert.equal(isPointInPolygon(1, 1, square), true);
  assert.equal(isPointInBulanBoundary(12.65, 123.9, boundary), true);
  assert.equal(isPointInBulanBoundary(14.6, 121, boundary), false);
});

test("evidence comparison prefers coverage radius and falls back to the legacy polygon", () => {
  const inRadius = compareEvidenceToSite(site, { latitude: 12.6598, longitude: 123.918 });
  assert.equal(inRadius.radiusMeters, 50);
  assert.equal(inRadius.insidePolygon, null);
  assert.ok(inRadius.distanceMeters < 1);
  const legacy = compareEvidenceToSite({ latitude: 1, longitude: 1, polygon: square }, { latitude: 1, longitude: 1 });
  assert.equal(legacy.radiusMeters, null);
  assert.equal(legacy.insidePolygon, true);
  assert.deepEqual(compareEvidenceToSite(null, null), { distanceMeters: null, radiusMeters: null, insidePolygon: null });
});

test("status covers each staff and participant location outcome", () => {
  assert.deepEqual(buildLocationPreviewStatus({ hasSite: false }), { type: "waiting", label: "Select a registered planting site first." });
  assert.equal(buildLocationPreviewStatus({ hasSite: true, hasGps: false, waitingLabel: "Upload or take a photo first." }).label, "Upload or take a photo first.");
  assert.equal(buildLocationPreviewStatus({ ...base, gpsStatus: "low_accuracy", accuracy: 80 }).type, "flagged");
  assert.equal(buildLocationPreviewStatus({ ...base, municipalityStatus: "checking" }).type, "waiting");
  assert.equal(buildLocationPreviewStatus({ ...base, municipalityStatus: "outside" }).label, "Outside Municipality of Bulan");
  assert.equal(buildLocationPreviewStatus(base).label, "Within registered site coverage (10.0 m from center; 50 m radius).");
  assert.equal(buildLocationPreviewStatus({ ...base, distanceMeters: 75 }).type, "warning");
  assert.equal(buildLocationPreviewStatus({ ...base, radiusMeters: null, insidePolygon: true }).type, "valid");
  assert.equal(buildLocationPreviewStatus({ ...base, radiusMeters: null, distanceMeters: 40 }).label, "Within registered site tolerance (40.0 m away).");
  assert.equal(buildLocationPreviewStatus({ ...base, radiusMeters: null, distanceMeters: null }).type, "warning");
});

test("an unavailable boundary does not hold the status on checking", () => {
  assert.equal(buildLocationPreviewStatus({ ...base, municipalityStatus: "unavailable" }).type, "valid");
});

test("staff and participant forms share the location rules and requirements dialog", () => {
  const participant = source("pages/PlantingPage.jsx"), staff = source("components/OfficialPlantingPhotos.jsx");
  assert.match(participant, /buildLocationPreviewStatus\(/);
  assert.match(participant, /<PhotoRequirementsDialog/);
  assert.match(staff, /<PlantingLocationMap/);
  assert.match(staff, /buildLocationPreviewStatus\(/);
  assert.match(staff, /<PhotoRequirementsDialog/);
});

test("the staff map has the participant basemap and labelled barangays", () => {
  const map = source("components/PlantingLocationMap.jsx");
  assert.match(map, /L\.tileLayer\("https:\/\/\{s\}\.tile\.openstreetmap\.org/);
  assert.match(map, /pr-map-barangay-label/);
  assert.match(map, /boundaryLayerOptions\(map\)/);
});
