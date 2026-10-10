import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sidebar = readFileSync(
  new URL("../src/layouts/Sidebar.jsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../src/styles/dashboard-shell.css", import.meta.url),
  "utf8",
);

test("all sidebar roles use the same shared notification badge", () => {
  assert.match(sidebar, /className="sb-item-badge"/);
  assert.doesNotMatch(sidebar, /admin[^\n]*badge|staff[^\n]*badge/i);
});

test("sidebar notification badge is white with a green count", () => {
  assert.match(
    css,
    /\.sb-item-badge\s*\{[^}]*color:\s*#166534;[^}]*background:\s*#ffffff;/s,
  );
});
