// Site utilization: verified planted quantity ÷ approved maximum capacity. One calculation and one colour set for every
// map that draws registered planting sites. The colour applies to a site's coverage overlay and outline, never to its
// blue site-center marker or to tree markers.

export const UTILIZATION_LEVELS = {
  available: { label: "Available", range: "0–49%", fill: "#4caf63", stroke: "#2f9847" },
  partial: { label: "Partially Occupied", range: "50–89%", fill: "#f59e0b", stroke: "#d97706" },
  full: { label: "Full", range: "90–100%", fill: "#ef4444", stroke: "#d72f2f" },
  // No approved capacity: a percentage would be invented, so the overlay is neutral.
  unknown: { label: "Capacity not set", range: "", fill: "#94a3b8", stroke: "#64748b" },
};

// Utilization levels in legend order, with their ranges.
export const UTILIZATION_LEGEND = ["available", "partial", "full", "unknown"].map((level) => ({ level, ...UTILIZATION_LEVELS[level] }));

const finite = (value) => (value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null);

// The backend's verified planted total when present (sites list), otherwise the stored count of older responses.
export function plantedOf(site) {
  const verified = finite(site?.verifiedPlanted);
  if (verified !== null) return Math.max(0, verified);
  return Math.max(0, finite(site?.planted) ?? 0);
}

export function utilizationLevel(percent) {
  if (percent === null) return "unknown";
  if (percent >= 90) return "full";
  if (percent >= 50) return "partial";
  return "available";
}

export function siteUtilization(site) {
  const capacity = finite(site?.maximumCapacity);
  const planted = plantedOf(site);
  const known = capacity !== null && capacity > 0;
  const percent = known ? Math.round((planted / capacity) * 100) : null;
  const level = utilizationLevel(percent);
  return {
    planted, capacity: known ? capacity : null, known, percent,
    // Shown on the map; the real figure stays in `percent` so over-capacity is not hidden.
    displayPercent: percent === null ? null : Math.min(100, percent),
    overCapacity: known && planted > capacity,
    level, ...UTILIZATION_LEVELS[level],
  };
}
