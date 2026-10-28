import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const pwaRegistration = readFileSync(
  new URL("../src/pwaRegistration.js", import.meta.url),
  "utf8",
);

test("PWA metadata includes the current installability meta tag", () => {
  assert.match(html, /<meta name="mobile-web-app-capable" content="yes" \/>/);
});

test("service-worker load listener removes itself after firing", () => {
  assert.match(
    pwaRegistration,
    /window\.addEventListener\([\s\S]*"load",[\s\S]*\{ once: true \},[\s\S]*\);/,
  );
});
