import test from "node:test";
import assert from "node:assert/strict";
import {
  IDENTIFICATION_DOCUMENTS,
  validateIdentificationForm,
} from "../src/utils/identificationDocuments.js";

test("identification dropdown exposes every required stable option", () => {
  assert.equal(IDENTIFICATION_DOCUMENTS.length, 16);
  assert.equal(
    IDENTIFICATION_DOCUMENTS.some((document) => document.value === "school_id" && document.label === "School ID / Student ID"),
    true,
  );
});

test("flexible ID strings preserve leading zeroes and separators", () => {
  for (const idNumber of ["N01-23-456789", "0012345678", "ABC-2026-001", "2026/00125", "2024-12345-A"]) {
    assert.deepEqual(validateIdentificationForm({
      identificationType: "drivers_license",
      idNumber,
      confirmedInformation: true,
    }), {});
  }
});

test("school identification requires an institution but accepts varied formats", () => {
  const formats = ["2023-001234", "2024-12345-A", "BSIT-2025-001", "0012345678", "A-2026-1234", "2026/00125", "123456"];
  for (const idNumber of formats) {
    assert.deepEqual(validateIdentificationForm({
      identificationType: "school_id",
      idNumber,
      schoolInstitutionName: "Sorsogon State University",
      confirmedInformation: true,
    }), {});
  }
  assert.equal(validateIdentificationForm({
    identificationType: "school_id",
    idNumber: "2026-001",
    schoolInstitutionName: "",
    confirmedInformation: true,
  }).schoolInstitutionName, "School / Institution Name is required.");
});

test("identification confirmation is mandatory", () => {
  assert.equal(validateIdentificationForm({
    identificationType: "passport",
    idNumber: "P1234567",
    confirmedInformation: false,
  }).confirmedInformation, "Please confirm that the information provided is correct.");
});
