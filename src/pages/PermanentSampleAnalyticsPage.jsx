import { useEffect, useState } from "react";
import { sampleRequest } from "../services/permanentSampleApi";

export default function PermanentSampleAnalyticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [site, setSite] = useState("");
  const [cohort, setCohort] = useState("");
  const [options, setOptions] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(false);
  useEffect(() => {
    let active = true;
    sampleRequest("/permanent-sample-analytics/filters").then(value => {
      if (!active) return;
      setOptions(value.filters); setCursor(value.nextCursor);
      setSite(value.filters[0]?.siteId || ""); setCohort(value.filters[0]?.cohortId || ""); setReady(true);
    })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const query = new URLSearchParams();
    if (site) query.set("siteId", site);
    if (cohort) query.set("cohortId", cohort);
    sampleRequest(`/permanent-sample-analytics?${query}`).then(value => { if (active) setData(value); })
      .catch(error => { if (active) { setData(null); setError(error.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready, site, cohort]);
  async function moreOptions() {
    if (!cursor || loadingOptions) return;
    setLoadingOptions(true);
    try {
      const value = await sampleRequest(`/permanent-sample-analytics/filters?cursor=${encodeURIComponent(cursor)}`);
      setOptions(previous => [...new Map([...previous, ...value.filters].map(row => [JSON.stringify([row.siteId, row.cohortId]), row])).values()]);
      setCursor(value.nextCursor);
    } catch (error) { setError(error.message); }
    finally { setLoadingOptions(false); }
  }
  const visible = data?.cohorts || [];
  function changeFilters(nextSite, nextCohort) {
    if (nextSite === site && nextCohort === cohort) return;
    setLoading(true); setError(""); setSite(nextSite); setCohort(nextCohort);
  }
  return <main className="space-y-4 p-4">
    <h1 className="text-2xl font-semibold">Permanent Sample Monitoring Analytics</h1>
    <p>Approved permanent samples only. No whole-site survival estimates or official KPI projections.</p>
    {error && <p role="alert">{error}</p>}
    {loading && !error && <p role="status">Loading approved monitoring analytics…</p>}
    {ready && <>
      <div className="flex flex-wrap gap-4">
        <label>Site <select aria-label="Site" value={site} onChange={e => changeFilters(e.target.value, "")} className="rounded border p-2">
          <option value="">All authorized sites</option>{[...new Set(options.map(row => row.siteId))].map(id => <option key={id}>{id}</option>)}
        </select></label>
        <label>Cohort <select aria-label="Cohort" value={cohort} onChange={e => changeFilters(site, e.target.value)} className="rounded border p-2">
          <option value="">All authorized cohorts</option>{options.filter(row => !site || row.siteId === site).map(row => <option key={row.cohortId}>{row.cohortId}</option>)}
        </select></label>
      </div>
      {cursor && <button disabled={loadingOptions} onClick={moreOptions}>{loadingOptions ? "Loading filters…" : "Load more filter options"}</button>}
      {!loading && !error && !visible.length && <p>No authorized approved permanent-sample visits are available.</p>}
      {!loading && !error && visible.map(row => <section key={row.cohortId} className="rounded-xl border bg-white p-4">
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
      {data?.exclusions?.cohorts > 0 && <p role="status">Excluded cohorts: {data.exclusions.cohorts}. {Object.entries(data.exclusions.reasons).map(([reason, count]) => `${reason}: ${count}`).join("; ")}</p>}
      <ul className="text-sm text-slate-600">{data?.limitations.map(item => <li key={item}>{item}</li>)}</ul>
    </>}
  </main>;
}
