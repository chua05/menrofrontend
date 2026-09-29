import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertCircle, FiBarChart2, FiCalendar, FiDownload, FiGrid, FiMapPin, FiPackage, FiRefreshCw, FiShield, FiTrendingUp } from "react-icons/fi";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../context/AuthContext";
import { authenticatedFetch } from "../services/authenticatedApi";
import AnalyticsSitesMap from "../components/analytics/AnalyticsSitesMap";
import "../styles/reforestation-analytics.css";

const REFRESH_INTERVAL_MS = 60_000;
const CONDITION_COLORS = { Healthy: "#2f9e57", Damaged: "#f3a62f", Dead: "#e54848" };
const SPECIES_COLORS = ["#2f9e57", "#68b978", "#22856f", "#8fc8b2", "#efb34c", "#6d83d2", "#9a78d3", "#d88352"];
const EMPTY_ANALYTICS = { summary: {}, plantingTrend: [], survivalTrend: [], monitoringConditions: [], speciesDistribution: [], barangaySurvival: [], siteMap: [], verificationAnalytics: {}, accountability: {}, decisionSupport: {}, options: { barangays: [], species: [], sites: [] }, meta: {} };
const EMPTY_FILTERS = { dateFrom: "", dateTo: "", barangay: "All", species: "All", site: "All" };
const formatNumber = (value) => new Intl.NumberFormat("en-PH").format(Number(value) || 0);
const displayRate = (value) => value == null ? "" : `${formatNumber(value)}%`;
const escapeCsv = (value) => /[",\n]/.test(String(value ?? "")) ? `"${String(value ?? "").replace(/"/g, '""')}"` : String(value ?? "");

function EmptyRing({ label }) {
  return <div className="ra-donut-chart ra-zero-ring-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ value: 1 }]} dataKey="value" innerRadius={55} outerRadius={82} isAnimationActive={false}><Cell fill="#e5e9e7" /></Pie></PieChart></ResponsiveContainer><div className="ra-zero-ring-center"><strong>0</strong><span>{label}</span></div></div>;
}
function ChartMessage({ children }) { return <div className="ra-chart-message">{children}</div>; }
function Kpi({ icon: Icon, iconClass, label, value, note, percent = false }) {
  const displayed = value == null ? "" : `${formatNumber(value)}${percent ? "%" : ""}`;
  return <div className="ra-kpi-card"><div className={`ra-kpi-icon ${iconClass}`}><Icon size={20} /></div><div><span>{label}</span><strong>{displayed}</strong><small>{note}</small></div></div>;
}
function StatusBadge({ status }) {
  if (!status) return <span className="ra-status neutral">Not Yet Monitored</span>;
  const tone = status === "Healthy" ? "good" : status === "Critical" ? "critical" : "warning";
  return <span className={`ra-status ${tone}`}>{status}</span>;
}

export default function ReforestationAnalyticsPage() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const mounted = useRef(true);
  const requestSequence = useRef(0);
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const loadAnalytics = useCallback(async ({ foreground = false } = {}) => {
    const requestId = ++requestSequence.current;
    if (foreground) setLoading(true); else setRefreshing(true);
    try {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([name, value]) => { if (value && value !== "All") query.set(name, value); });
      const response = await authenticatedFetch(`/analytics/dashboard?${query}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.data?.summary) throw new Error(payload.message || "Unable to load analytics.");
      if (mounted.current && requestId === requestSequence.current) { setAnalytics(payload.data); setLoadError(""); setHasLoaded(true); }
    } catch (error) {
      console.error("Analytics refresh failed:", error);
      if (mounted.current && requestId === requestSequence.current) setLoadError("Unable to load current analytics records. Please try again.");
    } finally {
      if (mounted.current && requestId === requestSequence.current) { setLoading(false); setRefreshing(false); }
    }
  }, [filters]);

  useEffect(() => {
    mounted.current = true;
    const initialLoad = window.setTimeout(() => loadAnalytics({ foreground: !hasLoaded }), 0);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") loadAnalytics(); }, REFRESH_INTERVAL_MS);
    const handleFocus = () => loadAnalytics();
    window.addEventListener("focus", handleFocus);
    return () => { mounted.current = false; requestSequence.current += 1; window.clearTimeout(initialLoad); window.clearInterval(interval); window.removeEventListener("focus", handleFocus); };
  }, [loadAnalytics, hasLoaded]);

  const summary = analytics.summary || {};
  const decision = useMemo(() => analytics.decisionSupport || {}, [analytics.decisionSupport]);
  const verification = analytics.verificationAnalytics || {};
  const accountability = analytics.accountability || {};
  const options = analytics.options || EMPTY_ANALYTICS.options;
  const conditions = analytics.monitoringConditions || [];
  const speciesRows = analytics.speciesDistribution || [];
  const conditionTotal = conditions.reduce((total, item) => total + Number(item.count || 0), 0);
  const speciesTotal = speciesRows.reduce((total, item) => total + Number(item.planted || 0), 0);
  const routeBase = `/${userRole || "staff"}`;
  const decisionRows = useMemo(() => {
    const rows = [];
    if (decision.pendingPlantingReports > 0) rows.push({ title: "Pending Planting Verification", text: `${formatNumber(decision.pendingPlantingReports)} planting report(s) are waiting for MENRO Staff review.`, label: "View Reports", route: `${routeBase}/planting-reports` });
    if (decision.eligibleWithoutSubmission > 0) rows.push({ title: "Overdue Monitoring", text: `${formatNumber(decision.eligibleWithoutSubmission)} eligible planting record(s) have no required monitoring submission.`, label: "View Sites", route: `${routeBase}/planting-sites` });
    if (decision.damagedTrees > 0 || decision.deadTrees > 0) rows.push({ title: "Tree Condition Requires Review", text: `${formatNumber(decision.damagedTrees)} damaged and ${formatNumber(decision.deadTrees)} dead tree(s) appear in the latest monitoring records.`, label: "View Details", route: `${routeBase}/survival-monitoring` });
    if (decision.distributionPlantingDifference > 0) rows.push({ title: "Distribution vs Verified Planting", text: `${formatNumber(decision.distributionPlantingDifference)} released sapling(s) are not yet represented in verified planting records.`, label: "View Reports", route: `${routeBase}/planting-reports` });
    return rows;
  }, [decision, routeBase]);

  const updateFilter = (name) => (event) => setFilters((current) => ({ ...current, [name]: event.target.value }));
  const exportAnalyticsCsv = () => {
    const rows = [["Analytics & Decision Support"], ["Generated", analytics.meta?.generatedAt || ""], [], ["Summary", "Value"], ["Total Saplings Distributed", summary.totalSaplingsDistributed], ["Total Trees Planted", summary.totalTreesPlanted], ["Overall Survival Rate", summary.overallSurvivalRate == null ? "" : `${summary.overallSurvivalRate}%`], ["Verified Planting Reports", summary.verifiedPlantingReports], ["Barangays Covered", summary.barangaysCovered], ["Active Planting Sites", summary.activePlantingSites], [], ["Sapling Tree", "Planted", "Monitored", "Survived", "Survival Rate"], ...speciesRows.map((item) => [item.species, item.planted, item.monitored, item.survived, item.survivalRate == null ? "" : `${item.survivalRate}%`])];
    const blob = new Blob([rows.map((row) => row.map(escapeCsv).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "reforestation-analytics.csv"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  if (loading && !hasLoaded) return <div className="ra-page"><div className="ra-centered-state">Loading analytics…</div></div>;
  if (loadError && !hasLoaded) return <div className="ra-page"><div className="ra-centered-state" role="alert"><span>{loadError}</span><button className="ra-secondary-button" onClick={() => loadAnalytics({ foreground: true })}>Retry</button></div></div>;

  return <div className="ra-page">
    <div className="ra-header"><div className="ra-heading"><div className="ra-heading-icon"><FiTrendingUp size={21} /></div><div><h1>Reforestation Analytics</h1><p>Operational analytics and decision support from current MENRO records</p></div></div><div className="ra-header-actions"><button type="button" className="ra-secondary-button" onClick={exportAnalyticsCsv}><FiDownload size={14} />Export Report</button><button type="button" className="ra-icon-button" onClick={() => loadAnalytics()} disabled={refreshing} aria-label="Refresh analytics"><FiRefreshCw className={refreshing ? "ra-spin" : ""} size={16} /></button></div></div>
    {loadError && <div className="ra-error-banner" role="alert"><FiAlertCircle />{loadError}</div>}
    <div className="ra-filter-card">
      <div className="ra-filter-field"><label>Date Range</label><div className="ra-date-range"><FiCalendar size={14} /><input type="date" value={filters.dateFrom} onChange={updateFilter("dateFrom")} /><span>to</span><input type="date" value={filters.dateTo} onChange={updateFilter("dateTo")} /></div></div>
      <div className="ra-filter-field"><label>Barangay</label><select value={filters.barangay} onChange={updateFilter("barangay")}><option value="All">All Barangays</option>{options.barangays.map((value) => <option key={value}>{value}</option>)}</select></div>
      <div className="ra-filter-field"><label>Sapling Tree</label><select value={filters.species} onChange={updateFilter("species")}><option value="All">All Sapling Trees</option>{options.species.map((value) => <option key={value}>{value}</option>)}</select></div>
      <div className="ra-filter-field"><label>Planting Site</label><select value={filters.site} onChange={updateFilter("site")}><option value="All">All Sites</option>{options.sites.map((site) => <option key={site.value} value={site.value}>{site.label}</option>)}</select></div>
      <div className="ra-clear-wrap"><button type="button" className="ra-secondary-button" onClick={() => setFilters(EMPTY_FILTERS)}>Clear</button><button type="button" className="ra-secondary-button" onClick={() => loadAnalytics()} disabled={refreshing}><FiRefreshCw className={refreshing ? "ra-spin" : ""} />Refresh</button></div>
    </div>
    <div className="ra-kpi-grid">
      <Kpi icon={FiPackage} iconClass="ra-kpi-green" label="Total Saplings Distributed" value={summary.totalSaplingsDistributed} note="Actual released quantity" /><Kpi icon={FiTrendingUp} iconClass="ra-kpi-green" label="Total Trees Planted" value={summary.totalTreesPlanted} note="Verified planting quantity" /><Kpi icon={FiBarChart2} iconClass="ra-kpi-green" label="Overall Survival Rate" value={summary.overallSurvivalRate} note="Based on latest monitoring" percent /><Kpi icon={FiShield} iconClass="ra-kpi-blue" label="Verified Planting Reports" value={summary.verifiedPlantingReports} note="Final Staff-approved only" /><Kpi icon={FiGrid} iconClass="ra-kpi-purple" label="Barangays Covered" value={summary.barangaysCovered} note="With verified planting activity" /><Kpi icon={FiMapPin} iconClass="ra-kpi-orange" label="Active Planting Sites" value={summary.activePlantingSites} note="Registered active sites" />
    </div>
    <div className="ra-chart-grid ra-chart-grid-top">
      <section className="ra-chart-card"><div className="ra-card-heading"><h2>Planting Trend Over Time</h2><p>Verified trees planted in periods with recorded activity</p></div><div className="ra-chart-area">{analytics.plantingTrend.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.plantingTrend}><CartesianGrid strokeDasharray="4 4" vertical={false} /><XAxis dataKey="period" /><YAxis allowDecimals={false} /><Tooltip formatter={(value) => [formatNumber(value), "Trees Planted"]} /><Bar dataKey="count" fill="#2f9e57" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <ChartMessage>No verified planting activity for this selection.</ChartMessage>}</div></section>
      <section className="ra-chart-card"><div className="ra-card-heading"><h2>Survival Rate Trend</h2><p>Actual monitoring records only</p></div><div className="ra-chart-area">{analytics.survivalTrend.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={analytics.survivalTrend}><CartesianGrid strokeDasharray="4 4" vertical={false} /><XAxis dataKey="period" /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value) => [`${value}%`, "Survival Rate"]} /><Line type="monotone" dataKey="rate" stroke="#238b45" strokeWidth={2.5} dot={{ r: 4 }} /></LineChart></ResponsiveContainer> : <ChartMessage>No valid survival monitoring records for this selection.</ChartMessage>}</div></section>
      <section className="ra-chart-card"><div className="ra-card-heading"><h2>Monitoring Condition Summary</h2><p>Latest valid entry per monitoring lifecycle</p></div><div className="ra-donut-layout">{conditionTotal === 0 ? <EmptyRing label="Monitored" /> : <div className="ra-donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={conditions} dataKey="count" nameKey="condition" innerRadius={55} outerRadius={82}>{conditions.map((item) => <Cell key={item.condition} fill={CONDITION_COLORS[item.condition]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>}<div className="ra-legend">{conditions.map((item) => <div className="ra-legend-row" key={item.condition}><span className="ra-legend-dot" style={{ background: CONDITION_COLORS[item.condition] }} /><span>{item.condition}</span><strong>{formatNumber(item.count)}</strong></div>)}<div className="ra-total-box"><span>Total Trees Monitored</span><strong>{formatNumber(conditionTotal)}</strong></div></div></div></section>
    </div>
    <div className="ra-detail-grid">
      <section className="ra-chart-card"><div className="ra-card-heading"><h2>Sapling Tree Performance</h2><p>Verified planting and latest monitoring by sapling tree</p></div><div className="ra-species-layout">{speciesTotal === 0 ? <EmptyRing label="Planted" /> : <div className="ra-donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={speciesRows} dataKey="planted" nameKey="species" innerRadius={55} outerRadius={82}>{speciesRows.map((item, index) => <Cell key={item.species} fill={SPECIES_COLORS[index % SPECIES_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>}<DataTable headers={["Sapling Tree", "Planted", "Monitored", "Survived", "Survival Rate"]} empty="No verified sapling tree records for this selection.">{speciesRows.map((item) => <tr key={item.species}><td>{item.species}</td><td>{formatNumber(item.planted)}</td><td>{formatNumber(item.monitored)}</td><td>{formatNumber(item.survived)}</td><td>{displayRate(item.survivalRate)}</td></tr>)}</DataTable></div></section>
      <section className="ra-chart-card"><div className="ra-card-heading"><h2>Survival Performance by Barangay</h2><p>Verified planting and latest monitoring records</p></div><DataTable headers={["Barangay", "Planted", "Monitored", "Survival Rate", "Status"]} empty="No qualifying barangay activity for this selection.">{analytics.barangaySurvival.map((item) => <tr key={item.barangay}><td>{item.barangay}</td><td>{formatNumber(item.planted)}</td><td>{formatNumber(item.monitored)}</td><td>{displayRate(item.rate)}</td><td><StatusBadge status={item.status} /></td></tr>)}</DataTable></section>
    </div>
    <AnalyticsSitesMap sites={analytics.siteMap || []} onViewFullMap={() => navigate(`${routeBase}/planting-sites`)} />
    <div className="ra-operational-grid">
      <section className="ra-chart-card"><div className="ra-card-heading"><h2>Planting Verification Analytics</h2><p>Current report workflow outcomes</p></div><StatList rows={[["Approved", formatNumber(verification.approved)], ["Pending", formatNumber(verification.pending)], ["Rejected", formatNumber(verification.rejected)], ["Average Approval Time", verification.averageApprovalHours == null ? "" : `${formatNumber(verification.averageApprovalHours)} hours`]]} /></section>
      <section className="ra-chart-card ra-accountability"><div className="ra-card-heading"><h2>Sapling Accountability</h2><p>Released saplings compared with verified planting records</p></div><StatList rows={[["Released", formatNumber(accountability.released)], ["Planted (Verified)", formatNumber(accountability.verifiedPlanted)], ["Difference", formatNumber(accountability.difference)]]} />{Number(accountability.difference) > 0 && <p className="ra-accountability-note">Released saplings not yet represented in verified planting records.</p>}</section>
    </div>
    <section className="ra-decision-card"><div className="ra-card-heading"><h2>Decision Support</h2><p>Operational observations generated only when supported by current records</p></div>{decisionRows.length ? <div className="ra-decision-grid">{decisionRows.map((item) => <article className="ra-decision-item" key={item.title}><div><strong>{item.title}</strong><p>{item.text}</p></div><button type="button" className="ra-secondary-button" onClick={() => navigate(item.route)}>{item.label}</button></article>)}</div> : <p className="ra-neutral-empty">No current operational conditions require attention for this selection.</p>}</section>
    <p className="ra-sync-note">Updates every 60 seconds and when this window regains focus. Last generated: {analytics.meta?.generatedAt ? new Date(analytics.meta.generatedAt).toLocaleString("en-PH") : ""}</p>
  </div>;
}

function DataTable({ headers, children, empty }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <div className="ra-table-wrap"><table className="ra-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table>{!hasRows && <p className="ra-subtle-message">{empty}</p>}</div>;
}
function StatList({ rows }) { return <div className="ra-stat-list">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>; }
