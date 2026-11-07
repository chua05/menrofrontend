import OfficialPlantingPhotos from "./OfficialPlantingPhotos";
import AttendanceUpload from "./AttendanceUpload";
import ModalDialog from "./ModalDialog";
import { attendanceFileError } from "../utils/attendanceFile";
import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "../services/authenticatedApi";
import { backendFieldErrors, focusFirstInvalid } from "../utils/formValidation";
import "../styles/official-planting.css";
async function api(path, options) {
  const response = await authenticatedFetch(path, options), body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true) throw Object.assign(new Error(response.status >= 500 ? "Official planting reporting is temporarily unavailable." : body?.message || "Unable to save the official report."), { status: response.status, fieldErrors: body?.fieldErrors });
  return body?.data;
}
const whole = value => /^\d+$/.test(String(value).trim()) && Number.isSafeInteger(Number(value));
async function optionsPage(path) {
  const page = await api(path);
  if (!Array.isArray(page?.options) || page.options.some(row => !row.requestId || !Array.isArray(row.items)) || page.nextCursor !== null && typeof page.nextCursor !== "string") throw new Error("Authorized releases could not be loaded. Please retry.");
  return page;
}
export default function StaffPlantingReportForm({ currentUser, onClose, onSaved, correction, resumeEvidence }) {
  const reference = correction || resumeEvidence;
  const [options, setOptions] = useState([]), [loading, setLoading] = useState(true), [selectedId, setSelectedId] = useState(reference?.requestId || "");
  const [nextCursor, setNextCursor] = useState(null), [loadingMore, setLoadingMore] = useState(false);
  const [items, setItems] = useState([]), [basis, setBasis] = useState("menro-field-report"), [remarks, setRemarks] = useState("");
  const [file, setFile] = useState(null), [errors, setErrors] = useState({}), [error, setError] = useState(""), [saving, setSaving] = useState(false), [saved, setSaved] = useState(resumeEvidence ? { officialSubmissionIds: [resumeEvidence.id] } : null);
  const [photos, setPhotos] = useState([]), [photoSaved, setPhotoSaved] = useState(false);
  const [photoRetryBound, setPhotoRetryBound] = useState(false);
  const photoKey = useRef(crypto.randomUUID());
  const root = useRef(null), submissionKey = useRef(crypto.randomUUID());
  const selected = options.find(row => row.requestId === selectedId);
  const missingRequired = selected ? ["requesterName", "requestId", "eventId", "siteId", "plantingDate"].filter(key => !String(selected[key] || "").trim()) : [];
  if (selected && basis === "menro-field-report" && (!Number.isFinite(selected.latitude) || !Number.isFinite(selected.longitude))) missingRequired.push("site coordinates");
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
        setItems((source?.items || []).filter(row => row.inventoryId === reference.inventoryId).map(row => ({ ...row, quantityPlanted: String(reference.quantity || 0), leftoverQuantity: String(reference.leftoverQuantity || 0) })));
      }
    }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reference]);
  async function more() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true); setError("");
    try { const page = await optionsPage(`/planting-reports/official/options?cursor=${encodeURIComponent(nextCursor)}`); setOptions(rows => [...new Map([...rows, ...page.options].map(row => [row.requestId, row])).values()]); setNextCursor(page.nextCursor); }
    catch (failure) { setError(failure.message); } finally { setLoadingMore(false); }
  }
  function choose(id) {
    setSelectedId(id); setItems((options.find(row => row.requestId === id)?.items || []).filter(row => !correction || row.inventoryId === correction.inventoryId).map(row => ({ ...row, quantityPlanted: "0", leftoverQuantity: "0" })));
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
      if (!whole(row.leftoverQuantity)) validation[`leftoverQuantity-${index}`] = "Enter a nonnegative whole number.";
      if (basis === "menro-field-report" && !whole(row.quantityPlanted)) validation[`quantityPlanted-${index}`] = "Enter a nonnegative whole number.";
      if ((basis === "release-based" ? 0 : Number(row.quantityPlanted)) + Number(row.leftoverQuantity) > row.availableQuantity) validation[`${basis === "release-based" ? "leftoverQuantity" : "quantityPlanted"}-${index}`] = "Planted plus leftovers exceed the available balance.";
    });
    if (!saved && selected && items.every(row => Number(row.quantityPlanted) + Number(row.leftoverQuantity) === 0) && basis !== "release-based") validation.items = "Enter at least one planted or leftover quantity.";
    if (basis === "menro-field-report" && !photoSaved && (!photos.length || photos.some(photo => !["ready", "verified"].includes(photo.status)))) validation.photos = "Add and verify original planting photos for the MENRO Field Report.";
    if (attendanceFileError(file) || errors.attendance) validation.attendance = attendanceFileError(file) || errors.attendance;
    setErrors(validation);
    if (Object.keys(validation).length) return focusFirstInvalid(() => root.current);
    setSaving(true); setError("");
    let report = saved;
    try {
      if (!report) {
        report = await api("/planting-reports/official", { method: "POST", body: JSON.stringify({ requestId: selected.requestId, items: items.map(row => ({ inventoryId: row.inventoryId, quantityPlanted: Number(row.quantityPlanted), leftoverQuantity: Number(row.leftoverQuantity) })), confirmationBasis: basis, remarks, expectedVersion: selected.expectedVersion, clientSubmissionId: submissionKey.current, ...(correction ? { correctionOf: correction.id } : {}) }) });
        setSaved(report);
      }
      if (basis === "menro-field-report" && !photoSaved) {
        setPhotoRetryBound(true);
        const photoData = new FormData(); photos.forEach(photo => photoData.append("photos", photo.file));
        photoData.append("evidenceManifest", JSON.stringify(photos.map(photo => photo.descriptor)));
        photoData.append("expectedRevision", String(resumeEvidence ? Number(resumeEvidence.revision || 0) : correction ? Number(correction.revision || 0) + 1 : 0));
        await api(`/planting-reports/official/${encodeURIComponent(report.officialSubmissionIds[0])}/photos`, { method: "PUT", body: photoData, headers: { "Idempotency-Key": photoKey.current } });
        setPhotoSaved(true);
      }
      if (file) {
        const data = new FormData(); data.append("attendance", file);
        await api(`/planting-reports/official/${encodeURIComponent(report.officialSubmissionIds[0])}/attendance`, { method: "PUT", body: data });
      }
      await onSaved(report); onClose();
    } catch (failure) {
      if ([400, 422].includes(failure.status) && !photoSaved) setPhotoRetryBound(false);
      const fields = backendFieldErrors(failure);
      if (fields.items && items.length) { fields[`${basis === "release-based" ? "leftoverQuantity" : "quantityPlanted"}-0`] = fields.items; delete fields.items; }
      if (Object.keys(fields).length) { setErrors(fields); focusFirstInvalid(() => root.current); }
      else setError(report ? `The report is saved pending Admin verification. ${failure.message} Retry the same evidence with the same upload intent; do not submit the quantities again.` : failure.status === 409 ? `${failure.message} Refresh releases before correcting the report.` : failure.message);
    } finally { setSaving(false); }
  }
  return <ModalDialog className="pr-official-backdrop" label={title} onClose={onClose} dismissible={!saving} busy={saving}><section className="pr-official-dialog">
    <h2 id="official-planting-title">{title}</h2>
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
        <label className="pr-field">Confirmation Basis<select value={basis} {...aria("confirmationBasis")} onChange={event => { setBasis(event.target.value); setErrors({}); submissionKey.current = crypto.randomUUID(); }}><option value="menro-field-report">MENRO Field Report</option>{selected?.requestType === "individual" && <option value="release-based">Individual Release-Based Confirmation</option>}</select>{feedback("confirmationBasis")}</label>
        {basis === "release-based" && <p>Planted quantity is derived by the backend from the remaining released balance, excluding declared leftovers. This is release-based confirmation, not a field observation.</p>}
        {items.map((row, index) => <section className="pr-official-species" key={row.inventoryId} aria-labelledby={`official-species-${index}`}><h3 id={`official-species-${index}`}>{row.species}</h3>
          <div className="pr-official-grid">
            <label>Quantity Released<input readOnly value={row.quantityReleased} /></label><label>Seedlings Available for Reporting<input readOnly value={row.availableQuantity} /></label>
            <div className="pr-field"><label htmlFor={`official-planted-${index}`}>Quantity Planted *</label><input id={`official-planted-${index}`} type="number" min="0" step="1" readOnly={basis === "release-based"} value={basis === "release-based" ? Math.max(0, row.availableQuantity - Number(row.leftoverQuantity || 0)) : row.quantityPlanted} onChange={event => changeItem(index, "quantityPlanted", event.target.value)} {...aria(errors.items ? "items" : `quantityPlanted-${index}`)} />{feedback(`quantityPlanted-${index}`)}{index === 0 && feedback("items")}</div>
            <div className="pr-field"><label htmlFor={`official-leftover-${index}`}>Leftover Seedlings (Not Planted) *</label><input id={`official-leftover-${index}`} type="number" min="0" step="1" value={row.leftoverQuantity} onChange={event => changeItem(index, "leftoverQuantity", event.target.value)} {...aria(`leftoverQuantity-${index}`)} />{feedback(`leftoverQuantity-${index}`)}</div>
          </div>
        </section>)}

      </fieldset>
      {basis === "menro-field-report" && <OfficialPlantingPhotos key={selected?.requestId || "no-release"} site={selected} photos={photos} onChange={next => { setPhotos(next); photoKey.current = crypto.randomUUID(); }} error={errors.photos} onError={message => setErrors(current => ({ ...current, photos: message }))} disabled={saving || photoSaved || photoRetryBound} />}
      <fieldset disabled={saving || Boolean(saved)} style={{ border: 0, margin: 0, padding: 0 }}><h3>Additional Information</h3>
        <label className="pr-field">Remarks<textarea value={remarks} maxLength={2000} {...aria("remarks")} onChange={event => { setRemarks(event.target.value); setErrors(current => ({ ...current, remarks: "" })); submissionKey.current = crypto.randomUUID(); }} />{feedback("remarks")}</label>
      </fieldset>
      <AttendanceUpload file={file} onChange={setFile} error={errors.attendance} onError={message => setErrors(current => ({ ...current, attendance: message }))} disabled={saving} />
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
