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
