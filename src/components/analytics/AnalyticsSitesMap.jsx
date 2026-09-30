import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BOUNDARY_URL = "/data/juban-barangays.geojson";
const FALLBACK_CENTER = [12.848, 123.987];
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

function conditionColor(condition) {
  if (condition === "Healthy") return "#1aa343";
  if (condition === "Needs Attention") return "#f4b400";
  if (condition === "Critical") return "#e52d2d";
  return "#3186d9";
}

export default function AnalyticsSitesMap({ sites = [], onViewFullMap }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const siteLayerRef = useRef(null);
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
          style: { color: "#17643a", weight: 1.7, opacity: 0.96, fillColor: "#dff2e5", fillOpacity: 0.32 },
          interactive: false,
          onEachFeature(feature, layer) {
            const name = feature?.properties?.brgy_name || feature?.properties?.barangay || feature?.properties?.name || feature?.properties?.NAME;
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
      .catch(() => { if (!cancelled) setError("Unable to load the Juban barangay boundary data."); });

    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(containerRef.current);
    window.setTimeout(() => map.invalidateSize(), 0);
    return () => {
      cancelled = true;
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      siteLayerRef.current = null;
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
      L.circleMarker([latitude, longitude], { radius: 7, color: "#fff", weight: 2, fillColor: conditionColor(site.treeCondition), fillOpacity: 1 })
        .bindTooltip(site.siteName || site.siteId || "Planting Site", { direction: "top", offset: [0, -6] })
        .on("click", () => setSelected(site)).addTo(layer);
    }
  }, [sites]);

  const selectedUtilization = selected ? utilization(selected) : 0;
  return (
    <section className="ra-map-card">
      <div className="ra-card-heading"><h2>Planting Sites Map</h2><p>Registered sites, utilization, and latest recorded tree condition</p></div>
      <div className="ra-map-frame">
        <div ref={containerRef} className="ra-map" aria-label="Interactive map of registered planting sites in Juban" />
        {error && <div className="ra-map-error" role="alert">{error}</div>}
        {!error && sites.length === 0 && <div className="ra-map-empty">No registered sites match the selected filters.</div>}
        <div className="ra-map-legend">
          <div><strong>Site Utilization</strong><span><i className="available" />Available (0–49%)</span><span><i className="partial" />Partially Occupied (50–89%)</span><span><i className="full" />Full (90–100%)</span></div>
          <div><strong>Tree Condition</strong><span><b className="healthy" />Healthy</span><span><b className="attention" />Needs Attention</span><span><b className="critical" />Critical</span><span><b className="unmonitored" />Not Yet Monitored</span></div>
        </div>
        {selected && <div className="ra-map-popup"><button type="button" aria-label="Close site details" onClick={() => setSelected(null)}>×</button><strong>{selected.siteName}</strong><span>{selected.barangay}</span><span>Utilization: {selectedUtilization}% ({utilizationMeta(selectedUtilization).label})</span><span>Condition: {selected.treeCondition || "Not Yet Monitored"}</span>{selected.survivalRate != null && <span>Latest survival rate: {selected.survivalRate}%</span>}</div>}
      </div>
      <button type="button" className="ra-map-link" onClick={onViewFullMap}>View Full Map →</button>
    </section>
  );
}
