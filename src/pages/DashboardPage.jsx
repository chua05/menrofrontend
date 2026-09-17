import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleCheckBig,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  MapPin,
  PackageCheck,
  Sprout,
  Trees,
  Users,
} from "lucide-react";

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

import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase/config";
import "../styles/dashboard-page.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const BARANGAY_GEOJSON_URL = "/data/juban-barangays.geojson";

const JUBAN_FALLBACK_CENTER = {
  lat: 12.82,
  lng: 124.0,
};

const BARANGAYS = [
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

const SURVIVAL_COLORS = [
  "#16813d",
  "#287e47",
  "#f0aa12",
  "#ef7b23",
  "#e63f2d",
  "#455d7a",
  "#94a3b8",
];

function unwrapArray(payload) {
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.data,
    payload?.data?.items,
    payload?.data?.records,
    payload?.data?.users,
    payload?.data?.requests,
    payload?.data?.sites,
    payload?.data?.seedlings,
    payload?.data?.inventory,
    payload?.data?.distributions,
    payload?.data?.reports,
    payload?.data?.events,
    payload?.items,
    payload?.records,
    payload?.users,
    payload?.requests,
    payload?.sites,
    payload?.seedlings,
    payload?.inventory,
    payload?.distributions,
    payload?.reports,
    payload?.events,
  ];

  return candidates.find(Array.isArray) || [];
}

async function getFreshToken() {
  const getToken = async (firebaseUser) => {
    const token = await firebaseUser.getIdToken();
    localStorage.setItem("token", token);
    return token;
  };

  if (auth.currentUser) {
    return getToken(auth.currentUser);
  }

  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};

    const timeoutId = window.setTimeout(() => {
      unsubscribe();
      reject(new Error("Firebase authentication session not found."));
    }, 5000);

    unsubscribe = auth.onAuthStateChanged(
      async (firebaseUser) => {
        if (!firebaseUser) return;

        window.clearTimeout(timeoutId);
        unsubscribe();

        try {
          resolve(await getToken(firebaseUser));
        } catch (error) {
          reject(error);
        }
      },
      (error) => {
        window.clearTimeout(timeoutId);
        unsubscribe();
        reject(error);
      }
    );
  });
}

async function apiGet(path, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    throw new Error(payload?.message || "Authentication session expired.");
  }

  if (!response.ok) {
    throw new Error(payload?.message || `Unable to load ${path}.`);
  }

  return unwrapArray(payload);
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function getDate(record) {
  const candidates = [
    record?.createdAt,
    record?.updatedAt,
    record?.submittedAt,
    record?.requestDate,
    record?.dateSubmitted,
    record?.distributionDate,
    record?.distribution_date,
    record?.date,
    record?.verifiedAt,
    record?.monitoringDate,
    record?.dateMonitored,
    record?.eventDate,
    record?.proposedDate,
    record?.scheduledDate,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (typeof candidate?.toDate === "function") {
      const date = candidate.toDate();

      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    const date = new Date(candidate);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function formatDate(date) {
  if (!date) return "—";

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeRange(event) {
  const start =
    event?.startTime ||
    event?.eventStartTime ||
    event?.timeStart ||
    event?.time ||
    "";

  const end =
    event?.endTime ||
    event?.eventEndTime ||
    event?.timeEnd ||
    "";

  if (start && end) return `${start} - ${end}`;

  return start || end || "Time not set";
}

function getEventDate(event) {
  const candidates = [
    event?.eventDate,
    event?.date,
    event?.proposedDate,
    event?.scheduledDate,
    event?.startDate,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    const date = new Date(candidate);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function getParticipantIdentity(currentUser) {
  return {
    uid: String(currentUser?.uid || currentUser?.id || ""),
    email: String(currentUser?.email || "").toLowerCase(),
    name: String(
      currentUser?.fullName ||
        currentUser?.displayName ||
        currentUser?.name ||
        ""
    ).toLowerCase(),
  };
}

function belongsToParticipant(record, identity) {
  if (!record) return false;

  const uidCandidates = [
    record?.participantId,
    record?.createdByUid,
    record?.userId,
    record?.requesterUid,
    record?.submittedByUid,
    record?.uid,
  ]
    .filter(Boolean)
    .map(String);

  if (identity.uid && uidCandidates.includes(identity.uid)) {
    return true;
  }

  const emailCandidates = [
    record?.email,
    record?.requesterEmail,
    record?.participantEmail,
    record?.createdByEmail,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  if (identity.email && emailCandidates.includes(identity.email)) {
    return true;
  }

  const nameCandidates = [
    record?.participant,
    record?.requesterName,
    record?.fullName,
    record?.createdBy,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return Boolean(identity.name && nameCandidates.includes(identity.name));
}

function sumItemQuantities(items) {
  if (!Array.isArray(items)) return 0;

  return items.reduce(
    (total, item) =>
      total +
      Number(
        item?.quantity ??
          item?.qty ??
          item?.count ??
          item?.seedlings ??
          0
      ),
    0
  );
}

function getRequestQuantity(record) {
  return (
    Number(
      record?.totalQuantity ??
        record?.totalSeedlings ??
        record?.requestedQuantity ??
        record?.quantity ??
        0
    ) ||
    sumItemQuantities(record?.trees) ||
    sumItemQuantities(record?.seedlings) ||
    sumItemQuantities(record?.seedlingItems) ||
    sumItemQuantities(record?.items)
  );
}

function getStockQuantity(record) {
  return Number(
    record?.availableQuantity ??
      record?.currentStock ??
      record?.stock ??
      record?.quantity ??
      record?.available ??
      0
  );
}

function getDistributedQuantity(record) {
  return (
    Number(
      record?.distributedQuantity ??
        record?.quantity ??
        record?.totalQuantity ??
        record?.totalSeedlings ??
        0
    ) ||
    sumItemQuantities(record?.items) ||
    sumItemQuantities(record?.seedlings)
  );
}

function getPlantedQuantity(record) {
  return Number(
    record?.quantity ??
      record?.treesPlanted ??
      record?.plantedQuantity ??
      record?.seedlingsPlanted ??
      record?.treeCount ??
      record?.totalTrees ??
      0
  );
}

function getSurvivalRate(record) {
  const direct = Number(
    record?.survivalRate ??
      record?.survival_rate ??
      record?.rate ??
      record?.survivalPercentage
  );

  if (Number.isFinite(direct) && direct >= 0) {
    return direct;
  }

  const healthy = Number(record?.healthy ?? record?.healthyCount ?? 0);
  const damaged = Number(record?.damaged ?? record?.damagedCount ?? 0);
  const dead = Number(record?.dead ?? record?.deadCount ?? 0);
  const total = healthy + damaged + dead;

  if (total > 0) {
    return ((healthy + damaged) / total) * 100;
  }

  return null;
}

function getRequestStatus(record) {
  return normalizeStatus(
    record?.status ||
      record?.requestStatus ||
      record?.approvalStatus ||
      "pending review"
  );
}

function getReportStatus(record) {
  return normalizeStatus(
    record?.verificationStatus ||
      record?.status ||
      record?.verification_status ||
      "pending"
  );
}

function getSiteCapacity(site) {
  return Number(
    site?.maximumCapacity ??
      site?.maxCapacity ??
      site?.capacity ??
      site?.maximum_capacity ??
      0
  );
}

function getSitePlanted(site, reports) {
  const direct = Number(
    site?.treesPlanted ??
      site?.planted ??
      site?.currentTrees ??
      site?.usedCapacity ??
      0
  );

  if (direct > 0) return direct;

  const siteId = String(site?.id || site?.siteId || "");

  if (!siteId) return 0;

  return reports
    .filter(
      (report) =>
        String(report?.siteId || report?.plantingSiteId || "") === siteId
    )
    .reduce((total, report) => total + getPlantedQuantity(report), 0);
}

function getSiteCondition(site, monitoring) {
  if (site?.treeCondition) return site.treeCondition;
  if (site?.condition) return site.condition;

  const siteId = String(site?.id || site?.siteId || "");

  if (!siteId) return "Not Yet Monitored";

  const latest = monitoring
    .filter(
      (record) =>
        String(record?.siteId || record?.plantingSiteId || "") === siteId
    )
    .sort(
      (a, b) =>
        (getDate(b)?.getTime() || 0) -
        (getDate(a)?.getTime() || 0)
    )[0];

  return (
    latest?.condition ||
    latest?.treeCondition ||
    latest?.status ||
    "Not Yet Monitored"
  );
}

function monthKey(date) {
  if (!date) return "";

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function buildMonthlyActivity(distributions, reports, monitoring) {
  const now = new Date();
  const months = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - offset,
      1
    );

    months.push({
      key: monthKey(date),
      month: date.toLocaleDateString("en-PH", {
        month: "short",
      }),
      allocated: 0,
      planted: 0,
      survivalRates: [],
    });
  }

  const buckets = new Map(
    months.map((item) => [item.key, item])
  );

  distributions.forEach((record) => {
    const bucket = buckets.get(monthKey(getDate(record)));

    if (bucket) {
      bucket.allocated += getDistributedQuantity(record);
    }
  });

  reports.forEach((record) => {
    const bucket = buckets.get(monthKey(getDate(record)));

    if (bucket) {
      bucket.planted += getPlantedQuantity(record);
    }
  });

  monitoring.forEach((record) => {
    const bucket = buckets.get(monthKey(getDate(record)));
    const rate = getSurvivalRate(record);

    if (bucket && rate !== null) {
      bucket.survivalRates.push(rate);
    }
  });

  return months.map((item) => ({
    month: item.month,
    allocated: item.allocated,
    planted: item.planted,
    survivalRate:
      item.survivalRates.length > 0
        ? Math.round(
            item.survivalRates.reduce(
              (sum, value) => sum + value,
              0
            ) / item.survivalRates.length
          )
        : null,
  }));
}

function buildSurvivalByBarangay(monitoring) {
  const grouped = new Map();

  monitoring.forEach((record) => {
    const barangay = record?.barangay;
    const rate = getSurvivalRate(record);

    if (!barangay || rate === null) return;

    if (!grouped.has(barangay)) {
      grouped.set(barangay, []);
    }

    grouped.get(barangay).push(rate);
  });

  return Array.from(grouped.entries())
    .map(([barangay, rates]) => ({
      barangay,
      rate: Math.round(
        rates.reduce((sum, value) => sum + value, 0) /
          rates.length
      ),
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 7);
}

function createRecentActivities({
  requests,
  reports,
  monitoring,
  events,
}) {
  const rows = [];

  requests.forEach((record) => {
    rows.push({
      id: `request-${
        record?.id ||
        record?.requestId ||
        `${record?.createdAt || ""}-${record?.email || ""}`
      }`,
      type: "approved",
      title: `Seedling request ${
        record?.id || record?.requestId || ""
      }`.trim(),
      detail: `${
        record?.purpose || record?.activity || "Seedling request"
      } • ${getRequestQuantity(record)} seedlings • ${
        record?.status || "Pending"
      }`,
      date: getDate(record),
    });
  });

  reports.forEach((record) => {
    rows.push({
      id: `report-${
        record?.id ||
        record?.reportId ||
        `${record?.createdAt || ""}-${record?.barangay || ""}`
      }`,
      type: "report",
      title: `Planting report ${
        record?.id || record?.reportId || ""
      }`.trim(),
      detail: `${
        record?.siteName ||
        record?.barangay ||
        "Planting activity"
      } • ${
        record?.verificationStatus ||
        record?.status ||
        "Pending"
      }`,
      date: getDate(record),
    });
  });

  monitoring.forEach((record) => {
    rows.push({
      id: `monitoring-${
        record?.id ||
        record?.recordId ||
        `${record?.createdAt || ""}-${record?.barangay || ""}`
      }`,
      type: "monitoring",
      title: `Monitoring update ${
        record?.id || record?.recordId || ""
      }`.trim(),
      detail: `${
        record?.siteName ||
        record?.barangay ||
        "Tree survival monitoring"
      }${
        getSurvivalRate(record) !== null
          ? ` • ${Math.round(
              getSurvivalRate(record)
            )}% survival`
          : ""
      }`,
      date: getDate(record),
    });
  });

  events.forEach((record) => {
    rows.push({
      id: `event-${
        record?.id ||
        record?.eventId ||
        `${record?.eventDate || ""}-${record?.eventName || ""}`
      }`,
      type: "event",
      title:
        record?.name ||
        record?.eventName ||
        record?.title ||
        "Planting event",
      detail:
        record?.location ||
        record?.eventLocation ||
        record?.plantingSiteLocation ||
        record?.barangay ||
        "Juban, Sorsogon",
      date: getEventDate(record),
    });
  });

  return rows
    .filter((item) => item.date)
    .sort((a, b) => b.date - a.date)
    .slice(0, 6);
}

function ActivityIcon({ type }) {
  if (type === "approved") {
    return <ClipboardCheck size={16} />;
  }

  if (type === "event") {
    return <CalendarDays size={16} />;
  }

  if (type === "report") {
    return <FileCheck2 size={16} />;
  }

  if (type === "monitoring") {
    return <Trees size={16} />;
  }

  return <Sprout size={16} />;
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="dashboard-empty">
      <div className="dashboard-empty-icon">
        <Icon size={23} />
      </div>

      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function getUtilizationColor(utilization) {
  if (utilization >= 90) {
    return {
      fill: "#ef4444",
      stroke: "#d72f2f",
    };
  }

  if (utilization >= 50) {
    return {
      fill: "#facc15",
      stroke: "#d6a900",
    };
  }

  return {
    fill: "#4caf63",
    stroke: "#2f9847",
  };
}

function getConditionColor(condition) {
  switch (condition) {
    case "Healthy":
      return "#1aa343";

    case "Needs Attention":
      return "#f4b400";

    case "Critical":
      return "#e52d2d";

    default:
      return "#3186d9";
  }
}

function DashboardSitesMap({
  sites,
  reports,
  monitoring,
  onViewAll,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const boundaryLayerRef = useRef(null);
  const jubanBoundsRef = useRef(null);
  const siteLayersRef = useRef([]);
  const panControlRef = useRef(null);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      try {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
          center: [
            JUBAN_FALLBACK_CENTER.lat,
            JUBAN_FALLBACK_CENTER.lng,
          ],
          zoom: 12,
          minZoom: 11,
          maxZoom: 19,
          zoomControl: true,
          attributionControl: true,
        });

        const mapTilerKey =
          import.meta.env.VITE_MAPTILER_API_KEY;

        if (!mapTilerKey) {
          throw new Error(
            "MapTiler API key is not configured."
          );
        }

        L.tileLayer(
          `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerKey}`,
          {
            tileSize: 512,
            zoomOffset: -1,
            minZoom: 1,
            maxZoom: 20,
            crossOrigin: true,
            attribution:
              '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }
        ).addTo(map);

        const PanControl = L.Control.extend({
          options: {
            position: "topleft",
          },

          onAdd() {
            const container = L.DomUtil.create(
              "div",
              "leaflet-bar dashboard-pan-control"
            );

            const upButton = L.DomUtil.create(
              "button",
              "dashboard-pan-control-btn dashboard-pan-up",
              container
            );

            const leftButton = L.DomUtil.create(
              "button",
              "dashboard-pan-control-btn dashboard-pan-left",
              container
            );

            const rightButton = L.DomUtil.create(
              "button",
              "dashboard-pan-control-btn dashboard-pan-right",
              container
            );

            const downButton = L.DomUtil.create(
              "button",
              "dashboard-pan-control-btn dashboard-pan-down",
              container
            );

            upButton.type = "button";
            leftButton.type = "button";
            rightButton.type = "button";
            downButton.type = "button";

            upButton.title = "Pan up";
            leftButton.title = "Pan left";
            rightButton.title = "Pan right";
            downButton.title = "Pan down";

            upButton.setAttribute("aria-label", "Pan map up");
            leftButton.setAttribute(
              "aria-label",
              "Pan map left"
            );
            rightButton.setAttribute(
              "aria-label",
              "Pan map right"
            );
            downButton.setAttribute(
              "aria-label",
              "Pan map down"
            );

            upButton.innerHTML = "&#8593;";
            leftButton.innerHTML = "&#8592;";
            rightButton.innerHTML = "&#8594;";
            downButton.innerHTML = "&#8595;";

            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            L.DomEvent.on(
              upButton,
              "click",
              (event) => {
                L.DomEvent.stop(event);

                map.panBy(
                  [
                    0,
                    -Math.round(
                      map.getSize().y * 0.25
                    ),
                  ],
                  {
                    animate: true,
                  }
                );
              }
            );

            L.DomEvent.on(
              leftButton,
              "click",
              (event) => {
                L.DomEvent.stop(event);

                map.panBy(
                  [
                    -Math.round(
                      map.getSize().x * 0.25
                    ),
                    0,
                  ],
                  {
                    animate: true,
                  }
                );
              }
            );

            L.DomEvent.on(
              rightButton,
              "click",
              (event) => {
                L.DomEvent.stop(event);

                map.panBy(
                  [
                    Math.round(
                      map.getSize().x * 0.25
                    ),
                    0,
                  ],
                  {
                    animate: true,
                  }
                );
              }
            );

            L.DomEvent.on(
              downButton,
              "click",
              (event) => {
                L.DomEvent.stop(event);

                map.panBy(
                  [
                    0,
                    Math.round(
                      map.getSize().y * 0.25
                    ),
                  ],
                  {
                    animate: true,
                  }
                );
              }
            );

            return container;
          },
        });

        const panControl = new PanControl();
        panControl.addTo(map);
        panControlRef.current = panControl;

        mapRef.current = map;

        const response = await fetch(
          BARANGAY_GEOJSON_URL
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load Juban GeoJSON (${response.status}).`
          );
        }

        const geoJson = await response.json();

        if (
          geoJson?.type !== "FeatureCollection" ||
          !Array.isArray(geoJson.features)
        ) {
          throw new Error(
            "Invalid Juban barangay GeoJSON."
          );
        }

        if (cancelled || mapRef.current !== map) {
          return;
        }

        const boundaryLayer = L.geoJSON(geoJson, {
          style: {
            color: "#17643a",
            weight: 1.7,
            opacity: 0.96,
            fillColor: "#dff2e5",
            fillOpacity: 0.32,
          },
          interactive: false,
          onEachFeature: (feature, layer) => {
            const barangayName =
              feature?.properties?.brgy_name ||
              feature?.properties?.barangay ||
              feature?.properties?.name ||
              feature?.properties?.NAME;

            if (
              !barangayName ||
              !layer.getBounds
            ) {
              return;
            }

            const bounds = layer.getBounds();

            if (!bounds.isValid()) return;

            layer.bindTooltip(
              String(barangayName),
              {
                permanent: true,
                direction: "center",
                className:
                  "dashboard-map-barangay-label",
                interactive: false,
                opacity: 1,
              }
            );
          },
        }).addTo(map);

        boundaryLayerRef.current =
          boundaryLayer;

        const jubanBounds =
          boundaryLayer.getBounds();

        if (jubanBounds.isValid()) {
          jubanBoundsRef.current =
            jubanBounds;

          map.fitBounds(
            jubanBounds.pad(0.28),
            {
              padding: [22, 22],
              maxZoom: 13,
              animate: false,
            }
          );

          const allowedBounds =
            jubanBounds.pad(0.75);

          map.setMaxBounds(
            allowedBounds
          );

          map.options.maxBoundsViscosity =
            0.9;

          const jubanFitZoom =
            map.getBoundsZoom(
              jubanBounds.pad(0.28),
              false,
              [22, 22]
            );

          if (
            Number.isFinite(
              jubanFitZoom
            )
          ) {
            map.setMinZoom(
              Math.max(
                jubanFitZoom - 1,
                9
              )
            );
          }
        }

        setMapError("");

        window.setTimeout(() => {
          if (
            !cancelled &&
            mapRef.current
          ) {
            mapRef.current.invalidateSize();
          }
        }, 0);
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setMapError(
            "Unable to load the Juban map."
          );
        }
      }
    }

    initializeMap();

    return () => {
      cancelled = true;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      boundaryLayerRef.current = null;
      jubanBoundsRef.current = null;
      panControlRef.current = null;
      siteLayersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    siteLayersRef.current.forEach(
      (layer) => {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      }
    );

    siteLayersRef.current = [];

    sites.forEach((site) => {
      const polygonPath =
        Array.isArray(site?.polygon)
          ? site.polygon
              .filter(
                (point) =>
                  Number.isFinite(
                    Number(point?.lat)
                  ) &&
                  Number.isFinite(
                    Number(point?.lng)
                  )
              )
              .map((point) => [
                Number(point.lat),
                Number(point.lng),
              ])
          : [];

      const capacity =
        getSiteCapacity(site);

      const planted =
        getSitePlanted(site, reports);

      const utilization =
        capacity > 0
          ? Math.min(
              100,
              Math.round(
                (planted / capacity) *
                  100
              )
            )
          : 0;

      const utilizationColors =
        getUtilizationColor(
          utilization
        );

      if (polygonPath.length >= 3) {
        const polygon = L.polygon(
          polygonPath,
          {
            color:
              utilizationColors.stroke,
            opacity: 0.95,
            weight: 1.5,
            fillColor:
              utilizationColors.fill,
            fillOpacity:
              planted > 0
                ? 0.24
                : 0.1,
          }
        ).addTo(map);

        polygon.bindTooltip(
          site?.siteName ||
            site?.id ||
            "Planting Site",
          {
            direction: "top",
          }
        );

        siteLayersRef.current.push(
          polygon
        );
      }

      const latitude = Number(
        site?.latitude
      );

      const longitude = Number(
        site?.longitude
      );

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        return;
      }

      const condition =
        getSiteCondition(
          site,
          monitoring
        );

      const marker =
        L.circleMarker(
          [latitude, longitude],
          {
            radius: 7,
            color: "#ffffff",
            weight: 2,
            fillColor:
              getConditionColor(
                condition
              ),
            fillOpacity: 1,
          }
        ).addTo(map);

      marker.bindTooltip(
        site?.siteName ||
          site?.id ||
          "Planting Site",
        {
          direction: "top",
          offset: [0, -6],
        }
      );

      siteLayersRef.current.push(
        marker
      );
    });

    window.setTimeout(() => {
      map.invalidateSize();
    }, 0);
  }, [monitoring, reports, sites]);

  return (
    <section className="dash-card map-card">
      <div className="dash-card-header">
        <h2>Planting Sites Map</h2>
      </div>

      <div className="dashboard-map-wrap">
        <div
          ref={mapContainerRef}
          className="dashboard-leaflet-map"
        />

        {mapError && (
          <div className="dashboard-map-error">
            <MapPin size={25} />
            <strong>Map unavailable</strong>
            <span>{mapError}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        className="dash-card-footer-link"
        onClick={onViewAll}
      >
        View all sites on map
        <span>›</span>
      </button>
    </section>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { currentUser, userRole } =
    useAuth();

  const isParticipant =
    userRole === "participant";

  const isManagement =
    userRole === "admin" ||
    userRole === "staff";

  const routeBase = isParticipant
    ? "/participant"
    : `/${userRole || "staff"}`;

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState("");
  const [fatalLoadError, setFatalLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const [barangay, setBarangay] =
    useState("All Barangays");

  const [chartPeriod, setChartPeriod] =
    useState("Monthly");

  const [users, setUsers] =
    useState([]);

  const [inventory, setInventory] =
    useState([]);

  const [requests, setRequests] =
    useState([]);

  const [sites, setSites] =
    useState([]);

  const [
    distributions,
    setDistributions,
  ] = useState([]);

  const [reports, setReports] =
    useState([]);

  const [events, setEvents] =
    useState([]);

  const [monitoring, setMonitoring] =
    useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setFatalLoadError("");
      try {
        const token =
          await getFreshToken();

        const endpointCalls = [
          apiGet(
            "/seedling-requests",
            token
          ),
          apiGet("/sites", token),
          apiGet(
            "/planting-reports",
            token
          ),
          apiGet("/events", token),
          apiGet(
            isParticipant
              ? "/monitoring/my-records"
              : "/monitoring",
            token
          ),
        ];

        if (isManagement) {
          endpointCalls.push(
            apiGet("/users", token),
            apiGet(
              "/inventory",
              token
            ),
            apiGet(
              "/distributions",
              token
            )
          );
        }

        const results =
          await Promise.allSettled(
            endpointCalls
          );

        if (cancelled) return;

        const pick = (index) => {
          const result =
            results[index];

          if (
            result?.status ===
              "fulfilled" &&
            Array.isArray(
              result.value
            )
          ) {
            return result.value;
          }

          return [];
        };

        setRequests(pick(0));

        // Registered planting sites now come only from the backend.
        setSites(
          pick(1)
        );

        setReports(pick(2));

        // Event Calendar and Dashboard now share the same backend source.
        setEvents(
          pick(3).filter((event) =>
            ["Tree Planting", "Other MENRO Activity"].includes(event?.type)
          )
        );

        if (isManagement) {
          setUsers(
            pick(5)
          );

          setInventory(pick(6));

          setDistributions(pick(7));
        } else {
          // Preserve participant restrictions.
          setUsers([]);
          setInventory([]);
          setDistributions([]);
        }

        setMonitoring(
          pick(4)
        );

        const failedCount = results.filter(
          (result) => result.status === "rejected"
        ).length;
        setLoadError(
          failedCount > 0
            ? `${failedCount} dashboard data source${failedCount === 1 ? "" : "s"} could not be loaded.`
            : ""
        );
      } catch (error) {
        console.error(error);

        if (cancelled) return;

        setRequests([]);

        setSites([]);

        setReports([]);

        setInventory([]);

        setDistributions([]);

        setUsers([]);

        setEvents([]);

        setMonitoring([]);

        setLoadError(
          "Unable to load dashboard records. Please try again."
        );
        setFatalLoadError("Unable to load dashboard records. Please try again.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [isManagement, isParticipant, retryKey]);

  const participantIdentity =
    useMemo(
      () =>
        getParticipantIdentity(
          currentUser
        ),
      [currentUser]
    );

  const participantName = String(
    currentUser?.fullName || currentUser?.displayName || currentUser?.name || ""
  ).trim();

  const visibleRequests =
    useMemo(() => {
      if (!isParticipant) {
        return requests;
      }

      return requests.filter(
        (record) =>
          belongsToParticipant(
            record,
            participantIdentity
          )
      );
    }, [
      isParticipant,
      participantIdentity,
      requests,
    ]);

  const visibleReports =
    useMemo(() => {
      if (!isParticipant) {
        return reports;
      }

      return reports.filter(
        (record) =>
          belongsToParticipant(
            record,
            participantIdentity
          )
      );
    }, [
      isParticipant,
      participantIdentity,
      reports,
    ]);

  const visibleMonitoring =
    useMemo(() => {
      if (!isParticipant) {
        return monitoring;
      }

      return monitoring.filter(
        (record) =>
          belongsToParticipant(
            record,
            participantIdentity
          )
      );
    }, [
      isParticipant,
      monitoring,
      participantIdentity,
    ]);

  const upcomingEvents =
    useMemo(() => {
      const today = new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      return events
        .map((event) => ({
          ...event,
          parsedDate:
            getEventDate(event),
        }))
        .filter(
          (event) =>
            event.parsedDate &&
            event.parsedDate.getTime() >=
              today.getTime()
        )
        .sort(
          (a, b) =>
            a.parsedDate -
            b.parsedDate
        )
        .slice(0, 4);
    }, [events]);

  const filteredSites =
    useMemo(() => {
      if (
        barangay ===
        "All Barangays"
      ) {
        return sites;
      }

      return sites.filter(
        (site) =>
          site?.barangay ===
          barangay
      );
    }, [barangay, sites]);

  const managementSummary =
    useMemo(() => {
      const totalStock =
        inventory.reduce(
          (total, item) =>
            total +
            getStockQuantity(item),
          0
        );

      const totalDistributed =
        distributions.reduce(
          (total, item) =>
            total +
            getDistributedQuantity(
              item
            ),
          0
        );

      const totalPlanted =
        reports.reduce(
          (total, item) =>
            total +
            getPlantedQuantity(
              item
            ),
          0
        );

      const rates =
        monitoring
          .map(
            getSurvivalRate
          )
          .filter(
            (value) =>
              value !== null
          );

      const survivalRate =
        rates.length > 0
          ? Math.round(
              rates.reduce(
                (sum, value) =>
                  sum + value,
                0
              ) / rates.length
            )
          : null;

      const participantCount =
        users.filter(
          (user) =>
            normalizeStatus(
              user?.role
            ) ===
            "participant"
        ).length;

      return {
        totalStock,
        totalDistributed,
        totalPlanted,
        survivalRate,
        totalUsers: users.length,
        participants:
          participantCount,
        activeEvents:
          upcomingEvents.length,
        totalSites: sites.length,
        totalRequests:
          requests.length,
        totalReports:
          reports.length,
        verifiedReports:
          reports.filter(
            (record) =>
              [
                "verified",
                "approved",
              ].includes(
                getReportStatus(
                  record
                )
              )
          ).length,
      };
    }, [
      distributions,
      inventory,
      monitoring,
      reports,
      requests,
      sites,
      upcomingEvents,
      users,
    ]);

  const participantSummary =
    useMemo(() => {
      const approvedRequests =
        visibleRequests.filter(
          (record) =>
            [
              "approved",
              "released",
              "completed",
            ].includes(
              getRequestStatus(
                record
              )
            )
        ).length;

      const pendingRequests =
        visibleRequests.filter(
          (record) =>
            [
              "pending",
              "pending review",
              "under review",
              "reviewed",
            ].includes(
              getRequestStatus(
                record
              )
            )
        ).length;

      const totalPlanted =
        visibleReports.reduce(
          (total, item) =>
            total +
            getPlantedQuantity(
              item
            ),
          0
        );

      const verifiedReports =
        visibleReports.filter(
          (record) =>
            [
              "verified",
              "approved",
            ].includes(
              getReportStatus(
                record
              )
            )
        ).length;

      return {
        totalRequests:
          visibleRequests.length,
        approvedRequests,
        pendingRequests,
        totalReports:
          visibleReports.length,
        verifiedReports,
        totalPlanted,
        monitoringUpdates:
          visibleMonitoring.length,
      };
    }, [
      visibleMonitoring,
      visibleReports,
      visibleRequests,
    ]);

  const monthlyActivity =
    useMemo(
      () =>
        buildMonthlyActivity(
          isParticipant
            ? []
            : distributions,
          isParticipant
            ? visibleReports
            : reports,
          isParticipant
            ? visibleMonitoring
            : monitoring
        ),
      [
        distributions,
        isParticipant,
        monitoring,
        reports,
        visibleMonitoring,
        visibleReports,
      ]
    );

  const survivalBarangays =
    useMemo(
      () =>
        buildSurvivalByBarangay(
          isParticipant
            ? visibleMonitoring
            : monitoring
        ),
      [
        isParticipant,
        monitoring,
        visibleMonitoring,
      ]
    );

  const recentActivities =
    useMemo(
      () =>
        createRecentActivities({
          requests:
            visibleRequests,
          reports:
            visibleReports,
          monitoring:
            visibleMonitoring,
          events:
            isParticipant
              ? []
              : events,
        }),
      [
        events,
        isParticipant,
        visibleMonitoring,
        visibleReports,
        visibleRequests,
      ]
    );

  const topSites = useMemo(
    () =>
      filteredSites
        .map((site) => {
          const capacity =
            getSiteCapacity(site);

          const treesPlanted =
            getSitePlanted(
              site,
              reports
            );

          const utilization =
            capacity > 0
              ? Math.min(
                  100,
                  Math.round(
                    (treesPlanted /
                      capacity) *
                      100
                  )
                )
              : 0;

          return {
            id:
              site?.id ||
              site?.siteId ||
              "—",
            barangay:
              site?.barangay ||
              "—",
            treesPlanted,
            capacity,
            utilization,
            condition:
              getSiteCondition(
                site,
                monitoring
              ),
          };
        })
        .sort(
          (a, b) =>
            b.treesPlanted -
            a.treesPlanted
        )
        .slice(0, 6),
    [
      filteredSites,
      monitoring,
      reports,
    ]
  );

  const hasActivityData =
    monthlyActivity.some(
      (item) =>
        item.allocated > 0 ||
        item.planted > 0 ||
        item.survivalRate !==
          null
    );

  const overallSurvival =
    survivalBarangays.length > 0
      ? Math.round(
          survivalBarangays.reduce(
            (sum, item) =>
              sum + item.rate,
            0
          ) /
            survivalBarangays.length
        )
      : null;

  const managementKpis = [
    {
      id: "allocated",
      label:
        "Seedlings Distributed",
      value:
        managementSummary.totalDistributed >
        0
          ? managementSummary.totalDistributed.toLocaleString()
          : "—",
      icon: Sprout,
      className:
        "kpi-green",
      note:
        managementSummary.totalDistributed >
        0
          ? "Recorded distribution total"
          : "No data available",
      route: `${routeBase}/seedlings`,
    },
    {
      id: "participants",
      label:
        "Total Participants",
      value:
        managementSummary.participants >
        0
          ? managementSummary.participants
          : "—",
      icon: Users,
      className:
        "kpi-blue",
      note:
        managementSummary.participants >
        0
          ? `${managementSummary.totalUsers} registered users`
          : "No participant records yet",
      route: `${routeBase}/registered-users`,
    },
    {
      id: "planted",
      label:
        "Trees Planted",
      value:
        managementSummary.totalPlanted >
        0
          ? managementSummary.totalPlanted.toLocaleString()
          : "—",
      icon: Trees,
      className:
        "kpi-orange",
      note:
        managementSummary.totalPlanted >
        0
          ? "From planting reports"
          : "No planting data yet",
      route: `${routeBase}/planting-reports`,
    },
    {
      id: "survival",
      label:
        "Survival Rate (All Sites)",
      value:
        managementSummary.survivalRate !==
        null
          ? `${managementSummary.survivalRate}%`
          : "—",
      icon:
        CircleCheckBig,
      className:
        "kpi-green",
      note:
        managementSummary.survivalRate !==
        null
          ? "Based on monitoring records"
          : "No monitoring data yet",
      route: `${routeBase}/survival-monitoring`,
    },
    {
      id: "events",
      label:
        "Upcoming Events",
      value:
        managementSummary.activeEvents >
        0
          ? managementSummary.activeEvents
          : "—",
      icon:
        CalendarDays,
      className:
        "kpi-purple",
      note:
        managementSummary.activeEvents >
        0
          ? "Scheduled upcoming events"
          : "No upcoming events",
      route: `${routeBase}/event-calendar`,
    },
  ];

  const participantKpis = [
    {
      id: "my-requests",
      label:
        "My Requests",
      value:
        participantSummary.totalRequests >
        0
          ? participantSummary.totalRequests
          : "—",
      icon:
        ClipboardCheck,
      className:
        "kpi-green",
      note:
        participantSummary.totalRequests >
        0
          ? `${participantSummary.pendingRequests} in progress`
          : "No requests yet",
      route:
        "/participant/my-requests",
    },
    {
      id: "approved",
      label:
        "Approved Requests",
      value:
        participantSummary.approvedRequests >
        0
          ? participantSummary.approvedRequests
          : "—",
      icon:
        CheckCircle2,
      className:
        "kpi-blue",
      note:
        participantSummary.approvedRequests >
        0
          ? "Approved seedling requests"
          : "No approved requests yet",
      route:
        "/participant/my-requests",
    },
    {
      id: "my-reports",
      label:
        "My Planting Reports",
      value:
        participantSummary.totalReports >
        0
          ? participantSummary.totalReports
          : "—",
      icon:
        FileCheck2,
      className:
        "kpi-orange",
      note:
        participantSummary.totalReports >
        0
          ? `${participantSummary.verifiedReports} verified`
          : "No reports submitted yet",
      route:
        "/participant/my-planting-reports",
    },
    {
      id: "my-trees",
      label:
        "Trees Reported Planted",
      value:
        participantSummary.totalPlanted >
        0
          ? participantSummary.totalPlanted.toLocaleString()
          : "—",
      icon: Trees,
      className:
        "kpi-green",
      note:
        participantSummary.totalPlanted >
        0
          ? "From your planting reports"
          : "No planting data yet",
      route:
        "/participant/my-planting-reports",
    },
    {
      id: "monitoring",
      label:
        "Monitoring Updates",
      value:
        participantSummary.monitoringUpdates >
        0
          ? participantSummary.monitoringUpdates
          : "—",
      icon:
        CircleCheckBig,
      className:
        "kpi-purple",
      note:
        participantSummary.monitoringUpdates >
        0
          ? "Your monitoring records"
          : "No monitoring updates yet",
      route:
        "/participant/survival-monitoring",
    },
  ];

  const kpis =
    isParticipant
      ? participantKpis
      : managementKpis;

  const quickActions =
    isParticipant
      ? [
          {
            id: "request",
            label:
              "Request Seedlings",
            route:
              "/participant/request-seedlings",
            icon: Sprout,
          },
          {
            id:
              "my-requests",
            label:
              "View My Requests",
            route:
              "/participant/my-requests",
            icon:
              ClipboardCheck,
          },
          {
            id: "reports",
            label:
              "Submit Planting Report",
            route:
              "/participant/my-planting-reports",
            icon:
              FileCheck2,
          },
          {
            id:
              "monitoring",
            label:
              "Update Survival Monitoring",
            route:
              "/participant/survival-monitoring",
            icon: Trees,
          },
        ]
      : [
          {
            id: "requests",
            label:
              "Review Seedling Requests",
            route: `${routeBase}/requests`,
            icon:
              ClipboardCheck,
          },
          {
            id: "sites",
            label:
              "Manage Planting Sites",
            route: `${routeBase}/planting-sites`,
            icon: MapPin,
          },
          {
            id: "reports",
            label:
              "Review Planting Reports",
            route: `${routeBase}/planting-reports`,
            icon:
              FileCheck2,
          },
          {
            id:
              "analytics",
            label:
              "Reforestation Analytics",
            route: `${routeBase}/reforestation-analytics`,
            icon:
              BarChart3,
          },
          {
            id: "generate",
            label:
              "Generate Reports",
            route: `${routeBase}/reports`,
            icon:
              PackageCheck,
          },
        ];

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div style={{ minHeight: "420px", display: "grid", placeItems: "center", color: "#526159", fontSize: "13px", fontWeight: 600 }}>Loading dashboard...</div>
      </div>
    );
  }

  if (fatalLoadError) {
    return <div className="admin-dashboard"><div role="alert" style={{ minHeight: "420px", display: "grid", placeContent: "center", justifyItems: "center", gap: "14px", color: "#526159", fontSize: "13px", fontWeight: 600 }}><span>{fatalLoadError}</span><button type="button" className="dashboard-secondary-button" onClick={() => { setLoading(true); setRetryKey((key) => key + 1); }}>Retry</button></div></div>;
  }

  return (
    <div
      className={`admin-dashboard ${
        isParticipant
          ? "participant-dashboard"
          : ""
      }`}
    >
      {loadError && !isParticipant && (
        <div className="dashboard-warning">
          {loadError} Available API records are shown where possible.
        </div>
      )}

      {isParticipant && (
        <h1 className="participant-dashboard-welcome">
          {participantName ? `Welcome, ${participantName}!` : "Welcome!"}
        </h1>
      )}

      <div className="dashboard-filter-row">
        {!isParticipant && (
          <select
            value={barangay}
            onChange={(event) =>
              setBarangay(
                event.target.value
              )
            }
          >
            <option>
              All Barangays
            </option>

            {BARANGAYS.map(
              (name) => (
                <option key={name}>
                  {name}
                </option>
              )
            )}
          </select>
        )}
      </div>

      <section className="dashboard-kpi-grid">
        {kpis.map((item) => {
          const Icon =
            item.icon;

          return (
            <button
              type="button"
              className="dashboard-kpi-card"
              key={item.id}
              onClick={() =>
                navigate(item.route)
              }
            >
              <div
                className={`dashboard-kpi-icon ${item.className}`}
              >
                <Icon
                  size={27}
                  strokeWidth={1.8}
                />
              </div>

              <div className="dashboard-kpi-content">
                <div className="dashboard-kpi-label">
                  {item.label}
                </div>

                <div className="dashboard-kpi-value">
                  {item.value}
                </div>

                <div className="dashboard-kpi-note">
                  {item.note}
                </div>
              </div>
            </button>
          );
        })}
      </section>

      <section
        className={`dashboard-main-grid ${
          isParticipant
            ? "participant-dashboard-main-grid"
            : ""
        }`}
      >
        {!isParticipant && (
          <DashboardSitesMap
            sites={filteredSites}
            reports={reports}
            monitoring={monitoring}
            onViewAll={() =>
              navigate(
                `${routeBase}/map-visualization`
              )
            }
          />
        )}

        <section className="dash-card activity-card">
          <div className="dash-card-header">
            <h2>
              {isParticipant
                ? "My Planting Activities"
                : "Planting Activities Overview"}
            </h2>

            <select
              value={chartPeriod}
              onChange={(event) =>
                setChartPeriod(
                  event.target.value
                )
              }
            >
              <option>
                Monthly
              </option>
            </select>
          </div>

          {hasActivityData ? (
            <>
              <div className="activity-legend">
                {!isParticipant && (
                  <span>
                    <i className="allocated-dot" />
                    Seedlings
                    Distributed
                  </span>
                )}

                <span>
                  <i className="planted-dot" />
                  Trees Planted
                </span>

                <span>
                  <i className="survival-dot" />
                  Survival Rate (%)
                </span>
              </div>

              <div className="activity-chart">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={
                      monthlyActivity
                    }
                    margin={{
                      top: 10,
                      right: 10,
                      left: -12,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="#edf1ee"
                    />

                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={{
                        stroke:
                          "#dfe6e1",
                      }}
                      tick={{
                        fontSize: 10,
                        fill:
                          "#425047",
                      }}
                    />

                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{
                        fontSize: 9,
                        fill:
                          "#6b776f",
                      }}
                    />

                    <Tooltip />

                    {!isParticipant && (
                      <Bar
                        dataKey="allocated"
                        fill="#bde8c2"
                        radius={[
                          2,
                          2,
                          0,
                          0,
                        ]}
                      />
                    )}

                    <Bar
                      dataKey="planted"
                      fill="#096b34"
                      radius={[
                        2,
                        2,
                        0,
                        0,
                      ]}
                    />
                  </BarChart>
                </ResponsiveContainer>

                <div className="activity-line-overlay">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <LineChart
                      data={
                        monthlyActivity
                      }
                      margin={{
                        top: 10,
                        right: 12,
                        left: 0,
                        bottom: 0,
                      }}
                    >
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[
                          0,
                          100,
                        ]}
                        hide
                      />

                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="survivalRate"
                        connectNulls
                        stroke="#f1a600"
                        strokeWidth={2}
                        dot={{
                          r: 4,
                          fill:
                            "#f1a600",
                          stroke:
                            "#ffffff",
                          strokeWidth: 1,
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No activity data yet"
              text={
                isParticipant
                  ? "Your planting activity will appear here after you submit planting and monitoring records."
                  : "Planting activity trends will appear here once distribution, planting, and monitoring records are available."
              }
            />
          )}

          <div className="activity-summary">
            {isParticipant ? (
              <>
                <div>
                  <span>
                    Total Requests
                  </span>

                  <strong>
                    {participantSummary.totalRequests ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Trees Planted
                  </span>

                  <strong>
                    {participantSummary.totalPlanted ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Verified Reports
                  </span>

                  <strong className="green">
                    {participantSummary.verifiedReports ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Monitoring Updates
                  </span>

                  <strong>
                    {participantSummary.monitoringUpdates ||
                      "—"}
                  </strong>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span>
                    Total Distributed
                  </span>

                  <strong>
                    {managementSummary.totalDistributed >
                    0
                      ? managementSummary.totalDistributed.toLocaleString()
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Total Planted
                  </span>

                  <strong>
                    {managementSummary.totalPlanted >
                    0
                      ? managementSummary.totalPlanted.toLocaleString()
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Overall Survival
                    Rate
                  </span>

                  <strong className="green">
                    {managementSummary.survivalRate !==
                    null
                      ? `${managementSummary.survivalRate}%`
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Verified Reports
                  </span>

                  <strong>
                    {managementSummary.verifiedReports ||
                      "—"}
                  </strong>
                </div>
              </>
            )}
          </div>
        </section>

        <div className="dashboard-right-column">
          <section className="dash-card upcoming-card">
            <div className="dash-card-header">
              <h2>
                Upcoming Events
              </h2>

              <button
                type="button"
                className="text-link"
                onClick={() =>
                  navigate(
                    `${routeBase}/event-calendar`
                  )
                }
              >
                View Calendar
              </button>
            </div>

            {upcomingEvents.length >
            0 ? (
              <div className="upcoming-list">
                {upcomingEvents.map(
                  (event) => {
                    const date =
                      event.parsedDate;

                    return (
                      <button
                        key={
                          event?.id ||
                          event?.eventId ||
                          `${date?.toISOString()}-${
                            event?.name ||
                            event?.eventName ||
                            event?.title
                          }`
                        }
                        type="button"
                        className="upcoming-event"
                        onClick={() =>
                          navigate(
                            `${routeBase}/event-calendar`
                          )
                        }
                      >
                        <div className="event-date">
                          <span>
                            {date
                              .toLocaleDateString(
                                "en-PH",
                                {
                                  month:
                                    "short",
                                }
                              )
                              .toUpperCase()}
                          </span>

                          <strong>
                            {date.getDate()}
                          </strong>
                        </div>

                        <div className="event-info">
                          <strong>
                            {event?.eventName ||
                              event?.title ||
                              "Planting Event"}
                          </strong>

                          <span>
                            <MapPin
                              size={
                                12
                              }
                            />

                            {event?.location ||
                              event?.eventLocation ||
                              event?.plantingSiteLocation ||
                              event?.barangay ||
                              "Juban, Sorsogon"}
                          </span>

                          <span>
                            <Clock3
                              size={
                                12
                              }
                            />

                            {formatTimeRange(
                              event
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            ) : (
              <EmptyState
                icon={
                  CalendarDays
                }
                title="No upcoming events"
                text="Scheduled planting events will appear here once created."
              />
            )}
          </section>

          <section className="dash-card recent-card">
            <div className="dash-card-header">
              <h2>
                {isParticipant
                  ? "My Recent Activities"
                  : "Recent Activities"}
              </h2>
            </div>

            {recentActivities.length >
            0 ? (
              <div className="recent-list">
                {recentActivities.map(
                  (activity) => (
                    <div
                      className="recent-item"
                      key={
                        activity.id
                      }
                    >
                      <div
                        className={`recent-icon recent-${activity.type}`}
                      >
                        <ActivityIcon
                          type={
                            activity.type
                          }
                        />
                      </div>

                      <div className="recent-copy">
                        <strong>
                          {
                            activity.title
                          }
                        </strong>

                        <span>
                          {
                            activity.detail
                          }
                        </span>
                      </div>

                      <time>
                        {formatDate(
                          activity.date
                        )}
                      </time>
                    </div>
                  )
                )}
              </div>
            ) : (
              <EmptyState
                icon={
                  ClipboardCheck
                }
                title="No recent activities"
                text={
                  isParticipant
                    ? "Your requests, planting reports, and monitoring updates will appear here."
                    : "Latest system actions and record updates will appear here."
                }
              />
            )}
          </section>

          <section className="dash-card quick-card">
            <div className="dash-card-header">
              <h2>
                Quick Actions
              </h2>
            </div>

            <div className="quick-list">
              {quickActions.map(
                (action) => {
                  const Icon =
                    action.icon;

                  return (
                    <button
                      type="button"
                      key={
                        action.id
                      }
                      onClick={() =>
                        navigate(
                          action.route
                        )
                      }
                    >
                      <span className="quick-icon">
                        <Icon
                          size={
                            15
                          }
                        />
                      </span>

                      <span>
                        {
                          action.label
                        }
                      </span>

                      <span className="quick-arrow">
                        ›
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </section>
        </div>
      </section>

      {!isParticipant && (
        <section className="dashboard-bottom-grid">
          <section className="dash-card survival-card">
            <div className="dash-card-header">
              <h2>
                Survival Rate by
                Barangay
              </h2>
            </div>

            {survivalBarangays.length >
            0 ? (
              <div className="survival-content">
                <div className="survival-chart-wrap">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <PieChart>
                      <Pie
                        data={
                          survivalBarangays
                        }
                        dataKey="rate"
                        nameKey="barangay"
                        innerRadius={
                          52
                        }
                        outerRadius={
                          74
                        }
                        stroke="none"
                      >
                        {survivalBarangays.map(
                          (
                            _,
                            index
                          ) => (
                            <Cell
                              key={
                                index
                              }
                              fill={
                                SURVIVAL_COLORS[
                                  index %
                                    SURVIVAL_COLORS.length
                                ]
                              }
                            />
                          )
                        )}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="survival-center">
                    <strong>
                      {overallSurvival !==
                      null
                        ? `${overallSurvival}%`
                        : "—"}
                    </strong>

                    <span>
                      Overall
                    </span>
                  </div>
                </div>

                <div className="survival-list">
                  {survivalBarangays.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={
                          item.barangay
                        }
                      >
                        <span
                          className="survival-color"
                          style={{
                            backgroundColor:
                              SURVIVAL_COLORS[
                                index %
                                  SURVIVAL_COLORS.length
                              ],
                          }}
                        />

                        <span>
                          {
                            item.barangay
                          }
                        </span>

                        <strong>
                          {
                            item.rate
                          }
                          %
                        </strong>
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={
                  CircleCheckBig
                }
                title="No data available"
                text="Survival rate per barangay will be shown here once monitoring records are added."
              />
            )}

            <button
              type="button"
              className="dash-card-footer-link"
              onClick={() =>
                navigate(
                  `${routeBase}/reforestation-analytics`
                )
              }
            >
              View full report
              <span>›</span>
            </button>
          </section>

          <section className="dash-card sites-table-card">
            <div className="dash-card-header">
              <h2>
                Top Planting Sites
              </h2>
            </div>

            {topSites.length > 0 ? (
              <div className="table-scroll">
                <table className="sites-table">
                  <thead>
                    <tr>
                      <th>
                        SITE ID
                      </th>
                      <th>
                        BARANGAY
                      </th>
                      <th>
                        TREES PLANTED
                      </th>
                      <th>
                        CAPACITY
                      </th>
                      <th>
                        UTILIZATION
                      </th>
                      <th>
                        CONDITION
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {topSites.map(
                      (site) => (
                        <tr
                          key={
                            site.id
                          }
                        >
                          <td>
                            <strong>
                              {
                                site.id
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              site.barangay
                            }
                          </td>

                          <td>
                            {site.treesPlanted.toLocaleString()}
                          </td>

                          <td>
                            {site.capacity >
                            0
                              ? site.capacity.toLocaleString()
                              : "—"}
                          </td>

                          <td>
                            <div className="utilization-cell">
                              <span>
                                {
                                  site.utilization
                                }
                                %
                              </span>

                              <div className="utilization-track">
                                <div
                                  className={`utilization-fill ${
                                    site.utilization >=
                                    90
                                      ? "full"
                                      : site.utilization >=
                                        50
                                      ? "partial"
                                      : "available"
                                  }`}
                                  style={{
                                    width: `${site.utilization}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          <td>
                            <span
                              className={`dashboard-condition ${normalizeStatus(
                                site.condition
                              )
                                .replace(
                                  /\s+/g,
                                  "-"
                                )
                                .replace(
                                  /[^a-z-]/g,
                                  ""
                                )}`}
                            >
                              {
                                site.condition
                              }
                            </span>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={MapPin}
                title="No planting site records"
                text="Planting site data will appear here once records are added."
              />
            )}

            <button
              type="button"
              className="dash-card-footer-link"
              onClick={() =>
                navigate(
                  `${routeBase}/planting-sites`
                )
              }
            >
              View all sites
              <span>›</span>
            </button>
          </section>
        </section>
      )}
    </div>
  );
}
