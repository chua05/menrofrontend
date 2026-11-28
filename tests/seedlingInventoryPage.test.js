import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/pages/SeedlingsPage.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles/seedlings.css", import.meta.url), "utf8");

test("Add/Edit Seedling forms no longer offer a manual Stock Status and never send one", () => {
  assert.doesNotMatch(source, /STOCK_STATUS_OPTIONS/);
  assert.doesNotMatch(source, /label="Stock Status \*"/);
  assert.doesNotMatch(source, /stockStatus:\s*(form|editForm)\.stockStatus/);
  assert.doesNotMatch(source, /updateEditForm\("stockStatus"/);
  assert.match(source, /Stock Status \(automatic\)/);
});

test("stock status is the calculated one and the filter offers Needs Review", () => {
  assert.match(source, /inventoryStockStatus\(/);
  assert.match(source, /<option value="Needs Review">/);
  assert.match(styles, /\.sd-status-needs-review\s*\{/);
});

test("inventory search uses one prebuilt shared index per record, before pagination", () => {
  assert.match(source, /useMemo\(\s*\(\)\s*=>\s*indexInventoryRecords\(seedlings\)/);
  assert.match(source, /filterInventoryRecords\(indexedSeedlings,/);
  assert.ok(source.indexOf("filterInventoryRecords(") < source.indexOf("filteredSeedlings.slice("));
});

test("distribution records: sub-tabs, then the filter bar, then the table header; released by shows a name only", () => {
  const start = source.indexOf('className="sd-subtabs"');
  const bar = source.indexOf("sd-distribution-filter-bar");
  const head = source.indexOf("<th>DISTRIBUTION ID</th>");
  assert.ok(start > 0 && bar > start && head > bar);
  assert.match(source, /All Transactions/);
  assert.match(source, /By Inventory Batch/);
  assert.doesNotMatch(source, /distribution\.releasedBy \|\|/);
  assert.match(source, /prepareDistributions\(/);
  assert.match(styles, /\.sd-subtabs\s*\{/);
});
