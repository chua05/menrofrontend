import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(
  new URL("../src/styles/planting-reports.css", import.meta.url),
  "utf8",
);

test("planting reports contains page width without hiding application overflow", () => {
  assert.match(styles, /\.pr-page\s*\{[^}]*box-sizing:\s*border-box[^}]*max-width:\s*100%[^}]*min-width:\s*0/s);
  assert.doesNotMatch(styles, /\.pr-page\s*\{[^}]*overflow-x:\s*(?:hidden|clip)/s);
  assert.match(styles, /\.pr-panel\s*\{[^}]*max-width:\s*100%[^}]*min-width:\s*0/s);
});

test("mobile report filters form a content-height single-column stack", () => {
  assert.match(styles, /@media \(max-width: 768px\)[\s\S]*?\.pr-toolbar\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0, 1fr\)[^}]*height:\s*auto[^}]*min-height:\s*0/s);
  assert.match(styles, /@media \(max-width: 768px\)[\s\S]*?\.pr-toolbar-left\s*\{[^}]*display:\s*grid[^}]*flex:\s*none[^}]*width:\s*100%/s);
});

test("wide report columns scroll only inside their table wrapper", () => {
  assert.match(styles, /\.pr-table-wrap\s*\{[^}]*max-width:\s*100%[^}]*min-width:\s*0[^}]*overflow-x:\s*auto/s);
  assert.match(styles, /\.pr-table\s*\{[^}]*min-width:\s*970px/s);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.pr-table\s*\{[^}]*min-width:\s*820px/s);
});
