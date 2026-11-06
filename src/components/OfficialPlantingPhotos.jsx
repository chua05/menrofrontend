import PlantingPhotoControls from "./PlantingPhotoControls";
import { boundaryLayerOptions } from "../utils/barangayMap";
import { useEffect, useRef, useState } from "react";
import * as exifr from "exifr";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import SecureCameraCapture from "./SecureCameraCapture";
import ModalDialog from "./ModalDialog";
import { authenticatedFetch } from "../services/authenticatedApi";
import { extractGpsCoordinates } from "../utils/exifGps";
function Preview({ file }) {
  const image = useRef(null);
  useEffect(() => { const url = URL.createObjectURL(file); image.current.src = url; return () => URL.revokeObjectURL(url); }, [file]);
  return <img ref={image} alt={`Planting evidence: ${file.name}`} style={{ width: "100%", height: 140, objectFit: "contain" }} />;
}
function SiteMap({ site, photos }) {
  const root = useRef(null);
  useEffect(() => {
    if (!Number.isFinite(site?.latitude) || !Number.isFinite(site?.longitude)) return undefined;
    const map = L.map(root.current).setView([site.latitude, site.longitude], 17);
    L.circleMarker([site.latitude, site.longitude], { color: "#145b3a", radius: 9 }).addTo(map).bindTooltip("Registered planting site");
    if (site.coverageRadiusMeters > 0) L.circle([site.latitude, site.longitude], { radius: site.coverageRadiusMeters, color: "#145b3a", fillOpacity: .08 }).addTo(map);
    for (const row of photos) if (row.location) L.circleMarker([row.location.latitude, row.location.longitude], { color: "#245ca8", radius: 6 }).addTo(map).bindTooltip("Photo GPS");
    let active = true;
    authenticatedFetch("/sites/barangay-boundaries").then(response => { if (!response.ok) throw new Error("Boundary unavailable"); return response.json(); }).then(body => { if (active) L.geoJSON(body.data || body, boundaryLayerOptions(map)).addTo(map); }).catch(() => { if (active) root.current.setAttribute("data-boundary-status", "unavailable"); });
    const frame = requestAnimationFrame(() => map.invalidateSize());
    return () => { active = false; cancelAnimationFrame(frame); map.remove(); };
  }, [site, photos]);
  return <div><div ref={root} role="img" aria-label="Registered planting site and photo GPS map" style={{ height: 240, borderRadius: 8, border: "1px solid #b8cbbf" }} /><small>Registered site: green. Photo GPS: blue. Coordinate map; no external map service is contacted.</small></div>;
}
async function cameraRequest(path, options) {
  const response = await authenticatedFetch(path, options), body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.message || "Capture verification failed."), { code: body.code });
  return body;
}
export default function OfficialPlantingPhotos({ site, photos, onChange, error, onError, disabled }) {
  const [camera, setCamera] = useState(false), [verifying, setVerifying] = useState(false);
  const scope = useRef(null);
  useEffect(() => { const key = `${site?.requestId || ""}:${site?.eventId || ""}:${site?.siteId || ""}`; scope.current = key; return () => { scope.current = null; }; }, [site?.requestId, site?.eventId, site?.siteId]);
  const ready = site && Number.isFinite(site.latitude) && Number.isFinite(site.longitude) && site.eventId && site.requestId;
  function add(files) {
    if (disabled) return;
    if (photos.length + files.length > 10 || files.some(file => file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) return onError("Choose at most 10 original JPEG, PNG or WebP planting photos, each up to 10 MB.");
    onError(""); onChange([...photos, ...files.map(file => ({ id: crypto.randomUUID(), file, descriptor: { source: "uploaded-original" }, status: "unverified" }))]);
  }
  async function verify() {
    if (disabled || verifying) return; const binding = scope.current; setVerifying(true); onError("");
    try {
      const next = [];
      for (const row of photos) {
        if (row.descriptor.source === "browser-camera") { next.push(row); continue; }
        const metadata = await exifr.parse(row.file, { gps: true, tiff: true, exif: true }), gps = extractGpsCoordinates(metadata || {});
        const taken = new Date(metadata?.DateTimeOriginal || metadata?.CreateDate || metadata?.DateTime || "");
        if (gps.status !== "valid" || !Number.isFinite(taken.getTime()) || taken > new Date()) throw new Error("Original photo GPS and a valid capture timestamp are required. Device coordinates cannot replace EXIF.");
        next.push({ ...row, status: "ready", location: { latitude: gps.latitude, longitude: gps.longitude } });
      }
      if (scope.current === binding && binding) onChange(next);
    } catch (failure) { if (scope.current === binding && binding) onError(failure.message || "Photo metadata could not be verified."); } finally { if (scope.current === binding && binding) setVerifying(false); }
  }
  return <section className="pr-field" aria-labelledby="official-evidence-heading">
    <h3 id="official-evidence-heading">Planting Photo Evidence</h3>
    <p>MENRO Field Reports require private, location-verified photos before Admin approval. Original bytes are revalidated by the backend.</p>
    <PlantingPhotoControls count={photos.length} disabled={disabled || !ready} error={error} onCamera={() => setCamera(true)} onFiles={add} />
    {!ready && <p>Authoritative registered-site coordinates are required. Use MENRO's authorized site correction process.</p>}
    <h3>Photo Location Verification</h3>
    <h4>Bulan Location Preview</h4>
    <button type="button" className="pr-secondary-button" disabled={disabled || verifying || !photos.length} onClick={verify}>{verifying ? "Verifying…" : "Verify Photo Location"}</button>
    <div className="pr-official-grid">{photos.map(row => <div key={row.id}><Preview file={row.file} /><strong>{row.file.name}</strong><p>{row.status === "verified" ? "Backend-verified camera capture" : row.status === "ready" ? "EXIF preview ready — server verification required on upload" : "Verify original GPS metadata"}</p><button type="button" disabled={disabled} className="pr-secondary-button" aria-label={`Remove planting photo ${row.file.name}`} onClick={() => { onChange(photos.filter(photo => photo.id !== row.id)); onError(""); }}>Remove</button></div>)}</div>
    {ready && <SiteMap site={site} photos={photos} />}

    {camera && <ModalDialog label="Secure planting camera" className="official-camera-host" onClose={() => setCamera(false)}><SecureCameraCapture open request={cameraRequest}
      binding={{ workflow: "planting-report", siteId: site.siteId, eventId: site.eventId, distributionId: site.requestId }}
      onVerified={({ file, descriptor, location }) => { onChange([...photos, { id: crypto.randomUUID(), file, descriptor, location, status: "verified" }]); onError(""); setCamera(false); }}
      onCancel={() => setCamera(false)} onViewLocation={() => setCamera(false)} /></ModalDialog>}
  </section>;
}
