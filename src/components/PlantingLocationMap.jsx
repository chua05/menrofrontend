import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { authenticatedFetch } from "../services/authenticatedApi";
import { boundaryLayerOptions } from "../utils/barangayMap";
import { coordinateValue, getFeatureBarangayName } from "../utils/plantingLocationPreview";

const BULAN_CENTER = [12.6598, 123.918];

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

export default function PlantingLocationMap({ site, evidence, registeredTree, status, onBoundaries, onBoundaryError }) {
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
        .bindTooltip(`${siteName} • ${radius} m coverage`).addTo(group.site);
      // A circle needs a rendered map for getBounds, which the map has by this effect.
      const bounds = coverage.getBounds();
      fitPoints.push([bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]);
    } else if (polygon.length >= 3) {
      L.polygon(polygon, coverageStyle).bindTooltip(siteName).addTo(group.site);
      fitPoints.push(...polygon);
    }

    if (hasSitePoint) {
      L.circleMarker([siteLatitude, siteLongitude], { radius: 8, color: "#ffffff", weight: 2, fillColor: "#17643a", fillOpacity: 1 })
        .bindTooltip(`${siteName} • Site GPS`, { direction: "top", offset: [0, -8] }).addTo(group.site);
      fitPoints.push([siteLatitude, siteLongitude]);
    }

    const treeLatitude = coordinateValue(registeredTree?.latitude), treeLongitude = coordinateValue(registeredTree?.longitude);
    if (Number.isFinite(treeLatitude) && Number.isFinite(treeLongitude)) {
      L.circleMarker([treeLatitude, treeLongitude], { radius: 7, color: "#684b11", weight: 2, fillColor: "#e6b64c", fillOpacity: 1 })
        .bindTooltip(`${registeredTree.sampleId || "Permanent sample"} - Registered Tree`).addTo(group.tree);
      fitPoints.push([treeLatitude, treeLongitude]);
    }
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
  }, [site, registeredTree, latitude, longitude, accuracy]);

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
      <span><i className="pr-map-legend-site" /> Registered Site</span>
      {registeredTree && <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: "#e6b64c" }} /> Registered Tree</span>}
      <span><i className="pr-map-legend-captured" /> Evidence GPS</span>
    </div>
  </div>;
}
