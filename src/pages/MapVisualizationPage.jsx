import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { auth } from "../firebase/config";
import { formatDisplayId } from "../utils/displayId";

import {
  FiActivity,
  FiBarChart2,
  FiDownload,
  FiMap,
  FiMapPin,
  FiRefreshCw,
  FiShield,
  FiTrendingUp,
} from "react-icons/fi";

import "leaflet/dist/leaflet.css";
import "../styles/map-visualization.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const CONDITION_OPTIONS = [
  "Healthy",
  "Damaged",
  "Dead",
  "Not Yet Monitored",
];

function normalizeText(value) {
  return String(value || "").trim();
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

function getReportStatus(report) {
  return normalizeVerificationStatus(
    report?.verificationStatus || report?.status
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
      report?.treeSpecies ||
      report?.treeName ||
      report?.seedlingName
  );
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
  const history = Array.isArray(record?.history) ? record.history : [];
  if (history.length > 0) return getMonitoringTotals(history[history.length - 1]);
  const healthy = Number(record?.healthyCount ?? record?.healthy) || 0;
  const damaged = Number(record?.damagedCount ?? record?.damaged) || 0;
  const dead = Number(record?.deadCount ?? record?.dead) || 0;

  let totalChecked = Number(record?.totalMonitored ?? record?.totalChecked) || 0;

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

function getSiteId(site) {
  return normalizeText(
    site?.id ||
      site?.siteId ||
      site?.plantingSiteId
  );
}

function getSiteName(site) {
  return normalizeText(
    site?.name ||
      site?.siteName ||
      site?.plantingSiteName
  );
}

function getSiteBarangay(site) {
  return normalizeText(site?.barangay);
}

function getSiteLatitude(site) {
  const value = site?.latitude ?? site?.lat ?? site?.coordinates?.lat ?? site?.location?.lat;
  return value === null || value === undefined || value === "" ? null : Number(value);
}

function getSiteLongitude(site) {
  const value = site?.longitude ?? site?.lng ?? site?.lon ?? site?.coordinates?.lng ?? site?.location?.lng;
  return value === null || value === undefined || value === "" ? null : Number(value);
}

function getSitePolygon(site) {
  if (Array.isArray(site?.polygon)) {
    return site.polygon;
  }

  if (Array.isArray(site?.boundary)) {
    return site.boundary;
  }

  if (Array.isArray(site?.coordinates)) {
    return site.coordinates;
  }

  return [];
}

function getSiteCapacity(site) {
  return (
    Number(site?.capacity) ||
    Number(site?.treeCapacity) ||
    Number(site?.maximumCapacity) ||
    0
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-PH").format(
    Number(value) || 0
  );
}

function getUtilizationStatus(percent) {
  if (percent >= 90) {
    return {
      label: "Full",
      color: "#e54848",
    };
  }

  if (percent >= 50) {
    return {
      label: "Partially Occupied",
      color: "#f3a62f",
    };
  }

  return {
    label: "Available",
    color: "#2f9e57",
  };
}

function getConditionColor(condition) {
  if (condition === "Healthy") {
    return "#2f9e57";
  }

  if (condition === "Damaged") {
    return "#f3a62f";
  }

  if (condition === "Dead") {
    return "#e54848";
  }

  return "#3182ce";
}

function getLatestMonitoringCondition(records) {
  if (!records.length) {
    return "Not Yet Monitored";
  }

  const latest = [...records].sort((a, b) => {
    const aDate = new Date(
      a?.monitoredDate ||
        a?.date ||
        a?.createdAt ||
        0
    );

    const bDate = new Date(
      b?.monitoredDate ||
        b?.date ||
        b?.createdAt ||
        0
    );

    return bDate - aDate;
  })[0];

  const healthy = Number(latest?.healthy) || 0;
  const damaged = Number(latest?.damaged) || 0;
  const dead = Number(latest?.dead) || 0;

  if (
    healthy === 0 &&
    damaged === 0 &&
    dead === 0
  ) {
    return "Not Yet Monitored";
  }

  if (dead >= healthy && dead >= damaged) {
    return "Dead";
  }

  if (
    damaged > healthy &&
    damaged >= dead
  ) {
    return "Damaged";
  }

  return "Healthy";
}

export default function MapVisualizationPage() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const barangayLayerRef = useRef(null);
  const siteLayerRef = useRef(null);

  const [plantingSites, setPlantingSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState("");

  const [plantingReports, setPlantingReports] = useState([]);
  const [monitoringRecords, setMonitoringRecords] = useState([]);

  const [geoJsonData, setGeoJsonData] = useState(null);

  const [barangayFilter, setBarangayFilter] = useState("All");
  const [siteFilter, setSiteFilter] = useState("All");
  const [speciesFilter, setSpeciesFilter] = useState("All");
  const [conditionFilter, setConditionFilter] = useState("All");

  const [selectedSite, setSelectedSite] = useState(null);

  const refreshData = async () => {
    setSitesLoading(true);
    setSitesError("");
    try {
      if (typeof auth.authStateReady === "function") await auth.authStateReady();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const paths = ["/sites", "/planting-reports", "/monitoring"];
      const responses = await Promise.all(paths.map((path) => fetch(`${API_BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      })));
      const payloads = await Promise.all(responses.map((response) => response.json().catch(() => ({}))));
      const failedIndex = responses.findIndex((response) => !response.ok);
      if (failedIndex >= 0) throw new Error(payloads[failedIndex]?.message || "Unable to load current map records.");
      if (payloads.some((payload) => !Array.isArray(payload.data))) throw new Error("Invalid map data response.");
      setPlantingSites(payloads[0].data);
      setPlantingReports(payloads[1].data);
      setMonitoringRecords(payloads[2].data);
    } catch (error) {
      console.error("Unable to load map planting sites:", error);
      setSitesError("Unable to load current map records.");
    } finally {
      setSitesLoading(false);
    }
  };

  useEffect(() => {
    // Initial backend synchronization; the same action powers Refresh Map.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshData();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshData();
    }, 60_000);
    const handleFocus = () => void refreshData();
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetch("/data/juban-barangays.geojson")
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Failed to load Juban barangay boundaries."
          );
        }

        return response.json();
      })
      .then((data) => {
        if (isMounted) {
          setGeoJsonData(data);
        }
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const verifiedReports = useMemo(() => {
    return plantingReports.filter(
      (report) =>
        report?.archived !== true &&
        getReportStatus(report) === "Verified"
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
        "archived",
        "inactive",
        "closed",
      ].includes(status);
    });
  }, [plantingSites]);

  const siteAnalytics = useMemo(() => {
    return activeSites.map((site) => {
      const siteId = getSiteId(site);
      const siteName = getSiteName(site);

      const relatedReports =
        verifiedReports.filter((report) => {
          const reportSiteId =
            getReportSiteId(report);

          const reportSiteName =
            getReportSiteName(report);

          return (
            (siteId &&
              reportSiteId === siteId) ||
            (siteName &&
              reportSiteName === siteName)
          );
        });

      const relatedMonitoring =
        activeMonitoringRecords.filter(
          (record) => {
            const monitoringSiteId =
              getMonitoringSiteId(record);

            const monitoringSiteName =
              getMonitoringSiteName(record);

            return (
              (siteId &&
                monitoringSiteId === siteId) ||
              (siteName &&
                monitoringSiteName ===
                  siteName)
            );
          }
        );

      const treesPlanted =
        relatedReports.reduce(
          (total, report) =>
            total +
            getReportQuantity(report),
          0
        );

      const capacity = getSiteCapacity(site);

      const utilization =
        capacity > 0
          ? Math.min(
              100,
              Math.round(
                (treesPlanted / capacity) *
                  100
              )
            )
          : 0;

      const utilizationStatus =
        getUtilizationStatus(utilization);

      const condition =
        getLatestMonitoringCondition(
          relatedMonitoring
        );

      const monitoringTotals =
        relatedMonitoring.reduce(
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

      const survivalRate =
        monitoringTotals.totalChecked > 0
          ? Math.round(
              (
                monitoringTotals.surviving /
                monitoringTotals.totalChecked
              ) * 100
            )
          : 0;

      const species = [
        ...new Set(
          relatedReports
            .map((report) =>
              getReportSpecies(report)
            )
            .filter(Boolean)
        ),
      ];

      return {
        ...site,
        displaySiteId: formatDisplayId("SITE", site?.siteId, siteId),
        siteId,
        siteName,
        barangay: getSiteBarangay(site),
        latitude: getSiteLatitude(site),
        longitude: getSiteLongitude(site),
        polygon: getSitePolygon(site),
        capacity,
        treesPlanted,
        utilization,
        utilizationLabel:
          utilizationStatus.label,
        utilizationColor:
          utilizationStatus.color,
        condition,
        conditionColor:
          getConditionColor(condition),
        survivalRate,
        monitoringTotals,
        species,
      };
    });
  }, [
    activeSites,
    verifiedReports,
    activeMonitoringRecords,
  ]);

  const speciesOptions = useMemo(() => {
    const values = new Set();

    siteAnalytics.forEach((site) => {
      site.species.forEach((species) => {
        values.add(species);
      });
    });

    return [...values].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [siteAnalytics]);

  const barangayOptions = useMemo(() =>
    [...new Set(siteAnalytics.map((site) => site.barangay).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)), [siteAnalytics]);

  const siteOptions = useMemo(() => {
    return siteAnalytics
      .map((site) => ({
        value:
          site.siteId ||
          site.siteName,

        label:
          [site.displaySiteId, site.siteName].filter(Boolean).join(" — ") ||
          site.siteId,
      }))
      .filter(
        (site) =>
          site.value &&
          site.label
      )
      .sort((a, b) =>
        a.label.localeCompare(b.label)
      );
  }, [siteAnalytics]);

  const filteredSites = useMemo(() => {
    return siteAnalytics.filter((site) => {
      const barangayMatches =
        barangayFilter === "All" ||
        site.barangay ===
          barangayFilter;

      const siteMatches =
        siteFilter === "All" ||
        siteFilter === site.siteId ||
        siteFilter === site.siteName;

      const speciesMatches =
        speciesFilter === "All" ||
        site.species.includes(
          speciesFilter
        );

      const conditionMatches =
        conditionFilter === "All" ||
        site.condition ===
          conditionFilter;

      return (
        barangayMatches &&
        siteMatches &&
        speciesMatches &&
        conditionMatches
      );
    });
  }, [
    siteAnalytics,
    barangayFilter,
    siteFilter,
    speciesFilter,
    conditionFilter,
  ]);

  const totalTreesPlanted = useMemo(() => {
    return filteredSites.reduce(
      (total, site) =>
        total + site.treesPlanted,
      0
    );
  }, [filteredSites]);

  const overallSurvivalRate = useMemo(() => {
    const totals =
      filteredSites.reduce(
        (total, site) => ({
          surviving:
            total.surviving +
            site.monitoringTotals
              .surviving,

          totalChecked:
            total.totalChecked +
            site.monitoringTotals
              .totalChecked,
        }),
        {
          surviving: 0,
          totalChecked: 0,
        }
      );

    if (totals.totalChecked <= 0) {
      return 0;
    }

    return Math.round(
      (totals.surviving /
        totals.totalChecked) *
        100
    );
  }, [filteredSites]);

  const barangaysCovered = useMemo(() => {
    return new Set(
      filteredSites
        .map((site) => site.barangay)
        .filter(Boolean)
    ).size;
  }, [filteredSites]);

  useEffect(() => {
    if (
      !mapContainerRef.current ||
      mapRef.current
    ) {
      return;
    }

    const map = L.map(
      mapContainerRef.current,
      {
        zoomControl: true,
      }
    );

    mapRef.current = map;

    const mapTilerKey =
      import.meta.env
        .VITE_MAPTILER_API_KEY;

    if (mapTilerKey) {
      L.tileLayer(
        `https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=${mapTilerKey}`,
        {
          tileSize: 512,
          zoomOffset: -1,
          minZoom: 1,
          attribution:
            '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
          crossOrigin: true,
        }
      ).addTo(map);
    }

    map.setView(
      [12.85, 123.98],
      11
    );

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !geoJsonData) {
      return;
    }

    if (
      barangayLayerRef.current
    ) {
      map.removeLayer(
        barangayLayerRef.current
      );
    }

    const layer = L.geoJSON(
      geoJsonData,
      {
        style: {
          color: "#49685a",
          weight: 1.2,
          fillColor: "#dcebdd",
          fillOpacity: 0.2,
        },

        onEachFeature: (
          feature,
          featureLayer
        ) => {
          const name =
            feature?.properties
              ?.brgy_name || "";

          if (name) {
            featureLayer.bindTooltip(
              name,
              {
                permanent: true,
                direction: "center",
                className:
                  "mv-barangay-label",
              }
            );
          }
        },
      }
    ).addTo(map);

    barangayLayerRef.current =
      layer;

    const bounds = layer.getBounds();

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [20, 20],
      });
    }
  }, [geoJsonData]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (siteLayerRef.current) {
      map.removeLayer(
        siteLayerRef.current
      );
    }

    const group =
      L.layerGroup().addTo(map);

    filteredSites.forEach((site) => {
      const polygon =
        Array.isArray(site.polygon)
          ? site.polygon
          : [];

      if (polygon.length >= 3) {
        const latLngs = polygon
          .map((point) => {
            if (Array.isArray(point)) {
              return [
                Number(point[0]),
                Number(point[1]),
              ];
            }

            return [
              Number(
                point?.lat ||
                  point?.latitude
              ),
              Number(
                point?.lng ||
                  point?.longitude
              ),
            ];
          })
          .filter(
            ([lat, lng]) =>
              Number.isFinite(lat) &&
              Number.isFinite(lng)
          );

        if (latLngs.length >= 3) {
          const polygonLayer =
            L.polygon(latLngs, {
              color:
                site.utilizationColor,
              fillColor:
                site.utilizationColor,
              fillOpacity: 0.28,
              weight: 2,
            });

          polygonLayer.on(
            "click",
            () => {
              setSelectedSite(site);
            }
          );

          polygonLayer.addTo(group);
        }
      }

      if (
        Number.isFinite(
          site.latitude
        ) &&
        Number.isFinite(
          site.longitude
        )
      ) {
        const marker =
          L.circleMarker(
            [
              site.latitude,
              site.longitude,
            ],
            {
              radius: 7,
              color: "#ffffff",
              weight: 2,
              fillColor:
                site.conditionColor,
              fillOpacity: 1,
            }
          );

        marker.bindTooltip(
          site.siteName ||
            site.siteId ||
            "Planting Site"
        );

        marker.on("click", () => {
          setSelectedSite(site);
        });

        marker.addTo(group);
      }
    });

    siteLayerRef.current = group;
  }, [filteredSites]);

  const resetFilters = () => {
    setBarangayFilter("All");
    setSiteFilter("All");
    setSpeciesFilter("All");
    setConditionFilter("All");
  };

  const exportMapSummary = () => {
    const rows = [
      [
        "Site",
        "Barangay",
        "Trees Planted",
        "Utilization",
        "Condition",
        "Survival Rate",
      ],
      ...filteredSites.map(
        (site) => [
          site.siteName ||
            site.siteId,
          site.barangay,
          site.treesPlanted,
          `${site.utilization}%`,
          site.condition,
          `${site.survivalRate}%`,
        ]
      ),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) =>
            `"${String(
              value ?? ""
            ).replace(/"/g, '""')}"`
          )
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
      "map-visualization-summary.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="mv-page">
      <div className="mv-header">
        <div className="mv-heading">
          <div className="mv-heading-icon">
            <FiMap size={21} />
          </div>

          <div>
            <h1>
              Map Visualization
            </h1>

            <p>
              View planting sites,
              utilization status, verified
              planting activity, and tree
              monitoring information across
              Juban, Sorsogon.
            </p>
          </div>
        </div>

        <div className="mv-header-actions">
          <button
            type="button"
            className="mv-secondary-button"
            onClick={refreshData}
          >
            <FiRefreshCw size={14} />
            Refresh Map
          </button>

          <button
            type="button"
            className="mv-primary-button"
            onClick={
              exportMapSummary
            }
          >
            <FiDownload size={14} />
            Export Map Report
          </button>
        </div>
      </div>

      {sitesLoading && <p role="status">Loading planting sites...</p>}
      {sitesError && <p role="alert">{sitesError} Use Refresh Map to retry.</p>}

      <div className="mv-kpi-grid">
        <div className="mv-kpi-card">
          <div className="mv-kpi-icon">
            <FiMapPin size={20} />
          </div>

          <div>
            <strong>
              {formatNumber(
                filteredSites.length
              )}
            </strong>

            <span>
              Planting Sites
            </span>

            <small>
              Registered sites
            </small>
          </div>
        </div>

        <div className="mv-kpi-card">
          <div className="mv-kpi-icon">
            <FiTrendingUp size={20} />
          </div>

          <div>
            <strong>
              {formatNumber(
                totalTreesPlanted
              )}
            </strong>

            <span>
              Trees Planted
            </span>

            <small>
              Verified reports
            </small>
          </div>
        </div>

        <div className="mv-kpi-card">
          <div className="mv-kpi-icon">
            <FiActivity size={20} />
          </div>

          <div>
            <strong>
              {overallSurvivalRate}%
            </strong>

            <span>
              Overall Survival Rate
            </span>

            <small>
              Monitoring records
            </small>
          </div>
        </div>

        <div className="mv-kpi-card">
          <div className="mv-kpi-icon">
            <FiBarChart2 size={20} />
          </div>

          <div>
            <strong>
              {formatNumber(
                barangaysCovered
              )}
            </strong>

            <span>
              Barangays Covered
            </span>

            <small>
              With planting sites
            </small>
          </div>
        </div>

        <div className="mv-kpi-card">
          <div className="mv-kpi-icon">
            <FiShield size={20} />
          </div>

          <div>
            <strong>
              {formatNumber(
                activeSites.length
              )}
            </strong>

            <span>
              Active Sites
            </span>

            <small>
              Currently active
            </small>
          </div>
        </div>
      </div>

      <div className="mv-filter-card">
        <div className="mv-filter-field">
          <label>
            Barangay
          </label>

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

            {barangayOptions.map(
              (barangay) => (
                <option
                  key={barangay}
                  value={barangay}
                >
                  {barangay}
                </option>
              )
            )}
          </select>
        </div>

        <div className="mv-filter-field">
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

            {siteOptions.map(
              (site) => (
                <option
                  key={site.value}
                  value={site.value}
                >
                  {site.label}
                </option>
              )
            )}
          </select>
        </div>

        <div className="mv-filter-field">
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

            {speciesOptions.map(
              (species) => (
                <option
                  key={species}
                  value={species}
                >
                  {species}
                </option>
              )
            )}
          </select>
        </div>

        <div className="mv-filter-field">
          <label>
            Monitoring Condition
          </label>

          <select
            value={conditionFilter}
            onChange={(event) =>
              setConditionFilter(
                event.target.value
              )
            }
          >
            <option value="All">
              All Conditions
            </option>

            {CONDITION_OPTIONS.map(
              (condition) => (
                <option
                  key={condition}
                  value={condition}
                >
                  {condition}
                </option>
              )
            )}
          </select>
        </div>

        <div className="mv-filter-action">
          <button
            type="button"
            className="mv-clear-button"
            onClick={resetFilters}
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="mv-content-grid">
        <section className="mv-map-card">
        <div
            ref={mapContainerRef}
            className="mv-map"
        />

            <div className="mv-map-pan-controls">
            <button
                type="button"
                className="mv-map-pan-button mv-pan-up"
                onClick={() => {
                mapRef.current?.panBy([0, -180], {
                    animate: true,
                });
                }}
                title="Pan map up"
                aria-label="Pan map up"
            >
                ↑
            </button>

            <button
                type="button"
                className="mv-map-pan-button mv-pan-left"
                onClick={() => {
                mapRef.current?.panBy([-180, 0], {
                    animate: true,
                });
                }}
                title="Pan map left"
                aria-label="Pan map left"
            >
                ←
            </button>

            <button
                type="button"
                className="mv-map-pan-button mv-pan-right"
                onClick={() => {
                mapRef.current?.panBy([180, 0], {
                    animate: true,
                });
                }}
                title="Pan map right"
                aria-label="Pan map right"
            >
                →
            </button>

            <button
                type="button"
                className="mv-map-pan-button mv-pan-down"
                onClick={() => {
                mapRef.current?.panBy([0, 180], {
                    animate: true,
                });
                }}
                title="Pan map down"
                aria-label="Pan map down"
            >
                ↓
            </button>
            </div>

          {filteredSites.length === 0 && (
            <div className="mv-empty-map-message">
              <FiMapPin size={20} />

              <div>
                <strong>
                  No planting sites to display yet.
                </strong>

                <span>
                  Registered planting sites will appear
                  on the map once site records are
                  available.
                </span>
              </div>
            </div>
          )}
        </section>

        <aside className="mv-side-panel">
          <div className="mv-panel-card">
            <h3>
              Map Legend
            </h3>

            <div className="mv-legend-section">
              <strong>
                Site Utilization
              </strong>

              <div className="mv-legend-row">
                <span
                  className="mv-legend-dot"
                  style={{
                    background:
                      "#2f9e57",
                  }}
                />
                Available 0–49%
              </div>

              <div className="mv-legend-row">
                <span
                  className="mv-legend-dot"
                  style={{
                    background:
                      "#f3a62f",
                  }}
                />
                Partially Occupied 50–89%
              </div>

              <div className="mv-legend-row">
                <span
                  className="mv-legend-dot"
                  style={{
                    background:
                      "#e54848",
                  }}
                />
                Full 90–100%
              </div>
            </div>

            <div className="mv-legend-section">
              <strong>
                Monitoring Condition
              </strong>

              {CONDITION_OPTIONS.map(
                (condition) => (
                  <div
                    className="mv-legend-row"
                    key={condition}
                  >
                    <span
                      className="mv-legend-dot"
                      style={{
                        background:
                          getConditionColor(
                            condition
                          ),
                      }}
                    />

                    {condition}
                  </div>
                )
              )}
            </div>

            <div className="mv-legend-section">
              <div className="mv-boundary-legend">
                <span />
                Barangay Boundary
              </div>
            </div>
          </div>

          <div className="mv-panel-card">
            <h3>
              Map Summary
            </h3>

            <div className="mv-summary-row">
              <span>
                Total Planting Sites
              </span>

              <strong>
                {formatNumber(
                  filteredSites.length
                )}
              </strong>
            </div>

            <div className="mv-summary-row">
              <span>
                Trees Planted
              </span>

              <strong>
                {formatNumber(
                  totalTreesPlanted
                )}
              </strong>
            </div>

            <div className="mv-summary-row">
              <span>
                Barangays Covered
              </span>

              <strong>
                {formatNumber(
                  barangaysCovered
                )}
              </strong>
            </div>

            <div className="mv-summary-row">
              <span>
                Overall Survival
              </span>

              <strong>
                {overallSurvivalRate}%
              </strong>
            </div>
          </div>

          {selectedSite && (
            <div className="mv-panel-card mv-selected-site">
              <div className="mv-selected-header">
                <div>
                  <span>
                    Selected Site
                  </span>

                  <h3>
                    {selectedSite.siteName ||
                      selectedSite.displaySiteId}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedSite(
                      null
                    )
                  }
                >
                  ×
                </button>
              </div>

              <div className="mv-summary-row">
                <span>
                  Site ID
                </span>

                <strong>
                  {selectedSite.displaySiteId || selectedSite.siteId || "—"}
                </strong>
              </div>

              <div className="mv-summary-row">
                <span>
                  Barangay
                </span>

                <strong>
                  {selectedSite.barangay ||
                    "—"}
                </strong>
              </div>

              <div className="mv-summary-row">
                <span>
                  Trees Planted
                </span>

                <strong>
                  {formatNumber(
                    selectedSite.treesPlanted
                  )}
                </strong>
              </div>

              <div className="mv-summary-row">
                <span>
                  Utilization
                </span>

                <strong>
                  {
                    selectedSite.utilization
                  }
                  %
                </strong>
              </div>

              <div className="mv-summary-row">
                <span>
                  Site Status
                </span>

                <strong>
                  {
                    selectedSite.utilizationLabel
                  }
                </strong>
              </div>

              <div className="mv-summary-row">
                <span>
                  Condition
                </span>

                <strong>
                  {
                    selectedSite.condition
                  }
                </strong>
              </div>

              <div className="mv-summary-row">
                <span>
                  Survival Rate
                </span>

                <strong>
                  {
                    selectedSite.survivalRate
                  }
                  %
                </strong>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
