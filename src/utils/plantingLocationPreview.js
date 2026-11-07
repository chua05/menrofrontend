// Shared by the participant and staff planting forms so both report the same
// location outcome. The backend remains the authority on accepted evidence.
export const SITE_GPS_TOLERANCE_METERS = 50;

// Number(null) is 0, which would turn a missing coordinate into a real point.
export function coordinateValue(value) {
  return value === null || value === undefined || value === "" ? Number.NaN : Number(value);
}

export function getFeatureBarangayName(feature) {
  const properties = feature?.properties || {};
  return (
    properties.ADM4_EN ||
    properties.brgy_name ||
    properties.barangay ||
    properties.name ||
    properties.NAME ||
    ""
  );
}

export function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;

  const latitude1 = toRadians(Number(lat1));
  const latitude2 = toRadians(Number(lat2));
  const latitudeDelta = toRadians(Number(lat2) - Number(lat1));
  const longitudeDelta = toRadians(Number(lng2) - Number(lng1));

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

export function isPointInPolygon(latitude, longitude, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;

  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentLatitude = Number(polygon[index]?.lat);
    const currentLongitude = Number(polygon[index]?.lng);
    const previousLatitude = Number(polygon[previous]?.lat);
    const previousLongitude = Number(polygon[previous]?.lng);

    if (![currentLatitude, currentLongitude, previousLatitude, previousLongitude].every(Number.isFinite)) {
      return false;
    }

    const intersects = currentLatitude > latitude !== previousLatitude > latitude &&
      longitude < ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
        (previousLatitude - currentLatitude) + currentLongitude;
    if (intersects) inside = !inside;
  }

  return inside;
}

function isPointInGeoJsonRing(latitude, longitude, ring) {
  return isPointInPolygon(
    latitude,
    longitude,
    (ring || []).map((coordinate) => ({ lat: coordinate?.[1], lng: coordinate?.[0] }))
  );
}

function isPointInGeoJsonPolygon(latitude, longitude, coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return false;
  if (!isPointInGeoJsonRing(latitude, longitude, coordinates[0])) return false;
  return !coordinates.slice(1).some((hole) =>
    isPointInGeoJsonRing(latitude, longitude, hole)
  );
}

export function isPointInBulanBoundary(latitude, longitude, geoJson) {
  if (geoJson?.type !== "FeatureCollection" || !Array.isArray(geoJson.features)) return false;
  return geoJson.features.some((feature) => {
    const geometry = feature?.geometry;
    if (geometry?.type === "Polygon") {
      return isPointInGeoJsonPolygon(latitude, longitude, geometry.coordinates);
    }
    if (geometry?.type === "MultiPolygon") {
      return geometry.coordinates.some((polygon) =>
        isPointInGeoJsonPolygon(latitude, longitude, polygon)
      );
    }
    return false;
  });
}

export function compareEvidenceToSite(site, evidence) {
  const radius = Number(site?.coverageRadiusMeters);
  const radiusMeters = Number.isFinite(radius) && radius > 0 ? radius : null;
  const latitude = coordinateValue(evidence?.latitude), longitude = coordinateValue(evidence?.longitude);
  const siteLatitude = coordinateValue(site?.latitude), siteLongitude = coordinateValue(site?.longitude);
  const hasEvidence = Number.isFinite(latitude) && Number.isFinite(longitude);
  const hasPolygon = Array.isArray(site?.polygon) && site.polygon.length >= 3;
  return {
    distanceMeters: hasEvidence && Number.isFinite(siteLatitude) && Number.isFinite(siteLongitude)
      ? calculateDistanceMeters(latitude, longitude, siteLatitude, siteLongitude) : null,
    radiusMeters,
    insidePolygon: hasEvidence && radiusMeters === null && hasPolygon
      ? isPointInPolygon(latitude, longitude, site.polygon) : null,
  };
}

export function isOutsideSite({ distanceMeters, radiusMeters, insidePolygon }) {
  if (radiusMeters !== null) return distanceMeters !== null && distanceMeters > radiusMeters;
  return insidePolygon === false ||
    (insidePolygon === null && distanceMeters !== null && distanceMeters > SITE_GPS_TOLERANCE_METERS);
}

export function buildLocationPreviewStatus({
  hasSite,
  hasGps,
  waitingLabel,
  gpsStatus,
  accuracy,
  municipalityStatus,
  distanceMeters = null,
  radiusMeters = null,
  insidePolygon = null,
}) {
  if (!hasSite) {
    return { type: "waiting", label: "Select a registered planting site first." };
  }

  if (!hasGps) {
    return { type: "waiting", label: waitingLabel };
  }

  if (gpsStatus === "low_accuracy") {
    return {
      type: "flagged",
      label: `Low GPS Accuracy — ${Math.round(accuracy)} m reported; 50 m or better is required.`,
    };
  }

  if (municipalityStatus === "checking") {
    return { type: "waiting", label: "Checking Municipality of Bulan boundary..." };
  }

  if (municipalityStatus === "outside") {
    return { type: "flagged", label: "Outside Municipality of Bulan" };
  }

  if (radiusMeters !== null && distanceMeters !== null && distanceMeters <= radiusMeters) {
    return {
      type: "valid",
      label: `Within registered site coverage (${distanceMeters.toFixed(1)} m from center; ${radiusMeters} m radius).`,
    };
  }

  if (insidePolygon === true) {
    return { type: "valid", label: "Photo location is inside the legacy registered site boundary." };
  }

  if (radiusMeters === null && insidePolygon === null && distanceMeters !== null &&
      distanceMeters <= SITE_GPS_TOLERANCE_METERS) {
    return {
      type: "valid",
      label: `Within registered site tolerance (${distanceMeters.toFixed(1)} m away).`,
    };
  }

  if (insidePolygon === null && distanceMeters === null) {
    return { type: "warning", label: "Unable to compare GPS with the registered site coordinates." };
  }

  return {
    type: "warning",
    label: radiusMeters !== null
      ? `Photo location is ${distanceMeters.toFixed(1)} m from the site center and outside its ${radiusMeters} m coverage.`
      : insidePolygon === false
        ? "Photo location is outside the legacy registered site boundary."
        : `Photo location is ${distanceMeters.toFixed(1)} m from the registered site.`,
  };
}
