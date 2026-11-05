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
    const frame = requestAnimationFrame(() => map.invalidateSize());
    return () => { cancelAnimationFrame(frame); map.remove(); };
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
  const ready = site && Number.isFinite(site.latitude) && Number.isFinite(site.longitude) && site.eventId && site.requestId;
  function add(files) {
    if (disabled) return;
    if (photos.length + files.length > 10 || files.some(file => file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) return onError("Choose at most 10 original JPEG, PNG or WebP planting photos, each up to 10 MB.");
    onError(""); onChange([...photos, ...files.map(file => ({ id: crypto.randomUUID(), file, descriptor: { source: "uploaded-original" }, status: "unverified" }))]);
  }
  async function verify() {
    if (disabled || verifying) return; setVerifying(true); onError("");
    try {
      const next = [];
      for (const row of photos) {
        if (row.descriptor.source === "browser-camera") { next.push(row); continue; }
        const metadata = await exifr.parse(row.file, { gps: true, tiff: true, exif: true }), gps = extractGpsCoordinates(metadata || {});
        const taken = new Date(metadata?.DateTimeOriginal || metadata?.CreateDate || metadata?.DateTime || "");
        if (gps.status !== "valid" || !Number.isFinite(taken.getTime()) || taken > new Date()) throw new Error("Original photo GPS and a valid capture timestamp are required. Device coordinates cannot replace EXIF.");
        next.push({ ...row, status: "ready", location: { latitude: gps.latitude, longitude: gps.longitude } });
      }
      onChange(next);
    } catch (failure) { onError(failure.message || "Photo metadata could not be verified."); } finally { setVerifying(false); }
  }
  return <section className="pr-field" aria-labelledby="official-evidence-heading">
    <h3 id="official-evidence-heading">Planting Photo Evidence</h3>
    <p>MENRO Field Reports require private, location-verified photos before Admin approval. Original bytes are revalidated by the backend.</p>
    <div className="pr-official-actions"><button type="button" className="pr-secondary-button" disabled={disabled || !ready || photos.length >= 10} onClick={() => setCamera(true)}>Take Photo</button>
      <label>Upload Existing Photos<input type="file" accept=".jpg,.jpeg,.png,.webp" multiple disabled={disabled || !ready} aria-invalid={Boolean(error)} aria-describedby={error ? "official-photos-error" : undefined} onChange={event => { add([...event.target.files]); event.target.value = ""; }} /></label></div>
    {!ready && <p>Authoritative registered-site coordinates are required. Use MENRO's authorized site correction process.</p>}
    <h3>Photo Location Verification</h3>
    <button type="button" className="pr-secondary-button" disabled={disabled || verifying || !photos.length} onClick={verify}>{verifying ? "Verifying…" : "Verify Photo Location"}</button>
    <div className="pr-official-grid">{photos.map(row => <div key={row.id}><Preview file={row.file} /><strong>{row.file.name}</strong><p>{row.status === "verified" ? "Backend-verified camera capture" : row.status === "ready" ? "EXIF preview ready — server verification required on upload" : "Verify original GPS metadata"}</p><button type="button" disabled={disabled} className="pr-secondary-button" aria-label={`Remove planting photo ${row.file.name}`} onClick={() => { onChange(photos.filter(photo => photo.id !== row.id)); onError(""); }}>Remove</button></div>)}</div>
    {ready && <SiteMap site={site} photos={photos} />}
    {error && <small id="official-photos-error" className="pr-field-error" role="alert">{error}</small>}
    {camera && <ModalDialog label="Secure planting camera" className="official-camera-host" onClose={() => setCamera(false)}><SecureCameraCapture open request={cameraRequest}
      binding={{ workflow: "planting-report", siteId: site.siteId, eventId: site.eventId, distributionId: site.requestId }}
      onVerified={({ file, descriptor, location }) => { onChange([...photos, { id: crypto.randomUUID(), file, descriptor, location, status: "verified" }]); onError(""); setCamera(false); }}
      onCancel={() => setCamera(false)} onViewLocation={() => setCamera(false)} /></ModalDialog>}
  </section>;
}
