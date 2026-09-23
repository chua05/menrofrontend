import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle, FiBarChart2, FiCalendar, FiDownload, FiGrid, FiMapPin,
  FiPackage, FiRefreshCw, FiShield, FiTrendingUp,
} from "react-icons/fi";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import "../styles/reforestation-analytics.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const REFRESH_INTERVAL_MS = 60_000;
const CONDITION_COLORS = { Healthy: "#2f9e57", Damaged: "#f3a62f", Dead: "#e54848" };
const SPECIES_COLORS = ["#2f9e57", "#68b978", "#22856f", "#8fc8b2", "#efb34c", "#6d83d2", "#9a78d3", "#d88352"];
const EMPTY_ANALYTICS = {
  summary: {}, plantingTrend: [], survivalTrend: [], monitoringConditions: [],
  speciesDistribution: [], barangaySurvival: [], decisionSupport: {},
  options: { barangays: [], species: [], sites: [] }, meta: {},
};

const formatNumber = (value) => new Intl.NumberFormat("en-PH").format(Number(value) || 0);
const escapeCsv = (value) => /[",\n]/.test(String(value ?? ""))
  ? `"${String(value ?? "").replace(/"/g, '""')}"` : String(value ?? "");

function EmptyRing({ label }) {
  return (
    <div className="ra-donut-chart ra-zero-ring-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie data={[{ value: 1 }]} dataKey="value" innerRadius={55} outerRadius={82} isAnimationActive={false}><Cell fill="#e5e9e7" /></Pie></PieChart>
      </ResponsiveContainer>
      <div className="ra-zero-ring-center"><strong>0</strong><span>{label}</span></div>
    </div>
  );
}

function ChartMessage({ children }) {
  return <div className="ra-chart-message">{children}</div>;
}

function Kpi({ icon: Icon, iconClass, label, value, note, percent = false }) {
  return (
    <div className="ra-kpi-card">
      <div className={`ra-kpi-icon ${iconClass}`}><Icon size={20} /></div>
      <div><span>{label}</span><strong>{formatNumber(value)}{percent ? "%" : ""}</strong><small>{note}</small></div>
    </div>
  );
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
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", barangay: "All", species: "All", site: "All" });

  const loadAnalytics = useCallback(async ({ foreground = false } = {}) => {
    const requestId = ++requestSequence.current;
    if (foreground) setLoading(true); else setRefreshing(true);
    try {
      if (typeof auth.authStateReady === "function") await auth.authStateReady();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([name, value]) => { if (value && value !== "All") query.set(name, value); });
      const response = await fetch(`${API_BASE_URL}/analytics/dashboard?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to load analytics.");
      if (!payload.data?.summary) throw new Error("The analytics response was incomplete.");
      if (mounted.current && requestId === requestSequence.current) {
        setAnalytics(payload.data);
        setLoadError("");
        setHasLoaded(true);
      }
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
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") loadAnalytics();
    }, REFRESH_INTERVAL_MS);
    const handleFocus = () => loadAnalytics();
    window.addEventListener("focus", handleFocus);
    return () => {
      mounted.current = false;
      requestSequence.current += 1;
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadAnalytics, hasLoaded]);

  const summary = analytics.summary || {};
  const decision = analytics.decisionSupport || {};
  const options = analytics.options || EMPTY_ANALYTICS.options;
  const conditions = analytics.monitoringConditions || [];
  const conditionTotal = conditions.reduce((total, item) => total + Number(item.count || 0), 0);
  const speciesTotal = (analytics.speciesDistribution || []).reduce((total, item) => total + Number(item.count || 0), 0);
  const routeBase = `/${userRole || "staff"}`;

  const decisionRows = [
    { title: "Planting Verification", text: `${formatNumber(decision.pendingPlantingReports)} planting report(s) are pending MENRO Staff review.`, route: `${routeBase}/planting-reports` },
    { title: "Monitoring Condition", text: `${formatNumber(decision.damagedTrees)} damaged and ${formatNumber(decision.deadTrees)} dead tree(s) are recorded in the latest monitoring entries.`, route: `${routeBase}/survival-monitoring` },
    { title: "Monitoring Coverage", text: `${formatNumber(decision.eligibleWithoutSubmission)} eligible planting record(s) do not yet have a monitoring submission.`, route: `${routeBase}/survival-monitoring` },
    { title: "Monitoring Schedule", text: `${formatNumber(decision.monitoringEligible)} eligible/due, ${formatNumber(decision.monitoringNotYetEligible)} not currently eligible, and ${formatNumber(decision.monitoringCompleted)} completed lifecycle(s).`, route: `${routeBase}/survival-monitoring` },
    { title: "Distribution vs Recorded Planting", text: `Released: ${formatNumber(decision.releasedQuantity)} · Recorded planted: ${formatNumber(decision.recordedPlantedQuantity)} · Difference: ${formatNumber(decision.distributionPlantingDifference)}` },
  ];

  const clearFilters = () => setFilters({ dateFrom: "", dateTo: "", barangay: "All", species: "All", site: "All" });
  const updateFilter = (name) => (event) => setFilters((current) => ({ ...current, [name]: event.target.value }));
  const exportAnalyticsCsv = () => {
    const rows = [
      ["Analytics & Decision Support"], ["Generated", analytics.meta?.generatedAt || ""], [],
      ["Filters", JSON.stringify(filters)], [], ["Summary", "Value"],
      ["Total Saplings Distributed", summary.totalSaplingsDistributed], ["Total Trees Planted", summary.totalTreesPlanted],
      ["Overall Survival Rate", `${summary.overallSurvivalRate || 0}%`], ["Verified Planting Reports", summary.verifiedPlantingReports],
      ["Barangays Covered", summary.barangaysCovered], ["Active Planting Sites", summary.activePlantingSites], [],
      ["Monitoring Condition", "Trees"], ...conditions.map((item) => [item.condition, item.count]), [],
      ["Tree Species", "Trees Planted"], ...(analytics.speciesDistribution || []).map((item) => [item.species, item.count]), [],
      ["Barangay", "Survival Rate"], ...(analytics.barangaySurvival || []).map((item) => [item.barangay, `${item.rate}%`]),
    ];
    const blob = new Blob([rows.map((row) => row.map(escapeCsv).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "reforestation-analytics.csv"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  if (loading && !hasLoaded) return <div className="ra-page"><div className="ra-centered-state">Loading analytics…</div></div>;
  if (loadError && !hasLoaded) return <div className="ra-page"><div className="ra-centered-state" role="alert"><span>{loadError}</span><button className="ra-secondary-button" onClick={() => loadAnalytics({ foreground: true })}>Retry</button></div></div>;

  return (
    <div className="ra-page">
      <div className="ra-header">
        <div className="ra-heading"><div className="ra-heading-icon"><FiTrendingUp size={21} /></div><div><h1>Reforestation Analytics</h1></div></div>
        <div className="ra-header-actions">
          <button type="button" className="ra-secondary-button" onClick={exportAnalyticsCsv}><FiDownload size={14} />Export Report</button>
          <button type="button" className="ra-icon-button" onClick={() => loadAnalytics()} disabled={refreshing} title="Refresh analytics"><FiRefreshCw className={refreshing ? "ra-spin" : ""} size={16} /></button>
        </div>
      </div>
      {loadError && <div className="ra-error-banner" role="alert"><FiAlertCircle />{loadError}</div>}

      <div className="ra-kpi-grid">
        <Kpi icon={FiPackage} iconClass="ra-kpi-green" label="Total Saplings Distributed" value={summary.totalSaplingsDistributed} note="Actual released quantity" />
        <Kpi icon={FiTrendingUp} iconClass="ra-kpi-green" label="Total Trees Planted" value={summary.totalTreesPlanted} note="Actual planting contributions" />
        <Kpi icon={FiBarChart2} iconClass="ra-kpi-green" label="Overall Survival Rate" value={summary.overallSurvivalRate} note="Latest entry per lifecycle" percent />
        <Kpi icon={FiShield} iconClass="ra-kpi-blue" label="Verified Planting Reports" value={summary.verifiedPlantingReports} note="Final Staff-approved only" />
        <Kpi icon={FiGrid} iconClass="ra-kpi-purple" label="Barangays Covered" value={summary.barangaysCovered} note="With verified activity" />
        <Kpi icon={FiMapPin} iconClass="ra-kpi-orange" label="Active Planting Sites" value={summary.activePlantingSites} note="Registered active sites" />
      </div>

      <div className="ra-filter-card">
        <div className="ra-filter-field"><label>Date Range</label><div className="ra-date-range"><FiCalendar size={14} /><input type="date" value={filters.dateFrom} onChange={updateFilter("dateFrom")} /><span>to</span><input type="date" value={filters.dateTo} onChange={updateFilter("dateTo")} /></div></div>
        <div className="ra-filter-field"><label>Barangay</label><select value={filters.barangay} onChange={updateFilter("barangay")}><option value="All">All Barangays</option>{options.barangays.map((value) => <option key={value}>{value}</option>)}</select></div>
        <div className="ra-filter-field"><label>Tree Species</label><select value={filters.species} onChange={updateFilter("species")}><option value="All">All Species</option>{options.species.map((value) => <option key={value}>{value}</option>)}</select></div>
        <div className="ra-filter-field"><label>Planting Site</label><select value={filters.site} onChange={updateFilter("site")}><option value="All">All Sites</option>{options.sites.map((site) => <option key={site.value} value={site.value}>{site.label}</option>)}</select></div>
        <div className="ra-clear-wrap"><button type="button" className="ra-secondary-button" onClick={clearFilters}><FiRefreshCw size={14} />Clear Filters</button></div>
      </div>

      <div className="ra-chart-grid ra-chart-grid-top">
        <section className="ra-chart-card"><div className="ra-card-heading"><h2>Planting Trend Over Time</h2><p>Actual trees planted in each valid period</p></div><div className="ra-chart-area">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.plantingTrend}><CartesianGrid strokeDasharray="4 4" vertical={false} /><XAxis dataKey="period" tickLine={false} axisLine={false} /><YAxis domain={[0, "auto"]} allowDecimals={false} /><Tooltip formatter={(value) => [formatNumber(value), "Trees Planted"]} /><Bar dataKey="count" fill="#2f9e57" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>
          {!analytics.meta?.plantingActivityCount && <ChartMessage>No recorded planting activity for this period.</ChartMessage>}
        </div></section>
        <section className="ra-chart-card"><div className="ra-card-heading"><h2>Survival Rate Trend</h2><p>Weighted survival rate from actual monitoring entries</p></div><div className="ra-chart-area">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={analytics.survivalTrend}><CartesianGrid strokeDasharray="4 4" vertical={false} /><XAxis dataKey="period" /><YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value) => [`${value}%`, "Survival Rate"]} /><Line type="monotone" dataKey="rate" stroke="#238b45" strokeWidth={2.5} dot={{ r: 4 }} /></LineChart></ResponsiveContainer>
          {!analytics.meta?.monitoringEntryCount && <ChartMessage>No survival monitoring records for this period.</ChartMessage>}
        </div></section>
        <section className="ra-chart-card"><div className="ra-card-heading"><h2>Monitoring Condition Summary</h2><p>Latest actual entry per monitoring lifecycle</p></div><div className="ra-donut-layout">
          {conditionTotal === 0 ? <EmptyRing label="Monitored" /> : <div className="ra-donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={conditions} dataKey="count" nameKey="condition" innerRadius={55} outerRadius={82}>{conditions.map((item) => <Cell key={item.condition} fill={CONDITION_COLORS[item.condition]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>}
          <div className="ra-legend">{conditions.map((item) => <div className="ra-legend-row" key={item.condition}><span className="ra-legend-dot" style={{ background: CONDITION_COLORS[item.condition] }} /><span>{item.condition}</span><strong>{formatNumber(item.count)}</strong></div>)}<div className="ra-total-box"><span>Total Trees Checked</span><strong>{formatNumber(conditionTotal)}</strong></div></div>
        </div></section>
      </div>

      <div className="ra-chart-grid ra-chart-grid-bottom">
        <section className="ra-chart-card"><div className="ra-card-heading"><h2>Tree Species Distribution</h2><p>Actual planted quantity by recorded species</p></div><div className="ra-species-layout">
          {speciesTotal === 0 ? <EmptyRing label="Planted" /> : <div className="ra-donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analytics.speciesDistribution} dataKey="count" nameKey="species" innerRadius={55} outerRadius={82}>{analytics.speciesDistribution.map((item, index) => <Cell key={item.species} fill={SPECIES_COLORS[index % SPECIES_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>}
          <div className="ra-legend">{analytics.speciesDistribution.map((item, index) => <div className="ra-legend-row" key={item.species}><span className="ra-legend-dot" style={{ background: SPECIES_COLORS[index % SPECIES_COLORS.length] }} /><span>{item.species}</span><strong>{formatNumber(item.count)}</strong></div>)}{speciesTotal === 0 && <span className="ra-subtle-message">No planted species recorded for this selection.</span>}<div className="ra-total-inline"><span>Total Trees Planted</span><strong>{formatNumber(speciesTotal)}</strong></div></div>
        </div></section>
        <section className="ra-chart-card"><div className="ra-card-heading"><h2>Survival Performance by Barangay</h2><p>Weighted latest monitoring survival rate</p></div><div className="ra-chart-area ra-barangay-chart-area">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.barangaySurvival} layout="vertical" margin={{ left: 25, right: 20 }}><CartesianGrid strokeDasharray="4 4" horizontal={false} /><XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} /><YAxis type="category" dataKey="barangay" width={115} /><Tooltip formatter={(value) => [`${value}%`, "Survival Rate"]} /><Bar dataKey="rate" fill="#2f9e57" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer>
          {analytics.barangaySurvival.length === 0 && <ChartMessage>No barangay monitoring records for this selection.</ChartMessage>}
        </div></section>
      </div>

      <section className="ra-decision-card"><div className="ra-card-heading"><h2>Decision Support</h2><p>Descriptive operational observations from the same filtered records</p></div><div className="ra-decision-grid">{decisionRows.map((item) => <article className="ra-decision-item" key={item.title}><div><strong>{item.title}</strong><p>{item.text}</p></div>{item.route && <button type="button" className="ra-secondary-button" onClick={() => navigate(item.route)}>Open Module</button>}</article>)}</div></section>
      <p className="ra-sync-note">Near-real-time backend refresh every 60 seconds and when this window regains focus. Last generated: {analytics.meta?.generatedAt ? new Date(analytics.meta.generatedAt).toLocaleString("en-PH") : "—"}</p>
    </div>
  );
}
