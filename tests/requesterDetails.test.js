import test from "node:test";
import assert from "node:assert/strict";
import { getRequesterDetailField, keepOnlyRequesterDetail } from "../src/utils/requesterDetails.js";
import { isValidPhilippineContactNumber } from "../src/utils/philippineContact.js";

const expected = [
  ["Resident / Individual", null, null],
  ["Barangay Official", "positionInBarangay", "Position in Barangay"],
  ["Student (Individual)", "schoolName", "School Name"],
  ["School Organization Representative", "organizationName", "School / Organization Name"],
  ["Private Sector / Business", "organizationName", "Business / Company Name"],
  ["Civic Organization / NGO", "organizationName", "Organization Name"],
  ["Government Agency", "organizationName", "Government Agency / Office Name"],
  ["Other (please specify)", "sectorOther", "Specify Requester Type"],
];

test("each Requesting As value maps to exactly its own field", () => {
  for (const [sector, key, label] of expected) {
    const field = getRequesterDetailField(sector);
    assert.equal(field?.key ?? null, key, sector);
    assert.equal(field?.label ?? null, label, sector);
  }
});

test("legacy School / Student only asks for an organization when it is a group", () => {
  assert.equal(getRequesterDetailField("School / Student", "individual"), null);
  assert.equal(getRequesterDetailField("School / Student", "group").key, "organizationName");
});

test("only the value for the selected requester type is kept", () => {
  const values = { positionInBarangay: "Kagawad", schoolName: "Bulan NHS", organizationName: "Acme", sectorOther: "Farmer" };
  assert.deepEqual(keepOnlyRequesterDetail(values, "Barangay Official"), { positionInBarangay: "Kagawad", schoolName: "", organizationName: "", sectorOther: "" });
  assert.deepEqual(keepOnlyRequesterDetail(values, "Resident / Individual"), { positionInBarangay: "", schoolName: "", organizationName: "", sectorOther: "" });
});

test("a saved Other group request keeps its organization name", () => {
  const kept = keepOnlyRequesterDetail({ organizationName: "Association", sectorOther: "Cooperative" }, "Other (please specify)", "group");
  assert.equal(kept.organizationName, "Association");
  assert.equal(kept.sectorOther, "Cooperative");
});

test("Philippine mobile and landline formats are accepted", () => {
  for (const value of ["09171234567", "0917 123 4567", "0917-123-4567", "+639171234567", "639171234567", "+63 917 123 4567",
    "0288881234", "(02) 8888 1234", "+63288881234", "0562111234", "(056) 211-1234", "+63562111234"]) {
    assert.equal(isValidPhilippineContactNumber(value), true, value);
  }
});

test("invalid contact numbers are rejected", () => {
  for (const value of ["", "   ", "12345", "0917123456", "091712345678", "08171234567x", "+19171234567", "0012345678", "abcdefghijk", "1234567"]) {
    assert.equal(isValidPhilippineContactNumber(value), false, value);
  }
});
