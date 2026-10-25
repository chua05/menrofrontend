import { MAX_BROWSER_CAMERA_ACCURACY_METERS } from "./cameraCapturePolicy.js";

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
  const numericAccuracy = Number(accuracy);
  if (gpsStatus === "low_accuracy" ||
      (evidenceSource === "browser-camera" && Number.isFinite(numericAccuracy) &&
        numericAccuracy > MAX_BROWSER_CAMERA_ACCURACY_METERS)) {
    return { code: "low_accuracy", label: "Low GPS Accuracy", marker };
  }
  if (outsideMunicipality || outsideSite) {
    return { code: "outside_site", label: "Outside Planting Site", marker };
  }
  return { code: "valid", label: "Valid", marker };
}
