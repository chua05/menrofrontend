import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authenticatedFetch } from "../services/authenticatedApi";
import SecureCameraCapture from "../components/SecureCameraCapture";
import MonitoringInformationPanel from "../components/MonitoringInformationPanel";
import { informationEnabled } from "../utils/permanentSampleFeatures";
import {
  resolveVerifiedPlantingCohortEnabled,
  visibleCohortMessage,
} from "../utils/verifiedPlantingCohort";
import { useAuth } from "../context/AuthContext";

const CONDITIONS = ["Healthy", "Damaged", "Dead", "Needs Rechecking"];
const INVESTIGATION_OUTCOME = "Not Located After Rechecking";

async function api(path, options) {
  const response = await authenticatedFetch(path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    throw Object.assign(
      new Error(body.message || "Monitoring visits could not be loaded."),
      { status: response.status }
    );
  }
  return body.data;
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

function validationError(assessments) {
  for (const assessment of assessments) {
    if (!CONDITIONS.includes(assessment.condition)) {
      return `Select a condition for ${assessment.sampleId}.`;
    }
    if (assessment.condition === "Needs Rechecking" && !assessment.remarks.trim()) {
      return `Remarks are required for ${assessment.sampleId} when it needs rechecking.`;
    }
    if (
      assessment.investigationOutcome === INVESTIGATION_OUTCOME &&
      !assessment.searchFindings.trim()
    ) {
      return `Document search findings for ${assessment.sampleId}.`;
    }
  }
  return "";
}

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
  const [reviewReasons, setReviewReasons] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSampleId, setCameraSampleId] = useState("");
  const [pendingEvidence, setPendingEvidence] = useState({});
  const [evidenceUrls, setEvidenceUrls] = useState({});
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
    setPendingEvidence({}); setEvidenceUrls({});
    setCameraOpen(false); setCameraSampleId("");
    return evidenceEpoch.current;
  }, []);
  useEffect(() => () => {
    evidenceEpoch.current += 1;
    objectUrls.current.forEach(url => URL.revokeObjectURL(url));
    objectUrls.current.clear();
  }, []);
  const evidenceKey = (sampleId, index) => JSON.stringify([detail?.id, sampleId,
    detail?.sampleAssessments?.find(row => row.sampleId === sampleId)?.evidenceHistory?.[index]?.revision, index]);
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

  const open = async (visitId) => {
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
    if (!detail) return;
    const invalid = validationError(assessments);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const data = await api(`/verified-sample-monitoring/visits/${detail.id}`, {
        method: "PUT",
        body: JSON.stringify({
          expectedVersion: detail.version,
          assessments,
          submit,
        }),
      });
      resetEvidence();
      setDetail(data);
      setAssessments((data.sampleAssessments || []).map(formAssessment));
    } catch (requestError) {
      setError(
        requestError.status === 409
          ? "This monitoring visit changed. Reload the current authorized visit before trying again."
          : requestError.message
      );
    } finally {
      setSaving(false);
    }
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

  const attachEvidence = ({ file, descriptor }) => {
    if (!cameraSampleId || captureEpoch.current !== evidenceEpoch.current) return;
    const previousUrl = pendingEvidence[pendingKey(cameraSampleId)]?.previewUrl;
    if (previousUrl) { URL.revokeObjectURL(previousUrl); objectUrls.current.delete(previousUrl); }
    const previewUrl = URL.createObjectURL(file);
    objectUrls.current.add(previewUrl);
    setPendingEvidence((current) => ({
      ...current,
      [pendingKey(cameraSampleId)]: { file, descriptor, previewUrl },
    }));
    setCameraOpen(false);
    setCameraSampleId("");
  };

  const uploadEvidence = async (sampleId) => {
    const contextKey = pendingKey(sampleId);
    const pending = pendingEvidence[contextKey];
    const assessment = detail?.sampleAssessments?.find((item) => item.sampleId === sampleId);
    if (!pending || !detail || !assessment) return;
    const epoch = evidenceEpoch.current;
    const attemptKey = `${contextKey}:${pending.descriptor.captureSessionId}`;
    const key = uploadKeys.current[attemptKey] || crypto.randomUUID();
    uploadKeys.current[attemptKey] = key;
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.append("photos", pending.file);
      form.append("assessmentRevision", String(assessment.assessmentRevision || 0));
      form.append("expectedVisitVersion", String(detail.version));
      form.append("evidenceManifest", JSON.stringify([pending.descriptor]));
      const response = await authenticatedFetch(
        `/verified-sample-monitoring/visits/${encodeURIComponent(detail.id)}/samples/${encodeURIComponent(sampleId)}/evidence`,
        { method: "PUT", body: form, headers: { "Idempotency-Key": key } }
      );
      const payload = await response.json().catch(() => ({}));
      if (epoch !== evidenceEpoch.current) return;
      if (!response.ok || !payload.success) {
        throw Object.assign(new Error(payload.message || "Evidence upload could not be completed."), {
          status: response.status,
        });
      }
      uploadKeys.current[attemptKey] = "";
      setPendingEvidence((current) => {
        const next = { ...current };
        delete next[contextKey];
        return next;
      });
      await open(detail.id);
    } catch (requestError) {
      setError(
        requestError.status === 409
          ? "Evidence changed while uploading. Refresh the visit and retake the photo if required."
          : requestError.message
      );
    } finally {
      setSaving(false);
    }
  };

  const viewEvidence = async (sampleId, evidenceIndex) => {
    if (!detail) return;
    const epoch = evidenceEpoch.current;
    const key = evidenceKey(sampleId, evidenceIndex);
    if (evidenceUrls[key]) return;
    try {
      const response = await authenticatedFetch(
        `/evidence/sample-monitoring/visits/${encodeURIComponent(detail.id)}/samples/${encodeURIComponent(sampleId)}/evidence/${evidenceIndex}`
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
    if (!detail || userRole !== "admin") return;
    if (!approve && !reviewReasons.trim()) {
      setError("A return reason is required before sending the visit for correction.");
      return;
    }
    setReviewing(true);
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
          }),
        }
      );
      setDetail(data);
      setAssessments((data.sampleAssessments || []).map(formAssessment));
      setReviewReasons("");
    } catch (requestError) {
      setError(
        requestError.status === 409
          ? "This monitoring visit changed. Reload the current authorized visit before reviewing it."
          : requestError.message
      );
    } finally {
      setReviewing(false);
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
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
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
            <p role="status">No authorized monitoring visits are available.</p>
          )}
          {page.nextCursor && (
            <button type="button" onClick={() => load(page.nextCursor)}>
              Next page
            </button>
          )}
        </>
      )}
      {detail && (
        <section className="cohort-card">
          <h2>{detail.id}</h2>
          <p>{`${detail.status} · version ${detail.version}`}</p>
          <p role="status">{`${completed}/${assessments.length} assessments recorded.`}</p>
          {editable ? (
            <>
              <p>Each draft save sends all authoritative sample assessments with the current visit version.</p>
              {assessments.map((assessment) => (
                <fieldset key={assessment.sampleId}>
                  <legend>{assessment.sampleId}</legend>
                  {assessment.previousAssessmentReference && (
                    <p>
                      Previous assessment: {assessment.previousAssessmentReference.condition || "recorded"}
                      {assessment.previousAssessmentReference.remarks
                        ? ` — ${assessment.previousAssessmentReference.remarks}`
                        : ""}
                    </p>
                  )}
                  <label>
                    Height (cm)
                    <input
                      type="number"
                      value={assessment.heightCentimeters}
                      onChange={(event) =>
                        updateAssessment(assessment.sampleId, "heightCentimeters", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Diameter (cm)
                    <input
                      type="number"
                      value={assessment.diameterCentimeters}
                      onChange={(event) =>
                        updateAssessment(assessment.sampleId, "diameterCentimeters", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Condition
                    <select
                      value={assessment.condition}
                      onChange={(event) =>
                        updateAssessment(assessment.sampleId, "condition", event.target.value)
                      }
                    >
                      <option value="">Select condition</option>
                      {CONDITIONS.map((condition) => (
                        <option key={condition}>{condition}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Remarks
                    <textarea
                      value={assessment.remarks}
                      onChange={(event) =>
                        updateAssessment(assessment.sampleId, "remarks", event.target.value)
                      }
                    />
                  </label>
                  {assessment.condition === "Needs Rechecking" && (
                    <>
                      <label>
                        Investigation outcome
                        <select
                          value={assessment.investigationOutcome}
                          onChange={(event) =>
                            updateAssessment(
                              assessment.sampleId,
                              "investigationOutcome",
                              event.target.value
                            )
                          }
                        >
                          <option value="">No outcome recorded</option>
                          <option value={INVESTIGATION_OUTCOME}>{INVESTIGATION_OUTCOME}</option>
                        </select>
                      </label>
                      {assessment.investigationOutcome === INVESTIGATION_OUTCOME && (
                        <label>
                          Search findings
                          <textarea
                            value={assessment.searchFindings}
                            onChange={(event) =>
                              updateAssessment(
                                assessment.sampleId,
                                "searchFindings",
                                event.target.value
                              )
                            }
                          />
                        </label>
                      )}
                    </>
                  )}
                  <button type="button" disabled={saving} onClick={() => save(false)}>
                    Save {assessment.sampleId} Draft
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setCameraSampleId(assessment.sampleId);
                      setCameraOpen(true);
                      captureEpoch.current = evidenceEpoch.current;
                    }}
                  >
                    Capture verified photo for {assessment.sampleId}
                  </button>
                  {pendingEvidence[pendingKey(assessment.sampleId)] && (
                    <div>
                      <p role="status">Verified photo ready for private upload.</p>
                      {saving && <p role="status">Uploading private evidence…</p>}
                      <img
                        className="cohort-photo-preview"
                        src={pendingEvidence[pendingKey(assessment.sampleId)].previewUrl}
                        alt={`Verified evidence preview for ${assessment.sampleId}`}
                      />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => uploadEvidence(assessment.sampleId)}
                      >
                        Upload verified photo for {assessment.sampleId}
                      </button>
                    </div>
                  )}
                  {(detail.sampleAssessments || [])
                    .find((item) => item.sampleId === assessment.sampleId)
                    ?.evidenceHistory?.map((evidence, evidenceIndex) => {
                      const key = evidenceKey(assessment.sampleId, evidenceIndex);
                      return (
                        <div key={key}>
                          <p>{`Historical evidence revision ${evidence.revision}`}</p>
                          {evidenceUrls[key] ? (
                            <img
                              className="cohort-photo-preview"
                              src={evidenceUrls[key]}
                              alt={`Private evidence for ${assessment.sampleId}, revision ${evidence.revision}`}
                            />
                          ) : (
                            <button type="button" onClick={() => viewEvidence(assessment.sampleId, evidenceIndex)}>
                              View private evidence revision {evidence.revision}
                            </button>
                          )}
                        </div>
                      );
                    })}
                </fieldset>
              ))}
              <button type="button" disabled={saving} onClick={() => save(true)}>
                Submit Visit
              </button>
            </>
          ) : (
            <>
              <p>{`Cohort ${detail.cohortId} · Site ${detail.siteId} · ${completed}/${assessments.length} assessments complete`}</p>
              {detail.reviewReasons && <p>{`Review reason: ${detail.reviewReasons}`}</p>}
              {userRole === "admin" && !detail.writesPaused && detail.status === "PENDING_ADMIN_APPROVAL" && (
                <section aria-label="Admin visit review">
                  <h3>Admin Visit Review</h3>
                  <label>
                    Return reason
                    <textarea
                      value={reviewReasons}
                      onChange={(event) => setReviewReasons(event.target.value)}
                    />
                  </label>
                  {reviewing && <p role="status">Submitting Admin decision…</p>}
                  <button type="button" disabled={reviewing} onClick={() => review(true)}>
                    Approve Visit
                  </button>
                  <button type="button" disabled={reviewing} onClick={() => review(false)}>
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
      )}
      {detail && informationEnabled() && <MonitoringInformationPanel key={detail.id} visitId={detail.id} readOnly={detail.writesPaused} />}
      <SecureCameraCapture
        open={cameraOpen}
        request={cameraRequest}
        binding={cameraBinding}
        onVerified={attachEvidence}
        onCancel={() => {
          setCameraOpen(false);
          setCameraSampleId("");
        }}
        onDiagnostic={({ message }) => setError(message)}
      />
    </main>
  );
}
