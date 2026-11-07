import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leftoverQuantityError, plantedFromLeftover } from "../src/utils/plantingQuantity.js";
import { validatePlantingReportForm } from "../src/utils/plantingReportForm.js";

const source = file => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
const form = overrides => ({ inventoryId: "narra", remainingQuantity: 10, leftoverQuantity: "0", ...overrides });

test("planted is the distributed quantity minus leftovers", () => {
  assert.equal(plantedFromLeftover(10, "0"), 10);
  assert.equal(plantedFromLeftover(10, "3"), 7);
  assert.equal(plantedFromLeftover(10, "10"), 0);
  assert.equal(plantedFromLeftover("8", ""), 8);
});

test("the calculated value never goes below zero while typing", () => {
  assert.equal(plantedFromLeftover(10, "12"), 0);
});

test("leftover must be a whole number within the distributed quantity", () => {
  for (const value of ["0", "3", "10", 0, 10]) assert.equal(leftoverQuantityError(value, 10), "", String(value));
  for (const value of ["", "-1", "1.5", "abc", "1e3", null]) assert.equal(leftoverQuantityError(value, 10), "Enter a nonnegative whole number.", String(value));
  assert.equal(leftoverQuantityError("11", 10), "Leftover cannot exceed the 10 seedlings available.");
});

test("the participant form reports leftover problems on the leftover field", () => {
  assert.equal(validatePlantingReportForm(form({ leftoverQuantity: "11" })).leftoverQuantity, "Leftover cannot exceed the 10 seedlings available.");
  assert.equal(validatePlantingReportForm(form({ leftoverQuantity: "-1" })).leftoverQuantity, "Enter a nonnegative whole number.");
  assert.equal(validatePlantingReportForm(form({ leftoverQuantity: "10" })).leftoverQuantity, undefined);
  assert.equal(validatePlantingReportForm(form()).quantity, undefined);
});

test("a release with nothing left cannot be reported", () => {
  assert.equal(validatePlantingReportForm(form({ remainingQuantity: 0 })).quantity, "No seedlings remain available for reporting on this release.");
});

test("no species selected reports the selection, not the quantity", () => {
  assert.equal(validatePlantingReportForm(form({ inventoryId: "", remainingQuantity: "" })).quantity, undefined);
});

test("the participant form has no partial reporting path", () => {
  const page = source("pages/PlantingPage.jsx");
  assert.doesNotMatch(page, /planting-confirmation-mode|Partial planting|confirmationMode: "partial"/);
  assert.match(page, /payload\.append\("confirmationMode", "final"\)/);
});

test("the staff form no longer accepts typed planted quantities", () => {
  assert.doesNotMatch(source("components/StaffPlantingReportForm.jsx"), /changeItem\(index, "quantityPlanted"/);
});
