import { isAcceptableBrowserCameraAccuracy } from "./cameraCapturePolicy.js";

export function buildEvidenceLocationView({
  gpsStatus = "missing",
  latitude,
  longitude,
  accuracy,
  evidenceSource = "",
  outsideMunicipality = false,
  outsideSite = false,
} = {}) {
  const numericLatitude = Number(latitude);
  const numericLongitude = Number(longitude);
  const coordinatesValid = Number.isFinite(numericLatitude) && numericLatitude >= -90 && numericLatitude <= 90 &&
    Number.isFinite(numericLongitude) && numericLongitude >= -180 && numericLongitude <= 180;
  const marker = coordinatesValid ? { latitude: numericLatitude, longitude: numericLongitude } : null;

  if (gpsStatus === "missing") return { code: "missing", label: "Missing GPS Metadata", marker: null };
  if (gpsStatus === "unparseable") return { code: "unreadable", label: "Unreadable GPS Metadata", marker: null };
  if (gpsStatus === "invalid" || !coordinatesValid) {
    return { code: "invalid", label: "Invalid GPS Coordinates", marker: null };
  }
  if (gpsStatus === "low_accuracy" ||
      (evidenceSource === "browser-camera" && !isAcceptableBrowserCameraAccuracy(accuracy))) {
    return { code: "low_accuracy", label: "Low GPS Accuracy", marker };
  }
  if (outsideMunicipality || outsideSite) {
    return { code: "outside_site", label: "Outside Planting Site", marker };
  }
  return { code: "valid", label: "Valid", marker };
}

const VERIFIED_CAPTURE_GPS_LABEL = "Not required — verified camera capture";
const isVerifiedCapture = evidence => evidence?.evidenceSource === "browser-camera" ||
  evidence?.locationSource === "Browser Capture Session";

// Camera captures carry a backend-verified location, not EXIF, so only uploads can be missing it.
export function photoGpsMetadataLabel(record = {}) {
  const photos = Array.isArray(record.photos) ? record.photos : [];
  const uploads = photos.filter(photo => !isVerifiedCapture(photo));
  if (photos.length && !uploads.length) return VERIFIED_CAPTURE_GPS_LABEL;
  if (!photos.length && isVerifiedCapture(record)) return VERIFIED_CAPTURE_GPS_LABEL;
  const present = uploads.length ? uploads.every(photo => photo.gpsMetadataPresent === true) : record.gpsMetadataPresent;
  if (present === true) return "Present";
  return present === false ? "Missing" : "—";
}
