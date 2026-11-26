// Full Planting Sites Map: permanent-sample tree markers, their filters and their data source.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { filterMapTrees, siteHasMatchingTree } from "../src/utils/mapTrees.js";

const page = fs.readFileSync(new URL("../src/pages/MapVisualizationPage.jsx", import.meta.url), "utf8");
const analyticsMap = fs.readFileSync(new URL("../src/components/analytics/AnalyticsSitesMap.jsx", import.meta.url), "utf8");
const layer = fs.readFileSync(new URL("../src/components/map/treeMarkerLayer.js", import.meta.url), "utf8");

const tree = (treeId, extra) => ({ treeId, species: "Kalamansi", siteId: "z8", siteName: "Zone 8 Green Site - Testing Site 02", barangay: "Zone VIII Poblacion",
  latitude: 12.6662, longitude: 123.8806, condition: "Healthy", reviewStatus: "Approved", ...extra });
const trees = [tree("T001"), tree("T002", { condition: "Damaged" }), tree("T003", { condition: "Dead", species: "Narra" }),
  tree("B001", { siteId: "bc", siteName: "Bical Site", barangay: "Bical", condition: "Needs Rechecking", species: "Pili" })];
const ids = (rows) => rows.map((row) => row.treeId);

test("all four filters apply to each tree's own barangay, site, species and latest condition", () => {
  assert.deepEqual(ids(filterMapTrees(trees, {})), ["T001", "T002", "T003", "B001"], "cleared filters show every tree");
  assert.deepEqual(ids(filterMapTrees(trees, { barangay: "ZoneVIIIPoblacion" })), ["T001", "T002", "T003"], "barangay spelling variants match");
  assert.deepEqual(ids(filterMapTrees(trees, { site: "bc" })), ["B001"]);
  assert.deepEqual(ids(filterMapTrees(trees, { species: "narra" })), ["T003"]);
  assert.deepEqual(ids(filterMapTrees(trees, { condition: "Damaged" })), ["T002"]);
  assert.deepEqual(ids(filterMapTrees(trees, { condition: "Needs Rechecking", barangay: "All", site: "All", species: "All" })), ["B001"]);
  assert.deepEqual(ids(filterMapTrees(trees, { condition: "Not Yet Monitored" })), [], "a monitored tree is never 'not yet monitored'");
});

test("a site stays visible for a species or condition carried only by its trees", () => {
  const site = { siteId: "z8", siteName: "Zone 8 Green Site - Testing Site 02", species: [], condition: "Not Yet Monitored" };
  assert.equal(siteHasMatchingTree(site, trees, { species: "Narra" }), true);
  assert.equal(siteHasMatchingTree(site, trees, { condition: "Dead" }), true);
  assert.equal(siteHasMatchingTree(site, trees, { species: "Pili" }), false);
});

test("the full map loads tree markers from the authorized endpoint on every refresh and keeps sites when it fails", () => {
  assert.match(page, /\/analytics\/map-trees/);
  assert.match(page, /const refreshData = async/);
  const refresh = page.slice(page.indexOf("const refreshData = async"), page.indexOf("useEffect(", page.indexOf("const refreshData = async")));
  assert.match(refresh, /map-trees/, "Refresh Map, the 60 s interval and window focus all reload trees");
  assert.match(page, /Unable to load monitored tree markers/);
  assert.match(page, /renderTreeMarkers\(/);
  assert.match(page, /Approved permanent-sample trees/);
  assert.match(page, /Pending Review/);
});

test("both maps draw trees with the one shared tree-marker layer", () => {
  for (const source of [page, analyticsMap]) assert.match(source, /from "\.\.\/(\.\.\/)?components\/map\/treeMarkerLayer"|from "\.\.\/map\/treeMarkerLayer"/);
  assert.doesNotMatch(analyticsMap, /function groupForZoom/, "no second copy of the grouping");
  assert.match(layer, /export function renderTreeMarkers/);
  assert.match(layer, /textContent/); assert.doesNotMatch(layer, /innerHTML/);
  assert.match(layer, /isPending\(tree\) \? "pending"/, "pending trees get the ra-tree-pending style");
});
