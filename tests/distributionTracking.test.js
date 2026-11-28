import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import {
  BATCH_UNAVAILABLE_LABEL,
  EMPTY_DISTRIBUTION_FILTERS,
  NOT_RECORDED_LABEL,
  allocationTotals,
  distributionAllocationRows,
  distributionFilterOptions,
  distributionTotals,
  filterAllocationRows,
  filterDistributions,
  normalizeDistribution,
  prepareDistributions,
  releaseDateKey,
} from "../src/utils/distributionTracking.js";

const allocation = (overrides) => ({
  inventoryId: "inv-1", batchReference: "BAT-2026-003", inventoryNumber: "INV-003", sourceType: "Donation",
  sourceSpecification: "", dateReceived: "2026-10-12", basis: "release", liveRecordFound: true, recordFound: true, ...overrides,
});

const multiBatch = {
  id: "dist-1", distributionNumber: "DIST-2026-001", requestNumber: "REQ-2026-001", participantName: "Juan Dela Cruz",
  organization: "Bulan Youth", barangay: "Bical", plantingLocation: "Bical Riverside", releasedAt: "2026-11-02T02:00:00.000Z",
  releasedBy: "uid-secret-123", releasedByName: "Maria Staff", status: "Released", totalQuantityReleased: 150,
  items: [
    { inventoryId: "inv-1", species: "Kalamansi", releasedQuantity: 100, quantity: 100, allocation: allocation() },
    { inventoryId: "inv-2", species: "Kalamansi", releasedQuantity: 50, quantity: 50,
      allocation: allocation({ inventoryId: "inv-2", batchReference: "BAT-2026-007", inventoryNumber: "INV-007", sourceType: "MENRO Propagation", dateReceived: "2026-09-01", basis: "current-record" }) },
  ],
};

const narra = {
  id: "dist-2", distributionNumber: "DIST-2026-002", requestNumber: "REQ-2026-002", participantName: "Ana Reyes",
  barangay: "Zone 1", plantingLocation: "Zone 1 Park", releasedAt: "2026-11-05T03:00:00.000Z", releasedByName: "",
  releasedBy: "uid-other", status: "Released", totalQuantityReleased: 30,
  items: [{ inventoryId: "gone", species: "Narra", releasedQuantity: 30, quantity: 30,
    allocation: allocation({ inventoryId: "gone", batchReference: "", inventoryNumber: "", sourceType: "", dateReceived: "", basis: "unavailable", liveRecordFound: false, recordFound: false }) }],
};

const legacy = {
  id: "dist-3", requestNumber: "REQ-2025-010", participantName: "Old Record", barangay: "Bical", inventoryId: "inv-legacy",
  species: "Mahogany", scientificName: "Swietenia macrophylla", category: "Hardwood", quantity: 20,
  releasedAt: { _seconds: Date.parse("2025-05-01T00:00:00.000Z") / 1000 }, status: "Released",
  batchAllocations: [{ inventoryId: "inv-legacy", itemIndex: 0, batchReference: "BAT-RAW-IGNORED", sourceType: "Donation" }],
};

const prepared = prepareDistributions([multiBatch, narra, legacy]);
const rows = prepared.flatMap((distribution) => distribution.allocationRows);
const filters = (overrides) => ({ ...EMPTY_DISTRIBUTION_FILTERS, ...overrides });

test("a multi-batch distribution yields one row per batch under the same Distribution ID, totals unchanged", () => {
  const multiRows = distributionAllocationRows([multiBatch]);
  assert.equal(multiRows.length, 2);
  assert.deepEqual(multiRows.map((row) => row.distributionNumber), ["DIST-2026-001", "DIST-2026-001"]);
  assert.deepEqual(multiRows.map((row) => row.batchReference), ["BAT-2026-003", "BAT-2026-007"]);
  assert.deepEqual(multiRows.map((row) => row.quantity), [100, 50]);
  assert.deepEqual(allocationTotals(multiRows), { allocations: 2, transactions: 1, quantity: 150 });
  assert.deepEqual(distributionTotals(filterDistributions(prepared, filters({})), filters({})), { transactions: 3, quantity: 200 });
});

test("allocation rows carry source, dates, recipient, destination and released-by name but never the UID", () => {
  const [first, second] = distributionAllocationRows([multiBatch]);
  assert.equal(first.sourceType, "Donation");
  assert.equal(first.dateReceived, "2026-10-12");
  assert.equal(first.recipient, "Juan Dela Cruz");
  assert.equal(first.destination, "Bical Riverside");
  assert.equal(first.releasedBy, "Maria Staff");
  assert.equal(first.basis, "release");
  assert.equal(second.basis, "current-record");
  assert.ok(!first.searchIndex.includes("uid-secret-123"));
  assert.equal(distributionAllocationRows([narra])[0].releasedBy, "—");
});

test("missing or unavailable batch data is labelled, never invented", () => {
  const [missing] = distributionAllocationRows([narra]);
  assert.equal(missing.recordFound, false);
  assert.equal(missing.batchLabel, BATCH_UNAVAILABLE_LABEL);
  assert.equal(missing.sourceType, "");
  assert.equal(missing.sourceLabel, NOT_RECORDED_LABEL);
  assert.equal(missing.dateReceivedLabel, NOT_RECORDED_LABEL);

  const legacyRows = distributionAllocationRows([legacy]);
  assert.equal(legacyRows.length, 1);
  assert.equal(legacyRows[0].species, "Mahogany");
  assert.equal(legacyRows[0].quantity, 20);
  assert.equal(legacyRows[0].batchLabel, BATCH_UNAVAILABLE_LABEL);
  assert.equal(legacyRows[0].sourceLabel, NOT_RECORDED_LABEL);
  assert.equal(legacyRows[0].basis, "unavailable");

  const noAllocation = distributionAllocationRows([{ ...multiBatch, items: [{ inventoryId: "inv-1", species: "Kalamansi", releasedQuantity: 5 }] }]);
  assert.equal(noAllocation[0].batchLabel, BATCH_UNAVAILABLE_LABEL);
  assert.equal(noAllocation[0].batchReference, "");
});

test("legacy single-item distributions become one item with no allocation and keep their totals", () => {
  const normalized = normalizeDistribution(legacy);
  assert.equal(normalized.items.length, 1);
  assert.deepEqual(
    { inventoryId: normalized.items[0].inventoryId, species: normalized.items[0].species, scientificName: normalized.items[0].scientificName,
      category: normalized.items[0].category, quantity: normalized.items[0].quantity, allocation: normalized.items[0].allocation },
    { inventoryId: "inv-legacy", species: "Mahogany", scientificName: "Swietenia macrophylla", category: "Hardwood", quantity: 20, allocation: undefined },
  );
  assert.equal(normalized.totalQuantityReleased, 20);
  assert.equal(normalized.releasedAt, "2025-05-01T00:00:00.000Z");
  assert.equal(normalize(normalized).items.length, 1, "idempotent");
  const legacyRow = rows.find((row) => row.distributionId === "dist-3");
  assert.equal(legacyRow.batchReference, "", "raw batchAllocations are ignored");
  assert.equal(legacyRow.sourceType, "");
  assert.deepEqual(filterAllocationRows(rows, filters({ seedlingType: "Mahogany" })).map((row) => row.quantity), [20]);
  assert.deepEqual(normalizeDistribution({ id: "x", status: "Released" }).items, []);
});

const normalize = normalizeDistribution;

test("source type filter counts only matching batch allocations", () => {
  const donation = filters({ sourceType: "Donation" });
  const matched = filterAllocationRows(rows, donation);
  assert.deepEqual(matched.map((row) => row.batchReference), ["BAT-2026-003"]);
  assert.deepEqual(allocationTotals(matched), { allocations: 1, transactions: 1, quantity: 100 });

  const transactions = filterDistributions(prepared, donation);
  assert.deepEqual(transactions.map((d) => d.id), ["dist-1"]);
  assert.deepEqual(distributionTotals(transactions, donation), { transactions: 1, quantity: 100 });

  const notRecorded = filterAllocationRows(rows, filters({ sourceType: NOT_RECORDED_LABEL }));
  assert.deepEqual(notRecorded.map((row) => row.distributionId), ["dist-2", "dist-3"]);
});

test("filters combine: seedling type, date released, location and search", () => {
  assert.deepEqual(filterAllocationRows(rows, filters({ seedlingType: "Kalamansi", sourceType: "MENRO Propagation" })).map((r) => r.batchReference), ["BAT-2026-007"]);
  assert.deepEqual(filterAllocationRows(rows, filters({ seedlingType: "Kalamansi", sourceType: "MENRO Propagation", dateReleased: "2026-11-05" })), []);
  assert.deepEqual(filterDistributions(prepared, filters({ dateReleased: "2026-11-02" })).map((d) => d.id), ["dist-1"]);
  assert.deepEqual(filterDistributions(prepared, filters({ location: "barangay:Bical" })).map((d) => d.id), ["dist-1", "dist-3"]);
  assert.deepEqual(filterDistributions(prepared, filters({ location: "site:Zone 1 Park" })).map((d) => d.id), ["dist-2"]);
  assert.deepEqual(filterDistributions(prepared, filters({ location: "barangay:Bical", seedlingType: "Mahogany" })).map((d) => d.id), ["dist-3"]);
});

test("search covers distribution, request, recipient, batch, source, released-by, quantity and release-date formats", () => {
  const ids = (query) => filterDistributions(prepared, filters({ search: query })).map((d) => d.id);
  assert.deepEqual(ids("DIST-2026-002"), ["dist-2"]);
  assert.deepEqual(ids("req-2026-001"), ["dist-1"]);
  assert.deepEqual(ids("bat-2026-007"), ["dist-1"]);
  assert.deepEqual(ids("donation"), ["dist-1"]);
  assert.deepEqual(ids("maria staff"), ["dist-1"]);
  assert.deepEqual(ids("Nov 5, 2026"), ["dist-2"]);
  assert.deepEqual(ids("11/02/2026"), ["dist-1"]);
  assert.deepEqual(ids("  ANA   reyes "), ["dist-2"]);
  assert.deepEqual(ids("uid-secret-123"), []);
  assert.deepEqual(ids("batch record unavailable"), ["dist-2", "dist-3"]);
  assert.deepEqual(filterAllocationRows(rows, filters({ search: "bat-2026-003" })).map((r) => r.inventoryId), ["inv-1"]);
  assert.deepEqual(filterAllocationRows(rows, filters({ search: "kalamansi 50" })).map((r) => r.inventoryId), ["inv-2"]);
});

test("release dates use the displayed (local) calendar day and filter options come from real records", () => {
  const shown = new Date("2026-11-01T17:00:00.000Z");
  const pad = (n) => String(n).padStart(2, "0");
  assert.equal(releaseDateKey("2026-11-01T17:00:00.000Z"), `${shown.getFullYear()}-${pad(shown.getMonth() + 1)}-${pad(shown.getDate())}`);
  assert.equal(releaseDateKey(""), "");
  const options = distributionFilterOptions(rows);
  assert.deepEqual(options.seedlingTypes, ["Kalamansi", "Mahogany", "Narra"]);
  assert.deepEqual(options.sourceTypes, ["Donation", "MENRO Propagation", NOT_RECORDED_LABEL]);
  assert.deepEqual(options.locations.map((o) => o.value), ["barangay:Bical", "barangay:Zone 1", "site:Bical Riverside", "site:Zone 1 Park"]);
});

test("Date Released filter uses the same local calendar date the table displays", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "UTC";
    const release = { ...narra, id: "late", releasedAt: "2026-11-01T17:00:00.000Z" };
    assert.equal(new Date(release.releasedAt).getDate(), 1, "UTC browser shows Nov 1");
    assert.equal(releaseDateKey(release.releasedAt), "2026-11-01");
    const late = prepareDistributions([release]);
    assert.deepEqual(filterDistributions(late, filters({ dateReleased: "2026-11-01" })).map((d) => d.id), ["late"]);
    assert.deepEqual(filterDistributions(late, filters({ dateReleased: "2026-11-02" })), []);
    assert.equal(filterAllocationRows(late[0].allocationRows, filters({ dateReleased: "2026-11-01" })).length, 1);
    assert.deepEqual(filterDistributions(late, filters({ search: "Nov 1, 2026" })).map((d) => d.id), ["late"]);
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});

test("raw plantingSiteId is never used as a destination, filter option or search term in batch tracking", () => {
  const siteOnly = { ...narra, id: "site-only", plantingLocation: "", plantingSiteId: "aB3xYsecretSiteDoc" };
  const [prepared1] = prepareDistributions([siteOnly]);
  const [row] = prepared1.allocationRows;
  assert.equal(row.destination, "");
  assert.ok(!row.searchIndex.includes("ab3xysecretsitedoc"));
  assert.ok(!prepared1.searchIndex.includes("ab3xysecretsitedoc"));
  assert.ok(!distributionFilterOptions([row]).locations.some((option) => option.label.includes("aB3xY")));
  assert.deepEqual(distributionFilterOptions([row]).locations.map((o) => o.value), ["barangay:Zone 1"]);
});
