import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { authenticatedFetch } from "../services/authenticatedApi";
import { boundaryLayerOptions } from "../utils/barangayMap";
import { coordinateValue, getFeatureBarangayName } from "../utils/plantingLocationPreview";
import { EVIDENCE_STATE_LABEL } from "../utils/plantingReviewWorkflow";

const BULAN_CENTER = [12.6598, 123.918];
const MARKER_COLORS = { verified: "#2563eb", unverified: "#d97706", rejected: "#dc2626" };

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

const escapeText = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

// Read-only View Report map: the full Bulan barangay boundary, the registered
// planting site and every saved photo GPS point. It never asks for a photo and
// never changes the report; it only displays what was saved.
export default function PlantingEvidenceMap({ site, barangay, markers, formatDateTime }) {
  const root = useRef(null), mapRef = useRef(null), layers = useRef(null);
  const [boundaryLayer, setBoundaryLayer] = useState(null);
  const [boundaryStatus, setBoundaryStatus] = useState("loading");
  const selectedBarangay = site?.barangay || barangay || "";

  useEffect(() => {
    let active = true;
    const map = L.map(root.current, { center: BULAN_CENTER, zoom: 12, minZoom: 10, maxZoom: 19, zoomControl: true, attributionControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const siteGroup = L.layerGroup().addTo(map), evidenceGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    layers.current = { site: siteGroup, evidence: evidenceGroup };

    authenticatedFetch("/sites/barangay-boundaries").then((response) => {
      if (!response.ok) throw new Error("Boundary unavailable");
      return response.json();
    }).then((body) => {
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
      setBoundaryLayer(boundary);
      setBoundaryStatus("ready");
      if (!siteGroup.getLayers().length && !evidenceGroup.getLayers().length && boundary.getBounds().isValid()) {
        map.fitBounds(boundary.getBounds(), { padding: [24, 24] });
      }
    }).catch(() => {
      if (active) setBoundaryStatus("unavailable");
    });

    const resize = window.setTimeout(() => map.invalidateSize(), 0);
    return () => {
      active = false;
      window.clearTimeout(resize);
      map.remove();
      mapRef.current = null;
      layers.current = null;
    };
  }, []);

  useEffect(() => {
    boundaryLayer?.eachLayer((layer) => layer.setStyle?.(barangayStyle(layer.feature, selectedBarangay)));
  }, [boundaryLayer, selectedBarangay]);

  useEffect(() => {
    const map = mapRef.current, group = layers.current;
    if (!map || !group) return undefined;
    group.site.clearLayers();
    group.evidence.clearLayers();
    const fitPoints = [];
    const siteName = site?.siteName || "Registered Planting Site";
    const siteLatitude = coordinateValue(site?.latitude), siteLongitude = coordinateValue(site?.longitude);
    const hasSitePoint = Number.isFinite(siteLatitude) && Number.isFinite(siteLongitude);
    const radius = Number(site?.coverageRadiusMeters);
    const polygon = Array.isArray(site?.polygon)
      ? site.polygon.filter((point) => Number.isFinite(coordinateValue(point?.lat)) && Number.isFinite(coordinateValue(point?.lng)))
        .map((point) => [Number(point.lat), Number(point.lng)])
      : [];
    const coverageStyle = { color: "#17643a", weight: 2, opacity: 1, fillColor: "#6fb98a", fillOpacity: 0.18 };

    if (hasSitePoint && Number.isFinite(radius) && radius > 0) {
      const coverage = L.circle([siteLatitude, siteLongitude], { ...coverageStyle, radius })
        .bindTooltip(`${escapeText(siteName)} • ${radius} m coverage`).addTo(group.site);
      const bounds = coverage.getBounds();
      fitPoints.push([bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]);
    } else if (polygon.length >= 3) {
      L.polygon(polygon, coverageStyle).bindTooltip(escapeText(siteName)).addTo(group.site);
      fitPoints.push(...polygon);
    }
    if (hasSitePoint) {
      L.circleMarker([siteLatitude, siteLongitude], { radius: 8, color: "#ffffff", weight: 2, fillColor: "#17643a", fillOpacity: 1 })
        .bindTooltip(`${escapeText(siteName)} • Registered Site`, { direction: "top", offset: [0, -8] }).addTo(group.site);
      fitPoints.push([siteLatitude, siteLongitude]);
    }

    (markers || []).forEach((marker) => {
      const color = MARKER_COLORS[marker.state] || MARKER_COLORS.unverified;
      const details = [
        `<strong>${escapeText(marker.label)}</strong>`,
        escapeText(EVIDENCE_STATE_LABEL[marker.state] || "Evidence"),
        `${marker.latitude.toFixed(6)}, ${marker.longitude.toFixed(6)}`,
        Number.isFinite(marker.accuracy) ? `GPS accuracy ± ${Math.round(marker.accuracy)} m` : "",
        marker.capturedAt && formatDateTime ? `Captured ${escapeText(formatDateTime(marker.capturedAt))}` : "",
        `Submission ${escapeText(marker.submissionId)}`,
      ].filter(Boolean).join("<br>");
      L.circleMarker([marker.latitude, marker.longitude], {
        radius: 8, color: "#ffffff", weight: 2, fillColor: color, fillOpacity: marker.state === "rejected" ? 0.75 : 1,
        dashArray: marker.state === "rejected" ? "3 2" : undefined,
      }).bindTooltip(details, { direction: "top", offset: [0, -8] }).addTo(group.evidence);
      if (Number.isFinite(marker.accuracy) && marker.accuracy > 0) {
        L.circle([marker.latitude, marker.longitude], { radius: marker.accuracy, color, weight: 1, opacity: 0.55, fillColor: color, fillOpacity: 0.06, interactive: false }).addTo(group.evidence);
      }
      fitPoints.push([marker.latitude, marker.longitude]);
    });

    if (fitPoints.length) {
      const bounds = L.latLngBounds(fitPoints);
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.4), { padding: [34, 34], maxZoom: 17 });
    }
    const resize = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(resize);
  }, [site, markers, formatDateTime]);

  const counts = (markers || []).reduce((total, marker) => ({ ...total, [marker.state]: (total[marker.state] || 0) + 1 }), {});
  const summary = (markers || []).length
    ? `${markers.length} saved evidence location${markers.length === 1 ? "" : "s"}`
    : "No saved photo GPS coordinates";

  return <div className="pr-location-map-section pr-evidence-map-section">
    <div className="pr-location-map-heading">
      <h4 className="pr-location-map-title">Bulan Evidence Map</h4>
      <span className="pr-evidence-map-summary">{summary}</span>
    </div>
    <div className="pr-location-map-wrap">
      <div ref={root} className="pr-location-map pr-evidence-map" data-boundary-status={boundaryStatus}
        aria-label="Read-only Bulan map with barangay boundaries, the registered planting site and saved evidence photo locations" />
    </div>
    {boundaryStatus === "unavailable" && <p className="pr-evidence-map-note" role="status">Barangay boundaries are unavailable. Saved site and evidence locations are still shown.</p>}
    <div className="pr-location-map-legend">
      <span><i className="pr-map-legend-line" /> Barangay Boundary</span>
      <span><i className="pr-map-legend-site" /> Registered Site</span>
      <span><i className="pr-map-legend-evidence pr-map-legend-verified" /> Verified ({counts.verified || 0})</span>
      <span><i className="pr-map-legend-evidence pr-map-legend-unverified" /> Unverified ({counts.unverified || 0})</span>
      <span><i className="pr-map-legend-evidence pr-map-legend-rejected" /> Rejected / Returned ({counts.rejected || 0})</span>
    </div>
  </div>;
}
