import test from "node:test";
import assert from "node:assert/strict";
import { getPlantingAreaError, getPlantingAreaHectares } from "../src/utils/saplingRequestWorkflow.js";
test("custom hectares accept finite positive decimals without arbitrary precision restrictions", () => {
  for (const value of ["0.5", ".25", "0.000001", 0.0000001, "12.75"]) {
    assert.equal(getPlantingAreaError("Other / Exact Area", value), "");
    assert.equal(getPlantingAreaHectares("Other / Exact Area", value), Number(value));
  }
});
test("invalid, missing and non-decimal custom inputs remain field errors", () => {
  for (const value of ["", " ", null, undefined, "0", "-1", "NaN", "Infinity", "1e3", "0x10", "1,5", "1.2.3", "1/2", false, Infinity]) assert.ok(getPlantingAreaError("Other / Exact Area", value));
});
test("proposed blank remains optional/null while exact selection stays required", () => {
  assert.equal(getPlantingAreaError("", "", { optional: true }), "");
  assert.equal(getPlantingAreaHectares("", ""), null);
  assert.ok(getPlantingAreaError("Other / Exact Area", "", { optional: true }));
  assert.ok(getPlantingAreaError("", ""));
  assert.equal(getPlantingAreaHectares("2 hectares", "999"), 2);
});
