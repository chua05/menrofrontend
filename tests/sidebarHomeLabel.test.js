import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sidebar = readFileSync(
  new URL("../src/layouts/Sidebar.jsx", import.meta.url),
  "utf8",
);

test("sidebar has no legacy Main section or Dashboard label", () => {
  assert.doesNotMatch(sidebar, /section: "Main"/);
  assert.doesNotMatch(sidebar, /label: "Dashboard"/);
});

test("every role uses a Home section with a Home item", () => {
  assert.equal(sidebar.match(/section: "Home"/g)?.length, 3);
  assert.equal(sidebar.match(/label: "Home"/g)?.length, 3);
});

test("Home item uses the House icon imported from lucide-react", () => {
  assert.match(sidebar, /import \{[^}]*\bHouse,[^}]*\} from "lucide-react";/s);
  assert.equal(sidebar.match(/icon: House,/g)?.length, 3);
});
