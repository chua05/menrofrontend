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
  return <img ref={image} alt={`Planting evidence: ${file.name}`}  />;
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
  return <div className="pr-location-map-section"><div className="pr-location-map-heading"><h4 className="pr-location-map-title">Bulan Location Preview</h4></div>
    <div className="pr-location-map-wrap"><div ref={root} role="img" aria-label="Registered planting site and photo GPS map" className="pr-location-map" /></div>
    <div className="pr-location-map-legend"><span><i className="pr-map-legend-line" />Barangay Boundary</span><span><i className="pr-map-legend-site" />Registered Site</span><span><i className="pr-map-legend-captured" />Evidence GPS</span></div>
  </div>;
}
async function cameraRequest(path, options) {
  const response = await authenticatedFetch(path, options), body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.message || "Capture verification failed."), { code: body.code });
  return body;
}
export default function OfficialPlantingPhotos({ site, photos, onChange, error, onError, disabled }) {
  const [camera, setCamera] = useState(false), [verifying, setVerifying] = useState(false);
  const scope = useRef(null);
  const [activeCameraScope, setActiveCameraScope] = useState(null);
  const [diagnostic, setDiagnostic] = useState(null);
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
        if (gps.status === "missing") throw new Error("This original photo has no GPS metadata. Upload the original geotagged file or use Take Photo with a secure capture session.");
        if (gps.status !== "valid") throw new Error("The original photo GPS metadata is incomplete or unreadable. Browser location permission does not add EXIF to an existing file.");
        if (!Number.isFinite(taken.getTime()) || taken > new Date()) throw new Error("A valid original capture timestamp is required. Device coordinates cannot replace EXIF.");
        next.push({ ...row, status: "ready", location: { latitude: gps.latitude, longitude: gps.longitude } });
      }
      if (scope.current === binding && binding) onChange(next);
    } catch (failure) { if (scope.current === binding && binding) onError(failure.message || "Photo metadata could not be verified."); } finally { if (scope.current === binding && binding) setVerifying(false); }
  }
  return <>
    <section className="pr-section pr-photo-evidence-section" aria-labelledby="official-evidence-heading">
      <div className="pr-section-header pr-photo-section-header"><h3 id="official-evidence-heading">Planting Photo Evidence</h3></div>
      <div className="pr-photo-content">
        <PlantingPhotoControls count={photos.length} disabled={disabled || !ready || verifying} error={error}
          onCamera={() => { setActiveCameraScope(scope.current); setCamera(true); }} onFiles={add} />
        {!ready && <p>Authoritative registered-site coordinates are required. Ask an authorized MENRO officer to correct the linked site before capture.</p>}
        <div className="pr-evidence-grid">{photos.map(row => <div className="pr-preview-card" key={row.id}>
          <Preview file={row.file} /><div className="pr-preview-footer"><div className="pr-preview-file"><strong className="pr-preview-name">{row.file.name}</strong></div>
          <div className={`pr-preview-verification pr-preview-verification-${row.status === "unverified" ? "info" : "success"}`} role="status"><strong>{row.status === "verified" ? "Backend-verified camera capture" : row.status === "ready" ? "EXIF preview ready - server verification required on upload" : "Verify original GPS metadata"}</strong><span>Location Source: {row.descriptor.source === "browser-camera" ? "Browser Capture Session" : "Photo Metadata (EXIF)"}</span></div>
          <button type="button" disabled={disabled || verifying} className="pr-secondary-button" aria-label={`Remove planting photo ${row.file.name}`} onClick={() => { onChange(photos.filter(photo => photo.id !== row.id)); onError(""); }}>Remove</button></div>
        </div>)}</div>
      </div>
    </section>
    <section className="pr-section pr-photo-location-section" aria-labelledby="official-location-heading">
      <div className="pr-section-header"><h3 id="official-location-heading">Photo Location Verification</h3></div>
      <div className="pr-gps-card">
        <div className="pr-gps-top"><div className="pr-gps-title">Location Verification</div><button type="button" className="pr-secondary-button" disabled={disabled || verifying || !photos.length} onClick={verify}>{verifying ? "Reading Photo..." : "Verify Photo Location"}</button></div>
        <p>Original uploads require readable EXIF GPS and timestamps. Browser camera photos use a backend-verified capture session. MENRO Field Reports require private verified evidence before Admin approval.</p>
        {diagnostic && <p role="alert">{diagnostic.message}</p>}
        {photos.find(row => row.location) && <dl className="pr-gps-values"><div><dt>Latitude</dt><dd>{photos.find(row => row.location).location.latitude.toFixed(6)}</dd></div><div><dt>Longitude</dt><dd>{photos.find(row => row.location).location.longitude.toFixed(6)}</dd></div><div><dt>Source</dt><dd>{photos.find(row => row.location).descriptor.source === "browser-camera" ? "Browser Capture Session" : "Photo Metadata (EXIF)"}</dd></div><div><dt>Verification</dt><dd>{photos.find(row => row.location).status === "verified" ? "Backend-verified capture" : "EXIF preview ready - server verification required"}</dd></div></dl>}
        {ready && <SiteMap site={site} photos={photos} />}
      </div>
    </section>
    {camera && <ModalDialog label="Secure planting camera" className="official-camera-host" onClose={() => setCamera(false)}><SecureCameraCapture open request={cameraRequest}
      binding={{ workflow: "planting-report", siteId: site.siteId, eventId: site.eventId, distributionId: site.requestId }}
      onDiagnostic={setDiagnostic}
      onVerified={({ file, descriptor, location }) => { if (!scope.current || scope.current !== activeCameraScope) return; onChange([...photos, { id: crypto.randomUUID(), file, descriptor, location, status: "verified" }]); onError(""); setDiagnostic(null); setCamera(false); }}
      onCancel={() => setCamera(false)} onViewLocation={() => setCamera(false)} /></ModalDialog>}
  </>;
}
