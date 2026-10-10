import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Sprout,
  Plus,
  Search,
  PackageCheck,
  PackageOpen,
  Trees,
  CalendarClock,
  Eye,
  Pencil,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  RotateCcw,
  Boxes,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { auth } from "../firebase/config";

import "../styles/seedlings.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const CATEGORY_OPTIONS = [
  "Native Tree", "Fruit Tree", "Hardwood", "Mangrove", "Ornamental", "Other",
];
const STOCK_STATUS_OPTIONS = ["Available", "Limited", "Out of Stock"];
const SOURCE_TYPE_OPTIONS = [
  "MENRO Propagation", "DENR / PENRO", "Provincial Government",
  "Other Government Office", "Donation", "Wildling Collection",
  "Sorsogon Provincial Nursery", "Other",
];
const STORAGE_LOCATION_OPTIONS = [
  "MENRO Nursery", "Temporary Holding / Storage Area", "Other",
];

function timestampToIso(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value;
  }

  const seconds =
    value._seconds ??
    value.seconds ??
    value._seconds;

  if (Number.isFinite(Number(seconds))) {
    return new Date(Number(seconds) * 1000).toISOString();
  }

  return "";
}

function normalizeInventoryItem(item) {
  return {
    ...item,
    id: item.id || "",
    inventoryNumber: item.inventoryNumber || "",
    treeName:
      item.species ||
      item.treeName ||
      "",
    scientificName:
      item.scientificName || "",
    category:
      item.category || "",
    quantity: Number(item.initialQuantity ?? item.quantity ?? 0),
    initialQuantity: Number(item.initialQuantity ?? item.quantity ?? 0),
    currentQuantity: Number(item.currentQuantity ?? item.availableQuantity ?? item.available ?? 0),
    available:
      Number(
        item.availableQuantity ??
          item.available ??
          0
      ),
    reserved:
      Number(
        item.reservedQuantity ??
          item.reserved ??
          0
      ),
    distributed:
      Number(
        item.distributedQuantity ??
          item.distributed ??
          0
      ),
    planted:
      Number(item.planted || 0),
    sourceType: item.sourceType || item.sourceNursery || "",
    sourceSpecification: item.sourceSpecification || "",
    storageLocation: item.storageLocation || item.sourceNursery || "",
    storageLocationSpecification: item.storageLocationSpecification || "",
    categorySpecification: item.categorySpecification || "",
    dateReceived:
      item.dateReceived || "",
    batchReference:
      item.batchReference || "",
    description:
      item.description || "",
    status: item.stockStatus || item.status || "",
    createdAt:
      timestampToIso(item.createdAt) ||
      item.createdAt ||
      "",
    updatedAt:
      timestampToIso(item.updatedAt) ||
      item.updatedAt ||
      "",
  };
}

function normalizeDistribution(record) {
  const items = Array.isArray(record.items)
    ? record.items.map((item) => ({
        ...item,
        species: item.species || item.treeName || "Unnamed sapling",
        quantity: Number(item.releasedQuantity ?? item.quantity ?? 0),
      }))
    : [];

  return {
    ...record,
    id: record.id || "",
    distributionNumber: record.distributionNumber || record.id || "",
    requestNumber: record.requestNumber || record.requestId || "",
    participantName: record.participantName || record.organization || "—",
    items,
    totalQuantityReleased: Number(
      record.totalQuantityReleased ||
        items.reduce((total, item) => total + item.quantity, 0)
    ),
    releasedAt: timestampToIso(record.releasedAt) || record.releasedAt || "",
    status: record.status || "Released",
  };
}

async function getAuthToken(forceRefresh = false) {
  if (
    typeof auth.authStateReady === "function"
  ) {
    await auth.authStateReady();
  }

  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    return "";
  }

  return firebaseUser.getIdToken(
    forceRefresh
  );
}

async function apiRequest(
  path,
  options = {},
  allowRetry = true
) {
  const token =
    await getAuthToken(false);

  if (!token) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  const buildHeaders = (
    authToken
  ) => ({
    "Content-Type":
      "application/json",
    Authorization:
      `Bearer ${authToken}`,
    ...(options.headers || {}),
  });

  let response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers:
        buildHeaders(token),
    }
  );

  if (
    response.status === 401 &&
    allowRetry
  ) {
    const refreshedToken =
      await getAuthToken(true);

    response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...options,
        headers:
          buildHeaders(
            refreshedToken
          ),
      }
    );
  }

  let payload;

  try {
    payload =
      await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        "The request could not be completed."
    );
  }

  return payload || {};
}

function getInitialForm() {
  return {
    treeName: "",
    scientificName: "",
    category: "",
    categorySpecification: "",
    quantity: "",
    stockStatus: "Available",
    sourceType: "",
    sourceSpecification: "",
    dateReceived: "",
    storageLocation: "",
    storageLocationSpecification: "",
    description: "",
  };
}


function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatDateTime(dateString) {
  if (!dateString) {
    return {
      date: "—",
      time: "",
    };
  }

  const date = new Date(dateString);

  return {
    date: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),

    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function StatusBadge({ status }) {
  const className = String(status || "")
    .toLowerCase()
    .replaceAll(" ", "-");

  return (
    <span
      className={`sd-status sd-status-${className}`}
    >
      {status}
    </span>
  );
}

export default function SeedlingsPage() {
  const { success: showSuccess, error: showError } = useToast();
  const { userRole } = useAuth();
  const [pageSearchParams] = useSearchParams();

  const canManage =
    userRole === "staff";

  const [seedlings, setSeedlings] =
    useState([]);
  const [speciesOptions, setSpeciesOptions] = useState([]);

  const [distributions, setDistributions] = useState([]);
  const [distributionLoading, setDistributionLoading] = useState(false);
  const [distributionError, setDistributionError] = useState("");
  const [distributionRetryKey, setDistributionRetryKey] = useState(0);


  const [activeTab, setActiveTab] =
    useState("seedlings");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [treeFilter, setTreeFilter] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("");

  const [showMoreMenu, setShowMoreMenu] =
    useState(false);

  const [showAddModal, setShowAddModal] =
    useState(false);

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [showStockModal, setShowStockModal] = useState(false);
  const [stockAmount, setStockAmount] = useState("");
  const [stockError, setStockError] = useState("");

  const [showDetailsModal, setShowDetailsModal] =
    useState(false);


  const [selectedSeedling, setSelectedSeedling] =
    useState(null);

  const [form, setForm] =
    useState(getInitialForm);

  const [formErrors, setFormErrors] =
    useState({});

  const [editForm, setEditForm] =
    useState({
      stockStatus: "Available",
      description: "",
    });

  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [editErrors, setEditErrors] =
    useState({});

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] =
    useState(10);

  const moreMenuRef = useRef(null);
  const openedInventoryFromSearchRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      setLoading(true);
      setLoadError("");

      try {
        const response =
          await apiRequest(
            "/inventory"
          );

        if (cancelled) {
          return;
        }

        const records =
          Array.isArray(
            response.data
          )
            ? response.data
            : [];

        setSeedlings(
          records.map(
            normalizeInventoryItem
          )
        );
      } catch (error) {
        console.error(
          "Failed to load seedling inventory:",
          error
        );

        if (!cancelled) {
          setLoadError("Unable to load sapling inventory. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInventory();

    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  useEffect(() => {
    let cancelled = false;
    apiRequest("/inventory/species")
      .then((response) => {
        if (!cancelled) setSpeciesOptions(Array.isArray(response.data) ? response.data : []);
      })
      .catch((error) => {
        console.error("Failed to load MENRO species master:", error);
        if (!cancelled) setLoadError("Unable to load the MENRO species list. Please try again.");
      });
    return () => { cancelled = true; };
  }, [retryKey]);

  useEffect(() => {
    if (activeTab !== "distribution") return undefined;

    let cancelled = false;

    async function loadDistributions() {
      setDistributionLoading(true);
      setDistributionError("");

      try {
        const response = await apiRequest("/distributions");
        if (cancelled) return;

        const records = Array.isArray(response.data) ? response.data : [];
        setDistributions(
          records
            .filter(
              (record) =>
                String(record.status || "Released").toLowerCase() === "released"
            )
            .map(normalizeDistribution)
            .sort(
              (first, second) =>
                new Date(second.releasedAt || 0) -
                new Date(first.releasedAt || 0)
            )
        );
      } catch (error) {
        console.error("Failed to load distribution records:", error);
        if (!cancelled) {
          setDistributionError(
            error.message ||
              "Unable to load distribution records. Please try again."
          );
        }
      } finally {
        if (!cancelled) setDistributionLoading(false);
      }
    }

    loadDistributions();

    return () => {
      cancelled = true;
    };
  }, [activeTab, distributionRetryKey]);

  useEffect(() => {
    const inventoryId = pageSearchParams.get("inventory") || "";
    if (!inventoryId || loading || openedInventoryFromSearchRef.current === inventoryId) return;
    const seedling = seedlings.find((item) => String(item.id || "") === inventoryId);
    if (!seedling) return;
    const openTimer = window.setTimeout(() => {
      openedInventoryFromSearchRef.current = inventoryId;
      setSelectedSeedling(seedling);
      setShowDetailsModal(true);
    }, 0);
    return () => window.clearTimeout(openTimer);
  }, [loading, pageSearchParams, seedlings]);


  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target)
      ) {
        setShowMoreMenu(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  useEffect(() => {
    if (!showMoreMenu) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") setShowMoreMenu(false);
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showMoreMenu]);

  const counts = useMemo(() => {
    const totalSeedlings = seedlings.reduce(
      (total, seedling) =>
        total + Number(seedling.quantity || 0),
      0
    );

    const available = seedlings.reduce(
      (total, seedling) =>
        total + Number(seedling.available || 0),
      0
    );

    const distributed = seedlings.reduce(
      (total, seedling) =>
        total + Number(seedling.distributed || 0),
      0
    );

    const planted = seedlings.reduce(
      (total, seedling) =>
        total + Number(seedling.planted || 0),
      0
    );

    const latestRecord = [...seedlings]
      .filter((seedling) => seedling.updatedAt)
      .sort(
        (a, b) =>
          new Date(b.updatedAt) -
          new Date(a.updatedAt)
      )[0];

    return {
      totalSeedlings,
      available,
      distributed,
      planted,
      treeTypes: seedlings.length,
      lastUpdated:
        latestRecord?.updatedAt || null,
    };
  }, [seedlings]);

  const treeNames = useMemo(() => {
    return [
      ...new Set(
        seedlings
          .map((seedling) => seedling.treeName)
          .filter(Boolean)
      ),
    ].sort();
  }, [seedlings]);

  const filteredSeedlings = useMemo(() => {
    return seedlings.filter((seedling) => {
      if (
        treeFilter &&
        seedling.treeName !== treeFilter
      ) {
        return false;
      }

      if (
        statusFilter &&
        seedling.status !== statusFilter
      ) {
        return false;
      }

      if (searchTerm.trim()) {
        const search =
          searchTerm.trim().toLowerCase();

        const searchable = [
          seedling.id,
          seedling.treeName,
          seedling.scientificName,
          seedling.category,
          seedling.status,
          seedling.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }, [
    seedlings,
    treeFilter,
    statusFilter,
    searchTerm,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredSeedlings.length / pageSize
    )
  );

  const currentPage = Math.min(
    page,
    totalPages
  );

  const paginatedSeedlings =
    filteredSeedlings.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

  const pageStart =
    filteredSeedlings.length === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;

  const pageEnd = Math.min(
    currentPage * pageSize,
    filteredSeedlings.length
  );

  const lastUpdated =
    formatDateTime(counts.lastUpdated);

  const updateForm = (field, value) => {
    setForm((previous) => {
      const next = { ...previous, [field]: value };
      if (field === "treeName") {
        const species = speciesOptions.find((item) => item.treeName === value);
        next.scientificName = species?.scientificName || "";
      }
      if (field === "quantity" && value !== "" && Number(value) === 0) {
        next.stockStatus = "Out of Stock";
      } else if (field === "quantity" && Number(value) > 0 && previous.stockStatus === "Out of Stock") {
        next.stockStatus = "Available";
      }
      if (field === "category" && value !== "Other") next.categorySpecification = "";
      if (field === "sourceType" && value !== "Other") next.sourceSpecification = "";
      if (field === "storageLocation" && value !== "Other") next.storageLocationSpecification = "";
      return next;
    });

    setFormErrors((previous) => ({
      ...previous,
      [field]: "",
    }));
  };

  const validateForm = () => {
    const errors = {};

    const selectedSpecies = speciesOptions.find((item) => item.treeName === form.treeName);
    if (!form.treeName.trim()) {
      errors.treeName =
        "Tree name is required.";
    } else if (!selectedSpecies) {
      errors.treeName = "Select a tree from the MENRO species list.";
    }

    if (!form.category) {
      errors.category =
        "Category / type is required.";
    }
    if (form.category === "Other" && !form.categorySpecification.trim()) {
      errors.categorySpecification = "Please specify the category / type.";
    }

    const quantity =
      Number(form.quantity);

    if (form.quantity === "") {
      errors.quantity =
        "Initial quantity is required.";
    } else if (
      !Number.isInteger(quantity)
    ) {
      errors.quantity =
        "Initial quantity must be a whole number.";
    } else if (quantity < 0) {
      errors.quantity =
        "Initial quantity cannot be negative.";
    }
    if (quantity === 0 && form.stockStatus !== "Out of Stock") errors.stockStatus = "Zero quantity must be Out of Stock.";
    if (quantity > 0 && !["Available", "Limited"].includes(form.stockStatus)) errors.stockStatus = "Positive quantity must be Available or Limited.";

    if (!SOURCE_TYPE_OPTIONS.includes(form.sourceType)) errors.sourceType = "Source type is required.";
    if (form.sourceType === "Other" && !form.sourceSpecification.trim()) errors.sourceSpecification = "Please specify the source.";
    if (!STORAGE_LOCATION_OPTIONS.includes(form.storageLocation)) errors.storageLocation = "Nursery / storage location is required.";
    if (form.storageLocation === "Other" && !form.storageLocationSpecification.trim()) errors.storageLocationSpecification = "Please specify the nursery / storage location.";

    if (!form.dateReceived) {
      errors.dateReceived =
        "Date received is required.";
    } else {
      const receivedDate =
        new Date(
          `${form.dateReceived}T00:00:00`
        );

      const today =
        new Date();

      today.setHours(
        23,
        59,
        59,
        999
      );

      if (
        Number.isNaN(
          receivedDate.getTime()
        )
      ) {
        errors.dateReceived =
          "Enter a valid received date.";
      } else if (
        receivedDate > today
      ) {
        errors.dateReceived =
          "Date received cannot be in the future.";
      }
    }

    if (
      form.description.length >
      500
    ) {
      errors.description =
        "Description must not exceed 500 characters.";
    }

    return errors;
  };

  const resetForm = () => {
    setForm(getInitialForm());
    setFormErrors({});
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  const handleAddSeedling = async (event) => {
    event.preventDefault();
    if (!canManage || actionLoading) return;

    const errors =
      validateForm();

    if (
      Object.keys(errors).length >
      0
    ) {
      setFormErrors(errors);
      showError(
        "Please correct the highlighted fields before adding the sapling record."
      );
      return;
    }

    setActionLoading(true);

    try {
      const quantity =
        Number(form.quantity);

      const response =
        await apiRequest(
          "/inventory",
          {
            method: "POST",
            body: JSON.stringify({
              species: form.treeName,
              category: form.category,
              categorySpecification: form.categorySpecification.trim(),
              initialQuantity: quantity,
              stockStatus: form.stockStatus,
              sourceType: form.sourceType,
              sourceSpecification: form.sourceSpecification.trim(),
              dateReceived: form.dateReceived,
              storageLocation: form.storageLocation,
              storageLocationSpecification: form.storageLocationSpecification.trim(),
              description: form.description.trim(),
            }),
          }
        );

      const newSeedling =
        normalizeInventoryItem(
          response.data || {}
        );

      setSeedlings(
        (previous) => [
          newSeedling,
          ...previous,
        ]
      );

      closeAddModal();

      showSuccess(
        `Sapling batch added successfully. Batch Reference: ${newSeedling.batchReference}`
      );
    } catch (error) {
      console.error(error);

      showError(
        error.message ||
          "Unable to add the sapling record."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const openDetails = (seedling) => {
    setSelectedSeedling(seedling);
    setShowDetailsModal(true);
  };

  const openEdit = (seedling) => {
    setSelectedSeedling(seedling);

    setEditForm({
      stockStatus: seedling.currentQuantity <= 0 ? "Out of Stock" : seedling.status,
      description:
        seedling.description || "",
    });

    setEditErrors({});
    setShowEditModal(true);
  };

  const openAddStock = (seedling) => {
    if (!canManage) return;
    setSelectedSeedling(seedling);
    setStockAmount("");
    setStockError("");
    setShowStockModal(true);
  };

  const handleAddStock = async (event) => {
    event.preventDefault();
    if (!canManage || !selectedSeedling || actionLoading) return;
    const amount = Number(stockAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setStockError("Enter a whole number greater than zero.");
      return;
    }

    setActionLoading(true);
    setStockError("");
    try {
      const response = await apiRequest(`/inventory/${selectedSeedling.id}/stock`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: amount }),
      });
      const updated = normalizeInventoryItem(response.data || {});
      setSeedlings((previous) => previous.map((item) =>
        item.id === updated.id ? updated : item
      ));
      setSelectedSeedling(updated);
      setShowStockModal(false);
      showSuccess(`${formatNumber(amount)} saplings added to ${updated.treeName}.`);
    } catch (error) {
      setStockError(error.message || "Unable to add stock.");
    } finally {
      setActionLoading(false);
    }
  };

  const updateEditForm = (
    field,
    value
  ) => {
    setEditForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setEditErrors((previous) => ({
      ...previous,
      [field]: "",
    }));
  };

  const handleUpdateSeedling = async (
    event
  ) => {
    event.preventDefault();

    if (!canManage || !selectedSeedling || actionLoading) {
      return;
    }

    const errors = {};

    if (selectedSeedling.currentQuantity <= 0 && editForm.stockStatus !== "Out of Stock") {
      errors.stockStatus = "Zero quantity must remain Out of Stock.";
    } else if (selectedSeedling.currentQuantity > 0 && !["Available", "Limited"].includes(editForm.stockStatus)) {
      errors.stockStatus = "Positive quantity must be Available or Limited.";
    }

    if (
      editForm.description.length >
      500
    ) {
      errors.description =
        "Description must not exceed 500 characters.";
    }

    if (
      Object.keys(errors).length >
      0
    ) {
      setEditErrors(errors);
      showError(
        "Please correct the highlighted fields before saving."
      );
      return;
    }

    setActionLoading(true);

    try {
      const response =
        await apiRequest(
          `/inventory/${selectedSeedling.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              stockStatus: editForm.stockStatus,
              description:
                editForm.description.trim(),
            }),
          }
        );

      const updatedSeedling =
        normalizeInventoryItem(
          response.data || {}
        );

      setSeedlings(
        (previous) =>
          previous.map(
            (seedling) =>
              seedling.id ===
              updatedSeedling.id
                ? updatedSeedling
                : seedling
          )
      );

      setSelectedSeedling(
        updatedSeedling
      );

      setShowEditModal(false);
      setEditErrors({});

      showSuccess(
        `${updatedSeedling.treeName || "Sapling"} was updated successfully. Available stock is now ${updatedSeedling.available}.`
      );
    } catch (error) {
      console.error(error);

      showError(
        error.message ||
          "Unable to update the sapling record."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setTreeFilter("");
    setStatusFilter("");
    setPage(1);
  };

  if (loading) {
    return (
      <div className="seedlings-page">
        <div
          style={{
            minHeight: "420px",
            display: "grid",
            placeItems: "center",
            color: "#526159",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          Loading sapling inventory...
        </div>
      </div>
    );
  }

  if (loadError) {
    return <div className="seedlings-page"><div role="alert" style={{ minHeight: "420px", display: "grid", placeContent: "center", justifyItems: "center", gap: "14px", color: "#526159", fontSize: "13px", fontWeight: 600 }}><span>{loadError}</span><button type="button" className="sd-secondary-btn" onClick={() => setRetryKey((key) => key + 1)}>Retry</button></div></div>;
  }

  return (
    <div className="seedlings-page">
      {/* HEADER */}
      <section className="sd-page-header">
        <div className="sd-title-wrap">
          <div className="sd-title-icon">
            <Sprout
              size={21}
              strokeWidth={1.8}
            />
          </div>

          <div>
            <h1>Saplings</h1>
          </div>
        </div>

        <div className="sd-header-actions">
          {canManage && (
            <button
              type="button"
              className="sd-primary-btn"
              onClick={() =>
                setShowAddModal(true)
              }
            >
              <Plus size={16} />
              Add Sapling
            </button>
          )}

        </div>
      </section>

      {/* KPI */}
      <section className="sd-kpi-grid">
        <KpiCard
          label="Total Saplings"
          value={formatNumber(
            counts.totalSeedlings
          )}
          note="All sapling records"
          icon={Sprout}
          variant="green"
        />

        <KpiCard
          label="Available"
          value={formatNumber(
            counts.available
          )}
          note="Available stocks"
          icon={PackageOpen}
          variant="blue"
        />

        <KpiCard
          label="Distributed"
          value={formatNumber(
            counts.distributed
          )}
          note="Released saplings"
          icon={Boxes}
          variant="orange"
        />

        <KpiCard
          label="Planted"
          value={formatNumber(
            counts.planted
          )}
          note="Recorded as planted"
          icon={Trees}
          variant="purple"
        />

        <KpiCard
          label="Tree Types"
          value={counts.treeTypes}
          note="Recorded tree types"
          icon={PackageCheck}
          variant="green"
        />

        <KpiCard
          label="Last Updated"
          value={lastUpdated.date}
          note={
            lastUpdated.time ||
            "No records yet"
          }
          icon={CalendarClock}
          variant="cyan"
          dateCard
        />
      </section>

      {/* RECORD CARD */}
      <section className="sd-record-card">
        {/* TABS */}
        <div className="sd-tabs">
          <button
            type="button"
            className={`sd-tab ${
              activeTab === "seedlings"
                ? "active"
                : ""
            }`}
            onClick={() => {
              setActiveTab("seedlings");
              setPage(1);
            }}
          >
            Saplings
          </button>

          <button
            type="button"
            className={`sd-tab ${
              activeTab ===
              "distribution"
                ? "active"
                : ""
            }`}
            onClick={() => {
              setActiveTab(
                "distribution"
              );
              setPage(1);
            }}
          >
            Distribution Records
          </button>
        </div>

        {activeTab === "seedlings" ? (
          <>
            {/* FILTERS */}
            <div className="sd-filter-bar">
              <div className="sd-search">
                <Search size={15} />

                <input
                  type="search"
                  placeholder="Search saplings..."
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(
                      event.target.value
                    );

                    setPage(1);
                  }}
                />
              </div>

              <div className="sd-filter-select">
                <Sprout size={15} />

                <select
                  value={treeFilter}
                  onChange={(event) => {
                    setTreeFilter(
                      event.target.value
                    );

                    setPage(1);
                  }}
                >
                  <option value="">
                    All Tree Names
                  </option>

                  {treeNames.map(
                    (treeName) => (
                      <option
                        key={treeName}
                        value={treeName}
                      >
                        {treeName}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="sd-filter-select">
                <PackageCheck size={15} />

                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(
                      event.target.value
                    );

                    setPage(1);
                  }}
                >
                  <option value="">
                    All Status
                  </option>

                  <option value="Available">
                    Available
                  </option>

                  <option value="Limited">
                    Limited
                  </option>

                  <option value="Out of Stock">
                    Out of Stock
                  </option>
                </select>
              </div>

              <div className="sd-filter-spacer" />

              <div
                className="sd-more-wrap"
                ref={moreMenuRef}
              >
                <button
                  type="button"
                  className="sd-more-btn"
                  title="More options"
                  onClick={() =>
                    setShowMoreMenu(
                      (previous) =>
                        !previous
                    )
                  }
                >
                  <MoreVertical
                    size={18}
                  />
                </button>

                {showMoreMenu && (
                  <>
                  <button
                    type="button"
                    className="sd-more-backdrop"
                    aria-label="Close more options"
                    onClick={() => setShowMoreMenu(false)}
                  />
                  <div
                    className="sd-more-menu"
                    role="dialog"
                    aria-label="Sapling filter actions"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        resetFilters();

                        setShowMoreMenu(
                          false
                        );
                      }}
                    >
                      <RotateCcw
                        size={15}
                      />

                      <div>
                        <strong>
                          Reset Filters
                        </strong>

                        <span>
                          Clear search and
                          filters
                        </span>
                      </div>
                    </button>

                  </div>
                  </>
                )}
              </div>
            </div>

            {/* TABLE */}
            <div className="sd-table-scroll">
              <table className="sd-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>BATCH / REFERENCE NO.</th>
                    <th>TREE NAME</th>
                    <th>SCIENTIFIC NAME</th>
                    <th>CATEGORY</th>
                    <th>CURRENT QUANTITY</th>
                    <th>STOCK STATUS</th>
                    <th>SOURCE TYPE</th>
                    <th>DATE RECEIVED</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedSeedlings.map(
                    (
                      seedling,
                      index
                    ) => {
                      return (
                        <tr
                          key={
                            seedling.id
                          }
                        >
                          <td>
                            {pageStart +
                              index}
                          </td>

                          <td className="sd-primary-text">{seedling.batchReference || seedling.inventoryNumber || "—"}</td>

                          <td className="sd-primary-text">
                            {
                              seedling.treeName
                            }
                          </td>

                          <td>{seedling.scientificName || "Not yet specified"}</td>
                          <td>{seedling.category === "Other" ? seedling.categorySpecification : seedling.category}</td>
                          <td className="sd-number sd-available-number">{formatNumber(seedling.currentQuantity)}</td>

                          <td>
                            <StatusBadge
                              status={
                                seedling.status
                              }
                            />
                          </td>

                          <td>{seedling.sourceType || "—"}</td>
                          <td>{seedling.dateReceived || "—"}</td>

                          <td>
                            <div className="sd-actions">
                              <button
                                type="button"
                                className="sd-icon-action view"
                                title="View details"
                                onClick={() =>
                                  openDetails(
                                    seedling
                                  )
                                }
                              >
                                <Eye
                                  size={
                                    15
                                  }
                                />
                              </button>

                              {canManage && (
                                <>
                                  <button
                                    type="button"
                                    className="sd-icon-action edit"
                                    title="Edit sapling"
                                    onClick={() =>
                                      openEdit(
                                        seedling
                                      )
                                    }
                                  >
                                    <Pencil
                                      size={
                                        14
                                      }
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    className="sd-icon-action edit"
                                    title="Add stock"
                                    onClick={() => openAddStock(seedling)}
                                  >
                                    <Plus size={14} />
                                  </button>

                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            {filteredSeedlings.length ===
              0 && (
              <div className="sd-empty-state">
                <div className="sd-empty-icon">
                  <Sprout
                    size={34}
                    strokeWidth={1.6}
                  />
                </div>

                <h2>
                  {seedlings.length === 0
                    ? "No sapling records yet"
                    : "No matching saplings"}
                </h2>

                <p>
                  {seedlings.length === 0
                    ? "Sapling records added by MENRO will appear here."
                    : "Try changing your search or filter settings."}
                </p>
              </div>
            )}

            {/* FOOTER */}
            <div className="sd-table-footer">
              <div className="sd-results-text">
                Showing {pageStart} to{" "}
                {pageEnd} of{" "}
                {
                  filteredSeedlings.length
                }{" "}
                seedlings
              </div>

              <div className="sd-pagination">
                <button
                  type="button"
                  disabled={
                    currentPage === 1
                  }
                  onClick={() =>
                    setPage(
                      (previous) =>
                        Math.max(
                          1,
                          previous - 1
                        )
                    )
                  }
                >
                  <ChevronLeft
                    size={15}
                  />
                </button>

                <button
                  type="button"
                  className="active"
                >
                  {currentPage}
                </button>

                <button
                  type="button"
                  disabled={
                    currentPage >=
                    totalPages
                  }
                  onClick={() =>
                    setPage(
                      (previous) =>
                        Math.min(
                          totalPages,
                          previous + 1
                        )
                    )
                  }
                >
                  <ChevronRight
                    size={15}
                  />
                </button>

                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(
                      Number(
                        event.target
                          .value
                      )
                    );

                    setPage(1);
                  }}
                >
                  <option value={10}>
                    10 / page
                  </option>

                  <option value={20}>
                    20 / page
                  </option>

                  <option value={50}>
                    50 / page
                  </option>
                </select>
              </div>
            </div>
          </>
        ) : distributionLoading ? (
          <div className="sd-distribution-state" role="status">
            Loading distribution records...
          </div>
        ) : distributionError ? (
          <div className="sd-distribution-state" role="alert">
            <span>{distributionError}</span>
            <button
              type="button"
              className="sd-secondary-btn"
              onClick={() => setDistributionRetryKey((key) => key + 1)}
            >
              Retry
            </button>
          </div>
        ) : distributions.length > 0 ? (
          <div className="sd-table-scroll sd-distribution-table-scroll">
            <table className="sd-table sd-distribution-table">
              <thead>
                <tr>
                  <th>DISTRIBUTION ID</th>
                  <th>DATE RELEASED</th>
                  <th>RECIPIENT</th>
                  <th>SAPLINGS RELEASED</th>
                  <th>TOTAL</th>
                  <th>PLANTING SITE</th>
                  <th>RELATED REQUEST</th>
                  <th>RELEASED BY</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {distributions.map((distribution) => {
                  const released = formatDateTime(distribution.releasedAt);

                  return (
                    <tr key={distribution.id}>
                      <td className="sd-primary-text">
                        {distribution.distributionNumber || "—"}
                      </td>
                      <td>
                        <div className="sd-primary-text">{released.date}</div>
                        <div className="sd-secondary-text">{released.time}</div>
                      </td>
                      <td>
                        <div className="sd-primary-text">
                          {distribution.participantName}
                        </div>
                        {distribution.organization &&
                          distribution.organization !== distribution.participantName && (
                            <div className="sd-secondary-text">
                              {distribution.organization}
                            </div>
                          )}
                      </td>
                      <td>
                        <div className="sd-distribution-items">
                          {distribution.items.length > 0 ? (
                            distribution.items.map((item, index) => (
                              <span
                                key={`${distribution.id}-${
                                  item.inventoryId || item.species
                                }-${index}`}
                              >
                                <strong>{item.species}</strong>{" "}
                                {formatNumber(item.quantity)}
                              </span>
                            ))
                          ) : (
                            <span>Item details unavailable</span>
                          )}
                        </div>
                      </td>
                      <td className="sd-number sd-distributed-number">
                        {formatNumber(distribution.totalQuantityReleased)}
                      </td>
                      <td>
                        {distribution.plantingLocation ||
                          distribution.plantingSiteId ||
                          "—"}
                      </td>
                      <td>{distribution.requestNumber || "—"}</td>
                      <td>{distribution.releasedBy || "—"}</td>
                      <td>
                        <StatusBadge status={distribution.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sd-empty-state sd-distribution-empty">
            <div className="sd-empty-icon">
              <Boxes
                size={34}
                strokeWidth={1.6}
              />
            </div>

            <h2>
              No distribution records yet
            </h2>

            <p>
              Sapling distribution
              transactions will appear here
              once records are created.
            </p>
          </div>
        )}
      </section>

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="sd-modal-backdrop">
          <div className="sd-modal">
            <div className="sd-modal-header">
              <div>
                <h2>
                  Add Sapling
                </h2>

                <p>
                  Add a new sapling stock record to the inventory.
                </p>
              </div>

              <button
                type="button"
                className="sd-modal-close"
                onClick={closeAddModal}
              >
                <X size={18} />
              </button>
            </div>


            <form
  className="sd-modal-body"
  onSubmit={handleAddSeedling}
>
  <div className="sd-add-form-sections">

    {/* SEEDLING INFORMATION */}
    <section className="sd-form-section">
      <div className="sd-form-section-heading">
        <h3>Sapling Information</h3>
        <p>
          Basic identification of the sapling.
        </p>
      </div>

      <div className="sd-form-grid">
        <FormField
          label="Tree Name *"
          error={formErrors.treeName}
        >
          <SpeciesCombobox
            value={form.treeName}
            options={speciesOptions}
            onChange={(value) =>
              updateForm(
                "treeName",
                value
              )
            }
          />
        </FormField>

        <FormField label="Scientific Name" hint="Automatically filled when a tree is selected.">
          <input
            type="text"
            value={form.treeName === "Acacia" ? "Not yet specified" : form.scientificName}
            placeholder="Automatically filled based on tree name"
            readOnly
          />
        </FormField>

        <FormField
          label="Category / Type *"
          error={formErrors.category}
          fullWidth
        >
          <select
            value={form.category}
            onChange={(event) =>
              updateForm(
                "category",
                event.target.value
              )
            }
          >
            <option value="">
              Select category / type
            </option>

            {CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </FormField>
        {form.category === "Other" && (
          <FormField label="Please Specify *" error={formErrors.categorySpecification} fullWidth>
            <input type="text" value={form.categorySpecification} placeholder="Enter category / type" onChange={(event) => updateForm("categorySpecification", event.target.value)} />
          </FormField>
        )}
      </div>
    </section>

    {/* INVENTORY INFORMATION */}
    <section className="sd-form-section">
      <div className="sd-form-section-heading">
        <h3>Inventory Information</h3>
        <p>
          Enter the quantity, source, and receiving information.
        </p>
      </div>

      <div className="sd-form-grid">
        <FormField
          label="Initial Quantity *"
          error={formErrors.quantity}
        >
          <input
            type="number"
            min="0"
            step="1"
            value={form.quantity}
            placeholder="Enter initial quantity"
            onChange={(event) =>
              updateForm(
                "quantity",
                event.target.value
              )
            }
          />
        </FormField>

        <FormField label="Stock Status *" error={formErrors.stockStatus}>
          <select value={form.stockStatus} disabled={form.quantity !== "" && Number(form.quantity) === 0} onChange={(event) => updateForm("stockStatus", event.target.value)}>
            {STOCK_STATUS_OPTIONS.map((status) => <option key={status} value={status} disabled={Number(form.quantity) > 0 && status === "Out of Stock"}>{status}</option>)}
          </select>
        </FormField>

        <FormField label="Source Type *" error={formErrors.sourceType}>
          <select
            value={form.sourceType}
            onChange={(event) =>
              updateForm(
                "sourceType",
                event.target.value
              )
            }
          >
            <option value="">Select source type</option>
            {SOURCE_TYPE_OPTIONS.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
        </FormField>

        {form.sourceType === "Other" && (
          <FormField label="Please Specify *" error={formErrors.sourceSpecification}>
            <input type="text" value={form.sourceSpecification} placeholder="Enter source" onChange={(event) => updateForm("sourceSpecification", event.target.value)} />
          </FormField>
        )}

        <FormField
          label="Date Received *"
          error={formErrors.dateReceived}
        >
          <input
            type="date"
            value={form.dateReceived}
            onChange={(event) =>
              updateForm(
                "dateReceived",
                event.target.value
              )
            }
          />
        </FormField>
      </div>
    </section>

    {/* STORAGE INFORMATION */}
    <section className="sd-form-section">
      <div className="sd-form-section-heading">
        <h3>Storage Information</h3>
        <p>
          Specify where the saplings are currently stored.
        </p>
      </div>

      <div className="sd-form-grid">
        <FormField label="Nursery / Storage Location *" error={formErrors.storageLocation}>
          <select value={form.storageLocation} onChange={(event) => updateForm("storageLocation", event.target.value)}>
            <option value="">Select nursery / storage location</option>
            {STORAGE_LOCATION_OPTIONS.map((location) => <option key={location} value={location}>{location}</option>)}
          </select>
        </FormField>

        {form.storageLocation === "Other" && (
          <FormField label="Please Specify *" error={formErrors.storageLocationSpecification}>
            <input type="text" value={form.storageLocationSpecification} placeholder="Enter nursery / storage location" onChange={(event) => updateForm("storageLocationSpecification", event.target.value)} />
          </FormField>
        )}

        <FormField label="Batch / Reference No.">
          <input
            type="text"
            value=""
            placeholder="Automatically generated when saved"
            readOnly
          />
        </FormField>

        <FormField
          label="Description / Notes"
          error={formErrors.description}
          fullWidth
        >
          <textarea
            value={form.description}
            maxLength={500}
            placeholder="Enter additional information about this sapling batch"
            onChange={(event) =>
              updateForm(
                "description",
                event.target.value
              )
            }
          />
        </FormField>
      </div>
    </section>
  </div>

  <div className="sd-modal-footer">
    <button
      type="button"
      className="sd-secondary-btn"
      onClick={closeAddModal}
    >
      Cancel
    </button>

    <button
      type="submit"
      className="sd-primary-btn"
    >
      <Plus size={15} />
      Add Sapling
    </button>
  </div>
</form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal &&
        selectedSeedling && (
          <div className="sd-modal-backdrop">
            <div className="sd-modal">
              <div className="sd-modal-header">
                <div>
                  <span className="sd-detail-id">
                    {
                      selectedSeedling.id
                    }
                  </span>

                  <h2>
                    Update Sapling
                  </h2>

                  <p>
                    Update inventory
                    quantities for{" "}
                    {
                      selectedSeedling.treeName
                    }.
                  </p>
                </div>

                <button
                  type="button"
                  className="sd-modal-close"
                  onClick={() =>
                    setShowEditModal(
                      false
                    )
                  }
                >
                  <X size={18} />
                </button>
              </div>

              <form
                className="sd-modal-body"
                onSubmit={
                  handleUpdateSeedling
                }
              >
                <div className="sd-form-grid">
                  <FormField label="Stock Status *" error={editErrors.stockStatus}>
                    <select
                      value={editForm.stockStatus}
                      disabled={selectedSeedling.currentQuantity <= 0}
                      onChange={(event) => updateEditForm("stockStatus", event.target.value)}
                    >
                      {STOCK_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status} disabled={selectedSeedling.currentQuantity > 0 && status === "Out of Stock"}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    label="Description"
                    error={editErrors.description}
                    fullWidth
                  >
                    <textarea
                      maxLength={500}
                      value={
                        editForm.description
                      }
                      placeholder="Optional description"
                      onChange={(
                        event
                      ) =>
                        updateEditForm(
                          "description",
                          event.target
                            .value
                        )
                      }
                    />
                  </FormField>
                </div>

                <div className="sd-modal-footer">
                  <button
                    type="button"
                    className="sd-secondary-btn"
                    onClick={() =>
                      setShowEditModal(
                        false
                      )
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="sd-primary-btn"
                    disabled={actionLoading}
                  >
                    {actionLoading
                      ? "Saving..."
                      : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {showStockModal && selectedSeedling && (
        <div className="sd-modal-backdrop">
          <div className="sd-modal">
            <div className="sd-modal-header">
              <div>
                <h2>Add Stock</h2>
                <p>{selectedSeedling.treeName} · Current quantity: {formatNumber(selectedSeedling.currentQuantity)}</p>
              </div>
              <button type="button" className="sd-modal-close" onClick={() => setShowStockModal(false)} disabled={actionLoading} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form className="sd-modal-body" onSubmit={handleAddStock}>
              <div className="sd-form-grid">
                <FormField label="Quantity to Add *" error={stockError}>
                  <input type="number" min="1" step="1" value={stockAmount} onChange={(event) => setStockAmount(event.target.value)} />
                </FormField>
              </div>
              <div className="sd-modal-footer">
                <button type="button" className="sd-secondary-btn" onClick={() => setShowStockModal(false)} disabled={actionLoading}>Cancel</button>
                <button type="submit" className="sd-primary-btn" disabled={actionLoading}>{actionLoading ? "Saving..." : "Add Stock"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {showDetailsModal &&
        selectedSeedling && (
          <div className="sd-modal-backdrop">
            <div className="sd-modal sd-details-modal">
              <div className="sd-modal-header">
                <div>
                  <span className="sd-detail-id">
                    {
                      selectedSeedling.id
                    }
                  </span>

                  <h2>
                    Sapling Details
                  </h2>

                  <p>
                    Complete inventory
                    information.
                  </p>
                </div>

                <button
                  type="button"
                  className="sd-modal-close"
                  onClick={() => {
                    openedInventoryFromSearchRef.current = "";
                    setShowDetailsModal(false);
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="sd-modal-body">
                <div className="sd-detail-status">
                  <StatusBadge
                    status={
                      selectedSeedling.status
                    }
                  />
                </div>

                <div className="sd-details-grid">
                  <DetailItem
                    label="Tree Name"
                    value={
                      selectedSeedling.treeName
                    }
                  />

                  <DetailItem
                    label="Scientific Name"
                    value={
                      selectedSeedling.scientificName ||
                      "—"
                    }
                  />

                  <DetailItem
                    label="Category"
                    value={
                      selectedSeedling.category ||
                      "—"
                    }
                  />

                  <DetailItem
                    label="Batch / Reference No."
                    value={selectedSeedling.batchReference || selectedSeedling.inventoryNumber}
                  />

                  <DetailItem
                    label="Initial Quantity"
                    value={formatNumber(
                      selectedSeedling.initialQuantity
                    )}
                  />

                  <DetailItem
                    label="Current Quantity"
                    value={formatNumber(
                      selectedSeedling.currentQuantity
                    )}
                  />

                  <DetailItem
                    label="Distributed"
                    value={formatNumber(
                      selectedSeedling.distributed
                    )}
                  />

                  <DetailItem
                    label="Planted"
                    value={formatNumber(
                      selectedSeedling.planted
                    )}
                  />

                  <DetailItem label="Source Type" value={selectedSeedling.sourceType} />
                  <DetailItem label="Source Specification" value={selectedSeedling.sourceSpecification} />
                  <DetailItem label="Date Received" value={selectedSeedling.dateReceived} />
                  <DetailItem label="Nursery / Storage Location" value={selectedSeedling.storageLocation} />
                  <DetailItem label="Storage Specification" value={selectedSeedling.storageLocationSpecification} />
                </div>

                {selectedSeedling.description && (
                  <div className="sd-detail-description">
                    <span>
                      Description
                    </span>

                    <p>
                      {
                        selectedSeedling.description
                      }
                    </p>
                  </div>
                )}
              </div>

              <div className="sd-modal-footer sd-details-footer">
                <button
                  type="button"
                  className="sd-secondary-btn"
                  onClick={() => {
                    openedInventoryFromSearchRef.current = "";
                    setShowDetailsModal(false);
                  }}
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

function KpiCard({
  label,
  value,
  note,
  icon: Icon,
  variant,
  dateCard = false,
}) {
  return (
    <div className="sd-kpi-card">
      <div
        className={`sd-kpi-icon ${variant}`}
      >
        <Icon
          size={24}
          strokeWidth={1.8}
        />
      </div>

      <div>
        <span className="sd-kpi-label">
          {label}
        </span>

        <strong
          className={`sd-kpi-value ${
            dateCard
              ? "sd-kpi-date-value"
              : ""
          }`}
        >
          {value}
        </strong>

        <span className="sd-kpi-note">
          {note}
        </span>
      </div>
    </div>
  );
}

function FormField({
  label,
  error,
  hint,
  fullWidth = false,
  children,
}) {
  return (
    <label
      className={`sd-form-field ${
        fullWidth ? "full-width" : ""
      }`}
    >
      <span>{label}</span>

      {children}

      {hint && !error && (
        <small className="sd-field-hint">{hint}</small>
      )}

      {error && (
        <small className="sd-field-error">
          {error}
        </small>
      )}
    </label>
  );
}

function SpeciesCombobox({ value, options, onChange }) {
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [opensUpward, setOpensUpward] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filteredOptions = useMemo(() => {
    const query = String(value || "").trim().toLowerCase();
    if (!query) return options;
    return options.filter((species) =>
      String(species.treeName || "").toLowerCase().includes(query));
  }, [options, value]);

  const openList = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpensUpward(spaceBelow < 220 && rect.top > spaceBelow);
    }
    setOpen(true);
    setActiveIndex(-1);
  };

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideInteraction = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    return () => document.removeEventListener("pointerdown", closeOnOutsideInteraction);
  }, [open]);

  const selectOption = (species) => {
    onChange(species.treeName);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        if (filteredOptions.length === 0) return -1;
        if (current < 0) return direction > 0 ? 0 : filteredOptions.length - 1;
        return (current + direction + filteredOptions.length) % filteredOptions.length;
      });
      return;
    }
    if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      selectOption(filteredOptions[activeIndex]);
    }
  };

  return (
    <div className={`sd-species-combobox${opensUpward ? " opens-upward" : ""}`} ref={wrapperRef}>
      <input
        ref={inputRef}
        type="search"
        value={value}
        placeholder="Select tree name"
        autoComplete="off"
        role="combobox"
        aria-label="Tree Name"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="menro-sapling-species-listbox"
        aria-activedescendant={activeIndex >= 0 ? `menro-species-option-${activeIndex}` : undefined}
        onFocus={openList}
        onClick={openList}
        onChange={(event) => {
          onChange(event.target.value);
          if (!open) openList();
        }}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="sd-combobox-toggle"
        aria-label={open ? "Close tree name options" : "Open tree name options"}
        tabIndex={-1}
        onClick={() => {
          if (open) setOpen(false);
          else {
            openList();
            inputRef.current?.focus();
          }
        }}
      >
        <ChevronDown size={18} />
      </button>
      {open && (
        <div className="sd-combobox-list" id="menro-sapling-species-listbox" role="listbox">
          {filteredOptions.length > 0 ? filteredOptions.map((species, index) => (
            <div
              id={`menro-species-option-${index}`}
              key={species.treeName}
              className={`sd-combobox-option${index === activeIndex ? " is-active" : ""}${species.treeName === value ? " is-selected" : ""}`}
              role="option"
              aria-selected={species.treeName === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(species)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              {species.treeName}
            </div>
          )) : (
            <div className="sd-combobox-empty">No matching tree names.</div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailItem({
  label,
  value,
}) {
  return (
    <div className="sd-detail-item">
      <span>{label}</span>

      <strong>
        {value || "—"}
      </strong>
    </div>
  );
}
