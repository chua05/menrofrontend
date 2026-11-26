import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { boundaryLayerOptions } from "../../utils/barangayMap";
import { textTooltip } from "../../utils/leafletTooltip";
import { TREE_CONDITIONS, locatedTrees as located, renderTreeMarkers } from "../map/treeMarkerLayer";
import "leaflet/dist/leaflet.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const BOUNDARY_URL = `${API_BASE_URL}/sites/barangay-boundaries`;
const FALLBACK_CENTER = [12.6598, 123.918];
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_API_KEY;

function utilization(site) {
  const capacity = Number(site.maximumCapacity || 0);
  const planted = Number(site.planted || 0);
  return capacity > 0 ? Math.min(100, Math.round((planted / capacity) * 100)) : 0;
}

function utilizationMeta(value) {
  if (value >= 90) return { label: "Full", fill: "#ef4444", stroke: "#d72f2f" };
  if (value >= 50) return { label: "Partially Occupied", fill: "#facc15", stroke: "#d6a900" };
  return { label: "Available", fill: "#4caf63", stroke: "#2f9847" };
}

const SITE_CENTER_COLOR = "#3186d9";
const EMPTY_TREES = [];
export default function AnalyticsSitesMap({ sites = [], trees = EMPTY_TREES, locationUnavailable = 0, onViewFullMap }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const siteLayerRef = useRef(null);
  const treeLayerRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = L.map(containerRef.current, {
      center: FALLBACK_CENTER,
      zoom: 12,
      minZoom: 9,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: true,
    });
    const tileUrl = MAPTILER_KEY
      ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    L.tileLayer(tileUrl, MAPTILER_KEY ? {
      tileSize: 512, zoomOffset: -1, maxZoom: 20, crossOrigin: true,
      attribution: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    } : {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    siteLayerRef.current = L.layerGroup().addTo(map);
    treeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    let cancelled = false;
    fetch(BOUNDARY_URL)
      .then((response) => {
        if (!response.ok) throw new Error("Boundary unavailable");
        return response.json();
      })
      .then((geoJson) => {
        if (cancelled) return;
        const boundary = L.geoJSON(geoJson, {
          ...boundaryLayerOptions(map),
          style: { color: "#17643a", weight: 1.7, opacity: 0.96, fillColor: "#dff2e5", fillOpacity: 0.32 },
          interactive: false,
          onEachFeature(feature, layer) {
            const name = feature?.properties?.ADM4_EN || feature?.properties?.brgy_name || feature?.properties?.barangay || feature?.properties?.name || feature?.properties?.NAME;
            if (name) layer.bindTooltip(String(name), { permanent: true, direction: "center", className: "ps-barangay-label", interactive: false, opacity: 1 });
          },
        }).addTo(map);
        const bounds = boundary.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.28), { padding: [18, 18], maxZoom: 13, animate: false });
          map.setMaxBounds(bounds.pad(0.75));
          map.options.maxBoundsViscosity = 0.9;
        }
      })
      .catch(() => { if (!cancelled) setError("Unable to load the Bulan barangay boundary data."); });

    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(containerRef.current);
    window.setTimeout(() => map.invalidateSize(), 0);
    return () => {
      cancelled = true;
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      siteLayerRef.current = null;
      treeLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = siteLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const site of sites) {
      const latitude = Number(site.latitude);
      const longitude = Number(site.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      const percent = utilization(site);
      const meta = utilizationMeta(percent);
      const radius = Number(site.coverageRadiusMeters);
      if (Number.isFinite(radius) && radius > 0) {
        L.circle([latitude, longitude], { radius, color: meta.stroke, weight: 1.5, fillColor: meta.fill, fillOpacity: 0.24 }).on("click", () => setSelected(site)).addTo(layer);
      } else if (Array.isArray(site.polygon) && site.polygon.length >= 3) {
        const points = site.polygon.map((point) => [Number(point.lat), Number(point.lng)]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
        if (points.length >= 3) L.polygon(points, { color: meta.stroke, weight: 1.5, fillColor: meta.fill, fillOpacity: 0.24 }).on("click", () => setSelected(site)).addTo(layer);
      }
      L.circleMarker([latitude, longitude], { radius: 7, color: "#fff", weight: 2, fillColor: SITE_CENTER_COLOR, fillOpacity: 1 })
        .bindTooltip(textTooltip(site.siteName || site.siteId || "Planting Site"), { direction: "top", offset: [0, -6] })
        .on("click", () => setSelected(site)).addTo(layer);
    }
  }, [sites]);

  useEffect(() => {
    const map = mapRef.current, layer = treeLayerRef.current;
    if (!map || !layer) return undefined;
    return renderTreeMarkers(map, layer, trees);
  }, [trees]);

  const fitTo = (points) => {
    const map = mapRef.current;
    if (!map || points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 18);
    else map.fitBounds(L.latLngBounds(points).pad(0.2), { maxZoom: 18 });
  };
  const treePoints = (siteId) => located(siteId ? trees.filter((tree) => tree.siteId === siteId) : trees).map((tree) => [Number(tree.latitude), Number(tree.longitude)]);
  const zoomToSite = (site) => {
    const points = treePoints(site.siteId || site.id);
    const latitude = Number(site.latitude), longitude = Number(site.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) points.push([latitude, longitude]);
    fitTo(points);
  };

  const selectedUtilization = selected ? utilization(selected) : 0;
  return (
    <section className="ra-map-card">
      <div className="ra-card-heading"><h2>Planting Sites Map</h2><p>Registered planting sites in Bulan, Sorsogon</p></div>
      <div className="ra-map-frame">
        <div ref={containerRef} className="ra-map" aria-label="Interactive map of registered planting sites in Bulan" />
        {error && <div className="ra-map-error" role="alert">{error}</div>}
        {!error && sites.length === 0 && <div className="ra-map-empty">No registered sites match the selected filters.</div>}
        {trees.length > 0 && <button type="button" className="ra-map-zoom" onClick={() => fitTo(treePoints())}>Zoom to monitored trees</button>}
        <div className="ra-map-legend">
          <div><strong>Site Utilization</strong><span><i className="available" />Available (0–49%)</span><span><i className="partial" />Partially Occupied (50–89%)</span><span><i className="full" />Full (90–100%)</span></div>
          <div><strong>Permanent Sample Trees</strong>{TREE_CONDITIONS.map(([value, slug, label]) => <span key={value}><i className={`ra-tree-key ra-tree-${slug}`} />{label}</span>)}<span><b className="site-center" />Registered site center</span></div>
        </div>
        {selected && <div className="ra-map-popup"><button type="button" aria-label="Close site details" onClick={() => setSelected(null)}>×</button><strong>{selected.siteName}</strong><span>{selected.barangay}</span><span>Utilization: {selectedUtilization}% ({utilizationMeta(selectedUtilization).label})</span><span>Condition: {selected.treeCondition || "Not Yet Monitored"}</span>{selected.survivalRate != null && <span>Latest survival rate: {selected.survivalRate}%</span>}<span>Monitored sample trees: {trees.filter((tree) => tree.siteId === (selected.siteId || selected.id)).length}</span><button type="button" className="ra-map-popup-zoom" onClick={() => zoomToSite(selected)}>Zoom to site</button></div>}
      </div>
      {locationUnavailable > 0 && <p className="ra-map-note" role="status">Location unavailable: {locationUnavailable} monitored sample {locationUnavailable === 1 ? "tree has" : "trees have"} no saved registration GPS, so {locationUnavailable === 1 ? "it is" : "they are"} not drawn.</p>}
      <button type="button" className="ra-map-link" onClick={onViewFullMap}>View Full Map →</button>
    </section>
  );
}
