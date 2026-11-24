import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/components/PlantingLocationMap.jsx", import.meta.url), "utf8");

test("permanent sample trees use accessible divIcon markers with approved, draft and selected states", () => {
  assert.match(source, /L\.divIcon/);
  assert.match(source, /psm-tree-marker-draft|psm-tree-marker-\$\{/);
  assert.match(source, /is-selected/);
  assert.match(source, /title: markerLabel, alt: markerLabel/);
  assert.match(source, /Open \$\{tree\.sampleId \|\| "permanent sample"\} assessment/);
  assert.doesNotMatch(source, /L\.circleMarker\(\[treeLatitude, treeLongitude\]/);
});

test("tree popups use DOM APIs and an assessment callback, never string onclick handlers", () => {
  assert.match(source, /document\.createElement\("button"\)/);
  assert.match(source, /onSelectTree\(tree\.sampleId\)/);
  assert.doesNotMatch(source, /onclick\s*=/i);
  for (const label of ["Draft — not official", "Latest approved condition", "Visit", "Assessment date", "Stem diameter", "GPS verification", "Open assessment"]) {
    assert.ok(source.includes(label), label);
  }
});

test("site polygons can be highlighted without removing an authoritative radius", () => {
  assert.match(source, /highlightSitePolygon/);
  assert.match(source, /L\.polygon/);
});
