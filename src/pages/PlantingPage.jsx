import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as exifr from "exifr";

import {
  FiCamera,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiFileText,
  FiFilter,
  FiGitBranch,
  FiImage,
  FiMapPin,
  FiNavigation,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiTrash2,
  FiX,
  FiXCircle,
} from "react-icons/fi";

import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase/config";
import { formatDisplayId } from "../utils/displayId";
import { JUBAN_BARANGAYS, userTypeField } from "../utils/userTypes";
import "../styles/planting-reports.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const MAX_EVIDENCE_PHOTOS = 10;
const SITE_GPS_TOLERANCE_METERS = 20;
const OUTSIDE_SITE_WARNING =
  "The verified photo location is outside the selected planting site. You may still submit the report for MENRO Staff verification.";
const SITE_MATCH_MESSAGE =
  "Photo location successfully verified and matches the selected planting site.";
const OUTSIDE_JUBAN_MESSAGE =
  "Your photo is outside the Municipality of Juban coverage area. Please use a photo taken within Juban and try again.";
const MISSING_EXIF_MESSAGE =
  "GPS location metadata was not found in this photo. Please upload the original geotagged photo and try again.";
const NO_DISTRIBUTION_MESSAGE =
  "No released sapling distributions are available for this planting event.";
const PHOTO_EXIF_LOCATION_SOURCE = "Photo Metadata (EXIF)";
const DEVICE_CAPTURE_LOCATION_SOURCE = "Device Location at Capture";
const BARANGAY_GEOJSON_URL = "/data/juban-barangays.geojson";
const JUBAN_FALLBACK_CENTER = { lat: 12.82, lng: 124.0 };

const STATUS_OPTIONS = [
  "Pending",
  "Pending Review",
  "Approved",
  "Rejected",
];

const VERIFICATION_CLASSES = {
  Pending: "pr-status-reviewed",
  "Pending Review": "pr-status-reviewed",
  Approved: "pr-status-approved",
  Rejected: "pr-status-rejected",
};

function displayReportStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "draft" || normalized === "pending") return "Pending";
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "pending review") return "Pending Review";
  return status || "Pending";
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function normalizeTimestamp(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") return value.toDate();

  if (typeof value === "object") {
    const seconds = value._seconds ?? value.seconds;
    if (Number.isFinite(seconds)) return new Date(seconds * 1000);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = normalizeTimestamp(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSiteId(site) {
  return site?.id || site?.siteId || site?.plantingSiteId || "";
}

function getSiteName(site) {
  return site?.siteName || site?.name || site?.plantingSiteName || "";
}

function getSiteBarangay(site) {
  return site?.barangay || site?.barangayName || "";
}

function getEventId(event) {
  return event?.id || event?.eventId || "";
}

function getEventName(event) {
  return event?.eventName || event?.name || event?.title || event?.activityName || "";
}

function getParticipantTypeLabel(value) {
  return value || "—";
}

function getEventDateValue(event) {
  const value = event?.date || event?.eventDate || event?.startDate || "";
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const seconds = value?._seconds ?? value?.seconds;
  const date = Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function getProfileAffiliation(profile) {
  return profile?.affiliationName || profile?.userTypeDetail ||
    profile?.organization || profile?.barangay || "";
}

function getProfileAffiliationLabel(profile) {
  const field = userTypeField(profile?.userType);
  return field?.label?.replace(" *", "") || "Affiliation";
}

function getFeatureBarangayName(feature) {
  const properties = feature?.properties || {};
  return (
    properties.brgy_name ||
    properties.barangay ||
    properties.name ||
    properties.NAME ||
    ""
  );
}

function normalizeBarangayName(value) {
  return String(value || "")
    .trim()
    .replace(/Ã±/gi, "n")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^barangay\s+/i, "")
    .toLowerCase();
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

function isPointInJubanBoundary(latitude, longitude, geoJson) {
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

function getDistributionReference(distribution) {
  return distribution?.requestNumber || distribution?.distributionNumber || "Released distribution";
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
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

function isPointInPolygon(latitude, longitude, polygon) {
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

function getCurrentUserIdentity(currentUser) {
  const id = currentUser?.uid || currentUser?.id || currentUser?.email || "";
  const name =
    currentUser?.displayName ||
    currentUser?.fullName ||
    currentUser?.name ||
    currentUser?.email ||
    "Current User";

  return { id, name };
}

export default function PlantingPage() {
  const { userRole, currentUser } = useAuth();
  const [pageSearchParams] = useSearchParams();

  const isParticipant = userRole === "participant";
  const canReview = userRole === "staff";

  const cameraInputRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const uploadInputRef = useRef(null);
  const previewUrlsRef = useRef([]);
  const locationMapContainerRef = useRef(null);
  const locationMapRef = useRef(null);
  const locationBarangayLayerRef = useRef(null);
  const locationSiteLayerRef = useRef(null);
  const locationCapturedLayerRef = useRef(null);
  const openedReportFromSearchRef = useRef("");
  const eventsRequestSequenceRef = useRef(0);
  const noEventsAlertTimerRef = useRef(null);

  const currentIdentity = useMemo(
    () => getCurrentUserIdentity(currentUser),
    [currentUser]
  );

  const [records, setRecords] = useState([]);
  const [sites, setSites] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [events, setEvents] = useState([]);
  const [participantProfile, setParticipantProfile] = useState(currentUser || null);
  const [jubanGeoJson, setJubanGeoJson] = useState(null);

  const [loading, setLoading] = useState(true);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [eventsLoadStatus, setEventsLoadStatus] = useState("idle");
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [popup, setPopup] = useState({ message: "", type: "success" });
  const [locationLoading, setLocationLoading] = useState(false);
  const [verificationRemarks, setVerificationRemarks] = useState("");
  const [decision, setDecision] = useState("");
  const [reportError, setReportError] = useState("");
  const [noEventsAlertSiteId, setNoEventsAlertSiteId] = useState("");

  const [photoFiles, setPhotoFiles] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [locationPhotoSignature, setLocationPhotoSignature] = useState("");

  const [form, setForm] = useState({
    participantType: "",
    organizationAffiliation: "",
    barangay: "",
    distributionId: "",
    distributionItemKey: "",
    inventoryId: "",
    species: "",
    requestedQuantity: "",
    quantityReleased: "",
    remainingQuantity: "",
    quantity: "",
    plantingDate: "",
    siteId: "",
    siteName: "",
    eventId: "",
    eventName: "",
    latitude: "",
    longitude: "",
    accuracy: "",
    locationSource: "",
    photoCapturedAt: "",
    locationCapturedAt: "",
    remarks: "",
  });

  function showPopup(message, type = "success") {
    setPopup({ message: String(message || "").trim(), type });
  }

  function clearNoEventsAlert() {
    if (noEventsAlertTimerRef.current) {
      window.clearTimeout(noEventsAlertTimerRef.current);
      noEventsAlertTimerRef.current = null;
    }
    setNoEventsAlertSiteId("");
  }

  async function getAuthToken(forceRefresh = false) {
    // Wait until Firebase finishes restoring
    // the signed-in user after a page reload.
    if (typeof auth.authStateReady === "function") {
      await auth.authStateReady();
    }

    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      return "";
    }

    // Firebase refreshes the ID token when necessary.
    // forceRefresh=true is used once after a 401 response.
    const token = await firebaseUser.getIdToken(forceRefresh);

    // Temporary compatibility for older frontend code
    // that still reads the token from localStorage.
    window.localStorage.setItem("token", token);

    return token;
  }

  async function apiRequest(path, options = {}, allowRetry = true) {
    const token = await getAuthToken(false);

    if (!token) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const buildHeaders = (authToken) => ({
      Authorization: `Bearer ${authToken}`,
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    });

    let response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: buildHeaders(token),
    });

    // If Firebase restored an old cached token, force one
    // refresh and retry the request exactly once.
    if (response.status === 401 && allowRetry) {
      const refreshedToken = await getAuthToken(true);

      if (!refreshedToken) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: buildHeaders(refreshedToken),
      });
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      throw new Error(payload.message || "The request could not be completed.");
    }

    return payload;
  }

  function isSessionError(error) {
    return (
      error?.message ===
      "Your session has expired. Please sign in again."
    );
  }

  async function loadReports() {
    setLoading(true);
    setReportError("");

    try {
      const endpoint = isParticipant
        ? "/planting-reports/my-reports"
        : "/planting-reports";

      const response = await apiRequest(endpoint);
      setRecords(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setRecords([]);
      setReportError(isSessionError(error)
        ? error.message
        : "Unable to load planting reports. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSites() {
    try {
      const response = await apiRequest("/sites");
      const allSites = Array.isArray(response.data) ? response.data : [];

      setSites(
        allSites.filter(
          (site) =>
            String(site?.status || "active").toLowerCase() !== "inactive" &&
            String(site?.status || "").toLowerCase() !== "archived"
        )
      );
    } catch (error) {
      setSites([]);

      if (!isSessionError(error)) {
        showPopup(
          "Unable to load registered planting sites. Please try again.",
          "error"
        );
      }
    }
  }

  async function loadParticipantProfile() {
    if (!isParticipant) return;
    try {
      const response = await apiRequest("/auth/profile");
      if (response.data) {
        setParticipantProfile(response.data);
        setForm((previous) => ({
          ...previous,
          participantType: response.data.userType || "",
          organizationAffiliation: getProfileAffiliation(response.data),
        }));
      }
    } catch (error) {
      if (!isSessionError(error)) {
        showPopup("Unable to load your saved participant profile. Please try again.", "error");
      }
    }
  }

  async function loadEvents() {
    const requestSequence = ++eventsRequestSequenceRef.current;
    setEventsLoadStatus("loading");

    try {
      const response = await apiRequest("/events");
      if (requestSequence !== eventsRequestSequenceRef.current) return;
      const allEvents = Array.isArray(response.data) ? response.data : [];

      setEvents(
        allEvents.filter(
          (event) =>
            event?.archived !== true &&
            String(event?.status || "")
              .trim()
              .toLowerCase() !== "cancelled"
        )
      );
      setEventsLoadStatus("success");
    } catch (error) {
      if (requestSequence !== eventsRequestSequenceRef.current) return;
      setEvents([]);
      setEventsLoadStatus("error");

      if (!isSessionError(error)) {
        showPopup(
          "Unable to load planting events. Please try again.",
          "error"
        );
      }
    }
  }

  async function loadMyDistributions() {
    if (!isParticipant) return;

    try {
      const response = await apiRequest("/distributions/my-distributions");
      const raw = Array.isArray(response.data) ? response.data : [];

      const normalized = raw.filter((d) => d.status === "Released").map((d) => ({
        // normalize common id fields
        id: d.id || d.distributionId || d.releaseId || d.distribution_id || "",
        // preserve existing fields
        ...d,
        // normalize items array and per-item releasedQuantity field names
        items: Array.isArray(d.items)
          ? d.items.map((it) => ({
              ...it,
              releasedQuantity: it.releasedQuantity ?? it.quantityReleased ?? it.quantity_released ?? it.released ?? null,
            }))
          : undefined,
        // normalize single-species quantity
        quantityReleased: d.totalQuantityReleased ?? d.quantityReleased ?? d.releasedQuantity ?? d.quantity_released ?? null,
      }));

      setDistributions(normalized);
    } catch (error) {
      setDistributions([]);

      if (!isSessionError(error)) {
        showPopup(
          "Unable to load released sapling distributions. Please try again.",
          "error"
        );
      }
    }
  }

  async function refreshReferenceData() {
    setReferenceLoading(true);

    try {
      await Promise.all([
        isParticipant ? loadParticipantProfile() : Promise.resolve(),
        loadSites(),
        loadEvents(),
        isParticipant ? loadMyDistributions() : Promise.resolve(),
      ]);
    } finally {
      setReferenceLoading(false);
    }
  }

  const selectedSite =
    sites.find(
      (site) =>
        String(getSiteId(site)) ===
        String(form.siteId)
    ) || null;

  const hasGps =
    form.latitude !== "" &&
    form.longitude !== "";

  useEffect(() => {
  const initializationTimer =
    window.setTimeout(() => {
      loadReports();
      refreshReferenceData();
    }, 0);

  return () =>
    window.clearTimeout(
      initializationTimer
    );
}, [userRole]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const reportId = pageSearchParams.get("report") || "";
    if (!reportId || loading || openedReportFromSearchRef.current === reportId) return;
    const record = records.find((item) => String(item.id || item.reportId || "") === reportId);
    if (!record) return;
    const openTimer = window.setTimeout(() => {
      openedReportFromSearchRef.current = reportId;
      setSelectedRecord(record);
      setVerificationRemarks("");
      setShowViewModal(true);
    }, 0);
    return () => window.clearTimeout(openTimer);
  }, [loading, pageSearchParams, records]);

  useEffect(() => {
    if (!popup.message) return undefined;

    const timeout = window.setTimeout(() => {
      setPopup({ message: "", type: "success" });
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [popup]);

  useEffect(() => {
    if (cameraOpen && cameraVideoRef.current && cameraStreamRef.current) {
      cameraVideoRef.current.srcObject = cameraStreamRef.current;
      void cameraVideoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!showSubmitModal || !locationMapContainerRef.current) return undefined;

    let cancelled = false;

    async function initializeLocationMap() {
      if (locationMapRef.current) {
        window.setTimeout(() => locationMapRef.current?.invalidateSize(), 0);
        return;
      }

      try {
        const map = L.map(locationMapContainerRef.current, {
          center: [JUBAN_FALLBACK_CENTER.lat, JUBAN_FALLBACK_CENTER.lng],
          zoom: 12,
          minZoom: 11,
          maxZoom: 19,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        locationSiteLayerRef.current = L.layerGroup().addTo(map);
        locationCapturedLayerRef.current = L.layerGroup().addTo(map);
        locationMapRef.current = map;

        const response = await fetch(BARANGAY_GEOJSON_URL);
        if (!response.ok) {
          throw new Error(`Unable to load Juban GeoJSON (${response.status}).`);
        }

        const geoJson = await response.json();
        if (cancelled) return;

        if (
          geoJson?.type !== "FeatureCollection" ||
          !Array.isArray(geoJson.features)
        ) {
          throw new Error("Invalid Juban barangay GeoJSON.");
        }

        setJubanGeoJson(geoJson);

        const barangayLayer = L.geoJSON(geoJson, {
          style: (feature) => {
            const featureBarangay = getFeatureBarangayName(feature);
            const selected =
              form.barangay &&
              featureBarangay.trim().toLowerCase() ===
                form.barangay.trim().toLowerCase();

            return {
              color: selected ? "#0f6b3c" : "#17643a",
              weight: selected ? 2.6 : 1.25,
              opacity: selected ? 1 : 0.82,
              fillColor: "#eaf7ef",
              fillOpacity: selected ? 0.12 : 0,
            };
          },
          onEachFeature: (feature, layer) => {
            const barangayName = getFeatureBarangayName(feature);
            if (barangayName) {
              layer.bindTooltip(String(barangayName), {
                permanent: true,
                direction: "center",
                className: "pr-map-barangay-label",
                opacity: 1,
              });
            }
          },
        }).addTo(map);

        locationBarangayLayerRef.current = barangayLayer;
        const bounds = barangayLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [24, 24] });
        }

        window.setTimeout(() => map.invalidateSize(), 0);
      } catch (error) {
        console.error("Failed to load planting-report location preview:", error);
        if (!cancelled) {
          showPopup("Unable to load the Juban map preview. Check the boundary file and map connection.", "error");
        }
      }
    }

    initializeLocationMap();

    return () => {
      cancelled = true;
      if (locationMapRef.current) {
        locationMapRef.current.remove();
        locationMapRef.current = null;
      }
      locationBarangayLayerRef.current = null;
      locationSiteLayerRef.current = null;
      locationCapturedLayerRef.current = null;
    };
  }, [showSubmitModal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const layer = locationBarangayLayerRef.current;
    if (!layer) return;

    layer.eachLayer((barangayLayer) => {
      const barangayName = getFeatureBarangayName(barangayLayer.feature);
      const selected =
        form.barangay &&
        barangayName.trim().toLowerCase() === form.barangay.trim().toLowerCase();

      if (typeof barangayLayer.setStyle === "function") {
        barangayLayer.setStyle({
          color: selected ? "#0f6b3c" : "#17643a",
          weight: selected ? 2.6 : 1.25,
          opacity: selected ? 1 : 0.82,
          fillColor: "#eaf7ef",
          fillOpacity: selected ? 0.12 : 0,
        });
      }
    });
  }, [form.barangay]);


  

  useEffect(() => {
    const map = locationMapRef.current;
    const siteLayer = locationSiteLayerRef.current;
    const capturedLayer = locationCapturedLayerRef.current;

    if (!map || !siteLayer || !capturedLayer) return;

    siteLayer.clearLayers();
    capturedLayer.clearLayers();

    const fitPoints = [];

    if (selectedSite) {
      const siteLatitude = Number(selectedSite.latitude);
      const siteLongitude = Number(selectedSite.longitude);

      const polygonPath = Array.isArray(selectedSite.polygon)
        ? selectedSite.polygon
            .filter(
              (point) =>
                Number.isFinite(Number(point?.lat)) &&
                Number.isFinite(Number(point?.lng))
            )
            .map((point) => [Number(point.lat), Number(point.lng)])
        : [];

      if (polygonPath.length >= 3) {
        L.polygon(polygonPath, {
          color: "#17643a",
          weight: 2,
          opacity: 1,
          fillColor: "#6fb98a",
          fillOpacity: 0.18,
        })
          .bindTooltip(getSiteName(selectedSite) || "Registered Planting Site")
          .addTo(siteLayer);
        fitPoints.push(...polygonPath);
      }

      if (Number.isFinite(siteLatitude) && Number.isFinite(siteLongitude)) {
        L.circleMarker([siteLatitude, siteLongitude], {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: "#17643a",
          fillOpacity: 1,
        })
          .bindTooltip(
            `${getSiteName(selectedSite) || "Registered Planting Site"} • Site GPS`,
            { direction: "top", offset: [0, -8] }
          )
          .addTo(siteLayer);
        fitPoints.push([siteLatitude, siteLongitude]);
      }
    }

    if (hasGps) {
      const latitude = Number(form.latitude);
      const longitude = Number(form.longitude);
      const accuracy = Number(form.accuracy);

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        L.circleMarker([latitude, longitude], {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: "#2563eb",
          fillOpacity: 1,
        })
          .bindTooltip("Verified Evidence Location", {
            permanent: false,
            direction: "top",
            offset: [0, -8],
          })
          .addTo(capturedLayer);

        if (Number.isFinite(accuracy) && accuracy > 0) {
          L.circle([latitude, longitude], {
            radius: accuracy,
            color: "#2563eb",
            weight: 1,
            opacity: 0.65,
            fillColor: "#60a5fa",
            fillOpacity: 0.08,
          }).addTo(capturedLayer);
        }

        fitPoints.push([latitude, longitude]);
      }
    }

    if (fitPoints.length > 0) {
      const bounds = L.latLngBounds(fitPoints);
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.4), {
          padding: [34, 34],
          maxZoom: 17,
        });
      }
    } else if (locationBarangayLayerRef.current) {
      const bounds = locationBarangayLayerRef.current.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24] });
      }
    }

    window.setTimeout(() => map.invalidateSize(), 0);
  }, [selectedSite, hasGps, form.latitude, form.longitude, form.accuracy]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
    };
  }, []);

  const availableDistributions = useMemo(
    () => distributions.filter((distribution) => distribution.status === "Released"),
    [distributions]
  );

  const barangaysWithSites = useMemo(
    () => new Set(sites.map((site) => normalizeBarangayName(getSiteBarangay(site))).filter(Boolean)),
    [sites]
  );

  const filteredSites = useMemo(() => {
    if (!form.barangay) return [];
    const selectedBarangay = normalizeBarangayName(form.barangay);
    return sites.filter((site) =>
      normalizeBarangayName(getSiteBarangay(site)) === selectedBarangay
    );
  }, [sites, form.barangay]);

  const filteredEvents = useMemo(() => {
  if (!form.siteId) {
    return [];
  }

  const selectedSiteId =
    String(form.siteId);

  return events.filter((event) => {
    const eventSiteId = String(
      event?.plantingSiteId ||
        event?.siteId ||
        ""
    );

    const recordStatus = String(
      event?.recordStatus || ""
    )
      .trim()
      .toLowerCase();

    const calendarStatus = String(
      event?.status || ""
    )
      .trim()
      .toLowerCase();

    const validRecordStatus = [
      "authorized",
      "scheduled",
      "approved",
      "completed",
    ].includes(recordStatus);

    const isCancelled =
      calendarStatus === "cancelled";

    return (
      eventSiteId === selectedSiteId &&
      validRecordStatus &&
      !isCancelled
    );
  });
}, [
  events,
  form.siteId,
]);

  useEffect(() => {
    const selectedSiteId = String(form.siteId || "");
    const shouldShow = showSubmitModal && selectedSiteId &&
      !referenceLoading && eventsLoadStatus === "success" && filteredEvents.length === 0;

    const synchronizeAlertTimer = window.setTimeout(() => {
      if (noEventsAlertTimerRef.current) {
        window.clearTimeout(noEventsAlertTimerRef.current);
        noEventsAlertTimerRef.current = null;
      }

      setNoEventsAlertSiteId(shouldShow ? selectedSiteId : "");

      if (shouldShow) {
        noEventsAlertTimerRef.current = window.setTimeout(() => {
          setNoEventsAlertSiteId((currentSiteId) =>
            currentSiteId === selectedSiteId ? "" : currentSiteId
          );
          noEventsAlertTimerRef.current = null;
        }, 10000);
      }
    }, 0);

    return () => {
      window.clearTimeout(synchronizeAlertTimer);
      if (noEventsAlertTimerRef.current) {
        window.clearTimeout(noEventsAlertTimerRef.current);
        noEventsAlertTimerRef.current = null;
      }
    };
  }, [showSubmitModal, form.siteId, referenceLoading, eventsLoadStatus,
    filteredEvents.length]);

  const visibleRecords = useMemo(() => {
    // The participant endpoint already scopes records to the authenticated user.
    return records;
  }, [records]);

  const eligibleDistributions = useMemo(() => {
    if (!form.siteId || !form.eventId) return [];
    const selectedEvent = events.find((event) =>
      String(getEventId(event)) === String(form.eventId));
    return availableDistributions
      .filter((distribution) =>
        (!distribution.plantingSiteId ||
          String(distribution.plantingSiteId) === String(form.siteId)) &&
        (String(distribution.eventId || "") === String(form.eventId) ||
          String(distribution.requestId || "") === String(selectedEvent?.sourceRequestId || "")));
  }, [availableDistributions, events, form.siteId, form.eventId]);

  const eligibleDistributionItems = useMemo(() => {
    const distribution = eligibleDistributions.find((entry) =>
      String(entry.id) === String(form.distributionId));
    if (!distribution) return [];
    const selectedEvent = events.find((event) =>
      String(getEventId(event)) === String(form.eventId));
    const recorded = selectedEvent?.recordedSeedlingsByInventory || {};
    const items = Array.isArray(distribution.items) && distribution.items.length > 0
      ? distribution.items
      : [{
          inventoryId: distribution.inventoryId || "",
          species: distribution.species || "Sapling",
          requestedQuantity: distribution.requestedQuantity,
          releasedQuantity: distribution.quantityReleased,
        }];
    return items.map((item) => {
      const releasedQuantity = Number(item.releasedQuantity ?? item.quantity ?? 0);
      return {
        ...item,
        distributionId: distribution.id,
        optionId: String(item.inventoryId || item.species),
        releasedQuantity,
        remainingQuantity: Math.max(0, releasedQuantity - Number(recorded[item.inventoryId] || 0)),
      };
    });
  }, [eligibleDistributions, events, form.distributionId, form.eventId]);

  const filteredRecords = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return visibleRecords.filter((record) => {
      const matchesStatus =
        statusFilter === "All" || displayReportStatus(record.verificationStatus) === statusFilter;

      const searchableText = [
        record.id,
        record.participantName,
        record.siteName,
        record.barangay,
        record.species,
        record.eventName,
        record.verificationStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (search.length === 0 || searchableText.includes(search));
    });
  }, [visibleRecords, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const total = visibleRecords.length;

    const pending = visibleRecords.filter((record) =>
      displayReportStatus(record.verificationStatus) === "Pending Review"
    ).length;

    const approved = visibleRecords.filter(
      (record) => record.verificationStatus === "Approved"
    ).length;

    const rejected = visibleRecords.filter(
      (record) => record.verificationStatus === "Rejected"
    ).length;

    const totalTrees = visibleRecords
      .filter((record) => record.verificationStatus !== "Rejected")
      .reduce((totalValue, record) => {
        const quantity = Number(record.quantityPlanted);
        return totalValue + (Number.isFinite(quantity) ? quantity : 0);
      }, 0);

    return { total, pending, approved, rejected, totalTrees };
  }, [visibleRecords]);

  const capturedSiteDistance = useMemo(() => {
    if (!hasGps || !selectedSite) return null;

    const siteLatitude = Number(selectedSite.latitude);
    const siteLongitude = Number(selectedSite.longitude);
    const capturedLatitude = Number(form.latitude);
    const capturedLongitude = Number(form.longitude);

    if (
      !Number.isFinite(siteLatitude) ||
      !Number.isFinite(siteLongitude) ||
      !Number.isFinite(capturedLatitude) ||
      !Number.isFinite(capturedLongitude)
    ) {
      return null;
    }

    return calculateDistanceMeters(
      capturedLatitude,
      capturedLongitude,
      siteLatitude,
      siteLongitude
    );
  }, [hasGps, selectedSite, form.latitude, form.longitude]);

  const capturedInsideSitePolygon = useMemo(() => {
    if (!hasGps || !Array.isArray(selectedSite?.polygon) || selectedSite.polygon.length < 3) return null;
    return isPointInPolygon(
      Number(form.latitude),
      Number(form.longitude),
      selectedSite.polygon
    );
  }, [hasGps, selectedSite, form.latitude, form.longitude]);

  const municipalityScopeStatus = useMemo(() => {
    if (!hasGps) return "unverified";
    if (!jubanGeoJson) return "checking";
    return isPointInJubanBoundary(
      Number(form.latitude),
      Number(form.longitude),
      jubanGeoJson
    ) ? "inside" : "outside";
  }, [hasGps, jubanGeoJson, form.latitude, form.longitude]);

  const isInsideSelectedSite = hasGps && (
    capturedInsideSitePolygon === true ||
    (capturedInsideSitePolygon === null && capturedSiteDistance !== null &&
      capturedSiteDistance <= SITE_GPS_TOLERANCE_METERS)
  );

  const locationPreviewStatus = useMemo(() => {
    if (!form.siteId) {
      return {
        type: "waiting",
        label: "Select a registered planting site first.",
      };
    }

    if (!hasGps) {
      return {
        type: "waiting",
        label: photoFiles.length === 0
          ? "Upload or take a photo first."
          : "Photo GPS metadata is unavailable.",
      };
    }

    if (municipalityScopeStatus === "checking") {
      return { type: "waiting", label: "Checking Municipality of Juban boundary..." };
    }

    if (municipalityScopeStatus === "outside") {
      return { type: "flagged", label: "Outside Municipality of Juban" };
    }

    if (capturedInsideSitePolygon === true) {
      return {
        type: "valid",
        label: "Photo location is inside the registered site boundary.",
      };
    }

    if (capturedInsideSitePolygon === null && capturedSiteDistance !== null &&
        capturedSiteDistance <= SITE_GPS_TOLERANCE_METERS) {
      return {
        type: "valid",
        label: `Within registered site tolerance (${capturedSiteDistance.toFixed(1)} m away).`,
      };
    }

    if (capturedInsideSitePolygon === null && capturedSiteDistance === null) {
      return {
        type: "warning",
        label: "Unable to compare GPS with the registered site coordinates.",
      };
    }

    return {
      type: "warning",
      label: capturedInsideSitePolygon === false
        ? "Photo location is outside the registered site boundary."
        : `Photo location is ${capturedSiteDistance.toFixed(1)} m from the registered site.`,
    };
  }, [form.siteId, hasGps, municipalityScopeStatus, capturedSiteDistance,
    capturedInsideSitePolygon, photoFiles.length]);

  const isOutsideAssignedSite = hasGps && (
    capturedInsideSitePolygon === false ||
    (capturedInsideSitePolygon === null && capturedSiteDistance !== null &&
      capturedSiteDistance > SITE_GPS_TOLERANCE_METERS)
  );

  const locationBlocksSubmission = hasGps && municipalityScopeStatus !== "inside";

  useEffect(() => {
    if (!showSubmitModal || !hasGps || municipalityScopeStatus === "checking" || !selectedSite) {
      return undefined;
    }
    const nextPopup = municipalityScopeStatus === "outside"
      ? { message: OUTSIDE_JUBAN_MESSAGE, type: "error" }
      : {
          message: isInsideSelectedSite ? SITE_MATCH_MESSAGE : OUTSIDE_SITE_WARNING,
          type: isInsideSelectedSite ? "success" : "warning",
        };
    const announcementTimer = window.setTimeout(() => setPopup(nextPopup), 0);
    return () => window.clearTimeout(announcementTimer);
  }, [showSubmitModal, hasGps, municipalityScopeStatus, isInsideSelectedSite,
    selectedSite, form.latitude, form.longitude]);

  function resetForm() {
    clearNoEventsAlert();
    stopCamera();
    setForm({
      participantType: participantProfile?.userType || "",
      organizationAffiliation: getProfileAffiliation(participantProfile),
      barangay: "",
      distributionId: "",
      distributionItemKey: "",
      inventoryId: "",
      species: "",
      requestedQuantity: "",
      quantityReleased: "",
      remainingQuantity: "",
      quantity: "",
      plantingDate: "",
      siteId: "",
      siteName: "",
      eventId: "",
      eventName: "",
      latitude: "",
      longitude: "",
      accuracy: "",
      locationSource: "",
      photoCapturedAt: "",
      locationCapturedAt: "",
      remarks: "",
    });

    setLocationLoading(false);

    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
    setPhotoFiles([]);
    setPhotoPreviews([]);
    setLocationPhotoSignature("");

    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  async function openSubmitModal() {
    resetForm();
    setPopup({ message: "", type: "success" });
    setShowSubmitModal(true);
    await refreshReferenceData();
  }

  function closeSubmitModal() {
    if (submitting) return;
    setShowSubmitModal(false);
    resetForm();
    setPopup({ message: "", type: "success" });
  }

  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
  }

  function getFreshDeviceLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(Object.assign(new Error("Geolocation unavailable"), { code: 2 }));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      });
    });
  }

  async function startCamera() {
    if (cameraStreamRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      showPopup("Camera access is required to take a photo within the system. Please allow camera access or upload a photo instead.", "error");
      return;
    }
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      const position = await getFreshDeviceLocation();
      cameraStreamRef.current = stream;
      setForm((previous) => ({
        ...previous,
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude),
        accuracy: Number.isFinite(position.coords.accuracy) ? String(position.coords.accuracy) : "",
        locationSource: DEVICE_CAPTURE_LOCATION_SOURCE,
        locationCapturedAt: new Date(position.timestamp || Date.now()).toISOString(),
        photoCapturedAt: "",
      }));
      setCameraOpen(true);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      if (!stream) {
        showPopup("Camera access is required to take a photo within the system. Please allow camera access or upload a photo instead.", "error");
      } else if (error?.code === 1) {
        showPopup("Location access is required when taking a photo within the system. Please allow location access or upload an original geotagged photo instead.", "error");
      } else if (typeof error?.code === "number") {
        showPopup("Unable to capture your device location. Please enable location services and try again, or upload an original geotagged photo instead.", "error");
      } else {
        showPopup("Unable to capture your device location. Please enable location services and try again, or upload an original geotagged photo instead.", "error");
      }
    }
  }

  async function captureCameraPhoto() {
    const video = cameraVideoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) return;
    let position;
    try {
      position = await getFreshDeviceLocation();
    } catch (error) {
      showPopup(error?.code === 1
        ? "Location access is required when taking a photo within the system. Please allow location access or upload an original geotagged photo instead."
        : "Unable to capture your device location. Please enable location services and try again, or upload an original geotagged photo instead.", "error");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
    if (!blob) {
      showPopup("Unable to capture the photo. Please try again.", "error");
      return;
    }
    const capturedAt = new Date().toISOString();
    setForm((previous) => ({
      ...previous,
      latitude: String(position.coords.latitude),
      longitude: String(position.coords.longitude),
      accuracy: Number.isFinite(position.coords.accuracy) ? String(position.coords.accuracy) : "",
      locationSource: DEVICE_CAPTURE_LOCATION_SOURCE,
      locationCapturedAt: new Date(position.timestamp || Date.now()).toISOString(),
      photoCapturedAt: capturedAt,
    }));
    const file = new File([blob], `planting-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    await handlePhotoChange(
      { target: { files: [file], value: "" } },
      { source: DEVICE_CAPTURE_LOCATION_SOURCE, capturedAt }
    );
    stopCamera();
  }

  function updateFormField(field, value) {
    if (field === "barangay") clearNoEventsAlert();

    setForm((previous) => {
      const next = { ...previous, [field]: value };

      if (field === "barangay") {
        next.siteId = "";
        next.siteName = "";
        next.eventId = "";
        next.eventName = "";
        next.plantingDate = "";
        next.distributionId = "";
        next.distributionItemKey = "";
        next.inventoryId = "";
        next.species = "";
        next.requestedQuantity = "";
        next.quantityReleased = "";
        next.remainingQuantity = "";
        next.quantity = "";
      }

      return next;
    });
  }

  function handleDistributionChange(event) {
    const selectedId = event.target.value;
    const distribution = eligibleDistributions.find(
      (entry) => String(entry.id) === String(selectedId)
    );

    if (!distribution) {
      setForm((previous) => ({
        ...previous,
        distributionId: "",
        distributionItemKey: "",
        inventoryId: "",
        species: "",
        requestedQuantity: "",
        quantityReleased: "",
        remainingQuantity: "",
        quantity: "",
      }));
      return;
    }

    const items = Array.isArray(distribution.items) && distribution.items.length > 0
      ? distribution.items
      : [{
          inventoryId: distribution.inventoryId || "",
          species: distribution.species || "Sapling",
          requestedQuantity: distribution.requestedQuantity,
          releasedQuantity: distribution.quantityReleased,
        }];
    const item = items.length === 1 ? items[0] : null;
    const selectedEvent = events.find((entry) =>
      String(getEventId(entry)) === String(form.eventId));
    const releasedQuantity = item
      ? Number(item.releasedQuantity ?? item.quantity ?? 0)
      : "";
    const remainingQuantity = item
      ? Math.max(0, releasedQuantity - Number(selectedEvent?.recordedSeedlingsByInventory?.[item.inventoryId] || 0))
      : "";

    setForm((previous) => ({
      ...previous,
      distributionId: distribution.id,
      distributionItemKey: item ? String(item.inventoryId || item.species) : "",
      inventoryId: item?.inventoryId || "",
      species: item?.species || "",
      requestedQuantity: item?.requestedQuantity ?? "",
      quantityReleased: releasedQuantity,
      remainingQuantity,
      quantity: "",
    }));
  }

  function handleSaplingChange(event) {
    const selectedId = event.target.value;
    const item = eligibleDistributionItems.find((entry) =>
      String(entry.optionId) === String(selectedId));
    setForm((previous) => ({
      ...previous,
      distributionItemKey: item?.optionId || "",
      inventoryId: item?.inventoryId || "",
      species: item?.species || "",
      requestedQuantity: item?.requestedQuantity ?? "",
      quantityReleased: item?.releasedQuantity ?? "",
      remainingQuantity: item?.remainingQuantity ?? "",
      quantity: "",
    }));
  }

  function handleSiteChange(event) {
    clearNoEventsAlert();
    const selectedId = event.target.value;
    const site = filteredSites.find(
      (item) => String(getSiteId(item)) === String(selectedId)
    );

    if (!site) {
      setForm((previous) => ({
        ...previous,
        siteId: "",
        siteName: "",
        eventId: "",
        eventName: "",
        plantingDate: "",
        distributionId: "",
        distributionItemKey: "",
        inventoryId: "",
        species: "",
        requestedQuantity: "",
        quantityReleased: "",
        remainingQuantity: "",
        quantity: "",
      }));
      return;
    }

    setForm((previous) => ({
      ...previous,
      siteId: getSiteId(site),
      siteName: getSiteName(site),
      eventId: "",
      eventName: "",
      plantingDate: "",
      distributionId: "",
      distributionItemKey: "",
      inventoryId: "",
      species: "",
      requestedQuantity: "",
      quantityReleased: "",
      remainingQuantity: "",
      quantity: "",
    }));
  }

  function handleEventChange(event) {
    const selectedId = event.target.value;

    if (!selectedId) {
      setForm((previous) => ({
        ...previous,
        eventId: "",
        eventName: "",
        plantingDate: "",
        distributionId: "",
        distributionItemKey: "",
        inventoryId: "",
        species: "",
        requestedQuantity: "",
        quantityReleased: "",
        remainingQuantity: "",
        quantity: "",
      }));
      return;
    }

    const selectedEvent = events.find(
      (item) => String(getEventId(item)) === String(selectedId)
    );

    setForm((previous) => ({
      ...previous,
      eventId: selectedEvent ? getEventId(selectedEvent) : "",
      eventName: selectedEvent ? getEventName(selectedEvent) : "",
      plantingDate: selectedEvent ? getEventDateValue(selectedEvent) : "",
      distributionId: "",
      distributionItemKey: "",
      inventoryId: "",
      species: "",
      requestedQuantity: "",
      quantityReleased: "",
      remainingQuantity: "",
      quantity: "",
    }));
  }

  async function processPhotoMetadata(file, announce = true) {
    if (!file) {
      showPopup("Please upload or take a photo first.", "error");
      return false;
    }
    setLocationLoading(true);
    try {
      const metadata = await exifr.parse(file, { gps: true, tiff: true, exif: true });
      const hasGpsValues = metadata?.latitude !== null && metadata?.latitude !== undefined &&
        metadata?.longitude !== null && metadata?.longitude !== undefined;
      const latitude = hasGpsValues ? Number(metadata.latitude) : NaN;
      const longitude = hasGpsValues ? Number(metadata.longitude) : NaN;
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        setForm((previous) => ({
          ...previous,
          latitude: "", longitude: "", accuracy: "", locationSource: "",
          photoCapturedAt: "", locationCapturedAt: "",
        }));
        showPopup(
          hasGpsValues
            ? "This photo contains invalid GPS coordinates. Please upload an original geotagged photo with valid location information."
            : MISSING_EXIF_MESSAGE,
          "error"
        );
        return false;
      }

      const capturedAt = metadata?.DateTimeOriginal ?? metadata?.CreateDate;
      const capturedDate = capturedAt ? new Date(capturedAt) : null;
      setForm((previous) => ({
        ...previous,
        latitude: String(latitude),
        longitude: String(longitude),
        accuracy: "",
        locationSource: PHOTO_EXIF_LOCATION_SOURCE,
        photoCapturedAt: capturedDate && !Number.isNaN(capturedDate.getTime())
          ? capturedDate.toISOString() : "",
        locationCapturedAt: capturedDate && !Number.isNaN(capturedDate.getTime())
          ? capturedDate.toISOString() : "",
      }));
      setLocationPhotoSignature(`${file.name}|${file.size}|${file.lastModified}`);
      if (announce) showPopup("Photo location successfully verified.");
      return true;
    } catch {
      setForm((previous) => ({
        ...previous,
        latitude: "", longitude: "", accuracy: "", locationSource: "",
        photoCapturedAt: "", locationCapturedAt: "",
      }));
      showPopup(
        MISSING_EXIF_MESSAGE,
        "error"
      );
      return false;
    } finally {
      setLocationLoading(false);
    }
  }

  function verifyPhotoLocation() {
    void processPhotoMetadata(photoFiles[0]);
  }

  function isAllowedImageFile(file) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    const fileName = String(file?.name || "").toLowerCase();
    const hasAllowedExtension = allowedExtensions.some((extension) =>
      fileName.endsWith(extension)
    );

    return (
      allowedTypes.includes(file?.type) ||
      ((file?.type === "" || file?.type === "application/octet-stream") &&
        hasAllowedExtension)
    );
  }

  async function handlePhotoChange(event, options = {}) {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    const source = options.source || PHOTO_EXIF_LOCATION_SOURCE;
    if (photoFiles.length > 0 && form.locationSource && form.locationSource !== source) {
      showPopup("Use either Take Photo or Upload Photo for one report. Remove the current photos before changing the location source.", "error");
      event.target.value = "";
      return;
    }

    const remainingSlots = MAX_EVIDENCE_PHOTOS - photoFiles.length;

    if (remainingSlots <= 0) {
      showPopup("A maximum of 10 planting evidence photos is allowed.", "error");
      event.target.value = "";
      return;
    }

    if (selectedFiles.length > remainingSlots) {
      showPopup(
        `You can add only ${remainingSlots} more photo${remainingSlots === 1 ? "" : "s"}. Maximum is 10.`,
        "error"
      );
      event.target.value = "";
      return;
    }

    for (const file of selectedFiles) {
      if (!isAllowedImageFile(file)) {
        showPopup(
          "Invalid photo format. Please select JPG, PNG, or WEBP images only.",
          "error"
        );
        event.target.value = "";
        return;
      }

      if (file.size > MAX_PHOTO_SIZE) {
        showPopup(
          `${file.name || "A selected photo"} is larger than 10 MB.`,
          "error"
        );
        event.target.value = "";
        return;
      }
    }

    const existingSignatures = new Set(
      photoFiles.map((file) => `${file.name}|${file.size}|${file.lastModified}`)
    );

    const newSignatures = new Set();

    for (const file of selectedFiles) {
      const signature = `${file.name}|${file.size}|${file.lastModified}`;

      if (existingSignatures.has(signature) || newSignatures.has(signature)) {
        showPopup(
          "The same photo was selected more than once. Please choose a different image.",
          "error"
        );
        event.target.value = "";
        return;
      }

      newSignatures.add(signature);
    }

    let metadataValid = hasGps;
    if (source === DEVICE_CAPTURE_LOCATION_SOURCE) {
      if (!metadataValid) {
        showPopup("Unable to capture your device location. Please enable location services and try again, or upload an original geotagged photo instead.", "error");
        event.target.value = "";
        return;
      }
      setLocationPhotoSignature(`${selectedFiles[0].name}|${selectedFiles[0].size}|${selectedFiles[0].lastModified}`);
      setForm((previous) => ({
        ...previous,
        locationSource: DEVICE_CAPTURE_LOCATION_SOURCE,
        photoCapturedAt: options.capturedAt || new Date().toISOString(),
      }));
    } else {
      for (const file of selectedFiles) {
        try {
          const metadata = await exifr.parse(file, { gps: true, tiff: true, exif: true });
          const hasCoordinates = metadata?.latitude !== null && metadata?.latitude !== undefined &&
            metadata?.longitude !== null && metadata?.longitude !== undefined;
          const latitude = hasCoordinates ? Number(metadata.latitude) : NaN;
          const longitude = hasCoordinates ? Number(metadata.longitude) : NaN;
          if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
              !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
            showPopup(MISSING_EXIF_MESSAGE, "error");
            event.target.value = "";
            return;
          }
        } catch {
          showPopup(MISSING_EXIF_MESSAGE, "error");
          event.target.value = "";
          return;
        }
      }
      if (photoFiles.length === 0) {
        metadataValid = await processPhotoMetadata(selectedFiles[0], false);
      }
    }

    if (!metadataValid) {
      event.target.value = "";
      return;
    }

    const newPreviews = selectedFiles.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      url: URL.createObjectURL(file),
    }));

    previewUrlsRef.current.push(...newPreviews.map((item) => item.url));

    setPhotoFiles((previous) => [...previous, ...selectedFiles]);
    setPhotoPreviews((previous) => [...previous, ...newPreviews]);

    event.target.value = "";

    if (metadataValid) {
      showPopup(
        `${selectedFiles.length} planting evidence photo${selectedFiles.length === 1 ? "" : "s"} added successfully.`
      );
    }
  }

  function removeSelectedPhoto(index) {
    const preview = photoPreviews[index];
    const file = photoFiles[index];
    if (file && locationPhotoSignature === `${file.name}|${file.size}|${file.lastModified}`) {
      setLocationPhotoSignature("");
      setForm((previous) => ({
        ...previous, latitude: "", longitude: "", accuracy: "", locationSource: "",
        photoCapturedAt: "", locationCapturedAt: "",
      }));
    }

    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
      previewUrlsRef.current = previewUrlsRef.current.filter(
        (url) => url !== preview.url
      );
    }

    setPhotoFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    setPhotoPreviews((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index)
    );

    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!participantProfile?.userType) {
      showPopup("Your saved User Type is missing. Please complete your profile before submitting a planting report.", "error");
      return;
    }

    if (!form.siteId || !form.siteName) {
      showPopup("Please select a registered planting site.", "error");
      return;
    }

    if (!form.eventId) {
      showPopup("Please select a planting event.", "error");
      return;
    }

    if (!form.distributionId) {
      showPopup(NO_DISTRIBUTION_MESSAGE, "error");
      return;
    }

    if (!form.barangay) {
      showPopup("Please select a barangay with an available planting site.", "error");
      return;
    }

    if (!form.inventoryId) {
      showPopup("Please select a sapling tree.", "error");
      return;
    }

    const selectedDistribution = distributions.find((item) =>
      String(item.id) === String(form.distributionId));
    if (!selectedDistribution || selectedDistribution.status !== "Released") {
      showPopup("Select a valid released distribution.", "error");
      return;
    }
    if (!form.plantingDate) {
      showPopup("The selected planting event does not have a valid event date.", "error");
      return;
    }

    const quantity = Number(form.quantity);
    const remainingQuantity = Number(form.remainingQuantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      showPopup("Please enter a valid quantity of planted saplings.", "error");
      return;
    }

    if (Number.isFinite(remainingQuantity) && quantity > remainingQuantity) {
      showPopup("The quantity planted cannot exceed the remaining released sapling quantity.", "error");
      return;
    }

    if (photoFiles.length === 0) {
      showPopup("Please add at least one planting evidence photo before submitting the report.", "error");
      return;
    }

    if (photoFiles.length > MAX_EVIDENCE_PHOTOS) {
      showPopup("A maximum of 10 planting evidence photos is allowed.", "error");
      return;
    }

    if (!hasGps) {
      showPopup(
        form.locationSource === DEVICE_CAPTURE_LOCATION_SOURCE
          ? "Unable to capture your device location. Please enable location services and try again, or upload an original geotagged photo instead."
          : MISSING_EXIF_MESSAGE,
        "error"
      );
      return;
    }

    if (municipalityScopeStatus === "checking") {
      showPopup("Please wait while the photo location is checked against the Municipality of Juban boundary.", "error");
      return;
    }

    if (municipalityScopeStatus === "outside") {
      showPopup(OUTSIDE_JUBAN_MESSAGE, "error");
      return;
    }

    const payload = new FormData();

    payload.append("distributionId", form.distributionId);
    if (form.inventoryId) payload.append("inventoryId", form.inventoryId);
    payload.append("siteId", form.siteId);
    payload.append("barangay", form.barangay);
    payload.append("quantityPlanted", String(quantity));
    payload.append("plantingDate", form.plantingDate);
    payload.append("plantingLocation", form.siteName);
    payload.append("eventId", form.eventId || "");
    payload.append("eventName", form.eventName || "");
    payload.append("locationSource", form.locationSource || PHOTO_EXIF_LOCATION_SOURCE);
    if (form.locationSource === DEVICE_CAPTURE_LOCATION_SOURCE) {
      payload.append("latitude", form.latitude);
      payload.append("longitude", form.longitude);
      payload.append("accuracy", form.accuracy || "");
      payload.append("photoCapturedAt", form.photoCapturedAt);
      payload.append("locationCapturedAt", form.locationCapturedAt);
    }
    payload.append("remarks", form.remarks.trim());

    photoFiles.forEach((file) => {
      payload.append("photos", file);
    });

    setSubmitting(true);

    try {
      await apiRequest("/planting-reports", {
        method: "POST",
        body: payload,
      });

      resetForm();
      showPopup("Your planting report was submitted successfully.");

      await loadReports();
      await loadMyDistributions();
    } catch (error) {
      showPopup(error.message || "Unable to submit the planting report. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function openRecord(record) {
    setSelectedRecord(record);
    setVerificationRemarks("");
    setShowViewModal(true);
  }

  function closeRecordModal() {
    if (actionLoading) return;
    openedReportFromSearchRef.current = "";
    setSelectedRecord(null);
    setVerificationRemarks("");
    setDecision("");
    setShowViewModal(false);
  }

  async function approveRecord() {
    if (
      !selectedRecord ||
      !canReview ||
      displayReportStatus(selectedRecord.verificationStatus) !== "Pending Review"
    ) {
      return;
    }

    setActionLoading(true);

    try {
      const remarksToSend = verificationRemarks.trim() || "Requirements met";

      const response = await apiRequest(
        `/planting-reports/${selectedRecord.id}/approve`,
        {
          method: "PATCH",
          body: JSON.stringify({ remarks: remarksToSend }),
        }
      );

      setSelectedRecord(response.data);
      setVerificationRemarks("");
      setDecision("");
      showPopup(response.message || "Planting report approved successfully.");
      await loadReports();
    } catch (error) {
      showPopup(error.message || "Failed to approve planting report.", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function rejectRecord() {
    if (
      !selectedRecord ||
      !canReview ||
      displayReportStatus(selectedRecord.verificationStatus) !== "Pending Review"
    ) {
      return;
    }

    const reason = verificationRemarks.trim();

    if (!reason) {
      showPopup(
        "Please enter a reason for rejecting the planting report.",
        "error"
      );
      return;
    }

    setActionLoading(true);

    try {
      const response = await apiRequest(
        `/planting-reports/${selectedRecord.id}/reject`,
        {
          method: "PATCH",
          body: JSON.stringify({ remarks: reason }),
        }
      );

      setSelectedRecord(response.data);
      setVerificationRemarks("");
      setDecision("");
      showPopup(response.message || "Planting report rejected successfully.");
      await loadReports();
    } catch (error) {
      showPopup(error.message || "Failed to reject planting report.", "error");
    } finally {
      setActionLoading(false);
    }
  }

  function getStatusIcon(status) {
    if (status === "Approved") {
      return <FiCheckCircle size={12} />;
    }

    if (status === "Rejected") return <FiXCircle size={12} />;
    return <FiClock size={12} />;
  }

  function renderStatusBadge(status) {
    const label = displayReportStatus(status);
    const statusClass = VERIFICATION_CLASSES[label];

    return (
      <span className={`pr-status-badge ${statusClass}`}>
        {getStatusIcon(label)}
        {label}
      </span>
    );
  }

  const staffCanReviewSelected =
    canReview &&
    selectedRecord &&
    displayReportStatus(selectedRecord.verificationStatus) === "Pending Review";

  const visibleVerificationIssues = Array.isArray(selectedRecord?.suspiciousFlags)
    ? selectedRecord.suspiciousFlags
    : [];

  if (loading) {
    return <div className="pr-page"><div style={{ minHeight: "420px", display: "grid", placeItems: "center", color: "#526159", fontSize: "13px", fontWeight: 600 }}>Loading planting reports...</div></div>;
  }

  if (reportError) {
    return <div className="pr-page"><div role="alert" style={{ minHeight: "420px", display: "grid", placeContent: "center", justifyItems: "center", gap: "14px", color: "#526159", fontSize: "13px", fontWeight: 600 }}><span>{reportError}</span><button type="button" className="pr-secondary-button" onClick={loadReports}>Retry</button></div></div>;
  }

  return (
    <div className="pr-page">
      {popup.message && !showSubmitModal && (
        <div
          className={`pr-popup-message ${
            popup.type === "error" ? "pr-popup-error" : "pr-popup-success"
          }`}
          role={popup.type === "error" ? "alert" : "status"}
          aria-live={popup.type === "error" ? "assertive" : "polite"}
        >
          {popup.message}
        </div>
      )}

      <div className="pr-header">
        <div className="pr-heading-wrap">
          <div className="pr-heading-icon">
            <FiGitBranch size={20} />
          </div>

          <div>
            <h1 className="pr-title">
              {isParticipant ? "My Planting Reports" : "Planting Reports"}
            </h1>

            <p className="pr-subtitle">
              {isParticipant
                ? "Submit planting evidence and track the verification status of your reports."
                : canReview
                ? "Review geo-tagged planting reports after automated verification."
                : "View planting reports and staff decisions."}
            </p>
          </div>
        </div>

        {isParticipant && (
          <button
            type="button"
            className="pr-primary-button"
            onClick={openSubmitModal}
            disabled={referenceLoading}
          >
            <FiPlus size={15} />
            Submit Planting Report
          </button>
        )}
      </div>

      <div className="pr-cards">
        <div className="pr-card">
          <div className="pr-card-icon"><FiFileText size={19} /></div>
          <div>
            <div className="pr-card-value">{summary.total}</div>
            <div className="pr-card-label">Total Reports</div>
          </div>
        </div>

        <div className="pr-card">
          <div className="pr-card-icon"><FiClock size={19} /></div>
          <div>
            <div className="pr-card-value">{summary.pending}</div>
            <div className="pr-card-label">Awaiting Staff Review</div>
          </div>
        </div>

        <div className="pr-card">
          <div className="pr-card-icon"><FiCheckCircle size={19} /></div>
          <div>
            <div className="pr-card-value">
              {summary.approved}
            </div>
            <div className="pr-card-label">
              Approved
            </div>
          </div>
        </div>

        <div className="pr-card">
          <div className="pr-card-icon">
            {isParticipant ? <FiXCircle size={19} /> : <FiGitBranch size={19} />}
          </div>
          <div>
            <div className="pr-card-value">
              {isParticipant ? summary.rejected : summary.totalTrees}
            </div>
            <div className="pr-card-label">
              {isParticipant ? "Rejected" : "Trees Reported Planted"}
            </div>
          </div>
        </div>
      </div>

      <div className="pr-panel">
        <div className="pr-toolbar">
          <div className="pr-toolbar-left">
            {!isParticipant && (
              <div className="pr-search-wrap">
                <FiSearch size={15} className="pr-search-icon" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search reports, participant, site, tree..."
                  className="pr-search-input"
                />
              </div>
            )}

            <div className="pr-filter-wrap">
              <FiFilter size={14} />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="pr-select"
              >
                <option value="All">All Status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className="pr-secondary-button"
            onClick={async () => {
              setSearchTerm("");
              setStatusFilter("All");
              await loadReports();
              await refreshReferenceData();
            }}
            disabled={loading || referenceLoading}
          >
            <FiRefreshCw size={14} />
            Reset
          </button>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="pr-empty-state">
            <div className="pr-empty-icon"><FiGitBranch size={25} /></div>
            <div className="pr-empty-title">
              {visibleRecords.length === 0 ? "No planting reports yet" : "No matching reports found"}
            </div>
            <div className="pr-empty-text">
              {visibleRecords.length === 0
                ? isParticipant
                  ? "Your submitted planting activities will appear here."
                  : "Planting reports submitted by participants will appear here."
                : "Try changing the current search or status filter."}
            </div>
          </div>
        ) : (
          <div className="pr-table-wrap">
            <table className="pr-table">
              <thead>
                <tr>
                  <th className="pr-th">Report ID</th>
                  {!isParticipant && <th className="pr-th">Participant</th>}
                  <th className="pr-th">Planting Site</th>
                  {isParticipant && <th className="pr-th">Barangay</th>}
                  <th className="pr-th">Sapling Tree</th>
                  <th className="pr-th">Quantity</th>
                  <th className="pr-th">Date Planted</th>
                  <th className="pr-th">Status</th>
                  <th className="pr-th pr-center">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="pr-td"><span className="pr-id-text">{formatDisplayId("RPT", record.reportNumber, record.reportId, record.id)}</span></td>
                    {!isParticipant && (
                      <td className="pr-td">{record.participantName || "—"}</td>
                    )}
                    <td className="pr-td">
                      <div className="pr-table-main">{record.siteName || "—"}</div>
                      {!isParticipant && record.barangay && (
                        <div className="pr-table-sub">{record.barangay}</div>
                      )}
                    </td>
                    {isParticipant && <td className="pr-td">{record.barangay || "—"}</td>}
                    <td className="pr-td">{record.species || "—"}</td>
                    <td className="pr-td"><strong>{record.quantityPlanted ?? "—"}</strong></td>
                    <td className="pr-td">{formatDate(record.plantingDate)}</td>
                    <td className="pr-td">{renderStatusBadge(record.verificationStatus)}</td>
                    <td className="pr-td pr-center">
                      <button
                        type="button"
                        title="View report"
                        className="pr-view-button"
                        onClick={() => openRecord(record)}
                        aria-label={`View ${formatDisplayId("RPT", record.reportNumber, record.reportId, record.id)}`}
                      >
                        <FiEye size={15} />
                      </button>
                      {isParticipant && displayReportStatus(record.verificationStatus) === "Pending" && (
                        <button type="button" className="pr-view-button" title="Submit planting report" aria-label={`Submit planting report for ${formatDisplayId("RPT", record.reportNumber, record.reportId, record.id)}`} onClick={openSubmitModal}>
                          <FiPlus size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showSubmitModal && isParticipant && (
        <div className="pr-overlay">
          <div className="pr-modal">
            <div className="pr-modal-header">
              <div>
                <h2 className="pr-modal-title">Submit Planting Report</h2>
                <p className="pr-modal-subtitle">
                  Provide participant details, planting information, GPS location, and photo evidence.
                </p>
              </div>

              <button
                type="button"
                className="pr-close-button"
                onClick={closeSubmitModal}
                aria-label="Close"
                disabled={submitting}
              >
                <FiX size={17} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="pr-modal-body pr-submit-modal-body">
                <div
                  className="pr-submit-alert-slot"
                  aria-live={popup.type === "error" ? "assertive" : "polite"}
                >
                  {popup.message && (
                    <div
                      className={`pr-submit-alert pr-submit-alert-${popup.type}`}
                      role={popup.type === "error" ? "alert" : "status"}
                    >
                      {popup.message}
                    </div>
                  )}
                </div>

                <section className="pr-section pr-report-information-section">
                  <div className="pr-section-header">
                    <FiFileText size={15} />
                    Participant Information
                  </div>

                  <div className="pr-grid2">
                    <div>
                      <label className="pr-label">Full Name</label>
                      <div className="pr-readonly-value">{participantProfile?.fullName || currentIdentity.name}</div>
                    </div>

                    <div>
                      <label className="pr-label">Participant Type</label>
                      <div className="pr-readonly-value">{participantProfile?.userType || "—"}</div>
                    </div>

                    <div>
                      <label className="pr-label">{getProfileAffiliationLabel(participantProfile)}</label>
                      <div className="pr-readonly-value">{getProfileAffiliation(participantProfile) || "—"}</div>
                    </div>

                    <div>
                      <label className="pr-label">Contact Number</label>
                      <div className="pr-readonly-value">{participantProfile?.contactNumber || "—"}</div>
                    </div>
                  </div>
                </section>

                <section className="pr-section pr-report-details-section">
                  <div className="pr-section-header">
                    <FiGitBranch size={15} />
                    Planting Details
                  </div>

                  <div className="pr-grid2">
                    <div className="pr-full-width">
                      <label className="pr-label">
                        Barangay <span className="pr-required">*</span>
                      </label>
                      <select
                        className="pr-input pr-barangay-select"
                        value={form.barangay}
                        onChange={(event) => updateFormField("barangay", event.target.value)}
                        disabled={referenceLoading}
                      >
                        <option value="">
                          {referenceLoading ? "Loading barangays..." : "Select barangay"}
                        </option>
                        {JUBAN_BARANGAYS.map((barangay) => {
                          const hasSite = barangaysWithSites.has(normalizeBarangayName(barangay));
                          return (
                            <option key={barangay} value={barangay} disabled={!hasSite}>
                              {barangay}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="pr-full-width">
                      <label className="pr-label">
                        Planting Site <span className="pr-required">*</span>
                      </label>
                      <select
                        className="pr-input"
                        value={form.siteId}
                        onChange={handleSiteChange}
                        disabled={!form.barangay || referenceLoading}
                      >
                        <option value="">
                          {!form.barangay ? "Select barangay first" :
                            referenceLoading ? "Loading planting sites..." : "Select planting site"}
                        </option>
                        {filteredSites.map((site) => (
                          <option key={getSiteId(site)} value={getSiteId(site)}>
                            {formatDisplayId("SITE", site.siteNumber, site.siteId, getSiteId(site))} — {getSiteName(site)}
                          </option>
                        ))}
                      </select>
                      {form.barangay && !referenceLoading && filteredSites.length === 0 && (
                        <div className="pr-helper-text">
                          No planting sites are currently available for this barangay.
                        </div>
                      )}
                    </div>

                    <div className="pr-full-width">
                      <label className="pr-label">
                        Planting Event <span className="pr-required">*</span>
                      </label>
                      <select className="pr-input" value={form.eventId} onChange={handleEventChange} disabled={!form.siteId}>
                        <option value="">
                          {!form.siteId ? "Select planting site first" :
                            filteredEvents.length === 0 ? "No matching event available" : "Select planting event"}
                        </option>
                        {filteredEvents.map((event) => (
                          <option key={getEventId(event)} value={getEventId(event)}>
                            {formatDisplayId("EVT", event.eventNumber, event.eventId, getEventId(event))} — {getEventName(event)} — {formatDate(getEventDateValue(event))}
                          </option>
                        ))}
                      </select>
                      {form.siteId && filteredEvents.length === 0 && (
                        <div className="pr-helper-text" role="status">
                          No planting events are currently available for this planting site.
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="pr-label">Planting Event Date</label>
                      <input type="date" className="pr-input pr-readonly" value={form.plantingDate} readOnly />
                    </div>

                    <div className="pr-full-width">
                      <label className="pr-label">
                        Released Sapling Distribution <span className="pr-required">*</span>
                      </label>
                      <select
                        className="pr-input"
                        value={form.distributionId}
                        onChange={handleDistributionChange}
                        disabled={!form.eventId}
                      >
                        <option value="">
                          {!form.eventId ? "Select planting event first" : "Select released sapling distribution"}
                        </option>
                        {eligibleDistributions.map((distribution) => (
                          <option key={distribution.id} value={distribution.id}>
                            {getDistributionReference(distribution)} — {distribution.participantName || distribution.organization || "Requester"}
                          </option>
                        ))}
                      </select>
                      {form.eventId && eligibleDistributions.length === 0 && (
                        <div className="pr-helper-text" role="status">
                          No released sapling distributions are available for this planting event.
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="pr-label">Sapling Tree <span className="pr-required">*</span></label>
                      <select
                        className="pr-input"
                        value={form.distributionItemKey}
                        onChange={handleSaplingChange}
                        disabled={!form.distributionId || eligibleDistributionItems.length <= 1}
                      >
                        <option value="">
                          {!form.distributionId ? "Select released distribution first" : "Select sapling tree"}
                        </option>
                        {eligibleDistributionItems.map((item) => (
                          <option key={item.optionId} value={item.optionId} disabled={item.remainingQuantity <= 0}>
                            {item.species || "Sapling"} — {item.remainingQuantity} remaining
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="pr-label">Quantity Released</label>
                      <input className="pr-input pr-readonly" value={form.quantityReleased} readOnly />
                    </div>

                    <div>
                      <label className="pr-label">Quantity Planted <span className="pr-required">*</span></label>
                      <input type="number" min="1" step="1" max={form.remainingQuantity || undefined}
                        className="pr-input" value={form.quantity}
                        onChange={(event) => updateFormField("quantity", event.target.value)}
                        placeholder="Enter quantity" />
                    </div>

                    {selectedSite && (
                      <div className="pr-full-width">
                        <div className="pr-site-preview">
                          <div className="pr-site-preview-icon"><FiMapPin size={17} /></div>
                          <div className="pr-site-preview-content">
                            <div className="pr-site-preview-title">Registered Planting Site</div>
                            <div className="pr-site-preview-name">{getSiteName(selectedSite)}</div>
                            <div className="pr-site-preview-meta">
                              Barangay {getSiteBarangay(selectedSite)}
                              {selectedSite.latitude !== undefined &&
                              selectedSite.longitude !== undefined
                                ? ` • ${selectedSite.latitude}, ${selectedSite.longitude}`
                                : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <section className="pr-section pr-photo-location-section">
                  <div className="pr-section-header">
                    <FiNavigation size={15} />
                    Photo Location Verification
                  </div>

                  <div className="pr-gps-card">
                    <div className="pr-gps-top">
                      <div>
                        <div className="pr-gps-title">
                          Location Verification
                        </div>
                      </div>

                      <button
                        type="button"
                        className="pr-secondary-button"
                        disabled={locationLoading || form.locationSource === DEVICE_CAPTURE_LOCATION_SOURCE}
                        onClick={verifyPhotoLocation}
                      >
                        <FiMapPin size={14} />
                        {locationLoading
                          ? "Reading Photo..."
                          : hasGps
                          ? form.locationSource === DEVICE_CAPTURE_LOCATION_SOURCE
                            ? "Device Location Captured"
                            : "Verify Again"
                          : "Verify Photo Location"}
                      </button>
                    </div>

                    {hasGps && (
                      <div className="pr-gps-captured">
                        <div>
                          <div className="pr-gps-value-label">Latitude</div>
                          <div className="pr-gps-value">{form.latitude}</div>
                        </div>
                        <div>
                          <div className="pr-gps-value-label">Longitude</div>
                          <div className="pr-gps-value">{form.longitude}</div>
                        </div>
                        <div>
                          <div className="pr-gps-value-label">Source</div>
                          <div className="pr-gps-value">{form.locationSource || "—"}</div>
                        </div>
                        <div>
                          <div className="pr-gps-value-label">Location Status</div>
                          <div className="pr-gps-value">
                            {municipalityScopeStatus === "outside" ? "Outside Municipality of Juban" :
                              isOutsideAssignedSite ? "Outside Assigned Site" :
                              locationPreviewStatus.type === "valid" ? "Within Assigned Site" : "Unable to Compare"}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pr-location-map-section">
                      <div className="pr-location-map-heading">
                        <div>
                          <div className="pr-location-map-title">Juban Location Preview</div>
                  
                        </div>

                        <span
                          className={`pr-location-status pr-location-status-${locationPreviewStatus.type}`}
                        >
                          {locationPreviewStatus.label}
                        </span>
                      </div>

                      <div className="pr-location-map-wrap">
                                      <div
                                        ref={locationMapContainerRef}
                                        className="pr-location-map"
                                        aria-label="Interactive Juban barangay and planting site location preview"
                                      />

                                      

                              </div>

                              <div className="pr-location-map-legend">
                                <span><i className="pr-map-legend-line" /> Barangay Boundary</span>
                                <span><i className="pr-map-legend-site" /> Registered Site</span>
                                <span><i className="pr-map-legend-captured" /> Photo GPS</span>
                              </div>
                            </div>
                          </div>

                          {hasGps && (
                            <div className="pr-helper-text">
                              Photo captured: {form.photoCapturedAt ? formatDateTime(form.photoCapturedAt) : "Timestamp unavailable"}
                              {form.locationSource === DEVICE_CAPTURE_LOCATION_SOURCE && form.locationCapturedAt
                                ? ` • Location captured: ${formatDateTime(form.locationCapturedAt)}` : ""}
                            </div>
                          )}
                        </section>

                        <section className="pr-section pr-photo-evidence-section">
                          <div className="pr-section-header">
                            <FiCamera size={15} />
                            Planting Photo Evidence
                          </div>

                          {photoFiles.length === 0 && (
                            <div className="pr-helper-text pr-helper-emphasis">
                              Upload or take an original geotagged photo before verifying its location.
                            </div>
                          )}

                          <div className="pr-upload-box">
                            <input
                              ref={cameraInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                              capture="environment"
                              disabled={photoFiles.length >= MAX_EVIDENCE_PHOTOS}
                              onChange={handlePhotoChange}
                              className="pr-file-input"
                            />

                            <input
                              ref={uploadInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                              multiple
                              disabled={photoFiles.length >= MAX_EVIDENCE_PHOTOS}
                              onChange={handlePhotoChange}
                              className="pr-file-input"
                            />

                    <FiCamera size={27} className="pr-upload-icon" />
                    <div className="pr-upload-title">Planting evidence photos</div>
                    <div className="pr-upload-text">
                      JPG, PNG, or WEBP • Maximum 10 MB each • 1 to 10 photos
                    </div>

                    <div
                      className="pr-upload-button"
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        disabled={photoFiles.length >= MAX_EVIDENCE_PHOTOS}
                        onClick={startCamera}
                        className="pr-primary-button"
                      >
                        <FiCamera size={14} />
                        Take Photo
                      </button>

                      <button
                        type="button"
                        disabled={photoFiles.length >= MAX_EVIDENCE_PHOTOS}
                        onClick={() => uploadInputRef.current?.click()}
                        className="pr-secondary-button"
                      >
                        <FiImage size={14} />
                        Upload Existing Photos
                      </button>
                    </div>

                    {cameraOpen && (
                      <div className="pr-camera-preview">
                        <video ref={cameraVideoRef} autoPlay playsInline muted style={{ width: "100%", maxHeight: 320, objectFit: "contain" }} />
                        <div className="pr-upload-button">
                          <button type="button" className="pr-primary-button" onClick={captureCameraPhoto}>Capture Photo</button>
                          <button type="button" className="pr-secondary-button" onClick={stopCamera}>Cancel Camera</button>
                        </div>
                      </div>
                    )}

                    <div className="pr-helper-text" style={{ marginTop: "10px" }}>
                      {photoFiles.length} / {MAX_EVIDENCE_PHOTOS} photos selected
                    </div>

                    {photoPreviews.length > 0 && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                          gap: "12px",
                          width: "100%",
                          marginTop: "14px",
                        }}
                      >
                        {photoPreviews.map((preview, index) => (
                          <div key={preview.id} className="pr-preview-footer" style={{ display: "block" }}>
                            <img
                              src={preview.url}
                              alt={`Planting evidence preview ${index + 1}`}
                              className="pr-preview"
                              style={{ width: "100%", height: "140px", objectFit: "cover" }}
                            />

                            <div className="pr-preview-file" style={{ marginTop: "8px" }}>
                              <div className="pr-preview-name">
                                {index + 1}. {photoFiles[index]?.name}
                              </div>
                              <div className="pr-preview-size">
                                {formatFileSize(photoFiles[index]?.size)}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="pr-danger-button"
                              onClick={() => removeSelectedPhoto(index)}
                              style={{ marginTop: "8px" }}
                            >
                              <FiTrash2 size={13} />
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="pr-section pr-section-last pr-report-additional-section">
                  <div className="pr-section-header">
                    <FiFileText size={15} />
                    Additional Information
                  </div>

                  <label className="pr-label">Remarks</label>
                  <textarea
                    value={form.remarks}
                    onChange={(event) =>
                      updateFormField("remarks", event.target.value)
                    }
                    placeholder="Add notes about the planting activity, if necessary..."
                    className="pr-textarea"
                  />
                </section>
              </div>

              <div className="pr-modal-footer">
                <button
                  type="button"
                  className="pr-secondary-button"
                  onClick={closeSubmitModal}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="pr-primary-button"
                  disabled={submitting || locationBlocksSubmission ||
                    Boolean(form.eventId && eligibleDistributions.length === 0)}
                >
                  <FiSend size={14} />
                  {submitting ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedRecord && (
        <div
          className="pr-drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeRecordModal();
          }}
        >
          <aside
            className="pr-report-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Planting report ${formatDisplayId("RPT", selectedRecord.reportNumber, selectedRecord.reportId, selectedRecord.id)}`}
          >
            <div className="pr-drawer-header">
              <div>
                <h2 className="pr-drawer-title">Planting Report Details</h2>
                <div className="pr-drawer-heading-meta">
                  {renderStatusBadge(selectedRecord.verificationStatus)}
                  <span className="pr-drawer-report-id">{formatDisplayId("RPT", selectedRecord.reportNumber, selectedRecord.reportId, selectedRecord.id)}</span>
                </div>
              </div>

              <button
                type="button"
                className="pr-drawer-close"
                onClick={closeRecordModal}
                aria-label="Close planting report details"
                disabled={actionLoading}
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="pr-drawer-body">
              <section className="pr-drawer-section">
                <div className="pr-drawer-section-title">
                  <FiFileText size={15} />
                  Basic Information
                </div>

                <div className="pr-info-grid">
                  <div className="pr-info-block">
                    <div className="pr-info-label">Original Requester</div>
                    <div className="pr-info-value">{selectedRecord.participantName || "—"}</div>
                    <div className="pr-info-subvalue">
                      {getParticipantTypeLabel(selectedRecord.participantType)}
                    </div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Submitted By</div>
                    <div className="pr-info-value">{selectedRecord.submittedByName || selectedRecord.participantName || "—"}</div>
                    <div className="pr-info-subvalue">
                      {getParticipantTypeLabel(selectedRecord.submittedByType || selectedRecord.participantType)}
                    </div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Submitter Barangay</div>
                    <div className="pr-info-value">{selectedRecord.participantBarangay || "—"}</div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Organization</div>
                    <div className="pr-info-value">
                      {selectedRecord.organizationAffiliation || selectedRecord.organization || "—"}
                    </div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Date Planted</div>
                    <div className="pr-info-value">{formatDate(selectedRecord.plantingDate)}</div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Tree Species</div>
                    <div className="pr-info-value">{selectedRecord.species || "—"}</div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Requested Quantity</div>
                    <div className="pr-info-value">{selectedRecord.requestedQuantity ?? "—"}</div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Released Quantity</div>
                    <div className="pr-info-value">{selectedRecord.releasedItemQuantity ?? selectedRecord.quantityReleased ?? "—"}</div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Quantity Planted</div>
                    <div className="pr-info-value">{selectedRecord.quantityPlanted ?? "—"}</div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Planting Site</div>
                    <div className="pr-info-value">{selectedRecord.siteName || "—"}</div>
                    <div className="pr-info-subvalue">
                      {selectedRecord.barangay ? `Barangay ${selectedRecord.barangay}` : "—"}
                    </div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Related Event</div>
                    <div className="pr-info-value">{selectedRecord.eventName || "Independent Planting"}</div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Submitted</div>
                    <div className="pr-info-value">{formatDateTime(selectedRecord.createdAt)}</div>
                  </div>
                </div>

                {selectedRecord.remarks && (
                  <div className="pr-drawer-note">
                    <div className="pr-info-label">{displayReportStatus(selectedRecord.verificationStatus) === "Rejected" ? "Rejection Reason" : "Remarks"}</div>
                    <div className="pr-drawer-note-text">{selectedRecord.remarks}</div>
                  </div>
                )}
              </section>

              <section className="pr-drawer-section">
                <div className="pr-drawer-section-title">
                  <FiCamera size={15} />
                  Geo-Tagged Photo
                </div>

                {(Array.isArray(selectedRecord.photos) && selectedRecord.photos.length > 0) ||
                selectedRecord.photoURL ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {(Array.isArray(selectedRecord.photos) && selectedRecord.photos.length > 0
                      ? selectedRecord.photos
                      : [
                          {
                            photoURL: selectedRecord.photoURL,
                            metadata: selectedRecord.metadata,
                          },
                        ]
                    ).map((photo, index) => (
                      <div key={`${photo.photoURL || "photo"}-${index}`}>
                        <div className="pr-drawer-photo-wrap">
                          <img
                            src={photo.photoURL}
                            alt={`Geo-tagged planting evidence ${index + 1}`}
                            className="pr-drawer-photo"
                          />
                        </div>

                        <div className="pr-photo-caption-row">
                          <div className="pr-photo-caption">
                            {photo.photoCapturedAt || photo.metadata?.capturedAt
                              ? `Photo ${index + 1} • ${formatDateTime(photo.photoCapturedAt || photo.metadata?.capturedAt)}`
                              : `Evidence photo ${index + 1}`}
                          </div>

                          <button
                            type="button"
                            className="pr-photo-view-button"
                            onClick={() =>
                              window.open(
                                photo.photoURL,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                          >
                            <FiEye size={14} />
                            View Full Size
                          </button>
                        </div>
                        {(photo.latitude !== undefined || photo.metadata?.latitude !== undefined || photo.siteLocationStatus) && (
                          <div className="pr-photo-verification-summary">
                            <span>
                              Evidence GPS: {photo.latitude ?? photo.metadata?.latitude ?? "—"}, {photo.longitude ?? photo.metadata?.longitude ?? "—"}
                            </span>
                            <span>Location Source: {photo.locationSource || selectedRecord.locationSource || "—"}</span>
                            <strong>
                              {photo.siteLocationStatus ||
                                (photo.siteGpsValid === true
                                  ? "Within Assigned Site"
                                  : photo.siteGpsValid === false
                                  ? "Outside Assigned Site"
                                  : "Unable to Compare")}
                            </strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pr-photo-unavailable">
                    <FiImage size={22} />
                    <div>
                      <div className="pr-photo-unavailable-title">Photo unavailable</div>
                      <div className="pr-photo-unavailable-text">
                        No accessible photo URL is currently stored for this report.
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="pr-drawer-section">
                <div className="pr-drawer-section-title">
                  <FiMapPin size={15} />
                  Location Information
                </div>

                <div className="pr-location-grid">
                  <div className="pr-info-block">
                    <div className="pr-info-label">Captured Latitude</div>
                    <div className="pr-info-value">{selectedRecord.latitude ?? "—"}</div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Captured Longitude</div>
                    <div className="pr-info-value">{selectedRecord.longitude ?? "—"}</div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Location Source</div>
                    <div className="pr-info-value">{selectedRecord.locationSource || "—"}</div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">GPS Accuracy</div>
                    <div className="pr-info-value">
                      {selectedRecord.gpsAccuracyMeters !== null &&
                      selectedRecord.gpsAccuracyMeters !== undefined
                        ? `± ${selectedRecord.gpsAccuracyMeters} m`
                        : "—"}
                    </div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Location Captured</div>
                    <div className="pr-info-value">{formatDateTime(selectedRecord.locationCapturedAt)}</div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Distance from Registered Site</div>
                      <div className="pr-info-value">
                        {selectedRecord.siteGpsDistanceMeters !== null &&
                        selectedRecord.siteGpsDistanceMeters !== undefined &&
                        selectedRecord.siteGpsDistanceMeters !== "" &&
                        Number.isFinite(Number(selectedRecord.siteGpsDistanceMeters))
                          ? `${Number(selectedRecord.siteGpsDistanceMeters).toFixed(1)} m`
                          : "—"}
                      </div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Location Verification Status</div>
                    <div className="pr-info-value">
                      {selectedRecord.locationVerificationStatus === "site_match"
                        ? "Site Match"
                        : selectedRecord.locationVerificationStatus === "site_mismatch"
                        ? "Site Mismatch - MENRO Staff review required"
                        : selectedRecord.siteLocationStatus ||
                        (selectedRecord.siteGpsValid === true
                        ? "Within Assigned Site"
                        : selectedRecord.siteGpsValid === false
                        ? "Outside Assigned Site"
                        : "Unable to Compare")}
                    </div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Municipality Scope</div>
                    <div className="pr-info-value">
                      {selectedRecord.municipalityScope === "inside"
                        ? "Inside Municipality of Juban"
                        : selectedRecord.municipalityScope || "—"}
                    </div>
                  </div>
                </div>
              </section>

              <section className="pr-drawer-section">
                <div className="pr-drawer-section-title">
                  <FiCheckCircle size={15} />
                  Verification Details
                </div>

                <div className="pr-info-grid">
                  <div className="pr-info-block">
                    <div className="pr-info-label">Current Status</div>
                    <div className="pr-info-value">{renderStatusBadge(selectedRecord.verificationStatus)}</div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Automated Result</div>
                    <div className="pr-info-value">
                      {selectedRecord.automatedVerificationStatus || "—"}
                    </div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Photo GPS Metadata</div>
                    <div className="pr-info-value">
                      {selectedRecord.gpsMetadataPresent === true
                        ? "Present"
                        : selectedRecord.gpsMetadataPresent === false
                        ? "Missing"
                        : "—"}
                    </div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Timestamp Metadata</div>
                    <div className="pr-info-value">
                      {selectedRecord.timestampMetadataPresent === true
                        ? "Present"
                        : selectedRecord.timestampMetadataPresent === false
                        ? "Missing"
                        : "—"}
                    </div>
                  </div>
                </div>

                {visibleVerificationIssues.length > 0 && (
                    <div className="pr-drawer-note">
                      <div className="pr-info-label">Automated Verification Issues</div>
                      <ul className="pr-verification-issues">
                        {visibleVerificationIssues.map((issue, index) => (
                          <li key={`${index}-${String(issue)}`}>{String(issue)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {staffCanReviewSelected && (
                  <div className="pr-drawer-verification-box">
                    <div className="pr-drawer-section-title">MENRO Staff Review</div>
                    <div className="pr-info-value">Current Status: Pending Review</div>
                    <div className="pr-drawer-verification-actions">
                      <button type="button" className="pr-danger-button" onClick={() => setDecision("reject")} disabled={actionLoading}>
                        <FiXCircle size={14} /> Reject
                      </button>
                      <button type="button" className="pr-primary-button" onClick={() => setDecision("approve")} disabled={actionLoading}>
                        <FiCheck size={14} /> Approve
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="pr-drawer-section pr-drawer-section-last">
                <div className="pr-drawer-section-title">
                  <FiClock size={15} />
                  Verification History
                </div>

                <div className="pr-history">
                  <div className="pr-history-item">
                    <div className="pr-history-marker"><FiCheck size={13} /></div>
                    <div className="pr-history-content">
                      <div className="pr-history-title">Submitted</div>
                      <div className="pr-history-meta">
                        {formatDateTime(selectedRecord.createdAt)}
                        {selectedRecord.submittedByName || selectedRecord.participantName
                          ? ` by ${selectedRecord.submittedByName || selectedRecord.participantName}`
                          : ""}
                      </div>
                    </div>
                  </div>

                  {selectedRecord.reviewedAt && (
                    <div className="pr-history-item">
                      <div className="pr-history-marker"><FiCheck size={13} /></div>
                      <div className="pr-history-content">
                        <div className="pr-history-title">Reviewed</div>
                        <div className="pr-history-meta">
                          {formatDateTime(selectedRecord.reviewedAt)}
                          {selectedRecord.reviewedBy ? ` by ${selectedRecord.reviewedBy}` : ""}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedRecord.approvedAt && (
                    <div className="pr-history-item">
                      <div className="pr-history-marker"><FiCheck size={13} /></div>
                      <div className="pr-history-content">
                        <div className="pr-history-title">Approved</div>
                        <div className="pr-history-meta">
                          {formatDateTime(selectedRecord.approvedAt)}
                          {selectedRecord.approvedBy ? ` by ${selectedRecord.approvedBy}` : ""}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedRecord.rejectedAt && (
                    <div className="pr-history-item">
                      <div className="pr-history-marker is-rejected"><FiX size={13} /></div>
                      <div className="pr-history-content">
                        <div className="pr-history-title">Rejected</div>
                        <div className="pr-history-meta">
                          {formatDateTime(selectedRecord.rejectedAt)}
                          {selectedRecord.rejectedBy ? ` by ${selectedRecord.rejectedBy}` : ""}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}
      {decision && selectedRecord && (
        <div className="pr-overlay pr-decision-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !actionLoading) setDecision("");
        }}>
          <div className="pr-modal-small" role="dialog" aria-modal="true" aria-label={decision === "approve" ? "Approve planting report" : "Reject planting report"}>
            <div className="pr-modal-header">
              <div>
                <h2 className="pr-modal-title">{decision === "approve" ? "Approve Planting Report?" : "Reject Planting Report"}</h2>
                <p className="pr-modal-subtitle">{decision === "approve" ? "Confirm that the submitted planting evidence is acceptable." : "Provide the reason the submitted planting evidence is unacceptable."}</p>
              </div>
              <button type="button" className="pr-close-button" onClick={() => setDecision("")} disabled={actionLoading} aria-label="Close decision"><FiX size={17} /></button>
            </div>
            {decision === "reject" && (
              <div className="pr-modal-body">
                <label className="pr-label" htmlFor="pr-rejection-reason">Reason for Rejection <span className="pr-required">*</span></label>
                <textarea id="pr-rejection-reason" className="pr-textarea" value={verificationRemarks} onChange={(event) => setVerificationRemarks(event.target.value)} placeholder="Explain why this report is being rejected" />
              </div>
            )}
            <div className="pr-modal-footer">
              <button type="button" className="pr-secondary-button" onClick={() => setDecision("")} disabled={actionLoading}>Cancel</button>
              <button type="button" className={decision === "approve" ? "pr-primary-button" : "pr-danger-button"} onClick={decision === "approve" ? approveRecord : rejectRecord} disabled={actionLoading || (decision === "reject" && !verificationRemarks.trim())}>
                {actionLoading ? "Saving..." : decision === "approve" ? "Approve" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
