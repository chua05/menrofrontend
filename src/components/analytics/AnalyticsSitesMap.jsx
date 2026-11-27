import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { boundaryLayerOptions } from "../../utils/barangayMap";
import { TREE_CONDITIONS, locatedTrees as located, renderTreeMarkers } from "../map/treeMarkerLayer";
import { MAP_MAX_ZOOM, addBasemap } from "../map/basemap";
import { drawSiteOverlay } from "../map/siteOverlayLayer";
import { UTILIZATION_LEGEND, siteUtilization } from "../../utils/siteUtilization";
import { SiteCenterKey, TreeKey, UtilizationSwatch } from "../map/MapLegendKeys";
import "leaflet/dist/leaflet.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const BOUNDARY_URL = `${API_BASE_URL}/sites/barangay-boundaries`;
const FALLBACK_CENTER = [12.6598, 123.918];
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
      maxZoom: MAP_MAX_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });
    addBasemap(map);
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
    for (const site of sites) drawSiteOverlay(layer, site, { onSelect: setSelected });
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

  const selectedUtilization = selected ? siteUtilization(selected) : null;
  return (
    <section className="ra-map-card">
      <div className="ra-card-heading"><h2>Planting Sites Map</h2><p>Registered planting sites in Bulan, Sorsogon</p></div>
      <div className="ra-map-frame">
        <div ref={containerRef} className="ra-map" aria-label="Interactive map of registered planting sites in Bulan" />
        {error && <div className="ra-map-error" role="alert">{error}</div>}
        {!error && sites.length === 0 && <div className="ra-map-empty">No registered sites match the selected filters.</div>}
        {trees.length > 0 && <button type="button" className="ra-map-zoom" onClick={() => fitTo(treePoints())}>Zoom to monitored trees</button>}
        <div className="ra-map-legend">
          <div><strong>Site Utilization</strong>{UTILIZATION_LEGEND.map(({ level, label, range }) => <span key={level}><UtilizationSwatch level={level} />{range ? `${label} (${range})` : label}</span>)}<span><SiteCenterKey />Registered site center</span></div>
          <div><strong>Site Monitoring Condition</strong>{TREE_CONDITIONS.map(([value, slug, label]) => <span key={value}><TreeKey slug={slug} />{label}</span>)}<span><TreeKey slug="pending" />Pending Review (not approved)</span><small>Tree icons: latest approved condition of each monitored sample tree.</small></div>
        </div>
        {selected && <div className="ra-map-popup"><button type="button" aria-label="Close site details" onClick={() => setSelected(null)}>×</button><strong>{selected.siteName}</strong><span>{selected.barangay}</span><span>Utilization: {selectedUtilization.known ? `${selectedUtilization.percent}% (${selectedUtilization.label})` : selectedUtilization.label}{selectedUtilization.overCapacity ? " — over capacity" : ""}</span><span>Verified planted: {selectedUtilization.planted}{selectedUtilization.known ? ` of ${selectedUtilization.capacity}` : ""}</span><span>Site summary: {selected.treeCondition || "Not Yet Monitored"}</span>{selected.survivalRate != null && <span>Latest survival rate: {selected.survivalRate}%</span>}<span>Monitored sample trees: {trees.filter((tree) => tree.siteId === (selected.siteId || selected.id)).length}</span><button type="button" className="ra-map-popup-zoom" onClick={() => zoomToSite(selected)}>Zoom to site</button></div>}
      </div>
      {locationUnavailable > 0 && <p className="ra-map-note" role="status">Location unavailable: {locationUnavailable} monitored sample {locationUnavailable === 1 ? "tree has" : "trees have"} no saved registration GPS, so {locationUnavailable === 1 ? "it is" : "they are"} not drawn.</p>}
      <button type="button" className="ra-map-link" onClick={onViewFullMap}>View Full Map →</button>
    </section>
  );
}
