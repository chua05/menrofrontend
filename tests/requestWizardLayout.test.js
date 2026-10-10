import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/pages/ParticipantSaplingRequestWizard.jsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../src/styles/seedling-requests.css", import.meta.url),
  "utf8",
);

test("request wizard uses shared section layout hooks for conditional content", () => {
  for (const className of [
    "participant-coordinate-grid",
    "participant-care-section",
    "participant-care-grid",
    "participant-supporting-section",
    "participant-review-section",
  ]) {
    assert.match(source, new RegExp(`className=\\"[^\\"]*${className}`));
    assert.match(styles, new RegExp(`\\.${className}`));
  }
});

test("review confirmation and actions remain separate flow-layout rows", () => {
  assert.match(styles, /\.participant-confirmation-row\s*\{[^}]*margin-top:\s*24px/s);
  assert.match(styles, /\.participant-request-form \.sr-wizard-actions\s*\{[^}]*margin-top:\s*24px/s);
  assert.doesNotMatch(styles, /\.participant-confirmation[^}]*position:\s*absolute/s);
});

test("wizard does not schedule uncancelled Leaflet invalidation timers", () => {
  assert.doesNotMatch(source, /setTimeout\([^)]*invalidateSize/s);
  assert.match(source, /createLeafletResizeScheduler/);
  assert.match(source, /observer\?\.disconnect\(\)/);
  assert.match(source, /scheduler\.dispose\(\)/);
});

test("requester address uses dependent PSGC fields and preserves the Bulan barangay list", () => {
  assert.match(source, /getPhilippineProvinces/);
  assert.match(source, /getMunicipalitiesForProvince\(form\.addressProvince\)/);
  assert.match(source, /key === "addressProvince"[\s\S]*addressMunicipality: ""[\s\S]*addressBarangay: ""/);
  assert.match(source, /key === "addressMunicipality"[\s\S]*addressBarangay: ""/);
  assert.match(source, /form\.addressProvince === "Sorsogon" && form\.addressMunicipality === "Bulan"/);
  assert.match(source, /<SelectBarangay/);
  assert.match(source, /placeholder="Enter barangay name"/);
  assert.doesNotMatch(source, /Manual barangay input for locations outside Bulan/i);
});

test("review and submitted workflow use resolved custom address values", () => {
  assert.match(source, /addressProvince: form\.addressProvince === "Other"[\s\S]*form\.addressProvinceOther\.trim\(\)/);
  assert.match(source, /addressMunicipality: form\.addressMunicipality === "Other"[\s\S]*form\.addressMunicipalityOther\.trim\(\)/);
  assert.match(source, /addressBarangay: form\.addressBarangay\.trim\(\)/);
  assert.doesNotMatch(source, /\{form\.addressBarangay\}, Bulan, Sorsogon/);
});
