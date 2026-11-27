// Registered planting sites on any MENRO map: the saved coverage radius (or, for older sites, the saved polygon) as a
// transparent overlay coloured by utilization, and the blue site-center marker on top. Nothing is drawn from made-up
// geometry: a site without a saved radius or polygon gets only its center marker.
import L from "leaflet";
import { siteUtilization } from "../../utils/siteUtilization";
import { textTooltip } from "../../utils/leafletTooltip";

export const SITE_CENTER_COLOR = "#3186d9";

const coordinate = (value) => (value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null);

// Saved polygon points as [lat, lng], whichever of the stored shapes a site uses.
export function sitePolygonPoints(site) {
  const raw = Array.isArray(site?.polygon) ? site.polygon : Array.isArray(site?.boundary) ? site.boundary : [];
  const points = raw.map((point) => (Array.isArray(point)
    ? [coordinate(point[0]), coordinate(point[1])]
    : [coordinate(point?.lat ?? point?.latitude), coordinate(point?.lng ?? point?.longitude)]))
    .filter(([lat, lng]) => lat !== null && lng !== null);
  return points.length >= 3 ? points : [];
}

export function siteCenter(site) {
  const latitude = coordinate(site?.latitude), longitude = coordinate(site?.longitude);
  return latitude === null || longitude === null ? null : [latitude, longitude];
}

// Overlay style: the utilization colour fills the area and draws its outline.
export function siteOverlayStyle(site) {
  const utilization = siteUtilization(site);
  return { color: utilization.stroke, opacity: 0.95, weight: 2, fillColor: utilization.fill, fillOpacity: 0.24 };
}

// Draws one site into `layer`. Returns the drawn overlay (or null), the center marker (or null) and the utilization.
export function drawSiteOverlay(layer, site, { onSelect, label } = {}) {
  const utilization = siteUtilization(site);
  const center = siteCenter(site);
  const radius = coordinate(site?.coverageRadiusMeters);
  const style = siteOverlayStyle(site);
  let overlay = null;
  if (center && radius !== null && radius > 0) overlay = L.circle(center, { ...style, radius });
  else {
    const points = sitePolygonPoints(site);
    if (points.length) overlay = L.polygon(points, style);
  }
  if (overlay) {
    overlay.addTo(layer);
    if (onSelect) overlay.on("click", () => onSelect(site));
  }
  let marker = null;
  if (center) {
    marker = L.circleMarker(center, { radius: 7, color: "#ffffff", weight: 2, fillColor: SITE_CENTER_COLOR, fillOpacity: 1 })
      .bindTooltip(textTooltip(label || site?.siteName || site?.name || site?.siteId || "Planting Site"), { direction: "top", offset: [0, -6] })
      .addTo(layer);
    if (onSelect) marker.on("click", () => onSelect(site));
  }
  return { overlay, marker, utilization };
}
