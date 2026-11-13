import VerifiedPlantingCohortsPage from "./VerifiedPlantingCohortsPage";
import { resolveVerifiedPlantingCohortEnabled } from "../utils/verifiedPlantingCohort";
import PlantingPhotoControls from "../components/PlantingPhotoControls";
import AttendanceUpload from "../components/AttendanceUpload";
import ModalDialog from "../components/ModalDialog";
import { attendanceFileError } from "../utils/attendanceFile";
import { Component, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import L from "leaflet";
import { boundaryLayerOptions } from "../utils/barangayMap";
import { createEvidenceAttempt, assertEvidenceComplete } from "../utils/evidenceAttempt";
import { AMBIGUOUS_WRITE_MESSAGE, AUTH_TIMEOUT_MESSAGE, AUTH_TIMEOUT_MS, READ_TIMEOUT_MESSAGE, READ_TIMEOUT_MS, RequestTimeoutError, UPLOAD_TIMEOUT_MS, WRITE_TIMEOUT_MS, isAmbiguousWriteFailure, isGatewayWriteFailure, isWriteMethod, serverFailureMessage, withDeadline } from "../utils/requestTimeout";
import { findOwnPendingSubmission, findReconciledSubmission, ownSubmissionIdsForEvent } from "../utils/plantingSubmissionReconcile";
import { clearPendingSubmission, loadPendingSubmission, savePendingSubmission } from "../utils/pendingPlantingSubmission";
import "leaflet/dist/leaflet.css";
import * as exifr from "exifr";
import { extractGpsCoordinates } from "../utils/exifGps";
import PageLoadingState from "../components/PageLoadingState";
import { focusFirstInvalid, backendFieldErrors, retainInvalidFieldMessages } from "../utils/formValidation";
import {
  MAX_LEFTOVER_REASON_LENGTH,
  finalReportFieldErrors,
  finalReportItems,
  finalReportRows,
  validatePlantingReportForm,
} from "../utils/plantingReportForm";
import SecureCameraCapture from "../components/SecureCameraCapture";
import StaffPlantingReportForm, { ProtectedAttendanceButton } from "../components/StaffPlantingReportForm";
import { buildEvidenceLocationView, photoGpsMetadataLabel } from "../utils/evidenceLocationView";
import { SITE_GPS_TOLERANCE_METERS, buildLocationPreviewStatus, calculateDistanceMeters, getFeatureBarangayName, isPointInBulanBoundary, isPointInPolygon } from "../utils/plantingLocationPreview";
import PhotoRequirementsDialog from "../components/PhotoRequirementsDialog";
import PlantingEvidenceMap from "../components/PlantingEvidenceMap";
import EventAttendancePanel from "../components/EventAttendancePanel";
import {
  REPORT_KPIS,
  REPORT_STATUS_FILTERS,
  currentReports,
  latestSubmittedAt,
  photoAvailabilityMessage,
  reportKpiCounts,
  reportMatchesStatusFilter,
  reportReviewStages,
  reportSeedlingItems,
  reportHistory,
  reportReviewStatus,
  reportSubmissionStatus,
} from "../utils/plantingReportView";
import { useToast } from "../context/ToastContext";
import {
  DECISIONS,
  EVIDENCE_STATE_LABEL,
  MAX_DECISION_REASON_LENGTH,
  WORKFLOW_STATUS,
  WORKFLOW_STATUS_CLASS,
  availableDecisions,
  buildEvidenceMarkers,
  decisionReasonError,
  MAX_CORRECTION_COMMENT_LENGTH,
  correctionSelectionErrors,
  evidenceState,
  finalReportGroupRows,
  staffCorrectableFields,
  historyEntries,
  isFinalReportGroupLead,
  photoCoordinates,
  submissionWorkflowStatus,
  waitingMessage,
} from "../utils/plantingReviewWorkflow";

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
  FiInfo,
  FiMapPin,
  FiNavigation,
  FiPlus,
  FiRefreshCw,
  FiRotateCcw,
  FiSearch,
  FiSend,
  FiTrash2,
  FiX,
  FiXCircle,
} from "react-icons/fi";

import { useAuth } from "../context/AuthContext";
import ProtectedEvidenceImage from "../components/ProtectedEvidenceImage";
import { auth } from "../firebase/config";
import { formatDisplayId } from "../utils/displayId";
import { BULAN_BARANGAYS, USER_TYPES } from "../utils/userTypes";
import {
  formatTimestampDate,
  normalizeTimestamp,
  timestampToDateInput,
} from "../utils/timestampValues";
import "../styles/planting-reports.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const MAX_EVIDENCE_PHOTOS = 10;
const PLANTING_SUBMISSION_TIMEOUT_MS = 60_000;
const OUTSIDE_SITE_WARNING =
  "The photo location is outside the selected planting site's coverage area. This report may still be submitted for MENRO Staff verification.";
const SITE_MATCH_MESSAGE =
  "Photo location successfully verified within the selected planting site.";
const OUTSIDE_BULAN_MESSAGE =
  "Your photo is outside the Municipality of Bulan coverage area. Please upload or take a photo within the covered area.";
const MISSING_EXIF_MESSAGE =
  "This photo does not contain GPS location metadata. Please upload an original geotagged photo with location information.";
const UNREADABLE_METADATA_MESSAGE =
  "The photo's location metadata could not be read. Please use the original geotagged photo and try again.";
const UNSUPPORTED_PHOTO_MESSAGE =
  "This photo format is not supported. Please upload a JPG, PNG, or WEBP image.";
const UNREADABLE_PHOTO_MESSAGE =
  "This photo could not be processed. Please upload a valid JPG, PNG, or WEBP image.";
const NO_DISTRIBUTION_MESSAGE =
  "No released seedling distributions are available for this planting event.";
const PHOTO_EXIF_LOCATION_SOURCE = "Photo Metadata";
const BARANGAY_GEOJSON_URL = `${API_BASE_URL}/sites/barangay-boundaries`;
const BULAN_FALLBACK_CENTER = { lat: 12.6598, lng: 123.918 };

function optionalFiniteNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const VERIFICATION_CLASSES = {
  Pending: "pr-status-reviewed",
  "Pending Review": "pr-status-pending",
  Approved: "pr-status-approved",
  Rejected: "pr-status-rejected",
  Invalid: "pr-status-rejected",
  "Awaiting Submission": "pr-status-reviewed",
  Submitted: "pr-status-approved",
  "Not Submitted": "pr-status-reviewed",
  "Awaiting Remaining Report": "pr-status-default",
  Partial: "pr-status-reviewed",
  "Fully Reported — Awaiting Review": "pr-status-reviewed",
  Completed: "pr-status-approved",
  Verified: "pr-status-approved",
  "Needs Review": "pr-status-reviewed",
  Accepted: "pr-status-approved",
};

function displayReportStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  const canonical = [
    "awaiting submission",
    "partial",
    "fully reported — awaiting review",
    "completed",
    "verified",
    "needs review",
    "invalid",
    "not required",
    "pending review",
    "accepted",
    "rejected",
  ];
  if (canonical.includes(normalized)) {
    return {
      "awaiting submission": "Awaiting Submission",
      "partial": "Partial",
      "fully reported — awaiting review": "Fully Reported — Awaiting Review",
      "completed": "Completed",
      "verified": "Verified",
      "needs review": "Needs Review",
      "invalid": "Invalid",
      "not required": "Not Required",
      "pending review": "Pending Review",
      "accepted": "Accepted",
      "rejected": "Rejected",
    }[normalized];
  }
  if (["draft", "pending"].includes(normalized)) return "Awaiting Submission";
  if (["flagged", "reviewed", "passed automated check"].includes(normalized)) return "Needs Review";
  if (normalized === "approved") return "Verified";
  return status || "Pending";
}

function formatDate(value) {
  return formatTimestampDate(value);
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

function formatParticipantCount(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "Not Yet Identified";
}

class PlantingReportFormErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Do not serialize report, site, or evidence data into diagnostics.
    console.error("Planting report form render failure", error?.name || "UnknownError");
  }

  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="pr-overlay" role="presentation">
          <div className="pr-modal" role="alertdialog" aria-modal="true" aria-labelledby="planting-report-recovery-title">
            <div className="pr-modal-header">
              <div>
                <h2 id="planting-report-recovery-title" className="pr-modal-title">Unable to display this planting report form</h2>
                <p className="pr-modal-subtitle">Your report has not been submitted. Correct the unavailable data, then retry without losing this report draft.</p>
              </div>
            </div>
            <div className="pr-modal-footer">
              <button type="button" className="pr-primary-button" onClick={this.props.onRecover}>Retry Form</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function getParticipantTypeLabel(value) {
  return value || "—";
}

function getEventDateValue(event) {
  const value = event?.date || event?.eventDate || event?.startDate || "";
  return timestampToDateInput(value);
}

function getEventStartTime(event) {
  const date = getEventDateValue(event);
  if (!date) return null;
  const startTime = /^\d{2}:\d{2}/.test(String(event?.startTime || ""))
    ? String(event.startTime).slice(0, 5)
    : "00:00";
  const value = new Date(`${date}T${startTime}:00+08:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function getReportEventStatus(event, now = new Date()) {
  const recordStatus = String(event?.recordStatus || "").trim().toLowerCase();
  if (recordStatus === "completed") return "Completed";
  const startsAt = getEventStartTime(event);
  const date = getEventDateValue(event);
  const endTime = /^\d{2}:\d{2}/.test(String(event?.endTime || ""))
    ? new Date(`${date}T${String(event.endTime).slice(0, 5)}:00+08:00`)
    : null;
  if (startsAt && startsAt <= now && (!endTime || now <= endTime)) return "Ongoing";
  return startsAt && startsAt <= now ? "Completed" : "Upcoming";
}

function normalizeBarangayName(value) {
  return String(value || "")
    .trim()
    .replace(/Ã±/gi, "n")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^barangay\s+/i, "")
    .replace(/([a-z])\.\s+/gi, "$1.")
    .toLowerCase();
}

function getDistributionReference(distribution) {
  return distribution?.requestNumber || distribution?.distributionNumber || "Released distribution";
}

function getPhotoSignature(file) {
  return `${file?.name || "photo"}|${file?.size || 0}|${file?.lastModified || 0}`;
}

// Bounded so a photo that never finishes decoding cannot leave "Verifying..." stuck.
const PHOTO_CHECK_TIMEOUT_MS = 20_000;
function canRenderImage(previewUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(false), PHOTO_CHECK_TIMEOUT_MS);
    image.onload = () => { window.clearTimeout(timer); resolve(image.naturalWidth > 0 && image.naturalHeight > 0); };
    image.onerror = () => { window.clearTimeout(timer); resolve(false); };
    image.src = previewUrl;
  });
}

export default function PlantingPage() {
  const { userRole, currentUser } = useAuth();
  const [pageSearchParams] = useSearchParams();

  const [attendanceFile, setAttendanceFile] = useState(null);
  const [savedParticipantReport, setSavedParticipantReport] = useState(null);
  const [showCohorts, setShowCohorts] = useState(false);
  const isParticipant = userRole === "participant";
  const canReview = ["staff", "admin"].includes(userRole);

  const uploadInputRef = useRef(null);
  const previewUrlsRef = useRef([]);
  const activePhotoPreviewIdsRef = useRef(new Set());
  const photoPreviewSequenceRef = useRef(0);
  const locationMapContainerRef = useRef(null);
  const locationMapRef = useRef(null);
  const locationBarangayLayerRef = useRef(null);
  const locationSiteLayerRef = useRef(null);
  const locationCapturedLayerRef = useRef(null);
  const openedReportFromSearchRef = useRef("");
  const eventsRequestSequenceRef = useRef(0);
  const noEventsAlertTimerRef = useRef(null);
  const evidenceAttempt = useRef(createEvidenceAttempt());
  const evidenceContext = useRef(0);
  const [cameraEpoch, setCameraEpoch] = useState(0);

  const [records, setRecords] = useState([]);
  const [sites, setSites] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [events, setEvents] = useState([]);
  const [bulanGeoJson, setBulanGeoJson] = useState(null);

  const [loading, setLoading] = useState(true);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [eventsLoadStatus, setEventsLoadStatus] = useState("idle");
  const [submitting, setSubmitting] = useState(false);
  // { eventId, knownSubmissionIds, contributorId } after a submission timed out
  // once it was sent. The form stays locked until MENRO confirms the outcome.
  const [unconfirmedSubmission, setUnconfirmedSubmission] = useState(null);
  // A Staff official report whose save timed out; survives closing the form.
  // undefined until changed in this page: then the tab's stored value is used.
  const [pendingOfficialSubmission, setPendingOfficialSubmission] = useState(undefined);
  const pendingRestoreCheckedRef = useRef(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [officialForm, setOfficialForm] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [popup, setPopup] = useState({ message: "", type: "success" });
  const [locationLoading, setLocationLoading] = useState(false);
  const [verificationRemarks, setVerificationRemarks] = useState("");
  const [decision, setDecision] = useState("");
  const [decisionFieldError, setDecisionFieldError] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const decisionInFlightRef = useRef(false);
  const decisionReasonRef = useRef(null);
  const [verificationLogs, setVerificationLogs] = useState({ reportId: "", status: "idle", entries: [] });
  const [correctionTarget, setCorrectionTarget] = useState(null);
  // Field-specific return: { [fieldPath]: comment } chosen by Admin, plus their errors.
  const [correctionSelections, setCorrectionSelections] = useState({});
  const [correctionErrors, setCorrectionErrors] = useState({});
  // Final leftovers (and reasons) per released type, kept for one distribution:
  // { distributionId, entries: { [inventoryId]: { leftoverQuantity, leftoverReason } } }.
  const [finalEntries, setFinalEntries] = useState({ distributionId: "", entries: {} });
  const [historyVersion, setHistoryVersion] = useState(0);
  const toast = useToast();
  const submitModalOpenRef = useRef(false);
  const submitAlertRef = useRef(null), revealSubmitAlertRef = useRef(false);
  const [reportError, setReportError] = useState("");
  const [noEventsAlertSiteId, setNoEventsAlertSiteId] = useState("");

  const [photoFiles, setPhotoFiles] = useState([]);
  const [evidenceDescriptors, setEvidenceDescriptors] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedLocationPreviewId, setSelectedLocationPreviewId] = useState("");
  const [showPhotoRequirements, setShowPhotoRequirements] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [cameraLocationDiagnostic, setCameraLocationDiagnostic] = useState(null);
  const [locationPhotoSignature, setLocationPhotoSignature] = useState("");
  const [formRenderRecovery, setFormRenderRecovery] = useState(0);

  const [formErrors, setFormErrors] = useState({});
  const reportFormRef = useRef(null);
  const fieldAccessibility = key => ({ id: `planting-${key}`, "aria-invalid": formErrors[key] ? "true" : undefined,
    "aria-describedby": formErrors[key] ? `planting-error-${key}` : undefined });
  const [form, setForm] = useState({
    submittedByName: "",
    submittedBySector: "",
    submittedByContactNumber: "",
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
    leftoverQuantity: "0",
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

  // The submit form keeps its inline alert slot; every other page message uses
  // the shared MENRO toast, which anchors inside an open drawer or modal.
  // In the submit form, errors and warnings are scrolled into view so a
  // refusal is never shown only above the visible part of a long form.
  function showPopup(message, type = "success", { reveal = type === "error" || type === "warning" } = {}) {
    const text = String(message || "").trim();
    if (!text) return;
    if (submitModalOpenRef.current) {
      revealSubmitAlertRef.current = reveal;
      setPopup({ message: text, type });
      return;
    }
    toast.showToast(text, { type: ["success", "error", "warning", "info"].includes(type) ? type : "info" });
  }

  function clearNoEventsAlert() {
    if (noEventsAlertTimerRef.current) {
      window.clearTimeout(noEventsAlertTimerRef.current);
      noEventsAlertTimerRef.current = null;
    }
    setNoEventsAlertSiteId("");
  }

  // Bounded: restoring the session or refreshing the token can stall offline.
  function getAuthToken(forceRefresh = false) {
    return withDeadline(readAuthToken(forceRefresh), AUTH_TIMEOUT_MS, () => new RequestTimeoutError(AUTH_TIMEOUT_MESSAGE));
  }

  async function readAuthToken(forceRefresh) {
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

    const { timeoutMs: requestedTimeout, ...requestOptions } = options;
    // Every request is bounded; uploads get longer than list reads.
    const write = isWriteMethod(requestOptions.method);
    const timeoutMs = requestedTimeout ?? (!write ? READ_TIMEOUT_MS : requestOptions.body instanceof FormData ? UPLOAD_TIMEOUT_MS : WRITE_TIMEOUT_MS);
    const timeoutController = Number.isFinite(timeoutMs) && timeoutMs > 0 && !requestOptions.signal ? new AbortController() : null;
    const timeoutId = timeoutController ? window.setTimeout(() => timeoutController.abort(), timeoutMs) : null;
    let response;
    try { response = await fetch(`${API_BASE_URL}${path}`, { ...requestOptions, signal: requestOptions.signal || timeoutController?.signal, headers: buildHeaders(token) });

    // If Firebase restored an old cached token, force one
    // refresh and retry the request exactly once.
    if (response.status === 401 && allowRetry) {
      const refreshedToken = await getAuthToken(true);

      if (!refreshedToken) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      response = await fetch(`${API_BASE_URL}${path}`, {
        ...requestOptions,
        signal: requestOptions.signal || timeoutController?.signal,
        headers: buildHeaders(refreshedToken),
      });
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    // A hosting gateway (not MENRO) gave up on a write: the outcome is unknown.
    if (isGatewayWriteFailure(requestOptions.method, response.status, payload)) throw new RequestTimeoutError(AMBIGUOUS_WRITE_MESSAGE, { ambiguous: true });
    assertEvidenceComplete(response, payload, options.headers);
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const requestError = new Error(serverFailureMessage(response.status, payload, response.status >= 500 && !payload.message ? "MENRO is temporarily unavailable. Please try again in a moment." : payload.message || "The request could not be completed."));
      requestError.code = payload.code || "";
      requestError.status = response.status;
      requestError.fieldErrors = payload.fieldErrors;
      throw requestError;
    }

    // A 2xx with success:false (e.g. 202 "evidence processing in progress")
    // means nothing was saved yet; never report it as a successful submission.
    if (payload?.success === false) {
      const pendingError = new Error(payload.message || "The request was not completed. Please try again.");
      pendingError.code = payload.code || "";
      pendingError.status = response.status;
      throw pendingError;
    }

    return payload;
    } catch (error) {
      // A write that timed out or lost its connection after sending has an
      // unknown outcome; callers reconcile it before sending anything again.
      if (timeoutController?.signal.aborted) throw new RequestTimeoutError(write ? AMBIGUOUS_WRITE_MESSAGE : READ_TIMEOUT_MESSAGE, { ambiguous: write, cause: error });
      if (error instanceof TypeError) throw write ? new RequestTimeoutError(AMBIGUOUS_WRITE_MESSAGE, { ambiguous: true, cause: error }) : new Error("The MENRO server could not be reached. Check your connection and try again.", { cause: error });
      throw error;
    } finally { if (timeoutId !== null) window.clearTimeout(timeoutId); }
  }

  function isSessionError(error) {
    return (
      error?.message ===
      "Your session has expired. Please sign in again."
    );
  }

  // background: refresh after a confirmed save. A failure keeps the current
  // list and reports false instead of replacing the page with an error.
  async function loadReports({ background = false } = {}) {
    if (!background) { setLoading(true); setReportError(""); }

    try {
      const endpoint = isParticipant
        ? "/planting-reports/my-reports"
        : "/planting-reports";

      const response = await apiRequest(endpoint);
      const rows = Array.isArray(response.data) ? response.data : [];
      setRecords(rows);
      return rows;
    } catch (error) {
      if (background) return null;
      setRecords([]);
      setReportError(isSessionError(error)
        ? error.message
        : "Unable to load planting reports. Please try again.");
      return null;
    } finally {
      if (!background) setLoading(false);
    }
  }

  // Refreshes the lists after a confirmed save without hiding its success.
  async function refreshAfterSave(successMessage) {
    showPopup(successMessage);
    const results = await Promise.all([loadReports({ background: true }), loadMyDistributions({ quiet: true }), loadEvents({ quiet: true })]);
    if (results.some(result => result === null || result === false)) {
      showPopup(`${successMessage} The latest lists could not be refreshed; refresh this page when your connection is available.`, "warning");
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

  async function loadEvents({ quiet = false } = {}) {
    const requestSequence = ++eventsRequestSequenceRef.current;
    if (!quiet) setEventsLoadStatus("loading");

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
      return true;
    } catch (error) {
      if (requestSequence !== eventsRequestSequenceRef.current) return;
      if (quiet) return false;
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

  async function loadMyDistributions({ quiet = false } = {}) {
    if (!isParticipant) return true;

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
      return true;
    } catch (error) {
      if (quiet) return false;
      setDistributions([]);

      if (!isSessionError(error)) {
        showPopup(
          "Unable to load released seedling distributions. Please try again.",
          "error"
        );
      }
    }
  }

  async function refreshReferenceData() {
    setReferenceLoading(true);

    try {
      await Promise.all([
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

  const primaryLocationPreview = selectedLocationPreviewId === "camera-diagnostic"
    ? cameraLocationDiagnostic
    : photoPreviews.find((preview) => preview.id === selectedLocationPreviewId) ||
      cameraLocationDiagnostic || photoPreviews[0];
  const evidenceMapLatitude = Number(primaryLocationPreview?.latitude);
  const evidenceMapLongitude = Number(primaryLocationPreview?.longitude);
  const evidenceMapAccuracy = optionalFiniteNumber(primaryLocationPreview?.accuracy);
  const evidenceMapHasGps = Number.isFinite(evidenceMapLatitude) &&
    evidenceMapLatitude >= -90 && evidenceMapLatitude <= 90 &&
    Number.isFinite(evidenceMapLongitude) &&
    evidenceMapLongitude >= -180 && evidenceMapLongitude <= 180;

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
    const contributionId = pageSearchParams.get("contribution") || "";
    const deepLinkKey = `${reportId}:${contributionId}`;
    if (!reportId || loading || openedReportFromSearchRef.current === deepLinkKey) return;
    const record = records.find((item) => String(item.id || item.reportId || "") === reportId);
    if (!record) return;
    const openTimer = window.setTimeout(() => {
      openedReportFromSearchRef.current = deepLinkKey;
      setSelectedRecord(record);
      setSelectedSubmission(
        contributionId
          ? (record.submissions || []).find((item) => String(item.id || "") === contributionId) || null
          : null,
      );
      setVerificationRemarks("");
      setShowViewModal(true);
    }, 0);
    return () => window.clearTimeout(openTimer);
  }, [loading, pageSearchParams, records]);

  // showPopup reads this to keep submit-form messages in the form's alert slot.
  useEffect(() => {
    submitModalOpenRef.current = showSubmitModal;
  }, [showSubmitModal]);

  // Bring a new submit-form error or warning into view (see showPopup).
  useEffect(() => {
    if (!popup.message || !revealSubmitAlertRef.current || !submitModalOpenRef.current) return;
    revealSubmitAlertRef.current = false;
    submitAlertRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [popup]);

  useEffect(() => {
    if (!decision) return undefined;
    const timer = window.setTimeout(() => decisionReasonRef.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(timer);
  }, [decision]);

  // Staff and Admin see the authoritative per-submission decision history.
  const historyReportId = showViewModal && canReview ? selectedRecord?.id || "" : "";
  useEffect(() => {
    if (!historyReportId) return undefined;
    let active = true;
    apiRequest(`/planting-reports/${encodeURIComponent(historyReportId)}/verification-logs`)
      .then((response) => { if (active) setVerificationLogs({ reportId: historyReportId, status: "ready", entries: historyEntries(response.data) }); })
      .catch(() => { if (active) setVerificationLogs({ reportId: historyReportId, status: "error", entries: [] }); });
    return () => { active = false; };
  }, [historyReportId, historyVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a reload, a submission left unconfirmed in this tab is checked once
  // against the freshly loaded list: either it was saved, or it was not and
  // can be submitted again. Nothing is resent automatically.
  useEffect(() => {
    if (!isParticipant || loading || reportError || pendingRestoreCheckedRef.current || unconfirmedSubmission) return;
    pendingRestoreCheckedRef.current = true;
    const uid = auth.currentUser?.uid;
    const stored = loadPendingSubmission("participant", uid);
    if (!stored?.eventId) return;
    clearPendingSubmission("participant", uid);
    const saved = findReconciledSubmission(records, stored);
    showPopup(saved
      ? "Your earlier planting report was saved and is awaiting MENRO Staff verification. Do not submit it again."
      : "Your earlier planting report submission was not saved by MENRO. You can submit it again.", saved ? "success" : "warning");
  }, [isParticipant, loading, reportError, records, unconfirmedSubmission]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!popup.message) return undefined;

    const timeout = window.setTimeout(() => {
      setPopup({ message: "", type: "success" });
    }, popup.type === "success" ? 8000 : 5000);

    return () => window.clearTimeout(timeout);
  }, [popup]);

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
          center: [BULAN_FALLBACK_CENTER.lat, BULAN_FALLBACK_CENTER.lng],
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
          throw new Error(`Unable to load Bulan GeoJSON (${response.status}).`);
        }

        const geoJson = await response.json();
        if (cancelled) return;

        if (
          geoJson?.type !== "FeatureCollection" ||
          !Array.isArray(geoJson.features)
        ) {
          throw new Error("Invalid Bulan barangay GeoJSON.");
        }

        setBulanGeoJson(geoJson);

        const barangayLayer = L.geoJSON(geoJson, {
          ...boundaryLayerOptions(map),
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
          showPopup("Unable to load the Bulan map preview. Check the boundary file and map connection.", "error");
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
      const coverageRadiusMeters = Number(selectedSite.coverageRadiusMeters);
      const hasCoverageRadius =
        Number.isFinite(coverageRadiusMeters) && coverageRadiusMeters > 0;

      const polygonPath = Array.isArray(selectedSite.polygon)
        ? selectedSite.polygon
            .filter(
              (point) =>
                Number.isFinite(Number(point?.lat)) &&
                Number.isFinite(Number(point?.lng))
            )
            .map((point) => [Number(point.lat), Number(point.lng)])
        : [];

      if (
        hasCoverageRadius &&
        Number.isFinite(siteLatitude) &&
        Number.isFinite(siteLongitude)
      ) {
        const coverageCircle = L.circle([siteLatitude, siteLongitude], {
          radius: coverageRadiusMeters,
          color: "#17643a",
          weight: 2,
          opacity: 1,
          fillColor: "#6fb98a",
          fillOpacity: 0.18,
        })
          .bindTooltip(
            `${getSiteName(selectedSite) || "Registered Planting Site"} • ${coverageRadiusMeters} m coverage`
          )
          .addTo(siteLayer);
        const coverageBounds = coverageCircle.getBounds();
        fitPoints.push(
          [coverageBounds.getSouth(), coverageBounds.getWest()],
          [coverageBounds.getNorth(), coverageBounds.getEast()]
        );
      } else if (polygonPath.length >= 3) {
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

    if (evidenceMapHasGps) {
      const latitude = evidenceMapLatitude;
      const longitude = evidenceMapLongitude;
      const accuracy = evidenceMapAccuracy;

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        L.circleMarker([latitude, longitude], {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: "#2563eb",
          fillOpacity: 1,
        })
          .bindTooltip("Detected Evidence Location", {
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
  }, [selectedSite, evidenceMapHasGps, evidenceMapLatitude,
    evidenceMapLongitude, evidenceMapAccuracy]);

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

    const isUnavailable = [calendarStatus, recordStatus].some((status) =>
      ["cancelled", "canceled", "rejected", "deleted", "archived"].includes(status));
    const startsAt = getEventStartTime(event);

    return (
      eventSiteId === selectedSiteId &&
      validRecordStatus &&
      !isUnavailable &&
      startsAt && startsAt <= new Date() &&
      true
    );
  }).sort((left, right) => {
    const statusRank = { Ongoing: 0, Completed: 1 };
    const rankDifference = (statusRank[getReportEventStatus(left)] ?? 2) -
      (statusRank[getReportEventStatus(right)] ?? 2);
    if (rankDifference !== 0) return rankDifference;
    return (getEventStartTime(right)?.getTime() || 0) -
      (getEventStartTime(left)?.getTime() || 0);
  });
}, [
  events,
  form.siteId,
]);

  useEffect(() => {
    const selectedSiteId = String(form.siteId || "");
    const selectedSiteMatchesBarangay = Boolean(
      form.barangay &&
      selectedSite &&
      normalizeBarangayName(getSiteBarangay(selectedSite)) ===
        normalizeBarangayName(form.barangay)
    );
    const shouldShow = Boolean(
      showSubmitModal &&
      selectedSiteId &&
      selectedSiteMatchesBarangay &&
      !referenceLoading &&
      eventsLoadStatus === "success" &&
      filteredEvents.length === 0
    );

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
  }, [showSubmitModal, form.barangay, form.siteId, selectedSite,
    referenceLoading, eventsLoadStatus, filteredEvents.length]);

  const visibleRecords = useMemo(() => {
    // The participant endpoint already scopes records to the authenticated user.
    // A legacy report replaced by its corrected resubmission stays stored but is
    // shown only through its correction.
    return currentReports(records);
  }, [records]);

  const eligibleDistributions = useMemo(() => {
    if (!form.siteId || !form.eventId) return [];
    const selectedEvent = events.find((event) =>
      String(getEventId(event)) === String(form.eventId));
    const selectedEventRequestId = String(selectedEvent?.sourceRequestId || "").trim();
    return availableDistributions
      .filter((distribution) =>
        (!distribution.plantingSiteId ||
          String(distribution.plantingSiteId) === String(form.siteId)) &&
        (String(distribution.eventId || "") === String(form.eventId) ||
          (selectedEventRequestId &&
            String(distribution.requestId || "") === selectedEventRequestId)));
  }, [availableDistributions, events, form.siteId, form.eventId]);

  const eligibleDistributionItems = useMemo(() => {
    const distribution = eligibleDistributions.find((entry) =>
      String(entry.id) === String(form.distributionId));
    if (!distribution) return [];
    const selectedEvent = events.find((event) =>
      String(getEventId(event)) === String(form.eventId));
    const recorded = selectedEvent?.recordedSeedlingsByInventory || {};
    const pendingReservations = selectedEvent?.pendingSeedlingsByInventory || {};
    const items = Array.isArray(distribution.items) && distribution.items.length > 0
      ? distribution.items
      : [{
          inventoryId: distribution.inventoryId || "",
          species: distribution.species || "Seedling",
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
        remainingQuantity: Math.max(0, releasedQuantity - Number(recorded[item.inventoryId] || 0) -
          Number(pendingReservations[item.inventoryId] || 0) - Number(selectedEvent?.leftoverSeedlingsByInventory?.[item.inventoryId] || 0)),
      };
    });
  }, [eligibleDistributions, events, form.distributionId, form.eventId]);

  // One final report: every released type with a remaining balance.
  // Entries typed for another release never carry over.
  const finalRows = useMemo(() => finalReportRows(eligibleDistributionItems,
    finalEntries.distributionId === String(form.distributionId || "") ? finalEntries.entries : {}),
  [eligibleDistributionItems, finalEntries, form.distributionId]);

  function updateFinalEntry(inventoryId, field, value) {
    const distributionId = String(form.distributionId || "");
    setFinalEntries((current) => {
      const entries = current.distributionId === distributionId ? current.entries : {};
      return { distributionId, entries: { ...entries, [inventoryId]: { ...(entries[inventoryId] || {}), [field]: value } } };
    });
    setFormErrors((current) => ({ ...current, [`${field}-${inventoryId}`]: "", finalItems: "" }));
  }

  const responsibleDistribution = useMemo(() =>
    eligibleDistributions.find((entry) => String(entry.id) === String(form.distributionId)) || null,
  [eligibleDistributions, form.distributionId]);

  const responsibleEvent = useMemo(() =>
    events.find((entry) => String(getEventId(entry)) === String(form.eventId)) || null,
  [events, form.eventId]);

  const filteredRecords = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return visibleRecords.filter((record) => {
      const matchesStatus = reportMatchesStatusFilter(record, statusFilter);

      const searchableText = [
        record.id,
        record.participantName,
        record.siteName,
        record.barangay,
        record.species,
        ...reportSeedlingItems(record).map((item) => item.species),
        record.eventName,
        record.verificationStatus,
        record.reportingProgress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (search.length === 0 || searchableText.includes(search));
    });
  }, [visibleRecords, searchTerm, statusFilter]);

  // Counts use the same submission/review status helpers as the table rows.
  const summary = useMemo(() => reportKpiCounts(visibleRecords), [visibleRecords]);

  const capturedSiteDistance = useMemo(() => {
    if (!evidenceMapHasGps || !selectedSite) return null;

    const siteLatitude = Number(selectedSite.latitude);
    const siteLongitude = Number(selectedSite.longitude);
    const capturedLatitude = evidenceMapLatitude;
    const capturedLongitude = evidenceMapLongitude;

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
  }, [evidenceMapHasGps, evidenceMapLatitude, evidenceMapLongitude, selectedSite]);

  const siteCoverageRadiusMeters = useMemo(() => {
    const radius = Number(selectedSite?.coverageRadiusMeters);
    return Number.isFinite(radius) && radius > 0 ? radius : null;
  }, [selectedSite]);

  const capturedInsideSitePolygon = useMemo(() => {
    if (
      !evidenceMapHasGps ||
      siteCoverageRadiusMeters !== null ||
      !Array.isArray(selectedSite?.polygon) ||
      selectedSite.polygon.length < 3
    ) return null;
    return isPointInPolygon(
      evidenceMapLatitude,
      evidenceMapLongitude,
      selectedSite.polygon
    );
  }, [evidenceMapHasGps, evidenceMapLatitude, evidenceMapLongitude,
    selectedSite, siteCoverageRadiusMeters]);

  const municipalityScopeStatus = useMemo(() => {
    if (!evidenceMapHasGps) return "unverified";
    if (!bulanGeoJson) return "checking";
    return isPointInBulanBoundary(
      evidenceMapLatitude,
      evidenceMapLongitude,
      bulanGeoJson
    ) ? "inside" : "outside";
  }, [evidenceMapHasGps, evidenceMapLatitude, evidenceMapLongitude, bulanGeoJson]);

  const activeSiteRadiusMeters =
    siteCoverageRadiusMeters ?? SITE_GPS_TOLERANCE_METERS;

  const isInsideSelectedSite = evidenceMapHasGps && (
    siteCoverageRadiusMeters !== null
      ? capturedSiteDistance !== null &&
        capturedSiteDistance <= siteCoverageRadiusMeters
      : capturedInsideSitePolygon === true ||
        (capturedInsideSitePolygon === null && capturedSiteDistance !== null &&
          capturedSiteDistance <= SITE_GPS_TOLERANCE_METERS)
  );

  const locationPreviewStatus = useMemo(() => buildLocationPreviewStatus({
    hasSite: Boolean(form.siteId),
    hasGps: evidenceMapHasGps,
    waitingLabel: primaryLocationPreview?.verificationLabel || (photoFiles.length === 0
      ? "Upload or take a photo first."
      : "Photo GPS metadata is unavailable."),
    gpsStatus: primaryLocationPreview?.gpsStatus,
    accuracy: evidenceMapAccuracy,
    municipalityStatus: municipalityScopeStatus,
    distanceMeters: capturedSiteDistance,
    radiusMeters: siteCoverageRadiusMeters,
    insidePolygon: capturedInsideSitePolygon,
  }), [form.siteId, evidenceMapHasGps, evidenceMapAccuracy, municipalityScopeStatus,
    capturedSiteDistance, capturedInsideSitePolygon, siteCoverageRadiusMeters,
    photoFiles.length, primaryLocationPreview]);

  const isOutsideAssignedSite = evidenceMapHasGps && (
    siteCoverageRadiusMeters !== null
      ? capturedSiteDistance !== null &&
        capturedSiteDistance > activeSiteRadiusMeters
      : capturedInsideSitePolygon === false ||
        (capturedInsideSitePolygon === null && capturedSiteDistance !== null &&
          capturedSiteDistance > activeSiteRadiusMeters)
  );

  const verificationMapResult = buildEvidenceLocationView({
    gpsStatus: primaryLocationPreview?.gpsStatus || (evidenceMapHasGps ? "valid" : "missing"),
    latitude: evidenceMapLatitude,
    longitude: evidenceMapLongitude,
    accuracy: evidenceMapAccuracy,
    evidenceSource: primaryLocationPreview?.locationSource === "Browser Capture Session"
      ? "browser-camera" : "original-exif",
    outsideMunicipality: municipalityScopeStatus === "outside",
    outsideSite: isOutsideAssignedSite,
  });

  const locationBlocksSubmission = hasGps && municipalityScopeStatus !== "inside";

  useEffect(() => {
    if (!showSubmitModal || !hasGps || municipalityScopeStatus === "checking" || !selectedSite) {
      return undefined;
    }
    const nextPopup = municipalityScopeStatus === "outside"
      ? { message: OUTSIDE_BULAN_MESSAGE, type: "error" }
      : {
          message: isInsideSelectedSite ? SITE_MATCH_MESSAGE : OUTSIDE_SITE_WARNING,
          type: isInsideSelectedSite ? "success" : "warning",
        };
    const announcementTimer = window.setTimeout(() => setPopup(nextPopup), 0);
    return () => window.clearTimeout(announcementTimer);
  }, [showSubmitModal, hasGps, municipalityScopeStatus, isInsideSelectedSite,
    selectedSite, form.latitude, form.longitude]);

  function resetForm() {
    evidenceContext.current += 1;
    setAttendanceFile(null); setSavedParticipantReport(null);
    setFormErrors({});
    evidenceAttempt.current.reset();
    clearNoEventsAlert();
    stopCamera();
    setForm({
      submittedByName: "",
      submittedBySector: "",
      submittedByContactNumber: "",
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
    leftoverQuantity: "0",
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
    activePhotoPreviewIdsRef.current.clear();
    setPhotoFiles([]);
    setEvidenceDescriptors([]);
    setPhotoPreviews([]);
    setCameraLocationDiagnostic(null);
    setLocationPhotoSignature("");

    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  // Staff: an official report save that timed out is kept outside the form
  // (and in this tab's session) until Check Submission resolves it.
  function updatePendingOfficialSubmission(value) {
    const uid = auth.currentUser?.uid || currentUser?.uid;
    setPendingOfficialSubmission(value || null);
    if (value) savePendingSubmission("staff", uid, value); else clearPendingSubmission("staff", uid);
  }

  // Resolves a timed-out participant submission (saved or not saved).
  function resolveUnconfirmedSubmission() {
    setUnconfirmedSubmission(null);
    clearPendingSubmission("participant", auth.currentUser?.uid);
  }

  async function openSubmitModal(options) {
    // A submission awaiting confirmation is reopened exactly as it was sent,
    // so it can be checked instead of being replaced by a new one.
    if (unconfirmedSubmission) {
      setPopup({ message: "", type: "success" });
      setShowSubmitModal(true);
      return;
    }
    if (options?.correction !== true) setCorrectionTarget(null);
    resetForm();
    setPopup({ message: "", type: "success" });
    setShowSubmitModal(true);
    await refreshReferenceData();
  }

  function closeSubmitModal() {
    if (submitting) return;
    if (unconfirmedSubmission) {
      // Keep the unconfirmed submission (fields, evidence, key) for Check Submission.
      setShowSubmitModal(false);
      setPopup({ message: "", type: "success" });
      return;
    }
    setShowSubmitModal(false);
    setCorrectionTarget(null);
    resetForm();
    setPopup({ message: "", type: "success" });
  }

  function stopCamera() {
    setCameraOpen(false);
    setShowPhotoRequirements(false);
  }

  function startCamera() {
    setShowPhotoRequirements(false);
    if (!form.siteId || !form.eventId || !form.distributionId) {
      showPopup("Select a planting site, event, and released seedling distribution before taking a verified photo.", "error");
      return;
    }
    setCameraLocationDiagnostic(null);
    setCameraEpoch(evidenceContext.current);
    setCameraOpen(true);
  }

  function handleVerifiedCameraCapture({ file, descriptor, location }, capturedEpoch) {
    if (capturedEpoch !== evidenceContext.current) return;
    if (photoFiles.length >= MAX_EVIDENCE_PHOTOS) {
      setCameraOpen(false);
      showPopup("A maximum of 10 planting evidence photos is allowed.", "error");
      return;
    }
    const url = URL.createObjectURL(file);
    const preview = {
      id: `planting-photo-${photoPreviewSequenceRef.current += 1}`,
      url,
      signature: getPhotoSignature(file),
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      distanceMeters: location.distanceMeters,
      boundaryRule: location.boundaryRule,
      boundaryLimitMeters: location.boundaryLimitMeters,
      locationSource: "Browser Capture Session",
      verificationStatus: "verified",
      verificationTone: "success",
      verificationLabel: "Verified Browser Camera Evidence",
      verificationMessage: "The backend verified this capture's image integrity, location, and assigned site.",
      submissionBlocked: false,
      gpsAvailable: true,
      gpsStatus: "valid",
      backendValidated: true,
    };
    previewUrlsRef.current.push(url);
    activePhotoPreviewIdsRef.current.add(preview.id);
    setPhotoFiles(previous => [...previous, file]);
    setPhotoPreviews(previous => [...previous, preview]);
    setSelectedLocationPreviewId(preview.id);
    setEvidenceDescriptors(previous => [...previous, descriptor]);
    setCameraLocationDiagnostic(null);
    if (!hasGps) applyPhotoLocation(file, preview);
    setCameraOpen(false);
    showPopup("Verified camera evidence was attached successfully.", "success");
  }

  function handleCameraDiagnostic({ status, location, message }) {
    setCameraLocationDiagnostic({
      latitude: location?.latitude,
      longitude: location?.longitude,
      accuracy: location?.accuracy,
      locationSource: "Browser Capture Session",
      gpsStatus: status,
      verificationStatus: "failed",
      verificationTone: "error",
      verificationLabel: status === "low_accuracy" ? "Low GPS Accuracy" : "Camera Location Rejected",
      verificationMessage: message,
      submissionBlocked: true,
      backendValidated: false,
    });
    setSelectedLocationPreviewId("camera-diagnostic");
  }

  const cameraBinding = useMemo(() => ({
    workflow: "planting-report",
    siteId: form.siteId,
    eventId: form.eventId,
    distributionId: form.distributionId,
  }), [form.siteId, form.eventId, form.distributionId]);

  function invalidateBoundEvidence() {
    evidenceContext.current += 1;
    setCameraOpen(false);
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
    activePhotoPreviewIdsRef.current.clear();
    setPhotoFiles([]); setPhotoPreviews([]); setEvidenceDescriptors([]);
    setCameraLocationDiagnostic(null); setLocationPhotoSignature(""); setSelectedLocationPreviewId("");
    setForm(previous => ({ ...previous, latitude: "", longitude: "", accuracy: "", locationSource: "", photoCapturedAt: "", locationCapturedAt: "" }));
    setFormErrors(previous => ({ ...previous, photos: "" }));
    evidenceAttempt.current.reset();
  }

  function updateFormField(field, value) {
    if (field === "barangay") invalidateBoundEvidence();
    setFormErrors(previous => ({ ...previous, [field]: "" }));
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
    invalidateBoundEvidence();
    setFormErrors(previous => ({ ...previous, distributionId: "", distributionItemKey: "" }));
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
    leftoverQuantity: "0",
      }));
      return;
    }

    const items = Array.isArray(distribution.items) && distribution.items.length > 0
      ? distribution.items
      : [{
          inventoryId: distribution.inventoryId || "",
          species: distribution.species || "Seedling",
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
      ? Math.max(0, releasedQuantity - Number(selectedEvent?.recordedSeedlingsByInventory?.[item.inventoryId] || 0) -
        Number(selectedEvent?.pendingSeedlingsByInventory?.[item.inventoryId] || 0) - Number(selectedEvent?.leftoverSeedlingsByInventory?.[item.inventoryId] || 0))
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
    leftoverQuantity: "0",
    }));
  }

  function handleSiteChange(event) {
    invalidateBoundEvidence();
    setFormErrors(previous => ({ ...previous, siteId: "", eventId: "", plantingDate: "", distributionId: "", distributionItemKey: "", quantity: "" }));
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
    leftoverQuantity: "0",
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
    leftoverQuantity: "0",
    }));
  }

  function handleEventChange(event) {
    invalidateBoundEvidence();
    setFormErrors(previous => ({ ...previous, eventId: "", plantingDate: "", distributionId: "", distributionItemKey: "", quantity: "" }));
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
    leftoverQuantity: "0",
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
    leftoverQuantity: "0",
    }));
  }

  function updatePhotoPreview(previewId, changes) {
    setPhotoPreviews((previous) => previous.map((preview) =>
      preview.id === previewId ? { ...preview, ...changes } : preview
    ));
  }

  function evaluatePhotoCoordinates(latitude, longitude) {
    if (bulanGeoJson && !isPointInBulanBoundary(latitude, longitude, bulanGeoJson)) {
      return {
        verificationStatus: "failed",
        verificationTone: "error",
        verificationLabel: "Verification Failed — Outside Municipality of Bulan",
        verificationMessage: OUTSIDE_BULAN_MESSAGE,
        submissionBlocked: true,
      };
    }

    const siteLatitude = Number(selectedSite?.latitude);
    const siteLongitude = Number(selectedSite?.longitude);
    if (!Number.isFinite(siteLatitude) || !Number.isFinite(siteLongitude)) {
      return {
        verificationStatus: "verified",
        verificationTone: "success",
        verificationLabel: "Verified — GPS metadata detected",
        verificationMessage: "Photo GPS metadata was read successfully.",
        submissionBlocked: false,
      };
    }

    const distanceMeters = calculateDistanceMeters(
      latitude,
      longitude,
      siteLatitude,
      siteLongitude
    );
    const coverageRadius = Number(selectedSite?.coverageRadiusMeters);
    const hasCoverageRadius = Number.isFinite(coverageRadius) && coverageRadius > 0;
    const hasLegacyPolygon = Array.isArray(selectedSite?.polygon) &&
      selectedSite.polygon.length >= 3;
    const siteMatches = hasCoverageRadius
      ? distanceMeters <= coverageRadius
      : hasLegacyPolygon
        ? isPointInPolygon(latitude, longitude, selectedSite.polygon)
        : distanceMeters <= SITE_GPS_TOLERANCE_METERS;

    return siteMatches
      ? {
          verificationStatus: "verified",
          verificationTone: "success",
          verificationLabel: "Verified — Site Match",
          verificationMessage: SITE_MATCH_MESSAGE,
          submissionBlocked: false,
          distanceMeters,
          boundaryRule: hasCoverageRadius ? "configured-radius" : hasLegacyPolygon ? "site-polygon" : "50m-fallback",
          boundaryLimitMeters: hasCoverageRadius ? coverageRadius : hasLegacyPolygon ? null : SITE_GPS_TOLERANCE_METERS,
        }
      : {
          verificationStatus: "needs_review",
          verificationTone: "warning",
          verificationLabel: "Outside Planting Site",
          verificationMessage: OUTSIDE_SITE_WARNING,
          submissionBlocked: false,
          distanceMeters,
          boundaryRule: hasCoverageRadius ? "configured-radius" : hasLegacyPolygon ? "site-polygon" : "50m-fallback",
          boundaryLimitMeters: hasCoverageRadius ? coverageRadius : hasLegacyPolygon ? null : SITE_GPS_TOLERANCE_METERS,
        };
  }

  function applyPhotoLocation(file, location) {
    setForm((previous) => ({
      ...previous,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      accuracy: location.accuracy ?? "",
      locationSource: location.locationSource,
      photoCapturedAt: location.photoCapturedAt || "",
      locationCapturedAt: location.locationCapturedAt || "",
    }));
    setLocationPhotoSignature(getPhotoSignature(file));
  }

  function clearPhotoLocation() {
    setForm((previous) => ({
      ...previous,
      latitude: "",
      longitude: "",
      accuracy: "",
      locationSource: "",
      photoCapturedAt: "",
      locationCapturedAt: "",
    }));
    setLocationPhotoSignature("");
  }

  async function verifyUploadedPhoto(file, preview, options = {}) {
    setSelectedLocationPreviewId(preview.id);
    const applyToForm = options.applyToForm === true;
    // A failed upload must not remove a location another verified photo supplied.
    const clearsFormLocation = applyToForm && (!locationPhotoSignature || locationPhotoSignature === getPhotoSignature(file));
    const announce = options.announce !== false;
    updatePhotoPreview(preview.id, {
      verificationStatus: "verifying",
      verificationTone: "info",
      verificationLabel: "Verifying photo metadata...",
      verificationMessage: "",
    });

    const readable = await canRenderImage(preview.url);
    if (!activePhotoPreviewIdsRef.current.has(preview.id)) return { cancelled: true };
    if (!readable) {
      updatePhotoPreview(preview.id, {
        verificationStatus: "failed",
        verificationTone: "error",
        verificationLabel: "Verification Failed — Unreadable Image",
        verificationMessage: UNREADABLE_PHOTO_MESSAGE,
        submissionBlocked: true,
      });
      if (clearsFormLocation) clearPhotoLocation();
      if (announce) showPopup(UNREADABLE_PHOTO_MESSAGE, "error", { reveal: false });
      return { verified: false, message: UNREADABLE_PHOTO_MESSAGE, tone: "error" };
    }

    let metadata;
    try {
      metadata = await withDeadline(exifr.parse(file, { gps: true, tiff: true, exif: true }), PHOTO_CHECK_TIMEOUT_MS, () => new Error("Photo metadata could not be read in time."));
    } catch {
      if (!activePhotoPreviewIdsRef.current.has(preview.id)) return { cancelled: true };
      updatePhotoPreview(preview.id, {
        verificationStatus: "failed",
        verificationTone: "error",
        verificationLabel: "Verification Failed — Metadata Unreadable",
        verificationMessage: UNREADABLE_METADATA_MESSAGE,
        submissionBlocked: true,
      });
      if (clearsFormLocation) clearPhotoLocation();
      if (announce) showPopup(UNREADABLE_METADATA_MESSAGE, "error", { reveal: false });
      return { verified: false, message: UNREADABLE_METADATA_MESSAGE, tone: "error" };
    }

    if (!activePhotoPreviewIdsRef.current.has(preview.id)) return { cancelled: true };
    const gps = extractGpsCoordinates(metadata || {});
    const latitude = gps.latitude;
    const longitude = gps.longitude;

    if (gps.status !== "valid") {
      const message = gps.status === "missing"
        ? "Your photo does not contain GPS location metadata. Please upload an original geotagged photo."
        : gps.status === "unparseable"
          ? "Your photo contains GPS metadata, but the coordinates could not be read correctly."
          : "Your photo contains invalid GPS coordinates. Please upload an original geotagged photo with valid location information.";
      updatePhotoPreview(preview.id, {
        verificationStatus: "failed",
        verificationTone: "error",
        verificationLabel: gps.status === "missing"
          ? "Verification Failed — No GPS Metadata"
          : gps.status === "unparseable"
            ? "Verification Failed — GPS Metadata Unreadable"
            : "Verification Failed — Invalid GPS Coordinates",
        verificationMessage: message,
        submissionBlocked: true,
        gpsStatus: gps.status,
        locationSource: PHOTO_EXIF_LOCATION_SOURCE,
      });
      if (clearsFormLocation) clearPhotoLocation();
      if (announce) showPopup(message, "error", { reveal: false });
      return { verified: false, message, tone: "error" };
    }

    const capturedAt = metadata?.DateTimeOriginal ?? metadata?.DateTimeDigitized ??
      metadata?.CreateDate ?? metadata?.DateTime;
    const capturedDate = capturedAt ? new Date(capturedAt) : null;
    const capturedAtIso = capturedDate && !Number.isNaN(capturedDate.getTime())
      ? capturedDate.toISOString()
      : "";
    let locationResult = evaluatePhotoCoordinates(latitude, longitude);
    const declaredDate = form.plantingDate ? new Date(`${form.plantingDate}T00:00:00`) : null;
    const captureTimeSuspicious = !capturedDate || !declaredDate ||
      Number.isNaN(declaredDate.getTime()) || capturedDate > new Date() ||
      Math.abs(capturedDate.getTime() - declaredDate.getTime()) > 24 * 60 * 60 * 1000;
    if (!locationResult.submissionBlocked && captureTimeSuspicious) {
      locationResult = {
        ...locationResult,
        verificationStatus: "needs_review",
        verificationTone: "warning",
        verificationLabel: "Needs Review — Timestamp",
        verificationMessage: locationResult.verificationTone === "warning"
          ? `${locationResult.verificationMessage} The photo timestamp also requires MENRO Staff review.`
          : "The photo location is valid, but its capture timestamp requires MENRO Staff review.",
      };
    }
    const location = {
      latitude,
      longitude,
      accuracy: "",
      locationSource: PHOTO_EXIF_LOCATION_SOURCE,
      photoCapturedAt: capturedAtIso,
      locationCapturedAt: capturedAtIso,
    };

    updatePhotoPreview(preview.id, {
      ...locationResult,
      ...location,
      metadata: {
        capturedAt: capturedAtIso,
        gpsAvailable: true,
      },
      gpsStatus: "valid",
      backendValidated: false,
    });
    if (applyToForm) applyPhotoLocation(file, location);
    if (announce) {
      showPopup(
        locationResult.verificationMessage,
        locationResult.verificationTone === "error"
          ? "error"
          : locationResult.verificationTone === "warning"
            ? "warning"
            : "success",
        { reveal: false }
      );
    }
    return {
      verified: ["verified", "needs_review"].includes(locationResult.verificationStatus),
      message: locationResult.verificationMessage,
      tone: locationResult.verificationTone,
    };
  }

  async function processPhotoMetadata(file, preview, announce = true) {
    if (!file || !preview) {
      showPopup("Please upload or take a photo first.", "error");
      return false;
    }

    setLocationLoading(true);
    try {
      const result = await verifyUploadedPhoto(file, preview, {
        applyToForm: true,
        announce,
      });
      return result?.verified === true;
    } finally {
      setLocationLoading(false);
    }
  }

  function verifyPhotoLocation() {
    if (selectedLocationPreviewId === "camera-diagnostic") return;
    const index = Math.max(0, photoPreviews.findIndex((preview) =>
      preview.id === selectedLocationPreviewId));
    const preview = photoPreviews[index];
    if (preview?.locationSource === "Browser Capture Session") {
      setSelectedLocationPreviewId(preview.id);
      return;
    }
    void processPhotoMetadata(photoFiles[index], preview);
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

  async function handlePhotoChange(event) {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;
    setCameraLocationDiagnostic(null);

    const remainingSlots = MAX_EVIDENCE_PHOTOS - photoFiles.length;

    if (remainingSlots <= 0) {
      setFormErrors(current => ({ ...current, photos: "A maximum of 10 planting evidence photos is allowed." }));
      event.target.value = "";
      return;
    }

    if (selectedFiles.length > remainingSlots) {
      setFormErrors(current => ({ ...current, photos: `You can add only ${remainingSlots} more photo${remainingSlots === 1 ? "" : "s"}. Maximum is 10.` }));
      event.target.value = "";
      return;
    }

    for (const file of selectedFiles) {
      if (!isAllowedImageFile(file)) {
        setFormErrors(current => ({ ...current, photos: UNSUPPORTED_PHOTO_MESSAGE }));
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
      photoFiles.map(getPhotoSignature)
    );

    const newSignatures = new Set();

    for (const file of selectedFiles) {
      const signature = getPhotoSignature(file);

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

    const newPreviews = selectedFiles.map((file) => ({
      id: `planting-photo-${photoPreviewSequenceRef.current += 1}`,
      url: URL.createObjectURL(file),
      signature: getPhotoSignature(file),
      locationSource: PHOTO_EXIF_LOCATION_SOURCE,
      verificationStatus: "not_verified",
      verificationTone: "info",
      verificationLabel: "Not Yet Verified",
      verificationMessage: "",
      submissionBlocked: false,
    }));

    previewUrlsRef.current.push(...newPreviews.map((item) => item.url));
    newPreviews.forEach((preview) => activePhotoPreviewIdsRef.current.add(preview.id));

    setPhotoFiles((previous) => [...previous, ...selectedFiles]);
    setEvidenceDescriptors((previous) => [...previous,
      ...selectedFiles.map(() => ({ source: "uploaded-original" }))]);
    setPhotoPreviews((previous) => [...previous, ...newPreviews]);
    setSelectedLocationPreviewId(newPreviews[0]?.id || "");
    // A message about the previous photo set no longer applies; each photo's
    // own verification result is shown inline from here on.
    setFormErrors(current => (current.photos ? { ...current, photos: "" } : current));

    event.target.value = "";

    showPopup(
      `${selectedFiles.length} planting evidence photo${selectedFiles.length === 1 ? "" : "s"} selected. Verification is in progress.`,
      "info"
    );

    const verificationResults = [];
    for (let index = 0; index < selectedFiles.length; index += 1) {
      verificationResults.push(await verifyUploadedPhoto(selectedFiles[index], newPreviews[index], {
        applyToForm: photoFiles.length === 0 && index === 0,
        announce: false,
      }));
    }

    const resultToAnnounce = verificationResults.find(
      (result) => result && !result.cancelled && result.verified !== true
    ) || verificationResults.find((result) => result?.tone === "warning") ||
      verificationResults.find((result) => result && !result.cancelled);
    if (resultToAnnounce) {
      showPopup(
        resultToAnnounce.message,
        resultToAnnounce.tone === "error"
          ? "error"
          : resultToAnnounce.tone === "warning"
            ? "warning"
            : "success",
        // The reason is also shown inline in the photo section the user is in.
        { reveal: false }
      );
    }
  }

  function removeSelectedPhoto(index) {
    const preview = photoPreviews[index];
    const file = photoFiles[index];
    const remainingFiles = photoFiles.filter((_, itemIndex) => itemIndex !== index);
    const remainingPreviews = photoPreviews.filter((_, itemIndex) => itemIndex !== index);
    const removedLocationPhoto = index === 0 ||
      (file && locationPhotoSignature === getPhotoSignature(file));

    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
      previewUrlsRef.current = previewUrlsRef.current.filter(
        (url) => url !== preview.url
      );
    }
    if (preview?.id) activePhotoPreviewIdsRef.current.delete(preview.id);

    setPhotoFiles(remainingFiles);
    setEvidenceDescriptors((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    setPhotoPreviews(remainingPreviews);
    setFormErrors(current => (current.photos ? { ...current, photos: "" } : current));
    if (selectedLocationPreviewId === preview?.id) {
      setSelectedLocationPreviewId(remainingPreviews[0]?.id || "");
    }

    if (removedLocationPhoto) {
      const nextPreview = remainingPreviews[0];
      const nextFile = remainingFiles[0];
      if (
        ["verified", "needs_review"].includes(nextPreview?.verificationStatus) &&
        Number.isFinite(Number(nextPreview.latitude)) &&
        Number.isFinite(Number(nextPreview.longitude))
      ) {
        applyPhotoLocation(nextFile, nextPreview);
      } else {
        clearPhotoLocation();
      }
    }

    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    // A completed report is immutable here. An interrupted optional attachment
    // must never replay the planting quantities or consume a second photo session.
    if (savedParticipantReport) {
      const attendanceError = attendanceFileError(attendanceFile) || formErrors.attendance;
      setFormErrors(attendanceError ? { attendance: attendanceError } : {});
      if (attendanceError) return focusFirstInvalid(() => reportFormRef.current);
      setSubmitting(true);
      try {
        if (attendanceFile) {
          const id = savedParticipantReport.data?.participantSubmissionId;
          if (!id) throw new Error("Private attendance is unavailable for this saved legacy report. Contact MENRO; do not resubmit planting quantities.");
          const data = new FormData(); data.append("attendance", attendanceFile);
          await apiRequest(`/planting-reports/submissions/${encodeURIComponent(id)}/attendance`, { method: "PUT", body: data });
        }
        resetForm();
        void refreshAfterSave("Your planting report is saved pending MENRO verification.");
      } catch (error) {
        const fields = backendFieldErrors(error);
        if (Object.keys(fields).length) { setFormErrors(fields); focusFirstInvalid(() => reportFormRef.current); }
        else showPopup(`Your report is already saved. ${isAmbiguousWriteFailure(error) ? "The attendance upload was not confirmed in time; retry the same attendance file." : error.message || "Retry only the same optional attendance file."}`, "error");
      } finally { setSubmitting(false); }
      return;
    }
    // A timed-out submission is reconciled before anything is sent again: if
    // MENRO saved it, the report is kept; otherwise the same submission (same
    // evidence and Idempotency-Key) is sent once more.
    if (unconfirmedSubmission) {
      setPopup({ message: "", type: "success" });
      setSubmitting(true);
      let rows;
      try { rows = await loadReports({ background: true }); } finally { setSubmitting(false); }
      if (!rows) {
        showPopup("MENRO could not be reached to confirm the earlier submission. Nothing was sent again; select Check Submission to try again.", "error");
        return;
      }
      const match = findReconciledSubmission(rows, unconfirmedSubmission);
      if (match) {
        resolveUnconfirmedSubmission();
        setSavedParticipantReport({ data: { participantSubmissionId: match.id } });
        if (attendanceFile) {
          showPopup("Your planting report was saved. Select Retry Attendance Upload to send the attendance file; do not resubmit the report.", "warning");
          return;
        }
        resetForm(); setCorrectionTarget(null);
        void refreshAfterSave("Your planting report was saved and is awaiting MENRO Staff verification. Status: Pending Review.");
        return;
      }
      resolveUnconfirmedSubmission();
    }
    const errors = validatePlantingReportForm(form, { distributions, photos: photoFiles, previews: photoPreviews, hasGps, municipalityScopeStatus, finalRows });
    const attendanceError = attendanceFileError(attendanceFile) || formErrors.attendance;
    if (attendanceError) errors.attendance = attendanceError;
    setFormErrors(retainInvalidFieldMessages(errors, formErrors));
    if (Object.keys(errors).length) { focusFirstInvalid(() => reportFormRef.current); return; }

    if (!form.submittedByName.trim() || !form.submittedBySector || !form.submittedByContactNumber.trim()) {
      showPopup("Please complete your name, sector, and contact number.", "error");
      return;
    }

    if (!/^(?:\+63|0)9\d{9}$/.test(form.submittedByContactNumber.replace(/[\s-]/g, ""))) {
      showPopup("Please enter a valid Philippine mobile number.", "error");
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

    if (photoFiles.length === 0) {
      showPopup("Please add at least one planting evidence photo before submitting the report.", "error");
      return;
    }

    if (photoFiles.length > MAX_EVIDENCE_PHOTOS) {
      showPopup("A maximum of 10 planting evidence photos is allowed.", "error");
      return;
    }

    const incompleteVerification = photoPreviews.find(
      (preview) => !["verified", "needs_review"].includes(preview.verificationStatus)
    );
    if (incompleteVerification) {
      showPopup(
        incompleteVerification.verificationMessage ||
          "Please verify every selected planting evidence photo before submitting the report.",
        "error"
      );
      return;
    }

    const blockedPhoto = photoPreviews.find((preview) => preview.submissionBlocked === true);
    if (blockedPhoto) {
      showPopup(
        blockedPhoto.verificationMessage ||
          "One or more planting evidence photos failed location verification.",
        "error"
      );
      return;
    }

    if (!hasGps) {
      showPopup(MISSING_EXIF_MESSAGE, "error");
      return;
    }

    if (municipalityScopeStatus === "checking") {
      showPopup("Please wait while the photo location is checked against the Municipality of Bulan boundary.", "error");
      return;
    }

    if (municipalityScopeStatus === "outside") {
      showPopup(OUTSIDE_BULAN_MESSAGE, "error");
      return;
    }

    const payload = new FormData();

    payload.append("distributionId", form.distributionId);
    payload.append("submittedByName", form.submittedByName.trim());
    payload.append("submittedBySector", form.submittedBySector);
    payload.append("submittedByContactNumber", form.submittedByContactNumber.trim());
    payload.append("siteId", form.siteId);
    payload.append("barangay", form.barangay);
    // One final report for every released type: leftovers + reasons per type;
    // the backend computes Final Planted = Remaining - Leftovers.
    payload.append("items", JSON.stringify(finalReportItems(finalRows)));
    payload.append("confirmationMode", "final");
    payload.append("plantingDate", form.plantingDate);
    payload.append("plantingLocation", form.siteName);
    payload.append("eventId", form.eventId || "");
    payload.append("eventName", form.eventName || "");
    payload.append("locationSource", form.locationSource || PHOTO_EXIF_LOCATION_SOURCE);
    payload.append("remarks", form.remarks.trim());

    photoFiles.forEach((file) => {
      payload.append("photos", file);
    });
    payload.append("evidenceManifest", JSON.stringify(evidenceDescriptors));
    const correctionOf = correctionTarget?.id || "";
    if (correctionOf) payload.append("correctionOf", correctionOf);

    setSubmitting(true);
    const knownSubmissionIds = ownSubmissionIdsForEvent(records, form.eventId);

    let savedResponse = null;
    try {
      const response = await apiRequest("/planting-reports", {
        method: "POST",
        body: payload,
        headers: evidenceAttempt.current.headers(),
        timeoutMs: PLANTING_SUBMISSION_TIMEOUT_MS,
      });

      setSavedParticipantReport(response);
      savedResponse = response;
      if (attendanceFile) {
        const id = response.data?.participantSubmissionId;
        if (!id) throw new Error("The report is saved, but private attendance is unavailable for this legacy record. Contact MENRO; do not resubmit the report.");
        const attendance = new FormData(); attendance.append("attendance", attendanceFile);
        await apiRequest(`/planting-reports/submissions/${encodeURIComponent(id)}/attendance`, { method: "PUT", body: attendance });
      }
      resetForm();
      setCorrectionTarget(null);
      void refreshAfterSave(correctionOf
        ? "Corrected Planting Report Resubmitted — MENRO Staff will review your correction. Status: Pending Review."
        : `Planting Report Submitted Successfully — ${response.message ||
          "Your planting report has been submitted and is awaiting MENRO Staff verification."} Status: Pending Review.`);
    } catch (error) {
      if (isAmbiguousWriteFailure(error)) {
        if (!savedResponse) {
          const pending = { eventId: form.eventId, knownSubmissionIds, contributorId: auth.currentUser?.uid || "" };
          setUnconfirmedSubmission(pending);
          savePendingSubmission("participant", pending.contributorId, pending);
          showPopup(error.message, "error");
        } else showPopup("The report is already saved. The attendance upload was not confirmed in time; retry the same attendance file.", "error");
        return;
      }
      // A refusal because this participant already has a report for the event
      // awaiting review (for example one saved by an earlier, unconfirmed
      // attempt) is reported as that, not as a changed balance.
      if (!savedResponse && error?.status === 409) {
        const rows = await loadReports({ background: true });
        if (rows && findOwnPendingSubmission(rows, { eventId: form.eventId, contributorId: auth.currentUser?.uid || "" })) {
          resetForm(); setCorrectionTarget(null);
          void refreshAfterSave("Your planting report for this event is already saved and awaiting MENRO Staff verification. It was not submitted again.");
          return;
        }
      }
      const fields = finalReportFieldErrors(backendFieldErrors(error, { quantityPlanted: "quantity", inventoryId: "finalItems", items: "finalItems", evidence: "photos", files: "photos" }), finalRows);
      if (Object.keys(fields).length) { setFormErrors(fields); focusFirstInvalid(() => reportFormRef.current); }
      else showPopup((savedResponse ? "The report is already saved. Retry attendance only. " : "") + (error.message || "Unable to submit the planting report. Please try again."), "error");
    } finally {
      setSubmitting(false);
    }
  }

  function openRecord(record) {
    setSelectedRecord(record);
    setSelectedSubmission(null);
    setVerificationRemarks("");
    setShowViewModal(true);
    refreshSelectedRecord(record.id);
  }

  // The list may be stale (e.g. a Participant submitted after Staff loaded the
  // page). Re-read the single report so status, submissions and photo indexes
  // reflect what is actually saved. Backend RBAC/redaction still applies.
  async function refreshSelectedRecord(reportId) {
    if (!reportId) return;
    try {
      const response = await apiRequest(`/planting-reports/${encodeURIComponent(reportId)}`);
      if (!response?.data) return;
      setSelectedRecord((current) => (current && current.id === reportId ? response.data : current));
      setRecords((current) => current.map((item) => (item.id === reportId ? response.data : item)));
    } catch {
      // Keep the list copy; the drawer still renders it.
    }
  }

  function closeRecordModal() {
    if (actionLoading || decisionInFlightRef.current) return;
    openedReportFromSearchRef.current = "";
    setSelectedRecord(null);
    setSelectedSubmission(null);
    setVerificationRemarks("");
    setDecision("");
    setDecisionFieldError("");
    setDecisionError("");
    setShowViewModal(false);
  }

  // A participant corrects their own returned submission. The normal submit
  // form opens with the return reason; the resubmission is linked to the
  // returned submission and the backend requires the same event and seedling.
  function startCorrection(submission) {
    if (!submission || !selectedRecord) return;
    if (unconfirmedSubmission) {
      // Resolve the unconfirmed submission first; it must not be relinked.
      setShowViewModal(false);
      openSubmitModal();
      return;
    }
    setCorrectionTarget({
      id: submission.id,
      reason: submission.returnReason || submission.reviewRemarks || "",
      species: submission.species || "",
      eventName: selectedRecord.eventName || "",
      siteName: selectedRecord.siteName || "",
    });
    openedReportFromSearchRef.current = "";
    setShowViewModal(false);
    setSelectedRecord(null);
    setSelectedSubmission(null);
    openSubmitModal({ correction: true });
  }

  function openDecision(submission, nextDecision) {
    if (actionLoading || decisionInFlightRef.current) return;
    setSelectedSubmission(submission);
    setVerificationRemarks("");
    setDecisionFieldError("");
    setDecisionError("");
    setCorrectionSelections({});
    setCorrectionErrors({});
    setDecision(nextDecision);
  }

  // Admin returns a final Staff report by naming the submitted fields to correct.
  function fieldReturnFor(submission, nextDecision = decision) {
    if (nextDecision !== "return" || submission?.officialStaffReport !== true || !submission?.finalReportGroupId) return [];
    return staffCorrectableFields(finalReportGroupRows(submission, selectedRecord?.submissions || []));
  }

  function toggleCorrectionField(path, checked) {
    setCorrectionSelections((current) => {
      const next = { ...current };
      if (checked) next[path] = next[path] ?? ""; else delete next[path];
      return next;
    });
    setCorrectionErrors((current) => ({ ...current, fields: "", [`fieldComment-${path}`]: "" }));
  }

  function closeDecision() {
    if (actionLoading || decisionInFlightRef.current) return;
    setDecision("");
    setDecisionFieldError("");
    setDecisionError("");
  }

  // One handler for Forward, Return, Approve and Reject. The modal closes only
  // after the backend accepts the decision; a synchronous guard blocks repeats.
  async function submitDecision() {
    const config = DECISIONS[decision];
    if (!config || !selectedRecord || !selectedSubmission || decisionInFlightRef.current) return;
    if (!availableDecisions(selectedSubmission, userRole).includes(decision)) return;
    const reasonError = decisionReasonError(decision, verificationRemarks);
    const returnFields = fieldReturnFor(selectedSubmission);
    const selectionErrors = returnFields.length ? correctionSelectionErrors(correctionSelections) : {};
    setCorrectionErrors(selectionErrors);
    if (reasonError || Object.keys(selectionErrors).length) {
      setDecisionFieldError(reasonError);
      focusFirstInvalid(() => document.querySelector(".pr-decision-modal"));
      return;
    }
    const fields = returnFields.length
      ? returnFields.filter((field) => Object.hasOwn(correctionSelections, field.path))
        .map((field) => ({ path: field.path, comment: correctionSelections[field.path].trim() }))
      : undefined;
    decisionInFlightRef.current = true;
    setActionLoading(true);
    setDecisionError("");
    try {
      const response = await apiRequest(
        `/planting-reports/${encodeURIComponent(selectedSubmission.id)}/${config.endpoint}`,
        { method: "PATCH", body: JSON.stringify({ remarks: verificationRemarks.trim(), ...(fields ? { fields } : {}) }) }
      );
      setSelectedRecord(response.data);
      setSelectedSubmission(null);
      setVerificationRemarks("");
      setDecisionFieldError("");
      setCorrectionSelections({});
      setCorrectionErrors({});
      setDecision("");
      setHistoryVersion((version) => version + 1);
      toast.success(response.message || config.success);
      await loadReports();
    } catch (error) {
      const fieldMessage = error?.fieldErrors?.remarks;
      if (fieldMessage) setDecisionFieldError(fieldMessage);
      if (error?.fieldErrors && Object.keys(error.fieldErrors).some((key) => key === "fields" || key.startsWith("fieldComment-"))) setCorrectionErrors(error.fieldErrors);
      setDecisionError(error?.message || "The decision could not be saved. Please try again.");
    } finally {
      decisionInFlightRef.current = false;
      setActionLoading(false);
    }
  }

  function getStatusIcon(status) {
    if (["Approved", "Submitted", "Completed", "Verified", "Accepted", "Not Required"].includes(status)) {
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

  // Review-stage badge for one submission (not the legacy report label mapper).
  function renderWorkflowBadge(status) {
    const icon = status === WORKFLOW_STATUS.COMPLETED ? <FiCheckCircle size={12} />
      : status === WORKFLOW_STATUS.REJECTED ? <FiXCircle size={12} />
        : status === WORKFLOW_STATUS.RETURNED ? <FiRotateCcw size={12} /> : <FiClock size={12} />;
    return (
      <span className={`pr-status-badge ${WORKFLOW_STATUS_CLASS[status] || "pr-status-default"}`} data-workflow-status={status}>
        {icon}
        {status}
      </span>
    );
  }

  function renderVerificationCheck(label, value) {
    const state = value === true ? "pass" : value === false ? "fail" : "unknown";
    return (
      <span className={`pr-evidence-check pr-evidence-check-${state}`}>
        {state === "pass" ? <FiCheck size={12} /> : state === "fail" ? <FiX size={12} /> : <FiInfo size={12} />}
        {label}: {state === "pass" ? "Passed" : state === "fail" ? "Failed" : "Not recorded"}
      </span>
    );
  }

  const visibleVerificationIssues = Array.isArray(selectedRecord?.suspiciousFlags)
    ? selectedRecord.suspiciousFlags
    : [];
  const recordSubmissions = Array.isArray(selectedRecord?.submissions)
    ? selectedRecord.submissions
    : [];
  let nextSubmissionPhotoIndex = 0;
  const submissionsWithPhotoIndexes = recordSubmissions.map((submission) => ({
    ...submission,
    indexedPhotos: (submission.photos || []).map((photo) => ({
      ...photo,
      reportPhotoIndex: nextSubmissionPhotoIndex++,
    })),
  }));
  // Older standalone reports are reviewed as one record (the backend accepts its report ID).
  const standaloneReview = selectedRecord && selectedRecord.reportType !== "parent" && selectedRecord.workflowStatus
    ? { ...selectedRecord, officialStaffReport: false } : null;
  // Memoized so the read-only map keeps the viewer's pan and zoom between renders.
  const evidenceMarkers = useMemo(() => {
    if (!selectedRecord) return [];
    let photoIndex = 0;
    const rows = Array.isArray(selectedRecord.submissions) && selectedRecord.submissions.length
      ? selectedRecord.submissions.map((submission) => ({ ...submission,
        indexedPhotos: (submission.photos || []).map((photo) => ({ ...photo, reportPhotoIndex: photoIndex++ })) }))
      : selectedRecord.reportType !== "parent"
        ? [{ ...selectedRecord, officialStaffReport: false, indexedPhotos: (selectedRecord.photos || []).map((photo, index) => ({ ...photo, reportPhotoIndex: index })) }]
        : [];
    return buildEvidenceMarkers(rows);
  }, [selectedRecord]);
  const viewSiteId = selectedRecord?.siteId, viewSiteName = selectedRecord?.siteName, viewBarangay = selectedRecord?.barangay;
  const mapSite = useMemo(() => {
    const registered = viewSiteId ? sites.find((site) => String(getSiteId(site)) === String(viewSiteId)) : null;
    return registered || (viewSiteName ? { siteName: viewSiteName, barangay: viewBarangay || "" } : null);
  }, [sites, viewSiteId, viewSiteName, viewBarangay]);
  const standaloneActions = standaloneReview ? availableDecisions(standaloneReview, userRole) : [];
  const standaloneWaiting = standaloneReview && !standaloneActions.length ? waitingMessage(standaloneReview, userRole) : "";
  // Report-level photo index -> the submission that saved it (same order as the backend).
  const photoOwners = new Map(submissionsWithPhotoIndexes.flatMap((submission) =>
    submission.indexedPhotos.map((photo) => [photo.reportPhotoIndex, submission])));
  const activeDecision = DECISIONS[decision] || null;
  const decisionReasonLength = verificationRemarks.trim().length;

  if (loading) {
    return <div className="pr-page"><PageLoadingState message="Loading planting reports..." /></div>;
  }

  if (reportError) {
    return <div className="pr-page"><div role="alert" style={{ minHeight: "420px", display: "grid", placeContent: "center", justifyItems: "center", gap: "14px", color: "#526159", fontSize: "13px", fontWeight: 600 }}><span>{reportError}</span><button type="button" className="pr-secondary-button" onClick={loadReports}>Retry</button></div></div>;
  }

  return (
    <div className="pr-page">
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

        {userRole === "staff" && <button type="button" className="pr-primary-button" onClick={() => setOfficialForm({})}><FiPlus size={15} />Submit Planting Report</button>}
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

      {!isParticipant && resolveVerifiedPlantingCohortEnabled() && <section className="pr-panel pr-cohort-integration">
        <button type="button" className="pr-secondary-button" aria-expanded={showCohorts} onClick={() => setShowCohorts(value => !value)}>Verified Planting Cohorts</button>
        {/* Staff register sampling plans and baselines here; Admin reviews them from Survival Monitoring. */}
        {showCohorts && <VerifiedPlantingCohortsPage embedded view={userRole === "staff" ? "all" : "records"} />}
      </section>}
      <div className="pr-cards" role="list" aria-label="Planting report summary">
        {REPORT_KPIS.map((kpi) => (
          <div key={kpi.key} className={`pr-kpi-card pr-kpi-${kpi.tone}`} role="listitem" data-kpi={kpi.key}>
            <div className="pr-kpi-title">{kpi.title}</div>
            <div className="pr-kpi-value">{summary[kpi.key]}</div>
            <div className="pr-kpi-description">{kpi.description}</div>
          </div>
        ))}
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
                {REPORT_STATUS_FILTERS.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
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
                  <th className="pr-th">Seedling Tree</th>
                  <th className="pr-th">Quantity</th>
                  <th className="pr-th">Date Planted</th>
                  <th className="pr-th">Reporting Progress</th>
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
                    <td className="pr-td">
                      {reportSeedlingItems(record).length > 0 ? (
                        <ul className="pr-seedling-list">
                          {reportSeedlingItems(record).map((item) => (
                            <li key={item.species} className="pr-seedling-item">
                              <span className="pr-seedling-name">{item.species}</span>
                              {item.quantity !== null && <span className="pr-seedling-qty">{item.quantity}</span>}
                            </li>
                          ))}
                        </ul>
                      ) : "—"}
                    </td>
                    <td className="pr-td">
                      <strong>{record.reportType === "parent"
                        ? `${record.activeSubmittedQuantity ?? "Not reported"} reported planted / ${record.quantityReleased ?? "Unavailable"} released`
                        : record.quantityPlanted ?? "—"}</strong>
                      {record.reportType === "parent" && (
                        <div className="pr-table-sub">{record.remainingAvailableQuantity ?? "Unavailable"} available for future planting</div>
                      )}
                    </td>
                    <td className="pr-td">{formatDate(record.plantingDate)}</td>
                    <td className="pr-td">
                      {renderStatusBadge(reportSubmissionStatus(record))}
                      <div className="pr-review-line" data-review-status={reportReviewStatus(record)} data-review-stages={reportReviewStages(record).join("|")}>
                        Review Status: <span className="pr-review-value">{reportReviewStages(record).length > 1 ? reportReviewStages(record).join(" · ") : reportReviewStatus(record)}</span>
                      </div>
                    </td>
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
                      {isParticipant && Number(record.remainingAvailableQuantity ?? 0) > 0 && (
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

      {officialForm && userRole === "staff" && <StaffPlantingReportForm currentUser={currentUser} correction={officialForm.correction} resumeEvidence={officialForm.resumeEvidence}
        pending={pendingOfficialSubmission === undefined ? loadPendingSubmission("staff", auth.currentUser?.uid || currentUser?.uid) : pendingOfficialSubmission} onPendingChange={updatePendingOfficialSubmission} onClose={() => setOfficialForm(null)}
        onSaved={(_report, info) => { void refreshAfterSave(`${(info ? info.correction : officialForm.correction) ? "Corrected official planting report resubmitted to the MENRO Admin for approval." : "Official planting report submitted to the MENRO Admin for approval."}${info?.evidencePending ? " Its planting photos were not uploaded: add them with Add Verified Planting Evidence on the report." : ""}${info?.attendancePending ? " The optional attendance file was not uploaded." : ""}`); }} />}
      {showSubmitModal && isParticipant && (
        <ModalDialog label="Submit Planting Report" onClose={closeSubmitModal} dismissible={!submitting} busy={submitting}>
        <PlantingReportFormErrorBoundary
          resetKey={formRenderRecovery}
          onRecover={async () => {
            await refreshReferenceData();
            setFormRenderRecovery((value) => value + 1);
          }}
        >
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

            <form ref={reportFormRef} noValidate onSubmit={handleSubmit} onBlur={event => {
              const field = event.target.id?.replace(/^planting-/, "");
              if (field && Object.hasOwn(formErrors, field)) setFormErrors(current => ({ ...current, [field]: validatePlantingReportForm(form, { distributions, photos: photoFiles, previews: photoPreviews, hasGps, municipalityScopeStatus, finalRows })[field] || "" }));
            }}>
              <div className="pr-modal-body pr-submit-modal-body">
                <fieldset disabled={submitting || Boolean(unconfirmedSubmission) || Boolean(savedParticipantReport)} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
                <div
                  ref={submitAlertRef}
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

                {correctionTarget && (
                  <div className="pr-correction-banner" role="note" aria-label="Correction details">
                    <FiRotateCcw size={16} aria-hidden="true" />
                    <div>
                      <strong>Correcting a returned planting report</strong>
                      {correctionTarget.reason && <p><span>MENRO Staff reason:</span> {correctionTarget.reason}</p>}
                      <p>
                        Select the same planting event{correctionTarget.eventName ? ` (${correctionTarget.eventName})` : ""}
                        {correctionTarget.species ? ` and seedling (${correctionTarget.species})` : ""}, then attach new geotagged photos.
                        Your corrected report returns to MENRO Staff for review.
                      </p>
                    </div>
                  </div>
                )}

                <section className="pr-section pr-report-information-section">
                  <div className="pr-section-header">
                    <FiFileText size={15} />
                    Report Submitted By
                  </div>

                  <div className="pr-grid2">
                    <div>
                      <label htmlFor="planting-submittedByName" className="pr-label">Full Name <span className="pr-required">*</span></label>
                      <input {...fieldAccessibility("submittedByName")} className="pr-input" value={form.submittedByName}
                        onChange={(event) => updateFormField("submittedByName", event.target.value)}
                        placeholder="Enter full name" />
{formErrors.submittedByName && <small id="planting-error-submittedByName" className="pr-field-error" role="alert">{formErrors.submittedByName}</small>}
                    </div>

                    <div>
                      <label htmlFor="planting-submittedBySector" className="pr-label">Sector <span className="pr-required">*</span></label>
                      <select {...fieldAccessibility("submittedBySector")} className="pr-input" value={form.submittedBySector}
                        onChange={(event) => updateFormField("submittedBySector", event.target.value)}>
                        <option value="">Select sector</option>
                        {USER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
{formErrors.submittedBySector && <small id="planting-error-submittedBySector" className="pr-field-error" role="alert">{formErrors.submittedBySector}</small>}
                    </div>

                    <div>
                      <label htmlFor="planting-submittedByContactNumber" className="pr-label">Contact Number <span className="pr-required">*</span></label>
                      <input {...fieldAccessibility("submittedByContactNumber")} className="pr-input" type="tel" value={form.submittedByContactNumber}
                        onChange={(event) => updateFormField("submittedByContactNumber", event.target.value)}
                        placeholder="09XXXXXXXXX" />
{formErrors.submittedByContactNumber && <small id="planting-error-submittedByContactNumber" className="pr-field-error" role="alert">{formErrors.submittedByContactNumber}</small>}
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
                      <label htmlFor="planting-barangay" className="pr-label">
                        Barangay <span className="pr-required">*</span>
                      </label>
                      <select {...fieldAccessibility("barangay")}
                        className="pr-input pr-barangay-select"
                        value={form.barangay}
                        onChange={(event) => updateFormField("barangay", event.target.value)}
                        disabled={referenceLoading}
                      >
                        <option value="">
                          {referenceLoading ? "Loading barangays..." : "Select barangay"}
                        </option>
                        {BULAN_BARANGAYS.map((barangay) => {
                          const hasSite = barangaysWithSites.has(normalizeBarangayName(barangay));
                          return (
                            <option key={barangay} value={barangay} disabled={!hasSite}>
                              {barangay}
                            </option>
                          );
                        })}
                      </select>
{formErrors.barangay && <small id="planting-error-barangay" className="pr-field-error" role="alert">{formErrors.barangay}</small>}
                    </div>

                    <div className="pr-full-width">
                      <label htmlFor="planting-siteId" className="pr-label">
                        Planting Site <span className="pr-required">*</span>
                      </label>
                      <select {...fieldAccessibility("siteId")}
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
{formErrors.siteId && <small id="planting-error-siteId" className="pr-field-error" role="alert">{formErrors.siteId}</small>}
                      {form.barangay && !referenceLoading && filteredSites.length === 0 && (
                        <div className="pr-helper-text">
                          No planting sites are currently available for this barangay.
                        </div>
                      )}
                    </div>

                    <div className="pr-full-width">
                      <label htmlFor="planting-eventId" className="pr-label">
                        Planting Event <span className="pr-required">*</span>
                      </label>
                      <select {...fieldAccessibility("eventId")}
                        className="pr-input"
                        value={form.eventId}
                        onChange={handleEventChange}
                        disabled={
                          !form.siteId ||
                          eventsLoadStatus === "loading" ||
                          eventsLoadStatus === "error" ||
                          (eventsLoadStatus === "success" && filteredEvents.length === 0)
                        }
                      >
                        <option value="">
                          {!form.siteId ? "Select planting site first" :
                            eventsLoadStatus === "loading" ? "Loading planting events..." :
                            eventsLoadStatus === "error" ? "Planting events unavailable" :
                            filteredEvents.length === 0 ? "No available planting events" :
                            "Select planting event"}
                        </option>
                        {filteredEvents.map((event) => (
                          <option key={getEventId(event)} value={getEventId(event)}>
                            {getEventName(event)} — {formatDate(getEventDateValue(event))} — {getReportEventStatus(event)}
                          </option>
                        ))}
                      </select>
{formErrors.eventId && <small id="planting-error-eventId" className="pr-field-error" role="alert">{formErrors.eventId}</small>}
                      {noEventsAlertSiteId === String(form.siteId) && (
                        <div className="pr-no-events-alert-slot">
                          <div className="pr-no-events-alert" role="status">
                            No planting events are available for this planting site.
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="planting-plantingDate" className="pr-label">Planting Event Date</label>
                      <input {...fieldAccessibility("plantingDate")} type="date" className="pr-input pr-readonly" value={form.plantingDate} readOnly />
{formErrors.plantingDate && <small id="planting-error-plantingDate" className="pr-field-error" role="alert">{formErrors.plantingDate}</small>}
                    </div>

                    <div className="pr-full-width">
                      <label htmlFor="planting-distributionId" className="pr-label">
                        Released Seedling Distribution <span className="pr-required">*</span>
                      </label>
                      <select {...fieldAccessibility("distributionId")}
                        className="pr-input"
                        value={form.distributionId}
                        onChange={handleDistributionChange}
                        disabled={!form.eventId}
                      >
                        <option value="">
                          {!form.eventId ? "Select planting event first" : "Select released seedling distribution"}
                        </option>
                        {eligibleDistributions.map((distribution) => (
                          <option key={distribution.id} value={distribution.id}>
                            {(distribution.items || []).map((item) => item.species).filter(Boolean).join(", ") || distribution.species || "Seedlings"} — {distribution.totalQuantityReleased ?? distribution.quantityReleased ?? "—"} released — {formatDate(distribution.releasedAt)} — {getDistributionReference(distribution)} — {distribution.participantName || distribution.organization || "Recipient"}
                          </option>
                        ))}
                      </select>
{formErrors.distributionId && <small id="planting-error-distributionId" className="pr-field-error" role="alert">{formErrors.distributionId}</small>}
                      {form.eventId && eligibleDistributions.length === 0 && (
                        <div className="pr-helper-text" role="status">
                          No released seedling distributions are available for this planting event.
                        </div>
                      )}
                    </div>

                    <div className="pr-full-width">
                      <fieldset className="pr-final-report" aria-describedby="planting-final-help">
                        <legend className="pr-label">Final Planting Report — All Released Seedling Types <span className="pr-required">*</span></legend>
                        <p id="planting-final-help" className="pr-helper-text">
                          One final report covers every released seedling type. Enter the final leftover seedlings (not planted) for each type;
                          Final Planted = Available − Leftovers. Leftovers are recorded for documentation only.
                        </p>
                        {!form.distributionId ? (
                          <div className="pr-helper-text" role="status">Select the released seedling distribution first.</div>
                        ) : finalRows.length === 0 ? (
                          <div className="pr-helper-text" role="status">No seedlings remain to be reported for this planting event.</div>
                        ) : (
                          <div className="pr-final-report-table-wrap">
                            <table className="pr-final-report-table">
                              <thead>
                                <tr>
                                  <th scope="col">Seedling Type</th>
                                  <th scope="col">Released</th>
                                  <th scope="col">Available</th>
                                  <th scope="col">Final Leftovers</th>
                                  <th scope="col">Final Planted</th>
                                </tr>
                              </thead>
                              <tbody>
                                {finalRows.map((row) => {
                                  const leftoverKey = `leftoverQuantity-${row.inventoryId}`, reasonKey = `leftoverReason-${row.inventoryId}`;
                                  return (
                                    <tr key={row.inventoryId} data-inventory-id={row.inventoryId}>
                                      <th scope="row">{row.species}</th>
                                      <td>{row.releasedQuantity}</td>
                                      <td>{row.remaining}</td>
                                      <td>
                                        <label className="pr-sr-only" htmlFor={`planting-${leftoverKey}`}>Final leftover {row.species} seedlings</label>
                                        <input id={`planting-${leftoverKey}`} className="pr-input pr-final-leftover" type="number" min="0" max={row.remaining} step="1"
                                          value={row.leftoverQuantity} aria-invalid={formErrors[leftoverKey] ? "true" : undefined}
                                          aria-describedby={formErrors[leftoverKey] ? `planting-error-${leftoverKey}` : undefined}
                                          onChange={(event) => updateFinalEntry(row.inventoryId, "leftoverQuantity", event.target.value)} />
                                        {formErrors[leftoverKey] && <small id={`planting-error-${leftoverKey}`} className="pr-field-error" role="alert">{formErrors[leftoverKey]}</small>}
                                        {row.needsReason && (
                                          <>
                                            <label className="pr-final-reason-label" htmlFor={`planting-${reasonKey}`}>Reason for leftovers <span className="pr-required">*</span></label>
                                            <textarea id={`planting-${reasonKey}`} className="pr-textarea pr-final-reason" rows={2} maxLength={MAX_LEFTOVER_REASON_LENGTH}
                                              value={row.leftoverReason} aria-required="true" aria-invalid={formErrors[reasonKey] ? "true" : undefined}
                                              aria-describedby={formErrors[reasonKey] ? `planting-error-${reasonKey}` : undefined}
                                              placeholder="e.g. seedlings damaged in transport"
                                              onChange={(event) => updateFinalEntry(row.inventoryId, "leftoverReason", event.target.value)} />
                                            {formErrors[reasonKey] && <small id={`planting-error-${reasonKey}`} className="pr-field-error" role="alert">{formErrors[reasonKey]}</small>}
                                          </>
                                        )}
                                      </td>
                                      <td><strong className="pr-final-planted">{row.planted ?? "—"}</strong></td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <th scope="row">Total</th>
                                  <td>{finalRows.reduce((sum, row) => sum + row.releasedQuantity, 0)}</td>
                                  <td>{finalRows.reduce((sum, row) => sum + row.remaining, 0)}</td>
                                  <td>{finalRows.reduce((sum, row) => sum + (Number(row.leftoverQuantity) || 0), 0)}</td>
                                  <td><strong>{finalRows.every((row) => row.planted !== null) ? finalRows.reduce((sum, row) => sum + row.planted, 0) : "—"}</strong></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                        {formErrors.finalItems && <small id="planting-error-finalItems" className="pr-field-error" role="alert">{formErrors.finalItems}</small>}
                      </fieldset>
                    </div>

                    <div className="pr-full-width">
                      <div className="pr-site-preview">
                        <div className="pr-site-preview-icon"><FiInfo size={17} /></div>
                        <div className="pr-site-preview-content">
                          <div className="pr-site-preview-title">Responsible Planting Participant / Organization</div>
                          {!responsibleDistribution ? (
                            <div className="pr-site-preview-meta">Select planting details to view participant information.</div>
                          ) : (
                            <>
                              <div className="pr-site-preview-name">
                                {responsibleDistribution.participantName || responsibleDistribution.organization || "Not Yet Identified"}
                              </div>
                              <div className="pr-site-preview-meta">
                                Sector: {responsibleDistribution.participantType || responsibleDistribution.userType || "Not Yet Identified"}
                                {responsibleDistribution.organization ? ` • Organization: ${responsibleDistribution.organization}` : ""}
                                {responsibleDistribution.barangay ? ` • Barangay ${responsibleDistribution.barangay}` : ""}
                              </div>
                              <div className="pr-site-preview-meta">
                                Request: {responsibleDistribution.requestNumber || responsibleDistribution.requestId || "Not Yet Identified"}
                                {` • Distribution: ${getDistributionReference(responsibleDistribution)}`}
                                {` • Registered event participants: ${formatParticipantCount(
                                  responsibleEvent?.actualParticipants ??
                                  responsibleEvent?.participantCount ??
                                  responsibleEvent?.registeredParticipantCount,
                                )}`}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
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

                <section className="pr-section pr-photo-evidence-section">
                          <div className="pr-section-header pr-photo-section-header">
                            <span><FiCamera size={15} /> Planting Photo Evidence</span>
                            <button
                              type="button"
                              className="pr-reminder-button"
                              onClick={() => setShowPhotoRequirements(true)}
                            >
                              <FiInfo size={14} /> Reminder
                            </button>
                          </div>

                          {photoFiles.length === 0 && (
                            <div className="pr-helper-text pr-helper-emphasis">
                              Upload or take an original geotagged photo before verifying its location.
                            </div>
                          )}

                          <div className="pr-photo-content">


                    <PlantingPhotoControls inputId="planting-photos" count={photoFiles.length} max={MAX_EVIDENCE_PHOTOS} disabled={submitting || Boolean(unconfirmedSubmission)} error={formErrors.photos || photoPreviews.find(preview => preview.verificationStatus === "failed" || preview.submissionBlocked)?.verificationMessage || ""} onCamera={startCamera} onFiles={files => handlePhotoChange({ target: { files, value: "" } })} />


                    {photoPreviews.length > 0 && (
                      <div className="pr-evidence-grid">
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

                            <div
                              className={`pr-preview-verification pr-preview-verification-${preview.verificationTone || "info"}`}
                              role={preview.verificationTone === "error" ? "alert" : "status"}
                            >
                              <strong>{preview.verificationLabel || "Not Yet Verified"}</strong>
                              {preview.verificationMessage && (
                                <span>{preview.verificationMessage}</span>
                              )}
                              <span>Location Source: {preview.locationSource}</span>
                              {Number.isFinite(Number(preview.latitude)) &&
                                Number.isFinite(Number(preview.longitude)) && (
                                  <span>
                                    Photo Coordinates: {Number(preview.latitude).toFixed(6)}, {Number(preview.longitude).toFixed(6)}
                                  </span>
                                )}
                              {Number.isFinite(Number(preview.distanceMeters)) && (
                                <span>Distance from Site: {Number(preview.distanceMeters).toFixed(1)} meters</span>
                              )}
                              {optionalFiniteNumber(preview.accuracy) !== null && optionalFiniteNumber(preview.accuracy) >= 0 ? (
                                <span>GPS Accuracy: {optionalFiniteNumber(preview.accuracy).toFixed(1)} meters</span>
                              ) : <span>GPS Accuracy: Not provided by EXIF</span>}
                              {preview.boundaryRule && (
                                <span>Boundary Rule: {preview.boundaryRule === "configured-radius"
                                  ? `Configured radius (${preview.boundaryLimitMeters} m)`
                                  : preview.boundaryRule === "site-polygon"
                                    ? "Authoritative site polygon"
                                    : "50 m site-distance fallback"}</span>
                              )}
                            </div>

                            <button
                              type="button"
                              className="pr-secondary-button"
                              onClick={() => setSelectedLocationPreviewId(preview.id)}
                              style={{ marginTop: "8px", marginRight: "8px" }}
                            >
                              <FiMapPin size={13} />
                              Verify Photo Location
                            </button>

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
                        disabled={locationLoading}
                        onClick={verifyPhotoLocation}
                      >
                        <FiMapPin size={14} />
                        {locationLoading
                          ? "Reading Photo..."
                          : hasGps
                          ? "Verify Again"
                          : "Verify Photo Location"}
                      </button>
                    </div>

                    {evidenceMapHasGps && (
                      <div className="pr-gps-captured">
                        <div>
                          <div className="pr-gps-value-label">Latitude</div>
                          <div className="pr-gps-value">{evidenceMapLatitude.toFixed(6)}</div>
                        </div>
                        <div>
                          <div className="pr-gps-value-label">Longitude</div>
                          <div className="pr-gps-value">{evidenceMapLongitude.toFixed(6)}</div>
                        </div>
                        <div>
                          <div className="pr-gps-value-label">Source</div>
                          <div className="pr-gps-value">{primaryLocationPreview?.locationSource || "—"}</div>
                        </div>
                        <div>
                          <div className="pr-gps-value-label">GPS Accuracy</div>
                          <div className="pr-gps-value">
                            {Number.isFinite(evidenceMapAccuracy) && evidenceMapAccuracy >= 0
                              ? `${evidenceMapAccuracy.toFixed(1)} m` : "Not provided by EXIF"}
                          </div>
                        </div>
                        <div>
                          <div className="pr-gps-value-label">Distance from Site</div>
                          <div className="pr-gps-value">
                            {capturedSiteDistance !== null ? `${capturedSiteDistance.toFixed(1)} m` : "Unable to calculate"}
                          </div>
                        </div>
                        <div>
                          <div className="pr-gps-value-label">Boundary Rule</div>
                          <div className="pr-gps-value">
                            {primaryLocationPreview?.boundaryRule === "configured-radius"
                              ? `Configured radius (${primaryLocationPreview.boundaryLimitMeters ?? siteCoverageRadiusMeters} m)`
                              : primaryLocationPreview?.boundaryRule === "site-polygon" || capturedInsideSitePolygon !== null
                                ? "Authoritative site polygon"
                                : "50 m site-distance fallback where applicable"}
                          </div>
                        </div>
                        <div>
                          <div className="pr-gps-value-label">Location Status</div>
                          <div className="pr-gps-value">
                            {verificationMapResult.label}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pr-location-map-section">
                      <div className="pr-location-map-heading">
                        <div>
                          <div className="pr-location-map-title">Bulan Location Preview</div>

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
                                        aria-label="Interactive Bulan barangay and planting site location preview"
                                      />



                              </div>

                              <div className="pr-location-map-legend">
                                <span><i className="pr-map-legend-line" /> Barangay Boundary</span>
                                <span><i className="pr-map-legend-site" /> Registered Site</span>
                                <span><i className="pr-map-legend-captured" /> Evidence GPS</span>
                              </div>
                            </div>
                          </div>

                          {evidenceMapHasGps && (
                            <div className="pr-helper-text">
                              Evidence captured: {primaryLocationPreview?.metadata?.capturedAt || form.photoCapturedAt
                                ? formatDateTime(primaryLocationPreview?.metadata?.capturedAt || form.photoCapturedAt)
                                : "Timestamp unavailable"}
                            </div>
                          )}
                        </section>

                <section className="pr-section pr-section-last pr-report-additional-section">
                  <div className="pr-section-header">
                    <FiFileText size={15} />
                    Additional Information
                  </div>

                  <label htmlFor="planting-remarks" className="pr-label">Remarks</label>
                  <textarea {...fieldAccessibility("remarks")}
                    value={form.remarks}
                    onChange={(event) =>
                      updateFormField("remarks", event.target.value)
                    }
                    placeholder="Add notes about the planting activity, if necessary..."
                    className="pr-textarea"
                  />
{formErrors.remarks && <small id="planting-error-remarks" className="pr-field-error" role="alert">{formErrors.remarks}</small>}
                </section>
                </fieldset>

                <AttendanceUpload file={attendanceFile} onChange={setAttendanceFile} error={formErrors.attendance} onError={message => setFormErrors(current => ({ ...current, attendance: message }))} disabled={submitting || Boolean(unconfirmedSubmission)} />
                {savedParticipantReport && <p role="status">Your report is already saved pending MENRO verification. This action retries only optional attendance.</p>}
              </div>

              <div className="pr-modal-footer">
                {unconfirmedSubmission && !submitting && <p className="pr-submit-unconfirmed" role="status">Not yet confirmed by MENRO. Select Check Submission; the report is sent again only if MENRO has not saved it.</p>}
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
                  {submitting ? (unconfirmedSubmission ? "Checking..." : "Submitting...") : unconfirmedSubmission ? "Check Submission" : savedParticipantReport ? "Retry Attendance Upload" : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
        </PlantingReportFormErrorBoundary>
        </ModalDialog>
      )}

      {showPhotoRequirements && (
        <PhotoRequirementsDialog onClose={() => setShowPhotoRequirements(false)} onTakePhoto={startCamera} />
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
                  {renderStatusBadge(reportSubmissionStatus(selectedRecord))}
                  {Object.values(WORKFLOW_STATUS).includes(reportReviewStatus(selectedRecord)) ? renderWorkflowBadge(reportReviewStatus(selectedRecord)) : renderStatusBadge(reportReviewStatus(selectedRecord))}
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

            <div className="menro-toast-anchor" data-menro-toast-anchor />

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
                    <div className="pr-info-label">Last Submitted</div>
                    <div className="pr-info-value">
                      {latestSubmittedAt(selectedRecord)
                        ? formatDateTime(latestSubmittedAt(selectedRecord))
                        : "Not yet submitted"}
                    </div>
                  </div>
                </div>

                {selectedRecord.allocationSummary?.length > 1 && (
                  <div className="pr-species-breakdown">
                    <div className="pr-info-label" id="pr-species-breakdown-title">Seedlings per Type</div>
                    <div className="pr-species-breakdown-scroll">
                      <table aria-labelledby="pr-species-breakdown-title">
                        <thead><tr><th scope="col">Seedling Type</th><th scope="col">Released</th><th scope="col">Planted</th><th scope="col">Leftover</th><th scope="col">Remaining</th></tr></thead>
                        <tbody>
                          {selectedRecord.allocationSummary.map((item) => (
                            <tr key={item.inventoryId || item.species}>
                              <th scope="row">{item.species || "Seedling"}</th>
                              <td>{item.allocated ?? "—"}</td>
                              <td>{item.recorded ?? 0}</td>
                              <td>{item.leftoverQuantity ?? 0}</td>
                              <td>{item.remaining ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="pr-info-subvalue">Planted includes quantities awaiting approval. Returned and rejected submissions are not counted.</div>
                  </div>
                )}

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
                          <ProtectedEvidenceImage
                            endpoint={`/evidence/planting-reports/${encodeURIComponent(selectedRecord.id)}/photos/${index}`}
                            alt={`Geo-tagged planting evidence ${index + 1}`}
                            className="pr-drawer-photo"
                            showOpenButton
                            openButtonClassName="pr-photo-view-button"
                            openButtonContent={<><FiEye size={14} />View Full Size</>}
                          />
                        </div>

                        <div className="pr-photo-caption-row">
                          <div className="pr-photo-caption">
                            {photo.photoCapturedAt || photo.metadata?.capturedAt
                              ? `Photo ${index + 1} • ${formatDateTime(photo.photoCapturedAt || photo.metadata?.capturedAt)}`
                              : `Evidence photo ${index + 1}`}
                          </div>

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
                        {(() => {
                          const owner = photoOwners.get(index) || standaloneReview || {};
                          const state = evidenceState(photo, owner);
                          const accuracy = photoCoordinates(photo)?.accuracy;
                          return (
                            <div className="pr-photo-evidence-details" data-evidence-state={state}>
                              <span className={`pr-evidence-state pr-evidence-state-${state}`}>{EVIDENCE_STATE_LABEL[state]}</span>
                              <dl>
                                <div><dt>GPS Accuracy</dt><dd>{Number.isFinite(accuracy) ? `± ${Math.round(accuracy)} m` : "—"}</dd></div>
                                <div><dt>Photo Captured</dt><dd>{formatDateTime(photo.photoCapturedAt || photo.metadata?.capturedAt)}</dd></div>
                                <div><dt>Location Captured</dt><dd>{formatDateTime(photo.locationCapturedAt)}</dd></div>
                                {Number.isFinite(Number(photo.siteGpsDistanceMeters ?? photo.gpsDistanceMeters)) && photo.siteGpsDistanceMeters !== null && (
                                  <div><dt>Distance from Site</dt><dd>{Number(photo.siteGpsDistanceMeters ?? photo.gpsDistanceMeters).toFixed(1)} m</dd></div>
                                )}
                              </dl>
                              <div className="pr-evidence-checks">
                                {renderVerificationCheck("GPS", photo.gpsValid)}
                                {renderVerificationCheck("Site", photo.siteGpsValid)}
                                {renderVerificationCheck("Timestamp", photo.timestampValid)}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pr-photo-unavailable">
                    <FiImage size={22} />
                    <div>
                      <div className="pr-photo-unavailable-title">{photoAvailabilityMessage(selectedRecord).title}</div>
                      <div className="pr-photo-unavailable-text">
                        {photoAvailabilityMessage(selectedRecord).text}
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
                        ? "Inside Municipality of Bulan"
                        : selectedRecord.municipalityScope || "—"}
                    </div>
                  </div>
                </div>
              </section>

              <section className="pr-drawer-section" aria-labelledby="pr-evidence-map-title">
                <div className="pr-drawer-section-title" id="pr-evidence-map-title">
                  <FiNavigation size={15} />
                  Evidence Location Map
                </div>
                <PlantingEvidenceMap
                  site={mapSite}
                  barangay={selectedRecord.barangay}
                  markers={evidenceMarkers}
                  formatDateTime={formatDateTime}
                />
              </section>

              <section className="pr-drawer-section">
                <div className="pr-drawer-section-title">
                  <FiCheckCircle size={15} />
                  Verification Details
                </div>

                <div className="pr-info-grid">
                  <div className="pr-info-block">
                    <div className="pr-info-label">Reporting Progress</div>
                    <div className="pr-info-value">{renderStatusBadge(selectedRecord.reportType === "parent" ? selectedRecord.reportingProgress : selectedRecord.verificationStatus)}</div>
                  </div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Active Submitted / Released</div>
                    <div className="pr-info-value">
                      {selectedRecord.activeSubmittedQuantity ?? selectedRecord.quantityPlanted ?? "—"} / {selectedRecord.quantityReleased ?? "—"}
                    </div>
                  </div>
                  <div className="pr-info-block"><div className="pr-info-label">Confirmed Planted</div><div className="pr-info-value">{selectedRecord.acceptedQuantity ?? "—"}</div></div>
                  {selectedRecord.officialPlantingWorkflow && <>
                    <div className="pr-info-block"><div className="pr-info-label">Declared Leftover Seedlings (Not Planted)</div><div className="pr-info-value">{selectedRecord.declaredLeftoverQuantity || 0}</div></div>
                    <div className="pr-info-block"><div className="pr-info-label">Admin-Verified Leftovers</div><div className="pr-info-value">{selectedRecord.acceptedLeftoverQuantity || 0}</div></div>
                  </>}
                  <div className="pr-info-block"><div className="pr-info-label">Pending Review</div><div className="pr-info-value">{selectedRecord.pendingReviewQuantity ?? "—"}</div></div>
                  <div className="pr-info-block"><div className="pr-info-label">Rejected</div><div className="pr-info-value">{selectedRecord.rejectedQuantity ?? "—"}</div></div>
                  {Number(selectedRecord.returnedQuantity) > 0 && <div className="pr-info-block"><div className="pr-info-label">Returned for Correction</div><div className="pr-info-value">{selectedRecord.returnedQuantity}</div></div>}
                  <div className="pr-info-block"><div className="pr-info-label">Remaining Available</div><div className="pr-info-value">{selectedRecord.remainingAvailableQuantity ?? "—"}</div></div>

                  <div className="pr-info-block">
                    <div className="pr-info-label">Photo GPS Metadata</div>
                    <div className="pr-info-value">
                      {photoGpsMetadataLabel(selectedRecord)}
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

                <section className="pr-drawer-section">
                  <div className="pr-drawer-section-title">
                    <FiGitBranch size={15} />
                    Planting Report Submissions
                  </div>
                  {submissionsWithPhotoIndexes.length === 0 ? (
                    <div className="pr-photo-unavailable-text">No individual submissions are available for this report.</div>
                  ) : (
                    <div className="pr-submission-list">
                      {submissionsWithPhotoIndexes.map((submission) => {
                        const stage = submissionWorkflowStatus(submission);
                        // A final report's types are decided together: actions live on its first row.
                        const groupLead = isFinalReportGroupLead(submission, submissionsWithPhotoIndexes);
                        const groupSize = finalReportGroupRows(submission, submissionsWithPhotoIndexes).length;
                        const actions = groupLead ? availableDecisions(submission, userRole) : [];
                        const waiting = !groupLead || actions.length ? "" : waitingMessage(submission, userRole);
                        const ownSubmission = (submission.authenticatedSubmitterUid || submission.contributorId || submission.participantId) === currentUser?.uid;
                        const correctable = groupLead && (submission.correctionAllowed ?? (stage === WORKFLOW_STATUS.RETURNED && !submission.correctedBySubmission)) === true;
                        const returnReason = stage === WORKFLOW_STATUS.RETURNED ? submission.returnReason || submission.rejectionReason || submission.reviewRemarks : "";
                        return (
                        <article className={`pr-submission-item pr-submission-${stage.toLowerCase().replace(/[^a-z]+/g, "-")}`} key={submission.id} aria-label={`Submission ${submission.id}`}>
                          <div className="pr-submission-heading">
                            <strong>{submission.id}</strong>
                            <span>{formatDateTime(submission.recordedAt || submission.submittedAt || submission.createdAt)}</span>
                            {renderWorkflowBadge(stage)}
                          </div>
                          <div className="pr-info-grid">
                            <div className="pr-info-block"><div className="pr-info-label">Submitted By</div><div className="pr-info-value">{submission.submittedByName || submission.contributorName || submission.participantName || "—"}</div></div>
                            <div className="pr-info-block"><div className="pr-info-label">Submitter Sector</div><div className="pr-info-value">{submission.submittedBySector || submission.participantUserType || submission.submittedByType || "—"}</div></div>
                            <div className="pr-info-block"><div className="pr-info-label">Submitter Contact</div><div className="pr-info-value">{submission.submittedByContactNumber || "—"}</div></div>
                            <div className="pr-info-block"><div className="pr-info-label">User ID</div><div className="pr-info-value">{submission.contributorId || submission.participantId || "—"}</div></div>
                            <div className="pr-info-block"><div className="pr-info-label">Tree Species</div><div className="pr-info-value">{submission.species || "—"}</div></div>
                            <div className="pr-info-block"><div className="pr-info-label">Quantity Planted</div><div className="pr-info-value">{submission.quantity ?? "—"}</div></div>
                            {(submission.officialStaffReport || submission.finalReportGroupId || Number(submission.leftoverQuantity) > 0) && <div className="pr-info-block"><div className="pr-info-label">Leftover Seedlings (Not Planted)</div><div className="pr-info-value">{submission.leftoverQuantity || 0}</div></div>}
                            {Number(submission.leftoverQuantity) > 0 && submission.leftoverReason && <div className="pr-info-block pr-full-width"><div className="pr-info-label">Reason for Leftovers</div><div className="pr-info-value pr-leftover-reason">{submission.leftoverReason}</div></div>}
                            {submission.officialStaffReport && <>
                              <div className="pr-info-block"><div className="pr-info-label">Confirmation Basis</div><div className="pr-info-value">{submission.confirmationBasis === "release-based" ? "Individual Release-Based Confirmation" : "MENRO Field Report"}</div></div>
                              <div className="pr-info-block"><div className="pr-info-label">Submitted By / Revision</div><div className="pr-info-value">MENRO Staff — {submission.submittedByName} / {submission.revision || 0}</div></div>
                            </>}
                            {!submission.officialStaffReport && Number(submission.revision) > 0 && <div className="pr-info-block"><div className="pr-info-label">Revision</div><div className="pr-info-value">{submission.revision}{submission.correctionOf ? ` (corrects ${submission.correctionOf})` : ""}</div></div>}
                            <div className="pr-info-block"><div className="pr-info-label">Site / Event / Distribution</div><div className="pr-info-value">{selectedRecord.siteName || "—"} / {selectedRecord.eventName || submission.eventId || "—"} / {submission.requestId || selectedRecord.distributionId || "—"}</div></div>
                            <div className="pr-info-block"><div className="pr-info-label">Photo Coordinates</div><div className="pr-info-value">{submission.latitude ?? "—"}, {submission.longitude ?? "—"}</div></div>
                            <div className="pr-info-block"><div className="pr-info-label">GPS Accuracy</div><div className="pr-info-value">{submission.gpsAccuracyMeters !== null && submission.gpsAccuracyMeters !== undefined && Number.isFinite(Number(submission.gpsAccuracyMeters)) ? `± ${Math.round(Number(submission.gpsAccuracyMeters))} m` : "—"}</div></div>
                            <div className="pr-info-block"><div className="pr-info-label">Automated Verification</div><div className="pr-info-value">{submission.verificationStatus || "Needs Review"}</div></div>
                            <div className="pr-info-block"><div className="pr-info-label">Verification Details</div><div className="pr-info-value">{(submission.verificationDetails || submission.suspiciousFlags || []).join(", ") || "No concerns recorded"}</div></div>
                            {submission.staffReviewedBy && <div className="pr-info-block"><div className="pr-info-label">Staff Review</div><div className="pr-info-value">{submission.staffReviewedByName || submission.staffReviewedBy} / {formatDateTime(submission.staffReviewedAt)}</div>{submission.staffReviewRemarks && <div className="pr-info-subvalue">{submission.staffReviewRemarks}</div>}</div>}
                            {(submission.adminDecisionBy || (stage === WORKFLOW_STATUS.COMPLETED && submission.reviewedBy)) && <div className="pr-info-block"><div className="pr-info-label">{stage === WORKFLOW_STATUS.REJECTED ? "Rejected By / At" : stage === WORKFLOW_STATUS.RETURNED ? "Returned By / At" : "Approved By / At"}</div><div className="pr-info-value">{submission.adminDecisionByName || submission.reviewedByName || submission.adminDecisionBy || submission.reviewedBy} / {formatDateTime(submission.adminDecisionAt || submission.reviewedAt)}</div></div>}
                            {(submission.attendanceAvailable || submission.attendanceCarriedFromSubmissionId) && (userRole === "admin" || userRole === "staff" || submission.authenticatedSubmitterUid === currentUser?.uid) && <ProtectedAttendanceButton submissionId={submission.attendanceAvailable ? submission.id : submission.attendanceCarriedFromSubmissionId} official={submission.officialStaffReport === true} />}
                          </div>
                          {returnReason && <div className="pr-decision-reason pr-decision-reason-returned"><div className="pr-info-label">Reason for Return</div><p>{returnReason}</p>{submission.returnedByName && <span>— {submission.returnedByName}</span>}</div>}
                          {stage === WORKFLOW_STATUS.REJECTED && submission.rejectionReason && <div className="pr-decision-reason pr-decision-reason-rejected"><div className="pr-info-label">Reason for Rejection</div><p>{submission.rejectionReason}</p></div>}
                          {submission.correctedBySubmission && <div className="pr-info-subvalue">Corrected by submission {submission.correctedBySubmission}.</div>}
                          {submission.indexedPhotos.length > 0 && (
                            <div className="pr-submission-photos">
                              {submission.indexedPhotos.map((photo) => {
                                const state = evidenceState(photo, submission);
                                return (
                                <div key={`${submission.id}-${photo.reportPhotoIndex}`} data-evidence-state={state}>
                                  <div className="pr-drawer-photo-wrap">
                                    <ProtectedEvidenceImage
                                      endpoint={`/evidence/planting-reports/${encodeURIComponent(selectedRecord.id)}/photos/${photo.reportPhotoIndex}`}
                                      alt={`Submission ${submission.id} planting evidence`}
                                      className="pr-drawer-photo"
                                    />
                                  </div>
                                  <div className="pr-photo-caption">Photo GPS: {photo.latitude ?? photo.metadata?.latitude ?? "—"}, {photo.longitude ?? photo.metadata?.longitude ?? "—"}</div>
                                  <span className={`pr-evidence-state pr-evidence-state-${state}`}>{EVIDENCE_STATE_LABEL[state]}</span>
                                </div>
                                );
                              })}
                            </div>
                          )}
                          {groupLead && submission.correctionRequest?.fields?.length > 0 && (
                            <div className="pr-correction-request" role="note" aria-label="Fields returned for correction">
                              <div className="pr-info-label">Fields returned for correction{submission.correctionRequest.requestedByName ? ` by ${submission.correctionRequest.requestedByName}` : ""}</div>
                              <ul>
                                {submission.correctionRequest.fields.map((field) => (
                                  <li key={field.path}><strong>{field.label}:</strong> {field.comment}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {groupLead && submission.evidenceCarriedFromSubmissionId && (
                            <div className="pr-submission-waiting" role="note">Verified evidence from the previous revision is carried forward unchanged.</div>
                          )}
                          {submission.finalReportGroupId && groupSize > 1 && (
                            <div className="pr-submission-waiting pr-final-group-note" role="note">
                              {groupLead
                                ? `Final report revision ${Number(submission.finalReportRevision || 0) + 1}: ${groupSize} seedling types are reviewed together. A decision here applies to all of them.`
                                : "Reviewed together with the first seedling type of this final report."}
                            </div>
                          )}
                          {actions.length > 0 && (
                            <div className="pr-drawer-verification-actions" role="group" aria-label={`Decision for submission ${submission.id}`}>
                              {actions.includes("forward") && <button type="button" className="pr-primary-button" onClick={() => openDecision(submission, "forward")} disabled={actionLoading}><FiSend size={14} />Forward to Admin</button>}
                              {actions.includes("approve") && <button type="button" className="pr-primary-button" onClick={() => openDecision(submission, "approve")} disabled={actionLoading}><FiCheckCircle size={14} />Approve</button>}
                              {actions.includes("return") && <button type="button" className="pr-warning-button" onClick={() => openDecision(submission, "return")} disabled={actionLoading}><FiRotateCcw size={14} />Return for Correction</button>}
                              {actions.includes("reject") && <button type="button" className="pr-danger-button" onClick={() => openDecision(submission, "reject")} disabled={actionLoading}><FiXCircle size={14} />Reject</button>}
                            </div>
                          )}
                          {waiting && canReview && <div className="pr-submission-waiting" role="status">{waiting}</div>}
                          {correctable && ownSubmission && submission.officialStaffReport && userRole === "staff" && (
                            <div className="pr-drawer-verification-actions"><button type="button" className="pr-secondary-button" onClick={() => { setOfficialForm({ correction: { ...submission, groupRows: finalReportGroupRows(submission, submissionsWithPhotoIndexes) } }); setShowViewModal(false); }}><FiRotateCcw size={14} />Correct Official Submission</button></div>
                          )}
                          {correctable && ownSubmission && !submission.officialStaffReport && isParticipant && (
                            <div className="pr-drawer-verification-actions"><button type="button" className="pr-primary-button" onClick={() => startCorrection(submission)}><FiRotateCcw size={14} />Correct and Resubmit</button></div>
                          )}
                          {submission.officialStaffReport && submission.confirmationBasis === "menro-field-report" && stage === WORKFLOW_STATUS.PENDING_ADMIN_APPROVAL && !submission.hasVerifiedPlantingEvidence && userRole === "staff" && submission.authenticatedSubmitterUid === currentUser?.uid && (
                            <div className="pr-drawer-verification-actions"><button type="button" className="pr-secondary-button" onClick={() => { setOfficialForm({ resumeEvidence: { ...submission, operationRows: (selectedRecord.submissions || []).filter(row => row.officialStaffReport && row.officialOperationId && row.officialOperationId === submission.officialOperationId) } }); setShowViewModal(false); }}>Add Verified Planting Evidence</button></div>
                          )}
                        </article>
                        );
                      })}
                    </div>
                  )}
                </section>

                {standaloneReview && (
                  <div className="pr-standalone-review">
                    <div className="pr-info-label">Review Status</div>
                    {renderWorkflowBadge(submissionWorkflowStatus(standaloneReview))}
                    {standaloneReview.returnReason && <div className="pr-decision-reason pr-decision-reason-returned"><div className="pr-info-label">Reason for Return</div><p>{standaloneReview.returnReason}</p></div>}
                    {standaloneActions.length > 0 && (
                      <div className="pr-drawer-verification-actions" role="group" aria-label="Decision for this planting report">
                        {standaloneActions.includes("forward") && <button type="button" className="pr-primary-button" onClick={() => openDecision(standaloneReview, "forward")} disabled={actionLoading}><FiSend size={14} />Forward to Admin</button>}
                        {standaloneActions.includes("approve") && <button type="button" className="pr-primary-button" onClick={() => openDecision(standaloneReview, "approve")} disabled={actionLoading}><FiCheckCircle size={14} />Approve</button>}
                        {standaloneActions.includes("return") && <button type="button" className="pr-warning-button" onClick={() => openDecision(standaloneReview, "return")} disabled={actionLoading}><FiRotateCcw size={14} />Return for Correction</button>}
                        {standaloneActions.includes("reject") && <button type="button" className="pr-danger-button" onClick={() => openDecision(standaloneReview, "reject")} disabled={actionLoading}><FiXCircle size={14} />Reject</button>}
                      </div>
                    )}
                    {standaloneWaiting && canReview && <div className="pr-submission-waiting" role="status">{standaloneWaiting}</div>}
                  </div>
                )}
              </section>

              {selectedRecord.reportType === "parent" && selectedRecord.eventId && (canReview || selectedRecord.participantId === currentUser?.uid) && (
                <EventAttendancePanel eventId={selectedRecord.eventId} canManageReservations={canReview}
                  onReservationReleased={() => refreshSelectedRecord(selectedRecord.id)} />
              )}

              <section className="pr-drawer-section pr-drawer-section-last">
                <div className="pr-drawer-section-title">
                  <FiClock size={15} />
                  Submission History
                </div>

                {canReview && verificationLogs.reportId === selectedRecord.id && verificationLogs.status === "ready" && verificationLogs.entries.length > 0 ? (
                  <ol className="pr-history" aria-label="Submission and decision history">
                    <li className="pr-history-item">
                      <div className="pr-history-marker"><FiCheck size={13} /></div>
                      <div className="pr-history-content">
                        <div className="pr-history-title">Report Created</div>
                        <div className="pr-history-meta">{formatDateTime(selectedRecord.createdAt)}</div>
                      </div>
                    </li>
                    {verificationLogs.entries.map((entry) => (
                      <li className="pr-history-item" key={entry.id}>
                        <div className={`pr-history-marker${entry.tone === "rejected" ? " is-rejected" : entry.tone === "returned" ? " is-returned" : ""}`}>
                          {entry.tone === "rejected" ? <FiX size={13} /> : entry.tone === "returned" ? <FiRotateCcw size={13} /> : <FiCheck size={13} />}
                        </div>
                        <div className="pr-history-content">
                          <div className="pr-history-title">{entry.action}</div>
                          <div className="pr-history-meta">
                            {formatDateTime(entry.createdAt)}
                            {entry.by ? ` by ${entry.by}` : ""}
                            {entry.role ? ` (${entry.role.charAt(0).toUpperCase()}${entry.role.slice(1)})` : ""}
                            {entry.from && entry.to ? ` • ${entry.from} → ${entry.to}` : entry.to ? ` • ${entry.to}` : ""}
                            {entry.submissionId ? ` • Submission ${entry.submissionId}` : ""}
                          </div>
                          {entry.remarks && <div className="pr-history-remarks">{entry.remarks}</div>}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="pr-history">
                    {canReview && verificationLogs.reportId === selectedRecord.id && verificationLogs.status === "error" && (
                      <div className="pr-history-unavailable" role="status">The decision history could not be loaded. Submission statuses and reasons above remain current.</div>
                    )}
                    {reportHistory(selectedRecord)
                      .filter((item) => ["opened", "submitted", "awaiting"].includes(item.kind))
                      .map((item, index) => (
                        <div className="pr-history-item" key={`base-${item.kind}-${item.submissionId || "report"}-${index}`}>
                          <div className="pr-history-marker">{item.kind === "submitted" ? <FiCheck size={13} /> : <FiClock size={13} />}</div>
                          <div className="pr-history-content">
                            <div className="pr-history-title">{item.title}</div>
                            <div className="pr-history-meta">
                              {item.at ? formatDateTime(item.at) : "Pending"}
                              {item.by ? ` by ${item.by}` : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                    {submissionsWithPhotoIndexes.map((submission) => {
                      const stage = submissionWorkflowStatus(submission);
                      if ([WORKFLOW_STATUS.PENDING_REVIEW, WORKFLOW_STATUS.PENDING_ADMIN_APPROVAL].includes(stage)) return null;
                      const when = stage === WORKFLOW_STATUS.REVIEWED ? submission.staffReviewedAt : submission.adminDecisionAt || submission.returnedAt || submission.reviewedAt;
                      return (
                        <div className="pr-history-item" key={`history-${submission.id}`}>
                          <div className={`pr-history-marker${stage === WORKFLOW_STATUS.REJECTED ? " is-rejected" : stage === WORKFLOW_STATUS.RETURNED ? " is-returned" : ""}`}>{stage === WORKFLOW_STATUS.REJECTED ? <FiX size={13} /> : stage === WORKFLOW_STATUS.RETURNED ? <FiRotateCcw size={13} /> : <FiCheck size={13} />}</div>
                          <div className="pr-history-content">
                            <div className="pr-history-title">{stage}</div>
                            <div className="pr-history-meta">{formatDateTime(when)} • Submission {submission.id}</div>
                          </div>
                        </div>
                      );
                    })}
                    {!submissionsWithPhotoIndexes.length && selectedRecord.approvedAt && (
                      <div className="pr-history-item">
                        <div className="pr-history-marker"><FiCheck size={13} /></div>
                        <div className="pr-history-content">
                          <div className="pr-history-title">Approved</div>
                          <div className="pr-history-meta">{formatDateTime(selectedRecord.approvedAt)}</div>
                        </div>
                      </div>
                    )}
                    {!submissionsWithPhotoIndexes.length && selectedRecord.rejectedAt && (
                      <div className="pr-history-item">
                        <div className="pr-history-marker is-rejected"><FiX size={13} /></div>
                        <div className="pr-history-content">
                          <div className="pr-history-title">Rejected</div>
                          <div className="pr-history-meta">{formatDateTime(selectedRecord.rejectedAt)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}
      {cameraOpen && <ModalDialog label="Secure planting camera" onClose={() => setCameraOpen(false)}><SecureCameraCapture
        open={cameraOpen}
        request={apiRequest}
        binding={cameraBinding}
        onVerified={result => handleVerifiedCameraCapture(result, cameraEpoch)}
        onDiagnostic={handleCameraDiagnostic}
        onViewLocation={() => setCameraOpen(false)}
        onCancel={() => setCameraOpen(false)}
      /></ModalDialog>}
      {activeDecision && selectedRecord && selectedSubmission && (
        <div className="pr-overlay pr-decision-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDecision();
        }}>
          <div
            className={`pr-modal-small pr-decision-modal pr-decision-modal-${activeDecision.tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pr-decision-title"
            aria-describedby="pr-decision-subtitle"
            aria-busy={actionLoading ? "true" : undefined}
            onKeyDown={(event) => { if (event.key === "Escape") closeDecision(); }}
          >
            <div className="pr-modal-header">
              <div>
                <h2 className="pr-modal-title" id="pr-decision-title">{activeDecision.title}</h2>
                <p className="pr-modal-subtitle" id="pr-decision-subtitle">{activeDecision.subtitle}</p>
              </div>
              <button type="button" className="pr-close-button" onClick={closeDecision} disabled={actionLoading} aria-label="Close decision"><FiX size={17} /></button>
            </div>
            <div className="menro-toast-anchor" data-menro-toast-anchor />
            <form
              className="pr-modal-body pr-decision-body"
              noValidate
              onSubmit={(event) => { event.preventDefault(); submitDecision(); }}
            >
              <div className="pr-decision-summary">
                <span>Submission</span>
                <strong>{selectedSubmission.id}</strong>
                {renderWorkflowBadge(submissionWorkflowStatus(selectedSubmission))}
              </div>
              {decisionError && <div className="pr-decision-alert" role="alert">{decisionError}</div>}
              <label className="pr-label" htmlFor="pr-decision-reason">
                {activeDecision.reasonLabel} {activeDecision.reasonRequired ? <span className="pr-required">*</span> : <span className="pr-optional">(optional)</span>}
              </label>
              <textarea
                id="pr-decision-reason"
                ref={decisionReasonRef}
                className="pr-textarea"
                value={verificationRemarks}
                maxLength={MAX_DECISION_REASON_LENGTH}
                required={activeDecision.reasonRequired}
                aria-required={activeDecision.reasonRequired ? "true" : undefined}
                aria-invalid={decisionFieldError ? "true" : undefined}
                aria-describedby={`pr-decision-count${decisionFieldError ? " planting-decision-error" : ""}`}
                disabled={actionLoading}
                placeholder={activeDecision.placeholder}
                onChange={(event) => {
                  setVerificationRemarks(event.target.value);
                  if (decisionFieldError) setDecisionFieldError(decisionReasonError(decision, event.target.value));
                }}
              />
              <div className="pr-decision-field-meta">
                {decisionFieldError
                  ? <small id="planting-decision-error" className="pr-field-error" role="alert">{decisionFieldError}</small>
                  : <span />}
                <small id="pr-decision-count" className="pr-decision-count">{decisionReasonLength}/{MAX_DECISION_REASON_LENGTH}</small>
              </div>
              {fieldReturnFor(selectedSubmission).length > 0 && (
                <fieldset className="pr-correction-fields" aria-describedby="pr-correction-fields-help">
                  <legend className="pr-label">Fields that need correction <span className="pr-required">*</span></legend>
                  <p id="pr-correction-fields-help" className="pr-helper-text">
                    Only the selected fields will be editable by the Staff submitter. Selecting an evidence-related field requires the evidence to be verified again; otherwise verified evidence is kept.
                  </p>
                  {correctionErrors.fields && <small className="pr-field-error" role="alert">{correctionErrors.fields}</small>}
                  {fieldReturnFor(selectedSubmission).map((field) => {
                    const id = `pr-correction-${field.path.replace(/[^A-Za-z0-9_-]/g, "-")}`;
                    const checked = Object.hasOwn(correctionSelections, field.path);
                    const commentError = correctionErrors[`fieldComment-${field.path}`];
                    return (
                      <div className="pr-correction-field" key={field.path} data-field-path={field.path}>
                        <label className="pr-correction-field-toggle" htmlFor={id}>
                          <input id={id} type="checkbox" checked={checked} disabled={actionLoading}
                            onChange={(event) => toggleCorrectionField(field.path, event.target.checked)} />
                          <span><strong>{field.label}</strong>{field.evidence ? " (evidence)" : ""}<small className="pr-correction-field-value">Submitted: {field.value}</small></span>
                        </label>
                        {checked && (
                          <>
                            <label className="pr-sr-only" htmlFor={`${id}-comment`}>Comment for {field.label}</label>
                            <textarea id={`${id}-comment`} className="pr-textarea pr-correction-comment" rows={2} maxLength={MAX_CORRECTION_COMMENT_LENGTH}
                              value={correctionSelections[field.path]} aria-required="true" aria-invalid={commentError ? "true" : undefined}
                              placeholder="What needs to be corrected?" disabled={actionLoading}
                              onChange={(event) => { const value = event.target.value; setCorrectionSelections((current) => ({ ...current, [field.path]: value })); setCorrectionErrors((current) => ({ ...current, [`fieldComment-${field.path}`]: "" })); }} />
                            {commentError && <small className="pr-field-error" role="alert">{commentError}</small>}
                          </>
                        )}
                      </div>
                    );
                  })}
                </fieldset>
              )}
              <div className="pr-modal-footer pr-decision-footer">
                <button type="button" className="pr-secondary-button" onClick={closeDecision} disabled={actionLoading}>Cancel</button>
                <button
                  type="submit"
                  className={activeDecision.tone === "danger" ? "pr-danger-button" : activeDecision.tone === "warning" ? "pr-warning-button" : "pr-primary-button"}
                  disabled={actionLoading}
                  aria-disabled={actionLoading ? "true" : undefined}
                >
                  {actionLoading ? activeDecision.busy : activeDecision.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
