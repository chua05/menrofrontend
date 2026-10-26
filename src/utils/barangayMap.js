// Display-only diagnostics: these polygons are not certified administrative boundaries.
export function boundaryLayerOptions(map) {
  const name = "menroBarangayBoundaries";
  const pane = map.getPane(name) || map.createPane(name);
  // Above tiles (200), below site coverage/markers (400+) regardless of fetch order.
  pane.style.zIndex = "350";
  pane.style.pointerEvents = "none";
  return { pane: name, interactive: false };
}

export function barangayName(feature) {
  const properties = feature?.properties || {};
  return String(properties.brgy_name || properties.NAME_3 || properties.ADM4_EN ||
    properties.adm4_en || properties.barangay || properties.name || properties.NAME || "");
}

const normalize = (name) => String(name ?? "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function ringLocation(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    // Include exact shared edges, but do not pick one administrative owner.
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) <= 1e-12 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx) &&
        y >= Math.min(ay, by) && y <= Math.max(ay, by)) return "edge";
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside ? "inside" : "outside";
}

export function geometryCoversPoint(geometry, point) {
  const [x, y] = point || [];
  if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return false;
  const polygons = geometry?.type === "Polygon" ? [geometry.coordinates] :
    geometry?.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.some((rings) => {
    if (!rings?.[0]?.length) return false;
    const outer = ringLocation(rings[0], x, y);
    if (outer === "outside") return false;
    return !rings.slice(1).some((hole) => ringLocation(hole, x, y) === "inside");
  });
}

export function siteBoundaryDiagnostic(data, selectedBarangay, latitude, longitude) {
  if (!Array.isArray(data?.features) || !data.features.length || !selectedBarangay ||
      latitude == null || longitude == null || String(latitude).trim() === "" ||
      String(longitude).trim() === "") return null;
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const matches = data.features.filter((feature) => geometryCoversPoint(feature.geometry, [lng, lat])).map(barangayName);
  const suffix = "Displayed boundaries are unverified. Confirm GPS and barangay with MENRO/LGU; no location or barangay has been changed.";
  if (!matches.length) return `This location is outside the displayed barangay dataset. ${suffix}`;
  if (matches.length > 1) return `This location touches or overlaps multiple displayed barangays (${matches.join(", ")}). ${suffix}`;
  if (normalize(matches[0]) !== normalize(selectedBarangay)) {
    return `Selected barangay: ${selectedBarangay}; displayed polygon: ${matches[0]}. ${suffix}`;
  }
  return null;
}
