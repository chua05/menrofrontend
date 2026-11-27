// One basemap for MENRO's Leaflet maps. Every map's zoom range stays inside what its tile layer can draw, so zooming in
// (with the + control, "Zoom to monitored trees" or a grouped tree marker) never leaves a blank gray map.
import L from "leaflet";

// Deepest map zoom. Close enough to separate trees planted a few metres apart.
export const MAP_MAX_ZOOM = 19;

const MAPTILER_ATTRIBUTION = '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
// A source with this many failed tiles is treated as unavailable and replaced by OpenStreetMap.
const FAILED_TILE_LIMIT = 4;

// maxZoom is what the layer may be shown at; maxNativeZoom is the deepest tile the source actually serves. Beyond it Leaflet
// enlarges the deepest real tiles instead of removing them (which is what turned the map gray).
export function basemapOptions(source) {
  if (source === "maptiler") {
    // 512 px tiles requested one level up (zoomOffset -1): map zoom 19 asks MapTiler for z18.
    return { tileSize: 512, zoomOffset: -1, minZoom: 1, maxNativeZoom: MAP_MAX_ZOOM, maxZoom: MAP_MAX_ZOOM + 1, crossOrigin: true, attribution: MAPTILER_ATTRIBUTION };
  }
  // tile.openstreetmap.org serves up to z19.
  return { maxNativeZoom: 19, maxZoom: MAP_MAX_ZOOM + 1, attribution: OSM_ATTRIBUTION };
}

const osmLayer = () => L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", basemapOptions("osm"));

// Adds the basemap and returns it. MapTiler when a key is configured, otherwise (or when its tiles keep failing) OpenStreetMap.
export function addBasemap(map, { style = "streets-v2", key = import.meta.env.VITE_MAPTILER_API_KEY } = {}) {
  if (!key) return osmLayer().addTo(map);
  const layer = L.tileLayer(`https://api.maptiler.com/maps/${style}/{z}/{x}/{y}.png?key=${key}`, basemapOptions("maptiler")).addTo(map);
  let failed = 0;
  const onError = () => {
    failed += 1;
    if (failed < FAILED_TILE_LIMIT || !map.hasLayer(layer)) return;
    layer.off("tileerror", onError);
    map.removeLayer(layer);
    osmLayer().addTo(map);
  };
  layer.on("tileerror", onError);
  return layer;
}
