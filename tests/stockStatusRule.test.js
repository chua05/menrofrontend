import assert from "node:assert/strict";
import test from "node:test";
import { LIMITED_THRESHOLD_PERCENT, STOCK_STATUS, calculateStockStatus, resolveReceivedBaseline, stockStatusForRecord } from "../src/utils/stockStatus.js";

test("status table against 100 received", () => {
  assert.equal(calculateStockStatus(31, 100), STOCK_STATUS.AVAILABLE);
  assert.equal(calculateStockStatus(30, 100), STOCK_STATUS.LIMITED);
  assert.equal(calculateStockStatus(1, 100), STOCK_STATUS.LIMITED);
  assert.equal(calculateStockStatus(0, 100), STOCK_STATUS.OUT_OF_STOCK);
  assert.equal(LIMITED_THRESHOLD_PERCENT, 30);
});

test("no rounding of the percentage", () => {
  assert.equal(calculateStockStatus(2, 7), STOCK_STATUS.LIMITED);
  assert.equal(calculateStockStatus(3, 10), STOCK_STATUS.LIMITED);
  assert.equal(calculateStockStatus(4, 10), STOCK_STATUS.AVAILABLE);
});

test("missing or invalid baseline needs review unless out of stock", () => {
  assert.equal(calculateStockStatus(5, null), STOCK_STATUS.NEEDS_REVIEW);
  assert.equal(calculateStockStatus(5, 0), STOCK_STATUS.NEEDS_REVIEW);
  assert.equal(calculateStockStatus(0, null), STOCK_STATUS.OUT_OF_STOCK);
  assert.equal(calculateStockStatus(11, 10), STOCK_STATUS.NEEDS_REVIEW);
});

test("resolveReceivedBaseline", () => {
  assert.equal(resolveReceivedBaseline({ totalReceivedQuantity: 200, initialQuantity: 100, replenishmentCycle: 2 }), 200);
  assert.equal(resolveReceivedBaseline({ currentQuantity: 100, initialQuantity: 100 }), 100);
  assert.equal(resolveReceivedBaseline({ currentQuantity: 60, distributedQuantity: 40, initialQuantity: 100, replenishmentCycle: 0 }), 100);
  assert.equal(resolveReceivedBaseline({ initialQuantity: 100, replenishmentCycle: 1 }), null);
  assert.equal(resolveReceivedBaseline({ totalReceivedQuantity: 0 }), null);
  assert.equal(resolveReceivedBaseline({ totalReceivedQuantity: -5 }), null);
  assert.equal(resolveReceivedBaseline({ totalReceivedQuantity: 2.5, initialQuantity: 2.5 }), null);
  assert.equal(resolveReceivedBaseline(null), null);
});

test("stockStatusForRecord", () => {
  assert.deepEqual(stockStatusForRecord({ currentQuantity: 30, totalReceivedQuantity: 100 }), {
    status: "Limited", currentQuantity: 30, totalReceivedQuantity: 100, remainingPercent: 30, baselineIssue: null,
  });
  const legacy = stockStatusForRecord({ currentQuantity: 5, initialQuantity: 10, replenishmentCycle: 1 });
  assert.equal(legacy.status, "Needs Review");
  assert.equal(legacy.totalReceivedQuantity, null);
  assert.equal(legacy.remainingPercent, null);
  assert.ok(legacy.baselineIssue);
  assert.equal(stockStatusForRecord({ currentQuantity: 0 }).status, "Out of Stock");
  assert.ok(stockStatusForRecord({ currentQuantity: 11, totalReceivedQuantity: 10 }).baselineIssue);
});

test("backend parity: current quantity fallback and odd values", () => {
  assert.equal(calculateStockStatus(null, 100), "Out of Stock");
  assert.equal(calculateStockStatus(undefined, 100), "Out of Stock");
  assert.equal(calculateStockStatus("", 100), "Out of Stock");
  assert.equal(calculateStockStatus(-5, 100), "Out of Stock");
  assert.equal(calculateStockStatus("abc", 100), "Out of Stock");
  assert.equal(calculateStockStatus(100, 100), "Available");
  assert.equal(calculateStockStatus("30", "100"), "Limited");
  const fallback = stockStatusForRecord({ availableQuantity: 50, distributedQuantity: 50, initialQuantity: 100 });
  assert.equal(fallback.status, "Available");
  assert.equal(fallback.currentQuantity, 50);
  assert.equal(fallback.remainingPercent, 50);
  assert.equal(fallback.baselineIssue, null);
});

test("backend parity: baseline issues are reported even at zero stock", () => {
  const zero = stockStatusForRecord({ currentQuantity: 0 });
  assert.equal(zero.status, "Out of Stock");
  assert.equal(zero.baselineIssue, "Total received quantity is missing or invalid.");
  const restockedZero = stockStatusForRecord({ currentQuantity: 0, initialQuantity: 100, replenishmentCycle: 3 });
  assert.equal(restockedZero.status, "Out of Stock");
  assert.ok(restockedZero.baselineIssue);
  const over = stockStatusForRecord({ currentQuantity: 9, totalReceivedQuantity: 5 });
  assert.equal(over.status, "Needs Review");
  assert.equal(over.baselineIssue, "Current quantity exceeds total received quantity.");
  assert.equal(stockStatusForRecord(null).status, "Out of Stock");
});

test("backend parity: baseline accepts numeric strings only when integral and positive", () => {
  assert.equal(resolveReceivedBaseline({ totalReceivedQuantity: "150", initialQuantity: 100, replenishmentCycle: 2 }), 150);
  assert.equal(resolveReceivedBaseline({ initialQuantity: 10.5 }), null);
  assert.equal(resolveReceivedBaseline({}), null);
});

test("initial-quantity baseline requires stock to reconcile", () => {
  const s = (r) => stockStatusForRecord(r).status;
  assert.equal(s({ currentQuantity: 50, distributedQuantity: 250, initialQuantity: 100 }), "Needs Review");
  assert.equal(s({ currentQuantity: 30, distributedQuantity: 70, initialQuantity: 100 }), "Limited");
  assert.equal(s({ currentQuantity: 20, reservedQuantity: 10, distributedQuantity: 70, initialQuantity: 100 }), "Limited");
  assert.equal(s({ currentQuantity: 50, distributedQuantity: 40, initialQuantity: 100 }), "Needs Review");
  assert.equal(s({ availableQuantity: 100, initialQuantity: 100 }), "Available");
  assert.equal(resolveReceivedBaseline({ currentQuantity: 50, distributedQuantity: 250, initialQuantity: 100 }), null);
  assert.equal(resolveReceivedBaseline({ currentQuantity: 30, distributedQuantity: 70, initialQuantity: 100 }), 100);
  assert.equal(resolveReceivedBaseline({ currentQuantity: 30, distributedQuantity: -70, initialQuantity: 100 }), null);
  assert.equal(resolveReceivedBaseline({ currentQuantity: 30, distributedQuantity: 70.5, initialQuantity: 100 }), null);
  assert.equal(resolveReceivedBaseline({ currentQuantity: 100, totalReceivedQuantity: 150, distributedQuantity: 999, initialQuantity: 100 }), 150);
});

test("a record with no current or available quantity never proves its baseline (matches the backend)", () => {
  assert.equal(resolveReceivedBaseline({ initialQuantity: 100, distributedQuantity: 100 }), null);
  assert.equal(resolveReceivedBaseline({ initialQuantity: 100, currentQuantity: null, availableQuantity: null, distributedQuantity: 100 }), null);
  assert.equal(resolveReceivedBaseline({ initialQuantity: 100, currentQuantity: 0, distributedQuantity: 100 }), 100);
});
