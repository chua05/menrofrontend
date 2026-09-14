import { useMemo, useState } from "react";
import {
  FiBarChart2,
  FiCalendar,
  FiDownload,
  FiGrid,
  FiMapPin,
  FiPackage,
  FiRefreshCw,
  FiShield,
  FiTrendingUp,
} from "react-icons/fi";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "../styles/reforestation-analytics.css";

const SEEDLINGS_STORAGE_KEY = "menro_seedlings";
const PLANTING_REPORTS_STORAGE_KEY = "menro_planting_reports";
const MONITORING_STORAGE_KEY = "menro_survival_monitoring";
const PLANTING_SITES_STORAGE_KEY = "menro_planting_sites";

const JUBAN_BARANGAYS = [
  "Añog",
  "Aroroy",
  "Bacolod",
  "Binanuahan",
  "Biriran",
  "Buraburan",
  "Calateo",
  "Calmayon",
  "Caruhayon",
  "Catanagan",
  "Catanusan",
  "Cogon",
  "Embarcadero",
  "Guruyan",
  "Lajong",
  "Maalo",
  "North Poblacion",
  "South Poblacion",
  "Puting Sapa",
  "Rangas",
  "Sablayan",
  "Sipaya",
  "Taboc",
  "Tinago",
  "Tughan",
];

const CONDITION_COLORS = {
  Healthy: "#2f9e57",
  Damaged: "#f3a62f",
  Dead: "#e54848",
};

const SPECIES_COLORS = [
  "#2f9e57",
  "#68b978",
  "#22856f",
  "#8fc8b2",
  "#efb34c",
  "#6d83d2",
  "#9a78d3",
  "#d88352",
];

function safeParse(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadStorageArray(key) {
  if (typeof window === "undefined") {
    return [];
  }

  return safeParse(window.localStorage.getItem(key));
}

function normalizeVerificationStatus(status) {
  if (status === "Approved") {
    return "Verified";
  }

  if (status === "Pending Review") {
    return "Pending";
  }

  if (["Pending", "Verified", "Rejected"].includes(status)) {
    return status;
  }

  return "Pending";
}

function normalizeText(value) {
  return String(value || "").trim();
}

function toDateOnly(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}

function getPlantingReportDate(report) {
  return (
    report?.datePlanted ||
    report?.plantingDate ||
    report?.submittedAt ||
    report?.verifiedAt ||
    report?.createdAt ||
    ""
  );
}

function getMonitoringDate(record) {
  return (
    record?.monitoredDate ||
    record?.date ||
    record?.createdAt ||
    ""
  );
}

function getReportQuantity(report) {
  return (
    Number(report?.quantityPlanted) ||
    Number(report?.quantity) ||
    Number(report?.treesPlanted) ||
    Number(report?.seedlingsPlanted) ||
    0
  );
}

function getReportSpecies(report) {
  return normalizeText(
    report?.species ||
      report?.treeName ||
      report?.seedlingName ||
      report?.treeSpecies
  );
}

function getReportBarangay(report) {
  return normalizeText(report?.barangay);
}

function getReportSiteId(report) {
  return normalizeText(
    report?.siteId ||
      report?.plantingSiteId
  );
}

function getReportSiteName(report) {
  return normalizeText(
    report?.siteName ||
      report?.plantingSiteName
  );
}

function getMonitoringSpecies(record) {
  return normalizeText(
    record?.species ||
      record?.treeSpecies
  );
}

function getMonitoringBarangay(record) {
  return normalizeText(record?.barangay);
}

function getMonitoringSiteId(record) {
  return normalizeText(
    record?.siteId ||
      record?.plantingSiteId
  );
}

function getMonitoringSiteName(record) {
  return normalizeText(
    record?.siteName ||
      record?.plantingSiteName
  );
}

function getMonitoringTotals(record) {
  const healthy = Number(record?.healthy) || 0;
  const damaged = Number(record?.damaged) || 0;
  const dead = Number(record?.dead) || 0;

  let totalChecked = Number(record?.totalChecked) || 0;

  if (totalChecked <= 0) {
    totalChecked = healthy + damaged + dead;
  }

  return {
    healthy,
    damaged,
    dead,
    totalChecked,
    surviving: healthy + damaged,
  };
}

function isWithinDateRange(value, dateFrom, dateTo) {
  const date = toDateOnly(value);

  if (!date) {
    return !dateFrom && !dateTo;
  }

  if (dateFrom && date < dateFrom) {
    return false;
  }

  if (dateTo && date > dateTo) {
    return false;
  }

  return true;
}

function getMonthKey(value) {
  const dateOnly = toDateOnly(value);

  if (!dateOnly) {
    return "";
  }

  const date = new Date(`${dateOnly}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function formatMonth(monthKey) {
  if (!monthKey) {
    return "";
  }

  const [year, month] = monthKey
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-PH").format(
    Number(value) || 0
  );
}

function escapeCsv(value) {
  const text = String(value ?? "");

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function EmptyChart({ icon, title, message }) {
  return (
    <div className="ra-empty-chart">
      <div className="ra-empty-icon">
        {icon}
      </div>

      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

export default function ReforestationAnalyticsPage() {
  const [seedlings, setSeedlings] = useState(() =>
    loadStorageArray(SEEDLINGS_STORAGE_KEY)
  );

  const [plantingReports, setPlantingReports] = useState(() =>
    loadStorageArray(PLANTING_REPORTS_STORAGE_KEY)
  );

  const [monitoringRecords, setMonitoringRecords] = useState(() =>
    loadStorageArray(MONITORING_STORAGE_KEY)
  );

  const [plantingSites, setPlantingSites] = useState(() =>
    loadStorageArray(PLANTING_SITES_STORAGE_KEY)
  );

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [barangayFilter, setBarangayFilter] = useState("All");
  const [speciesFilter, setSpeciesFilter] = useState("All");
  const [siteFilter, setSiteFilter] = useState("All");

  const loadAnalyticsData = () => {
    setSeedlings(
      loadStorageArray(SEEDLINGS_STORAGE_KEY)
    );

    setPlantingReports(
      loadStorageArray(PLANTING_REPORTS_STORAGE_KEY)
    );

    setMonitoringRecords(
      loadStorageArray(MONITORING_STORAGE_KEY)
    );

    setPlantingSites(
      loadStorageArray(PLANTING_SITES_STORAGE_KEY)
    );
  };

  const verifiedReports = useMemo(() => {
    return plantingReports.filter(
      (report) =>
        report?.archived !== true &&
        normalizeVerificationStatus(
          report?.verificationStatus
        ) === "Verified"
    );
  }, [plantingReports]);

  const activeMonitoringRecords = useMemo(() => {
    return monitoringRecords.filter(
      (record) => record?.archived !== true
    );
  }, [monitoringRecords]);

  const activeSites = useMemo(() => {
    return plantingSites.filter((site) => {
      if (site?.archived === true) {
        return false;
      }

      const status = normalizeText(
        site?.status
      ).toLowerCase();

      return ![
        "inactive",
        "archived",
        "closed",
      ].includes(status);
    });
  }, [plantingSites]);

  const speciesOptions = useMemo(() => {
    const values = new Set();

    verifiedReports.forEach((report) => {
      const species = getReportSpecies(report);

      if (species) {
        values.add(species);
      }
    });

    activeMonitoringRecords.forEach((record) => {
      const species = getMonitoringSpecies(record);

      if (species) {
        values.add(species);
      }
    });

    return [...values].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [
    verifiedReports,
    activeMonitoringRecords,
  ]);

  const siteOptions = useMemo(() => {
    const values = new Map();

    activeSites.forEach((site) => {
      const id = normalizeText(
        site?.id ||
          site?.siteId
      );

      const name = normalizeText(
        site?.name ||
          site?.siteName
      );

      if (!id && !name) {
        return;
      }

      values.set(id || name, {
        value: id || name,
        label: name || id,
      });
    });

    verifiedReports.forEach((report) => {
      const id = getReportSiteId(report);
      const name = getReportSiteName(report);

      if (!id && !name) {
        return;
      }

      values.set(id || name, {
        value: id || name,
        label: name || id,
      });
    });

    return [...values.values()].sort(
      (a, b) =>
        a.label.localeCompare(b.label)
    );
  }, [
    activeSites,
    verifiedReports,
  ]);

  const filteredVerifiedReports = useMemo(() => {
    return verifiedReports.filter((report) => {
      const barangay = getReportBarangay(report);
      const species = getReportSpecies(report);
      const siteId = getReportSiteId(report);
      const siteName = getReportSiteName(report);
      const reportDate = getPlantingReportDate(report);

      const barangayMatches =
        barangayFilter === "All" ||
        barangay === barangayFilter;

      const speciesMatches =
        speciesFilter === "All" ||
        species === speciesFilter;

      const siteMatches =
        siteFilter === "All" ||
        siteFilter === siteId ||
        siteFilter === siteName;

      const dateMatches = isWithinDateRange(
        reportDate,
        dateFrom,
        dateTo
      );

      return (
        barangayMatches &&
        speciesMatches &&
        siteMatches &&
        dateMatches
      );
    });
  }, [
    verifiedReports,
    barangayFilter,
    speciesFilter,
    siteFilter,
    dateFrom,
    dateTo,
  ]);

  const filteredMonitoringRecords = useMemo(() => {
    return activeMonitoringRecords.filter((record) => {
      const barangay = getMonitoringBarangay(record);
      const species = getMonitoringSpecies(record);
      const siteId = getMonitoringSiteId(record);
      const siteName = getMonitoringSiteName(record);
      const monitoringDate = getMonitoringDate(record);

      const barangayMatches =
        barangayFilter === "All" ||
        barangay === barangayFilter;

      const speciesMatches =
        speciesFilter === "All" ||
        species === speciesFilter;

      const siteMatches =
        siteFilter === "All" ||
        siteFilter === siteId ||
        siteFilter === siteName;

      const dateMatches = isWithinDateRange(
        monitoringDate,
        dateFrom,
        dateTo
      );

      return (
        barangayMatches &&
        speciesMatches &&
        siteMatches &&
        dateMatches
      );
    });
  }, [
    activeMonitoringRecords,
    barangayFilter,
    speciesFilter,
    siteFilter,
    dateFrom,
    dateTo,
  ]);

  const filteredSites = useMemo(() => {
    return activeSites.filter((site) => {
      const barangay = normalizeText(
        site?.barangay
      );

      const id = normalizeText(
        site?.id ||
          site?.siteId
      );

      const name = normalizeText(
        site?.name ||
          site?.siteName
      );

      const barangayMatches =
        barangayFilter === "All" ||
        barangay === barangayFilter;

      const siteMatches =
        siteFilter === "All" ||
        siteFilter === id ||
        siteFilter === name;

      return (
        barangayMatches &&
        siteMatches
      );
    });
  }, [
    activeSites,
    barangayFilter,
    siteFilter,
  ]);

  const totalSeedlingsDistributed = useMemo(() => {
    return seedlings
      .filter(
        (seedling) =>
          seedling?.archived !== true
      )
      .reduce((total, seedling) => {
        return (
          total +
          (
            Number(
              seedling?.distributed
            ) ||
            Number(
              seedling?.distributedQuantity
            ) ||
            0
          )
        );
      }, 0);
  }, [seedlings]);

  const totalTreesPlanted = useMemo(() => {
    return filteredVerifiedReports.reduce(
      (total, report) =>
        total +
        getReportQuantity(report),
      0
    );
  }, [filteredVerifiedReports]);

  const monitoringTotals = useMemo(() => {
    return filteredMonitoringRecords.reduce(
      (total, record) => {
        const current =
          getMonitoringTotals(record);

        return {
          healthy:
            total.healthy +
            current.healthy,

          damaged:
            total.damaged +
            current.damaged,

          dead:
            total.dead +
            current.dead,

          surviving:
            total.surviving +
            current.surviving,

          totalChecked:
            total.totalChecked +
            current.totalChecked,
        };
      },
      {
        healthy: 0,
        damaged: 0,
        dead: 0,
        surviving: 0,
        totalChecked: 0,
      }
    );
  }, [filteredMonitoringRecords]);

  const overallSurvivalRate =
    monitoringTotals.totalChecked > 0
      ? Math.round(
          (
            monitoringTotals.surviving /
            monitoringTotals.totalChecked
          ) * 100
        )
      : 0;

  const barangaysCovered = useMemo(() => {
    return new Set(
      filteredVerifiedReports
        .map((report) =>
          getReportBarangay(report)
        )
        .filter(Boolean)
    ).size;
  }, [filteredVerifiedReports]);

  const plantingTrendData = useMemo(() => {
    const grouped = new Map();

    filteredVerifiedReports.forEach((report) => {
      const month = getMonthKey(
        getPlantingReportDate(report)
      );

      if (!month) {
        return;
      }

      grouped.set(
        month,
        (grouped.get(month) || 0) +
          getReportQuantity(report)
      );
    });

    return [...grouped.entries()]
      .sort(([a], [b]) =>
        a.localeCompare(b)
      )
      .map(([month, treesPlanted]) => ({
        month: formatMonth(month),
        treesPlanted,
      }));
  }, [filteredVerifiedReports]);

  const survivalTrendData = useMemo(() => {
    const grouped = new Map();

    filteredMonitoringRecords.forEach((record) => {
      const month = getMonthKey(
        getMonitoringDate(record)
      );

      if (!month) {
        return;
      }

      const totals =
        getMonitoringTotals(record);

      const current =
        grouped.get(month) || {
          surviving: 0,
          totalChecked: 0,
        };

      current.surviving +=
        totals.surviving;

      current.totalChecked +=
        totals.totalChecked;

      grouped.set(month, current);
    });

    return [...grouped.entries()]
      .sort(([a], [b]) =>
        a.localeCompare(b)
      )
      .map(([month, totals]) => ({
        month: formatMonth(month),

        survivalRate:
          totals.totalChecked > 0
            ? Math.round(
                (
                  totals.surviving /
                  totals.totalChecked
                ) * 100
              )
            : 0,
      }));
  }, [filteredMonitoringRecords]);

  const monitoringConditionData = useMemo(() => {
    const total =
      monitoringTotals.totalChecked;

    return [
      {
        name: "Healthy",
        value:
          monitoringTotals.healthy,

        percent:
          total > 0
            ? Math.round(
                (
                  monitoringTotals.healthy /
                  total
                ) * 100
              )
            : 0,
      },
      {
        name: "Damaged",
        value:
          monitoringTotals.damaged,

        percent:
          total > 0
            ? Math.round(
                (
                  monitoringTotals.damaged /
                  total
                ) * 100
              )
            : 0,
      },
      {
        name: "Dead",
        value:
          monitoringTotals.dead,

        percent:
          total > 0
            ? Math.round(
                (
                  monitoringTotals.dead /
                  total
                ) * 100
              )
            : 0,
      },
    ];
  }, [monitoringTotals]);

  const speciesDistributionData = useMemo(() => {
    const grouped = new Map();

    filteredVerifiedReports.forEach((report) => {
      const species =
        getReportSpecies(report);

      if (!species) {
        return;
      }

      grouped.set(
        species,
        (grouped.get(species) || 0) +
          getReportQuantity(report)
      );
    });

    return [...grouped.entries()]
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort(
        (a, b) =>
          b.value - a.value
      );
  }, [filteredVerifiedReports]);

  const survivalByBarangayData = useMemo(() => {
    const grouped = new Map();

    filteredMonitoringRecords.forEach((record) => {
      const barangay =
        getMonitoringBarangay(record);

      if (!barangay) {
        return;
      }

      const totals =
        getMonitoringTotals(record);

      const current =
        grouped.get(barangay) || {
          surviving: 0,
          totalChecked: 0,
        };

      current.surviving +=
        totals.surviving;

      current.totalChecked +=
        totals.totalChecked;

      grouped.set(
        barangay,
        current
      );
    });

    return [...grouped.entries()]
      .map(([barangay, totals]) => ({
        barangay,

        survivalRate:
          totals.totalChecked > 0
            ? Math.round(
                (
                  totals.surviving /
                  totals.totalChecked
                ) * 100
              )
            : 0,
      }))
      .sort(
        (a, b) =>
          b.survivalRate -
          a.survivalRate
      );
  }, [filteredMonitoringRecords]);

  const conditionTotal =
    monitoringConditionData.reduce(
      (total, item) =>
        total + item.value,
      0
    );

  const speciesTotal =
    speciesDistributionData.reduce(
      (total, item) =>
        total + item.value,
      0
    );

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setBarangayFilter("All");
    setSpeciesFilter("All");
    setSiteFilter("All");
  };

  const exportAnalyticsCsv = () => {
    const rows = [
      ["Reforestation Analytics"],
      [],
      ["Filters"],
      ["Date From", dateFrom || "All"],
      ["Date To", dateTo || "All"],
      ["Barangay", barangayFilter],
      ["Tree Species", speciesFilter],
      ["Planting Site", siteFilter],
      [],
      ["Summary", "Value"],
      [
        "Total Seedlings Distributed",
        totalSeedlingsDistributed,
      ],
      [
        "Total Trees Planted",
        totalTreesPlanted,
      ],
      [
        "Overall Survival Rate",
        `${overallSurvivalRate}%`,
      ],
      [
        "Verified Planting Reports",
        filteredVerifiedReports.length,
      ],
      [
        "Barangays Covered",
        barangaysCovered,
      ],
      [
        "Active Planting Sites",
        filteredSites.length,
      ],
      [],
      [
        "Monitoring Condition",
        "Trees",
        "Percentage",
      ],
      ...monitoringConditionData.map(
        (item) => [
          item.name,
          item.value,
          `${item.percent}%`,
        ]
      ),
      [],
      [
        "Tree Species",
        "Trees Planted",
      ],
      ...speciesDistributionData.map(
        (item) => [
          item.name,
          item.value,
        ]
      ),
      [],
      [
        "Barangay",
        "Survival Rate",
      ],
      ...survivalByBarangayData.map(
        (item) => [
          item.barangay,
          `${item.survivalRate}%`,
        ]
      ),
    ];

    const csv = rows
      .map((row) =>
        row
          .map(escapeCsv)
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      "reforestation-analytics.csv";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="ra-page">
      {/* HEADER */}
      <div className="ra-header">
        <div className="ra-heading">
          <div className="ra-heading-icon">
            <FiTrendingUp size={21} />
          </div>

          <div>
            <h1>
              Reforestation Analytics
            </h1>

            <p>
              Analyze reforestation performance and tree
              survival across Juban, Sorsogon.
            </p>
          </div>
        </div>

        <div className="ra-header-actions">
          <button
            type="button"
            className="ra-secondary-button"
            onClick={
              exportAnalyticsCsv
            }
          >
            <FiDownload size={14} />
            Export Report
          </button>

          <button
            type="button"
            className="ra-icon-button"
            onClick={
              loadAnalyticsData
            }
            title="Refresh analytics"
          >
            <FiRefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="ra-kpi-grid">
        <div className="ra-kpi-card">
          <div className="ra-kpi-icon ra-kpi-green">
            <FiPackage size={20} />
          </div>

          <div>
            <span>
              Total Seedlings Distributed
            </span>

            <strong>
              {formatNumber(
                totalSeedlingsDistributed
              )}
            </strong>

            <small>
              Recorded distributions
            </small>
          </div>
        </div>

        <div className="ra-kpi-card">
          <div className="ra-kpi-icon ra-kpi-green">
            <FiTrendingUp size={20} />
          </div>

          <div>
            <span>
              Total Trees Planted
            </span>

            <strong>
              {formatNumber(
                totalTreesPlanted
              )}
            </strong>

            <small>
              Verified planting reports
            </small>
          </div>
        </div>

        <div className="ra-kpi-card">
          <div className="ra-kpi-icon ra-kpi-green">
            <FiBarChart2 size={20} />
          </div>

          <div>
            <span>
              Overall Survival Rate
            </span>

            <strong>
              {overallSurvivalRate}%
            </strong>

            <small>
              Monitoring records
            </small>
          </div>
        </div>

        <div className="ra-kpi-card">
          <div className="ra-kpi-icon ra-kpi-blue">
            <FiShield size={20} />
          </div>

          <div>
            <span>
              Verified Planting Reports
            </span>

            <strong>
              {formatNumber(
                filteredVerifiedReports.length
              )}
            </strong>

            <small>
              Verified reports only
            </small>
          </div>
        </div>

        <div className="ra-kpi-card">
          <div className="ra-kpi-icon ra-kpi-purple">
            <FiGrid size={20} />
          </div>

          <div>
            <span>
              Barangays Covered
            </span>

            <strong>
              {formatNumber(
                barangaysCovered
              )}
            </strong>

            <small>
              With verified activity
            </small>
          </div>
        </div>

        <div className="ra-kpi-card">
          <div className="ra-kpi-icon ra-kpi-orange">
            <FiMapPin size={20} />
          </div>

          <div>
            <span>
              Active Planting Sites
            </span>

            <strong>
              {formatNumber(
                filteredSites.length
              )}
            </strong>

            <small>
              Registered active sites
            </small>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="ra-filter-card">
        <div className="ra-filter-field">
          <label>Date Range</label>

          <div className="ra-date-range">
            <FiCalendar size={14} />

            <input
              type="date"
              value={dateFrom}
              onChange={(event) =>
                setDateFrom(
                  event.target.value
                )
              }
            />

            <span>to</span>

            <input
              type="date"
              value={dateTo}
              onChange={(event) =>
                setDateTo(
                  event.target.value
                )
              }
            />
          </div>
        </div>

        <div className="ra-filter-field">
          <label>Barangay</label>

          <select
            value={barangayFilter}
            onChange={(event) =>
              setBarangayFilter(
                event.target.value
              )
            }
          >
            <option value="All">
              All Barangays
            </option>

            {JUBAN_BARANGAYS.map((barangay) => (
              <option
                key={barangay}
                value={barangay}
              >
                {barangay}
              </option>
            ))}
          </select>
        </div>

        <div className="ra-filter-field">
          <label>
            Tree Species
          </label>

          <select
            value={speciesFilter}
            onChange={(event) =>
              setSpeciesFilter(
                event.target.value
              )
            }
          >
            <option value="All">
              All Species
            </option>

            {speciesOptions.map((species) => (
              <option
                key={species}
                value={species}
              >
                {species}
              </option>
            ))}
          </select>
        </div>

        <div className="ra-filter-field">
          <label>
            Planting Site
          </label>

          <select
            value={siteFilter}
            onChange={(event) =>
              setSiteFilter(
                event.target.value
              )
            }
          >
            <option value="All">
              All Sites
            </option>

            {siteOptions.map((site) => (
              <option
                key={site.value}
                value={site.value}
              >
                {site.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ra-clear-wrap">
          <button
            type="button"
            className="ra-secondary-button"
            onClick={clearFilters}
          >
            <FiRefreshCw size={14} />
            Clear Filters
          </button>
        </div>
      </div>

      {/* TOP ANALYTICS */}
      <div className="ra-chart-grid ra-chart-grid-top">
        {/* PLANTING TREND */}
        <section className="ra-chart-card">
          <div className="ra-card-heading">
            <h2>
              Planting Trend Over Time
            </h2>

            <p>
              Number of trees planted over time
            </p>
          </div>

          <div className="ra-chart-area">
            {plantingTrendData.length === 0 ? (
              <EmptyChart
                icon={
                  <FiTrendingUp
                    size={25}
                  />
                }
                title="No planting data yet"
                message="Planting trend will appear once verified planting reports contain records."
              />
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={plantingTrendData}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />

                  <Tooltip
                    formatter={(value) => [
                      formatNumber(value),
                      "Trees Planted",
                    ]}
                  />

                  <Bar
                    dataKey="treesPlanted"
                    fill="#2f9e57"
                    radius={[
                      5,
                      5,
                      0,
                      0,
                    ]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* SURVIVAL TREND */}
        <section className="ra-chart-card">
          <div className="ra-card-heading">
            <h2>
              Survival Rate Trend
            </h2>

            <p>
              Overall survival rate (%) over time
            </p>
          </div>

          <div className="ra-chart-area">
            {survivalTrendData.length === 0 ? (
              <EmptyChart
                icon={
                  <FiBarChart2
                    size={25}
                  />
                }
                title="No survival data yet"
                message="Survival trend will appear once monitoring records are submitted."
              />
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={survivalTrendData}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) =>
                      `${value}%`
                    }
                    tickLine={false}
                    axisLine={false}
                  />

                  <Tooltip
                    formatter={(value) => [
                      `${value}%`,
                      "Survival Rate",
                    ]}
                  />

                  <Line
                    type="monotone"
                    dataKey="survivalRate"
                    stroke="#238b45"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* MONITORING SUMMARY */}
        <section className="ra-chart-card">
          <div className="ra-card-heading">
            <h2>
              Monitoring Condition Summary
            </h2>

            <p>
              Distribution of monitored tree conditions
            </p>
          </div>

          <div className="ra-donut-layout">
            {conditionTotal === 0 ? (
              <EmptyChart
                icon={
                  <FiBarChart2
                    size={25}
                  />
                }
                title="No monitoring data yet"
                message="Condition distribution will appear once monitoring records are added."
              />
            ) : (
              <>
                <div className="ra-donut-chart">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <PieChart>
                      <Pie
                        data={
                          monitoringConditionData
                        }
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={82}
                      >
                        {monitoringConditionData.map(
                          (item) => (
                            <Cell
                              key={item.name}
                              fill={
                                CONDITION_COLORS[
                                  item.name
                                ]
                              }
                            />
                          )
                        )}
                      </Pie>

                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="ra-legend">
                  {monitoringConditionData.map(
                    (item) => (
                      <div
                        className="ra-legend-row"
                        key={item.name}
                      >
                        <span
                          className="ra-legend-dot"
                          style={{
                            background:
                              CONDITION_COLORS[
                                item.name
                              ],
                          }}
                        />

                        <span>
                          {item.name}
                        </span>

                        <strong>
                          {formatNumber(
                            item.value
                          )}{" "}
                          ({item.percent}%)
                        </strong>
                      </div>
                    )
                  )}

                  <div className="ra-total-box">
                    <span>
                      Total Trees Checked
                    </span>

                    <strong>
                      {formatNumber(
                        monitoringTotals.totalChecked
                      )}
                    </strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* BOTTOM ANALYTICS */}
      <div className="ra-chart-grid ra-chart-grid-bottom">
        {/* SPECIES DISTRIBUTION */}
        <section className="ra-chart-card">
          <div className="ra-card-heading">
            <h2>
              Tree Species Distribution
            </h2>

            <p>
              Percentage distribution of planted trees
              by species
            </p>
          </div>

          <div className="ra-species-layout">
            {speciesDistributionData.length === 0 ? (
              <EmptyChart
                icon={
                  <FiGrid size={25} />
                }
                title="No species data yet"
                message="Species distribution will appear once verified planting reports contain records."
              />
            ) : (
              <>
                <div className="ra-donut-chart">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <PieChart>
                      <Pie
                        data={
                          speciesDistributionData
                        }
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={82}
                      >
                        {speciesDistributionData.map(
                          (item, index) => (
                            <Cell
                              key={item.name}
                              fill={
                                SPECIES_COLORS[
                                  index %
                                    SPECIES_COLORS.length
                                ]
                              }
                            />
                          )
                        )}
                      </Pie>

                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="ra-legend">
                  {speciesDistributionData.map(
                    (item, index) => {
                      const percent =
                        speciesTotal > 0
                          ? Math.round(
                              (
                                item.value /
                                speciesTotal
                              ) * 100
                            )
                          : 0;

                      return (
                        <div
                          className="ra-legend-row"
                          key={item.name}
                        >
                          <span
                            className="ra-legend-dot"
                            style={{
                              background:
                                SPECIES_COLORS[
                                  index %
                                    SPECIES_COLORS.length
                                ],
                            }}
                          />

                          <span>
                            {item.name}
                          </span>

                          <strong>
                            {formatNumber(
                              item.value
                            )}{" "}
                            ({percent}%)
                          </strong>
                        </div>
                      );
                    }
                  )}

                  <div className="ra-total-inline">
                    <span>
                      Total Trees Planted
                    </span>

                    <strong>
                      {formatNumber(
                        speciesTotal
                      )}
                    </strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* SURVIVAL BY BARANGAY */}
        <section className="ra-chart-card">
          <div className="ra-card-heading">
            <h2>
              Survival Performance by Barangay
            </h2>

            <p>
              Overall survival rate (%) by barangay
            </p>
          </div>

          <div className="ra-chart-area ra-barangay-chart-area">
            {survivalByBarangayData.length === 0 ? (
              <EmptyChart
                icon={
                  <FiMapPin size={25} />
                }
                title="No barangay survival data yet"
                message="Barangay survival performance will appear once monitoring records are available."
              />
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={
                    survivalByBarangayData
                  }
                  layout="vertical"
                  margin={{
                    left: 25,
                    right: 20,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    horizontal={false}
                  />

                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(value) =>
                      `${value}%`
                    }
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    type="category"
                    dataKey="barangay"
                    width={115}
                    tickLine={false}
                    axisLine={false}
                  />

                  <Tooltip
                    formatter={(value) => [
                      `${value}%`,
                      "Survival Rate",
                    ]}
                  />

                  <Bar
                    dataKey="survivalRate"
                    fill="#2f9e57"
                    radius={[
                      0,
                      5,
                      5,
                      0,
                    ]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}