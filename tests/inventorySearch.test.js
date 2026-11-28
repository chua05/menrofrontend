import assert from "node:assert/strict";
import test from "node:test";
import { buildInventorySearchIndex, filterInventoryRecords, indexInventoryRecords, inventoryStockStatus } from "../src/utils/inventorySearch.js";

const records = [
  { id: "a", batchReference: "BAT-2026-003", treeName: "Kalamansi", scientificName: "Citrus microcarpa", category: "Fruit Tree",
    currentQuantity: 1000, totalReceivedQuantity: 1200, status: "Available", sourceType: "Donation", dateReceived: "2026-10-12",
    storageLocation: "MENRO Nursery", description: "From the barangay council" },
  { id: "b", batchReference: "BAT-2026-004", treeName: "Narra", scientificName: "Pterocarpus indicus", category: "Other", categorySpecification: "Shade",
    currentQuantity: 20, totalReceivedQuantity: null, status: "Needs Review", sourceType: "Other", sourceSpecification: "Church group",
    dateReceived: "2026-09-01", storageLocation: "Other", storageLocationSpecification: "Barangay hall" },
  { id: "c", batchReference: "BAT-2026-005", treeName: "Kalamansi", scientificName: "Citrus microcarpa", category: "Fruit Tree",
    currentQuantity: 0, totalReceivedQuantity: 100, status: "Out of Stock", sourceType: "MENRO Propagation", dateReceived: "2026-08-15" },
];
const indexed = indexInventoryRecords(records);
const ids = (filters) => filterInventoryRecords(indexed, { search: "", treeName: "", status: "", ...filters }).map((r) => r.id);

test("inventory search finds batch ref, source, tree, category, quantity and dates", () => {
  assert.deepEqual(ids({ search: "BAT-2026-003" }), ["a"]);
  assert.deepEqual(ids({ search: "bat-2026" }), ["a", "b", "c"]);
  assert.deepEqual(ids({ search: "Donation" }), ["a"]);
  assert.deepEqual(ids({ search: "kalamansi" }), ["a", "c"]);
  assert.deepEqual(ids({ search: "2026-10-12" }), ["a"]);
  assert.deepEqual(ids({ search: "Oct 12, 2026" }), ["a"]);
  assert.deepEqual(ids({ search: "October 12 2026" }), ["a"]);
  assert.deepEqual(ids({ search: "10/12/2026" }), ["a"]);
  assert.deepEqual(ids({ search: "1,000" }), ["a"]);
  assert.deepEqual(ids({ search: "1000" }), ["a"]);
  assert.deepEqual(ids({ search: "fruit tree" }), ["a", "c"]);
  assert.deepEqual(ids({ search: "shade" }), ["b"]);
  assert.deepEqual(ids({ search: "church group" }), ["b"]);
  assert.deepEqual(ids({ search: "  KALAMANSI   donation " }), ["a"]);
  assert.deepEqual(ids({ search: "needs review" }), ["b"]);
  assert.deepEqual(ids({ search: "out of stock" }), ["c"]);
  assert.deepEqual(ids({ search: "mango" }), []);
});

test("search works together with tree name and status filters", () => {
  assert.deepEqual(ids({ search: "kalamansi", status: "Out of Stock" }), ["c"]);
  assert.deepEqual(ids({ treeName: "Kalamansi", search: "donation" }), ["a"]);
  assert.deepEqual(ids({ status: "Needs Review" }), ["b"]);
  assert.deepEqual(ids({}), ["a", "b", "c"]);
});

test("the index is built once per record and is already normalised", () => {
  const index = buildInventorySearchIndex(records[0]);
  assert.equal(index, index.toLowerCase());
  assert.equal(indexed[0].index, index);
  assert.equal(indexed[0].record, records[0]);
});

test("inventoryStockStatus prefers the server status and falls back to the shared rule", () => {
  assert.equal(inventoryStockStatus({ stockStatus: "Limited", currentQuantity: 90, totalReceivedQuantity: 100 }).status, "Limited");
  assert.equal(inventoryStockStatus({ currentQuantity: 30, totalReceivedQuantity: 100 }).status, "Limited");
  assert.equal(inventoryStockStatus({ currentQuantity: 31, totalReceivedQuantity: 100 }).status, "Available");
  assert.equal(inventoryStockStatus({ currentQuantity: 0, totalReceivedQuantity: 100 }).status, "Out of Stock");
  const legacy = inventoryStockStatus({ currentQuantity: 40, initialQuantity: 50, replenishmentCycle: 2, stockStatus: "Available manual" });
  assert.equal(legacy.status, "Needs Review");
  assert.match(legacy.baselineIssue, /missing or invalid/);
  const server = inventoryStockStatus({ stockStatus: "Needs Review", currentQuantity: 40, totalReceivedQuantity: null, remainingStockPercent: null, stockBaselineIssue: "Server reason." });
  assert.equal(server.baselineIssue, "Server reason.");
  assert.equal(server.remainingPercent, null);
  assert.equal(inventoryStockStatus({ stockStatus: "Available", currentQuantity: 50, totalReceivedQuantity: 100, remainingStockPercent: 50 }).remainingPercent, 50);
});

test("stock status note: reason only for Needs Review; Out of Stock never shows a baseline warning", async () => {
  const { stockStatusNote } = await import("../src/utils/inventorySearch.js");
  assert.equal(stockStatusNote({ status: "Out of Stock", totalReceivedQuantity: null, remainingStockPercent: null, stockBaselineIssue: "Total received quantity is missing or invalid." }), "");
  assert.equal(stockStatusNote({ status: "Needs Review", stockBaselineIssue: "Total received quantity is missing or invalid." }), "Total received quantity is missing or invalid.");
  assert.equal(stockStatusNote({ status: "Needs Review", stockBaselineIssue: null }), "Total received quantity is missing or invalid.");
  assert.equal(stockStatusNote({ status: "Limited", totalReceivedQuantity: 1000, remainingStockPercent: 30 }), "30% of 1,000 received remaining");
  assert.equal(stockStatusNote({ status: "Available", totalReceivedQuantity: 1200, remainingStockPercent: 83.3333 }), "83.3% of 1,200 received remaining");
  assert.equal(stockStatusNote({ status: "Out of Stock", totalReceivedQuantity: 100, remainingStockPercent: 0 }), "0% of 100 received remaining");
});
