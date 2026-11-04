import { useEffect, useState } from "react";
import { sampleRequest } from "../services/permanentSampleApi";

export default function PermanentSampleAnalyticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [site, setSite] = useState("");
  const [cohort, setCohort] = useState("");
  useEffect(() => {
    let active = true;
    sampleRequest("/permanent-sample-analytics").then(value => { if (active) setData(value); })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, []);
  const visible = (data?.cohorts || []).filter(row => (!site || row.siteId === site) && (!cohort || row.cohortId === cohort));
  return <main className="space-y-4 p-4">
    <h1 className="text-2xl font-semibold">Permanent Sample Monitoring Analytics</h1>
    <p>Approved permanent samples only. No whole-site survival estimates or official KPI projections.</p>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">Loading approved monitoring analytics…</p>}
    {data && <>
      <div className="flex flex-wrap gap-4">
        <label>Site <select aria-label="Site" value={site} onChange={e => { setSite(e.target.value); setCohort(""); }} className="rounded border p-2">
          <option value="">All authorized sites</option>{[...new Set(data.cohorts.map(row => row.siteId))].map(id => <option key={id}>{id}</option>)}
        </select></label>
        <label>Cohort <select aria-label="Cohort" value={cohort} onChange={e => setCohort(e.target.value)} className="rounded border p-2">
          <option value="">All authorized cohorts</option>{data.cohorts.filter(row => !site || row.siteId === site).map(row => <option key={row.cohortId}>{row.cohortId}</option>)}
        </select></label>
      </div>
      {!visible.length && <p>No authorized approved permanent-sample visits are available.</p>}
      {visible.map(row => <section key={row.cohortId} className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">{row.cohortId}</h2><p>Site: {row.siteId}</p>
        <p>{row.latest.assessed}/{row.latest.total} samples assessed ({Math.round(row.latest.coverage * 100)}% coverage)</p>
        <p>Unassessed: {row.latest.unassessed} · Unresolved: {row.latest.unresolved}</p>
        <dl className="my-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(row.latest.counts).map(([condition, count]) => <div key={condition} className="rounded bg-emerald-50 p-2"><dt>{condition}</dt><dd>{count}</dd></div>)}</dl>
        <h3>Approved visit history</h3>
        {row.history.map(visit => <details key={visit.visitId} className="my-2 rounded border p-2">
          <summary>{visit.visitDate} · {visit.assessed}/{visit.total} assessed</summary>
          <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Permanent tree</th><th>Condition</th><th>Change from prior</th><th>Evidence revisions</th></tr></thead>
            <tbody>{visit.samples.map(sample => <tr key={sample.sampleId}><td>{sample.sampleId}</td><td>{sample.condition || "Unassessed"}{sample.investigationOutcome && ` · ${sample.investigationOutcome}`}</td><td>{sample.changedFrom || "—"}</td><td>{sample.evidenceRevisions.length ? sample.evidenceRevisions.join(", ") : "No linked evidence"}</td></tr>)}</tbody></table></div>
        </details>)}
      </section>)}
      <ul className="text-sm text-slate-600">{data.limitations.map(item => <li key={item}>{item}</li>)}</ul>
    </>}
  </main>;
}
