import { reportingCoverage } from "../utils/reportingCoverage";
export default function ReportingCoveragePanel({ requests, reports, distributions }) {
  const summary = reportingCoverage(requests, reports, distributions);
  if (!summary.rows.length) return null;
  return <section className="dashboard-card"><h2>Planting Confirmation and Reporting Coverage</h2>
    <p>Required confirmations: {summary.completedRequired} completed of {summary.required}. Coverage: {summary.coverage === null ? "Not applicable" : `${Math.round(summary.coverage * 100)}%`}. No report required: {summary.noReportRequired}. Optional: {summary.optional}. Pending policy: {summary.pendingPolicy}.</p>
    <p>Missing documentation is not verified zero planting. These balances do not change official historical KPIs.</p>
    <div className="overflow-x-auto"><table><thead><tr>{["Request", "Seedlings Distributed", "Planted (Reported)", "MENRO-Confirmed Planted", "Final Leftover", "Remaining for Future Planting", "Reporting Status"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{summary.rows.map(row => <tr key={row.requestId}><td>{row.requestId}</td>{[row.released, row.reportedPlanted, row.confirmedPlanted, row.finalLeftovers, row.remainingForFuturePlanting].map((value, index) => <td key={index}>{value ?? "Not yet verified / unavailable"}</td>)}<td>{row.status}</td></tr>)}</tbody></table></div>
  </section>;
}
