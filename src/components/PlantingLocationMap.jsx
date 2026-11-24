import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { authenticatedFetch } from "../services/authenticatedApi";
import { boundaryLayerOptions } from "../utils/barangayMap";
import { coordinateValue, getFeatureBarangayName } from "../utils/plantingLocationPreview";

const BULAN_CENTER = [12.6598, 123.918];
// Stable defaults: a fresh [] per render would re-run the layer effect and reset the user's zoom/pan.
const EMPTY_TREES = Object.freeze([]);
// Leaflet renders string tooltip content as HTML; site names, Tree IDs and species are user data,
// so tooltips receive a DOM element whose textContent holds the literal text.
function textTooltip(text) {
  const label = document.createElement("span");
  label.textContent = text;
  return label;
}

function barangayStyle(feature, barangay) {
  const selected = barangay &&
    String(getFeatureBarangayName(feature)).trim().toLowerCase() === barangay.trim().toLowerCase();
  return {
    color: selected ? "#0f6b3c" : "#17643a",
    weight: selected ? 2.6 : 1.25,
    opacity: selected ? 1 : 0.82,
    fillColor: "#eaf7ef",
    fillOpacity: selected ? 0.12 : 0,
  };
}

const treeIcon = (kind, selected) => L.divIcon({
  className: `psm-tree-marker psm-tree-marker-${String(kind || "APPROVED").toLowerCase()}${selected ? " is-selected" : ""}`,
  html: '<svg viewBox="0 0 24 30" aria-hidden="true"><path d="M12 1 4 11h5l-6 8h7v8h4v-8h7l-6-8h5z"/></svg>',
  iconSize: selected ? [30, 38] : [24, 32], iconAnchor: selected ? [15, 36] : [12, 30], popupAnchor: [0, -30],
});

function markerPopup(tree, onSelectTree) {
  const root = document.createElement("div"); root.className = "psm-tree-popup";
  const heading = document.createElement("strong"); heading.textContent = tree.sampleId || "Permanent sample"; root.append(heading);
  const rows = [
    ["Species", tree.species], ["Marker", tree.kind === "DRAFT" ? "Draft — not official" : "Approved permanent sample"],
    ["Latest approved condition", tree.latestApprovedCondition], ["Visit", tree.visitNumber], ["Assessment date", tree.assessedOn],
    ["Height", tree.heightCentimeters == null ? null : `${tree.heightCentimeters} cm`],
    ["Stem diameter", tree.stemDiameterMillimeters == null ? null : `${tree.stemDiameterMillimeters} mm`],
    ["GPS verification", tree.gpsVerification],
  ];
  const list = document.createElement("dl");
  rows.forEach(([label, value]) => { if (value === null || value === undefined || value === "") return; const dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=label;dd.textContent=String(value);list.append(dt,dd); });
  root.append(list);
  if (tree.sampleId && onSelectTree) { const button=document.createElement("button");button.type="button";button.textContent="Open assessment";button.addEventListener("click",()=>onSelectTree(tree.sampleId));root.append(button); }
  return root;
}

export default function PlantingLocationMap({ site, evidence, registeredTree, trees = EMPTY_TREES, treeMarkers = EMPTY_TREES, selectedTreeId = "", status, highlightSitePolygon = false, onSelectTree, onBoundaries, onBoundaryError }) {
  const root = useRef(null), mapRef = useRef(null), layers = useRef(null), callbacks = useRef({});
  const [barangayLayer, setBarangayLayer] = useState(null);
  const barangay = site?.barangay || "";
  const latitude = coordinateValue(evidence?.latitude), longitude = coordinateValue(evidence?.longitude);
  const accuracy = coordinateValue(evidence?.accuracy ?? evidence?.accuracyMeters);

  useEffect(() => { callbacks.current = { onBoundaries, onBoundaryError }; }, [onBoundaries, onBoundaryError]);

  useEffect(() => {
    let active = true;
    const map = L.map(root.current, { center: BULAN_CENTER, zoom: 12, minZoom: 11, maxZoom: 19, zoomControl: true, attributionControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const site = L.layerGroup().addTo(map), captured = L.layerGroup().addTo(map);
    mapRef.current = map;
    layers.current = { site, captured, tree: L.layerGroup().addTo(map) };

    authenticatedFetch("/sites/barangay-boundaries").then(response => {
      if (!response.ok) throw new Error("Boundary unavailable");
      return response.json();
    }).then(body => {
      if (!active) return;
      const geoJson = body.data || body;
      if (geoJson?.type !== "FeatureCollection" || !Array.isArray(geoJson.features)) throw new Error("Invalid boundary");
      const boundary = L.geoJSON(geoJson, {
        ...boundaryLayerOptions(map),
        onEachFeature: (feature, layer) => {
          const name = getFeatureBarangayName(feature);
          if (name) layer.bindTooltip(String(name), { permanent: true, direction: "center", className: "pr-map-barangay-label", opacity: 1 });
        },
      }).addTo(map);
      callbacks.current.onBoundaries?.(geoJson);
      setBarangayLayer(boundary);
      // The site view takes priority once a release is selected.
      if (!site.getLayers().length && !captured.getLayers().length && boundary.getBounds().isValid()) {
        map.fitBounds(boundary.getBounds(), { padding: [24, 24] });
      }
    }).catch(() => {
      if (!active) return;
      root.current?.setAttribute("data-boundary-status", "unavailable");
      callbacks.current.onBoundaryError?.();
    });

    const resize = window.setTimeout(() => map.invalidateSize(), 0);
    return () => {
      active = false;
      window.clearTimeout(resize);
      // Leaflet 1.9 finishes a zoom animation from a 250 ms timer that is not
      // cancelled by remove(); closing the form mid-zoom (for example right
      // after a confirmed save) then throws "_leaflet_pos". The timer returns
      // early when no zoom is animating.
      map.stop();
      map._animatingZoom = false;
      map.remove();
      mapRef.current = null;
      layers.current = null;
    };
  }, []);

  useEffect(() => {
    barangayLayer?.eachLayer(layer => layer.setStyle?.(barangayStyle(layer.feature, barangay)));
  }, [barangayLayer, barangay]);

  useEffect(() => {
    const map = mapRef.current, group = layers.current;
    if (!map || !group) return undefined;
    group.site.clearLayers();
    group.captured.clearLayers();
    group.tree.clearLayers();
    const fitPoints = [];
    const siteName = site?.siteName || "Registered Planting Site";
    const siteLatitude = coordinateValue(site?.latitude), siteLongitude = coordinateValue(site?.longitude);
    const hasSitePoint = Number.isFinite(siteLatitude) && Number.isFinite(siteLongitude);
    const radius = Number(site?.coverageRadiusMeters);
    const polygon = Array.isArray(site?.polygon)
      ? site.polygon.filter(point => Number.isFinite(coordinateValue(point?.lat)) && Number.isFinite(coordinateValue(point?.lng)))
        .map(point => [Number(point.lat), Number(point.lng)])
      : [];
    const coverageStyle = { color: "#17643a", weight: 2, opacity: 1, fillColor: "#6fb98a", fillOpacity: 0.18 };

    if (hasSitePoint && Number.isFinite(radius) && radius > 0) {
      const coverage = L.circle([siteLatitude, siteLongitude], { ...coverageStyle, radius })
        .bindTooltip(textTooltip(`${siteName} • ${radius} m coverage`)).addTo(group.site);
      // A circle needs a rendered map for getBounds, which the map has by this effect.
      const bounds = coverage.getBounds();
      fitPoints.push([bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]);
    }
    if (polygon.length >= 3 && (highlightSitePolygon || !(hasSitePoint && Number.isFinite(radius) && radius > 0))) {
      L.polygon(polygon, coverageStyle).bindTooltip(textTooltip(siteName)).addTo(group.site);
      fitPoints.push(...polygon);
    }

    if (hasSitePoint) {
      L.circleMarker([siteLatitude, siteLongitude], { radius: 8, color: "#ffffff", weight: 2, fillColor: "#17643a", fillOpacity: 1 })
        .bindTooltip(textTooltip(`${siteName} • Site GPS`), { direction: "top", offset: [0, -8] }).addTo(group.site);
      fitPoints.push([siteLatitude, siteLongitude]);
    }

    const treeRows = treeMarkers.length ? treeMarkers : trees.length ? trees : registeredTree ? [registeredTree] : [];
    treeRows.forEach(tree => {
      const treeLatitude = coordinateValue(tree?.latitude), treeLongitude = coordinateValue(tree?.longitude);
      if (!Number.isFinite(treeLatitude) || !Number.isFinite(treeLongitude)) return;
      const selected = String(tree.sampleId || "") === String(selectedTreeId || registeredTree?.sampleId || "");
      const title = `${tree.sampleId || "Permanent sample"}${tree.species ? ` · ${tree.species}` : ""}`;
      const markerLabel = `Open ${tree.sampleId || "permanent sample"} assessment`;
      const marker = L.marker([treeLatitude, treeLongitude], { icon: treeIcon(tree.kind, selected), keyboard: true, title: markerLabel, alt: markerLabel, zIndexOffset: selected ? 1000 : tree.kind === "DRAFT" ? 500 : 0 })
        .bindTooltip(textTooltip(`${title} - ${selected ? "Selected Tree" : "Registered Tree"}`))
        .bindPopup(markerPopup(tree, onSelectTree))
        .addTo(group.tree);
      const selectTree = () => onSelectTree?.(tree.sampleId);
      marker.on("click", selectTree);
      marker.on("mousedown", selectTree);
      fitPoints.push([treeLatitude, treeLongitude]);
    });
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      L.circleMarker([latitude, longitude], { radius: 8, color: "#ffffff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 })
        .bindTooltip("Detected Evidence Location", { permanent: false, direction: "top", offset: [0, -8] }).addTo(group.captured);
      if (Number.isFinite(accuracy) && accuracy > 0) {
        L.circle([latitude, longitude], { radius: accuracy, color: "#2563eb", weight: 1, opacity: 0.65, fillColor: "#60a5fa", fillOpacity: 0.08 }).addTo(group.captured);
      }
      fitPoints.push([latitude, longitude]);
    }

    if (fitPoints.length) {
      const bounds = L.latLngBounds(fitPoints);
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.4), { padding: [34, 34], maxZoom: 17 });
    }
    const resize = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(resize);
  }, [site, registeredTree, trees, treeMarkers, selectedTreeId, latitude, longitude, accuracy, highlightSitePolygon, onSelectTree]);

  return <div className="pr-location-map-section">
    <div className="pr-location-map-heading">
      <h4 className="pr-location-map-title">Bulan Location Preview</h4>
      <span className={`pr-location-status pr-location-status-${status.type}`}>{status.label}</span>
    </div>
    <div className="pr-location-map-wrap">
      <div ref={root} className="pr-location-map" aria-label="Interactive Bulan barangay and planting site location preview" />
    </div>
    <div className="pr-location-map-legend">
      <span><i className="pr-map-legend-line" /> Barangay Boundary</span>
      {highlightSitePolygon && <span><i className="pr-map-legend-line" /> Highlighted Planting Site</span>}
      <span><i className="pr-map-legend-site" /> Registered Site</span>
      {(registeredTree || trees.length > 0 || treeMarkers.length > 0) && <span><i className="psm-tree-legend" /> Permanent Sample Trees</span>}
      <span><i className="pr-map-legend-captured" /> Current Evidence GPS</span>
    </div>
  </div>;
}
