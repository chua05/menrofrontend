export default function PurposePolicyFields({ value, onChange, candidate, label = "Reporting policy decision" }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return <fieldset className="sr-form-grid"><legend>{label}</legend>
    {candidate && <p className="full-width">Purpose: {candidate.purpose}</p>}
    <label className="sr-form-field"><span>Reporting Requirement</span><select value={value.reporting || ""} onChange={event => set("reporting", event.target.value)}><option value="">Use approved purpose policy</option>{["REQUIRED", "OPTIONAL", "NOT_REQUIRED"].map(item => <option key={item}>{item}</option>)}</select></label>
    <label className="sr-form-field"><span>Monitoring Requirement</span><select value={value.monitoring || ""} onChange={event => set("monitoring", event.target.value)}><option value="">Use approved purpose policy</option>{["NONE", "STAFF_SPOT_CHECK", "PERMANENT_SAMPLE"].map(item => <option key={item}>{item}</option>)}</select></label>
    <label className="sr-form-field full-width"><span>Policy Decision Reason</span><textarea value={value.reason || ""} maxLength={1000} onChange={event => set("reason", event.target.value)} placeholder="Explain the selected reporting and monitoring requirements." /></label>
  </fieldset>;
}
