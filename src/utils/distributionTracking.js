// Distribution Records tracking: per-batch allocation rows, filters and totals.
// Only real distribution/allocation data is used; missing batch data is labelled, never invented.
import { buildSearchIndex, matchesSearch, normalizeSearchText } from "./recordSearch.js";
import { normalizeTimestamp } from "./timestampValues.js";

export const BATCH_UNAVAILABLE_LABEL = "Batch record unavailable";
export const NOT_RECORDED_LABEL = "Not recorded";
export const EMPTY_DISTRIBUTION_FILTERS = Object.freeze({ search: "", seedlingType: "", sourceType: "", dateReleased: "", location: "" });

const text = (value) => (value === null || value === undefined ? "" : String(value).trim());
const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function toIso(value) {
  if (!value) return "";
  const date = normalizeTimestamp(value);
  if (date) return date.toISOString();
  return typeof value === "string" ? value : "";
}

function normalizeItem(item) {
  return {
    ...item,
    species: item.species || item.treeName || "Unnamed seedling",
    quantity: toNumber(item.releasedQuantity ?? item.quantityReleased ?? item.quantity ?? 0),
  };
}

/** Normalises a distribution from GET /distributions. Legacy single-item records (top-level inventoryId/species/quantity, no items) become one item without allocation. */
export function normalizeDistribution(record = {}) {
  let items = Array.isArray(record.items) ? record.items.map(normalizeItem) : [];
  if (items.length === 0 && (record.inventoryId || record.species)) {
    items = [normalizeItem({
      inventoryId: record.inventoryId || "",
      species: record.species || "",
      scientificName: record.scientificName || "",
      category: record.category || "",
      releasedQuantity: record.quantityReleased ?? record.quantity ?? record.totalQuantityReleased ?? 0,
    })];
  }
  return {
    ...record,
    id: record.id || "",
    distributionNumber: record.distributionNumber || record.id || "",
    requestNumber: record.requestNumber || record.requestId || "",
    participantName: record.participantName || record.organization || "—",
    items,
    totalQuantityReleased: toNumber(record.totalQuantityReleased || items.reduce((total, item) => total + item.quantity, 0)),
    releasedAt: toIso(record.releasedAt),
    releasedByName: text(record.releasedByName),
    status: record.status || "Released",
  };
}

const pad = (n) => String(n).padStart(2, "0");

/** YYYY-MM-DD of the release in the browser's local calendar, i.e. the same day the table displays (formatDateTime). */
export function releaseDateKey(value) {
  const date = value ? normalizeTimestamp(value) : null;
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Planting location text only: the raw plantingSiteId (a site doc id or "PROPOSED") is never shown, offered or indexed here.
function destinationOf(distribution) {
  return text(distribution.plantingLocation);
}

function allocationRow(distribution, item, index) {
  const allocation = item.allocation && typeof item.allocation === "object" ? item.allocation : null;
  const basis = allocation?.basis || "unavailable";
  const recordFound = Boolean(allocation) && basis !== "unavailable" && allocation.recordFound !== false;
  const pick = (key) => (recordFound ? text(allocation[key]) : "");
  const batchReference = pick("batchReference");
  const inventoryNumber = pick("inventoryNumber");
  const sourceType = pick("sourceType");
  const sourceSpecification = pick("sourceSpecification");
  const dateReceived = pick("dateReceived");
  const row = {
    key: `${distribution.id}-${index}`,
    distributionId: distribution.id,
    distributionNumber: distribution.distributionNumber || distribution.id || "",
    requestNumber: distribution.requestNumber || "",
    recipient: distribution.participantName || "—",
    organization: text(distribution.organization),
    barangay: text(distribution.barangay),
    destination: destinationOf(distribution),
    releasedAt: distribution.releasedAt || "",
    releasedBy: text(distribution.releasedByName) || "—",
    status: distribution.status || "Released",
    inventoryId: text(allocation?.inventoryId) || text(item.inventoryId),
    species: item.species || "Unnamed seedling",
    quantity: toNumber(item.quantity ?? item.releasedQuantity),
    basis: recordFound ? basis : "unavailable",
    recordFound,
    batchReference,
    inventoryNumber,
    batchLabel: batchReference || inventoryNumber || (recordFound ? "—" : BATCH_UNAVAILABLE_LABEL),
    sourceType,
    sourceSpecification,
    sourceLabel: sourceType ? (sourceSpecification ? `${sourceType} — ${sourceSpecification}` : sourceType) : NOT_RECORDED_LABEL,
    dateReceived,
    dateReceivedLabel: dateReceived || NOT_RECORDED_LABEL,
  };
  row.searchIndex = buildSearchIndex([
    row.distributionNumber, row.requestNumber, row.recipient, row.organization, row.barangay, row.destination,
    row.species, item.scientificName, item.category, row.quantity, row.batchLabel, row.inventoryNumber,
    row.sourceLabel, row.dateReceivedLabel, row.dateReceived, row.releasedBy, row.status, row.releasedAt,
    releaseDateKey(row.releasedAt),
  ]);
  return row;
}

/** One row per released batch allocation (item); a multi-batch distribution keeps its Distribution ID on every row. */
export function distributionAllocationRows(distributions) {
  return (distributions || []).flatMap((record) => {
    if (record.allocationRows) return record.allocationRows;
    const distribution = normalizeDistribution(record);
    return distribution.items.map((item, index) => allocationRow(distribution, item, index));
  });
}

export function buildDistributionSearchIndex(distribution, rows = distributionAllocationRows([distribution])) {
  return [
    buildSearchIndex([distribution.distributionNumber, distribution.requestNumber, distribution.participantName, distribution.organization,
      distribution.barangay, distribution.plantingLocation, distribution.totalQuantityReleased, distribution.releasedByName,
      distribution.status, distribution.releasedAt, releaseDateKey(distribution.releasedAt)]),
    ...rows.map((row) => row.searchIndex),
  ].filter(Boolean).join(" | ");
}

/** Normalise once per data load: attaches allocationRows and a prebuilt searchIndex to every distribution. */
export function prepareDistributions(distributions) {
  return (distributions || []).map((record) => {
    const distribution = normalizeDistribution(record);
    const allocationRows = distribution.items.map((item, index) => allocationRow(distribution, item, index));
    return { ...distribution, allocationRows, searchIndex: buildDistributionSearchIndex(distribution, allocationRows) };
  });
}

const same = (a, b) => normalizeSearchText(a) === normalizeSearchText(b);

function matchesLocation(record, location) {
  if (!location) return true;
  const [kind, ...rest] = String(location).split(":");
  const value = rest.join(":");
  if (kind === "barangay") return same(record.barangay, value);
  if (kind === "site") return same(record.destination ?? destinationOf(record), value);
  return true;
}

function matchesItemFilters(row, filters) {
  if (filters.seedlingType && !same(row.species, filters.seedlingType)) return false;
  if (filters.sourceType) {
    if (filters.sourceType === NOT_RECORDED_LABEL) return !row.sourceType;
    if (!same(row.sourceType, filters.sourceType)) return false;
  }
  return true;
}

const hasItemFilters = (filters) => Boolean(filters.seedlingType || filters.sourceType);

/** All Transactions: whole distributions; seedling/source filters keep a distribution when any of its allocations matches. */
export function filterDistributions(distributions, filters = EMPTY_DISTRIBUTION_FILTERS) {
  return (distributions || []).filter((distribution) => {
    if (filters.dateReleased && releaseDateKey(distribution.releasedAt) !== filters.dateReleased) return false;
    if (!matchesLocation(distribution, filters.location)) return false;
    const rows = distribution.allocationRows || distributionAllocationRows([distribution]);
    if (hasItemFilters(filters) && !rows.some((row) => matchesItemFilters(row, filters))) return false;
    if (filters.search) return matchesSearch(distribution.searchIndex ?? buildDistributionSearchIndex(distribution, rows), filters.search);
    return true;
  });
}

/** By Inventory Batch: individual allocation rows. */
export function filterAllocationRows(rows, filters = EMPTY_DISTRIBUTION_FILTERS) {
  return (rows || []).filter((row) =>
    (!filters.dateReleased || releaseDateKey(row.releasedAt) === filters.dateReleased) &&
    matchesLocation(row, filters.location) &&
    matchesItemFilters(row, filters) &&
    (!filters.search || matchesSearch(row.searchIndex, filters.search)));
}

export function allocationTotals(rows) {
  return {
    allocations: rows.length,
    transactions: new Set(rows.map((row) => row.distributionId)).size,
    quantity: rows.reduce((total, row) => total + row.quantity, 0),
  };
}

/** Totals for All Transactions; with a seedling/source filter only the matching allocations are counted. */
export function distributionTotals(distributions, filters = EMPTY_DISTRIBUTION_FILTERS) {
  const quantity = distributions.reduce((total, distribution) => {
    if (!hasItemFilters(filters)) return total + toNumber(distribution.totalQuantityReleased);
    const rows = distribution.allocationRows || distributionAllocationRows([distribution]);
    return total + rows.filter((row) => matchesItemFilters(row, filters)).reduce((sum, row) => sum + row.quantity, 0);
  }, 0);
  return { transactions: distributions.length, quantity };
}

const sortedUnique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

export function distributionFilterOptions(rows) {
  const sourceTypes = sortedUnique(rows.map((row) => row.sourceType));
  if (rows.some((row) => !row.sourceType)) sourceTypes.push(NOT_RECORDED_LABEL);
  return {
    seedlingTypes: sortedUnique(rows.map((row) => row.species)),
    sourceTypes,
    locations: [
      ...sortedUnique(rows.map((row) => row.barangay)).map((value) => ({ value: `barangay:${value}`, label: value, group: "Barangay" })),
      ...sortedUnique(rows.map((row) => row.destination)).map((value) => ({ value: `site:${value}`, label: value, group: "Planting Site" })),
    ],
  };
}

export function hasActiveDistributionFilters(filters) {
  return Object.keys(EMPTY_DISTRIBUTION_FILTERS).some((key) => text(filters?.[key]));
}
