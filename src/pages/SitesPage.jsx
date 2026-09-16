import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Archive,
  Camera,
  ChevronDown,
  Circle,
  Edit3,
  Eye,
  FileImage,
  Layers3,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sprout,
  Trees,
  UserRound,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase/config";
import "../styles/planting-sites.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const BARANGAY_GEOJSON_URL = "/data/juban-barangays.geojson";

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

const SITE_TYPES = [
  "Reforestation Site",
  "Mangrove Rehabilitation Site",
  "Community Planting Site",
  "Institutional Planting Site",
  "Watershed Rehabilitation Site",
  "Other",
];

const OWNERSHIP_TYPES = [
  "Municipal Government",
  "Barangay / Community",
  "Private Land",
  "School / Institution",
  "National Government",
  "Other",
];

const SITE_STATUS_OPTIONS = [
  "Available",
  "Partially Occupied",
  "Full",
];

const TREE_CONDITION_OPTIONS = [
  "Healthy",
  "Needs Attention",
  "Critical",
  "Not Yet Monitored",
];

const JUBAN_FALLBACK_CENTER = {
  lat: 12.82,
  lng: 124.0,
};

function getInitialSiteForm() {
  return {
    siteName: "",
    barangay: "",
    siteType: "",
    areaHectares: "",
    maximumCapacity: "",

    latitude: "",
    longitude: "",
    locationDescription: "",

    ownershipType: "",
    coordinator: "",
    coordinatorContact: "",
    notes: "",

    polygon: [],
  };
}

function getUtilization(site) {
  const capacity = Number(site.maximumCapacity || 0);
  const planted = Number(site.planted || 0);

  if (capacity <= 0) return 0;

  return Math.min(
    100,
    Math.round((planted / capacity) * 100)
  );
}

function getSiteStatus(site) {
  const utilization = getUtilization(site);

  if (utilization >= 90) {
    return "Full";
  }

  if (utilization >= 50) {
    return "Partially Occupied";
  }

  return "Available";
}

function getUtilizationColor(status) {
  switch (status) {
    case "Partially Occupied":
      return {
        fill: "#facc15",
        stroke: "#d6a900",
      };

    case "Full":
      return {
        fill: "#ef4444",
        stroke: "#d72f2f",
      };

    default:
      return {
        fill: "#4caf63",
        stroke: "#2f9847",
      };
  }
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

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SitesPage() {
  const { userRole } = useAuth();

  const canManage =
    userRole === "admin" || userRole === "staff";

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const jubanBoundsRef = useRef(null);

  const sitePolygonsRef = useRef([]);
  const siteMarkersRef = useRef([]);
  const barangayLabelsRef = useRef([]);
  const panControlRef = useRef(null);

  const activeDrawingRef = useRef(null);


  const [sites, setSites] = useState([]);
  const [archivedSites, setArchivedSites] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  const [selectedSite, setSelectedSite] = useState(null);

  const [activeDetailTab, setActiveDetailTab] =
    useState("information");

  const [showAddModal, setShowAddModal] =
    useState(false);

  const [showArchiveModal, setShowArchiveModal] =
    useState(false);

  const [form, setForm] =
    useState(getInitialSiteForm);

  const [formErrors, setFormErrors] =
    useState({});

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [conditionFilter, setConditionFilter] =
    useState("all");

  const [successMessage, setSuccessMessage] =
    useState("");

  const filteredSites = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sites.filter((site) => {
      const matchesSearch =
        !query ||
        String(site.id || site.siteId || "")
          .toLowerCase()
          .includes(query) ||
        String(site.siteName || "")
          .toLowerCase()
          .includes(query) ||
        String(site.barangay || "")
          .toLowerCase()
          .includes(query);

      const status = getSiteStatus(site);

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      const condition =
        site.treeCondition ||
        "Not Yet Monitored";

      const matchesCondition =
        conditionFilter === "all" ||
        condition === conditionFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCondition
      );
    });
  }, [
    sites,
    search,
    statusFilter,
    conditionFilter,
  ]);


  async function getAuthToken(forceRefresh = false) {
    if (typeof auth.authStateReady === "function") {
      await auth.authStateReady();
    }

    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      return "";
    }

    const token = await firebaseUser.getIdToken(forceRefresh);

    // Temporary compatibility with older frontend modules.
    window.localStorage.setItem("token", token);

    return token;
  }

  async function apiRequest(path, options = {}, allowRetry = true) {
    const token = await getAuthToken(false);

    if (!token) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    const buildHeaders = (authToken) => ({
      Authorization: `Bearer ${authToken}`,
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    });

    let response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: buildHeaders(token),
    });

    if (response.status === 401 && allowRetry) {
      const refreshedToken = await getAuthToken(true);

      if (!refreshedToken) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: buildHeaders(refreshedToken),
      });
    }

    let payload;

    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(
        payload.message || "The request could not be completed."
      );
    }

    return payload;
  }

  async function loadSites() {
    const response = await apiRequest("/sites");

    const records = Array.isArray(response.data)
      ? response.data
      : [];

    setSites(records);
  }

  async function loadArchivedSites() {
    if (!canManage) {
      setArchivedSites([]);
      return;
    }

    const response = await apiRequest("/sites/archived");

    setArchivedSites(
      Array.isArray(response.data)
        ? response.data
        : []
    );
  }

  async function loadSiteData() {
    setLoading(true);
    setPageError("");

    try {
      await Promise.all([
        loadSites(),
        canManage
          ? loadArchivedSites()
          : Promise.resolve(),
      ]);
    } catch (error) {
      console.error(
        "Failed to load planting sites:",
        error
      );

      setPageError(
        error.message ||
          "Unable to load planting sites."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadSiteData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [userRole]); // eslint-disable-line react-hooks/exhaustive-deps

  function removeActiveDrawingControl() {
    const active = activeDrawingRef.current;

    if (!active) return;

    if (active.clickHandler && mapRef.current) {
      mapRef.current.off("click", active.clickHandler);
    }

    if (active.previewPolygon && mapRef.current) {
      mapRef.current.removeLayer(active.previewPolygon);
    }

    if (active.control && mapRef.current) {
      mapRef.current.removeControl(active.control);
    }

    activeDrawingRef.current = null;
  }

  async function loadBarangayBoundaries(map, isCancelled) {
    try {
      const response = await fetch(BARANGAY_GEOJSON_URL);

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
        throw new Error("Invalid Juban barangay GeoJSON.");
      }

      if (isCancelled?.() || mapRef.current !== map) {
        return null;
      }

      barangayLabelsRef.current.forEach((label) => {
        if (map.hasLayer(label)) {
          map.removeLayer(label);
        }
      });
      barangayLabelsRef.current = [];

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

          if (!barangayName || !layer.getBounds) return;

          const bounds = layer.getBounds();
          if (!bounds.isValid()) return;

          layer.bindTooltip(String(barangayName), {
            permanent: true,
            direction: "center",
            className: "ps-barangay-label",
            interactive: false,
            opacity: 1,
          });
        },
      }).addTo(map);

      const jubanBounds = boundaryLayer.getBounds();

      if (jubanBounds.isValid()) {
        jubanBoundsRef.current = jubanBounds;

        /*
          Keep nearby map context visible, but keep Juban as the visual focus.
          The basemap itself has no place-name labels; only Juban barangay names
          are added by our GeoJSON tooltips above.
        */
        map.fitBounds(jubanBounds.pad(0.28), {
          padding: [22, 22],
          maxZoom: 13,
          animate: false,
        });

        const allowedBounds = jubanBounds.pad(0.75);
        map.setMaxBounds(allowedBounds);
        map.options.maxBoundsViscosity = 0.9;

        const jubanFitZoom = map.getBoundsZoom(
          jubanBounds.pad(0.28),
          false,
          [22, 22]
        );

        if (Number.isFinite(jubanFitZoom)) {
          map.setMinZoom(Math.max(jubanFitZoom - 1, 9));
        }
      }

      return boundaryLayer;
    } catch (error) {
      console.error(
        "Failed to load Juban barangay boundaries:",
        error
      );

      setMapError(
        "Unable to load the Juban barangay boundary data."
      );

      return null;
    }
  }
  



  useEffect(() => {
    let cancelled = false;
    let boundaryLayer = null;

    

    async function initializeMap() {
      try {
        if (cancelled || !mapContainerRef.current) return;

        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        const map = L.map(mapContainerRef.current, {
          center: [JUBAN_FALLBACK_CENTER.lat, JUBAN_FALLBACK_CENTER.lng],
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
              "leaflet-bar ps-pan-control"
            );

            const upButton = L.DomUtil.create(
              "button",
              "ps-pan-control-btn",
              container
            );

            upButton.type = "button";
            upButton.title = "Pan up";
            upButton.setAttribute(
              "aria-label",
              "Pan map up"
            );
            upButton.innerHTML = "&#8593;";

            const leftButton = L.DomUtil.create(
              "button",
              "ps-pan-control-btn",
              container
            );

            leftButton.type = "button";
            leftButton.title = "Pan left";
            leftButton.setAttribute(
              "aria-label",
              "Pan map left"
            );
            leftButton.innerHTML = "&#8592;";

            const rightButton = L.DomUtil.create(
              "button",
              "ps-pan-control-btn",
              container
            );

            rightButton.type = "button";
            rightButton.title = "Pan right";
            rightButton.setAttribute(
              "aria-label",
              "Pan map right"
            );
            rightButton.innerHTML = "&#8594;";

            const downButton = L.DomUtil.create(
              "button",
              "ps-pan-control-btn",
              container
            );

            downButton.type = "button";
            downButton.title = "Pan down";
            downButton.setAttribute(
              "aria-label",
              "Pan map down"
            );
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

        setMapError("");
        setMapReady(true);

        boundaryLayer = await loadBarangayBoundaries(
          map,
          () => cancelled || mapRef.current !== map
        );

        if (cancelled || mapRef.current !== map) {
          return;
        }

        window.setTimeout(() => {
          if (!cancelled && mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 0);
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setMapError(
            "Unable to load the map. Check the Leaflet map configuration."
          );
        }
      }
    }

    initializeMap();

    return () => {
      cancelled = true;
      removeActiveDrawingControl();

      if (mapRef.current) {
        if (boundaryLayer) {
          mapRef.current.removeLayer(boundaryLayer);
        }

        mapRef.current.remove();
        mapRef.current = null;
      }

      jubanBoundsRef.current = null;
      barangayLabelsRef.current = [];
      panControlRef.current = null;
      sitePolygonsRef.current = [];
      siteMarkersRef.current = [];
    };
  }, []);

  useEffect(() => {
  if (!mapReady || !mapRef.current) {
    return;
  }

  const map = mapRef.current;

  sitePolygonsRef.current.forEach((polygon) => {
    if (map.hasLayer(polygon)) {
      map.removeLayer(polygon);
    }
  });

  siteMarkersRef.current.forEach((marker) => {
    if (map.hasLayer(marker)) {
      map.removeLayer(marker);
    }
  });

  sitePolygonsRef.current = [];
  siteMarkersRef.current = [];

  const handleSiteClick = (site) => {
    setSelectedSite(site);
    setActiveDetailTab("information");
  };

  filteredSites.forEach((site) => {
    const status = getSiteStatus(site);
    const utilizationColors =
      getUtilizationColor(status);

    const polygonPath = Array.isArray(site.polygon)
      ? site.polygon
          .filter(
            (point) =>
              Number.isFinite(Number(point.lat)) &&
              Number.isFinite(Number(point.lng))
          )
          .map((point) => [
            Number(point.lat),
            Number(point.lng),
          ])
      : [];

    if (polygonPath.length >= 3) {
      const polygon = L.polygon(polygonPath, {
        color: utilizationColors.stroke,
        opacity: 0.95,
        weight: 1.5,
        fillColor: utilizationColors.fill,
        fillOpacity: 0.24,
      }).addTo(map);

      polygon.on("click", () => {
        handleSiteClick(site);
      });

      sitePolygonsRef.current.push(polygon);
    }

    const latitude = Number(site.latitude);
    const longitude = Number(site.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return;
    }

    const conditionColor = getConditionColor(
      site.treeCondition || "Not Yet Monitored"
    );

    const marker = L.circleMarker(
      [latitude, longitude],
      {
        radius: 7,
        color: "#ffffff",
        weight: 2,
        fillColor: conditionColor,
        fillOpacity: 1,
      }
    ).addTo(map);

    marker.bindTooltip(
      site.siteName ||
        site.id ||
        site.siteId ||
        "Planting Site",
      {
        direction: "top",
        offset: [0, -6],
      }
    );

    marker.on("click", () => {
      handleSiteClick(site);
    });

    siteMarkersRef.current.push(marker);
  });

  return () => {
    sitePolygonsRef.current.forEach((polygon) => {
      if (map.hasLayer(polygon)) {
        map.removeLayer(polygon);
      }
    });

    siteMarkersRef.current.forEach((marker) => {
      if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    });

    sitePolygonsRef.current = [];
    siteMarkersRef.current = [];
  };
}, [mapReady, filteredSites]);

  function showSuccess(message) {
    setSuccessMessage(message);

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);
  }

  function updateForm(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setFormErrors((previous) => ({
      ...previous,
      [field]: "",
    }));
  }

  function validateForm() {
    const errors = {};

    if (!form.siteName.trim()) {
      errors.siteName =
        "Site name is required.";
    }

    if (!form.barangay) {
      errors.barangay =
        "Barangay is required.";
    }

    if (!form.siteType) {
      errors.siteType =
        "Site type is required.";
    }

    if (
      !form.areaHectares ||
      Number(form.areaHectares) <= 0
    ) {
      errors.areaHectares =
        "Enter a valid site area.";
    }

    if (
      !form.maximumCapacity ||
      Number(form.maximumCapacity) <= 0
    ) {
      errors.maximumCapacity =
        "Enter the maximum seedling capacity.";
    }

    const latitude =
      Number(form.latitude);

    const longitude =
      Number(form.longitude);

    if (
      form.latitude === "" ||
      !Number.isFinite(latitude)
    ) {
      errors.latitude =
        "Enter a valid latitude.";
    }

    if (
      form.longitude === "" ||
      !Number.isFinite(longitude)
    ) {
      errors.longitude =
        "Enter a valid longitude.";
    }

    if (
      latitude < -90 ||
      latitude > 90
    ) {
      errors.latitude =
        "Latitude must be between -90 and 90.";
    }

    if (
      longitude < -180 ||
      longitude > 180
    ) {
      errors.longitude =
        "Longitude must be between -180 and 180.";
    }

    if (
      !Array.isArray(form.polygon) ||
      form.polygon.length < 3
    ) {
      errors.polygon =
        "Draw the planting-site boundary on the map.";
    }

    return errors;
  }

  async function handleAddSite(event) {
    event.preventDefault();

    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setActionLoading(true);
    setPageError("");

    try {
      const response = await apiRequest("/sites", {
        method: "POST",
        body: JSON.stringify({
          siteName: form.siteName.trim(),
          barangay: form.barangay,
          siteType: form.siteType,
          areaHectares: Number(form.areaHectares),
          maximumCapacity: Number(form.maximumCapacity),

          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          locationDescription:
            form.locationDescription.trim(),

          ownershipType: form.ownershipType,
          coordinator: form.coordinator.trim(),
          coordinatorContact:
            form.coordinatorContact.trim(),
          notes: form.notes.trim(),

          polygon: form.polygon,
        }),
      });

      const site = response.data;

      if (!site) {
        throw new Error(
          "Site was created but no site data was returned."
        );
      }

      const createdSiteId =
        site.id || site.siteId;

      setSites((previous) => [
        site,
        ...previous.filter(
          (item) =>
            String(item.id || item.siteId) !==
            String(createdSiteId)
        ),
      ]);

      setSelectedSite(site);
      setActiveDetailTab("information");

      setShowAddModal(false);

      setForm(getInitialSiteForm());
      setFormErrors({});

      showSuccess(
        `${createdSiteId} was added successfully.`
      );
    } catch (error) {
      console.error(
        "Failed to create planting site:",
        error
      );

      setPageError(
        error.message ||
          "Failed to create planting site."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function handleRefreshMap() {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.invalidateSize();

    if (jubanBoundsRef.current?.isValid()) {
      mapRef.current.fitBounds(
        jubanBoundsRef.current.pad(0.28),
        {
          padding: [22, 22],
          maxZoom: 13,
          animate: false,
        }
      );
    } else {
      mapRef.current.setView(
        [JUBAN_FALLBACK_CENTER.lat, JUBAN_FALLBACK_CENTER.lng],
        12
      );
    }

    showSuccess("Map refreshed.");
  }

  async function handleArchive() {
    if (!selectedSite || actionLoading) {
      return;
    }

    const confirmed = window.confirm(
      `Archive ${selectedSite.siteName}?`
    );

    if (!confirmed) {
      return;
    }

    const siteId =
      selectedSite.id ||
      selectedSite.siteId;

    setActionLoading(true);
    setPageError("");

    try {
      const response = await apiRequest(
        `/sites/${siteId}/archive`,
        {
          method: "PATCH",
          body: JSON.stringify({}),
        }
      );

      const archivedRecord = response.data;

      setSites((previous) =>
        previous.filter(
          (site) =>
            String(site.id || site.siteId) !==
            String(siteId)
        )
      );

      setArchivedSites((previous) => [
        archivedRecord,
        ...previous.filter(
          (site) =>
            String(site.id || site.siteId) !==
            String(siteId)
        ),
      ]);

      setSelectedSite(null);

      showSuccess(
        `${siteId} was archived.`
      );
    } catch (error) {
      console.error(
        "Failed to archive planting site:",
        error
      );

      setPageError(
        error.message ||
          "Failed to archive planting site."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function restoreArchivedSite(siteId) {
    if (actionLoading) {
      return;
    }

    setActionLoading(true);
    setPageError("");

    try {
      const response = await apiRequest(
        `/sites/${siteId}/restore`,
        {
          method: "PATCH",
          body: JSON.stringify({}),
        }
      );

      const restored = response.data;

      setArchivedSites((previous) =>
        previous.filter(
          (item) =>
            String(item.id || item.siteId) !==
            String(siteId)
        )
      );

      setSites((previous) => [
        restored,
        ...previous.filter(
          (item) =>
            String(item.id || item.siteId) !==
            String(siteId)
        ),
      ]);

      showSuccess(
        `${siteId} was restored.`
      );
    } catch (error) {
      console.error(
        "Failed to restore planting site:",
        error
      );

      setPageError(
        error.message ||
          "Failed to restore planting site."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function beginBoundaryDrawing() {
    if (!mapRef.current) {
      setMapError(
        "The map must be available before drawing a site boundary."
      );
      return;
    }

    // Validate latitude/longitude before opening the drawing UI
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (
      form.latitude === "" ||
      form.longitude === "" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setFormErrors((previous) => ({
        ...previous,
        latitude:
          previous.latitude || "Enter a valid latitude.",
        longitude:
          previous.longitude || "Enter a valid longitude.",
      }));

      setMapError(
        "Provide valid latitude and longitude before drawing the site boundary."
      );

      return;
    }

    removeActiveDrawingControl();
    setShowAddModal(false);

    // Center the map on the provided coordinates to focus drawing
    try {
      const map = mapRef.current;
      const targetZoom = Math.max(map.getZoom() || 13, 15);
      map.flyTo([latitude, longitude], targetZoom, {
        animate: true,
      });
    } catch (err) {
      // Non-fatal: ensure drawing can still proceed
      console.warn("Failed to center map before drawing:", err);
    }

    const map = mapRef.current;
    const points = [];

    const previewPolygon = L.polygon([], {
      color: "#168044",
      opacity: 1,
      weight: 2,
      fillColor: "#4caf63",
      fillOpacity: 0.2,
      interactive: false,
    }).addTo(map);

    const clickHandler = (mapEvent) => {
      const point = {
        lat: mapEvent.latlng.lat,
        lng: mapEvent.latlng.lng,
      };

      points.push(point);
      previewPolygon.setLatLngs(
        points.map((item) => [item.lat, item.lng])
      );
    };

    map.on("click", clickHandler);

    const FinishControl = L.Control.extend({
      options: {
        position: "topright",
      },

      onAdd() {
        const wrapper = L.DomUtil.create(
          "div",
          "leaflet-bar ps-leaflet-drawing-control"
        );

        const button = L.DomUtil.create(
          "button",
          "ps-finish-drawing-control",
          wrapper
        );

        button.type = "button";
        button.textContent = "Finish Site Boundary";

        L.DomEvent.disableClickPropagation(wrapper);
        L.DomEvent.disableScrollPropagation(wrapper);

        L.DomEvent.on(button, "click", (event) => {
          L.DomEvent.stop(event);
          finishDrawing();
        });

        return wrapper;
      },
    });

    const control = new FinishControl();
    map.addControl(control);

    function finishDrawing() {
      map.off("click", clickHandler);

      if (map.hasLayer(previewPolygon)) {
        map.removeLayer(previewPolygon);
      }

      map.removeControl(control);
      activeDrawingRef.current = null;

      if (points.length >= 3) {
        const bounds = L.latLngBounds(
          points.map((point) => [point.lat, point.lng])
        );
        const center = bounds.getCenter();

        setForm((previous) => ({
          ...previous,
          polygon: points,
          latitude: center.lat.toFixed(6),
          longitude: center.lng.toFixed(6),
        }));

        setFormErrors((previous) => ({
          ...previous,
          polygon: "",
          latitude: "",
          longitude: "",
        }));
      } else {
        setFormErrors((previous) => ({
          ...previous,
          polygon:
            "Select at least three points to create the site boundary.",
        }));
      }

      setShowAddModal(true);
    }

    activeDrawingRef.current = {
      clickHandler,
      previewPolygon,
      control,
    };
  }

  const selectedStatus =
    selectedSite
      ? getSiteStatus(
          selectedSite
        )
      : null;

  const selectedUtilization =
    selectedSite
      ? getUtilization(
          selectedSite
        )
      : 0;

  const selectedAvailable =
    selectedSite
      ? Math.max(
          Number(
            selectedSite.maximumCapacity ||
              0
          ) -
            Number(
              selectedSite.planted ||
                0
            ),
          0
        )
      : 0;

  return (
    <div className="planting-sites-page">
      <section className="ps-page-header">
        <div className="ps-title-wrap">
          <div className="ps-title-icon">
            <MapPin
              size={20}
              strokeWidth={1.9}
            />
          </div>

          <div>
            <h1>
              Planting Sites Map
            </h1>

            <p>
              View and manage all
              registered planting and
              reforestation sites within
              Juban, Sorsogon.
            </p>
          </div>
        </div>

        <div className="ps-header-actions">
          <button
            type="button"
            className="ps-secondary-btn"
            onClick={
              handleRefreshMap
            }
          >
            <RefreshCw size={15} />

            Refresh Map
          </button>

          {canManage && (
            <>
              <button
                type="button"
                className="ps-secondary-btn"
                onClick={async () => {
                  try {
                    await loadArchivedSites();
                    setShowArchiveModal(true);
                  } catch (error) {
                    setPageError(
                      error.message ||
                        "Failed to load archived planting sites."
                    );
                  }
                }}
              >
                <Archive size={15} />

                Archived Sites
              </button>

              <button
                type="button"
                className="ps-primary-btn"
                onClick={() => {
                  setForm(
                    getInitialSiteForm()
                  );

                  setFormErrors({});

                  setShowAddModal(
                    true
                  );
                }}
              >
                <Plus size={16} />

                Add Planting Site
              </button>
            </>
          )}
        </div>
      </section>

      {successMessage && (
        <div className="ps-success-message">
          <Circle
            size={9}
            fill="currentColor"
          />

          {successMessage}
        </div>
      )}

      {pageError && (
        <div className="ps-success-message" role="alert">
          <Circle
            size={9}
            fill="currentColor"
          />

          {pageError}
        </div>
      )}

      <section
        className={`ps-map-shell ${
          selectedSite
            ? "details-open"
            : ""
        }`}
      >
        <div className="ps-map-main">
          <div className="ps-filter-row">
            <div className="ps-search-box">
              <Search size={15} />

              <input
                type="text"
                value={search}
                placeholder="Search site or barangay..."
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="ps-select-wrap">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All Site Status
                </option>

                {SITE_STATUS_OPTIONS.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  )
                )}
              </select>

              <ChevronDown size={14} />
            </div>

            <div className="ps-select-wrap">
              <select
                value={
                  conditionFilter
                }
                onChange={(event) =>
                  setConditionFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All Tree Conditions
                </option>

                {TREE_CONDITION_OPTIONS.map(
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

              <ChevronDown size={14} />
            </div>
          </div>

          <div className="ps-map-frame">
            <div
              ref={
                mapContainerRef
              }
              className="ps-google-map"
            />

            {mapError && (
              <div className="ps-map-error">
                <MapPin size={28} />

                <strong>
                  Map unavailable
                </strong>

                <span>
                  {mapError}
                </span>
              </div>
            )}

            {!mapError &&
              loading && (
                <div className="ps-empty-map-hint">
                  <MapPin size={17} />

                  <span>
                    Loading registered planting sites...
                  </span>
                </div>
              )}

            {!mapError &&
              mapReady &&
              !loading &&
              sites.length === 0 && (
                <div className="ps-empty-map-hint">
                  <MapPin size={17} />

                  <span>
                    No planting sites have
                    been registered yet.
                  </span>
                </div>
              )}

            <MapLegend />
          </div>
        </div>

        {selectedSite && (
          <aside className="ps-site-drawer">
            <div className="ps-drawer-header">
              <div className="ps-site-heading">
                <span
                  className="ps-condition-dot"
                  style={{
                    background:
                      getConditionColor(
                        selectedSite.treeCondition ||
                          "Not Yet Monitored"
                      ),
                  }}
                />

                <div>
                  <h2>
                    {
                      selectedSite.siteName
                    }
                  </h2>

                  <span>
                    Site ID:{" "}
                    {selectedSite.id || selectedSite.siteId}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="ps-close-btn"
                onClick={() =>
                  setSelectedSite(
                    null
                  )
                }
              >
                <X size={19} />
              </button>
            </div>

            <div className="ps-drawer-tabs">
              <button
                type="button"
                className={
                  activeDetailTab ===
                  "information"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setActiveDetailTab(
                    "information"
                  )
                }
              >
                Site Information
              </button>

              <button
                type="button"
                className={
                  activeDetailTab ===
                  "documentation"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setActiveDetailTab(
                    "documentation"
                  )
                }
              >
                Growth Documentation

                <span className="ps-tab-count">
                  {selectedSite
                    .growthDocumentation
                    ?.length || 0}
                </span>
              </button>
            </div>

            <div className="ps-drawer-content">
              {activeDetailTab ===
                "information" && (
                <SiteInformation
                  site={
                    selectedSite
                  }
                  status={
                    selectedStatus
                  }
                  utilization={
                    selectedUtilization
                  }
                  available={
                    selectedAvailable
                  }
                />
              )}

              {activeDetailTab ===
                "documentation" && (
                <GrowthDocumentation
                  site={
                    selectedSite
                  }
                  canManage={
                    canManage
                  }
                />
              )}
            </div>

            <div className="ps-drawer-footer">
              <button
                type="button"
                className="ps-secondary-btn ps-drawer-action"
              >
                <Eye size={15} />

                View Full Site Details
              </button>

              {canManage && (
                <>
                  <button
                    type="button"
                    className="ps-primary-btn ps-drawer-action"
                  >
                    <Edit3 size={14} />

                    Edit Site
                  </button>

                  <button
                    type="button"
                    className="ps-archive-btn ps-drawer-action"
                    onClick={
                      handleArchive
                    }
                    disabled={
                      actionLoading
                    }
                  >
                    <Archive size={14} />

                    Archive Site
                  </button>
                </>
              )}
            </div>
          </aside>
        )}
      </section>

      {showAddModal && (
        <div className="ps-modal-backdrop">
          <div className="ps-modal">
            <div className="ps-modal-header">
              <div>
                <h2>
                  {actionLoading
                    ? "Saving..."
                    : "Add Planting Site"}
                </h2>

                <p>
                  Register a planting or
                  reforestation area
                  within Juban.
                </p>
              </div>

              <button
                type="button"
                className="ps-close-btn"
                onClick={() =>
                  setShowAddModal(
                    false
                  )
                }
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="ps-modal-body"
              onSubmit={
                handleAddSite
              }
            >
              <section className="ps-form-section">
                <div className="ps-form-section-title">
                  Site Information
                </div>

                <div className="ps-form-grid">
                  <FormField
                    label="Site Name *"
                    error={
                      formErrors.siteName
                    }
                    full
                  >
                    <input
                      type="text"
                      value={
                        form.siteName
                      }
                      placeholder="Enter site name"
                      onChange={(event) =>
                        updateForm(
                          "siteName",
                          event.target.value
                        )
                      }
                    />
                  </FormField>

                  <FormField
                    label="Barangay *"
                    error={
                      formErrors.barangay
                    }
                  >
                    <select
                      value={
                        form.barangay
                      }
                      onChange={(event) =>
                        updateForm(
                          "barangay",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select barangay
                      </option>

                      {BARANGAYS.map(
                        (barangay) => (
                          <option
                            key={
                              barangay
                            }
                            value={
                              barangay
                            }
                          >
                            {
                              barangay
                            }
                          </option>
                        )
                      )}
                    </select>
                  </FormField>

                  <FormField
                    label="Site Type *"
                    error={
                      formErrors.siteType
                    }
                  >
                    <select
                      value={
                        form.siteType
                      }
                      onChange={(event) =>
                        updateForm(
                          "siteType",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select site type
                      </option>

                      {SITE_TYPES.map(
                        (type) => (
                          <option
                            key={type}
                            value={type}
                          >
                            {type}
                          </option>
                        )
                      )}
                    </select>
                  </FormField>
                </div>
              </section>

              <section className="ps-form-section">
                <div className="ps-form-section-title">
                  Area & Capacity
                </div>

                <div className="ps-form-grid">
                  <FormField
                    label="Area (hectares) *"
                    error={
                      formErrors.areaHectares
                    }
                  >
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={
                        form.areaHectares
                      }
                      placeholder="e.g. 1.50"
                      onChange={(event) =>
                        updateForm(
                          "areaHectares",
                          event.target.value
                        )
                      }
                    />
                  </FormField>

                  <FormField
                    label="Maximum Seedling Capacity *"
                    error={
                      formErrors.maximumCapacity
                    }
                  >
                    <input
                      type="number"
                      min="1"
                      value={
                        form.maximumCapacity
                      }
                      placeholder="e.g. 1000"
                      onChange={(event) =>
                        updateForm(
                          "maximumCapacity",
                          event.target.value
                        )
                      }
                    />
                  </FormField>
                </div>
              </section>

              <section className="ps-form-section">
                <div className="ps-form-section-title">
                  Location
                </div>

                <div className="ps-form-grid">
                  <FormField
                    label="Latitude *"
                    error={
                      formErrors.latitude
                    }
                  >
                    <input
                      type="number"
                      step="any"
                      value={
                        form.latitude
                      }
                      placeholder="Latitude"
                      onChange={(event) =>
                        updateForm(
                          "latitude",
                          event.target.value
                        )
                      }
                    />
                  </FormField>

                  <FormField
                    label="Longitude *"
                    error={
                      formErrors.longitude
                    }
                  >
                    <input
                      type="number"
                      step="any"
                      value={
                        form.longitude
                      }
                      placeholder="Longitude"
                      onChange={(event) =>
                        updateForm(
                          "longitude",
                          event.target.value
                        )
                      }
                    />
                  </FormField>

                  <FormField
                    label="Location Description"
                    full
                  >
                    <input
                      type="text"
                      value={
                        form.locationDescription
                      }
                      placeholder="Describe the exact location or landmark"
                      onChange={(event) =>
                        updateForm(
                          "locationDescription",
                          event.target.value
                        )
                      }
                    />
                  </FormField>

                  <div className="ps-boundary-field">
                    <div>
                      <span>
                        Planting Site Boundary *
                      </span>

                      <small>
                        Click points around the
                        site on the map to
                        create its polygon.
                      </small>

                      {form.polygon
                        .length >= 3 && (
                        <em>
                          {
                            form
                              .polygon
                              .length
                          }{" "}
                          boundary points
                          saved
                        </em>
                      )}

                      {formErrors.polygon && (
                        <strong>
                          {
                            formErrors.polygon
                          }
                        </strong>
                      )}
                    </div>

                    <button
                      type="button"
                      className="ps-secondary-btn"
                      onClick={
                        beginBoundaryDrawing
                      }
                    >
                      <Layers3 size={14} />

                      Draw Site Boundary
                    </button>
                  </div>
                </div>
              </section>

              <section className="ps-form-section">
                <div className="ps-form-section-title">
                  Additional Information
                </div>

                <div className="ps-form-grid">
                  <FormField label="Land / Ownership Type">
                    <select
                      value={
                        form.ownershipType
                      }
                      onChange={(event) =>
                        updateForm(
                          "ownershipType",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select ownership
                      </option>

                      {OWNERSHIP_TYPES.map(
                        (type) => (
                          <option
                            key={type}
                            value={type}
                          >
                            {type}
                          </option>
                        )
                      )}
                    </select>
                  </FormField>

                  <FormField label="Site Coordinator">
                    <input
                      type="text"
                      value={
                        form.coordinator
                      }
                      placeholder="Coordinator name"
                      onChange={(event) =>
                        updateForm(
                          "coordinator",
                          event.target.value
                        )
                      }
                    />
                  </FormField>

                  <FormField
                    label="Coordinator Contact"
                    full
                  >
                    <input
                      type="text"
                      value={
                        form.coordinatorContact
                      }
                      placeholder="Contact number"
                      onChange={(event) =>
                        updateForm(
                          "coordinatorContact",
                          event.target.value
                        )
                      }
                    />
                  </FormField>

                  <FormField
                    label="Description / Notes"
                    full
                  >
                    <textarea
                      value={
                        form.notes
                      }
                      placeholder="Additional information about the planting site"
                      onChange={(event) =>
                        updateForm(
                          "notes",
                          event.target.value
                        )
                      }
                    />
                  </FormField>
                </div>
              </section>

              <div className="ps-modal-footer">
                <button
                  type="button"
                  className="ps-secondary-btn"
                  onClick={() =>
                    setShowAddModal(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="ps-primary-btn"
                  disabled={
                    actionLoading
                  }
                >
                  <Plus size={15} />

                  Add Planting Site
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showArchiveModal && (
        <div className="ps-modal-backdrop">
          <div className="ps-modal ps-archive-modal">
            <div className="ps-modal-header">
              <div>
                <h2>
                  Archived Planting Sites
                </h2>

                <p>
                  Restore planting sites
                  that were removed from
                  the active map.
                </p>
              </div>

              <button
                type="button"
                className="ps-close-btn"
                onClick={() =>
                  setShowArchiveModal(
                    false
                  )
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="ps-archive-body">
              {archivedSites.length ===
              0 ? (
                <div className="ps-archive-empty">
                  <Archive
                    size={30}
                    strokeWidth={1.5}
                  />

                  <h3>
                    No archived planting
                    sites
                  </h3>

                  <p>
                    Archived records will
                    appear here.
                  </p>
                </div>
              ) : (
                archivedSites.map(
                  (site) => (
                    <div
                      key={site.id || site.siteId}
                      className="ps-archive-row"
                    >
                      <div>
                        <strong>
                          {
                            site.siteName
                          }
                        </strong>

                        <span>
                          {site.id || site.siteId} ·{" "}
                          {
                            site.barangay
                          }
                        </span>
                      </div>

                      <button
                        type="button"
                        className="ps-secondary-btn"
                        onClick={() =>
                          restoreArchivedSite(
                            site.id || site.siteId
                          )
                        }
                        disabled={
                          actionLoading
                        }
                      >
                        Restore
                      </button>
                    </div>
                  )
                )
              )}
            </div>

            <div className="ps-modal-footer">
              <button
                type="button"
                className="ps-secondary-btn"
                onClick={() =>
                  setShowArchiveModal(
                    false
                  )
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SiteInformation({
  site,
  status,
  utilization,
  available,
}) {
  return (
    <div className="ps-info-sections">
      <InfoSection
        title="Site Information"
        icon={Sprout}
      >
        <InfoRow
          label="Site ID"
          value={site.id || site.siteId}
        />

        <InfoRow
          label="Site Name"
          value={site.siteName}
        />

        <InfoRow
          label="Barangay"
          value={site.barangay}
        />

        <InfoRow
          label="Site Type"
          value={
            site.siteType || "—"
          }
        />

        <InfoRow
          label="Status"
          value={status}
        />
      </InfoSection>

      <InfoSection
        title="Location"
        icon={MapPin}
      >
        <InfoRow
          label="Latitude"
          value={
            site.latitude ?? "—"
          }
        />

        <InfoRow
          label="Longitude"
          value={
            site.longitude ?? "—"
          }
        />

        <InfoRow
          label="Coordinates"
          value={
            site.latitude != null &&
            site.longitude != null
              ? `${site.latitude}, ${site.longitude}`
              : "—"
          }
        />

        <InfoRow
          label="Location Description"
          value={
            site.locationDescription ||
            "—"
          }
        />
      </InfoSection>

      <InfoSection
        title="Planting Capacity"
        icon={Trees}
      >
        <InfoRow
          label="Area"
          value={`${site.areaHectares || 0} ha`}
        />

        <InfoRow
          label="Maximum Seedling Capacity"
          value={`${formatNumber(
            site.maximumCapacity
          )} seedlings`}
        />

        <InfoRow
          label="Planted"
          value={`${formatNumber(
            site.planted
          )} seedlings`}
        />

        <InfoRow
          label="Available Capacity"
          value={`${formatNumber(
            available
          )} seedlings`}
        />

        <InfoRow
          label="Utilization"
          value={`${utilization}%`}
        />
      </InfoSection>

      <InfoSection
        title="Tree Monitoring"
        icon={Trees}
      >
        <InfoRow
          label="Tree Condition"
          value={
            site.treeCondition ||
            "Not Yet Monitored"
          }
        />

        <InfoRow
          label="Survival Rate"
          value={
            site.survivalRate == null
              ? "Not yet available"
              : `${site.survivalRate}%`
          }
        />

        <InfoRow
          label="Age of Trees"
          value={
            site.treeAgeMonths == null
              ? "Not yet available"
              : `${site.treeAgeMonths} months`
          }
        />
      </InfoSection>

      <InfoSection
        title="Additional Information"
        icon={UserRound}
      >
        <InfoRow
          label="Land / Ownership Type"
          value={
            site.ownershipType ||
            "—"
          }
        />

        <InfoRow
          label="Site Coordinator"
          value={
            site.coordinator ||
            "—"
          }
        />

        <InfoRow
          label="Coordinator Contact"
          value={
            site.coordinatorContact ||
            "—"
          }
        />

        <InfoRow
          label="Description / Notes"
          value={
            site.notes || "—"
          }
        />
      </InfoSection>

      <InfoSection
        title="Related Event"
        icon={Layers3}
      >
        <InfoRow
          label="Event"
          value={
            site.relatedEventName ||
            "No related event yet"
          }
        />
      </InfoSection>
    </div>
  );
}

function GrowthDocumentation({
  site,
  canManage,
}) {
  const records =
    site.growthDocumentation ||
    [];

  if (records.length === 0) {
    return (
      <div className="ps-growth-empty">
        <div className="ps-empty-document-icon">
          <FileImage
            size={38}
            strokeWidth={1.4}
          />

          <Sprout
            size={18}
            strokeWidth={1.7}
          />
        </div>

        <h3>
          No growth documentation yet
        </h3>

        <p>
          Photos and monitoring records
          of seedling and tree growth
          will appear here once
          documentation has been
          submitted.
        </p>

        {canManage && (
          <button
            type="button"
            className="ps-documentation-btn"
          >
            <Camera size={15} />

            Add Documentation
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="ps-growth-list">
      {records.map(
        (record) => (
          <article
            className="ps-growth-record"
            key={record.id}
          >
            {record.photoUrl ? (
              <img
                src={
                  record.photoUrl
                }
                alt="Growth documentation"
              />
            ) : (
              <div className="ps-growth-photo-placeholder">
                <Camera size={22} />
              </div>
            )}

            <div>
              <span>
                {formatDate(
                  record.date
                )}
              </span>

              <p>
                {record.notes ||
                  "No notes provided."}
              </p>
            </div>
          </article>
        )
      )}
    </div>
  );
}

function InfoSection({
  title,
  icon: Icon,
  children,
}) {
  return (
    <section className="ps-info-section">
      <div className="ps-info-section-title">
        <Icon size={14} />

        <span>{title}</span>
      </div>

      <div className="ps-info-list">
        {children}
      </div>
    </section>
  );
}

function InfoRow({
  label,
  value,
}) {
  return (
    <div className="ps-info-row">
      <span>{label}</span>

      <strong>
        {value || "—"}
      </strong>
    </div>
  );
}

function FormField({
  label,
  error,
  full = false,
  children,
}) {
  return (
    <label
      className={`ps-form-field ${
        full ? "full" : ""
      }`}
    >
      <span>{label}</span>

      {children}

      {error && (
        <small>
          {error}
        </small>
      )}
    </label>
  );
}

function MapLegend() {
  return (
    <div className="ps-map-legend">
      <section>
        <h3>
          Site Utilization
        </h3>

        <LegendSquare
          color="#4caf63"
          label="Available (0–49%)"
        />

        <LegendSquare
          color="#facc15"
          label="Partially Occupied (50–89%)"
        />

        <LegendSquare
          color="#ef4444"
          label="Full (90–100%)"
        />
      </section>

      <section>
        <h3>
          Tree Condition
        </h3>

        <LegendDot
          color="#1aa343"
          label="Healthy"
        />

        <LegendDot
          color="#f4b400"
          label="Needs Attention"
        />

        <LegendDot
          color="#e52d2d"
          label="Critical"
        />

        <LegendDot
          color="#3186d9"
          label="Not Yet Monitored"
        />
      </section>

      <div className="ps-boundary-legend">
        <span />

        Barangay Boundary
      </div>
    </div>
  );
}

function LegendSquare({
  color,
  label,
}) {
  return (
    <div className="ps-legend-row">
      <span
        className="ps-legend-square"
        style={{
          background: color,
        }}
      />

      {label}
    </div>
  );
}

function LegendDot({
  color,
  label,
}) {
  return (
    <div className="ps-legend-row">
      <span
        className="ps-legend-dot"
        style={{
          background: color,
        }}
      />

      {label}
    </div>
  );
}