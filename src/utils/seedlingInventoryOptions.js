// UNCONFIRMED BUSINESS RULE (pending MENRO client approval): when a requester asks for a combined seedling type, the quantity is split across that type's eligible inventory records oldest-first (by inventoryNumber/batchReference). This ordering was introduced as an interim measure so request submission keeps working with the existing per-inventory-record request lines; it is not an approved allocation policy. Do not extend or rely on it until confirmed.
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

// UNCONFIRMED BUSINESS RULE (pending MENRO client approval): when a requester asks for a combined seedling type, the quantity is split across that type's eligible inventory records oldest-first (by inventoryNumber/batchReference). This ordering was introduced as an interim measure so request submission keeps working with the existing per-inventory-record request lines; it is not an approved allocation policy. Do not extend or rely on it until confirmed.
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
