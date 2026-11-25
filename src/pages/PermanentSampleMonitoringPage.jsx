import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authenticatedFetch } from "../services/authenticatedApi";
import SecureCameraCapture from "../components/SecureCameraCapture";
import ModalDialog from "../components/ModalDialog";
import PermanentSampleVisitForm, { PermanentSampleVisitShell } from "../components/PermanentSampleVisitForm";
import { assessmentErrors, keepUnsavedEdits } from "../utils/sampleMonitoringForm";
import { withDeadline, RequestTimeoutError, READ_TIMEOUT_MS, WRITE_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from "../utils/requestTimeout";
import "../styles/permanent-sample-monitoring-form.css";
import MonitoringInformationPanel from "../components/MonitoringInformationPanel";
import { informationEnabled } from "../utils/permanentSampleFeatures";
import {
  resolveVerifiedPlantingCohortEnabled,
  visibleCohortMessage,
} from "../utils/verifiedPlantingCohort";
import { useAuth } from "../context/AuthContext";
import { Trees, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { approvedVisitNote, readinessErrorMessage, readinessGateNotices, readinessMessages, readinessTitle, scheduleStatusLabel, withoutEligibleDuplicates } from "../utils/sampleVisitReadiness";
import { PICKER_GROUP, withPickerReadiness } from "../utils/monitoringTracking";
import { loadReadiness, mergeReadiness, readinessPath, withoutEligibleCohort } from "../utils/sampleReadinessLoader";
import { monitoringApiErrorMessage, monitoringErrorSampleId, monitoringEvidenceErrorMessage, monitoringWriteErrorMessage } from "../utils/monitoringApiError";

const STATUS_LABELS = { DRAFT: "Draft", RETURNED: "Returned for Correction", PENDING_ADMIN_APPROVAL: "Pending Admin Review", APPROVED: "Approved" };
const statusLabel = value => STATUS_LABELS[value] || value;


async function api(path, options = {}) {
  const write = options.method && options.method !== "GET";
  return withDeadline((async () => {
    const response = await authenticatedFetch(path, options);
    const body = await response.json().catch(() => ({}));
    // Gate-disabled and missing-index responses get plain text; raw Firebase errors and links are never shown.
    if (!response.ok || !body.success) throw Object.assign(new Error(monitoringApiErrorMessage(body)), { status: response.status, code: body.code, missingSampleIds: body.missingSampleIds, sampleId: body.sampleId });
    return body.data;
  })(), write ? WRITE_TIMEOUT_MS : READ_TIMEOUT_MS, () => new RequestTimeoutError(write ? "MENRO has not confirmed this save. Check the saved outcome before trying again." : "Monitoring data could not be loaded in time. Please retry.", { ambiguous: Boolean(write) }));
}

// One selectable row per planting report, even if two eligible cohorts name the same report.
const uniqueByReport = rows => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter(row => {
    const reportId = String(row?.context?.plantingReportId || "");
    if (!reportId) return true;
    return seen.has(reportId) ? false : Boolean(seen.add(reportId));
  });
};
const fetchReadinessPage = cursor => api(readinessPath(cursor));

function formAssessment(value) {
  return {
    sampleId: value.sampleId,
    condition: value.condition || "",
    remarks: value.remarks || "",
    heightCentimeters: value.heightCentimeters ?? "",
    stemDiameterMillimeters: value.stemDiameterMillimeters ?? (value.diameterCentimeters == null ? "" : Number(value.diameterCentimeters) * 10),
    baselineReference: value.baselineReference || null,
    previousAssessmentReference: value.previousAssessmentReference || null,
    investigationOutcome: value.investigationOutcome || "",
    searchFindings: value.searchFindings || "",
    recheckReason: value.recheckReason || "",
    mortalityCause: value.mortalityCause || "",
    growthDelta: value.growthDelta || null,
    heightDifferenceCm: value.heightDifferenceCm ?? null,
    stemDiameterDifferenceMm: value.stemDiameterDifferenceMm ?? null,
    measurementDecreased: value.measurementDecreased === true,
    growthPerformance: value.growthPerformance || null,
    growthStage: value.growthStage || null,
    baselineOnly: value.baselineOnly === true,
    inheritedConfirmedDead: value.inheritedConfirmedDead || null,
  };
}


const draftSnapshot = (rows, remarks, date) => JSON.stringify([rows.map(row =>
  ["sampleId", "condition", "heightCentimeters", "stemDiameterMillimeters", "remarks", "mortalityCause", "recheckReason", "investigationOutcome", "searchFindings"]
    .map(field => String(row[field] ?? ""))), remarks, date]);

// `embedded`: rendered inside Survival Monitoring — the Staff "Monitor Planted Trees" modal, or (with
// `reviewVisitId`) the Admin "Review Monitoring Visit" read-only form opened from the Monitoring Records table.
// The same state, validation and API handlers serve both the embedded modal and the standalone route.
// `setupPendingReports` (Staff, embedded): read-only rows for verified planting reports without a startable visit
// (Setup Pending or Not Eligible). They can be selected to view truthful readiness; nothing becomes editable.
export default function PermanentSampleMonitoringPage({ embedded = false, open: embeddedOpen = false, onClose, reviewVisitId = "", onReviewed, setupPendingReports = [] } = {}) {
  const enabled = resolveVerifiedPlantingCohortEnabled();
  const { userRole } = useAuth();
  const offeredPendingReports = userRole === "staff" && !reviewVisitId && Array.isArray(setupPendingReports) ? setupPendingReports : [];
  const [pendingReportId, setPendingReportId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(null);
  const [detail, setDetail] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTreeId, setActiveTreeId] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [visitRemarks, setVisitRemarks] = useState("");
  const [dateMonitored, setDateMonitored] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(null);
  const operationBusy = useRef(false);
  const [savedDraft, setSavedDraft] = useState("");
  const [questions, setQuestions] = useState({});
  const [originalReviews, setOriginalReviews] = useState({});
  const [reviewReasons, setReviewReasons] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [creatingCohortId, setCreatingCohortId] = useState("");
  const [readinessCohortId, setReadinessCohortId] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSampleId, setCameraSampleId] = useState("");
  const [pendingEvidence, setPendingEvidence] = useState({});
  const [evidenceUrls, setEvidenceUrls] = useState({});
  const [searchParams] = useSearchParams();
  // One-time arrival request from the Staff "Submit Monitoring Record" action (?start=1).
  const startRequested = useRef(!reviewVisitId && (embedded || searchParams.get("start") === "1"));
  const [selectPrompt, setSelectPrompt] = useState(false);
  const [readiness, setReadiness] = useState(null);
  // A report whose cohort is already eligible is listed once, as the eligible row (not again under Setup Pending).
  const pendingReports = withoutEligibleDuplicates(offeredPendingReports, readiness?.data?.eligible || []);
  const pickerRows = pendingReports.map(row => withPickerReadiness(row, readiness));
  const pendingReport = pickerRows.find(row => row.plantingReportId === pendingReportId) || null;
  const pendingNotEligible = pendingReport?.pickerGroup === PICKER_GROUP.NOT_ELIGIBLE;
  const unsaved = userRole === "staff" && ["DRAFT", "RETURNED"].includes(detail?.status) &&
    (Object.keys(pendingEvidence).length > 0 || Object.values(questions).some(value => value.trim()) ||
      savedDraft !== draftSnapshot(assessments, visitRemarks, dateMonitored));
  // Only the latest visit-list and readiness requests may update the page; older or unmounted answers are ignored.
  const listEpoch = useRef(0);
  const readinessEpoch = useRef(0);
  useEffect(() => () => { listEpoch.current += 1; readinessEpoch.current += 1; }, []);
  const uploadKeys = useRef({});
  const evidenceEpoch = useRef(0);
  const objectUrls = useRef(new Set());
  const captureEpoch = useRef(null);
  const resetEvidence = useCallback(() => {
    evidenceEpoch.current += 1;
    captureEpoch.current = null;
    objectUrls.current.forEach(url => URL.revokeObjectURL(url));
    objectUrls.current.clear();
    uploadKeys.current = {};
    setPendingEvidence({}); setEvidenceUrls({}); setOriginalReviews({});
    setCameraOpen(false); setCameraSampleId("");
    return evidenceEpoch.current;
  }, []);
  useEffect(() => () => {
    evidenceEpoch.current += 1;
    objectUrls.current.forEach(url => URL.revokeObjectURL(url));
    objectUrls.current.clear();
  }, []);
  const evidenceKey = (sampleId, index, sourceVisitId = detail?.id) => JSON.stringify([sourceVisitId, sampleId, index]);
  const pendingKey = sampleId => JSON.stringify([detail?.id, sampleId, detail?.version,
    detail?.sampleAssessments?.find(row => row.sampleId === sampleId)?.assessmentRevision || 0]);

  const showVisit = useCallback(async (visitId) => {
    const epoch = resetEvidence();
    setDetail(null);
    setLoading(true);
    setError("");
    try {
      const data = await api(
        `/verified-sample-monitoring/visits/${encodeURIComponent(visitId)}`
      );
      if (epoch !== evidenceEpoch.current) return;
      setDetail(data);
      setAssessments((data.sampleAssessments || []).map(formAssessment));
      setActiveTreeId(data.sampleAssessments?.[0]?.sampleId || "");
      const date = data.dateMonitored || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      setSavedDraft(draftSnapshot((data.sampleAssessments || []).map(formAssessment), data.visitRemarks || "", date));
      setQuestions({}); setVisitRemarks(data.visitRemarks || ""); setDateMonitored(date); setFieldErrors({}); setDialogOpen(true);
      setSavedNotice("");
    } catch (requestError) {
      if (epoch !== evidenceEpoch.current) return;
      setError(
        requestError.status === 404
          ? "This monitoring visit is unavailable."
          : requestError.message
      );
    } finally {
      setLoading(false);
    }
  }, [resetEvidence]);

  // `keep`: refresh in place; a failed refresh keeps the rows already shown.
  const refreshReadiness = useCallback(async ({ keep = false } = {}) => {
    readinessEpoch.current += 1;
    const epoch = readinessEpoch.current;
    if (!keep) setReadiness({ loading: true });
    try {
      const data = await loadReadiness(fetchReadinessPage);
      if (epoch === readinessEpoch.current) setReadiness({ data });
    } catch (requestError) {
      if (epoch === readinessEpoch.current) setReadiness(current => keep && current?.data ? { data: current.data } : { error: readinessErrorMessage(requestError) });
    }
  }, []);

  const load = useCallback(
    async (next = "") => {
      listEpoch.current += 1;
      const epoch = listEpoch.current;
      setLoading(true);
      setError("");
      if (!next) { readinessEpoch.current += 1; setReadiness(null); }
      try {
        const query = new URLSearchParams();
        if (status) query.set("status", status);
        if (next) query.set("cursor", next);
        const data = await api(`/verified-sample-monitoring/visits?${query}`);
        if (epoch !== listEpoch.current) return;
        setPage({ ...data, firstPage: !next });
        // Eligible reports are offered with or without listed visits, and never delay the visit list.
        if (!next) void refreshReadiness();
        resetEvidence();
        setDetail(null);
        setAssessments([]);
        // Arrival from the single Survival Monitoring action: open the visit directly only when the complete
        // authorized list has exactly one actionable visit (Staff: editable; Admin: awaiting review);
        // otherwise the user chooses from the list.
        if (startRequested.current && !next) {
          startRequested.current = false;
          const actionable = (data.visits || []).filter(visit => userRole === "admin"
            ? visit.status === "PENDING_ADMIN_APPROVAL"
            : ["DRAFT", "RETURNED"].includes(visit.status));
          if (["staff", "admin"].includes(userRole) && actionable.length === 1 && !data.nextCursor) await showVisit(actionable[0].id);
          else setSelectPrompt(true);
        }
      } catch (requestError) {
        if (epoch !== listEpoch.current) return;
        if (!next) setReadiness({ error: readinessErrorMessage(requestError) });
        setError(
          requestError.status === 401
            ? "Sign in is required."
            : requestError.status === 403
              ? "You are not authorized to view monitoring visits."
              : requestError.message
        );
      } finally {
        if (epoch === listEpoch.current) setLoading(false);
      }
    },
    [status, resetEvidence, showVisit, refreshReadiness, userRole]
  );

  useEffect(() => {
    if (!enabled || !["staff", "admin"].includes(userRole)) return undefined;
    // Admin opened one visit from the Monitoring Records table: load only that visit, no picker.
    const timer = window.setTimeout(() => (reviewVisitId ? showVisit(reviewVisitId) : load()), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, load, userRole, reviewVisitId, showVisit]);

  const allowDiscard = () => {
    if (!unsaved || window.confirm("This visit has unsaved assessments, photos or questions. Discard those changes?")) return true;
    setError("Save your draft, upload pending photos or send your question before changing visits. Your entries have been kept.");
    setDialogOpen(true);
    return false;
  };

  const open = async (visitId, refresh = false) => {
    if (operationBusy.current) return;
    if (unconfirmed) { if (detail?.id === visitId) { setDialogOpen(true); return; } setError("Check the saved outcome before switching visits."); return; }
    if (!refresh && detail?.id === visitId) { setDialogOpen(true); return; }
    if (!allowDiscard()) return;
    setPendingReportId(""); setReadinessCohortId("");
    await showVisit(visitId);
  };

  // Selecting a verified report (pending or eligible) leaves any open visit after the usual unsaved-changes check.
  // A pending report shows its read-only readiness; an eligible one shows its Start Visit. Selecting never creates
  // a visit and never enables editing.
  const leaveVisit = () => {
    if (operationBusy.current) return false;
    if (unconfirmed) { setError("Check the saved outcome before switching visits."); return false; }
    if (detail) {
      if (!allowDiscard()) return false;
      resetEvidence(); setDetail(null); setAssessments([]);
    }
    setError("");
    return true;
  };
  const choosePendingReport = reportId => { if (leaveVisit()) { setReadinessCohortId(""); setPendingReportId(reportId); } };
  const chooseEligible = cohortId => { if (leaveVisit()) { setPendingReportId(""); setReadinessCohortId(cohortId); } };
  const pendingOptions = rows => [PICKER_GROUP.SETUP_PENDING, PICKER_GROUP.NOT_ELIGIBLE].map(group => {
    const listed = rows.filter(row => (row.pickerGroup || PICKER_GROUP.SETUP_PENDING) === group);
    return listed.length > 0 && <optgroup key={group} label={group}>
      {listed.map(row => <option key={row.plantingReportId} value={`pending:${row.plantingReportId}`}>
        {`${row.reportNumber || "Verified planting report"} · ${row.siteName || "Planting site"} · ${group === PICKER_GROUP.NOT_ELIGIBLE ? row.requirement : row.stage || row.status}`}</option>)}
    </optgroup>;
  });
  // With a visit open, a report whose visits are listed is represented by those visits, not again as a pending row.
  const listedVisitCohorts = new Set((page?.visits || []).map(visit => String(visit.cohortId || "")).filter(Boolean));
  const pendingBesideVisits = pickerRows.filter(row => !listedVisitCohorts.has(String(row.cohort?.id || "")));

  const updateAssessment = (sampleId, field, value) => {
    const resolved = field === "condition" && value !== "Needs Rechecking";
    const row = assessments.find(item => item.sampleId === sampleId);
    const remarksError = resolved && row ? assessmentErrors([{ ...row, condition: value, investigationOutcome: "", searchFindings: "" }])[`${sampleId}.remarks`] : "";
    setFieldErrors(current => ({ ...current, [`${sampleId}.${field}`]: "", ...(resolved ? {
      [`${sampleId}.remarks`]: remarksError || "", [`${sampleId}.recheckReason`]: "", [`${sampleId}.searchFindings`]: "",
      [`${sampleId}.mortalityCause`]: "",
    } : {}) }));
    setAssessments((current) =>
      current.map((assessment) => {
        if (assessment.sampleId !== sampleId) return assessment;
        const next = { ...assessment, [field]: value };
        if (field === "condition" && value !== "Needs Rechecking") {
          next.investigationOutcome = "";
          next.searchFindings = "";
          next.recheckReason = "";
        }
        if (field === "condition" && value !== "Dead") next.mortalityCause = "";
        if (field === "condition" && ["Dead", "Needs Rechecking"].includes(value)) {
          next.heightCentimeters = "";
          next.stemDiameterMillimeters = "";
        }
        return next;
      })
    );
  };

  const save = async (submit = false, savedSampleId = "") => {
    if (!detail || operationBusy.current || unconfirmed) return;
    const rowsToValidate = savedSampleId ? assessments.filter(row => row.sampleId === savedSampleId) : assessments;
    const invalid = assessmentErrors(rowsToValidate, submit || Boolean(savedSampleId));
    if (Object.keys(invalid).length) {
      setFieldErrors(invalid); const first = Object.keys(invalid)[0]; setActiveTreeId(first.split(".")[0]); setError("Please correct the highlighted assessment fields.");
      window.setTimeout(() => { const field = document.querySelector(`[data-validation-field="${CSS.escape(first)}"]`); field?.scrollIntoView({ behavior: "smooth", block: "center" }); field?.querySelector("input:not(:disabled),select:not(:disabled),textarea:not(:disabled)")?.focus({ preventScroll: true }); }, 0); return;
    }
    if (Object.keys(pendingEvidence).length) { setError("Upload or remove pending photos before saving. A save changes the version used for capture verification."); return; }
    const unsentQuestion = submit && Object.keys(questions).find(sampleId => questions[sampleId].trim());
    if (unsentQuestion) {
      setActiveTreeId(unsentQuestion);
      setError(`There is an unsent requester question for ${unsentQuestion}. Send or discard it before submitting the visit.`);
      window.setTimeout(() => {
        const field = document.querySelector("#sample-active-assessment .psm-rechecking form textarea, #sample-active-assessment [data-discard-question]");
        field?.scrollIntoView({ behavior: "smooth", block: "center" }); field?.focus({ preventScroll: true });
      }, 0);
      return;
    }
    if (!dateMonitored || dateMonitored > new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())) { setError("Date Monitored is required and cannot be in the future."); setFieldErrors(current => ({ ...current, dateMonitored: "Enter the actual assessment date, up to today." })); window.setTimeout(() => { const field = document.getElementById("sample-date-monitored"); field?.scrollIntoView({ behavior: "smooth", block: "center" }); field?.focus({ preventScroll: true }); }, 0); return; }
    // Save Tree Assessment sends only the active tree as edited; every other tree keeps its last server-saved values.
    const sent = savedSampleId ? assessments.map(row => {
      if (row.sampleId === savedSampleId) return row;
      const saved = detail.sampleAssessments?.find(item => item.sampleId === row.sampleId);
      return saved ? formAssessment(saved) : row;
    }) : assessments;
    const payload = { expectedVersion: detail.version, assessments: sent, submit, visitRemarks, dateMonitored };
    operationBusy.current = true; setSaving(true); setError("");
    try {
      const data = await api(`/verified-sample-monitoring/visits/${detail.id}`, { method: "PUT", body: JSON.stringify(payload) });
      setSavedDraft(draftSnapshot(data.sampleAssessments.map(formAssessment), data.visitRemarks || "", data.dateMonitored || dateMonitored));
      resetEvidence(); setDetail(data); setVisitRemarks(data.visitRemarks || "");
      // Unsaved edits of the other trees stay in the form (and stay marked Unsaved).
      setAssessments(current => keepUnsavedEdits((data.sampleAssessments || []).map(formAssessment), current, savedSampleId));
      setPage(current => current ? { ...current, visits: current.visits.map(row => row.id === data.id ? { ...row, status: data.status, version: data.version } : row) } : current);
      setSavedNotice(submit ? "Monitoring visit submitted for Admin review."
        : savedSampleId ? `${savedSampleId} assessment saved and confirmed by MENRO.` : "Monitoring visit draft saved and confirmed by MENRO.");
    } catch (requestError) {
      if (requestError.ambiguous) setUnconfirmed({ visitId: detail.id, savedSampleId, ...payload });
      setError(monitoringWriteErrorMessage(requestError, "This monitoring visit changed. Reload the current authorized visit before trying again."));
      const target = monitoringErrorSampleId(requestError);
      if (target && assessments.some(row => row.sampleId === target)) {
        setActiveTreeId(target);
        window.setTimeout(() => { const button = [...document.querySelectorAll(".psm-tree-list button")].find(item => item.querySelector("strong")?.textContent === target); button?.scrollIntoView({ behavior: "smooth", block: "center" }); button?.focus({ preventScroll: true }); }, 0);
      }
    } finally { operationBusy.current = false; setSaving(false); }
  };

  // Continues after the last loaded readiness page. A failure keeps every loaded report and can be retried.
  const loadMoreReadiness = async () => {
    const cursor = readiness?.data?.nextCursor;
    if (!cursor || readiness.more === "loading") return;
    readinessEpoch.current += 1;
    const epoch = readinessEpoch.current;
    setReadiness(current => ({ ...current, more: "loading" }));
    try {
      const next = await loadReadiness(fetchReadinessPage, { cursor });
      if (epoch === readinessEpoch.current) setReadiness(current => ({ data: mergeReadiness(current.data, next) }));
    } catch { if (epoch === readinessEpoch.current) setReadiness(current => ({ ...current, more: "error" })); }
  };

  const createVisit = async (cohort) => {
    if (!cohort?.cohortId || cohort.canCreateVisit !== true || !cohort.nextScheduledDueDate || operationBusy.current) return;
    operationBusy.current = true; setCreatingCohortId(cohort.cohortId); setError(""); setSavedNotice("");
    try {
      const created = await api(`/verified-sample-monitoring/cohorts/${encodeURIComponent(cohort.cohortId)}/visits`, {
        method: "POST",
        body: JSON.stringify({ visitDate: cohort.nextScheduledDueDate }),
      });
      setPage(current => current ? { ...current, visits: [{ ...created, progress: { completed: 0, total: created.sampleAssessments?.length || 0, rechecking: 0 } }, ...(current.visits || [])] } : current);
      // The started cohort stops being selectable at once; the refreshed answer then states its open visit.
      setReadiness(current => current?.data ? { ...current, data: withoutEligibleCohort(current.data, cohort.cohortId) } : current);
      void refreshReadiness({ keep: true });
      await showVisit(created.id);
      setSavedNotice(created.visitNumber ? `Visit ${created.visitNumber} opened from the authorized MENRO schedule.` : "Monitoring visit opened from the authorized MENRO schedule.");
    } catch (requestError) {
      setError(requestError.message || "The authorized monitoring visit could not be opened.");
      await refreshReadiness({ keep: true });
    } finally {
      operationBusy.current = false; setCreatingCohortId("");
    }
  };
  const reconcile = async () => {
    if (!unconfirmed || operationBusy.current) return;
    operationBusy.current = true; setSaving(true);
    try {
      const data = await api(`/verified-sample-monitoring/visits/${encodeURIComponent(unconfirmed.visitId)}`);
      if (unconfirmed.review !== undefined) {
        if (data.status !== (unconfirmed.review ? "APPROVED" : "RETURNED") || !unconfirmed.review && data.reviewReasons !== unconfirmed.reasons) { setError("The review outcome is not confirmed. Check again before another decision."); return; }
        setSavedDraft(draftSnapshot(data.sampleAssessments.map(formAssessment), data.visitRemarks || "", data.dateMonitored || dateMonitored));
      resetEvidence(); setDetail(data); setAssessments(data.sampleAssessments.map(formAssessment)); setVisitRemarks(data.visitRemarks || ""); setDateMonitored(data.dateMonitored || dateMonitored); setUnconfirmed(null); setError("");
      // A confirmed (previously timed-out) decision refreshes the Admin Monitoring Records table too.
      onReviewed?.(data); return;
      }
      const equivalent = (left, right) => ["sampleId", "condition", "remarks", "mortalityCause", "recheckReason", "investigationOutcome", "searchFindings"].every(key => String(left[key] || "").trim() === String(right[key] || "").trim()) && ["heightCentimeters", "stemDiameterMillimeters"].every(key => (left[key] === "" || left[key] == null ? null : Number(left[key])) === (right[key] === "" || right[key] == null ? null : Number(right[key])));
      const matches = data.version > unconfirmed.expectedVersion && data.status === (unconfirmed.submit ? "PENDING_ADMIN_APPROVAL" : "DRAFT") && data.sampleAssessments.length === unconfirmed.assessments.length && unconfirmed.assessments.every(row => data.sampleAssessments.some(saved => equivalent(row, saved))) && String(data.visitRemarks || "") === unconfirmed.visitRemarks.trim() && data.dateMonitored === unconfirmed.dateMonitored;
      if (!matches) { setError("The saved outcome is not confirmed. Keep these entries and check again before retrying."); return; }
      setSavedDraft(draftSnapshot(data.sampleAssessments.map(formAssessment), data.visitRemarks || "", data.dateMonitored || dateMonitored));
      // M3: a reconciled Save Tree Assessment confirms only the active tree (and the version); other trees keep
      // their local unsaved edits, exactly as after a directly confirmed save.
      resetEvidence(); setDetail(data); setAssessments(current => keepUnsavedEdits(data.sampleAssessments.map(formAssessment), current, unconfirmed.savedSampleId)); setVisitRemarks(data.visitRemarks || ""); setDateMonitored(data.dateMonitored || dateMonitored); setUnconfirmed(null); setError("");
    } catch (failure) { setError(failure.message); }
    finally { operationBusy.current = false; setSaving(false); }
  };

  const cameraBinding = useMemo(() => {
    const assessment = detail?.sampleAssessments?.find(
      (item) => item.sampleId === cameraSampleId
    );
    return {
      workflow: "sample-monitoring",
      cohortId: detail?.cohortId || "",
      siteId: detail?.siteId || "",
      visitId: detail?.id || "",
      sampleId: cameraSampleId,
      samplingPlanVersion: detail?.samplingPlanVersion ?? 0,
      baselineVersion: detail?.baselineVersion ?? 0,
      visitVersion: detail?.version ?? 0,
      assessmentRevision: Number(assessment?.assessmentRevision || 0),
    };
  }, [cameraSampleId, detail]);

  const cameraRequest = async (path, options) => ({ data: await api(path, options) });

  const attachEvidence = ({ file, descriptor, location }) => {
    if (!cameraSampleId || captureEpoch.current !== evidenceEpoch.current) return;
    const previousUrl = pendingEvidence[pendingKey(cameraSampleId)]?.previewUrl;
    if (previousUrl) { URL.revokeObjectURL(previousUrl); objectUrls.current.delete(previousUrl); }
    const previewUrl = URL.createObjectURL(file);
    objectUrls.current.add(previewUrl);
    setPendingEvidence((current) => ({
      ...current,
      [pendingKey(cameraSampleId)]: { file, descriptor, previewUrl, location },
    }));
    setFieldErrors(current => ({ ...current, [cameraSampleId + ".evidence"]: "" }));
    setCameraOpen(false);
    setCameraSampleId("");
  };

  const originalsEnabled = import.meta.env.VITE_SAMPLE_MONITORING_FORM_ACCEPTANCE === "true" &&
    import.meta.env.VITE_MONITORING_ORIGINAL_PHOTO_PROPOSAL === "true" && detail?.originalPhotoProposal?.linkingEnabled === true;
  const chooseOriginal = (sampleId, file) => {
    if (!file || !originalsEnabled || operationBusy.current) return;
    if (file.size > 10 * 1024 * 1024) {
      setFieldErrors(current => ({ ...current, [sampleId + ".evidence"]: "Choose a photo no larger than 10 MB." })); return;
    }
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      setFieldErrors(current => ({ ...current, [sampleId + ".evidence"]: "Use a JPG/JPEG, PNG or WEBP photo." })); return;
    }
    if (savedDraft !== draftSnapshot(assessments, visitRemarks, dateMonitored) || !detail.dateMonitored) {
      setFieldErrors(current => ({...current,[sampleId+".evidence"]:"Save the actual monitoring date and assessment draft before selecting an original photo."})); return;
    }
    const contextKey = pendingKey(sampleId), previous = pendingEvidence[contextKey];
    if (previous?.previewUrl) { URL.revokeObjectURL(previous.previewUrl); objectUrls.current.delete(previous.previewUrl); }
    const previewUrl=URL.createObjectURL(file); objectUrls.current.add(previewUrl);
    setPendingEvidence(current=>({...current,[contextKey]:{file,previewUrl,selectionId:crypto.randomUUID(),descriptor:{source:"uploaded-original"}}}));
    setFieldErrors(current=>({...current,[sampleId+".evidence"]:""}));
  };

  const uploadEvidence = async (sampleId) => {
    const contextKey = pendingKey(sampleId);
    const pending = pendingEvidence[contextKey];
    const assessment = detail?.sampleAssessments?.find((item) => item.sampleId === sampleId);
    if (!pending || !detail || !assessment || operationBusy.current || unconfirmed) return;
    operationBusy.current = true;
    const epoch = evidenceEpoch.current;
    const attemptKey = `${contextKey}:${pending.selectionId || pending.descriptor.captureSessionId}`;
    const key = uploadKeys.current[attemptKey] || crypto.randomUUID();
    uploadKeys.current[attemptKey] = key;
    setSaving(true);
    setError("");
    try {
      let descriptor = pending.descriptor;
      if (descriptor.source === "uploaded-original" && !descriptor.originalVerificationId) {
        const verifyForm = new FormData(); verifyForm.set("photos",pending.file); verifyForm.set("source","uploaded-original");
        verifyForm.set("expectedVisitVersion",String(detail.version)); verifyForm.set("assessmentRevision",String(assessment.assessmentRevision || 0));
        const proof=await api(`/verified-sample-monitoring/visits/${encodeURIComponent(detail.id)}/samples/${encodeURIComponent(sampleId)}/original-photo/verify`,{method:"POST",body:verifyForm,headers:{"Idempotency-Key":key}});
        descriptor={source:"uploaded-original",originalVerificationId:proof.originalVerificationId};
        setPendingEvidence(current=>({...current,[contextKey]:{...current[contextKey],descriptor,location:proof.location,verification:proof}}));
      }
      const form = new FormData();
      form.append("photos", pending.file);
      form.append("assessmentRevision", String(assessment.assessmentRevision || 0));
      form.append("expectedVisitVersion", String(detail.version));
      form.append("evidenceManifest", JSON.stringify([descriptor]));
      const { response, payload } = await withDeadline((async () => {
        const response = await authenticatedFetch(`/verified-sample-monitoring/visits/${encodeURIComponent(detail.id)}/samples/${encodeURIComponent(sampleId)}/evidence`, { method: "PUT", body: form, headers: { "Idempotency-Key": key } });
        return { response, payload: await response.json().catch(() => ({})) };
      })(), UPLOAD_TIMEOUT_MS, () => new RequestTimeoutError("Photo upload was not confirmed. Retry this same photo to check its saved outcome.", { ambiguous: true }));
      if (epoch !== evidenceEpoch.current) return;
      if (!response.ok || !payload.success) {
        throw Object.assign(new Error(monitoringEvidenceErrorMessage(payload)), {
          status: response.status, code:payload.code,
        });
      }
      uploadKeys.current[attemptKey] = "";
      setFieldErrors(current => ({ ...current, [sampleId + ".evidence"]: "" }));
      setPendingEvidence((current) => {
        const next = { ...current };
        delete next[contextKey];
        return next;
      });
      if (pending.previewUrl) { URL.revokeObjectURL(pending.previewUrl); objectUrls.current.delete(pending.previewUrl); }
      try { const fresh = await api(`/verified-sample-monitoring/visits/${encodeURIComponent(detail.id)}`); if (epoch === evidenceEpoch.current) setDetail(fresh); }
      catch { setError("Photo saved. Visit refresh failed; reload the visit to view its current evidence."); }
    } catch (requestError) {
      setError(monitoringWriteErrorMessage(requestError, "Evidence changed while uploading. Refresh the visit and retake the photo if required."));
      setFieldErrors(current => ({ ...current, [sampleId + ".evidence"]: requestError.message }));
    } finally { operationBusy.current = false; setSaving(false); }
  };

  const viewEvidence = async (sampleId, evidenceIndex, sourceVisitId = detail?.id) => {
    if (!detail) return;
    const epoch = evidenceEpoch.current;
    const key = evidenceKey(sampleId, evidenceIndex, sourceVisitId);
    if (evidenceUrls[key]) return;
    try {
      const response = await authenticatedFetch(
        sourceVisitId === "baseline" ? `/evidence/verified-planting-cohorts/${encodeURIComponent(detail.cohortId)}/baseline/${encodeURIComponent(sampleId)}/photos/${evidenceIndex}` : `/evidence/sample-monitoring/visits/${encodeURIComponent(sourceVisitId)}/samples/${encodeURIComponent(sampleId)}/evidence/${evidenceIndex}`
      );
      if (!response.ok) throw new Error("The private evidence photo is unavailable.");
      const blob = await response.blob();
      if (epoch !== evidenceEpoch.current) return;
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.current.add(objectUrl);
      setEvidenceUrls((current) => ({ ...current, [key]: objectUrl }));
    } catch (requestError) {
      setError(requestError.message || "The private evidence photo is unavailable.");
    }
  };

  const review = async (approve) => {
    if (!detail || userRole !== "admin" || operationBusy.current || unconfirmed) return;
    if (!approve && !reviewReasons.trim()) {
      setError("A return reason is required before sending the visit for correction.");
      return;
    }
    operationBusy.current = true; setReviewing(true);
    setError("");
    try {
      const data = await api(
        `/verified-sample-monitoring/visits/${encodeURIComponent(detail.id)}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            expectedVersion: detail.version,
            approve,
            reasons: reviewReasons.trim(),
            ...(approve && detail.originalEvidenceReviewRequirements?.length ? {originalEvidenceReviews:detail.originalEvidenceReviewRequirements.filter(item=>originalReviews[item.evidenceId])} : {}),
          }),
        }
      );
      setDetail(data);
      setAssessments((data.sampleAssessments || []).map(formAssessment));
      setReviewReasons("");
      onReviewed?.(data);
    } catch (requestError) {
      if (requestError.ambiguous) setUnconfirmed({ visitId: detail.id, review: approve, reasons: reviewReasons.trim() });
      setError(
        requestError.status === 409 && !requestError.code?.startsWith("ORIGINAL_")
          ? "This monitoring visit changed. Reload the current authorized visit before reviewing it."
          : requestError.message
      );
    } finally {
      operationBusy.current = false; setReviewing(false);
    }
  };

  // Staff record visits ("Monitor Planted Trees"); Admin only reviews them.
  const formTitle = userRole === "admin" ? "Review Monitoring Visit" : "Monitor Planted Trees";
  const modalHeader = badge => <header className="psm-header"><div className="psm-header-main"><span className="psm-header-icon"><Trees size={22} aria-hidden="true" /></span><div><h2>{formTitle}</h2><p>{userRole === "admin" ? "Review Staff-recorded sample tree assessments and evidence." : "Monitor registered sample trees and document their current survival conditions."}</p></div></div>
    <div className="psm-header-actions">{badge && <span className="psm-status-badge">{badge}</span>}<button type="button" className="psm-close" data-modal-close="" disabled={saving || reviewing} aria-label="Close monitoring visit"><X size={18} aria-hidden="true" /></button></div></header>;
  if (!enabled && embedded) {
    // Never fall back to the legacy aggregate form: state why the permanent-sample form is unavailable.
    return <ModalDialog open={embeddedOpen} label={formTitle} className="psm-dialog" onClose={() => onClose?.()}>
      {modalHeader("")}
      <div className="psm-body"><p role="status">Permanent sample tree monitoring is not enabled in this environment.</p></div>
      <footer className="psm-footer" />
    </ModalDialog>;
  }
  if (!enabled) {
    return (
      <main>
        <h1>Permanent Sample Monitoring</h1>
        <p role="status">{visibleCohortMessage(false)}</p>
      </main>
    );
  }
  if (!["staff", "admin"].includes(userRole)) {
    return (
      <main>
        <h1>Permanent Sample Monitoring</h1>
        <p role="alert">Access is restricted to MENRO Staff and Admin.</p>
      </main>
    );
  }

  const editable =
    userRole === "staff" && !detail?.writesPaused && ["DRAFT", "RETURNED"].includes(detail?.status);
  const completed = assessments.filter((assessment) => assessment.condition).length;
  // Only backend-authorized eligible cohorts are selectable. Blocked cohorts stay visible
  // in the readiness cards with their reasons, but cannot be mistaken for a valid choice.
  const readinessRows = uniqueByReport(readiness?.data?.eligible);
  const selectedReadiness = readinessRows.find(row => row.cohortId === readinessCohortId) || null;
  const readinessOption = row => `${row.reportNumber || "Verified planting report"} · ${row.siteName || "Planting site"} · ${row.canCreateVisit ? `${approvedVisitNote(row) ? `${approvedVisitNote(row)}, ` : ""}Visit ${row.nextVisitNumber || ""} ready` : row.scheduleStatus ? scheduleStatusLabel(row.scheduleStatus) : "Setup pending"}`;
  // Spec §6: under the first-visit workflow, Visit 1 itself registers the baseline and the 10% sample.
  // Legacy cohorts keep the sampling-plan and baseline wording.
  const readinessCohorts = readiness?.data?.cohorts || [];
  const firstVisitReadiness = readinessCohorts.some(row => row.registersBaseline === true);
  const legacyReadiness = !readinessCohorts.length || readinessCohorts.some(row => row.registersBaseline !== true);

  const loadedCount = readinessCohorts.length;
  const readinessMore = readiness?.data?.truncated && (readiness.data.nextCursor ? <div className="psm-readiness-more">
    <p>{`${loadedCount} verified planting report${loadedCount === 1 ? " is" : "s are"} loaded. ${readiness.data.partial ? "Some could not be loaded." : "More are available."}`}</p>
    {readiness.more === "error" && <p role="alert">More verified planting reports could not be loaded. Try again.</p>}
    <button type="button" disabled={readiness.more === "loading"} onClick={loadMoreReadiness}>{readiness.more === "loading" ? "Loading…" : "Load more verified planting reports"}</button>
  </div> : <p>{readiness.data.partial ? "Some verified planting reports could not be loaded. Refresh to try again." : "Only the first 25 planting reports are shown."}</p>);

  const eligibleOptions = readinessRows.length > 0 && <optgroup label="Eligible Verified Planting Reports">
    {readinessRows.map(row => <option key={row.cohortId} value={`ready:${row.cohortId}`}>{readinessOption(row)}</option>)}</optgroup>;
  const startButton = cohort => userRole === "staff" && cohort.canCreateVisit === true && <button type="button" disabled={Boolean(creatingCohortId)} onClick={() => createVisit(cohort)}>
    {creatingCohortId === cohort.cohortId ? "Opening visit…" : `Start Visit ${cohort.nextVisitNumber || ""}`}
  </button>;
  const readinessCard = cohort => <article key={cohort.cohortId} className="psm-readiness-site">
    <h3>{readinessTitle(cohort)}</h3>
    {cohort.nextVisitNumber && <p>{approvedVisitNote(cohort) && `${approvedVisitNote(cohort)}. `}Next visit: {cohort.nextVisitNumber}. Scheduled date: {cohort.nextScheduledDueDate || "Pending approved schedule"}. Status: {scheduleStatusLabel(cohort.scheduleStatus)}.</p>}
    <ul>{readinessMessages(cohort.reasons).map(message => <li key={message}>{message}</li>)}</ul>
    {startButton(cohort)}
  </article>;
  const gateNotices = readinessGateNotices(readiness?.data?.gates);
  const readinessProgress = <>
    {readiness?.loading && <p aria-live="polite">Checking visit readiness…</p>}
    {readiness?.error && <p>{readiness.error}</p>}
  </>;
  // Beside listed visits: Staff keep access to eligible reports (inside the modal they are in the report selector).
  const readinessBesideVisits = userRole === "staff" && <>
    {readinessProgress}
    {!embedded && readinessRows.length > 0 && <section className="psm-readiness" aria-labelledby="psm-eligible-title">
      <h2 id="psm-eligible-title">Eligible Verified Planting Reports</h2>
      {readinessRows.map(readinessCard)}
    </section>}
    {readinessMore}
  </>;

  const visitList = (
    <>
      {error && <p role="alert" className="cohort-error">{error}</p>}
      {loading && <p role="status">Loading monitoring visits…</p>}
      {page && !loading && (
        <>
          {gateNotices.length > 0 && <ul className="psm-note" aria-label="Monitoring availability">{gateNotices.map(notice => <li key={notice}>{notice}</li>)}</ul>}
          {selectPrompt && page.visits?.length > 0 && <p role="status">Select the monitoring visit to continue.</p>}
          {page.visits?.length ? (
            <ul>
              {page.visits.map((visit) => (
                <li key={visit.id}>
                  {embedded ? <button type="button" className="psm-visit-choice" onClick={() => open(visit.id)}>
                    {`Visit ${visit.visitDate || ""} · ${statusLabel(visit.status)} · ${visit.progress.completed}/${visit.progress.total} assessed`}
                  </button> : <>
                  <button type="button" onClick={() => open(visit.id)}>
                    {visit.id}
                  </button>
                  {` · ${visit.status} · cohort ${visit.cohortId} · site ${visit.siteId} · ${visit.progress.completed}/${visit.progress.total} assessed · ${visit.progress.rechecking} rechecking`}
                  </>}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p role="status">No authorized monitoring visits are available.</p>
              {firstVisitReadiness && <p>Start Visit 1 for an eligible verified planting report. Visit 1 registers the baseline and the automatic 10% permanent sample; its Tree IDs remain provisional until Admin approval.</p>}
              {legacyReadiness && <p>A visit appears here after MENRO creates it from an approved sampling plan and baseline.</p>}
              {!embedded && <Link to={`/${userRole}/survival-monitoring`}>Back to Survival Monitoring</Link>}
              {readiness && page.firstPage && <section className="psm-readiness" aria-labelledby="psm-readiness-title">
                <h2 id="psm-readiness-title">Why no monitoring visit is available</h2>
                {readinessProgress}
                {readiness.data && !readiness.data.cohorts?.length && <p>No verified planting reports are ready for permanent-sample monitoring yet.</p>}
                {(readiness.data?.cohorts || []).map(readinessCard)}
                {readinessMore}
              </section>}
            </>
          )}
          {page.nextCursor && (
            <button type="button" onClick={() => { if (allowDiscard()) load(page.nextCursor); }}>
              Next page
            </button>
          )}
          {(page.visits?.length > 0 || !page.firstPage) && readinessBesideVisits}
        </>
      )}
    </>
  );

  const dialog = (detail || embedded) && <ModalDialog open={embedded ? embeddedOpen : dialogOpen} label={formTitle} className="psm-dialog" dismissible={!saving && !reviewing} busy={saving || reviewing} onClose={embedded ? () => onClose?.() : () => setDialogOpen(false)}>
        {modalHeader(detail ? statusLabel(detail.status) : "")}
        {!detail ? <>
        {/* Embedded selection/blocker state: visit choice, backend blocker or readiness reasons above a read-only
            seven-section form shell. Nothing is editable or submittable until a real authorized visit is opened. */}
        <div className="psm-body psm-picker">
          <label className="psm-field">Verified Planting Report *<select value={selectedReadiness ? `ready:${selectedReadiness.cohortId}` : pendingReport ? `pending:${pendingReport.plantingReportId}` : ""}
            disabled={!pendingReports.length && !readinessRows.length} aria-describedby="psm-shell-reason"
            onChange={event => { const value = event.target.value; if (value.startsWith("ready:")) chooseEligible(value.slice(6));
              else if (value.startsWith("pending:")) choosePendingReport(value.slice(8)); else { setPendingReportId(""); setReadinessCohortId(""); } }}>
            <option value="">No authorized visit selected</option>
            {eligibleOptions}
            {pendingOptions(pickerRows)}</select></label>
          {visitList}
          {pendingReport && <section className="psm-readiness psm-setup-pending" aria-labelledby="psm-setup-pending-title" data-setup-pending-report={pendingReport.plantingReportId}>
            <h2 id="psm-setup-pending-title">{pendingNotEligible ? "Not eligible for permanent-sample monitoring" : "Setup pending"}: {pendingReport.reportNumber || "Verified planting report"}</h2>
            <dl className="psm-info">
              <div><dt>Monitoring requirement</dt><dd>{pendingReport.requirement}</dd></div>
              <div><dt>Monitoring status</dt><dd>{pendingReport.stage || pendingReport.status}</dd></div>
              {pendingReport.stage && <div><dt>Readiness</dt><dd>{pendingReport.status}</dd></div>}
              {pendingReport.setup && <div><dt>Setup progress</dt><dd>{pendingReport.setup}</dd></div>}
            </dl>
            {pendingReport.notes.map(note => <p key={note}>{note}</p>)}
            {pendingReport.pickerGroup === PICKER_GROUP.SETUP_PENDING && !pendingReport.cohort && readiness?.data?.gates?.pilotRestricted === true && <p>Permanent-sample monitoring is currently limited to a MENRO pilot, so setup for reports outside the pilot is not shown here.</p>}
            {pendingReport.hasMonitoringRecord && <p>This report already has a monitoring record in Monitoring Records.</p>}
            {pendingReport.reasons.length > 0 && <ul aria-label="Why this report has no monitoring visit">{pendingReport.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
          </section>}
          {selectedReadiness && <section className="psm-readiness psm-setup-pending" aria-labelledby="psm-readiness-selection-title">
            <h2 id="psm-readiness-selection-title">{readinessTitle(selectedReadiness)}</h2>
            {approvedVisitNote(selectedReadiness) && <p>{`${approvedVisitNote(selectedReadiness)}.`}</p>}
            <dl className="psm-info"><div><dt>Next visit</dt><dd>{selectedReadiness.nextVisitNumber || "Pending"}</dd></div>
              <div><dt>Scheduled date</dt><dd>{selectedReadiness.nextScheduledDueDate || "Pending approved schedule"}</dd></div>
              <div><dt>Schedule status</dt><dd>{scheduleStatusLabel(selectedReadiness.scheduleStatus)}</dd></div></dl>
            {selectedReadiness.reasons?.length > 0 && <ul>{readinessMessages(selectedReadiness.reasons).map(message => <li key={message}>{message}</li>)}</ul>}
            {selectedReadiness.canCreateVisit === true ? <button type="button" className="psm-primary" disabled={Boolean(creatingCohortId)} onClick={() => createVisit(selectedReadiness)}>
              {creatingCohortId ? "Opening visit…" : `Start Visit ${selectedReadiness.nextVisitNumber || ""}`}</button>
              : <p role="status">This visit remains unavailable until every authoritative readiness requirement is satisfied.</p>}
          </section>}
          {/* Review mode (one visit from Monitoring Records) keeps the description the select points to. */}
          {reviewVisitId ? <p className="psm-note" id="psm-shell-reason">{error && !loading
            ? "The selected monitoring visit could not be opened. Close this form and try again from Monitoring Records."
            : "Loading the selected monitoring visit…"}</p>
          : <p className="psm-note" id="psm-shell-reason">{pendingNotEligible ? "This verified planting report is not eligible for permanent-sample monitoring. Assessment editing, evidence, Save Draft and Submit are unavailable for it."
            : pendingReport?.cohort ? "No new monitoring visit can be started for this verified planting report right now. Assessment editing, evidence, Save Draft and Submit stay unavailable until a visit is authorized."
            : pendingReport ? "This verified planting report has no authorized monitoring visit yet. Assessment editing, evidence, Save Draft and Submit stay unavailable until MENRO creates one."
            : selectedReadiness?.canCreateVisit === true ? "Nothing is editable until the authorized visit for this report is started with Start Visit above."
            : page?.visits?.length ? "Select an authorized monitoring visit above to load its registered sample trees."
            : userRole === "admin" ? "No monitoring visit is available for review. MENRO Staff record and submit visits; Admin reviews, approves or returns them."
            : "Assessment editing, evidence submission, Save Draft and Submit are unavailable until MENRO creates an authorized monitoring visit."}</p>}
          {/* The disabled Staff form shell (Take Photo, Upload, Save Draft, Submit) is never shown to Admin. */}
          {userRole !== "admin" && <PermanentSampleVisitShell describedBy="psm-shell-reason" report={pendingReport || selectedReadiness} firstVisit={firstVisitReadiness && !legacyReadiness} />}
        </div>
        <footer className="psm-footer">{userRole !== "admin" && <><button type="button" disabled aria-describedby="psm-shell-reason">Save Draft</button><button type="button" className="psm-primary" disabled aria-describedby="psm-shell-reason">Submit Monitoring Visit</button></>}</footer>
        </> : <>
        <div className="psm-body">
        <label className="psm-field">Verified Planting Report *<select value={detail.id} disabled={saving || Boolean(unconfirmed)} onChange={event => { const value = event.target.value; if (value.startsWith("pending:")) choosePendingReport(value.slice(8)); else if (value.startsWith("ready:")) chooseEligible(value.slice(6)); else open(value); }}>{(page?.visits || [detail]).map(row => <option key={row.id} value={row.id}>{row.id === detail.id && detail.visitContext?.reportNumber
          ? `${detail.visitContext.reportNumber} · ${detail.visitContext.siteName || "Planting site"} · Visit ${row.visitDate || ""}`
          : `Visit ${row.visitDate || row.id} · ${statusLabel(row.status)}`}</option>)}{embedded && userRole === "staff" && eligibleOptions}{pendingOptions(pendingBesideVisits)}</select></label>
        {error && <p role="alert" className="psm-error">{error}</p>}
        {savedNotice && <p role="status" className="psm-success">{savedNotice}</p>}
        {unconfirmed ? <button type="button" disabled={saving} onClick={reconcile}>Check saved outcome</button> : <button type="button" disabled={saving || reviewing} onClick={() => open(detail.id, true)}>Reload visit</button>}
        <section className="psm-content">
          <p className="psm-note">{`${statusLabel(detail.status)} · Revision ${detail.version}`}</p>
          {!editable && <p role="status">{`${completed}/${assessments.length} assessments recorded.`}</p>}
          {!editable && (
            // Same seven-section form as Staff, read-only: Admin review and approved/submitted visits never get
            // editing, capture, upload, Save Draft or Submit (all Staff-only in backend RBAC).
            <PermanentSampleVisitForm readOnly inlineEvidenceHistory={false} detail={detail} assessments={assessments} activeTreeId={activeTreeId} onTree={setActiveTreeId}
              errors={{}} onChange={() => {}} saving={false} onSave={() => {}} questions={{}} onQuestion={() => {}}
              originalEnabled={false} pendingFor={() => null} onUpload={() => {}} onDiscard={() => {}} onCapture={() => {}}
              evidenceUrls={evidenceUrls} evidenceKey={evidenceKey} onView={viewEvidence} visitRemarks={detail.visitRemarks || ""} onVisitRemarks={() => {}}
              dateMonitored={detail.dateMonitored || ""} onDateMonitored={() => {}} />
          )}
          {editable ? (
            <PermanentSampleVisitForm detail={detail} assessments={assessments} activeTreeId={activeTreeId} onTree={setActiveTreeId}
              errors={fieldErrors} onChange={updateAssessment} saving={saving || Boolean(unconfirmed)} onSave={save} questions={questions} onQuestion={(sampleId,value) => setQuestions(current => ({ ...current, [sampleId]: value }))}
              originalEnabled={originalsEnabled} onOriginal={chooseOriginal}
              pendingFor={sampleId => pendingEvidence[pendingKey(sampleId)]} onUpload={uploadEvidence}
              onDiscard={sampleId => { const key = pendingKey(sampleId), photo = pendingEvidence[key]; if (photo?.previewUrl) { URL.revokeObjectURL(photo.previewUrl); objectUrls.current.delete(photo.previewUrl); } setPendingEvidence(current => { const next = { ...current }; delete next[key]; return next; }); }}
              onCapture={sampleId => { setCameraSampleId(sampleId); setCameraOpen(true); captureEpoch.current = evidenceEpoch.current; }}
              evidenceUrls={evidenceUrls} evidenceKey={evidenceKey} onView={viewEvidence} visitRemarks={visitRemarks} onVisitRemarks={setVisitRemarks} dateMonitored={dateMonitored} onDateMonitored={value => { setDateMonitored(value); setFieldErrors(current => ({ ...current, dateMonitored: "" })); }}/>
          ) : (
            <>
              <h3>{userRole === "admin" ? "Admin Review: Recorded Assessments and Evidence" : "Recorded Assessments and Evidence"}</h3>
              <div className="psm-info"><p>Planting site: {detail.visitContext?.siteName || "Not supplied"}</p><p>Planting report: {detail.visitContext?.reportNumber || detail.visitContext?.plantingReportId || "Not supplied"}</p><p>Date Monitored: {detail.dateMonitored || "Not recorded"}</p>{detail.visitRemarks && <p>Visit remarks: {detail.visitRemarks}</p>}</div>
              <p>{`Cohort ${detail.cohortId} · Site ${detail.siteId} · ${completed}/${assessments.length} assessments complete`}</p>
              {detail.reviewReasons && <p>{`Review reason: ${detail.reviewReasons}`}</p>}
              {userRole === "admin" && !detail.writesPaused && detail.status === "PENDING_ADMIN_APPROVAL" && (
                <section aria-label="Admin visit review">
                  <h3>Admin Visit Review</h3>
                  {(detail.originalEvidenceReviewRequirements || []).map(item=><label key={item.evidenceId} className="psm-field">
                    <input type="checkbox" checked={Boolean(originalReviews[item.evidenceId])} onChange={event=>setOriginalReviews(current=>({...current,[item.evidenceId]:event.target.checked}))}/>
                    I reviewed the uploaded original for {item.sampleId}, revision {item.assessmentRevision}. GPS accuracy is Unknown; EXIF does not prove authenticity. Local proposed policy only.
                  </label>)}
                  <label>
                    Return reason
                    <textarea
                      value={reviewReasons}
                      onChange={(event) => setReviewReasons(event.target.value)}
                    />
                  </label>
                  {reviewing && <p role="status">Submitting Admin decision…</p>}
                  <p className="psm-note">Approve Visit and Return for Correction are at the bottom of this form.</p>
                </section>
              )}
              {userRole === "admin" && detail.writesPaused && detail.status === "PENDING_ADMIN_APPROVAL" && (
                <p role="status">Permanent-sample changes are paused, so Approve and Return are unavailable. This visit stays read-only.</p>
              )}
              {detail.status === "APPROVED" && <p role="status">Approved visits are read-only.</p>}
              <ul>
                {(detail.sampleAssessments || []).map((assessment) => (
                  <li key={assessment.sampleId}>
                    {assessment.sampleId}: {assessment.condition || "Not assessed"}
                    {assessment.heightCentimeters !== null && assessment.heightCentimeters !== undefined
                      ? ` · height ${assessment.heightCentimeters} cm`
                      : ""}
                    {assessment.stemDiameterMillimeters !== null && assessment.stemDiameterMillimeters !== undefined
                      ? ` · stem diameter ${assessment.stemDiameterMillimeters} mm`
                      : ""}
                    {assessment.remarks ? ` · ${assessment.remarks}` : ""}
                    {assessment.evidenceHistory?.some(e=>e.source === "uploaded-original") && <p>Uploaded original: GPS accuracy Unknown. EXIF does not prove authenticity.</p>}
                    {assessment.evidenceHistory?.at(-1)?.location && <p>Recorded evidence GPS: {assessment.evidenceHistory.at(-1).location.latitude}, {assessment.evidenceHistory.at(-1).location.longitude}</p>}
                    {assessment.investigationOutcome
                      ? ` · ${assessment.investigationOutcome}`
                      : ""}
                    {assessment.previousAssessmentReference
                      ? ` · previous ${assessment.previousAssessmentReference.condition || "assessment"}`
                      : ""}
                    {(assessment.evidenceHistory || []).map((evidence, evidenceIndex) => {
                      const key = evidenceKey(assessment.sampleId, evidenceIndex);
                      return evidenceUrls[key] ? (
                        <img
                          key={key}
                          className="cohort-photo-preview"
                          src={evidenceUrls[key]}
                          alt={`Private evidence for ${assessment.sampleId}, revision ${evidence.revision}`}
                        />
                      ) : (
                        <button
                          key={key}
                          type="button"
                          onClick={() => viewEvidence(assessment.sampleId, evidenceIndex)}
                        >
                          View private evidence revision {evidence.revision}
                        </button>
                      );
                    })}
                  </li>
                ))}
              </ul>
              {(detail.history || []).length > 0 && (
                <section>
                  <h3>Visit history</h3>
                  <ul>
                    {detail.history.map((entry, index) => (
                      <li key={`${entry.version || "history"}-${index}`}>
                        {`Version ${entry.version ?? "—"}: ${entry.status || "recorded"}`}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </section>
        {/* Requester Clarification questions are a Staff monitoring action; Admin sees them read-only. */}
        {informationEnabled() && <MonitoringInformationPanel key={detail.id} visitId={detail.id} readOnly={detail.writesPaused || userRole !== "staff"} />}
        </div>
        <footer className="psm-footer">{userRole === "admin" && !detail.writesPaused && detail.status === "PENDING_ADMIN_APPROVAL" && <div role="group" aria-label="Admin visit decision" className="psm-admin-decision">
          <button type="button" disabled={reviewing || Boolean(unconfirmed)} onClick={() => review(false)}>Return for Correction</button>
          <button type="button" className="psm-primary" disabled={reviewing || Boolean(unconfirmed)} onClick={() => review(true)}>Approve Visit</button>
        </div>}{editable && <><button type="button" disabled={saving || Boolean(unconfirmed)} onClick={() => save(false)}>{saving ? "Saving..." : "Save Draft"}</button><button type="button" className="psm-primary" aria-label="Submit Monitoring Visit" disabled={saving || Boolean(unconfirmed)} onClick={() => save(true)}>{saving ? "Submitting..." : "Submit Monitoring Visit"}</button></>}</footer>
        </>}
      </ModalDialog>;

  const camera = cameraOpen && <ModalDialog label="Monitoring camera" className="psm-camera-host" onClose={() => { setCameraOpen(false); setCameraSampleId(""); }}>
      <SecureCameraCapture
        open={cameraOpen}
        request={cameraRequest}
        binding={cameraBinding}
        onVerified={attachEvidence}
        onCancel={() => {
          setCameraOpen(false);
          setCameraSampleId("");
        }}
        onDiagnostic={({ message }) => { setError(message); setFieldErrors(current => ({ ...current, [cameraSampleId + ".evidence"]: message })); }}
      />
      </ModalDialog>;

  if (embedded) return <>{dialog}{camera}</>;
  return (
    <main className="cohort-page">
      <h1>Permanent Sample Monitoring</h1>
      {detail?.writesPaused && <p role="status">Changes are paused. Authorized visit and photo history remain available.</p>}
      <p>Existing authorized visits only. Scheduling and visit creation are unavailable.</p>
      <label>
        Status
        <select value={status} onChange={(event) => { if (allowDiscard()) setStatus(event.target.value); }}>
          <option value="">All statuses</option>
          {["DRAFT", "RETURNED", "PENDING_ADMIN_APPROVAL", "APPROVED"].map(
            (value) => (
              <option key={value}>{value}</option>
            )
          )}
        </select>
      </label>
      {visitList}
      {dialog}
      {camera}
    </main>
  );
}
