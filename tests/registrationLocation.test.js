import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REGISTRATION_MUNICIPALITY, REGISTRATION_PROVINCE } from "../src/utils/userTypes.js";

const source = readFileSync(new URL("../src/pages/RegisterPage.jsx", import.meta.url), "utf8");

test("registration location constants are Sorsogon and Bulan", () => {
  assert.equal(REGISTRATION_PROVINCE, "Sorsogon");
  assert.equal(REGISTRATION_MUNICIPALITY, "Bulan");
});

test("register page defaults, renders read-only and sends the location", () => {
  assert.match(source, /province: REGISTRATION_PROVINCE/);
  assert.match(source, /municipality: REGISTRATION_MUNICIPALITY/);
  assert.match(source, /id="register-province"[^>]*readOnly/);
  assert.match(source, /id="register-municipality"[^>]*readOnly/);
  assert.match(source, /province: form\.province,\s*municipality: form\.municipality/);
});
