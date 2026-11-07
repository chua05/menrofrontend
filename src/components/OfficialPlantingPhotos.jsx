import PlantingPhotoControls from "./PlantingPhotoControls";
import PlantingLocationMap from "./PlantingLocationMap";
import PhotoRequirementsDialog from "./PhotoRequirementsDialog";
import { useEffect, useRef, useState } from "react";
import { FiCamera, FiInfo, FiNavigation } from "react-icons/fi";
import * as exifr from "exifr";
import SecureCameraCapture from "./SecureCameraCapture";
import ModalDialog from "./ModalDialog";
import { authenticatedFetch } from "../services/authenticatedApi";
import { extractGpsCoordinates } from "../utils/exifGps";
import { buildEvidenceLocationView } from "../utils/evidenceLocationView";
import { buildLocationPreviewStatus, compareEvidenceToSite, coordinateValue, isOutsideSite, isPointInBulanBoundary } from "../utils/plantingLocationPreview";
const NO_RELEASE_MESSAGE = "Select a released request before adding planting photos.";
const CAMERA_DIAGNOSTIC = "camera-diagnostic";
const sourceLabel = source => source === "browser-camera" ? "Browser Capture Session" : "Photo Metadata (EXIF)";
function Preview({ file }) {
  const image = useRef(null);
  useEffect(() => { const url = URL.createObjectURL(file); image.current.src = url; return () => URL.revokeObjectURL(url); }, [file]);
  return <img ref={image} alt={`Planting evidence: ${file.name}`}  />;
}
function photoEvidence(row) {
  if (!row) return null;
  return { latitude: row.location?.latitude, longitude: row.location?.longitude, accuracy: row.location?.accuracy,
    boundaryRule: row.location?.boundaryRule, boundaryLimitMeters: row.location?.boundaryLimitMeters,
    source: row.descriptor.source, sourceLabel: sourceLabel(row.descriptor.source),
    verification: row.status === "verified" ? "Backend-verified capture" : "EXIF preview ready - server verification required",
    waitingLabel: row.location ? "" : "Select Verify Photo Location to read this photo's GPS." };
}
function diagnosticEvidence(diagnostic) {
  if (!diagnostic) return null;
  return { latitude: diagnostic.location?.latitude, longitude: diagnostic.location?.longitude, accuracy: diagnostic.location?.accuracy,
    gpsStatus: diagnostic.status, source: "browser-camera", sourceLabel: sourceLabel("browser-camera"), verification: "Not accepted",
    waitingLabel: diagnostic.status === "low_accuracy" ? "Low GPS Accuracy" : "Camera Location Rejected" };
}
function boundaryRuleLabel(evidence, comparison) {
  if (evidence?.boundaryRule === "configured-radius" || comparison.radiusMeters !== null) return `Configured radius (${evidence?.boundaryLimitMeters ?? comparison.radiusMeters} m)`;
  if (evidence?.boundaryRule === "site-polygon" || comparison.insidePolygon !== null) return "Authoritative site polygon";
  return "50 m site-distance fallback where applicable";
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
  const [requirements, setRequirements] = useState(false), [focusId, setFocusId] = useState(null);
  const [boundaries, setBoundaries] = useState(null), [boundaryFailed, setBoundaryFailed] = useState(false);
  useEffect(() => { const key = `${site?.requestId || ""}:${site?.eventId || ""}:${site?.siteId || ""}`; scope.current = key; return () => { scope.current = null; }; }, [site?.requestId, site?.eventId, site?.siteId]);
  const ready = Boolean(site && Number.isFinite(site.latitude) && Number.isFinite(site.longitude) && site.eventId && site.requestId && site.siteId);
  const evidence = focusId === CAMERA_DIAGNOSTIC && diagnostic ? diagnosticEvidence(diagnostic)
    : photoEvidence(photos.find(row => row.id === focusId)) || diagnosticEvidence(diagnostic) || photoEvidence(photos.find(row => row.location) || photos[0]);
  const latitude = coordinateValue(evidence?.latitude), longitude = coordinateValue(evidence?.longitude);
  const hasGps = Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  const comparison = compareEvidenceToSite(site, hasGps ? evidence : null);
  const municipalityStatus = !hasGps ? "unverified" : boundaryFailed ? "unavailable" : !boundaries ? "checking"
    : isPointInBulanBoundary(latitude, longitude, boundaries) ? "inside" : "outside";
  const accuracy = coordinateValue(evidence?.accuracy);
  const status = buildLocationPreviewStatus({ hasSite: Boolean(site), hasGps, gpsStatus: evidence?.gpsStatus, accuracy, municipalityStatus, ...comparison,
    waitingLabel: evidence?.waitingLabel || (photos.length ? "Photo GPS metadata is unavailable." : "Upload or take a photo first.") });
  const locationResult = buildEvidenceLocationView({ gpsStatus: evidence?.gpsStatus || (hasGps ? "valid" : "missing"), latitude, longitude, accuracy,
    evidenceSource: evidence?.source === "browser-camera" ? "browser-camera" : "original-exif",
    outsideMunicipality: municipalityStatus === "outside", outsideSite: hasGps && isOutsideSite(comparison) });
  function add(files) {
    if (disabled) return;
    if (!site) return onError(NO_RELEASE_MESSAGE);
    if (photos.length + files.length > 10 || files.some(file => file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) return onError("Choose at most 10 original JPEG, PNG or WebP planting photos, each up to 10 MB.");
    onError(""); onChange([...photos, ...files.map(file => ({ id: crypto.randomUUID(), file, descriptor: { source: "uploaded-original" }, status: "unverified" }))]);
  }
  function startCamera() {
    setRequirements(false);
    if (!site) return onError(NO_RELEASE_MESSAGE);
    if (!ready || disabled || verifying || photos.length >= 10) return;
    setDiagnostic(null); setActiveCameraScope(scope.current); setCamera(true);
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
      <div className="pr-section-header pr-photo-section-header"><h3 id="official-evidence-heading"><FiCamera size={15} /> Planting Photo Evidence</h3>
        <button type="button" className="pr-reminder-button" onClick={() => setRequirements(true)}><FiInfo size={14} /> Reminder</button></div>
      <div className="pr-photo-content">
        <PlantingPhotoControls count={photos.length} disabled={disabled || (site && !ready) || verifying} error={error}
          onCamera={startCamera} onFiles={add} />
        {site && !ready && <p>Authoritative registered-site coordinates are required. Ask an authorized MENRO officer to correct the linked site before capture.</p>}
        <div className="pr-evidence-grid">{photos.map(row => <div className="pr-preview-card" key={row.id}>
          <Preview file={row.file} /><div className="pr-preview-footer"><div className="pr-preview-file"><strong className="pr-preview-name">{row.file.name}</strong></div>
          <div className={`pr-preview-verification pr-preview-verification-${row.status === "unverified" ? "info" : "success"}`} role="status"><strong>{row.status === "verified" ? "Backend-verified camera capture" : row.status === "ready" ? "EXIF preview ready - server verification required on upload" : "Verify original GPS metadata"}</strong><span>Location Source: {sourceLabel(row.descriptor.source)}</span></div>
          {row.location && <button type="button" className="pr-secondary-button" aria-label={`Show planting photo ${row.file.name} on map`} onClick={() => setFocusId(row.id)}>Show on Map</button>}
          <button type="button" disabled={disabled || verifying} className="pr-secondary-button" aria-label={`Remove planting photo ${row.file.name}`} onClick={() => { onChange(photos.filter(photo => photo.id !== row.id)); onError(""); }}>Remove</button></div>
        </div>)}</div>
      </div>
    </section>
    <section className="pr-section pr-photo-location-section" aria-labelledby="official-location-heading">
      <div className="pr-section-header"><h3 id="official-location-heading"><FiNavigation size={15} /> Photo Location Verification</h3></div>
      <div className="pr-gps-card">
        <div className="pr-gps-top"><div className="pr-gps-title">Location Verification</div><button type="button" className="pr-secondary-button" disabled={disabled || verifying || !photos.length} onClick={verify}>{verifying ? "Reading Photo..." : "Verify Photo Location"}</button></div>
        {diagnostic && <p role="alert">{diagnostic.message}</p>}
        {hasGps && <div className="pr-gps-captured">
          {[["Latitude", latitude.toFixed(6)], ["Longitude", longitude.toFixed(6)], ["Source", evidence.sourceLabel],
            ["GPS Accuracy", Number.isFinite(accuracy) && accuracy >= 0 ? `${accuracy.toFixed(1)} m` : "Not provided by EXIF"],
            ["Distance from Site", comparison.distanceMeters !== null ? `${comparison.distanceMeters.toFixed(1)} m` : "Unable to calculate"],
            ["Boundary Rule", boundaryRuleLabel(evidence, comparison)], ["Location Status", locationResult.label], ["Verification", evidence.verification]]
            .map(([label, value]) => <div key={label}><div className="pr-gps-value-label">{label}</div><div className="pr-gps-value">{value}</div></div>)}
        </div>}
        <PlantingLocationMap site={site} evidence={hasGps ? evidence : null} status={status} onBoundaries={setBoundaries} onBoundaryError={() => setBoundaryFailed(true)} />
        {boundaryFailed && <p role="status">Barangay boundaries could not be loaded. The server still checks the Municipality of Bulan boundary on upload.</p>}
      </div>
    </section>
    {requirements && <PhotoRequirementsDialog onClose={() => setRequirements(false)} onTakePhoto={startCamera} />}
    {camera && <ModalDialog label="Secure planting camera" className="official-camera-host" onClose={() => setCamera(false)}><SecureCameraCapture open request={cameraRequest}
      binding={{ workflow: "planting-report", siteId: site.siteId, eventId: site.eventId, distributionId: site.requestId }}
      onDiagnostic={next => { setDiagnostic(next); setFocusId(CAMERA_DIAGNOSTIC); }}
      onVerified={({ file, descriptor, location }) => { if (!scope.current || scope.current !== activeCameraScope) return; const id = crypto.randomUUID(); onChange([...photos, { id, file, descriptor, location, status: "verified" }]); onError(""); setDiagnostic(null); setFocusId(id); setCamera(false); }}
      onCancel={() => setCamera(false)} onViewLocation={() => setCamera(false)} /></ModalDialog>}
  </>;
}
