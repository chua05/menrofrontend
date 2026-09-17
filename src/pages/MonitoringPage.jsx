import { useEffect, useMemo, useRef, useState } from "react";
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
import { auth } from "../firebase/config";
import "../styles/survival-monitoring.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

const CONDITION_META = {
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
  const totalChecked = Number(
    record?.totalMonitored ??
      record?.quantityPlanted ??
      0
  );

  const healthy = Number(
    record?.healthyCount ??
      record?.healthy ??
      0
  );

  const damaged = Number(
    record?.damagedCount ??
      record?.damaged ??
      0
  );

  const dead = Number(
    record?.deadCount ??
      record?.dead ??
      0
  );

  return {
    ...record,
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
      record?.monitoringDate ||
      record?.monitoredDate ||
      "",
    nextMonitoringDate:
      record?.nextMonitoringDate || "",
    totalChecked,
    healthy,
    damaged,
    dead,
    survivalRate:
      record?.survivalRate ??
      getSurvivalRate(
        healthy,
        damaged,
        totalChecked
      ),
    condition:
      record?.condition ||
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
  if (
    typeof auth.authStateReady === "function"
  ) {
    await auth.authStateReady();
  }

  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    return "";
  }

  const token =
    await firebaseUser.getIdToken(
      forceRefresh
    );

  window.localStorage.setItem(
    "token",
    token
  );

  return token;
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

  const currentIdentity = useMemo(
    () => getCurrentUserIdentity(currentUser),
    [currentUser]
  );

  const [records, setRecords] = useState([]);
  const [plantingReports, setPlantingReports] = useState([]);
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
      setLoading(true);
      setLoadError("");

      try {
        const monitoringPath =
          isParticipant
            ? "/monitoring/my-records"
            : "/monitoring";

        const [
          monitoringResponse,
          plantingResponse,
        ] = await Promise.all([
          apiRequest(monitoringPath),
          apiRequest(
            "/planting-reports"
          ),
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
      } catch (error) {
        console.error(
          "Failed to load survival monitoring data:",
          error
        );

        if (!cancelled) {
          setRecords([]);
          setPlantingReports([]);
          setLoadError("Unable to load survival monitoring data. Please try again.");
        }
      } finally {
        if (!cancelled) {
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
    if (!toast) return undefined;

    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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

    visibleRecords.forEach((record) => {
      const dateValue = record.monitoredDate || record.date;
      if (!dateValue) return;

      const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
      if (Number.isNaN(date.getTime())) return;
      if (start && date < start) return;

      const key = getMonthKey(dateValue);
      if (!key) return;

      const current = grouped.get(key) || {
        month: key,
        alive: 0,
        total: 0,
      };

      current.alive +=
        (Number(record.healthy) || 0) + (Number(record.damaged) || 0);
      current.total += Number(record.totalChecked) || 0;

      grouped.set(key, current);
    });

    return [...grouped.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((item) => ({
        month: getMonthLabel(item.month),
        survivalRate:
          item.total > 0 ? Math.round((item.alive / item.total) * 100) : 0,
      }));
  }, [visibleRecords, trendRange]);

  const hasGps =
    form.latitude !== "" &&
    form.longitude !== "" &&
    form.locationCapturedAt !== "";

  function clearPreview() {
    setPhotoFile(null);

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setPhotoPreview("");

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
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  function updateFormField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    if (formError) setFormError("");
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

  function captureLocation() {
    setFormError("");

    if (!navigator.geolocation) {
      setFormError(
        "Location services are not supported by this browser or device."
      );
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((previous) => ({
          ...previous,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
          accuracy: Number(position.coords.accuracy).toFixed(1),
          locationCapturedAt: new Date(position.timestamp).toISOString(),
        }));

        setLocationLoading(false);
        setToast("Current GPS location captured.");
      },
      (error) => {
        setLocationLoading(false);

        let message =
          "Unable to capture your current location. Please enable location services and try again.";

        if (error.code === error.PERMISSION_DENIED) {
          message =
            "Location permission was denied. Allow location access in your browser and try again.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message =
            "Your current location is unavailable. Make sure GPS or device location is turned on.";
        } else if (error.code === error.TIMEOUT) {
          message =
            "Location request timed out. Move to an area with a better GPS signal and try again.";
        }

        setFormError(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!hasGps) {
      setFormError(
        "Capture the current GPS location before taking or uploading a monitoring photo."
      );
      event.target.value = "";
      return;
    }

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
    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (!form.plantingReportId) {
      setFormError(
        "Select an approved planting report to monitor."
      );
      return;
    }

    if (!form.monitoredDate) {
      setFormError(
        "Monitoring date is required."
      );
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

    if (!hasGps) {
      setFormError(
        "Capture the current GPS location before submitting."
      );
      return;
    }

    if (!photoFile) {
      setFormError(
        "A monitoring photo is required."
      );
      return;
    }

    if (
      form.endOfMonitoring &&
      form.maturityStatus !==
        "Mature"
    ) {
      setFormError(
        "A monitoring cycle can only be ended when the trees are marked Mature."
      );
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
        "monitoringDate",
        form.monitoredDate
      );
      payload.append(
        "nextMonitoringDate",
        form.nextMonitoringDate || ""
      );
      payload.append(
        "maturityStatus",
        form.maturityStatus
      );
      payload.append(
        "endOfMonitoring",
        String(
          form.endOfMonitoring
        )
      );
      payload.append(
        "latitude",
        form.latitude
      );
      payload.append(
        "longitude",
        form.longitude
      );
      payload.append(
        "accuracy",
        form.accuracy
      );
      payload.append(
        "locationCapturedAt",
        form.locationCapturedAt
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

      setRecords(
        (previous) => [
          newRecord,
          ...previous,
        ]
      );

      setShowForm(false);
      resetForm();

      setToast(
        "Monitoring record submitted successfully."
      );
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
        `Archive monitoring record ${record.id}? It will be removed from the active list but kept in Firestore.`
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

  if (loadError) {
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
              Add Monitoring Record
            </button>
          )}
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="sm-kpi-grid">
        <div className="sm-kpi-card">
          <div className="sm-kpi-icon sm-kpi-green">
            <FiFileText size={20} />
          </div>
          <div>
            <div className="sm-kpi-label">Total Monitoring Records</div>
            <div className="sm-kpi-value">{summary.totalRecords}</div>
            <div className="sm-kpi-note">Active records</div>
          </div>
        </div>

        <div className="sm-kpi-card">
          <div className="sm-kpi-icon sm-kpi-orange">
            <FiHeart size={20} />
          </div>
          <div>
            <div className="sm-kpi-label">Total Trees Monitored</div>
            <div className="sm-kpi-value">{summary.totalTreesMonitored}</div>
            <div className="sm-kpi-note">From verified reports</div>
          </div>
        </div>

        <div className="sm-kpi-card">
          <div className="sm-kpi-icon sm-kpi-green">
            <FiTrendingUp size={20} />
          </div>
          <div>
            <div className="sm-kpi-label">Average Survival Rate</div>
            <div className="sm-kpi-value">{summary.survivalRate}%</div>
            <div className="sm-kpi-note">Across all records</div>
          </div>
        </div>

        <div className="sm-kpi-card">
          <div className="sm-kpi-icon sm-kpi-red">
            <FiActivity size={20} />
          </div>
          <div>
            <div className="sm-kpi-label">Total Trees Lost</div>
            <div className="sm-kpi-value">{summary.dead}</div>
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
          <h2>Monitoring Records</h2>
        </div>

        <div className="sm-table-wrap">
          <table className="sm-table">
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Planting Site</th>
                <th>Species</th>
                <th>Date Monitored</th>
                <th>Trees Checked</th>
                <th>Survival Rate</th>
                <th>Condition</th>
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
                        <span className="sm-record-id">{record.id}</span>
                      </td>
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
                      <td>{record.species || "—"}</td>
                      <td>{formatDate(record.monitoredDate)}</td>
                      <td>{record.totalChecked ?? "—"}</td>
                      <td>
                        <strong>{record.survivalRate ?? 0}%</strong>
                      </td>
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
                {visibleRecords.length === 0
                  ? "No monitoring records yet"
                  : "No matching monitoring records"}
              </strong>

              <p>
                {visibleRecords.length === 0
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
                <h2>Add Monitoring Record</h2>
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
                {formError && (
                  <div className="sm-error-box">{formError}</div>
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
                        {getPlantingReportId(report)} —{" "}
                        {report.siteName ||
                          report.plantingLocation ||
                          "Planting Site"}{" "}
                        — {report.species || "Tree"}
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
                  )}
                </div>

                <div className="sm-form-section">
                  <div className="sm-form-section-title">
                    <FiActivity size={15} />
                    Monitoring Summary
                  </div>

                  <div className="sm-form-grid">
                    <div>
                      <label className="sm-label">
                        Monitoring Date <span>*</span>
                      </label>
                      <input
                        type="date"
                        className="sm-input"
                        value={form.monitoredDate}
                        onChange={(event) =>
                          updateFormField("monitoredDate", event.target.value)
                        }
                      />
                    </div>

                    <div>
                      <label className="sm-label">Next Monitoring Date</label>
                      <input
                        type="date"
                        className="sm-input"
                        value={form.nextMonitoringDate}
                        onChange={(event) =>
                          updateFormField(
                            "nextMonitoringDate",
                            event.target.value
                          )
                        }
                      />
                    </div>

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

                    <div>
                      <label className="sm-label">
                        End Monitoring
                      </label>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          minHeight: "42px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.endOfMonitoring}
                          disabled={form.maturityStatus !== "Mature"}
                          onChange={(event) =>
                            updateFormField(
                              "endOfMonitoring",
                              event.target.checked
                            )
                          }
                        />
                        End monitoring for this planting report
                      </label>
                    </div>
                  </div>

                  <div className="sm-helper">
                    Healthy + Damaged + Dead must equal Total Trees Checked.
                    Survival rate counts Healthy and Damaged trees as surviving.
                  </div>
                </div>

                <div className="sm-form-section">
                  <div className="sm-form-section-title">
                    <FiMapPin size={15} />
                    Current GPS Location
                  </div>

                  <div className="sm-gps-card">
                    <div>
                      <strong>
                        {hasGps
                          ? "Location captured"
                          : "Capture monitoring location"}
                      </strong>
                      <span>
                        GPS is required before a monitoring photo can be
                        uploaded.
                      </span>
                    </div>

                    <button
                      type="button"
                      className="sm-secondary-button"
                      onClick={captureLocation}
                      disabled={locationLoading}
                    >
                      <FiMapPin size={14} />
                      {locationLoading ? "Capturing..." : "Capture GPS"}
                    </button>
                  </div>

                  {hasGps && (
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
                        <span>Accuracy</span>
                        <strong>± {form.accuracy} m</strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="sm-form-section">
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
                    disabled={!hasGps}
                    onChange={handlePhotoChange}
                  />

                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sm-hidden-input"
                    disabled={!hasGps}
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
                    <div
                      className={`sm-upload-box ${
                        !hasGps ? "is-disabled" : ""
                      }`}
                    >
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
                          disabled={!hasGps}
                          onClick={() => cameraInputRef.current?.click()}
                        >
                          <FiCamera size={14} />
                          Take Photo
                        </button>

                        <button
                          type="button"
                          className="sm-secondary-button"
                          disabled={!hasGps}
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
                  <span>{selectedRecord.id}</span>
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
                    <span>Planting Site</span>
                    <strong>{selectedRecord.siteName || "—"}</strong>
                  </div>
                  <div>
                    <span>Date Monitored</span>
                    <strong>{formatDate(selectedRecord.monitoredDate)}</strong>
                  </div>
                  <div>
                    <span>Planting Report ID</span>
                    <strong>{selectedRecord.plantingReportId || "—"}</strong>
                  </div>
                  <div>
                    <span>Total Trees Checked</span>
                    <strong>{selectedRecord.totalChecked}</strong>
                  </div>
                  <div>
                    <span>Tree Species</span>
                    <strong>{selectedRecord.species || "—"}</strong>
                  </div>
                  <div>
                    <span>Next Monitoring Date</span>
                    <strong>
                      {formatDate(selectedRecord.nextMonitoringDate)}
                    </strong>
                  </div>
                  <div>
                    <span>Submitted By</span>
                    <strong>{selectedRecord.participant || "—"}</strong>
                  </div>
                  <div>
                    <span>Remarks</span>
                    <strong>{selectedRecord.remarks || "—"}</strong>
                  </div>
                </div>
              </section>

              <section className="sm-detail-section">
                <h3>Monitoring Summary</h3>

                <div className="sm-detail-summary-grid">
                  <div>
                    <span>Healthy</span>
                    <strong>{selectedRecord.healthy}</strong>
                  </div>
                  <div>
                    <span>Damaged</span>
                    <strong>{selectedRecord.damaged}</strong>
                  </div>
                  <div>
                    <span>Dead</span>
                    <strong>{selectedRecord.dead}</strong>
                  </div>
                  <div className="is-survival">
                    <span>Survival Rate</span>
                    <strong>{selectedRecord.survivalRate}%</strong>
                  </div>
                </div>
              </section>

              <section className="sm-detail-section">
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
              </section>

              <section className="sm-detail-section">
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
              </section>

              <section className="sm-detail-section sm-detail-section-last">
                <h3>Monitoring History</h3>

                <div className="sm-history">
                  <div className="sm-history-item">
                    <span className="sm-history-dot">✓</span>
                    <div>
                      <strong>Submitted</strong>
                      <p>
                        {formatDateTime(selectedRecord.createdAt)} by{" "}
                        {selectedRecord.participant || "Participant"}
                      </p>
                    </div>
                  </div>

                  {selectedRecord.reviewStatus === "Reviewed" &&
                    selectedRecord.reviewedAt && (
                      <div className="sm-history-item">
                        <span className="sm-history-dot">✓</span>
                        <div>
                          <strong>Reviewed</strong>
                          <p>
                            {formatDateTime(selectedRecord.reviewedAt)} by{" "}
                            {selectedRecord.reviewedBy || "MENRO Staff"}
                          </p>
                        </div>
                      </div>
                    )}
                </div>

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
