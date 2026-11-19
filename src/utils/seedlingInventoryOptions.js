// Groups inventory batches into one entry per seedling type (species) and
// splits a requested quantity across the underlying batches, oldest first.

export function getSeedlingTypeKey(species) {
  return String(species ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getEligibleQuantity(batch) {
  const raw = Number(batch?.currentQuantity ?? batch?.availableQuantity ?? 0);
  // Floor fractional stock so allocation only ever emits whole-number items.
  const quantity = Number.isFinite(raw) ? Math.floor(raw) : 0;
  return quantity > 0 ? quantity : 0;
}

function getBatchOrderLabel(batch) {
  return String(batch.inventoryNumber || batch.batchReference || "");
}

function compareBatches(a, b) {
  return (
    getBatchOrderLabel(a).localeCompare(getBatchOrderLabel(b), undefined, { numeric: true }) ||
    String(a.id).localeCompare(String(b.id))
  );
}

export function groupAvailableInventory(inventory) {
  if (!Array.isArray(inventory)) return [];

  const groups = new Map();
  for (const item of inventory) {
    const key = getSeedlingTypeKey(item?.species);
    const quantity = getEligibleQuantity(item);
    if (!key || quantity <= 0) continue;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        species: item.species,
        scientificName: item.scientificName,
        category: item.category,
        totalAvailable: 0,
        batches: [],
      });
    }
    const group = groups.get(key);
    group.totalAvailable += quantity;
    group.batches.push({
      id: item.id,
      inventoryNumber: item.inventoryNumber,
      batchReference: item.batchReference,
      availableQuantity: quantity,
    });
  }

  return [...groups.values()]
    .map((group) => ({ ...group, batches: [...group.batches].sort(compareBatches) }))
    .sort((a, b) => String(a.species).localeCompare(String(b.species)));
}

export function formatSeedlingTypeLabel(group) {
  return `${group.species} — ${group.totalAvailable.toLocaleString("en-US")} available`;
}

export function allocateSeedlingQuantity(group, quantity) {
  const requested = Number(quantity);
  if (!group) throw new Error("Seedling type is required.");
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Quantity must be a whole number of at least 1.");
  }
  if (requested > group.totalAvailable) {
    throw new Error(`Quantity exceeds the ${group.totalAvailable} available.`);
  }

  const items = [];
  let remaining = requested;
  for (const batch of group.batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.availableQuantity);
    items.push({ inventoryId: batch.id, quantity: take });
    remaining -= take;
  }
  return items;
}

export function groupRequestItemsBySeedlingType(items, inventory) {
  if (!Array.isArray(items)) return [];
  const batches = Array.isArray(inventory) ? inventory : [];

  const rows = new Map();
  for (const item of items) {
    const species = item?.species || batches.find((batch) => batch.id === item?.inventoryId)?.species;
    const key = getSeedlingTypeKey(species);
    const quantity = Number(item?.quantity) || 0;
    rows.set(key, (rows.get(key) ?? 0) + quantity);
  }
  return [...rows].map(([key, quantity]) => ({ key, quantity }));
}

// Display-only: merges a request's per-batch items into one row per seedling type
// (species) so a requester sees "Pili 1510" rather than one line per batch. Each
// listed quantity field is summed; each listed text field keeps its distinct
// non-empty values joined by "; ". Items without a species name stay separate.
// The input items are never mutated.
export function groupItemsForDisplay(items, quantityFields = ["quantity"], textFields = []) {
  if (!Array.isArray(items)) return [];

  const rows = [];
  const rowsByKey = new Map();
  for (const item of items) {
    const key = getSeedlingTypeKey(item?.species || item?.treeName || item?.name);
    const existing = key ? rowsByKey.get(key) : undefined;

    if (!existing) {
      const row = { ...item };
      for (const field of quantityFields) {
        if (row[field] !== undefined && row[field] !== null && row[field] !== "") {
          row[field] = Number(row[field]) || 0;
        }
      }
      rows.push(row);
      if (key) rowsByKey.set(key, row);
      continue;
    }

    for (const field of quantityFields) {
      const value = item?.[field];
      if (value === undefined || value === null || value === "") continue;
      existing[field] = (Number(existing[field]) || 0) + (Number(value) || 0);
    }
    for (const field of textFields) {
      const value = String(item?.[field] ?? "").trim();
      if (!value) continue;
      const current = String(existing[field] ?? "").trim();
      const parts = current ? current.split("; ") : [];
      if (!parts.includes(value)) existing[field] = [...parts, value].join("; ");
    }
  }
  return rows;
}
