import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authenticatedFetch } from "../services/authenticatedApi";
import SecureCameraCapture from "../components/SecureCameraCapture";
import ModalDialog from "../components/ModalDialog";
import PermanentSampleVisitForm from "../components/PermanentSampleVisitForm";
import { assessmentErrors } from "../utils/sampleMonitoringForm";
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
import { Link } from "react-router-dom";

const STATUS_LABELS = { DRAFT: "Draft", RETURNED: "Returned for Correction", PENDING_ADMIN_APPROVAL: "Pending Admin Review", APPROVED: "Approved" };
const statusLabel = value => STATUS_LABELS[value] || value;


async function api(path, options = {}) {
  const write = options.method && options.method !== "GET";
  return withDeadline((async () => {
    const response = await authenticatedFetch(path, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) throw Object.assign(new Error(body.message || "Monitoring visits could not be loaded."), { status: response.status, code: body.code });
    return body.data;
  })(), write ? WRITE_TIMEOUT_MS : READ_TIMEOUT_MS, () => new RequestTimeoutError(write ? "MENRO has not confirmed this save. Check the saved outcome before trying again." : "Monitoring data could not be loaded in time. Please retry.", { ambiguous: Boolean(write) }));
}

function formAssessment(value) {
  return {
    sampleId: value.sampleId,
    condition: value.condition || "",
    remarks: value.remarks || "",
    heightCentimeters: value.heightCentimeters ?? "",
    diameterCentimeters: value.diameterCentimeters ?? "",
    baselineReference: value.baselineReference || null,
    previousAssessmentReference: value.previousAssessmentReference || null,
    investigationOutcome: value.investigationOutcome || "",
    searchFindings: value.searchFindings || "",
  };
}


const draftSnapshot = (rows, remarks, date) => JSON.stringify([rows.map(row =>
  ["sampleId", "condition", "heightCentimeters", "diameterCentimeters", "remarks", "investigationOutcome", "searchFindings"]
    .map(field => String(row[field] ?? ""))), remarks, date]);

export default function PermanentSampleMonitoringPage() {
  const enabled = resolveVerifiedPlantingCohortEnabled();
  const { userRole } = useAuth();
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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSampleId, setCameraSampleId] = useState("");
  const [pendingEvidence, setPendingEvidence] = useState({});
  const [evidenceUrls, setEvidenceUrls] = useState({});
  const unsaved = userRole === "staff" && ["DRAFT", "RETURNED"].includes(detail?.status) &&
    (Object.keys(pendingEvidence).length > 0 || Object.values(questions).some(value => value.trim()) ||
      savedDraft !== draftSnapshot(assessments, visitRemarks, dateMonitored));
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

  const load = useCallback(
    async (next = "") => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams();
        if (status) query.set("status", status);
        if (next) query.set("cursor", next);
        const data = await api(`/verified-sample-monitoring/visits?${query}`);
        setPage(data);
        resetEvidence();
        setDetail(null);
        setAssessments([]);
      } catch (requestError) {
        setError(
          requestError.status === 401
            ? "Sign in is required."
            : requestError.status === 403
              ? "You are not authorized to view monitoring visits."
              : requestError.message
        );
      } finally {
        setLoading(false);
      }
    },
    [status, resetEvidence]
  );

  useEffect(() => {
    if (!enabled || !["staff", "admin"].includes(userRole)) return undefined;
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, load, userRole]);

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
  };

  const updateAssessment = (sampleId, field, value) => {
    const resolved = field === "condition" && value !== "Needs Rechecking";
    const row = assessments.find(item => item.sampleId === sampleId);
    const remarksError = resolved && row ? assessmentErrors([{ ...row, condition: value, investigationOutcome: "", searchFindings: "" }])[`${sampleId}.remarks`] : "";
    setFieldErrors(current => ({ ...current, [`${sampleId}.${field}`]: "", ...(resolved ? {
      [`${sampleId}.remarks`]: remarksError || "", [`${sampleId}.searchFindings`]: "",
    } : {}) }));
    setAssessments((current) =>
      current.map((assessment) => {
        if (assessment.sampleId !== sampleId) return assessment;
        const next = { ...assessment, [field]: value };
        if (field === "condition" && value !== "Needs Rechecking") {
          next.investigationOutcome = "";
          next.searchFindings = "";
        }
        return next;
      })
    );
  };

  const save = async (submit = false) => {
    if (!detail || operationBusy.current || unconfirmed) return;
    const invalid = assessmentErrors(assessments, submit);
    if (Object.keys(invalid).length) {
      setFieldErrors(invalid); const first = Object.keys(invalid)[0]; setActiveTreeId(first.split(".")[0]); setError("Please correct the highlighted assessment fields.");
      window.setTimeout(() => { const field = document.querySelector(`[data-validation-field="${CSS.escape(first)}"]`); field?.scrollIntoView({ behavior: "smooth", block: "center" }); field?.querySelector("input,select,textarea")?.focus({ preventScroll: true }); }, 0); return;
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
    const payload = { expectedVersion: detail.version, assessments, submit, visitRemarks, dateMonitored };
    operationBusy.current = true; setSaving(true); setError("");
    try {
      const data = await api(`/verified-sample-monitoring/visits/${detail.id}`, { method: "PUT", body: JSON.stringify(payload) });
      setSavedDraft(draftSnapshot(data.sampleAssessments.map(formAssessment), data.visitRemarks || "", data.dateMonitored || dateMonitored));
      resetEvidence(); setDetail(data); setAssessments((data.sampleAssessments || []).map(formAssessment)); setVisitRemarks(data.visitRemarks || "");
      setPage(current => current ? { ...current, visits: current.visits.map(row => row.id === data.id ? { ...row, status: data.status, version: data.version } : row) } : current);
    } catch (requestError) {
      if (requestError.ambiguous) setUnconfirmed({ visitId: detail.id, ...payload });
      setError(requestError.status === 409 && !requestError.code?.startsWith("ORIGINAL_") ? "This monitoring visit changed. Reload the current authorized visit before trying again." : requestError.message);
    } finally { operationBusy.current = false; setSaving(false); }
  };
  const reconcile = async () => {
    if (!unconfirmed || operationBusy.current) return;
    operationBusy.current = true; setSaving(true);
    try {
      const data = await api(`/verified-sample-monitoring/visits/${encodeURIComponent(unconfirmed.visitId)}`);
      if (unconfirmed.review !== undefined) {
        if (data.status !== (unconfirmed.review ? "APPROVED" : "RETURNED") || !unconfirmed.review && data.reviewReasons !== unconfirmed.reasons) { setError("The review outcome is not confirmed. Check again before another decision."); return; }
        setSavedDraft(draftSnapshot(data.sampleAssessments.map(formAssessment), data.visitRemarks || "", data.dateMonitored || dateMonitored));
      resetEvidence(); setDetail(data); setAssessments(data.sampleAssessments.map(formAssessment)); setVisitRemarks(data.visitRemarks || ""); setDateMonitored(data.dateMonitored || dateMonitored); setUnconfirmed(null); setError(""); return;
      }
      const equivalent = (left, right) => ["sampleId", "condition", "remarks", "investigationOutcome", "searchFindings"].every(key => String(left[key] || "").trim() === String(right[key] || "").trim()) && ["heightCentimeters", "diameterCentimeters"].every(key => (left[key] === "" || left[key] == null ? null : Number(left[key])) === (right[key] === "" || right[key] == null ? null : Number(right[key])));
      const matches = data.version > unconfirmed.expectedVersion && data.status === (unconfirmed.submit ? "PENDING_ADMIN_APPROVAL" : "DRAFT") && data.sampleAssessments.length === unconfirmed.assessments.length && unconfirmed.assessments.every(row => data.sampleAssessments.some(saved => equivalent(row, saved))) && String(data.visitRemarks || "") === unconfirmed.visitRemarks.trim() && data.dateMonitored === unconfirmed.dateMonitored;
      if (!matches) { setError("The saved outcome is not confirmed. Keep these entries and check again before retrying."); return; }
      setSavedDraft(draftSnapshot(data.sampleAssessments.map(formAssessment), data.visitRemarks || "", data.dateMonitored || dateMonitored));
      resetEvidence(); setDetail(data); setAssessments(data.sampleAssessments.map(formAssessment)); setVisitRemarks(data.visitRemarks || ""); setDateMonitored(data.dateMonitored || dateMonitored); setUnconfirmed(null); setError("");
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
        throw Object.assign(new Error(payload.message || "Evidence upload could not be completed."), {
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
      setError(
        requestError.status === 409 && !requestError.code?.startsWith("ORIGINAL_")
          ? "Evidence changed while uploading. Refresh the visit and retake the photo if required."
          : requestError.message
      );
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
      {error && <p role="alert" className="cohort-error">{error}</p>}
      {loading && <p role="status">Loading monitoring visits…</p>}
      {page && !loading && (
        <>
          {page.visits?.length ? (
            <ul>
              {page.visits.map((visit) => (
                <li key={visit.id}>
                  <button type="button" onClick={() => open(visit.id)}>
                    {visit.id}
                  </button>
                  {` · ${visit.status} · cohort ${visit.cohortId} · site ${visit.siteId} · ${visit.progress.completed}/${visit.progress.total} assessed · ${visit.progress.rechecking} rechecking`}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p role="status">No authorized monitoring visits are available.</p>
              <p>A visit appears here after MENRO creates it from an approved sampling plan and baseline.</p>
              <Link to={`/${userRole}/survival-monitoring`}>Back to Survival Monitoring</Link>
            </>
          )}
          {page.nextCursor && (
            <button type="button" onClick={() => { if (allowDiscard()) load(page.nextCursor); }}>
              Next page
            </button>
          )}
        </>
      )}
      {detail && <ModalDialog open={dialogOpen} label="Monitor Planted Trees" className="psm-dialog" dismissible={!saving && !reviewing} busy={saving || reviewing} onClose={() => setDialogOpen(false)}>
        <header className="psm-header"><div className="psm-header-main"><span className="psm-header-icon"><Trees size={22} aria-hidden="true" /></span><div><h2>Monitor Planted Trees</h2><p>Monitor registered sample trees and document their current survival conditions.</p></div></div>
          <div className="psm-header-actions"><span className="psm-status-badge">{statusLabel(detail.status)}</span><button type="button" className="psm-close" data-modal-close="" disabled={saving || reviewing} aria-label="Close monitoring visit"><X size={18} aria-hidden="true" /></button></div></header>
        <div className="psm-body">
        <label className="psm-field">Verified Planting Report<select value={detail.id} disabled={saving || Boolean(unconfirmed)} onChange={event => open(event.target.value)}>{(page?.visits || [detail]).map(row => <option key={row.id} value={row.id}>{row.id === detail.id && detail.visitContext?.reportNumber
          ? `${detail.visitContext.reportNumber} · ${detail.visitContext.siteName || "Planting site"} · Visit ${row.visitDate || ""}`
          : `Visit ${row.visitDate || row.id} · ${statusLabel(row.status)}`}</option>)}</select></label>
        {error && <p role="alert" className="psm-error">{error}</p>}
        {unconfirmed ? <button type="button" disabled={saving} onClick={reconcile}>Check saved outcome</button> : <button type="button" disabled={saving || reviewing} onClick={() => open(detail.id, true)}>Reload visit</button>}
        <section className="psm-content">
          <p className="psm-note">{`${statusLabel(detail.status)} · Revision ${detail.version}`}</p>
          {!editable && <p role="status">{`${completed}/${assessments.length} assessments recorded.`}</p>}
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
                  <button type="button" disabled={reviewing || Boolean(unconfirmed)} onClick={() => review(true)}>
                    Approve Visit
                  </button>
                  <button type="button" disabled={reviewing || Boolean(unconfirmed)} onClick={() => review(false)}>
                    Return for Correction
                  </button>
                </section>
              )}
              {detail.status === "APPROVED" && <p role="status">Approved visits are read-only.</p>}
              <ul>
                {(detail.sampleAssessments || []).map((assessment) => (
                  <li key={assessment.sampleId}>
                    {assessment.sampleId}: {assessment.condition || "Not assessed"}
                    {assessment.heightCentimeters !== null && assessment.heightCentimeters !== undefined
                      ? ` · height ${assessment.heightCentimeters} cm`
                      : ""}
                    {assessment.diameterCentimeters !== null && assessment.diameterCentimeters !== undefined
                      ? ` · diameter ${assessment.diameterCentimeters} cm`
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
        {informationEnabled() && <MonitoringInformationPanel key={detail.id} visitId={detail.id} readOnly={detail.writesPaused} />}
        </div>
        <footer className="psm-footer">{editable && <><button type="button" disabled={saving || Boolean(unconfirmed)} onClick={() => save(false)}>{saving ? "Saving..." : "Save Draft"}</button><button type="button" className="psm-primary" aria-label="Submit Visit" disabled={saving || Boolean(unconfirmed)} onClick={() => save(true)}>{saving ? "Submitting..." : "Submit Monitoring Visit"}</button></>}</footer>
      </ModalDialog>}
      {cameraOpen && <ModalDialog label="Monitoring camera" className="psm-camera-host" onClose={() => { setCameraOpen(false); setCameraSampleId(""); }}>
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
      </ModalDialog>}
    </main>
  );
}
