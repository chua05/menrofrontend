import { useEffect, useState } from "react";
import { authenticatedFetch } from "../services/authenticatedApi";
async function api(options) {
  const response = await authenticatedFetch("/purpose-policies", options); const body = await response.json();
  if (!response.ok) throw new Error(body.message || "Policy settings unavailable."); return body.data;
}
export default function PurposePolicySettings() {
  const [data, setData] = useState(null), [error, setError] = useState(""), [saving, setSaving] = useState(false), [reason, setReason] = useState("");
  useEffect(() => { let active = true; api().then(value => { if (active) setData(value); }).catch(failure => { if (active) setError(failure.message); }); return () => { active = false; }; }, []);
  function purpose(index, field, value) { setData(current => ({ ...current, purposes: current.purposes.map((row, i) => i === index ? { ...row, [field]: value } : row) })); }
  async function save(event) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError("");
    try { const updated = await api({ method: "PUT", body: JSON.stringify({ expectedVersion: data.version, purposes: data.purposes, sampling: data.sampling, effectiveDate: data.effectiveDate, reason }) }); setData(updated); setReason(""); }
    catch (failure) { setError(failure.message); } finally { setSaving(false); }
  }
  return <section className="settings-card"><h2>Purpose Reporting and Permanent Sample Policies</h2><p>Admin-only, versioned settings for new approvals. Unapproved thresholds, minimums and procedures remain pending. This does not activate automatic sampling or visit creation.</p>
    {error && <p role="alert">{error}</p>}{!data ? !error && <p role="status">Loading purpose policies…</p> : <form onSubmit={save}>
      <p>Policy version: {data.version} · Updated by: {data.updatedBy || "Initial template awaiting Admin configuration"}</p>
      <label>Effective Date<input type="date" required value={data.effectiveDate || ""} onChange={event => setData(current => ({ ...current, effectiveDate: event.target.value }))} /></label>
      {data.purposes.map((row, index) => <fieldset key={row.purpose} className="settings-card"><legend>{row.purpose}</legend>
        <label>Reporting<select value={row.reporting} onChange={event => purpose(index, "reporting", event.target.value)}>{["REQUIRED", "OPTIONAL", "NOT_REQUIRED", "CONDITIONAL"].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Monitoring<select value={row.monitoring} onChange={event => purpose(index, "monitoring", event.target.value)}>{["NONE", "STAFF_SPOT_CHECK", "PERMANENT_SAMPLE"].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Released Quantity Threshold (unapproved: leave blank)<input type="number" min="1" step="1" value={row.quantityThreshold ?? ""} onChange={event => purpose(index, "quantityThreshold", event.target.value === "" ? null : Number(event.target.value))} /></label>
        <label>Organization-specific Reporting<select value={row.organizationCondition?.reporting || ""} onChange={event => purpose(index, "organizationCondition", event.target.value ? { reporting: event.target.value, monitoring: "NONE", reason: "" } : null)}><option value="">Pending explicit per-request Admin decision</option>{["REQUIRED", "OPTIONAL", "NOT_REQUIRED"].map(value => <option key={value}>{value}</option>)}</select></label>
        {row.organizationCondition && <><label>Organization Monitoring<select value={row.organizationCondition.monitoring} onChange={event => purpose(index, "organizationCondition", { ...row.organizationCondition, monitoring: event.target.value })}>{["NONE", "STAFF_SPOT_CHECK", "PERMANENT_SAMPLE"].map(value => <option key={value}>{value}</option>)}</select></label><label>Organization Policy Reason<input required value={row.organizationCondition.reason} maxLength={1000} onChange={event => purpose(index, "organizationCondition", { ...row.organizationCondition, reason: event.target.value })} /></label></>}
      </fieldset>)}
      <fieldset className="settings-card"><legend>New Permanent Sample Cohorts</legend>{[["percentage", "Sampling Percentage", 0.01, 100], ["minimum", "Minimum Sample Count (pending if blank)", 1, 10000], ["firstVisitDelayWeeks", "First Visit Delay in Weeks (pending if blank)", 0, 10000], ["intervalMonths", "Later Visit Interval in Months", 1, 120]].map(([key, label, min, max]) => <label key={key}>{label}<input type="number" min={min} max={max} step={key === "percentage" ? "any" : "1"} value={data.sampling[key] ?? ""} onChange={event => setData(current => ({ ...current, sampling: { ...current.sampling, [key]: event.target.value === "" ? null : Number(event.target.value) } }))} /></label>)}
        {[["speciesAllocationProcedure", "Approved Species Allocation Procedure"], ["physicalSelectionProcedure", "Approved Physical Random Selection Procedure"]].map(([key, label]) => <label key={key}>{label}<textarea value={data.sampling[key] || ""} maxLength={2000} onChange={event => setData(current => ({ ...current, sampling: { ...current.sampling, [key]: event.target.value.trim() ? event.target.value : null } }))} /></label>)}
      </fieldset>
      <label>Audit Reason<textarea required value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} /></label><button type="submit" disabled={saving}>{saving ? "Saving Policy…" : "Save Versioned Purpose Policy"}</button>
    </form>}
  </section>;
}
