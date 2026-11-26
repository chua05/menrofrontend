import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { boundaryLayerOptions } from "../utils/barangayMap";
import { auth } from "../firebase/config";
import { formatDisplayId } from "../utils/displayId";

import {
  FiMapPin,
  FiRefreshCw,
} from "react-icons/fi";

import "leaflet/dist/leaflet.css";
import { textTooltip } from "../utils/leafletTooltip";
import KpiCard, { KpiGrid } from "../components/KpiCard";
import { TREE_CONDITIONS, TREE_PATH, locatedTrees, renderTreeMarkers } from "../components/map/treeMarkerLayer";
import { filterMapTrees, siteHasMatchingTree } from "../utils/mapTrees";
import "../styles/map-visualization.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Site-center colours (aggregate of the site's monitoring records).
const SITE_CONDITIONS = [
  "Healthy",
  "Damaged",
  "Dead",
  "Not Yet Monitored",
];
// The filter also reaches each permanent-sample tree's latest condition, which can be Needs Rechecking.
const CONDITION_OPTIONS = [...SITE_CONDITIONS.slice(0, 3), "Needs Rechecking", "Not Yet Monitored"];
const EMPTY_TREE_DATA = { trees: [], pendingTrees: [], locationUnavailable: 0 };

function TreeKey({ slug, count }) {
  return (
    <span className={`ra-tree-marker ra-tree-${slug} mv-tree-key`} aria-hidden="true">
      <svg viewBox="0 0 24 30"><path d={TREE_PATH} /></svg>
      {count && <span className="ra-tree-count">{count}</span>}
    </span>
  );
}

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
  if (report?.reportType === "parent" || report?.acceptedQuantity != null) {
    return Number(report?.acceptedQuantity || 0);
  }
  if (report?.staffApprovalRequired === true &&
      !["Accepted", "Approved"].includes(report?.staffReviewStatus) &&
      report?.verificationStatus !== "Approved") {
    return 0;
  }
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
  const treeLayerRef = useRef(null);

  const [treeData, setTreeData] = useState(EMPTY_TREE_DATA);
  const [treeError, setTreeError] = useState("");

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
    // Admin-approved permanent-sample trees (and, kept apart, trees of visits awaiting Admin review).
    const loadTreeMarkers = async (token) => {
      try {
        const response = await fetch(`${API_BASE_URL}/analytics/map-trees`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(payload?.data?.trees)) throw new Error(payload?.message || "Invalid tree marker response.");
        setTreeData({
          trees: payload.data.trees,
          pendingTrees: Array.isArray(payload.data.pendingTrees) ? payload.data.pendingTrees : [],
          locationUnavailable: Number(payload.data.locationUnavailable) || 0,
        });
        setTreeError("");
      } catch (error) {
        console.error("Unable to load monitored tree markers:", error);
        setTreeError("Unable to load monitored tree markers. The planting sites are still shown; use Refresh Map to retry.");
      }
    };

    setSitesLoading(true);
    setSitesError("");
    try {
      if (typeof auth.authStateReady === "function") await auth.authStateReady();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      // Tree markers load beside the site records; a failure there never removes the planting sites.
      const treesLoaded = loadTreeMarkers(token);
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
      await treesLoaded;
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

    fetch(`${API_BASE_URL}/sites/barangay-boundaries`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Failed to load Bulan barangay boundaries."
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

  // Approved markers first; Pending Review markers are drawn but never counted as approved.
  const markerTrees = useMemo(() => [...treeData.trees, ...treeData.pendingTrees], [treeData]);

  const speciesOptions = useMemo(() => {
    const values = new Set();

    siteAnalytics.forEach((site) => {
      site.species.forEach((species) => {
        values.add(species);
      });
    });
    // Each registered permanent tree's own species.
    markerTrees.forEach((tree) => {
      const species = normalizeText(tree.species);
      if (species && ![...values].some((value) => value.toLowerCase() === species.toLowerCase())) values.add(species);
    });

    return [...values].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [siteAnalytics, markerTrees]);

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

      // A site also matches through its own permanent-sample trees, so it is never hidden for lacking a direct field.
      const speciesMatches =
        speciesFilter === "All" ||
        site.species.includes(
          speciesFilter
        ) ||
        siteHasMatchingTree(site, markerTrees, { species: speciesFilter });

      const conditionMatches =
        conditionFilter === "All" ||
        site.condition ===
          conditionFilter ||
        siteHasMatchingTree(site, markerTrees, { condition: conditionFilter });

      return (
        barangayMatches &&
        siteMatches &&
        speciesMatches &&
        conditionMatches
      );
    });
  }, [
    siteAnalytics,
    markerTrees,
    barangayFilter,
    siteFilter,
    speciesFilter,
    conditionFilter,
  ]);

  // Every tree is filtered on its own barangay, site, species and latest condition.
  const filteredTrees = useMemo(() => filterMapTrees(markerTrees, {
    barangay: barangayFilter, site: siteFilter, species: speciesFilter, condition: conditionFilter,
  }), [markerTrees, barangayFilter, siteFilter, speciesFilter, conditionFilter]);
  const approvedTreeCount = filteredTrees.filter((tree) => tree.reviewStatus !== "Pending Review").length;
  const pendingTreeCount = filteredTrees.length - approvedTreeCount;
  const siteTreeCount = (site) => filteredTrees.filter((tree) => tree.siteId === site.siteId && tree.reviewStatus !== "Pending Review").length;

  const zoomToTrees = () => {
    const map = mapRef.current;
    const points = locatedTrees(filteredTrees).map((tree) => [Number(tree.latitude), Number(tree.longitude)]);
    if (!map || points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 18);
    else map.fitBounds(L.latLngBounds(points).pad(0.2), { maxZoom: 18 });
  };

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
        // A finite limit lets overlapping trees open as one list at the deepest zoom.
        maxZoom: 19,
      }
    );

    mapRef.current = map;
    // Added once; tree markers sit in Leaflet's marker pane, above site polygons and site-center circles.
    treeLayerRef.current = L.layerGroup().addTo(map);

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
      [12.6598, 123.918],
      11
    );

    return () => {
      map.remove();
      mapRef.current = null;
      treeLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current, layer = treeLayerRef.current;
    if (!map || !layer) return undefined;
    return renderTreeMarkers(map, layer, filteredTrees);
  }, [filteredTrees]);

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
        ...boundaryLayerOptions(map),
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
            feature?.properties?.ADM4_EN ||
            feature?.properties?.brgy_name || "";

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
          textTooltip(
            site.siteName ||
              site.siteId ||
              "Planting Site"
          )
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

  return (
    <div className="mv-page">
      <h1 className="page-title-hidden">Map Visualization</h1>

      {sitesLoading && <p role="status">Loading planting sites...</p>}
      {sitesError && <p role="alert">{sitesError} Use Refresh Map to retry.</p>}
      {treeError && <p role="alert" className="mv-tree-error">{treeError}</p>}

      <KpiGrid label="Map summary">
        <KpiCard title="Planting Sites" value={formatNumber(filteredSites.length)} description="Registered sites" tone="total" />
        <KpiCard title="Trees Planted" value={formatNumber(totalTreesPlanted)} description="Verified reports" tone="green" />
        <KpiCard title="Overall Survival Rate" value={`${overallSurvivalRate}%`} description="Monitoring records" tone="green" />
        <KpiCard title="Barangays Covered" value={formatNumber(barangaysCovered)} description="With planting sites" tone="blue" />
        <KpiCard title="Active Sites" value={formatNumber(activeSites.length)} description="Currently active" tone="orange" />
      </KpiGrid>

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
            className="mv-secondary-button"
            onClick={refreshData}
          >
            <FiRefreshCw size={14} />
            Refresh Map
          </button>

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

          {filteredTrees.length > 0 && (
            <button type="button" className="mv-zoom-trees" onClick={zoomToTrees}>
              Zoom to monitored trees
            </button>
          )}

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
                Site Monitoring Condition
              </strong>

              {SITE_CONDITIONS.map(
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
              <strong>
                Permanent Sample Trees
              </strong>

              {TREE_CONDITIONS.map(([value, slug, label]) => (
                <div className="mv-legend-row" key={value}>
                  <TreeKey slug={slug} />
                  {label}
                </div>
              ))}

              <div className="mv-legend-row">
                <TreeKey slug="pending" />
                Pending Review (submitted, not yet approved)
              </div>

              <div className="mv-legend-row">
                <TreeKey slug="mixed" count="3" />
                Overlapping trees — click to zoom in
              </div>
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

            <div className="mv-summary-row">
              <span>
                Approved permanent-sample trees
              </span>

              <strong>
                {formatNumber(approvedTreeCount)}
              </strong>
            </div>

            {pendingTreeCount > 0 && (
              <div className="mv-summary-row">
                <span>
                  Pending Review trees (not counted)
                </span>

                <strong>
                  {formatNumber(pendingTreeCount)}
                </strong>
              </div>
            )}

            {treeData.locationUnavailable > 0 && (
              <p className="mv-tree-note" role="status">
                Location unavailable: {formatNumber(treeData.locationUnavailable)} monitored sample{" "}
                {treeData.locationUnavailable === 1 ? "tree has" : "trees have"} no saved registration GPS and{" "}
                {treeData.locationUnavailable === 1 ? "is" : "are"} not drawn.
              </p>
            )}
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

              <div className="mv-summary-row">
                <span>
                  Approved permanent-sample trees
                </span>

                <strong>
                  {formatNumber(siteTreeCount(selectedSite))}
                </strong>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
