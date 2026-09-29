export function rationalToNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (Array.isArray(value) && value.length === 2) {
    const numerator = Number(value[0]);
    const denominator = Number(value[1]);
    return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0 ? numerator / denominator : NaN;
  }
  if (value && typeof value === "object") {
    const numerator = Number(value.numerator ?? value.num);
    const denominator = Number(value.denominator ?? value.den);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) return numerator / denominator;
  }
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?\s*\/\s*-?\d+(?:\.\d+)?$/.test(value.trim())) {
    const [numerator, denominator] = value.split("/").map(Number);
    return denominator !== 0 ? numerator / denominator : NaN;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function parts(value) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return Array.from(value);
  if (value && typeof value === "object" && (value.degrees !== undefined || value.degree !== undefined)) {
    return [value.degrees ?? value.degree, value.minutes ?? value.minute ?? 0, value.seconds ?? value.second ?? 0];
  }
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/[NSEW]\s*$/i, "");
    const tokens = cleaned.match(/-?\d+(?:\.\d+)?(?:\s*\/\s*-?\d+(?:\.\d+)?)?/g);
    if (tokens?.length >= 3) return tokens.slice(0, 3);
  }
  return null;
}

function coordinate(value, reference, maximum) {
  const dms = parts(value);
  let result;
  if (dms) {
    if (dms.length < 3) return { status: "unparseable", value: null };
    const [degrees, minutes, seconds] = dms.slice(0, 3).map(rationalToNumber);
    if (![degrees, minutes, seconds].every(Number.isFinite) || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return { status: "unparseable", value: null };
    result = Math.abs(degrees) + minutes / 60 + seconds / 3600;
    if (degrees < 0) result *= -1;
  } else result = rationalToNumber(value);
  if (!Number.isFinite(result)) return { status: "unparseable", value: null };
  const direction = String(reference || "").trim().toUpperCase();
  if (["S", "W"].includes(direction)) result = -Math.abs(result);
  if (["N", "E"].includes(direction)) result = Math.abs(result);
  if (result < -maximum || result > maximum) return { status: "invalid", value: result };
  return { status: "valid", value: result };
}

export function extractGpsCoordinates(metadata = {}) {
  const gps = metadata.gps || metadata.GPS || metadata.GPSInfo || {};
  const rawLatitude = metadata.latitude ?? metadata.GPSLatitude ?? gps.latitude ?? gps.GPSLatitude;
  const rawLongitude = metadata.longitude ?? metadata.GPSLongitude ?? gps.longitude ?? gps.GPSLongitude;
  if (rawLatitude == null && rawLongitude == null) return { status: "missing", latitude: null, longitude: null };
  if (rawLatitude == null || rawLongitude == null) return { status: "unparseable", latitude: null, longitude: null };
  const latitude = coordinate(rawLatitude, metadata.GPSLatitudeRef ?? gps.GPSLatitudeRef, 90);
  const longitude = coordinate(rawLongitude, metadata.GPSLongitudeRef ?? gps.GPSLongitudeRef, 180);
  if (latitude.status === "invalid" || longitude.status === "invalid") return { status: "invalid", latitude: latitude.value, longitude: longitude.value };
  if (latitude.status !== "valid" || longitude.status !== "valid") return { status: "unparseable", latitude: null, longitude: null };
  return { status: "valid", latitude: latitude.value, longitude: longitude.value };
}
