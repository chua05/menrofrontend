import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  FiActivity,
  FiArchive,
  FiCalendar,
  FiCamera,
  FiCheckCircle,
  FiEye,
  FiFileText,
  FiFilter,
  FiHeart,
  FiImage,
  FiMapPin,
  FiMoreVertical,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrendingUp,
  FiX,
} from "react-icons/fi";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "../context/AuthContext";
import FormAlert from "../components/FormAlert";
import { auth } from "../firebase/config";
import { formatDisplayId } from "../utils/displayId";
import * as exifr from "exifr";
import "../styles/survival-monitoring.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

const CONDITION_META = {
  "Not Yet Monitored": {
    color: "#64748b",
    soft: "#f1f5f9",
    label: "Not Yet Monitored",
    description: "No monitoring entry submitted",
  },
  Healthy: {
    color: "#138a4b",
    soft: "#eaf7ef",
    label: "Healthy",
    description: "Good condition",
  },
  Damaged: {
    color: "#d97706",
    soft: "#fff5e8",
    label: "Damaged",
    description: "Needs attention",
  },
  Dead: {
    color: "#dc2626",
    soft: "#fef0f0",
    label: "Dead",
    description: "Did not survive",
  },
};



function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function normalizeTimestamp(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value === "object") {
    const seconds =
      value._seconds ??
      value.seconds;

    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000);
    }
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
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
  const value = Number(bytes);
  if (!Number.isFinite(value)) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getCurrentUserIdentity(currentUser) {
  return {
    id:
      currentUser?.uid ||
      currentUser?.id ||
      currentUser?.email ||
      "local-participant",
    name:
      currentUser?.displayName ||
      currentUser?.fullName ||
      currentUser?.name ||
      currentUser?.email ||
      "Current User",
  };
}


function deriveCondition(healthy, damaged, dead, totalChecked) {
  if (totalChecked <= 0) return "Healthy";
  if (dead === totalChecked) return "Dead";
  if (damaged > 0 || dead > 0) return "Damaged";
  return "Healthy";
}

function getSurvivalRate(healthy, damaged, totalChecked) {
  if (totalChecked <= 0) return 0;
  return Math.round(((healthy + damaged) / totalChecked) * 100);
}

function getMonthKey(dateValue) {
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

function getMonthLabel(monthKey) {
  if (!monthKey) return "";

  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    year: "2-digit",
  }).format(date);
}

function getRangeStart(range) {
  if (range === "all") return null;

  const months = range === "12" ? 12 : 6;
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() - (months - 1));
  return date;
}


function getRecordId(record) {
  return record?.id || record?.monitoringId || "";
}

function getPlantingReportId(report) {
  return report?.id || report?.reportId || "";
}

function normalizeMonitoringRecord(record) {
  const history = Array.isArray(record?.history) ? record.history : [];
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const totalChecked = Number(
    latest?.totalMonitored ?? record?.totalMonitored ??
      record?.quantityPlanted ??
      0
  );

  const healthy = Number(
    latest?.healthyCount ?? record?.healthyCount ??
      record?.healthy ??
      0
  );

  const damaged = Number(
    latest?.damagedCount ?? record?.damagedCount ??
      record?.damaged ??
      0
  );

  const dead = Number(
    latest?.deadCount ?? record?.deadCount ??
      record?.dead ??
      0
  );

  return {
    ...record,
    history,
    id: getRecordId(record),
    siteId:
      record?.siteId ||
      record?.plantingSiteId ||
      "",
    siteName:
      record?.siteName ||
      record?.plantingLocation ||
      "",
    barangay: record?.barangay || "",
    participant:
      record?.participantName ||
      record?.participant ||
      "",
    monitoredDate:
      latest?.monitoredDate || record?.monitoringDate ||
      record?.monitoredDate ||
      "",
    nextMonitoringDate:
      record?.nextMonitoringDate || "",
    totalChecked,
    healthy,
    damaged,
    dead,
    survivalRate:
      latest?.survivalRate ?? record?.survivalRate ??
      getSurvivalRate(
        healthy,
        damaged,
        totalChecked
      ),
    condition:
      latest?.condition || record?.condition ||
      deriveCondition(
        healthy,
        damaged,
        dead,
        totalChecked
      ),
    reviewStatus:
      record?.reviewStatus || "Pending",
    archived:
      record?.archived === true,
  };
}

function buildMediaUrl(value) {
  if (!value) return "";

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  const apiRoot = API_BASE_URL.replace(/\/api\/?$/, "");

  return `${apiRoot}${
    value.startsWith("/") ? "" : "/"
  }${value}`;
}

async function getAuthToken(forceRefresh = false) {
  try {
    if (auth && typeof auth.authStateReady === "function") {
      await auth.authStateReady();
    }

    const firebaseUser = auth ? auth.currentUser : null;

    if (firebaseUser) {
      const token = await firebaseUser.getIdToken(forceRefresh);
      window.localStorage.setItem("token", token);
      return token;
    }
  } catch (err) {
    // Fall through to try localStorage token
    console.warn("getAuthToken: firebase auth unavailable, falling back to stored token", err);
  }

  // Fallback: some pages store token in localStorage for compatibility.
  const tokenFromStorage = window.localStorage.getItem("token") || "";
  return tokenFromStorage;
}

async function apiRequest(
  path,
  options = {},
  allowRetry = true
) {
  const token =
    await getAuthToken(false);

  if (!token) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  const buildHeaders = (
    authToken
  ) => ({
    Authorization:
      `Bearer ${authToken}`,

    ...(
      options.body instanceof FormData
        ? {}
        : {
            "Content-Type":
              "application/json",
          }
    ),

    ...(options.headers || {}),
  });

  let response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers:
        buildHeaders(token),
    }
  );

  if (
    response.status === 401 &&
    allowRetry
  ) {
    const refreshedToken =
      await getAuthToken(true);

    if (!refreshedToken) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...options,
        headers:
          buildHeaders(
            refreshedToken
          ),
      }
    );
  }

  let payload;

  try {
    payload =
      await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(
      payload.message ||
        "The request could not be completed."
    );
  }

  return payload;
}

export default function MonitoringPage() {
  const { userRole, currentUser } = useAuth();

  const isParticipant = userRole === "participant";
  const canReview = ["admin", "staff"].includes(userRole);

  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);
  const previewUrlRef = useRef(null);
  const locationMapContainerRef = useRef(null);
  const hasLoadedMonitoringRef = useRef(false);

  const currentIdentity = useMemo(
    () => getCurrentUserIdentity(currentUser),
    [currentUser]
  );

  const [records, setRecords] = useState([]);
  const [plantingReports, setPlantingReports] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [siteFilter, setSiteFilter] = useState("All");
  const [speciesFilter, setSpeciesFilter] = useState("All");
  const [conditionFilter, setConditionFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [trendRange, setTrendRange] = useState("6");

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  const [toast, setToast] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const [form, setForm] = useState({
    plantingReportId: "",
    siteId: "",
    siteName: "",
    barangay: "",
    species: "",
    monitoredDate: new Date().toISOString().slice(0, 10),
    totalChecked: "",
    healthy: "",
    damaged: "",
    dead: "",
    nextMonitoringDate: "",
    latitude: "",
    longitude: "",
    accuracy: "",
    locationCapturedAt: "",
    maturityStatus: "Immature",
    endOfMonitoring: false,
    remarks: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadMonitoringData() {
      if (!hasLoadedMonitoringRef.current) setLoading(true);
      setLoadError("");

      try {
        const monitoringPath =
          isParticipant
            ? "/monitoring/my-records"
            : "/monitoring";

        const [monitoringResponse, plantingResponse, sitesResponse] = await Promise.all([
          apiRequest(monitoringPath),
          apiRequest(
            isParticipant ? "/planting-reports/my-reports" : "/planting-reports"
          ),
          apiRequest("/sites"),
        ]);

        if (cancelled) return;

        const monitoringRecords =
          Array.isArray(
            monitoringResponse.data
          )
            ? monitoringResponse.data
            : [];

        const reports =
          Array.isArray(
            plantingResponse.data
          )
            ? plantingResponse.data
            : [];

        setRecords(
          monitoringRecords.map(
            normalizeMonitoringRecord
          )
        );

        setPlantingReports(
          reports.filter(
            (report) =>
              report?.archived !== true &&
              String(
                report?.verificationStatus ||
                  ""
              )
                .trim()
                .toLowerCase() ===
                "approved"
          )
        );
        setSites(Array.isArray(sitesResponse.data) ? sitesResponse.data : []);
      } catch (error) {
        console.error(
          "Failed to load survival monitoring data:",
          error
        );

        if (!cancelled) {
          setRecords([]);
          setPlantingReports([]);
          setSites([]);
          setLoadError("Unable to load survival monitoring data. Please try again.");
        }
      } finally {
        if (!cancelled) {
          hasLoadedMonitoringRef.current = true;
          setLoading(false);
        }
      }
    }

    loadMonitoringData();

    return () => {
      cancelled = true;
    };
  }, [isParticipant, userRole, retryKey]);

  useEffect(() => {
    const refresh = () => setRetryKey((current) => current + 1);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;

    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!formSuccess) return undefined;
    const timeout = window.setTimeout(() => setFormSuccess(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [formSuccess]);

  useEffect(() => {
    function handleOutsideMenu(event) {
      if (!event.target.closest("[data-monitoring-action-menu]")) {
        setOpenActionMenuId(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideMenu);
    return () => document.removeEventListener("mousedown", handleOutsideMenu);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  async function refreshPlantingReports() {
    setActionLoading(true);
    setFormError("");

    try {
      const [
        monitoringResponse,
        plantingResponse,
      ] = await Promise.all([
        apiRequest(
          isParticipant
            ? "/monitoring/my-records"
            : "/monitoring"
        ),
        apiRequest(
          "/planting-reports"
        ),
      ]);

      setRecords(
        (
          Array.isArray(
            monitoringResponse.data
          )
            ? monitoringResponse.data
            : []
        ).map(
          normalizeMonitoringRecord
        )
      );

      setPlantingReports(
        (
          Array.isArray(
            plantingResponse.data
          )
            ? plantingResponse.data
            : []
        ).filter(
          (report) =>
            report?.archived !== true &&
            String(
              report?.verificationStatus ||
                ""
            )
              .trim()
              .toLowerCase() ===
              "approved"
        )
      );

      setToast(
        "Monitoring data refreshed."
      );
    } catch (error) {
      console.error(error);
      setFormError(
        error.message ||
          "Unable to refresh monitoring data."
      );
    } finally {
      setActionLoading(false);
    }
  }

  const eligiblePlantingReports = useMemo(() => {
    if (!isParticipant) return plantingReports;

    return plantingReports.filter(
      (report) =>
        String(report.participantId || "") ===
        String(currentIdentity.id)
    );
  }, [plantingReports, isParticipant, currentIdentity.id]);

  const selectedLifecycle = useMemo(() => records.find((record) =>
    String(record.plantingReportId) === String(form.plantingReportId)
  ) || null, [records, form.plantingReportId]);

  const selectedSite = useMemo(() => sites.find((site) =>
    String(site.id || site.siteId) === String(form.siteId)
  ) || null, [sites, form.siteId]);

  useEffect(() => {
    if (!showForm || !locationMapContainerRef.current || !selectedSite || !form.latitude || !form.longitude) {
      return undefined;
    }
    const siteLatitude = Number(selectedSite.latitude);
    const siteLongitude = Number(selectedSite.longitude);
    const photoLatitude = Number(form.latitude);
    const photoLongitude = Number(form.longitude);
    if (![siteLatitude, siteLongitude, photoLatitude, photoLongitude].every(Number.isFinite)) return undefined;

    const map = L.map(locationMapContainerRef.current, { zoomControl: true, attributionControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 20,
    }).addTo(map);
    const bounds = L.latLngBounds([[siteLatitude, siteLongitude], [photoLatitude, photoLongitude]]);
    const polygon = Array.isArray(selectedSite.polygon)
      ? selectedSite.polygon.map((point) => [Number(point.lat), Number(point.lng)]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
      : [];
    if (polygon.length >= 3) {
      L.polygon(polygon, { color: "#17643a", weight: 2, fillOpacity: 0.12 }).addTo(map);
      polygon.forEach((point) => bounds.extend(point));
    }
    L.circleMarker([siteLatitude, siteLongitude], { radius: 8, color: "#17643a", fillColor: "#22c55e", fillOpacity: 0.9 })
      .bindTooltip("Registered planting site").addTo(map);
    L.circleMarker([photoLatitude, photoLongitude], { radius: 8, color: "#991b1b", fillColor: "#ef4444", fillOpacity: 0.95 })
      .bindTooltip("Photo EXIF location").addTo(map);
    map.fitBounds(bounds.pad(0.25), { maxZoom: 18 });
    window.setTimeout(() => map.invalidateSize(), 0);
    return () => map.remove();
  }, [showForm, selectedSite, form.latitude, form.longitude]);

  const visibleRecords = useMemo(() => {
    const active = records.filter((record) => record.archived !== true);

    if (!isParticipant) return active;

    return active.filter(
      (record) => record.participantId === currentIdentity.id
    );
  }, [records, isParticipant, currentIdentity.id]);

  const siteOptions = useMemo(
    () =>
      [...new Set(visibleRecords.map((record) => record.siteName).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b)),
    [visibleRecords]
  );

  const speciesOptions = useMemo(
    () =>
      [...new Set(visibleRecords.map((record) => record.species).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b)),
    [visibleRecords]
  );

  const filteredRecords = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return visibleRecords.filter((record) => {
      const searchableText = [
        record.id,
        record.plantingReportId,
        record.siteName,
        record.barangay,
        record.species,
        record.participant,
        record.condition,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        search.length === 0 || searchableText.includes(search);

      const matchesSite =
        siteFilter === "All" || record.siteName === siteFilter;

      const matchesSpecies =
        speciesFilter === "All" || record.species === speciesFilter;

      const matchesCondition =
        conditionFilter === "All" || record.condition === conditionFilter;

      const monitoredDate = record.monitoredDate || record.date || "";
      const matchesFrom = !dateFrom || monitoredDate >= dateFrom;
      const matchesTo = !dateTo || monitoredDate <= dateTo;

      return (
        matchesSearch &&
        matchesSite &&
        matchesSpecies &&
        matchesCondition &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [
    visibleRecords,
    searchTerm,
    siteFilter,
    speciesFilter,
    conditionFilter,
    dateFrom,
    dateTo,
  ]);

  const summary = useMemo(() => {
    const totalRecords = visibleRecords.length;

    const totalTreesMonitored = visibleRecords.reduce(
      (sum, record) => sum + (Number(record.totalChecked) || 0),
      0
    );

    const healthy = visibleRecords.reduce(
      (sum, record) => sum + (Number(record.healthy) || 0),
      0
    );

    const damaged = visibleRecords.reduce(
      (sum, record) => sum + (Number(record.damaged) || 0),
      0
    );

    const dead = visibleRecords.reduce(
      (sum, record) => sum + (Number(record.dead) || 0),
      0
    );

    const survivalRate =
      totalTreesMonitored > 0
        ? Math.round(((healthy + damaged) / totalTreesMonitored) * 100)
        : 0;

    const healthyPercent =
      totalTreesMonitored > 0
        ? Math.round((healthy / totalTreesMonitored) * 100)
        : 0;

    const damagedPercent =
      totalTreesMonitored > 0
        ? Math.round((damaged / totalTreesMonitored) * 100)
        : 0;

    const deadPercent =
      totalTreesMonitored > 0
        ? Math.round((dead / totalTreesMonitored) * 100)
        : 0;

    return {
      totalRecords,
      totalTreesMonitored,
      healthy,
      damaged,
      dead,
      survivalRate,
      healthyPercent,
      damagedPercent,
      deadPercent,
    };
  }, [visibleRecords]);

  const trendData = useMemo(() => {
    const start = getRangeStart(trendRange);
    const grouped = new Map();

    const entries = visibleRecords.flatMap((record) =>
      (record.history || []).map((entry) => ({ ...entry, lifecycleId: record.id }))
    );
    entries.forEach((record) => {
      const dateValue = record.monitoredDate || record.monitoringDate || record.monitoredAt || record.createdAt;
      if (!dateValue) return;

      const date = normalizeTimestamp(dateValue);
      if (!date) return;
      if (start && date < start) return;

      const key = getMonthKey(date.toISOString());
      if (!key) return;

      const current = grouped.get(key) || {
        month: key,
        alive: 0,
        total: 0,
      };

      current.alive +=
        (Number(record.healthyCount ?? record.healthy) || 0) +
        (Number(record.damagedCount ?? record.damaged) || 0);
      current.total += Number(record.totalMonitored ?? record.totalChecked) || 0;

      grouped.set(key, current);
    });

    const monthCount = trendRange === "12" ? 12 : 6;
    if (trendRange !== "all" || grouped.size === 0) {
      const now = new Date();
      for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (!grouped.has(month)) grouped.set(month, { month, alive: 0, total: 0 });
      }
    }
    return [...grouped.values()].sort((a, b) => a.month.localeCompare(b.month)).map((item) => ({
      month: getMonthLabel(item.month),
      survivalRate: item.total > 0 ? Math.round((item.alive / item.total) * 100) : 0,
    }));
  }, [visibleRecords, trendRange]);

  const hasMonitoringHistory = visibleRecords.some((record) => (record.history || []).length > 0);

  const hasGps = form.latitude !== "" && form.longitude !== "";

  function clearPreview() {
    setPhotoFile(null);

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setPhotoPreview("");
    setForm((previous) => ({ ...previous, latitude: "", longitude: "", accuracy: "", locationCapturedAt: "" }));

    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }

    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }

  function resetForm() {
    setForm({
      plantingReportId: "",
      siteId: "",
      siteName: "",
      barangay: "",
      species: "",
      monitoredDate: new Date().toISOString().slice(0, 10),
      totalChecked: "",
      healthy: "",
      damaged: "",
      dead: "",
      nextMonitoringDate: "",
      latitude: "",
      longitude: "",
      accuracy: "",
      locationCapturedAt: "",
      maturityStatus: "Immature",
      endOfMonitoring: false,
      remarks: "",
    });

    setFormError("");
    setLocationLoading(false);
    clearPreview();
  }

  async function openForm() {
    await refreshPlantingReports();
    resetForm();
    setFormSuccess("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
    setFormSuccess("");
  }

  function updateFormField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    if (formError) setFormError("");
    if (formSuccess) setFormSuccess("");
  }

  function handlePlantingReportChange(event) {
    const reportId = event.target.value;

    const report = eligiblePlantingReports.find(
      (item) =>
        String(
          getPlantingReportId(item)
        ) === String(reportId)
    );

    if (!report) {
      setForm((previous) => ({
        ...previous,
        plantingReportId: "",
        siteId: "",
        siteName: "",
        barangay: "",
        species: "",
      }));
      return;
    }

    setForm((previous) => ({
      ...previous,
      plantingReportId:
        getPlantingReportId(report),
      siteId:
        report.siteId ||
        report.plantingSiteId ||
        "",
      siteName:
        report.siteName ||
        report.plantingLocation ||
        "",
      barangay:
        report.barangay || "",
      species:
        report.species || "",
      totalChecked:
        report.quantityPlanted != null
          ? String(
              report.quantityPlanted
            )
          : "",
    }));

    setFormError("");
  }

  async function verifyPhotoLocation(file = photoFile) {
    if (!file) {
      setFormError("Please upload or take a photo first.");
      return false;
    }
    setLocationLoading(true);
    try {
      const metadata = await exifr.parse(file, { gps: true, tiff: true, exif: true });
      const latitude = Number(metadata?.latitude);
      const longitude = Number(metadata?.longitude);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new Error();
      }
      const captured = metadata?.DateTimeOriginal ?? metadata?.CreateDate;
      setForm((previous) => ({
        ...previous,
        latitude: String(latitude), longitude: String(longitude), accuracy: "",
        locationCapturedAt: captured && !Number.isNaN(new Date(captured).getTime())
          ? new Date(captured).toISOString() : "",
      }));
      setFormError("");
      return true;
    } catch {
      setForm((previous) => ({ ...previous, latitude: "", longitude: "", accuracy: "", locationCapturedAt: "" }));
      setFormError("This photo does not contain GPS location metadata. Please upload an original geotagged photo with location information.");
      return false;
    } finally {
      setLocationLoading(false);
    }
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setFormError("Monitoring photo must be JPG, PNG, or WEBP.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setFormError("The monitoring photo must not exceed 10 MB.");
      event.target.value = "";
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const preview = URL.createObjectURL(file);
    previewUrlRef.current = preview;

    setPhotoFile(file);
    setPhotoPreview(preview);
    await verifyPhotoLocation(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!form.plantingReportId) {
      setFormError(
        "Select an approved planting report to monitor."
      );
      return;
    }

    if (selectedLifecycle?.status === "Not Yet Available") {
      setFormError(`Monitoring is not available yet. You can submit the first monitoring record starting on ${selectedLifecycle.startMonitoringDate}.`);
      return;
    }
    if (selectedLifecycle?.status === "Next Monitoring Scheduled") {
      setFormError(`Monitoring is not due yet. You can submit the next monitoring record starting on ${selectedLifecycle.nextMonitoringDate}.`);
      return;
    }
    if (selectedLifecycle?.status === "Monitoring Completed") {
      setFormError("The two-year monitoring period for this planting record has been completed. No additional monitoring record can be submitted.");
      return;
    }

    const totalChecked =
      Number(form.totalChecked);
    const healthy =
      Number(form.healthy);
    const damaged =
      Number(form.damaged);
    const dead =
      Number(form.dead);

    if (
      !Number.isInteger(totalChecked) ||
      totalChecked <= 0 ||
      !Number.isInteger(healthy) ||
      healthy < 0 ||
      !Number.isInteger(damaged) ||
      damaged < 0 ||
      !Number.isInteger(dead) ||
      dead < 0
    ) {
      setFormError(
        "Trees checked, healthy, damaged, and dead must use whole numbers. Trees checked must be at least 1."
      );
      return;
    }

    if (
      healthy +
        damaged +
        dead !==
      totalChecked
    ) {
      setFormError(
        "Healthy + Damaged + Dead must exactly equal Total Trees Checked."
      );
      return;
    }

    const selectedReport =
      eligiblePlantingReports.find(
        (report) =>
          String(
            getPlantingReportId(
              report
            )
          ) ===
          String(
            form.plantingReportId
          )
      );

    const quantityPlanted =
      Number(
        selectedReport?.quantityPlanted
      );

    if (
      Number.isInteger(
        quantityPlanted
      ) &&
      quantityPlanted > 0 &&
      totalChecked !==
        quantityPlanted
    ) {
      setFormError(
        `Total Trees Checked must equal the planted quantity (${quantityPlanted}) for this monitoring round.`
      );
      return;
    }

    if (!photoFile) {
      setFormError(
        "A monitoring photo is required."
      );
      return;
    }

    if (!hasGps) {
      setFormError("This photo does not contain GPS location metadata. Please upload an original geotagged photo with location information.");
      return;
    }

    setActionLoading(true);

    try {
      const payload =
        new FormData();

      payload.append(
        "plantingReportId",
        form.plantingReportId
      );
      payload.append(
        "healthyCount",
        String(healthy)
      );
      payload.append(
        "damagedCount",
        String(damaged)
      );
      payload.append(
        "deadCount",
        String(dead)
      );
      payload.append(
        "maturityStatus",
        form.maturityStatus
      );
      payload.append(
        "remarks",
        form.remarks.trim()
      );
      payload.append(
        "photo",
        photoFile
      );

      const response =
        await apiRequest(
          "/monitoring",
          {
            method: "POST",
            body: payload,
          }
        );

      const newRecord =
        normalizeMonitoringRecord(
          response.data || {}
        );

      setRecords((previous) => [newRecord, ...previous.filter((item) => item.id !== newRecord.id)]);

      resetForm();
      setFormSuccess("Your monitoring record was submitted successfully.");
    } catch (error) {
      console.error(
        "Failed to submit monitoring record:",
        error
      );

      setFormError(
        error.message ||
          "Failed to submit monitoring record."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function openDetails(record) {
    setOpenActionMenuId(null);
    setSelectedRecord(record);
    setShowDetails(true);
  }

  function closeDetails() {
    setSelectedRecord(null);
    setShowDetails(false);
  }

  async function markReviewed() {
    if (
      !selectedRecord ||
      !canReview
    ) {
      return;
    }

    setActionLoading(true);

    try {
      const response =
        await apiRequest(
          `/monitoring/${selectedRecord.id}/review`,
          {
            method: "PATCH",
            body: JSON.stringify({}),
          }
        );

      const updated =
        normalizeMonitoringRecord(
          response.data || {}
        );

      setRecords(
        (previous) =>
          previous.map(
            (record) =>
              record.id ===
              updated.id
                ? updated
                : record
          )
      );

      setSelectedRecord(
        updated
      );

      setToast(
        "Monitoring record marked as reviewed."
      );
    } catch (error) {
      console.error(error);
      setToast("");
      setFormError(
        error.message ||
          "Unable to review monitoring record."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function archiveRecord(record) {
    const confirmed =
      window.confirm(
        `Archive monitoring record ${formatDisplayId("MON", record.monitoringNumber, record.monitoringId, record.id)}? It will be removed from the active list but kept in Firestore.`
      );

    if (!confirmed) return;

    setActionLoading(true);

    try {
      await apiRequest(
        `/monitoring/${record.id}/archive`,
        {
          method: "PATCH",
          body: JSON.stringify({}),
        }
      );

      setRecords(
        (previous) =>
          previous.filter(
            (item) =>
              item.id !== record.id
          )
      );

      setOpenActionMenuId(null);

      if (
        selectedRecord?.id ===
        record.id
      ) {
        closeDetails();
      }

      setToast(
        "Monitoring record archived."
      );
    } catch (error) {
      console.error(error);
      setFormError(
        error.message ||
          "Unable to archive monitoring record."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function resetFilters() {
    setSearchTerm("");
    setSiteFilter("All");
    setSpeciesFilter("All");
    setConditionFilter("All");
    setDateFrom("");
    setDateTo("");
    setShowDateFilter(false);
  }

  if (loading) {
    return (
      <div className="sm-page">
        <div style={{ minHeight: "420px", display: "grid", placeItems: "center", color: "#526159", fontSize: "13px", fontWeight: 600 }}>Loading survival monitoring...</div>
      </div>
    );
  }

  if (loadError && !isParticipant) {
    return <div className="sm-page"><div role="alert" style={{ minHeight: "420px", display: "grid", placeContent: "center", justifyItems: "center", gap: "14px", color: "#526159", fontSize: "13px", fontWeight: 600 }}><span>{loadError}</span><button type="button" className="sm-secondary-button" onClick={() => setRetryKey((key) => key + 1)}>Retry</button></div></div>;
  }

  return (
    <div className="sm-page">
      {toast && (
        <div className="sm-toast">
          <FiCheckCircle size={17} />
          <span>{toast}</span>
        </div>
      )}

      {/* PAGE HEADER */}
      <div className="sm-header">
        <div className="sm-heading-wrap">
          <div className="sm-heading-icon">
            <FiActivity size={21} />
          </div>

          <div>
            <h1 className="sm-title">Survival Monitoring</h1>
            <p className="sm-subtitle">
              Track the survival and condition of planted trees over time.
            </p>
          </div>
        </div>

        <div className="sm-header-actions">
          <button
            type="button"
            className="sm-icon-button"
            title="Refresh data"
            onClick={refreshPlantingReports}
            disabled={actionLoading}
          >
            <FiRefreshCw size={16} />
          </button>

          {isParticipant && (
            <button
              type="button"
              className="sm-primary-button"
              onClick={openForm}
            >
              <FiPlus size={15} />
              Monitor Planted Trees
            </button>
          )}
        </div>
      </div>

      {isParticipant && loadError && (
        <p role="status">Monitoring data is unavailable right now. Refresh to try again.</p>
      )}

      {/* KPI CARDS */}
      <div className="sm-kpi-grid">
        <div className="sm-kpi-card">
          <div className="sm-kpi-icon sm-kpi-green">
            <FiFileText size={20} />
          </div>
          <div>
            <div className="sm-kpi-label">Monitoring Lifecycles</div>
            <div className="sm-kpi-value">{loadError ? "—" : summary.totalRecords}</div>
            <div className="sm-kpi-note">Active records</div>
          </div>
        </div>

        <div className="sm-kpi-card">
          <div className="sm-kpi-icon sm-kpi-orange">
            <FiHeart size={20} />
          </div>
          <div>
            <div className="sm-kpi-label">Total Trees Monitored</div>
            <div className="sm-kpi-value">{loadError ? "—" : summary.totalTreesMonitored}</div>
            <div className="sm-kpi-note">From verified reports</div>
          </div>
        </div>

        <div className="sm-kpi-card">
          <div className="sm-kpi-icon sm-kpi-green">
            <FiTrendingUp size={20} />
          </div>
          <div>
            <div className="sm-kpi-label">Average Survival Rate</div>
            <div className="sm-kpi-value">{loadError ? "—" : `${summary.survivalRate}%`}</div>
            <div className="sm-kpi-note">Across all records</div>
          </div>
        </div>

        <div className="sm-kpi-card">
          <div className="sm-kpi-icon sm-kpi-red">
            <FiActivity size={20} />
          </div>
          <div>
            <div className="sm-kpi-label">Total Trees Lost</div>
            <div className="sm-kpi-value">{loadError ? "—" : summary.dead}</div>
            <div className="sm-kpi-note">Dead trees recorded</div>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="sm-filter-row">
        <div className="sm-search-wrap">
          <FiSearch size={15} />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search monitoring records..."
          />
        </div>

        <select
          className="sm-filter-select"
          value={siteFilter}
          onChange={(event) => setSiteFilter(event.target.value)}
        >
          <option value="All">All Sites</option>
          {siteOptions.map((site) => (
            <option key={site} value={site}>
              {site}
            </option>
          ))}
        </select>

        <select
          className="sm-filter-select"
          value={speciesFilter}
          onChange={(event) => setSpeciesFilter(event.target.value)}
        >
          <option value="All">All Species</option>
          {speciesOptions.map((species) => (
            <option key={species} value={species}>
              {species}
            </option>
          ))}
        </select>

        <select
          className="sm-filter-select"
          value={conditionFilter}
          onChange={(event) => setConditionFilter(event.target.value)}
        >
          <option value="All">All Conditions</option>
          <option value="Healthy">Healthy</option>
          <option value="Damaged">Damaged</option>
          <option value="Dead">Dead</option>
        </select>

        <div className="sm-date-filter-wrap">
          <button
            type="button"
            className="sm-filter-button"
            onClick={() => setShowDateFilter((current) => !current)}
          >
            <FiCalendar size={14} />
            {dateFrom || dateTo ? "Date Range Applied" : "Select Date Range"}
          </button>

          {showDateFilter && (
            <div className="sm-date-popover">
              <div className="sm-date-field">
                <label>From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </div>

              <div className="sm-date-field">
                <label>To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </div>

              <div className="sm-date-actions">
                <button
                  type="button"
                  className="sm-text-button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Clear
                </button>

                <button
                  type="button"
                  className="sm-primary-small"
                  onClick={() => setShowDateFilter(false)}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="sm-filter-button"
          onClick={resetFilters}
          title="Clear all filters"
        >
          <FiFilter size={14} />
          Filters
        </button>
      </div>


      {/* ANALYTICS */}
      <div className="sm-analytics-grid">
        <section className="sm-chart-card">
          <div className="sm-card-heading-row">
            <div>
              <h2>Survival Trend</h2>
              <p>Survival rate (%) over monitoring periods</p>
            </div>

            <select
              className="sm-trend-select"
              value={trendRange}
              onChange={(event) => setTrendRange(event.target.value)}
            >
              <option value="6">Last 6 Months</option>
              <option value="12">Last 12 Months</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <div className="sm-chart-area">
            {trendData.length === 0 ? (
              <div className="sm-chart-empty">
                <div className="sm-chart-empty-icon">
                  <FiTrendingUp size={28} />
                </div>
                <strong>No monitoring data yet</strong>
                <span>
                  Chart will appear after monitoring records are added.
                </span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, "Survival Rate"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="survivalRate"
                    stroke="#138a4b"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            {!hasMonitoringHistory && (
              <div className="sm-chart-zero-message">No survival monitoring records have been submitted yet.</div>
            )}
          </div>
        </section>

        <section className="sm-summary-card">
          <div className="sm-card-heading-row">
            <div>
              <h2>Monitoring Summary</h2>
              <p>Overall condition of all monitored trees</p>
            </div>
          </div>

          <div className="sm-volume-list">
            <div className="sm-volume-row">
              <div className="sm-volume-label">
                <span
                  className="sm-volume-dot"
                  style={{ background: CONDITION_META.Healthy.color }}
                />
                <div>
                  <strong>Healthy</strong>
                  <small>Good condition</small>
                </div>
              </div>

              <div className="sm-volume-progress">
                <div className="sm-volume-top">
                  <span>
                    {summary.healthy} ({summary.healthyPercent}%)
                  </span>
                  <strong>{summary.healthyPercent}%</strong>
                </div>
                <div className="sm-progress-track">
                  <div
                    className="sm-progress-fill sm-fill-healthy"
                    style={{ width: `${summary.healthyPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="sm-volume-row">
              <div className="sm-volume-label">
                <span
                  className="sm-volume-dot"
                  style={{ background: CONDITION_META.Damaged.color }}
                />
                <div>
                  <strong>Damaged</strong>
                  <small>Needs attention</small>
                </div>
              </div>

              <div className="sm-volume-progress">
                <div className="sm-volume-top">
                  <span>
                    {summary.damaged} ({summary.damagedPercent}%)
                  </span>
                  <strong>{summary.damagedPercent}%</strong>
                </div>
                <div className="sm-progress-track">
                  <div
                    className="sm-progress-fill sm-fill-damaged"
                    style={{ width: `${summary.damagedPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="sm-volume-row">
              <div className="sm-volume-label">
                <span
                  className="sm-volume-dot"
                  style={{ background: CONDITION_META.Dead.color }}
                />
                <div>
                  <strong>Dead</strong>
                  <small>Did not survive</small>
                </div>
              </div>

              <div className="sm-volume-progress">
                <div className="sm-volume-top">
                  <span>
                    {summary.dead} ({summary.deadPercent}%)
                  </span>
                  <strong>{summary.deadPercent}%</strong>
                </div>
                <div className="sm-progress-track">
                  <div
                    className="sm-progress-fill sm-fill-dead"
                    style={{ width: `${summary.deadPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="sm-volume-row sm-survival-row">
              <div className="sm-volume-label">
                <div className="sm-survival-icon">
                  <FiTrendingUp size={16} />
                </div>
                <div>
                  <strong>Survival Rate</strong>
                  <small>Overall percentage</small>
                </div>
              </div>

              <div className="sm-volume-progress">
                <div className="sm-volume-top">
                  <span>{summary.survivalRate}%</span>
                  <strong>{summary.survivalRate}%</strong>
                </div>
                <div className="sm-progress-track">
                  <div
                    className="sm-progress-fill sm-fill-survival"
                    style={{ width: `${summary.survivalRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* RECORDS */}
      <section className="sm-records-card">
        <div className="sm-records-header">
          <h2>Monitoring Lifecycles</h2>
        </div>

        <div className="sm-table-wrap">
          <table className="sm-table">
            <thead>
              <tr>
                <th>Monitoring ID</th>
                <th>Planting Report</th>
                <th>Planting Site</th>
                <th>Start Monitoring Date</th>
                <th>Next Monitoring Date</th>
                <th>Status</th>
                <th>Latest Condition</th>
                <th className="sm-actions-heading">Actions</th>
              </tr>
            </thead>

            {filteredRecords.length > 0 && (
              <tbody>
                {filteredRecords.map((record) => {
                  const meta =
                    CONDITION_META[record.condition] || CONDITION_META.Healthy;

                  return (
                    <tr key={record.id}>
                      <td>
                        <span className="sm-record-id">{formatDisplayId("MON", record.monitoringNumber, record.monitoringId, record.id)}</span>
                      </td>
                      <td>{formatDisplayId("RPT", record.plantingReportNumber, record.plantingReportId)}</td>
                      <td>
                        <strong className="sm-site-name">
                          {record.siteName || "—"}
                        </strong>
                        {record.barangay && (
                          <span className="sm-site-sub">
                            Barangay {record.barangay}
                          </span>
                        )}
                      </td>
                      <td>{formatDate(record.startMonitoringDate)}</td>
                      <td>{record.nextMonitoringDate ? formatDate(record.nextMonitoringDate) : record.history?.length ? "No further monitoring required" : "Available after first monitoring submission"}</td>
                      <td>{record.status}</td>
                      <td>
                        <span
                          className="sm-condition-badge"
                          style={{
                            background: meta.soft,
                            color: meta.color,
                          }}
                        >
                          {record.condition}
                        </span>
                      </td>
                      <td>
                        <div
                          className="sm-row-actions"
                          data-monitoring-action-menu
                        >
                          <button
                            type="button"
                            className="sm-row-icon-button"
                            title="View monitoring record"
                            onClick={() => openDetails(record)}
                          >
                            <FiEye size={14} />
                          </button>

                          {canReview && (
                            <>
                              <button
                                type="button"
                                className="sm-row-icon-button"
                                title="More actions"
                                onClick={() =>
                                  setOpenActionMenuId((current) =>
                                    current === record.id ? null : record.id
                                  )
                                }
                              >
                                <FiMoreVertical size={15} />
                              </button>

                              {openActionMenuId === record.id && (
                                <div className="sm-action-menu">
                                  <button
                                    type="button"
                                    onClick={() => archiveRecord(record)}
                                  >
                                    <FiArchive size={14} />
                                    Archive Record
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>

          {filteredRecords.length === 0 && (
            <div className="sm-empty-state">
              <div className="sm-empty-illustration">
                <FiFileText size={28} />
                <FiSearch size={22} />
              </div>

              <strong>
                {loadError
                  ? "Monitoring data unavailable"
                  : visibleRecords.length === 0
                  ? "No monitoring records yet"
                  : "No matching monitoring records"}
              </strong>

              <p>
                {loadError
                  ? "Refresh the page to try loading your records again."
                  : visibleRecords.length === 0
                  ? isParticipant
                    ? "Your monitoring records will appear here after you submit updates for verified planting reports."
                    : "Survival monitoring records will appear here once participants submit updates for verified planting reports."
                  : "Try changing or clearing the current filters."}
              </p>
            </div>
          )}
        </div>

        <div className="sm-table-footer">
          <span>
            Showing {filteredRecords.length === 0 ? 0 : 1} to{" "}
            {filteredRecords.length} of {filteredRecords.length} records
          </span>

          <div className="sm-pagination">
            <button type="button" disabled>
              ‹
            </button>
            <button type="button" className="is-active">
              1
            </button>
            <button type="button" disabled>
              ›
            </button>
          </div>
        </div>
      </section>

      {/* ADD MONITORING RECORD */}
      {showForm && isParticipant && (
        <div className="sm-modal-backdrop">
          <div className="sm-modal">
            <div className="sm-modal-header">
              <div>
                <h2>Monitor Planted Trees</h2>
                <p>
                  Monitor a verified planting report and document the current
                  survival condition.
                </p>
              </div>

              <button
                type="button"
                className="sm-modal-close"
                onClick={closeForm}
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="sm-modal-body">
                <FormAlert type="error">{formError}</FormAlert>
                <FormAlert type="success">{formSuccess}</FormAlert>
                {!formError && !formSuccess && selectedLifecycle?.status === "Not Yet Available" && (
                  <FormAlert type="info">Monitoring is not available yet. You can submit the first monitoring record starting on {formatDate(selectedLifecycle.startMonitoringDate)}, which is two weeks after the planting event.</FormAlert>
                )}
                {!formError && !formSuccess && selectedLifecycle?.status === "Next Monitoring Scheduled" && (
                  <FormAlert type="info">Monitoring is not due yet. You can submit the next monitoring record starting on {formatDate(selectedLifecycle.nextMonitoringDate)}.</FormAlert>
                )}
                {!formError && !formSuccess && selectedLifecycle?.status === "Monitoring Completed" && (
                  <FormAlert type="info">The two-year monitoring period for this planting record has been completed. No additional monitoring record can be submitted.</FormAlert>
                )}

                <div className="sm-form-section">
                  <div className="sm-form-section-title">
                    <FiFileText size={15} />
                    Verified Planting Report
                  </div>

                  <label className="sm-label">
                    Planting Report <span>*</span>
                  </label>

                  <select
                    className="sm-input"
                    value={form.plantingReportId}
                    onChange={handlePlantingReportChange}
                  >
                    <option value="">Select verified planting report</option>
                    {eligiblePlantingReports.map((report) => (
                      <option
                        key={getPlantingReportId(report)}
                        value={getPlantingReportId(report)}
                      >
                        {formatDisplayId("RPT", report.reportNumber, report.reportId, getPlantingReportId(report))} — {report.eventName || "Planting Event"} — {report.siteName || report.plantingLocation || "Planting Site"}
                      </option>
                    ))}
                  </select>

                  {eligiblePlantingReports.length === 0 && (
                    <div className="sm-helper">
                      No verified planting report is currently available for
                      monitoring.
                    </div>
                  )}

                  {form.plantingReportId && (
                    <>
                      <div className="sm-selected-report">
                        <div>
                          <span>Planting Site</span>
                          <strong>{form.siteName || "—"}</strong>
                        </div>
                        <div>
                          <span>Barangay</span>
                          <strong>{form.barangay || "—"}</strong>
                        </div>
                        <div>
                          <span>Species</span>
                          <strong>{form.species || "—"}</strong>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="sm-form-section sm-summary-section">
                  <div className="sm-form-section-title">
                    <FiActivity size={15} />
                    Monitoring Summary
                  </div>

                  <div className="sm-form-grid">
                    <div><label className="sm-label">Start Monitoring Date</label><div className="sm-input">{selectedLifecycle?.startMonitoringDate ? formatDate(selectedLifecycle.startMonitoringDate) : "Select a planting report"}</div></div>
                    <div><label className="sm-label">Next Monitoring Date</label><div className="sm-input">{selectedLifecycle?.nextMonitoringDate ? formatDate(selectedLifecycle.nextMonitoringDate) : "Available after first monitoring submission"}</div></div>

                    <div>
                      <label className="sm-label">
                        Total Trees Checked <span>*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="sm-input"
                        value={form.totalChecked}
                        onChange={(event) =>
                          updateFormField("totalChecked", event.target.value)
                        }
                        placeholder="0"
                        readOnly={Boolean(form.plantingReportId)}
                      />
                    </div>

                    <div>
                      <label className="sm-label">
                        Healthy <span>*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="sm-input"
                        value={form.healthy}
                        onChange={(event) =>
                          updateFormField("healthy", event.target.value)
                        }
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="sm-label">
                        Damaged <span>*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="sm-input"
                        value={form.damaged}
                        onChange={(event) =>
                          updateFormField("damaged", event.target.value)
                        }
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="sm-label">
                        Dead <span>*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="sm-input"
                        value={form.dead}
                        onChange={(event) =>
                          updateFormField("dead", event.target.value)
                        }
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="sm-label">
                        Maturity Status <span>*</span>
                      </label>
                      <select
                        className="sm-input"
                        value={form.maturityStatus}
                        onChange={(event) =>
                          updateFormField(
                            "maturityStatus",
                            event.target.value
                          )
                        }
                      >
                        <option value="Immature">Immature</option>
                        <option value="Mature">Mature</option>
                      </select>
                    </div>

                  </div>

                  <div className="sm-helper">
                    Healthy + Damaged + Dead must equal Total Trees Checked.
                    Survival rate counts Healthy and Damaged trees as surviving.
                  </div>
                </div>

                <div className="sm-form-section sm-location-section">
                  <div className="sm-form-section-title">
                    <FiMapPin size={15} />
                    Photo Location Verification
                  </div>

                  <div className="sm-gps-card">
                    <div>
                      <strong>
                        {hasGps
                          ? "Photo GPS found"
                          : "Verify photo location"}
                      </strong>
                      <span>
                        Location is read from the selected photo's EXIF metadata.
                      </span>
                    </div>

                    <button
                      type="button"
                      className="sm-secondary-button"
                      onClick={() => void verifyPhotoLocation()}
                      disabled={locationLoading}
                    >
                      <FiMapPin size={14} />
                      {locationLoading ? "Reading Photo..." : "Verify Photo Location"}
                    </button>
                  </div>

                  {hasGps && (
                    <>
                      <div className="sm-gps-values">
                        <div>
                          <span>Latitude</span>
                          <strong>{form.latitude}</strong>
                        </div>
                        <div>
                          <span>Longitude</span>
                          <strong>{form.longitude}</strong>
                        </div>
                        <div>
                          <span>Source</span>
                          <strong>Photo EXIF metadata</strong>
                        </div>
                      </div>
                      {selectedSite && <div ref={locationMapContainerRef} className="sm-location-map" aria-label="Photo and planting site location map" />}
                    </>
                  )}
                </div>

                <div className="sm-form-section sm-photo-section">
                  <div className="sm-form-section-title">
                    <FiCamera size={15} />
                    Monitoring Photo
                  </div>

                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="sm-hidden-input"
                    onChange={handlePhotoChange}
                  />

                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sm-hidden-input"
                    onChange={handlePhotoChange}
                  />

                  {photoPreview ? (
                    <div className="sm-photo-preview-wrap">
                      <img
                        src={photoPreview}
                        alt="Monitoring preview"
                        className="sm-photo-preview"
                      />
                      <div className="sm-photo-preview-footer">
                        <span>
                          {photoFile?.name} •{" "}
                          {photoFile ? formatFileSize(photoFile.size) : ""}
                        </span>
                        <button
                          type="button"
                          className="sm-text-button"
                          onClick={clearPreview}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="sm-upload-box">
                      <FiCamera size={23} />
                      <strong>Monitoring Photo Evidence</strong>
                      <span>JPG, PNG, or WEBP up to 10 MB</span>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: "10px",
                          flexWrap: "wrap",
                          marginTop: "12px",
                        }}
                      >
                        <button
                          type="button"
                          className="sm-primary-button"
                          onClick={() => cameraInputRef.current?.click()}
                        >
                          <FiCamera size={14} />
                          Take Photo
                        </button>

                        <button
                          type="button"
                          className="sm-secondary-button"
                          onClick={() => uploadInputRef.current?.click()}
                        >
                          <FiImage size={14} />
                          Upload Existing Photo
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="sm-form-section sm-form-section-last">
                  <label className="sm-label">Remarks</label>
                  <textarea
                    className="sm-textarea"
                    value={form.remarks}
                    onChange={(event) =>
                      updateFormField("remarks", event.target.value)
                    }
                    placeholder="Describe the current condition of the monitored trees..."
                  />
                </div>
              </div>

              <div className="sm-modal-footer">
                <button
                  type="button"
                  className="sm-secondary-button"
                  onClick={closeForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="sm-primary-button"
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? "Submitting..."
                    : "Submit Monitoring Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MONITORING DETAILS DRAWER */}
      {showDetails && selectedRecord && (
        <div
          className="sm-drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDetails();
          }}
        >
          <aside className="sm-details-drawer">
            <div className="sm-drawer-header">
              <div>
                <h2>Survival Monitoring Details</h2>
                <div className="sm-drawer-meta">
                  <span
                    className="sm-condition-badge"
                    style={{
                      background:
                        CONDITION_META[selectedRecord.condition]?.soft,
                      color: CONDITION_META[selectedRecord.condition]?.color,
                    }}
                  >
                    {selectedRecord.condition}
                  </span>
                  <span>{formatDisplayId("MON", selectedRecord.monitoringNumber, selectedRecord.monitoringId, selectedRecord.id)}</span>
                </div>
              </div>

              <button
                type="button"
                className="sm-modal-close"
                onClick={closeDetails}
              >
                <FiX size={19} />
              </button>
            </div>

            <div className="sm-drawer-body">
              <section className="sm-detail-section">
                <h3>Basic Information</h3>
                <div className="sm-detail-grid">
                  <div>
                    <span>Planting Report ID</span>
                    <strong>{formatDisplayId("RPT", selectedRecord.plantingReportNumber, selectedRecord.plantingReportId)}</strong>
                  </div>
                  <div>
                    <span>Planting Event</span>
                    <strong>{selectedRecord.eventName || "—"}</strong>
                  </div>
                  <div>
                    <span>Planting Site</span>
                    <strong>{selectedRecord.siteName || "—"}</strong>
                  </div>
                  <div>
                    <span>Authoritative Planting Date</span>
                    <strong>{formatDate(selectedRecord.authoritativePlantingDate)}</strong>
                  </div>
                  <div>
                    <span>Start Monitoring Date</span>
                    <strong>{formatDate(selectedRecord.startMonitoringDate)}</strong>
                  </div>
                  <div>
                    <span>Next Monitoring Date</span>
                    <strong>{selectedRecord.nextMonitoringDate ? formatDate(selectedRecord.nextMonitoringDate) : "No further monitoring required"}</strong>
                  </div>
                  <div>
                    <span>Lifecycle Status</span>
                    <strong>{selectedRecord.status || "—"}</strong>
                  </div>
                  <div>
                    <span>Monitoring Entries</span>
                    <strong>{selectedRecord.history?.length || 0}</strong>
                  </div>
                  <div>
                    <span>Submitted By</span>
                    <strong>{selectedRecord.participant || "—"}</strong>
                  </div>
                  <div>
                    <span>Monitoring Ends</span>
                    <strong>{formatDate(selectedRecord.monitoringEndDate)}</strong>
                  </div>
                </div>
              </section>

              {selectedRecord.history?.length > 0 && (
                <section className="sm-detail-section">
                  <h3>Latest Monitoring Summary</h3>

                  <div className="sm-detail-summary-grid">
                    <div><span>Healthy</span><strong>{selectedRecord.healthy}</strong></div>
                    <div><span>Damaged</span><strong>{selectedRecord.damaged}</strong></div>
                    <div><span>Dead</span><strong>{selectedRecord.dead}</strong></div>
                    <div className="is-survival"><span>Survival Rate</span><strong>{selectedRecord.survivalRate}%</strong></div>
                  </div>
                </section>
              )}

              {selectedRecord.history?.length > 0 && <section className="sm-detail-section">
                <h3>Monitoring Photo</h3>

                {selectedRecord.photoPreview || selectedRecord.photoUrl ? (
                  <img
                    className="sm-detail-photo"
                    src={
                      selectedRecord.photoPreview ||
                      buildMediaUrl(selectedRecord.photoUrl)
                    }
                    alt="Monitoring evidence"
                  />
                ) : (
                  <div className="sm-photo-unavailable">
                    <FiImage size={22} />
                    <div>
                      <strong>Photo metadata recorded</strong>
                      <span>
                        {selectedRecord.photoName || "Monitoring photo"}
                        {selectedRecord.photoSize
                          ? ` • ${formatFileSize(selectedRecord.photoSize)}`
                          : ""}
                      </span>
                      <span>
                        The saved monitoring image will appear here when a photo
                        is available for this record.
                      </span>
                    </div>
                  </div>
                )}
              </section>}

              {selectedRecord.history?.length > 0 && <section className="sm-detail-section">
                <h3>Location Information</h3>
                <div className="sm-detail-grid">
                  <div>
                    <span>Latitude</span>
                    <strong>{selectedRecord.latitude ?? "—"}</strong>
                  </div>
                  <div>
                    <span>Longitude</span>
                    <strong>{selectedRecord.longitude ?? "—"}</strong>
                  </div>
                  <div>
                    <span>Accuracy</span>
                    <strong>
                      {selectedRecord.accuracy
                        ? `± ${selectedRecord.accuracy} m`
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Captured</span>
                    <strong>
                      {formatDateTime(selectedRecord.locationCapturedAt)}
                    </strong>
                  </div>
                </div>
              </section>}

              <section className="sm-detail-section sm-detail-section-last">
                <h3>Monitoring History</h3>

                {selectedRecord.history?.length ? (
                  <div className="sm-history-entry-list">
                    {selectedRecord.history.map((entry, index) => (
                      <article className="sm-history-entry" key={entry.id || `${entry.monitoredDate}-${index}`}>
                        <div className="sm-history-entry-header">
                          <strong>Monitoring Entry {index + 1}</strong>
                          <span>{formatDateTime(entry.monitoredAt || entry.createdAt)}</span>
                        </div>
                        <div className="sm-detail-grid">
                          <div><span>Condition</span><strong>{entry.condition || "—"}</strong></div>
                          <div><span>Date Monitored</span><strong>{formatDate(entry.monitoredDate)}</strong></div>
                          <div><span>Healthy / Damaged / Dead</span><strong>{entry.healthyCount || 0} / {entry.damagedCount || 0} / {entry.deadCount || 0}</strong></div>
                          <div><span>Survival Rate</span><strong>{entry.survivalRate ?? 0}%</strong></div>
                          <div><span>Photo Coordinates</span><strong>{entry.latitude ?? "—"}, {entry.longitude ?? "—"}</strong></div>
                          <div><span>Site Verification</span><strong>{entry.automatedVerificationStatus || "—"}</strong></div>
                          <div><span>Remarks</span><strong>{entry.remarks || "—"}</strong></div>
                        </div>
                        {entry.photoUrl && <img className="sm-detail-photo" src={buildMediaUrl(entry.photoUrl)} alt={`Monitoring evidence ${index + 1}`} />}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="sm-helper">No monitoring entries have been submitted for this planting record.</p>
                )}

                {canReview &&
                  selectedRecord.reviewStatus !== "Reviewed" && (
                    <div className="sm-review-actions">
                      <button
                        type="button"
                        className="sm-primary-button"
                        onClick={markReviewed}
                        disabled={actionLoading}
                      >
                        <FiCheckCircle size={14} />
                        Mark as Reviewed
                      </button>
                    </div>
                  )}
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
