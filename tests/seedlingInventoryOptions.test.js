import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateSeedlingQuantity,
  formatSeedlingTypeLabel,
  getSeedlingTypeKey,
  groupAvailableInventory,
  groupItemsForDisplay,
  groupRequestItemsBySeedlingType,
} from "../src/utils/seedlingInventoryOptions.js";

const batch = (id, species, quantity, extra = {}) => ({
  id,
  inventoryNumber: `INV-${id}`,
  species,
  scientificName: "Canarium ovatum",
  category: "Fruit",
  currentQuantity: quantity,
  ...extra,
});

const piliInventory = () => [batch("b2", "Pili", 1500), batch("b1", "Pili", 10)];

test("getSeedlingTypeKey trims, collapses whitespace and lowercases", () => {
  assert.equal(getSeedlingTypeKey("  Pili   Nut "), "pili nut");
  assert.equal(getSeedlingTypeKey(""), "");
  assert.equal(getSeedlingTypeKey(null), "");
  assert.equal(getSeedlingTypeKey(undefined), "");
});

test("Pili batches 10 + 1500 become one group totalling 1510", () => {
  const groups = groupAvailableInventory(piliInventory());
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "pili");
  assert.equal(groups[0].totalAvailable, 1510);
  assert.equal(formatSeedlingTypeLabel(groups[0]), "Pili — 1,510 available");
});

test("batches are sorted oldest-first by inventory number, tie-broken by id", () => {
  const groups = groupAvailableInventory([
    batch("c", "Pili", 1, { inventoryNumber: "INV-10" }),
    batch("b", "Pili", 2, { inventoryNumber: "INV-2" }),
    batch("a", "Pili", 3, { inventoryNumber: "INV-2" }),
    { id: "d", species: "Pili", batchReference: "INV-1", currentQuantity: 4 },
  ]);
  assert.deepEqual(groups[0].batches.map((x) => x.id), ["d", "a", "b", "c"]);
  assert.deepEqual(Object.keys(groups[0].batches[0]).sort(), [
    "availableQuantity", "batchReference", "id", "inventoryNumber",
  ]);
});

test("case and whitespace variants merge; first batch supplies species", () => {
  const groups = groupAvailableInventory([
    batch("b1", "Pili", 5),
    batch("b2", " pili ", 6),
    batch("b3", "PILI", 7),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].species, "Pili");
  assert.equal(groups[0].totalAvailable, 18);
});

test("species sharing a scientific name stay separate and are sorted by species", () => {
  const groups = groupAvailableInventory([
    batch("b1", "Ogob", 5, { scientificName: "Artocarpus camansi" }),
    batch("b2", "Kastanyas", 6, { scientificName: "Artocarpus camansi" }),
  ]);
  assert.deepEqual(groups.map((g) => g.species), ["Kastanyas", "Ogob"]);
});

test("ineligible batches are excluded and all-ineligible types omitted", () => {
  const groups = groupAvailableInventory([
    batch("z", "Zero", 0),
    batch("n", "Negative", -4),
    batch("x", "Nan", Number.NaN),
    batch("s", "", 10),
    batch("m", undefined, 10),
    batch("p1", "Pili", 0),
    batch("p2", "Pili", 3),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].totalAvailable, 3);
  assert.deepEqual(groups[0].batches.map((x) => x.id), ["p2"]);
});

test("currentQuantity falls back to availableQuantity", () => {
  const groups = groupAvailableInventory([
    { id: "a", species: "Narra", availableQuantity: 7 },
    { id: "b", species: "Narra", currentQuantity: 3, availableQuantity: 99 },
  ]);
  assert.equal(groups[0].totalAvailable, 10);
});

test("grouping does not mutate input and tolerates non-arrays", () => {
  const input = piliInventory();
  const snapshot = JSON.parse(JSON.stringify(input));
  groupAvailableInventory(input);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(groupAvailableInventory(null), []);
  assert.deepEqual(groupAvailableInventory({}), []);
});

const piliGroup = () => groupAvailableInventory(piliInventory())[0];

test("allocation that fits the oldest batch yields a single item", () => {
  assert.deepEqual(allocateSeedlingQuantity(piliGroup(), 4), [{ inventoryId: "b1", quantity: 4 }]);
});

test("allocation spills over batches in order", () => {
  assert.deepEqual(allocateSeedlingQuantity(piliGroup(), 25), [
    { inventoryId: "b1", quantity: 10 },
    { inventoryId: "b2", quantity: 15 },
  ]);
});

test("allocation of exactly the total works and respects batch limits", () => {
  const group = piliGroup();
  const items = allocateSeedlingQuantity(group, 1510);
  assert.equal(items.reduce((sum, x) => sum + x.quantity, 0), 1510);
  for (const item of items) {
    const source = group.batches.find((x) => x.id === item.inventoryId);
    assert.ok(item.quantity > 0 && item.quantity <= source.availableQuantity);
  }
  assert.equal(new Set(items.map((x) => x.inventoryId)).size, items.length);
});

test("allocation exactly filling the first batch omits later batches", () => {
  assert.deepEqual(allocateSeedlingQuantity(piliGroup(), 10), [{ inventoryId: "b1", quantity: 10 }]);
});

test("allocation rejects over-request, invalid quantities and missing group", () => {
  const group = piliGroup();
  for (const bad of [1511, 0, -1, 1.5, Number.NaN, "abc", undefined]) {
    assert.throws(() => allocateSeedlingQuantity(group, bad), Error);
  }
  assert.throws(() => allocateSeedlingQuantity(null, 1), Error);
});

test("allocation accepts numeric strings from form inputs", () => {
  assert.deepEqual(allocateSeedlingQuantity(piliGroup(), "3"), [{ inventoryId: "b1", quantity: 3 }]);
});

test("rehydration merges split items of the same species in first-seen order", () => {
  const rows = groupRequestItemsBySeedlingType(
    [
      { inventoryId: "b1", species: "Pili", quantity: 10 },
      { inventoryId: "n1", species: "Narra", quantity: 2 },
      { inventoryId: "b2", species: " pili ", quantity: 15 },
    ],
    [],
  );
  assert.deepEqual(rows, [
    { key: "pili", quantity: 25 },
    { key: "narra", quantity: 2 },
  ]);
});

test("rehydration falls back to inventory lookup and keeps unresolved as empty key", () => {
  const rows = groupRequestItemsBySeedlingType(
    [
      { inventoryId: "b1", quantity: 4 },
      { inventoryId: "gone", quantity: 3 },
    ],
    piliInventory(),
  );
  assert.deepEqual(rows, [
    { key: "pili", quantity: 4 },
    { key: "", quantity: 3 },
  ]);
  assert.deepEqual(groupRequestItemsBySeedlingType(null, null), []);
});

test("fractional batch stock is floored so allocation only emits whole items", () => {
  const groups = groupAvailableInventory([batch("b1", "Pili", 10.7), batch("b2", "Pili", 0.4)]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].totalAvailable, 10);
  assert.deepEqual(groups[0].batches.map((b) => [b.id, b.availableQuantity]), [["b1", 10]]);
  assert.deepEqual(allocateSeedlingQuantity(groups[0], 10), [{ inventoryId: "b1", quantity: 10 }]);
  assert.throws(() => allocateSeedlingQuantity(groups[0], 11), /exceeds the 10 available/);
});

test("display grouping shows one line per species with summed quantities", () => {
  const items = [
    { inventoryId: "b1", species: "Pili", quantity: 10 },
    { inventoryId: "n1", species: "Narra", quantity: 2 },
    { inventoryId: "b2", species: " pili ", quantity: 1500 },
  ];
  const snapshot = structuredClone(items);
  const rows = groupItemsForDisplay(items);
  assert.deepEqual(rows.map((row) => [row.species, row.quantity]), [["Pili", 1510], ["Narra", 2]]);
  assert.deepEqual(items, snapshot);
  assert.notEqual(rows[0], items[0]);
});

test("display grouping sums every listed quantity field and joins distinct reasons", () => {
  const rows = groupItemsForDisplay(
    [
      { inventoryId: "b1", species: "Pili", requestedQuantity: 10, releasedQuantity: 8, shortReleaseReason: "Damaged" },
      { inventoryId: "b2", species: "PILI", requestedQuantity: 1500, releasedQuantity: 1500 },
      { inventoryId: "b3", species: "Pili", requestedQuantity: 5, releasedQuantity: 4, shortReleaseReason: "Damaged" },
    ],
    ["requestedQuantity", "releasedQuantity"],
    ["shortReleaseReason"],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].requestedQuantity, 1515);
  assert.equal(rows[0].releasedQuantity, 1512);
  assert.equal(rows[0].shortReleaseReason, "Damaged");
});

test("display grouping falls back to tree names, keeps unnamed items separate and tolerates non-arrays", () => {
  const rows = groupItemsForDisplay([
    { treeName: "Narra", quantity: 1 },
    { name: "narra", quantity: "2" },
    { quantity: 3 },
    { quantity: 4 },
  ]);
  assert.deepEqual(rows.map((row) => row.quantity), [3, 3, 4]);
  assert.deepEqual(groupItemsForDisplay(null), []);
});
