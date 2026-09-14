import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sprout,
  Plus,
  Download,
  Search,
  PackageCheck,
  PackageOpen,
  Trees,
  CalendarClock,
  Eye,
  Pencil,
  Archive,
  X,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  RotateCcw,
  CircleCheckBig,
  Boxes,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase/config";

import "../styles/seedlings.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ARCHIVE_STORAGE_KEY = "menro_seedlings_archive";

function getStoredArray(key) {
  try {
    const stored = localStorage.getItem(key);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getStoredArchivedSeedlings() {
  return getStoredArray(ARCHIVE_STORAGE_KEY);
}

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
    treeName:
      item.species ||
      item.treeName ||
      "",
    scientificName:
      item.scientificName || "",
    category:
      item.category || "",
    quantity:
      Number(item.quantity || 0),
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
    lowStockThreshold:
      item.lowStockThreshold ?? 20,
    sourceNursery:
      item.sourceNursery || "",
    dateReceived:
      item.dateReceived || "",
    storageLocation:
      item.storageLocation || "",
    batchReference:
      item.batchReference || "",
    description:
      item.description || "",
    status:
      item.status || "Available",
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

    quantity: "",
    lowStockThreshold: "",

    sourceNursery: "",
    dateReceived: "",

    storageLocation: "",
    batchReference: "",

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
  const { userRole } = useAuth();

  const canManage =
    userRole === "admin";

  const [seedlings, setSeedlings] =
    useState([]);

  const [archivedSeedlings, setArchivedSeedlings] =
    useState(getStoredArchivedSeedlings);

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

  const [showDetailsModal, setShowDetailsModal] =
    useState(false);

  const [showArchiveModal, setShowArchiveModal] =
    useState(false);

  const [selectedSeedling, setSelectedSeedling] =
    useState(null);

  const [form, setForm] =
    useState(getInitialForm);

  const [formErrors, setFormErrors] =
    useState({});

  const [editForm, setEditForm] =
    useState({
      quantity: "",
      available: "",
      distributed: "",
      planted: "",
      description: "",
    });

  const [successMessage, setSuccessMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

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

  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      setLoading(true);
      setErrorMessage("");

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
          setSeedlings([]);
          setErrorMessage(
            error.message ||
              "Unable to load seedling inventory."
          );
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
  }, []);

  useEffect(() => {
    localStorage.setItem(
      ARCHIVE_STORAGE_KEY,
      JSON.stringify(archivedSeedlings)
    );
  }, [archivedSeedlings]);

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
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setFormErrors((previous) => ({
      ...previous,
      [field]: "",
    }));
  };

  const validateForm = () => {
    const errors = {};

    if (!form.treeName.trim()) {
      errors.treeName =
        "Tree name is required.";
    } else if (
      form.treeName.trim().length > 100
    ) {
      errors.treeName =
        "Tree name must not exceed 100 characters.";
    }

    if (!form.category) {
      errors.category =
        "Category / type is required.";
    }

    const quantity =
      Number(form.quantity);

    if (!form.quantity) {
      errors.quantity =
        "Initial quantity is required.";
    } else if (
      !Number.isInteger(quantity)
    ) {
      errors.quantity =
        "Initial quantity must be a whole number.";
    } else if (quantity <= 0) {
      errors.quantity =
        "Initial quantity must be greater than zero.";
    }

    if (
      form.lowStockThreshold !== ""
    ) {
      const threshold =
        Number(
          form.lowStockThreshold
        );

      if (
        !Number.isInteger(
          threshold
        )
      ) {
        errors.lowStockThreshold =
          "Threshold must be a whole number.";
      } else if (
        threshold < 0
      ) {
        errors.lowStockThreshold =
          "Threshold cannot be negative.";
      } else if (
        form.quantity &&
        threshold > quantity
      ) {
        errors.lowStockThreshold =
          "Threshold cannot exceed the initial quantity.";
      }
    }

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

  const showSuccess = (message) => {
    setErrorMessage("");
    setSuccessMessage(message);

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);
  };

  const showError = (message) => {
    setSuccessMessage("");
    setErrorMessage(message);

    window.setTimeout(() => {
      setErrorMessage("");
    }, 4500);
  };

  const handleAddSeedling = async (event) => {
    event.preventDefault();

    const errors =
      validateForm();

    if (
      Object.keys(errors).length >
      0
    ) {
      setFormErrors(errors);
      showError(
        "Please correct the highlighted fields before adding the seedling record."
      );
      return;
    }

    setActionLoading(true);
    setErrorMessage("");

    try {
      const quantity =
        Number(form.quantity);

      const response =
        await apiRequest(
          "/inventory",
          {
            method: "POST",
            body: JSON.stringify({
              species:
                form.treeName.trim(),
              category:
                form.category,
              quantity,
              description:
                form.description.trim(),

              // Extra metadata is included
              // for forward compatibility.
              scientificName:
                form.scientificName.trim(),
              lowStockThreshold:
                form.lowStockThreshold === ""
                  ? Math.ceil(
                      quantity * 0.3
                    )
                  : Number(
                      form.lowStockThreshold
                    ),
              sourceNursery:
                form.sourceNursery.trim(),
              dateReceived:
                form.dateReceived,
              storageLocation:
                form.storageLocation.trim(),
              batchReference:
                form.batchReference.trim(),
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
        `${newSeedling.treeName || "Seedling"} was added successfully.`
      );
    } catch (error) {
      console.error(error);

      showError(
        error.message ||
          "Unable to add the seedling record."
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
      quantity:
        String(
          seedling.quantity ?? 0
        ),
      available:
        String(
          seedling.available ?? 0
        ),
      distributed:
        String(
          seedling.distributed ?? 0
        ),
      planted:
        String(
          seedling.planted ?? 0
        ),
      description:
        seedling.description || "",
    });

    setEditErrors({});
    setErrorMessage("");
    setShowEditModal(true);
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

    if (!selectedSeedling) {
      return;
    }

    const errors = {};

    if (
      editForm.quantity === ""
    ) {
      errors.quantity =
        "Total quantity is required.";
    } else {
      const quantity =
        Number(
          editForm.quantity
        );

      if (
        !Number.isInteger(
          quantity
        )
      ) {
        errors.quantity =
          "Total quantity must be a whole number.";
      } else if (
        quantity < 0
      ) {
        errors.quantity =
          "Total quantity cannot be negative.";
      } else {
        const reserved =
          Number(
            selectedSeedling.reserved ||
              0
          );

        const distributed =
          Number(
            selectedSeedling.distributed ||
              0
          );

        const committed =
          reserved +
          distributed;

        if (
          quantity < committed
        ) {
          errors.quantity =
            `Total quantity cannot be lower than ${committed} because those seedlings are already reserved or distributed.`;
        }
      }
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
    setErrorMessage("");

    try {
      const response =
        await apiRequest(
          `/inventory/${selectedSeedling.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              quantity:
                Number(
                  editForm.quantity
                ),
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
        `${updatedSeedling.treeName || "Seedling"} was updated successfully. Available stock is now ${updatedSeedling.available}.`
      );
    } catch (error) {
      console.error(error);

      showError(
        error.message ||
          "Unable to update the seedling record."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const archiveSeedling = async (
    seedling
  ) => {
    const confirmed =
      window.confirm(
        `Archive ${seedling.id} - ${seedling.treeName}?`
      );

    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    setErrorMessage("");

    try {
      await apiRequest(
        `/inventory/${seedling.id}`,
        {
          method: "DELETE",
        }
      );

      const archivedRecord = {
        ...seedling,
        archivedAt:
          new Date().toISOString(),
      };

      setArchivedSeedlings(
        (previous) => [
          archivedRecord,
          ...previous.filter(
            (item) =>
              item.id !==
              seedling.id
          ),
        ]
      );

      setSeedlings(
        (previous) =>
          previous.filter(
            (item) =>
              item.id !==
              seedling.id
          )
      );

      setShowDetailsModal(false);
      setSelectedSeedling(null);

      showSuccess(
        `${seedling.treeName} was archived successfully.`
      );
    } catch (error) {
      console.error(error);
      showError(
        error.message ||
          "Unable to archive the seedling record."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const restoreSeedling = async (
    seedlingId
  ) => {
    const archived =
      archivedSeedlings.find(
        (seedling) =>
          seedling.id ===
          seedlingId
      );

    if (!archived) {
      return;
    }

    setActionLoading(true);
    setErrorMessage("");

    try {
      const response =
        await apiRequest(
          "/inventory",
          {
            method: "POST",
            body: JSON.stringify({
              species:
                archived.treeName,
              category:
                archived.category,
              quantity:
                Number(
                  archived.quantity ||
                    0
                ),
              description:
                archived.description ||
                "",
            }),
          }
        );

      const restored =
        normalizeInventoryItem(
          response.data || {}
        );

      setSeedlings(
        (previous) => [
          restored,
          ...previous,
        ]
      );

      setArchivedSeedlings(
        (previous) =>
          previous.filter(
            (seedling) =>
              seedling.id !==
              seedlingId
          )
      );

      showSuccess(
        `${archived.treeName} was restored as an active inventory record.`
      );
    } catch (error) {
      console.error(error);
      showError(
        error.message ||
          "Unable to restore the seedling record."
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

  const handleExport = () => {
    if (seedlings.length === 0) {
      window.alert(
        "There are no seedling records to export."
      );

      return;
    }

    const headers = [
      "Seedling ID",
      "Tree Name",
      "Scientific Name",
      "Category",
      "Quantity",
      "Available",
      "Distributed",
      "Planted",
      "Status",
      "Last Updated",
    ];

    const rows = seedlings.map(
      (seedling) => [
        seedling.id,
        seedling.treeName,
        seedling.scientificName,
        seedling.category,
        seedling.quantity,
        seedling.available,
        seedling.distributed,
        seedling.planted,
        seedling.status,
        seedling.updatedAt,
      ]
    );

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => {
            const text =
              String(value ?? "");

            return `"${text.replaceAll(
              '"',
              '""'
            )}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob =
      new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      "menro-seedlings.csv";

    link.click();

    URL.revokeObjectURL(url);
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
          Loading seedling inventory...
        </div>
      </div>
    );
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
            <h1>Seedlings</h1>

            <p>
              Manage all seedlings and
              distribution records.
            </p>
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
              Add Seedling
            </button>
          )}

          <button
            type="button"
            className="sd-export-btn"
            onClick={handleExport}
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </section>

      {/* SUCCESS */}
      {successMessage && (
        <div className="sd-success-message">
          <CircleCheckBig size={16} />

          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          style={{
            marginBottom: "12px",
            color: "#a12a2a",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* KPI */}
      <section className="sd-kpi-grid">
        <KpiCard
          label="Total Seedlings"
          value={formatNumber(
            counts.totalSeedlings
          )}
          note="All seedling records"
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
          note="Released seedlings"
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
            Seedlings
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
                  placeholder="Search seedlings..."
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

                  <option value="Low Stock">
                    Low Stock
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
                  <div className="sd-more-menu">
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

                    <button
                      type="button"
                      onClick={() => {
                        setShowArchiveModal(
                          true
                        );

                        setShowMoreMenu(
                          false
                        );
                      }}
                    >
                      <Archive size={15} />

                      <div>
                        <strong>
                          Archived Records
                        </strong>

                        <span>
                          {
                            archivedSeedlings.length
                          }{" "}
                          archived
                        </span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* TABLE */}
            <div className="sd-table-scroll">
              <table className="sd-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>
                      SEEDLING DETAILS
                    </th>
                    <th>TREE NAME</th>
                    <th>QUANTITY</th>
                    <th>AVAILABLE</th>
                    <th>DISTRIBUTED</th>
                    <th>PLANTED</th>
                    <th>STATUS</th>
                    <th>
                      LAST UPDATED
                    </th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedSeedlings.map(
                    (
                      seedling,
                      index
                    ) => {
                      const updated =
                        formatDateTime(
                          seedling.updatedAt
                        );

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

                          <td>
                            <div className="sd-seedling-detail">
                              <div className="sd-seedling-thumb">
                                <Sprout
                                  size={
                                    18
                                  }
                                />
                              </div>

                              <div>
                                <strong>
                                  {
                                    seedling.treeName
                                  }
                                </strong>

                                <span>
                                  {seedling.scientificName ||
                                    "No scientific name"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="sd-primary-text">
                            {
                              seedling.treeName
                            }
                          </td>

                          <td className="sd-number">
                            {formatNumber(
                              seedling.quantity
                            )}
                          </td>

                          <td className="sd-number sd-available-number">
                            {formatNumber(
                              seedling.available
                            )}
                          </td>

                          <td className="sd-number sd-distributed-number">
                            {formatNumber(
                              seedling.distributed
                            )}
                          </td>

                          <td className="sd-number sd-planted-number">
                            {formatNumber(
                              seedling.planted
                            )}
                          </td>

                          <td>
                            <StatusBadge
                              status={
                                seedling.status
                              }
                            />
                          </td>

                          <td>
                            <div className="sd-primary-text">
                              {
                                updated.date
                              }
                            </div>

                            <div className="sd-secondary-text">
                              {
                                updated.time
                              }
                            </div>
                          </td>

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
                                    title="Edit seedling"
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
                                    className="sd-icon-action archive"
                                    title="Archive record"
                                    onClick={() =>
                                      archiveSeedling(
                                        seedling
                                      )
                                    }
                                  >
                                    <Archive
                                      size={
                                        14
                                      }
                                    />
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
                    ? "No seedling records yet"
                    : "No matching seedlings"}
                </h2>

                <p>
                  {seedlings.length === 0
                    ? "Seedling records added by MENRO will appear here."
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
              Seedling distribution
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
                  Add Seedling
                </h2>

                <p>
                  Add a new tree seedling
                  record to the inventory.
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
        <h3>Seedling Information</h3>
        <p>
          Basic identification of the seedling record.
        </p>
      </div>

      <div className="sd-form-grid">
        <FormField
          label="Tree Name *"
          error={formErrors.treeName}
        >
          <input
            type="text"
            value={form.treeName}
            maxLength={100}
            placeholder="e.g. Narra"
            onChange={(event) =>
              updateForm(
                "treeName",
                event.target.value
              )
            }
          />
        </FormField>

        <FormField label="Scientific Name">
          <input
            type="text"
            value={form.scientificName}
            placeholder="e.g. Pterocarpus indicus"
            onChange={(event) =>
              updateForm(
                "scientificName",
                event.target.value
              )
            }
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

            <option value="Native Tree">
              Native Tree
            </option>

            <option value="Fruit Tree">
              Fruit Tree
            </option>

            <option value="Hardwood">
              Hardwood
            </option>

            <option value="Mangrove">
              Mangrove
            </option>

            <option value="Ornamental">
              Ornamental
            </option>

            <option value="Other">
              Other
            </option>
          </select>
        </FormField>
      </div>
    </section>

    {/* INVENTORY INFORMATION */}
    <section className="sd-form-section">
      <div className="sd-form-section-heading">
        <h3>Inventory Information</h3>
        <p>
          Initial quantity and receiving information.
        </p>
      </div>

      <div className="sd-form-grid">
        <FormField
          label="Initial Quantity *"
          error={formErrors.quantity}
        >
          <input
            type="number"
            min="1"
            step="1"
            value={form.quantity}
            placeholder="e.g. 500"
            onChange={(event) =>
              updateForm(
                "quantity",
                event.target.value
              )
            }
          />
        </FormField>

        <FormField
          label="Low Stock Threshold"
          error={
            formErrors.lowStockThreshold
          }
        >
          <input
            type="number"
            min="0"
            step="1"
            value={form.lowStockThreshold}
            placeholder="e.g. 50"
            onChange={(event) =>
              updateForm(
                "lowStockThreshold",
                event.target.value
              )
            }
          />
        </FormField>

        <FormField label="Source / Nursery">
          <input
            type="text"
            value={form.sourceNursery}
            placeholder="e.g. MENRO Nursery"
            onChange={(event) =>
              updateForm(
                "sourceNursery",
                event.target.value
              )
            }
          />
        </FormField>

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
          Optional nursery and reference information.
        </p>
      </div>

      <div className="sd-form-grid">
        <FormField label="Nursery / Storage Location">
          <input
            type="text"
            value={form.storageLocation}
            placeholder="e.g. Main MENRO Nursery"
            onChange={(event) =>
              updateForm(
                "storageLocation",
                event.target.value
              )
            }
          />
        </FormField>

        <FormField label="Batch / Reference No.">
          <input
            type="text"
            value={form.batchReference}
            placeholder="e.g. BATCH-2026-001"
            onChange={(event) =>
              updateForm(
                "batchReference",
                event.target.value
              )
            }
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
            placeholder="Enter optional notes about these seedlings"
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
      Add Seedling
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
                    Update Seedling
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
                  <FormField label="Total Quantity" error={editErrors.quantity}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        editForm.quantity
                      }
                      onChange={(
                        event
                      ) =>
                        updateEditForm(
                          "quantity",
                          event.target
                            .value
                        )
                      }
                    />
                  </FormField>

                  <FormField label="Available (Auto-calculated)">
                    <input
                      type="number"
                      min="0"
                      value={
                        editForm.available
                      }
                      readOnly
                    />
                  </FormField>

                  <FormField label="Distributed (Read only)">
                    <input
                      type="number"
                      min="0"
                      value={
                        editForm.distributed
                      }
                      readOnly
                    />
                  </FormField>

                  <FormField label="Planted (Read only)">
                    <input
                      type="number"
                      min="0"
                      value={
                        editForm.planted
                      }
                      readOnly
                    />
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
                    Seedling Details
                  </h2>

                  <p>
                    Complete inventory
                    information.
                  </p>
                </div>

                <button
                  type="button"
                  className="sd-modal-close"
                  onClick={() =>
                    setShowDetailsModal(
                      false
                    )
                  }
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
                    label="Total Quantity"
                    value={formatNumber(
                      selectedSeedling.quantity
                    )}
                  />

                  <DetailItem
                    label="Available"
                    value={formatNumber(
                      selectedSeedling.available
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
                {canManage && (
                  <button
                    type="button"
                    className="sd-archive-btn"
                    onClick={() =>
                      archiveSeedling(
                        selectedSeedling
                      )
                    }
                  >
                    <Archive size={14} />
                    Archive
                  </button>
                )}

                <button
                  type="button"
                  className="sd-secondary-btn"
                  onClick={() =>
                    setShowDetailsModal(
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

      {/* ARCHIVE MODAL */}
      {showArchiveModal && (
        <div className="sd-modal-backdrop">
          <div className="sd-modal sd-archive-modal">
            <div className="sd-modal-header">
              <div>
                <h2>
                  Archived Seedlings
                </h2>

                <p>
                  Restore archived inventory
                  records when needed.
                </p>
              </div>

              <button
                type="button"
                className="sd-modal-close"
                onClick={() =>
                  setShowArchiveModal(
                    false
                  )
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="sd-archive-body">
              {archivedSeedlings.length ===
              0 ? (
                <div className="sd-archive-empty">
                  <Archive
                    size={30}
                    strokeWidth={1.5}
                  />

                  <h3>
                    No archived records
                  </h3>

                  <p>
                    Archived seedlings will
                    appear here.
                  </p>
                </div>
              ) : (
                archivedSeedlings.map(
                  (seedling) => (
                    <div
                      className="sd-archive-item"
                      key={
                        seedling.id
                      }
                    >
                      <div>
                        <strong>
                          {
                            seedling.id
                          }
                        </strong>

                        <span>
                          {
                            seedling.treeName
                          }
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          restoreSeedling(
                            seedling.id
                          )
                        }
                      >
                        Restore
                      </button>
                    </div>
                  )
                )
              )}
            </div>

            <div className="sd-modal-footer">
              <button
                type="button"
                className="sd-secondary-btn"
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

      {error && (
        <small className="sd-field-error">
          {error}
        </small>
      )}
    </label>
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