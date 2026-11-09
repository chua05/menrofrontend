import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Vercel routes Firebase Auth helpers to the production helper before the SPA fallback", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const helperIndex = config.rewrites.findIndex((rewrite) => rewrite.source === "/__/auth/:path*");
  const fallbackIndex = config.rewrites.findIndex((rewrite) => rewrite.source === "/(.*)");

  assert.ok(helperIndex >= 0, "Firebase Auth helper rewrite must exist");
  assert.ok(fallbackIndex >= 0, "SPA fallback rewrite must exist");
  assert.ok(helperIndex < fallbackIndex, "Firebase Auth helper rewrite must precede the SPA fallback");
  assert.equal(
    config.rewrites[helperIndex].destination,
    "https://menrosystem-ddfac.firebaseapp.com/__/auth/:path*",
  );
});

// Header sources here use only path-to-regexp regex groups, which read the same as a regular expression.
const headerMatches = (source, path) => new RegExp(`^${source}$`).test(path);
const coopFor = (config, path) => config.headers
  .filter((rule) => headerMatches(rule.source, path))
  .flatMap((rule) => rule.headers)
  .filter((header) => header.key.toLowerCase() === "cross-origin-opener-policy");

test("Firebase Auth helper pages are served without a Cross-Origin-Opener-Policy header", async () => {
  // A COOP header on the helper cuts the popup off from MENRO once it moves to Google,
  // so Firebase reports the still-open sign-in popup as closed by the user.
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  for (const path of ["/__/auth/handler", "/__/auth/iframe", "/__/auth/handler.js"]) {
    assert.deepEqual(coopFor(config, path), [], path);
  }
});

test("MENRO pages keep same-origin-allow-popups for the Google sign-in popup", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  for (const path of ["/", "/login", "/register", "/staff/dashboard", "/participant/my-requests", "/assets/index.js"]) {
    assert.deepEqual(coopFor(config, path).map((header) => header.value), ["same-origin-allow-popups"], path);
  }
  const serviceWorker = config.headers.find((rule) => rule.source === "/sw.js");
  assert.deepEqual(serviceWorker.headers, [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }]);
});
