// Seedling Inventory search: one prebuilt index per record, filtered before pagination.
import { buildSearchIndex, matchesSearch } from "./recordSearch.js";
import { STOCK_STATUS, stockStatusForRecord } from "./stockStatus.js";

const KNOWN_STATUSES = new Set(Object.values(STOCK_STATUS));
const has = (record, key) => record && Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined;

/** Stock status for display: the server's calculated status when present, otherwise the shared 30% rule. */
export function inventoryStockStatus(record) {
  const local = stockStatusForRecord(record);
  const serverStatus = KNOWN_STATUSES.has(record?.stockStatus) ? record.stockStatus
    : KNOWN_STATUSES.has(record?.status) && has(record, "remainingStockPercent") ? record.status : "";
  if (!serverStatus) return local;
  return {
    status: serverStatus,
    currentQuantity: local.currentQuantity,
    totalReceivedQuantity: has(record, "totalReceivedQuantity") ? record.totalReceivedQuantity : local.totalReceivedQuantity,
    remainingPercent: has(record, "remainingStockPercent") ? record.remainingStockPercent : local.remainingPercent,
    baselineIssue: has(record, "stockBaselineIssue") ? record.stockBaselineIssue : local.baselineIssue,
  };
}

export function buildInventorySearchIndex(record) {
  return buildSearchIndex([
    record.id, record.batchReference, record.inventoryNumber, record.treeName, record.scientificName,
    record.category, record.categorySpecification, record.currentQuantity, record.totalReceivedQuantity,
    record.status, record.sourceType, record.sourceSpecification, record.storageLocation,
    record.storageLocationSpecification, record.dateReceived, record.description,
  ]);
}

export function indexInventoryRecords(records) {
  return (records || []).map((record) => ({ record, index: buildInventorySearchIndex(record) }));
}

export function filterInventoryRecords(indexed, { search = "", treeName = "", status = "" } = {}) {
  return (indexed || [])
    .filter(({ record, index }) =>
      (!treeName || record.treeName === treeName) &&
      (!status || record.status === status) &&
      matchesSearch(index, search))
    .map(({ record }) => record);
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "";
  return `${Math.round(Number(value) * 10) / 10}%`;
}

/** Read-only explanation shown next to the automatic status. Baseline warnings only accompany Needs Review. */
export function stockStatusNote(record) {
  if (record?.status === STOCK_STATUS.NEEDS_REVIEW) {
    return record.stockBaselineIssue || "Total received quantity is missing or invalid.";
  }
  const percent = formatPercent(record?.remainingStockPercent);
  const total = Number(record?.totalReceivedQuantity);
  if (!percent || !(total > 0)) return "";
  return `${percent} of ${total.toLocaleString("en-US")} received remaining`;
}
