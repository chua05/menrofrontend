import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("index.html"), css = read("src/styles/startup.css");
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const reveal = (source, selector, seconds) => new RegExp(
  escape(selector) + String.raw`\s*\{[^}]*visibility:\s*hidden[^}]*animation:[^}]*\b` + seconds + String.raw`s\b[^}]*forwards`,
).test(source);

test("the initial loading panel is hidden until loading is actually slow", () => {
  assert.match(html, /<section class="startup-panel startup-delayed" role="status">/);
  assert.match(html, /<p class="startup-reload-hint">If loading does not finish, <a href="">reload this page<\/a>\.<\/p>/);
  assert.ok(reveal(html, ".startup-delayed", 2), "index.html reveals the panel after 2 seconds");
  assert.ok(reveal(html, ".startup-reload-hint", 10), "index.html reveals the reload prompt after 10 seconds");
  assert.match(html, /@keyframes menro-startup-reveal\s*\{\s*to\s*\{\s*visibility:\s*visible/);
});

test("without JavaScript the recovery instructions show immediately", () => {
  assert.match(html, /<noscript><style>\.startup-delayed,\s*\.startup-reload-hint\s*\{[^}]*visibility:\s*visible[^}]*animation:\s*none/);
});

test("component loading panels share the same delays", () => {
  assert.ok(reveal(css, ".startup-delayed", 2), "startup.css reveals panels after 2 seconds");
  assert.ok(reveal(css, ".startup-reload-hint", 10), "startup.css reveals the reload prompt after 10 seconds");
  const authLoading = read("src/components/AuthLoading.jsx");
  assert.match(authLoading, /className="startup-panel startup-delayed"/);
  assert.match(authLoading, /className="startup-reload-hint"/);
});

test("error screens are never delayed", () => {
  for (const file of ["src/bootstrap.js", "src/components/AppErrorBoundary.jsx"]) {
    assert.doesNotMatch(read(file), /startup-delayed|startup-reload-hint/, file);
  }
});
