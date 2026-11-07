import assert from "node:assert/strict";
import test from "node:test";
import { attendanceFileError, ATTENDANCE_MAX_BYTES } from "../src/utils/attendanceFile.js";
import { resolveInteractiveLoginPath, resolvePostLoginPath } from "../src/utils/postLoginRoute.js";
import { beginInteractiveLogin, markSuccessfulLogin, consumeSuccessfulLogin, clearSuccessfulLogin, hasInteractiveLoginIntent, isInteractiveLoginPending } from "../src/utils/loginSuccess.js";
import { validatePlantingReportForm } from "../src/utils/plantingReportForm.js";

test("fresh interactive logins use role dashboards without changing authenticated deep links or profile completion", () => {
  for (const role of ["admin", "staff", "participant"]) {
    assert.equal(resolveInteractiveLoginPath({ role, profileComplete: true }), `/${role}/dashboard`);
    assert.equal(resolvePostLoginPath(`/${role}/planting-reports?report=owned`, { role }), `/${role}/planting-reports?report=owned`);
  }
  assert.equal(resolveInteractiveLoginPath({ role: "participant", profileComplete: false }), "/complete-profile");
});

test("login UX state is consumed once for the correct user and cleared on logout", () => {
  const previous = globalThis.window, data = new Map();
  globalThis.window = { sessionStorage: { setItem: (k, v) => data.set(k, v), getItem: k => data.get(k) ?? null, removeItem: k => data.delete(k) }, dispatchEvent() {} };
  try {
    beginInteractiveLogin(); assert.equal(isInteractiveLoginPending(), true);
    markSuccessfulLogin({ uid: "staff" }); assert.equal(isInteractiveLoginPending(), false);
    assert.equal(hasInteractiveLoginIntent(), true);
    assert.equal(typeof consumeSuccessfulLogin({ uid: "staff" }), "string");
    assert.equal(consumeSuccessfulLogin({ uid: "staff" }), null);
    markSuccessfulLogin({ uid: "staff" }); assert.equal(consumeSuccessfulLogin({ uid: "other" }), null);
    markSuccessfulLogin({ uid: "staff" }); clearSuccessfulLogin();
    assert.equal(hasInteractiveLoginIntent(), false); assert.equal(consumeSuccessfulLogin({ uid: "staff" }), null);
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});

test("attendance remains optional and accepts only bounded matching image/PDF files", () => {
  assert.equal(attendanceFileError(null), "");
  for (const [type, name] of [["application/pdf", "attendance.pdf"], ["image/jpeg", "attendance.JPG"], ["image/png", "attendance.png"]]) {
    assert.equal(attendanceFileError({ type, name, size: ATTENDANCE_MAX_BYTES }), "");
    for (const size of [0, -1, Infinity, NaN, ATTENDANCE_MAX_BYTES + 1]) assert.ok(attendanceFileError({ type, name, size }));
  }
  assert.ok(attendanceFileError({ type: "application/pdf", name: "unsafe.html", size: 100 }));
  assert.ok(attendanceFileError({ type: "image/svg+xml", name: "unsafe.svg", size: 100 }));
});

test("participant leftover validation preserves zero and bounds planted plus leftovers", () => {
  const form = { quantity: "6", leftoverQuantity: "2", remainingQuantity: 8 };
  let errors = validatePlantingReportForm(form);
  assert.equal(errors.quantity, undefined); assert.equal(errors.leftoverQuantity, undefined);
  errors = validatePlantingReportForm({ ...form, leftoverQuantity: "9" }); assert.ok(errors.leftoverQuantity);
  for (const leftoverQuantity of ["", "-1", "1.5", Infinity]) assert.ok(validatePlantingReportForm({ ...form, leftoverQuantity }).leftoverQuantity);
  assert.equal(validatePlantingReportForm({ ...form, leftoverQuantity: "0" }).leftoverQuantity, undefined);
});
