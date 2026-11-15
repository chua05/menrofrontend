import { useEffect, useState } from "react";
import { FiActivity } from "react-icons/fi";
import { authenticatedFetch } from "../services/authenticatedApi";
import { describeMonitoringStatus, needsCohortLookup } from "../utils/monitoringStatus";

async function readData(path) {
  const response = await authenticatedFetch(path);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error("unavailable");
  return payload.data;
}

// Read-only Monitoring Status for a verified report, shown to MENRO Staff and Admin only.
// It has no actions: monitoring work happens through the single Survival Monitoring button,
// and sampling plans/baselines through the Permanent Sample Monitoring Setup section.
export default function MonitoringStatusSection({ report, cohortEnabled }) {
  const lookup = needsCohortLookup(report, cohortEnabled);
  const reportId = report?.id;
  // Results are keyed by report so a different report never shows another report's status.
  const [results, setResults] = useState({ key: null });

  useEffect(() => {
    if (!lookup) return undefined;
    let active = true;
    const update = patch => active && setResults(current => ({ ...(current.key === reportId ? current : { key: reportId }), ...patch }));
    readData("/verified-planting-cohorts")
      .then(data => update({ cohortState: "ready", cohorts: Array.isArray(data) ? data : [] }))
      .catch(() => update({ cohortState: "error" }));
    readData("/verified-sample-monitoring/readiness")
      .then(data => update({ readinessState: "ready", readiness: data }))
      .catch(() => update({ readinessState: "error" }));
    return () => { active = false; };
  }, [lookup, reportId]);

  const current = results.key === reportId ? results : {};
  const status = describeMonitoringStatus({ report, cohortEnabled,
    cohortState: current.cohortState || "loading", cohorts: current.cohorts || [],
    readinessState: current.readinessState || "loading", readiness: current.readiness || null });
  return (
    <section className="pr-drawer-section pr-monitoring-status" aria-labelledby="pr-monitoring-status-title" data-monitoring-policy={status.policy}>
      <div className="pr-drawer-section-title" id="pr-monitoring-status-title">
        <FiActivity size={15} />
        Monitoring Status
      </div>
      <dl className="pr-monitoring-status-list">
        <div className="pr-monitoring-status-row"><dt>Monitoring requirement</dt><dd>{status.requirement}</dd></div>
        {status.rows.map(row => <div key={row.label} className="pr-monitoring-status-row"><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
      </dl>
      {status.notes.map(note => <p key={note} className="pr-monitoring-status-note">{note}</p>)}
      {status.reasons.length > 0 && (
        <ul className="pr-monitoring-status-reasons" aria-label="Why no monitoring visit is available">
          {status.reasons.map(reason => <li key={reason}>{reason}</li>)}
        </ul>
      )}
    </section>
  );
}
