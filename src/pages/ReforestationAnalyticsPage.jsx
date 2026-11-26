import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiAlertCircle, FiBarChart2, FiCalendar, FiRotateCcw } from "react-icons/fi";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../context/AuthContext";
import { authenticatedFetch } from "../services/authenticatedApi";
import { sampleAnalyticsEnabled } from "../utils/permanentSampleFeatures";
import AnalyticsSitesMap from "../components/analytics/AnalyticsSitesMap";
import KpiCard, { KpiGrid } from "../components/KpiCard";
import "../styles/reforestation-analytics.css";

// Every figure comes from GET /analytics/dashboard, which computes it from the stored records (backend analytics.service.js).
const REFRESH_INTERVAL_MS = 60_000;
const CONDITION_COLORS = { Healthy: "#2f9e57", Damaged: "#f3a62f", Dead: "#e54848" };
const TREND_CHART_INITIAL_SIZE = { width: 420, height: 240 };
const DONUT_CHART_INITIAL_SIZE = { width: 180, height: 180 };
const EMPTY_ANALYTICS = { summary: {}, distributionTrend: [], plantingTrend: [], survivalTrend: [], monitoringConditions: [], speciesDistribution: [], barangaySurvival: [], siteMap: [], options: { barangays: [], species: [], sites: [] }, meta: {} };
const EMPTY_FILTERS = { dateFrom: "", dateTo: "", barangay: "All", species: "All", site: "All" };
const NO_MONITORING = "No official monitoring data yet";
const formatNumber = (value) => new Intl.NumberFormat("en-PH").format(Number(value) || 0);
const displayRate = (value) => value == null ? "—" : `${formatNumber(value)}%`;
const share = (part, total) => total > 0 ? `${Math.round((Number(part || 0) / total) * 100)}%` : "—";

function EmptyRing() {
  return <div className="ra-donut-chart ra-zero-ring-wrap"><ResponsiveContainer width="100%" height="100%" initialDimension={DONUT_CHART_INITIAL_SIZE}><PieChart><Pie data={[{ value: 1 }]} dataKey="value" innerRadius="68%" outerRadius="100%" isAnimationActive={false}><Cell fill="#e5e9e7" /></Pie></PieChart></ResponsiveContainer><div className="ra-zero-ring-center"><strong>0</strong><span>Monitored Trees</span></div></div>;
}
function ChartCard({ title, subtitle, empty, children }) {
  return <section className="ra-chart-card"><div className="ra-card-heading"><h2>{title}</h2><p>{subtitle}</p></div>
    <div className="ra-chart-area">{children}{empty && <div className="ra-chart-empty" role="status"><FiBarChart2 aria-hidden="true" /><strong>{empty}</strong></div>}</div></section>;
}
function MonthlyBars({ data, label, color = "#2f9e57" }) {
  return <ResponsiveContainer width="100%" height="100%" initialDimension={TREND_CHART_INITIAL_SIZE}><BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}><CartesianGrid strokeDasharray="4 4" vertical={false} /><XAxis dataKey="period" tick={{ fontSize: 11 }} interval="preserveStartEnd" /><YAxis allowDecimals={false} domain={[0, "auto"]} tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => [formatNumber(value), label]} /><Bar dataKey="count" fill={color} radius={[5, 5, 0, 0]} maxBarSize={44} /></BarChart></ResponsiveContainer>;
}
function SurvivalTooltip({ active, payload, label }) {
  const row = payload?.[0]?.payload;
  if (!active || row?.rate == null) return null;
  return <div className="ra-tooltip"><strong>{label}</strong><span>Survival rate: {displayRate(row.rate)}</span><span>Trees checked: {formatNumber(row.checked)}</span><span>Surviving (healthy and damaged): {formatNumber(row.surviving)}</span></div>;
}

export default function ReforestationAnalyticsPage() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const mounted = useRef(true);
  const requestSequence = useRef(0);
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const dateError = filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo ? "The From date cannot be later than the To date." : "";

  // Only the newest request may update the page, so a slow answer for older filters never replaces a newer one.
  const loadAnalytics = useCallback(async ({ foreground = false } = {}) => {
    if (dateError) return;
    const requestId = ++requestSequence.current;
    if (foreground) setLoading(true); else setUpdating(true);
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
      if (mounted.current && requestId === requestSequence.current) { setLoading(false); setUpdating(false); }
    }
  }, [filters, dateError]);

  useEffect(() => {
    mounted.current = true;
    const initialLoad = window.setTimeout(() => loadAnalytics({ foreground: !hasLoaded }), 0);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") loadAnalytics(); }, REFRESH_INTERVAL_MS);
    const handleFocus = () => loadAnalytics();
    window.addEventListener("focus", handleFocus);
    return () => { mounted.current = false; requestSequence.current += 1; window.clearTimeout(initialLoad); window.clearInterval(interval); window.removeEventListener("focus", handleFocus); };
  }, [loadAnalytics, hasLoaded]);

  const summary = analytics.summary || {};
  const options = analytics.options || EMPTY_ANALYTICS.options;
  const conditions = analytics.monitoringConditions || [];
  const speciesRows = analytics.speciesDistribution || [];
  const barangayRows = analytics.barangaySurvival || [];
  const distributionTrend = analytics.distributionTrend || [];
  const plantingTrend = analytics.plantingTrend || [];
  const survivalTrend = analytics.survivalTrend || [];
  const conditionTotal = conditions.reduce((total, item) => total + Number(item.count || 0), 0);
  const speciesTotal = speciesRows.reduce((total, item) => total + Number(item.planted || 0), 0);
  const hasCounts = (rows) => rows.some((row) => Number(row.count) > 0);
  const hasSurvival = survivalTrend.some((row) => row.rate != null);
  const routeBase = `/${userRole || "staff"}`;
  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  const updateFilter = (name) => (event) => setFilters((current) => ({ ...current, [name]: event.target.value }));
  if (loading && !hasLoaded) return <div className="ra-page"><div className="ra-centered-state">Loading analytics…</div></div>;
  if (loadError && !hasLoaded) return <div className="ra-page"><div className="ra-centered-state" role="alert"><span>{loadError}</span><button className="ra-secondary-button" onClick={() => loadAnalytics({ foreground: true })}>Retry</button></div></div>;

  return <div className="ra-page" aria-busy={updating || undefined}>
    <header className="ra-page-header">
      <span className="ra-page-icon" aria-hidden="true"><FiBarChart2 /></span>
      <div><h1>Analytics and Visualization</h1><p>Reforestation statistics, charts, and trends</p></div>
      {sampleAnalyticsEnabled() && <Link className="ra-secondary-button ra-header-link" to={`${routeBase}/permanent-sample-analytics`}>Permanent Sample Monitoring Analytics</Link>}
    </header>
    {loadError && <div className="ra-error-banner" role="alert"><FiAlertCircle />{loadError}</div>}
    <KpiGrid label="Analytics summary" className="ra-kpis">
      <KpiCard tone="green" title="Total Seedlings Distributed" value={formatNumber(summary.totalSaplingsDistributed)} description="Actual released quantity" />
      <KpiCard tone="green" title="Verified Trees Planted" value={formatNumber(summary.totalTreesPlanted)} description="From verified planting reports" />
      <KpiCard tone="green" title="Overall Survival Rate" value={displayRate(summary.overallSurvivalRate)} description={summary.overallSurvivalRate == null ? NO_MONITORING : "Latest official full observations"} />
      <KpiCard tone="blue" title="Verified Planting Reports" value={formatNumber(summary.verifiedPlantingReports)} description="Approved planting reports" />
      <KpiCard tone="total" title="Barangays Covered" value={formatNumber(summary.barangaysCovered)} description="With verified planting activity" />
    </KpiGrid>
    <div className="ra-filter-card" role="search" aria-label="Analytics filters">
      <div className="ra-filter-field"><label htmlFor="ra-date-from">Date Range</label><div className={`ra-date-range${dateError ? " is-invalid" : ""}`}><FiCalendar size={14} aria-hidden="true" /><input id="ra-date-from" type="date" aria-label="From date" value={filters.dateFrom} max={filters.dateTo || undefined} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? "ra-date-error" : undefined} onChange={updateFilter("dateFrom")} /><span>to</span><input type="date" aria-label="To date" value={filters.dateTo} min={filters.dateFrom || undefined} aria-invalid={Boolean(dateError)} onChange={updateFilter("dateTo")} /></div>
        {dateError && <small id="ra-date-error" className="ra-field-error" role="alert">{dateError}</small>}</div>
      <div className="ra-filter-field"><label htmlFor="ra-barangay">Barangay</label><select id="ra-barangay" value={filters.barangay} onChange={updateFilter("barangay")}><option value="All">All Barangays</option>{options.barangays.map((value) => <option key={value}>{value}</option>)}</select></div>
      <div className="ra-filter-field"><label htmlFor="ra-species">Seedling Tree</label><select id="ra-species" value={filters.species} onChange={updateFilter("species")}><option value="All">All Species</option>{options.species.map((value) => <option key={value}>{value}</option>)}</select></div>
      <div className="ra-filter-field"><label htmlFor="ra-site">Planting Site</label><select id="ra-site" value={filters.site} onChange={updateFilter("site")}><option value="All">All Sites</option>{options.sites.map((site) => <option key={site.value} value={site.value}>{site.label}</option>)}</select></div>
      <button type="button" className="ra-secondary-button ra-reset" disabled={!filtered} onClick={() => setFilters(EMPTY_FILTERS)}><FiRotateCcw size={14} aria-hidden="true" />Reset</button>
      {updating && <p className="ra-updating" role="status">Updating analytics…</p>}
    </div>
    <div className="ra-chart-grid ra-chart-grid-top">
      <ChartCard title="Monthly Seedling Distribution" subtitle="Released seedlings per month (actual distribution records)" empty={!hasCounts(distributionTrend) && "No seedling distribution records available for the selected filters."}>
        {hasCounts(distributionTrend) && <MonthlyBars data={distributionTrend} label="Seedlings Released" />}
      </ChartCard>
      <ChartCard title="Monthly Verified Trees Planted" subtitle="Verified trees planted per month (from approved planting reports)" empty={!hasCounts(plantingTrend) && "No verified planting records available for the selected filters."}>
        {hasCounts(plantingTrend) && <MonthlyBars data={plantingTrend} label="Verified Trees Planted" color="#238b45" />}
      </ChartCard>
      <ChartCard title="Survival Rate Trend" subtitle="Verified survival rate from official monitoring observations" empty={!hasSurvival && "No official survival monitoring data available yet."}>
        {/* A month without official observations stays a gap: it is not 0 %. */}
        {hasSurvival && <ResponsiveContainer width="100%" height="100%" initialDimension={TREND_CHART_INITIAL_SIZE}><LineChart data={survivalTrend} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}><CartesianGrid strokeDasharray="4 4" vertical={false} /><XAxis dataKey="period" tick={{ fontSize: 11 }} interval="preserveStartEnd" /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} /><Tooltip content={<SurvivalTooltip />} /><Line type="linear" dataKey="rate" stroke="#238b45" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>}
      </ChartCard>
    </div>
    <div className="ra-detail-grid">
      <section className="ra-chart-card"><div className="ra-card-heading"><h2>Monitoring Condition Summary</h2><p>Latest valid entry per monitoring lifecycle</p></div>
        <div className="ra-donut-layout">{conditionTotal === 0 ? <EmptyRing /> : <div className="ra-donut-chart"><ResponsiveContainer width="100%" height="100%" initialDimension={DONUT_CHART_INITIAL_SIZE}><PieChart><Pie data={conditions} dataKey="count" nameKey="condition" innerRadius="68%" outerRadius="100%" isAnimationActive={false}>{conditions.map((item) => <Cell key={item.condition} fill={CONDITION_COLORS[item.condition]} />)}</Pie><Tooltip formatter={(value, name) => [`${formatNumber(value)} trees (${share(value, conditionTotal)})`, name]} /></PieChart></ResponsiveContainer><div className="ra-zero-ring-center"><strong>{formatNumber(conditionTotal)}</strong><span>Monitored Trees</span></div></div>}
          <div className="ra-legend">{conditions.map((item) => <div className="ra-legend-row" key={item.condition}><span className="ra-legend-dot" style={{ background: CONDITION_COLORS[item.condition] }} /><span>{item.condition}</span><strong>{share(item.count, conditionTotal)}</strong></div>)}</div></div>
        {conditionTotal === 0 && <p className="ra-neutral-empty" role="status">{NO_MONITORING}.</p>}
      </section>
      <section className="ra-chart-card"><div className="ra-card-heading"><h2>Verified Trees Planted by Species</h2><p>Number of planted trees from verified reports</p></div>
        <DataTable headers={["Seedling Tree", "Planted (Verified)", "Percent"]} empty="No seedling tree records for this selection.">{speciesRows.map((item) => <tr key={item.species}><td>{item.species}</td><td>{formatNumber(item.planted)}</td><td>{share(item.planted, speciesTotal)}</td></tr>)}</DataTable>
        <div className="ra-total-inline"><span>Total Verified Trees Planted</span><strong>{formatNumber(speciesTotal)}</strong></div></section>
      <section className="ra-chart-card"><div className="ra-card-heading"><h2>Planting Coverage by Barangay</h2><p>Verified planting activity by barangay</p></div>
        <DataTable headers={["Barangay", ["Planted", "Verified trees planted"], ["Monitored", "Official trees monitored (latest full observation)"], ["Survival", "Official survival rate"]]} empty="No qualifying barangay activity for this selection.">{barangayRows.map((item) => <tr key={item.barangay}><td>{item.barangay}</td><td>{formatNumber(item.planted)}</td><td>{formatNumber(item.monitored)}</td><td>{displayRate(item.rate)}</td></tr>)}</DataTable></section>
      <AnalyticsSitesMap sites={analytics.siteMap || []} onViewFullMap={() => navigate(`${routeBase}/planting-sites`)} />
    </div>
    <p className="ra-sync-note">Updates every 60 seconds and when this window regains focus.{analytics.meta?.generatedAt ? ` Last updated: ${new Date(analytics.meta.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}.` : ""}</p>
  </div>;
}

function DataTable({ headers, children, empty }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <div className="ra-table-wrap"><table className="ra-table"><thead><tr>{headers.map((header) => Array.isArray(header) ? <th key={header[0]} scope="col"><abbr title={header[1]} aria-label={header[1]}>{header[0]}</abbr></th> : <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{children}</tbody></table>{!hasRows && <p className="ra-subtle-message">{empty}</p>}</div>;
}
