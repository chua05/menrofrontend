import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boundaryLayerOptions, geometryCoversPoint, siteBoundaryDiagnostic } from "../src/utils/barangayMap.js";

const square = (name, x = 123, y = 12) => ({ type: "Feature", properties: { brgy_name: name },
  geometry: { type: "Polygon", coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]] } });
const collection = (...features) => ({ type: "FeatureCollection", features });

test("boundary pane stays below coverage and does not capture clicks", () => {
  let creates = 0;
  const pane = { style: {} };
  const map = { getPane: () => creates ? pane : null, createPane: () => { creates++; return pane; } };
  assert.deepEqual(boundaryLayerOptions(map), { pane: "menroBarangayBoundaries", interactive: false });
  boundaryLayerOptions(map);
  assert.equal(creates, 1);
  assert.equal(pane.style.zIndex, "350");
  assert.equal(pane.style.pointerEvents, "none");
});

test("diagnostics preserve coordinates and selected barangay; formatting aliases match", () => {
  const data = collection(square("N.Roque"));
  const before = JSON.stringify(data);
  assert.equal(siteBoundaryDiagnostic(data, "N. Roque", "12.5", "123.5"), null);
  assert.match(siteBoundaryDiagnostic(data, "SanRamon", 12.5, 123.5), /Selected barangay: SanRamon; displayed polygon: N.Roque/);
  assert.equal(JSON.stringify(data), before);
});

test("shared edges and overlapping polygons report ambiguity, never first-match ownership", () => {
  assert.match(siteBoundaryDiagnostic(collection(square("a"), square("b", 124)), "a", 12.5, 124), /multiple/);
  assert.match(siteBoundaryDiagnostic(collection(square("a"), square("b")), "a", 12.5, 123.5), /multiple/);
});

test("shared frontend containment covers edges and vertices consistently", () => {
  const feature = square("a");
  assert.equal(geometryCoversPoint(feature.geometry, [123.5, 12.5]), true);
  assert.equal(geometryCoversPoint(feature.geometry, [123, 12.5]), true);
  assert.equal(geometryCoversPoint(feature.geometry, [123, 12]), true);
  assert.equal(geometryCoversPoint(feature.geometry, [122.9, 12.5]), false);
});

test("holes, multipolygons, outside coordinates and missing inputs", () => {
  const f = square("a");
  f.geometry.coordinates.push([[123.2, 12.2], [123.8, 12.2], [123.8, 12.8], [123.2, 12.8], [123.2, 12.2]]);
  assert.match(siteBoundaryDiagnostic(collection(f), "a", 12.5, 123.5), /outside/);
  f.geometry = { type: "MultiPolygon", coordinates: [f.geometry.coordinates, square("a", 125).geometry.coordinates] };
  assert.equal(siteBoundaryDiagnostic(collection(f), "a", 12.5, 125.5), null);
  for (const value of [null, "", "bad", 200]) assert.equal(siteBoundaryDiagnostic(collection(f), "a", value, 123), null);
  assert.equal(siteBoundaryDiagnostic(null, "a", 12, 123), null);
});

test("every boundary-rendering module uses the same noninteractive pane", () => {
  for (const file of ["pages/SitesPage.jsx", "pages/DashboardPage.jsx", "pages/PlantingPage.jsx",
    "pages/ParticipantSaplingRequestWizard.jsx", "pages/MapVisualizationPage.jsx", "pages/MyRequestsPage.jsx",
    "pages/SeedlingRequestsPage.jsx", "components/analytics/AnalyticsSitesMap.jsx"]) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    assert.match(source, /\.\.\.boundaryLayerOptions\((map|instance)\)/, file);
    assert.match(source, /sites\/barangay-boundaries/, file);
  }
});

test("participant request validation uses the shared boundary containment implementation", () => {
  const source = readFileSync(new URL("../src/pages/ParticipantSaplingRequestWizard.jsx", import.meta.url), "utf8");
  assert.match(source, /geometryCoversPoint/);
  assert.doesNotMatch(source, /const pointInRing/);
});
