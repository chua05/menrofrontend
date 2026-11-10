import test from "node:test";
import assert from "node:assert/strict";
import { guestAttendanceErrors, normalizeGuestContact, attendanceOpensLabel } from "../src/utils/guestAttendance.js";

test("guest attendance needs Full Name, a valid mobile number and an address", () => {
  assert.deepEqual(guestAttendanceErrors({ fullName: "Maria Santos", contactNumber: "+63 912 345 6789", address: "Purok 3, Bical" }), {});
  assert.equal(normalizeGuestContact("+63 912-345-6789"), "09123456789");
  const errors = guestAttendanceErrors({ fullName: "M", contactNumber: "12345", address: "Bic" });
  assert.deepEqual(Object.keys(errors).sort(), ["address", "contactNumber", "fullName"]);
  assert.ok(guestAttendanceErrors({ fullName: "Maria\u0000", contactNumber: "09123456789", address: "Purok 3, Bical" }).fullName);
  assert.ok(guestAttendanceErrors({ fullName: "Maria Santos", contactNumber: "09123456789", address: "x".repeat(201) }).address);
  assert.equal(attendanceOpensLabel(null), "");
  assert.match(attendanceOpensLabel("2026-10-01T00:00:00.000Z"), /Oct 1, 2026/);
});
