import test from "node:test";
import assert from "node:assert/strict";
import {
  getMunicipalitiesForProvince,
  getPhilippineProvinces,
} from "../src/utils/philippineLocations.js";

test("provides the complete PSGC province list plus Metro Manila", () => {
  const names = getPhilippineProvinces().map((entry) => entry.name);
  assert.ok(names.length >= 83);
  for (const province of ["Abra", "Albay", "Camarines Sur", "Sorsogon", "Metro Manila"]) {
    assert.ok(names.includes(province));
  }
});

test("provides dependent PSGC municipality and city options", () => {
  const sorsogon = getMunicipalitiesForProvince("Sorsogon").map((entry) => entry.name);
  const albay = getMunicipalitiesForProvince("Albay").map((entry) => entry.name);
  const metroManila = getMunicipalitiesForProvince("Metro Manila").map((entry) => entry.name);
  assert.ok(sorsogon.includes("Bulan"));
  assert.ok(sorsogon.includes("Juban"));
  assert.ok(albay.includes("Legazpi City"));
  assert.ok(metroManila.includes("Manila City"));
  assert.deepEqual(getMunicipalitiesForProvince("Other"), []);
});
