import assert from "node:assert/strict";
import test from "node:test";
import { resolvePostLoginPath } from "../src/utils/postLoginRoute.js";

test("returns an authorized protected route after verified login", () => {
  assert.equal(
    resolvePostLoginPath("/participant/my-requests?tab=returned", {
      role: "participant",
      profileComplete: true,
    }),
    "/participant/my-requests?tab=returned",
  );
  assert.equal(
    resolvePostLoginPath("/staff/planting-reports", { role: "staff" }),
    "/staff/planting-reports",
  );
});

test("does not restore cross-role, external, or malformed destinations", () => {
  assert.equal(
    resolvePostLoginPath("/admin/dashboard", { role: "participant", profileComplete: true }),
    "/participant/dashboard",
  );
  assert.equal(
    resolvePostLoginPath("//example.invalid", { role: "staff" }),
    "/staff/dashboard",
  );
  assert.equal(
    resolvePostLoginPath("https://example.invalid", { role: "admin" }),
    "/admin/dashboard",
  );
});

test("requires incomplete participants to complete their profile before restoration", () => {
  assert.equal(
    resolvePostLoginPath("/participant/my-requests", {
      role: "participant",
      profileComplete: false,
    }),
    "/complete-profile",
  );
});
