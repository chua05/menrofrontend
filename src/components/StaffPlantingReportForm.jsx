import OfficialPlantingPhotos from "./OfficialPlantingPhotos";
import AttendanceUpload from "./AttendanceUpload";
import ModalDialog from "./ModalDialog";
import { attendanceFileError } from "../utils/attendanceFile";
import { leftoverQuantityError, plantedFromLeftover } from "../utils/plantingQuantity";
import { MAX_LEFTOVER_REASON_LENGTH } from "../utils/plantingReportForm";
import { editableCorrectionPaths, evidenceCarriedForward } from "../utils/plantingReviewWorkflow";
import { useEffect, useRef, useState } from "react";
import { FiFileText } from "react-icons/fi";
import { authenticatedFetch } from "../services/authenticatedApi";
import { backendFieldErrors, focusFirstInvalid } from "../utils/formValidation";
import "../styles/official-planting.css";
async function api(path, options) {
  const response = await authenticatedFetch(path, options), body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true) throw Object.assign(new Error(response.status >= 500 ? "Official planting reporting is temporarily unavailable." : body?.message || "Unable to save the official report."), { status: response.status, fieldErrors: body?.fieldErrors });
  return body?.data;
}
async function optionsPage(path) {
  const page = await api(path);
  if (!Array.isArray(page?.options) || page.options.some(row => !row.requestId || !Array.isArray(row.items)) || page.nextCursor !== null && typeof page.nextCursor !== "string") throw new Error("Authorized releases could not be loaded. Please retry.");
  return page;
}
const BASIS_HELP = {
  "menro-field-report": "MENRO Staff confirmed the planting at the site. Original planting photos taken at the site are required.",
  "release-based": "Confirms planting from the release record of an individual requester. Site photos are not required.",
};
export default function StaffPlantingReportForm({ currentUser, onClose, onSaved, correction, resumeEvidence }) {
  const reference = correction || resumeEvidence;
  // Field-specific correction: only the fields MENRO Admin returned are editable
  // (the backend enforces the same rule). Older returns leave every field editable.
  const correctionRequest = correction?.correctionRequest || null;
  const editable = correctionRequest ? editableCorrectionPaths(correctionRequest) : null;
  const canEdit = path => !editable || editable.has(path);
  const commentFor = path => correctionRequest?.fields?.find(field => field.path === path)?.comment || "";
  const evidenceCarried = evidenceCarriedForward(correctionRequest, correction || {});
  const attendanceCarried = Boolean(correctionRequest) && !canEdit("evidence.attendance") && Boolean(correction?.attendanceAvailable || correction?.attendanceCarriedFromSubmissionId);
  const [options, setOptions] = useState([]), [loading, setLoading] = useState(true), [selectedId, setSelectedId] = useState(reference?.requestId || "");
  const [nextCursor, setNextCursor] = useState(null), [loadingMore, setLoadingMore] = useState(false);
  const [items, setItems] = useState([]), [basis, setBasis] = useState(correction?.confirmationBasis || "menro-field-report"), [remarks, setRemarks] = useState(correction?.remarks || "");
  const [file, setFile] = useState(null), [errors, setErrors] = useState({}), [error, setError] = useState(""), [saving, setSaving] = useState(false), [saved, setSaved] = useState(resumeEvidence ? { officialSubmissionIds: [resumeEvidence.id] } : null);
  const [photos, setPhotos] = useState([]), [photoSaved, setPhotoSaved] = useState(false);
  const [photoRetryBound, setPhotoRetryBound] = useState(false);
  const photoKey = useRef(crypto.randomUUID());
  const root = useRef(null), submissionKey = useRef(crypto.randomUUID());
  const selected = options.find(row => row.requestId === selectedId);
  const missingRequired = selected ? ["requesterName", "requestId", "eventId", "siteId", "plantingDate"].filter(key => !String(selected[key] || "").trim()) : [];
  if (selected && basis === "menro-field-report" && (!Number.isFinite(selected.latitude) || !Number.isFinite(selected.longitude))) missingRequired.push("site coordinates");
  // A resumed report already reserved its quantity, so the balance no longer includes it.
  const plantedFor = row => resumeEvidence ? Number(row.quantityPlanted || 0) : plantedFromLeftover(row.availableQuantity, row.leftoverQuantity);
  const title = resumeEvidence ? "Add Verified Planting Evidence" : correction ? "Correct Official Planting Report" : "Submit Official Planting Report";
  async function refresh() {
    setLoading(true); setError("");
    try { const page = await optionsPage("/planting-reports/official/options"); setOptions(page.options); setNextCursor(page.nextCursor); setSelectedId(""); setItems([]); submissionKey.current = crypto.randomUUID(); }
    catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    optionsPage(`/planting-reports/official/options${reference ? `?requestId=${encodeURIComponent(reference.requestId)}` : ""}`).then(page => {
      if (!active) return;
      const rows = page.options; setOptions(rows); setNextCursor(page.nextCursor);
      if (reference) {
        const source = rows.find(row => row.requestId === reference.requestId);
        // Evidence covers every seedling type saved together, so a resumed report lists all of them.
        // A correction starts from every type of the returned report with its submitted values.
        const savedRows = resumeEvidence?.operationRows?.length ? resumeEvidence.operationRows : correction?.groupRows?.length ? correction.groupRows : [reference];
        setItems(savedRows.map(entry => { const row = (source?.items || []).find(item => item.inventoryId === entry.inventoryId); return row && { ...row, quantityPlanted: String(entry.quantity || 0), leftoverQuantity: String(entry.leftoverQuantity || 0), leftoverReason: entry.leftoverReason || "" }; }).filter(Boolean));
      }
    }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reference, resumeEvidence, correction]);
  async function more() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true); setError("");
    try { const page = await optionsPage(`/planting-reports/official/options?cursor=${encodeURIComponent(nextCursor)}`); setOptions(rows => [...new Map([...rows, ...page.options].map(row => [row.requestId, row])).values()]); setNextCursor(page.nextCursor); }
    catch (failure) { setError(failure.message); } finally { setLoadingMore(false); }
  }
  function choose(id) {
    setSelectedId(id); setItems((options.find(row => row.requestId === id)?.items || []).filter(row => !correction || correction.finalReportGroupId || row.inventoryId === correction.inventoryId).map(row => ({ ...row, leftoverQuantity: "0" })));
    setErrors({}); setBasis("menro-field-report"); setPhotos([]); setPhotoSaved(false); photoKey.current = crypto.randomUUID(); submissionKey.current = crypto.randomUUID();
  }
  const aria = key => ({ "aria-invalid": errors[key] ? "true" : undefined, "aria-describedby": errors[key] ? `official-error-${key}` : undefined });
  const feedback = key => errors[key] && <small role="alert" className="pr-field-error" id={`official-error-${key}`}>{errors[key]}</small>;
  function changeItem(index, field, value) {
    setItems(rows => rows.map((row, itemIndex) => index === itemIndex ? { ...row, [field]: value } : row));
    setErrors(current => ({ ...current, [`${field}-${index}`]: "", items: "" })); submissionKey.current = crypto.randomUUID();
  }
  async function save(event) {
    event.preventDefault(); if (saving) return;
    const validation = {};
    if (!selected) validation.requestId = "Select an authorized released request.";
    else if (missingRequired.length) validation.requestId = "Required release information is missing. Ask MENRO to correct the linked record before submitting.";
    if (!saved) items.forEach((row, index) => {
      const message = leftoverQuantityError(row.leftoverQuantity, row.availableQuantity);
      if (message) validation[`leftoverQuantity-${index}`] = message;
      // Final leftovers are documentation only, but each needs its reason.
      const reason = String(row.leftoverReason || "").trim();
      if (!message && Number(row.leftoverQuantity) > 0 && !reason) validation[`leftoverReason-${index}`] = "Enter the reason for the leftover seedlings.";
      else if (reason.length > MAX_LEFTOVER_REASON_LENGTH) validation[`leftoverReason-${index}`] = `Use at most ${MAX_LEFTOVER_REASON_LENGTH} characters.`;
    });
    if (!saved && selected && items.every(row => Number(row.availableQuantity) === 0)) validation.items = "No seedlings remain available for reporting on this release.";
    if (basis === "menro-field-report" && !photoSaved && !evidenceCarried && (!photos.length || photos.some(photo => !["ready", "verified"].includes(photo.status)))) validation.photos = "Add and verify original planting photos for the MENRO Field Report.";
    if (attendanceFileError(file) || errors.attendance) validation.attendance = attendanceFileError(file) || errors.attendance;
    setErrors(validation);
    if (Object.keys(validation).length) return focusFirstInvalid(() => root.current);
    setSaving(true); setError("");
    let report = saved;
    try {
      if (!report) {
        report = await api("/planting-reports/official", { method: "POST", body: JSON.stringify({ requestId: selected.requestId, items: items.map(row => ({ inventoryId: row.inventoryId, quantityPlanted: plantedFor(row), leftoverQuantity: Number(row.leftoverQuantity), ...(Number(row.leftoverQuantity) > 0 ? { leftoverReason: String(row.leftoverReason || "").trim() } : {}) })), confirmationBasis: basis, remarks, expectedVersion: selected.expectedVersion, clientSubmissionId: submissionKey.current, ...(correction ? { correctionOf: correction.id } : {}) }) });
        setSaved(report);
      }
      if (basis === "menro-field-report" && !photoSaved && !evidenceCarried) {
        setPhotoRetryBound(true);
        const photoData = new FormData(); photos.forEach(photo => photoData.append("photos", photo.file));
        photoData.append("evidenceManifest", JSON.stringify(photos.map(photo => photo.descriptor)));
        photoData.append("expectedRevision", String(resumeEvidence ? Number(resumeEvidence.revision || 0) : correction ? Number(correction.revision || 0) + 1 : 0));
        await api(`/planting-reports/official/${encodeURIComponent(report.officialSubmissionIds[0])}/photos`, { method: "PUT", body: photoData, headers: { "Idempotency-Key": photoKey.current } });
        setPhotoSaved(true);
      }
      if (file && !attendanceCarried) {
        const data = new FormData(); data.append("attendance", file);
        await api(`/planting-reports/official/${encodeURIComponent(report.officialSubmissionIds[0])}/attendance`, { method: "PUT", body: data });
      }
      await onSaved(report); onClose();
    } catch (failure) {
      if ([400, 422].includes(failure.status) && !photoSaved) setPhotoRetryBound(false);
      const fields = backendFieldErrors(failure);
      // "field-<path>" errors name a field that was not returned for correction.
      for (const key of Object.keys(fields)) {
        const match = /^field-items\.([A-Za-z0-9_-]+)\.(leftoverQuantity|leftoverReason)$/.exec(key);
        const index = match ? items.findIndex(row => row.inventoryId === match[1]) : -1;
        if (index >= 0) { fields[`${match[2]}-${index}`] = fields[key]; delete fields[key]; }
        else if (key === "field-confirmationBasis" || key === "field-remarks") { fields[key.slice(6)] = fields[key]; delete fields[key]; }
      }
      if (fields.items && items.length === 1) { fields["leftoverQuantity-0"] = fields.items; delete fields.items; }
      if (Object.keys(fields).length) { setErrors(fields); focusFirstInvalid(() => root.current); }
      else setError(report ? `The report is saved pending Admin verification. ${failure.message} Retry the same evidence with the same upload intent; do not submit the quantities again.` : failure.status === 409 ? `${failure.message} Refresh releases before correcting the report.` : failure.message);
    } finally { setSaving(false); }
  }
  return <ModalDialog className="pr-official-backdrop" label={title} onClose={onClose} dismissible={!saving} busy={saving}><section className="pr-official-dialog">
    <h2 id="official-planting-title">{title}</h2>
    {correction && (correction.returnReason || correction.rejectionReason) && <div className="pr-correction-banner" role="note" aria-label="Correction details">
      <div><strong>MENRO Admin returned this report for correction</strong><p><span>Reason:</span> {correction.returnReason || correction.rejectionReason}</p>
        {correctionRequest?.fields?.length > 0 && <><p>Only these fields can be changed:</p><ul className="pr-correction-banner-fields">{correctionRequest.fields.map(field => <li key={field.path}><strong>{field.label}:</strong> {field.comment}</li>)}</ul></>}
        {evidenceCarried && <p>Your verified planting evidence is kept and does not need to be uploaded again.</p>}
        <p>Your corrected report goes directly to the MENRO Admin for approval.</p></div>
    </div>}
    {loading ? <p role="status">Loading authorized releases…</p> : <form ref={root} onSubmit={save} noValidate>
      {error && <p role="alert">{error}</p>}
      {!options.length && <p>No eligible released requests are available. An existing authorized release is required.</p>}
      <fieldset disabled={saving || Boolean(saved)}>
        <div className="pr-field"><label htmlFor="official-request">Seedling Release Record *</label><select id="official-request" value={selectedId} onChange={event => choose(event.target.value)} {...aria("requestId")}><option value="">Select a released request</option>{options.map(row => <option key={row.requestId} value={row.requestId}>{row.requesterName} — {row.eventName || row.requestId}</option>)}</select>{feedback("requestId")}</div>
        {nextCursor && <button type="button" className="pr-secondary-button" onClick={more} disabled={loadingMore}>{loadingMore ? "Loading More Releases…" : "Load More Releases"}</button>}
        <div className="pr-official-grid">
          {[ ["Requester Full Name", selected?.requesterName], ["Participant Sector", selected?.participantSector], ["Requesting As", selected?.requestingAs || selected?.requestType], ["Organization", selected?.organizationName], ["Request Type", selected?.requestType], ["Planting Event / Activity", selected?.eventName], ["Planting Date / Schedule", [selected?.plantingDate, selected?.startTime, selected?.endTime].filter(Boolean).join(" ")], ["Registered Planting Site", selected?.siteName], ["Barangay", selected?.barangay], ["Site Latitude", selected?.latitude], ["Site Longitude", selected?.longitude], ["Linked Request", selected?.requestNumber || selected?.requestId], ["Linked Distribution", selected?.distributionNumber || selected?.distributionId], ["Submitted By", "MENRO Staff"], ["Staff Name", currentUser?.fullName || currentUser?.name] ].map(([label, value]) => <label key={label}>{label}<input readOnly value={selected ? value === null || value === undefined || String(value).trim() === "" ? "Not recorded" : value : ""} placeholder="Auto-filled after selecting a released request" /></label>)}
        </div>
        {selected && missingRequired.length > 0 && <p role="alert">Required information not recorded: {missingRequired.join(", ")}. An authorized MENRO officer must correct the linked records before submission.</p>}
        {selected && !missingRequired.length && (!selected.participantSector || !selected.siteName || !selected.barangay) && <p role="status">Some requester or site information is not recorded. Ask an authorized MENRO officer to correct the linked records; the form does not infer missing values.</p>}
        {selected?.reportingPolicy?.reporting === "NOT_REQUIRED" && <p role="status">Released ? No Report Required. This official report is voluntary supporting documentation.</p>}
        <label className="pr-field">Confirmation Basis<select value={basis} disabled={!canEdit("confirmationBasis")} {...aria("confirmationBasis")} aria-describedby={["official-basis-help", errors.confirmationBasis && "official-error-confirmationBasis"].filter(Boolean).join(" ")} onChange={event => { setBasis(event.target.value); setErrors({}); submissionKey.current = crypto.randomUUID(); }}><option value="menro-field-report">MENRO Field Report</option>{selected?.requestType === "individual" && <option value="release-based">Individual Release-Based Confirmation</option>}</select><small id="official-basis-help" className="pr-helper-text">{BASIS_HELP[basis]}</small>{commentFor("confirmationBasis") && <small className="pr-correction-comment-note">Admin: {commentFor("confirmationBasis")}</small>}{feedback("confirmationBasis")}</label>
        {items.length > 0 && <div className="pr-official-quantities-intro">
          <h3>Seedlings Planted{items.length > 1 ? ` (${items.length} seedling types)` : ""}</h3>
          <p id="official-quantity-help" className="pr-helper-text">Enter any leftover seedlings for each type. Quantity Planted is calculated automatically: released seedlings minus leftovers.</p>
        </div>}
        {items.map((row, index) => <section className="pr-official-species" key={row.inventoryId} aria-labelledby={`official-species-${index}`}><h3 id={`official-species-${index}`}>{row.species}</h3>
          <div className="pr-official-grid">
            <label>Quantity Released<input readOnly value={row.quantityReleased} /></label><label>Seedlings Available for Reporting<input readOnly value={row.availableQuantity} /></label>
            {!saved && Number(row.availableQuantity) === 0 && <p className="pr-helper-text pr-official-species-note" role="status">All released {row.species || "seedlings"} are already reported. Nothing more to record for this type.</p>}
            <div className="pr-field"><label htmlFor={`official-planted-${index}`}>Quantity Planted *</label><input id={`official-planted-${index}`} readOnly value={plantedFor(row)} {...aria(errors.items ? "items" : `quantityPlanted-${index}`)} />{index === 0 && items.length === 1 && feedback("items")}</div>
            <div className="pr-field"><label htmlFor={`official-leftover-${index}`}>Final Leftover Seedlings (Not Planted)</label><input id={`official-leftover-${index}`} type="number" min="0" max={row.availableQuantity} step="1" value={row.leftoverQuantity} readOnly={!saved && Number(row.availableQuantity) === 0 || !canEdit(`items.${row.inventoryId}.leftoverQuantity`)} onChange={event => changeItem(index, "leftoverQuantity", event.target.value)} {...aria(`leftoverQuantity-${index}`)} aria-describedby={[errors[`leftoverQuantity-${index}`] && `official-error-leftoverQuantity-${index}`, "official-quantity-help"].filter(Boolean).join(" ")} />{commentFor(`items.${row.inventoryId}.leftoverQuantity`) && <small className="pr-correction-comment-note">Admin: {commentFor(`items.${row.inventoryId}.leftoverQuantity`)}</small>}{feedback(`leftoverQuantity-${index}`)}</div>
            {Number(row.leftoverQuantity) > 0 && !leftoverQuantityError(row.leftoverQuantity, row.availableQuantity) && <div className="pr-field pr-official-leftover-reason"><label htmlFor={`official-leftoverReason-${index}`}>Reason for Leftover Seedlings *</label><textarea id={`official-leftoverReason-${index}`} rows={2} maxLength={MAX_LEFTOVER_REASON_LENGTH} value={row.leftoverReason || ""} readOnly={Boolean(saved) || !canEdit(`items.${row.inventoryId}.leftoverReason`)} aria-required="true" placeholder="e.g. seedlings damaged in transport" onChange={event => changeItem(index, "leftoverReason", event.target.value)} {...aria(`leftoverReason-${index}`)} />{commentFor(`items.${row.inventoryId}.leftoverReason`) && <small className="pr-correction-comment-note">Admin: {commentFor(`items.${row.inventoryId}.leftoverReason`)}</small>}{feedback(`leftoverReason-${index}`)}</div>}
          </div>
        </section>)}
        {items.length > 1 && <dl className="pr-official-totals" aria-label="Report totals">
          <div><dt>Seedling Types</dt><dd>{items.length}</dd></div>
          <div><dt>Available for Reporting</dt><dd>{items.reduce((sum, row) => sum + Number(row.availableQuantity || 0), 0)}</dd></div>
          <div><dt>Total Planted</dt><dd>{items.reduce((sum, row) => sum + plantedFor(row), 0)}</dd></div>
          <div><dt>Total Leftover</dt><dd>{items.reduce((sum, row) => sum + (/^\d+$/.test(String(row.leftoverQuantity).trim()) ? Number(row.leftoverQuantity) : 0), 0)}</dd></div>
        </dl>}
        {items.length > 1 && feedback("items")}
      </fieldset>
      {basis === "menro-field-report" && evidenceCarried && <p className="pr-helper-text pr-carried-evidence" role="status">Verified planting evidence from the returned report is carried forward unchanged.</p>}
      {basis === "menro-field-report" && !evidenceCarried && <OfficialPlantingPhotos key={selected?.requestId || "no-release"} site={selected} photos={photos} onChange={next => { setPhotos(next); photoKey.current = crypto.randomUUID(); }} error={errors.photos} onError={message => setErrors(current => ({ ...current, photos: message }))} disabled={saving || photoSaved || photoRetryBound} />}
      <fieldset disabled={saving || Boolean(saved)} style={{ border: 0, margin: 0, padding: 0 }}>
        <section className="pr-section pr-section-last pr-report-additional-section" aria-labelledby="official-additional-heading">
          <div className="pr-section-header"><h3 id="official-additional-heading"><FiFileText size={15} /> Additional Information</h3></div>
          <div className="pr-field"><label htmlFor="official-remarks" className="pr-label">Remarks</label><textarea id="official-remarks" className="pr-textarea" value={remarks} readOnly={!canEdit("remarks")} maxLength={2000} placeholder="Add notes about the planting activity, if necessary..." {...aria("remarks")} onChange={event => { setRemarks(event.target.value); setErrors(current => ({ ...current, remarks: "" })); submissionKey.current = crypto.randomUUID(); }} />{commentFor("remarks") && <small className="pr-correction-comment-note">Admin: {commentFor("remarks")}</small>}{feedback("remarks")}</div>
        </section>
      </fieldset>
      {attendanceCarried && <p className="pr-helper-text" role="status">Attendance documentation from the returned report is kept.</p>}
      {!attendanceCarried && <AttendanceUpload file={file} onChange={setFile} error={errors.attendance} onError={message => setErrors(current => ({ ...current, attendance: message }))} disabled={saving} />}
      <div className="pr-official-actions"><button type="button" className="pr-secondary-button" onClick={onClose} disabled={saving}>Close</button>{!saved && <button type="button" className="pr-secondary-button" onClick={refresh} disabled={saving}>Refresh Releases</button>}<button type="submit" className="pr-primary-button" disabled={saving || !options.length}>{saving ? "Saving…" : saved ? basis === "menro-field-report" && !photoSaved ? "Upload Evidence for Saved Report" : file ? "Retry Attendance Upload" : "Finish Saved Report" : "Submit for Admin Verification"}</button></div>
    </form>}
  </section></ModalDialog>;
}

export function ProtectedAttendanceButton({ submissionId, official = true }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function download() {
    if (busy) return; setBusy(true); setError("");
    try {
      const response = await authenticatedFetch(`/planting-reports/${official ? "official" : "submissions"}/${encodeURIComponent(submissionId)}/attendance`);
      if (!response.ok) throw new Error("Attendance is unavailable or access was denied.");
      const blob = await response.blob(); if (!["application/pdf", "image/jpeg", "image/png"].includes(blob.type)) throw new Error("Attendance file type could not be verified.");
      const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = `attendance.${blob.type === "application/pdf" ? "pdf" : blob.type === "image/png" ? "png" : "jpg"}`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <div><button type="button" className="pr-secondary-button" onClick={download} disabled={busy}>{busy ? "Loading Attendance…" : "Download Private Attendance"}</button>{error && <small className="pr-field-error" role="alert">{error}</small>}</div>;
}
