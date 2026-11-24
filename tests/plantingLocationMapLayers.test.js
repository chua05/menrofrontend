import test from "node:test";
import assert from "node:assert/strict";
import { installJsxHarness } from "./helpers/jsxHarness.js";

// Behavioural tests for the real src/components/PlantingLocationMap.jsx with recorded Leaflet calls.
const harness = installJsxHarness();
const { default: PlantingLocationMap } = await import("../src/components/PlantingLocationMap.jsx");
const site = { siteName: "Bulan site", latitude: 12.662301, longitude: 123.932983, coverageRadiusMeters: 50 };

test("D-3: re-rendering with unchanged props keeps layers and the user's zoom/pan (no clear, no fitBounds)", () => {
  harness.reset();
  const props = { site, status: { type: "info", label: "Awaiting Photo" } };
  harness.render(PlantingLocationMap, props);
  const afterFirst = { fitBounds: harness.log.fitBounds, clearLayers: harness.log.clearLayers };
  assert.equal(afterFirst.fitBounds, 1, "the first layer pass fits the site once");
  // A parent re-render passes the same site but no trees/treeMarkers and a fresh status object.
  harness.render(PlantingLocationMap, { ...props, status: { type: "info", label: "Awaiting Photo" } });
  harness.render(PlantingLocationMap, { ...props, status: { type: "info", label: "Awaiting Photo" } });
  assert.equal(harness.log.fitBounds, afterFirst.fitBounds, "fitBounds must not run again");
  assert.equal(harness.log.clearLayers, afterFirst.clearLayers, "layers must not be cleared again");
});

test("D-4: species, Tree ID and site names render in tooltips as literal text, never as HTML", () => {
  harness.reset();
  const payload = "<img src=x onerror=alert(1)>";
  harness.render(PlantingLocationMap, {
    site: { ...site, siteName: payload, polygon: [{ lat: 12.66, lng: 123.93 }, { lat: 12.67, lng: 123.93 }, { lat: 12.67, lng: 123.94 }] },
    highlightSitePolygon: true,
    treeMarkers: [{ sampleId: `T-${payload}`, species: payload, latitude: 12.6623, longitude: 123.933, kind: "APPROVED" }],
    status: { type: "info", label: "Awaiting Photo" },
  });
  const tooltips = harness.log.tooltips;
  assert.ok(tooltips.length >= 4, "site radius, polygon, site point and tree tooltips are bound");
  for (const content of tooltips) {
    // Leaflet assigns string tooltip content with innerHTML; only DOM nodes are rendered as text.
    assert.notEqual(typeof content, "string", `tooltip content must be a DOM node, got ${JSON.stringify(content)}`);
  }
  const text = tooltips.map(content => content.textContent);
  assert.ok(text.some(value => value.includes(`T-${payload} · ${payload}`)), "tree tooltip keeps the literal species text");
  assert.ok(text.filter(value => value.startsWith(payload)).length >= 3, "every site tooltip keeps the literal site name");
  assert.equal(harness.log.created.includes("IMG"), false, "no element is created from the payload");
});

test("D-8: the tree popup labels the approved condition as the latest approved condition", () => {
  harness.reset();
  harness.render(PlantingLocationMap, {
    site, status: { type: "info", label: "Awaiting Photo" },
    treeMarkers: [{ sampleId: "TREE-A", species: "Narra", latitude: 12.6623, longitude: 123.933, kind: "APPROVED", latestApprovedCondition: "Healthy" }],
  });
  const popup = harness.log.popups[0];
  const list = popup.children.find(child => child.tagName === "DL");
  const labels = list.children.filter(child => child.tagName === "DT").map(child => child.textContent);
  assert.ok(labels.includes("Latest approved condition"), labels.join(", "));
  assert.equal(labels.includes("Condition"), false);
});
