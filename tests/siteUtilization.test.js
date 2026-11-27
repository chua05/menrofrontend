import test from "node:test";
import assert from "node:assert/strict";
import { siteUtilization, UTILIZATION_LEVELS } from "../src/utils/siteUtilization.js";

const status = (planted, maximumCapacity, extra = {}) => siteUtilization({ planted, maximumCapacity, ...extra });

test("thresholds: green 0-49%, orange 50-89%, red 90-100%", () => {
  for (const [planted, label] of [[0, "Available"], [49, "Available"], [50, "Partially Occupied"], [89, "Partially Occupied"], [90, "Full"], [100, "Full"]]) {
    assert.equal(status(planted, 100).label, label, `${planted}/100`);
  }
  assert.equal(status(494, 1000).label, "Available", "49.4% rounds to 49");
  assert.equal(status(895, 1000).label, "Full", "89.5% rounds to 90");
  assert.deepEqual(Object.keys(UTILIZATION_LEVELS), ["available", "partial", "full", "unknown"]);
  assert.match(status(60, 100).stroke, /^#/); assert.notEqual(status(60, 100).fill, status(10, 100).fill);
});

test("verified planted quantity is used when the backend provides it", () => {
  assert.equal(status(0, 100, { verifiedPlanted: 60 }).percent, 60);
  assert.equal(status(5, 100, { verifiedPlanted: 0 }).percent, 0, "a verified zero is still verified");
  assert.equal(status(30, 100).percent, 30, "older responses fall back to the stored count");
});

test("unknown or zero capacity is not reported as Available", () => {
  for (const capacity of [0, null, undefined, "", -5, "abc"]) {
    const result = status(20, capacity);
    assert.equal(result.known, false); assert.equal(result.percent, null); assert.equal(result.label, "Capacity not set"); assert.equal(result.level, "unknown");
  }
});

test("over-capacity stays red, is flagged, and shows the real percentage", () => {
  const result = status(130, 100);
  assert.deepEqual([result.level, result.overCapacity, result.percent, result.displayPercent], ["full", true, 130, 100]);
});
