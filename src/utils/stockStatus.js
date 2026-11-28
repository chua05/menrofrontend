// Port of the backend src/utils/stockStatus.util.js (the authority); keep the two identical.
export const STOCK_STATUS = Object.freeze({
  AVAILABLE: "Available",
  LIMITED: "Limited",
  OUT_OF_STOCK: "Out of Stock",
  NEEDS_REVIEW: "Needs Review",
});

export const LIMITED_THRESHOLD_PERCENT = 30;

const isPositiveInteger = (value) =>
  value !== null && value !== undefined && value !== "" &&
  Number.isInteger(Number(value)) && Number(value) > 0;

export function resolveReceivedBaseline(record) {
  if (!record) return null;
  if (isPositiveInteger(record.totalReceivedQuantity)) return Number(record.totalReceivedQuantity);
  if (isPositiveInteger(record.initialQuantity) && !(Number(record.replenishmentCycle) > 0)) {
    // Restocks pre-date replenishmentCycle tracking, so only trust the initial quantity when stock reconciles.
    const part = (value) => (value === null || value === undefined || value === "" ? 0 : Number(value));
    const current = record.currentQuantity ?? record.availableQuantity;
    const parts = [current, record.distributedQuantity, record.reservedQuantity].map(part);
    // Like the backend: a record with no current/available quantity at all cannot prove its baseline.
    if (current !== null && current !== undefined && parts.every((n) => Number.isInteger(n) && n >= 0) && parts[0] + parts[1] + parts[2] === Number(record.initialQuantity)) {
      return Number(record.initialQuantity);
    }
  }
  return null;
}

export function calculateStockStatus(currentQuantity, totalReceived) {
  const current = Number(currentQuantity ?? 0);
  if (!(current > 0)) return STOCK_STATUS.OUT_OF_STOCK;
  if (!isPositiveInteger(totalReceived)) return STOCK_STATUS.NEEDS_REVIEW;
  const total = Number(totalReceived);
  if (current > total) return STOCK_STATUS.NEEDS_REVIEW;
  return current * 100 <= total * LIMITED_THRESHOLD_PERCENT ? STOCK_STATUS.LIMITED : STOCK_STATUS.AVAILABLE;
}

export function stockStatusForRecord(record) {
  const current = Number(record?.currentQuantity ?? record?.availableQuantity ?? 0);
  const baseline = resolveReceivedBaseline(record);
  const status = calculateStockStatus(current, baseline);
  let baselineIssue = null;
  if (baseline === null) {
    baselineIssue = "Total received quantity is missing or invalid.";
  } else if (current > baseline) {
    baselineIssue = "Current quantity exceeds total received quantity.";
  }
  return {
    status,
    currentQuantity: current,
    totalReceivedQuantity: baseline,
    remainingPercent: baseline === null ? null : (current / baseline) * 100,
    baselineIssue,
  };
}
