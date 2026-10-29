import test from "node:test";
import assert from "node:assert/strict";
import { resolveFirebaseAuthDomain } from "../src/config/firebaseAuthDomain.js";

const firebaseHosted = "menrosystem-ddfac.firebaseapp.com";

test("keeps the configured Firebase authDomain when the same-origin helper is disabled", () => {
  assert.equal(resolveFirebaseAuthDomain({ VITE_FIREBASE_AUTH_DOMAIN: firebaseHosted }, {
    hostname: "menro-xxtt-five.vercel.app", protocol: "https:",
  }), firebaseHosted);
});

test("uses the HTTPS application host only when the same-origin helper is explicitly enabled", () => {
  assert.equal(resolveFirebaseAuthDomain({
    VITE_FIREBASE_AUTH_DOMAIN: firebaseHosted,
    VITE_FIREBASE_SAME_ORIGIN_AUTH_HELPER: "true",
  }, { hostname: "menro-xxtt-five.vercel.app", protocol: "https:" }), "menro-xxtt-five.vercel.app");
});

test("fails closed for an insecure or unavailable same-origin host", () => {
  const environment = { VITE_FIREBASE_AUTH_DOMAIN: firebaseHosted, VITE_FIREBASE_SAME_ORIGIN_AUTH_HELPER: "true" };
  assert.throws(() => resolveFirebaseAuthDomain(environment, { hostname: "menro-xxtt-five.vercel.app", protocol: "http:" }), /HTTPS/);
  assert.throws(() => resolveFirebaseAuthDomain(environment, { hostname: "", protocol: "https:" }), /HTTPS/);
});
