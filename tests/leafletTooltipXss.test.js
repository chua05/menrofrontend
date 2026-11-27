import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installJsxHarness } from "./helpers/jsxHarness.js";

// Stored-XSS regression for Leaflet site tooltips: Leaflet assigns string tooltip content with
// innerHTML, so user-controlled site names and report labels must reach bindTooltip as DOM nodes.
const harness = installJsxHarness();
const { textTooltip } = await import("../src/utils/leafletTooltip.js");
const payload = "<img src=x onerror=alert(1)>";

test("XSS: textTooltip renders a hostile site name as literal text and creates no element from it", () => {
  harness.reset();
  const node = textTooltip(`${payload} • Site GPS`);
  assert.notEqual(typeof node, "string");
  assert.equal(node.tagName, "SPAN");
  assert.equal(node.textContent, `${payload} • Site GPS`);
  assert.deepEqual(harness.log.created, ["SPAN"], "only the wrapper span is created; no IMG from the payload");
});

// Every authorized call site; `expressions` are the untrusted values that must be wrapped.
const callSites = [
  // Registered-site markers for the full map, the Analytics map and site views.
  ["src/components/map/siteOverlayLayer.js", ["label || site?.siteName"]],
  ["src/pages/PlantingPage.jsx", ["coverageRadiusMeters} m coverage", "getSiteName(selectedSite) || \"Registered Planting Site\")", "Site GPS"]],
  ["src/pages/SeedlingRequestsPage.jsx", ["getPlantingSiteDisplayName(site)"]],
  ["src/pages/MyRequestsPage.jsx", ["getPlantingSite(request)"]],
];
// Constant labels and static barangay GeoJSON names are not user data and stay strings.
const allowedRaw = [/^"[^"]*"/, /^String\(barangayName\)/, /^String\(name\)/, /^String\(featureBarangay\)/, /^name,/];

for (const [file, expressions] of callSites) {
  test(`XSS: ${file} passes untrusted tooltip text to Leaflet as a text node`, () => {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
    assert.match(source, /import \{ textTooltip \} from "(\.\.\/)+utils\/leafletTooltip";/);
    const args = [...source.matchAll(/\.bindTooltip\(\s*/g)].map(match => source.slice(match.index + match[0].length, match.index + match[0].length + 160));
    const wrapped = args.filter(arg => arg.startsWith("textTooltip("));
    assert.ok(wrapped.length >= expressions.length, `${file}: expected ${expressions.length} wrapped tooltips, found ${wrapped.length}`);
    for (const expression of expressions) {
      assert.ok(wrapped.some(arg => arg.includes(expression)), `${file}: ${expression} must be wrapped in textTooltip()`);
    }
    for (const arg of args.filter(value => !value.startsWith("textTooltip("))) {
      assert.ok(allowedRaw.some(pattern => pattern.test(arg)), `${file}: unexpected raw tooltip content ${JSON.stringify(arg.slice(0, 60))}`);
    }
  });
}
