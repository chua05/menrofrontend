import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Sprout,
  ClipboardList,
  Clock3,
  Eye,
  UserRoundCheck,
  CircleCheckBig,
  CircleX,
  CalendarDays,
  Plus,
  Search,
  MapPin,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Minus,
  MoreVertical,
  Archive,
  ArchiveRestore,
  History,
  Check,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

import "../styles/seedling-requests.css";

const STORAGE_KEY = "menro_seedling_requests";
const ARCHIVE_STORAGE_KEY = "menro_seedling_requests_archive";

const TABS = [
  { id: "all", label: "All Requests" },
  {
    id: "pending",
    label: "Pending Review",
    status: "Pending Review",
  },
  {
    id: "under-review",
    label: "Under Review",
    status: "Under Review",
  },
  {
    id: "reviewed",
    label: "Reviewed",
    status: "Reviewed",
  },
  {
    id: "approved",
    label: "Approved",
    status: "Approved",
  },
  {
    id: "rejected",
    label: "Rejected",
    status: "Rejected",
  },
];

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

const PLANTING_SITES_STORAGE_KEY = "menro_planting_sites";
const BARANGAY_GEOJSON_URL = "/data/juban-barangays.geojson";

const REQUEST_TYPES = ["New Planting", "Replacement"];


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

function getStoredRequests() {
  return getStoredArray(STORAGE_KEY);
}

function getStoredArchivedRequests() {
  return getStoredArray(ARCHIVE_STORAGE_KEY);
}

function getStoredPlantingSites() {
  return getStoredArray(PLANTING_SITES_STORAGE_KEY);
}

function getParticipantId(currentUser) {
  return (
    currentUser?.uid ||
    currentUser?.id ||
    currentUser?.email ||
    ""
  );
}

function getPlantingSiteDisplayName(site) {
  return site?.siteName || site?.name || site?.id || "Planting Site";
}

function getPlantingSiteLocationText(site) {
  if (!site) {
    return "";
  }

  const parts = [];

  if (site.locationDescription?.trim()) {
    parts.push(site.locationDescription.trim());
  }

  if (site.barangay) {
    parts.push(`${site.barangay}, Juban, Sorsogon`);
  }

  const latitude = Number(site.latitude);
  const longitude = Number(site.longitude);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    parts.push(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
  }

  return parts.join(" • ");
}

function formatDate(dateString) {
  if (!dateString) return "—";

  const date = new Date(dateString);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTotalSeedlings(trees = []) {
  return trees.reduce(
    (total, tree) => total + Number(tree.quantity || 0),
    0
  );
}

function createRequestId(activeRequests, archivedRequests = []) {
  const year = new Date().getFullYear();

  const allRequests = [
    ...activeRequests,
    ...archivedRequests,
  ];

  const numbers = allRequests
    .map((request) => {
      const match = String(request.id || "").match(/(\d+)$/);

      return match ? Number(match[1]) : 0;
    })
    .filter(Boolean);

  const nextNumber =
    numbers.length > 0
      ? Math.max(...numbers) + 1
      : 1;

  return `SR-${year}-${String(nextNumber).padStart(4, "0")}`;
}

function getInitialForm() {
  return {
    requesterName: "",
    requesterRole: "",
    organization: "",
    contactNumber: "",

    trees: [
      {
        id: crypto.randomUUID(),
        treeName: "",
        quantity: "",
      },
    ],

    purpose: "",
    preferredReleaseDate: "",

    eventName: "",
    eventBarangay: "",
    plantingSite: "",
    eventLocation: "",

    proposedDate: "",
    startTime: "",
    endTime: "",
    expectedParticipants: "",
    eventDescription: "",

    confirmedInformation: false,
  };
}

function StatusBadge({ status }) {
  const className = String(status || "")
    .toLowerCase()
    .replaceAll(" ", "-");

  return (
    <span
      className={`sr-status sr-status-${className}`}
    >
      {status}
    </span>
  );
}

export default function SeedlingRequestsPage() {
  const { userRole, currentUser } = useAuth();

  const [requests, setRequests] =
    useState(getStoredRequests);

  const [archivedRequests, setArchivedRequests] =
    useState(getStoredArchivedRequests);

  const [plantingSites, setPlantingSites] =
    useState(getStoredPlantingSites);

  const [activeTab, setActiveTab] = useState("all");

  const [searchTerm, setSearchTerm] = useState("");
  const [barangayFilter, setBarangayFilter] =
    useState("");
  const [requestTypeFilter, setRequestTypeFilter] =
    useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] =
    useState(false);

  const [showMoreMenu, setShowMoreMenu] =
    useState(false);

  const [showArchiveMode, setShowArchiveMode] =
    useState(false);

  const [showArchivedRecords, setShowArchivedRecords] =
    useState(false);

  const [selectedIds, setSelectedIds] = useState([]);

  const [showNewRequest, setShowNewRequest] =
    useState(false);

  const [selectedRequest, setSelectedRequest] =
    useState(null);

  const [form, setForm] = useState(() =>
    getInitialForm()
  );

  const [formErrors, setFormErrors] = useState({});
  const [successMessage, setSuccessMessage] =
    useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const moreMenuRef = useRef(null);
  const dateFilterRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(requests)
    );
  }, [requests]);

  useEffect(() => {
    localStorage.setItem(
      ARCHIVE_STORAGE_KEY,
      JSON.stringify(archivedRequests)
    );
  }, [archivedRequests]);


  useEffect(() => {
    const handleStorage = (event) => {
      if (
        !event.key ||
        event.key === PLANTING_SITES_STORAGE_KEY
      ) {
        setPlantingSites(getStoredPlantingSites());
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target)
      ) {
        setShowMoreMenu(false);
      }

      if (
        dateFilterRef.current &&
        !dateFilterRef.current.contains(event.target)
      ) {
        setShowDateFilter(false);
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
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return {
      total: requests.length,

      pending: requests.filter(
        (request) =>
          request.status === "Pending Review"
      ).length,

      underReview: requests.filter(
        (request) =>
          request.status === "Under Review"
      ).length,

      reviewed: requests.filter(
        (request) =>
          request.status === "Reviewed"
      ).length,

      approved: requests.filter(
        (request) =>
          request.status === "Approved"
      ).length,

      rejected: requests.filter(
        (request) =>
          request.status === "Rejected"
      ).length,

      thisMonth: requests.filter((request) => {
        if (!request.requestDate) {
          return false;
        }

        const created = new Date(
          request.requestDate
        );

        return (
          created.getMonth() === currentMonth &&
          created.getFullYear() === currentYear
        );
      }).length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const activeConfig = TABS.find(
      (tab) => tab.id === activeTab
    );

    return requests.filter((request) => {
      if (
        activeConfig?.status &&
        request.status !== activeConfig.status
      ) {
        return false;
      }

      if (
        barangayFilter &&
        request.barangay !== barangayFilter
      ) {
        return false;
      }

      if (
        requestTypeFilter &&
        request.requestType !== requestTypeFilter
      ) {
        return false;
      }

      if (dateFrom || dateTo) {
        if (!request.requestDate) {
          return false;
        }

        const requestDate = new Date(
          request.requestDate
        );

        if (dateFrom) {
          const from = new Date(
            `${dateFrom}T00:00:00`
          );

          if (requestDate < from) {
            return false;
          }
        }

        if (dateTo) {
          const to = new Date(
            `${dateTo}T23:59:59`
          );

          if (requestDate > to) {
            return false;
          }
        }
      }

      if (searchTerm.trim()) {
        const search = searchTerm
          .trim()
          .toLowerCase();

        const searchable = [
          request.id,
          request.requesterName,
          request.requesterRole,
          request.barangay,
          request.organization,
          request.requestType,
          request.purpose,
          request.purposeDetails,
          request.status,
          ...(request.trees || []).map(
            (tree) => tree.treeName
          ),
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
    requests,
    activeTab,
    barangayFilter,
    requestTypeFilter,
    dateFrom,
    dateTo,
    searchTerm,
  ]);

  const totalPages = Math.max(
      1,
      Math.ceil(
        filteredRequests.length / pageSize
      )
    );

    const currentPage = Math.min(page, totalPages);

    const paginatedRequests =
      filteredRequests.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      );

    const pageStart =
      filteredRequests.length === 0
        ? 0
        : (currentPage - 1) * pageSize + 1;

    const pageEnd = Math.min(
      currentPage * pageSize,
      filteredRequests.length
    );

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

  const updateTree = (
    treeId,
    field,
    value
  ) => {
    setForm((previous) => ({
      ...previous,

      trees: previous.trees.map((tree) =>
        tree.id === treeId
          ? {
              ...tree,
              [field]: value,
            }
          : tree
      ),
    }));

    setFormErrors((previous) => ({
      ...previous,
      trees: "",
    }));
  };

  const addTreeRow = () => {
    setForm((previous) => ({
      ...previous,

      trees: [
        ...previous.trees,
        {
          id: crypto.randomUUID(),
          treeName: "",
          quantity: "",
        },
      ],
    }));
  };

  const removeTreeRow = (treeId) => {
    setForm((previous) => {
      if (previous.trees.length === 1) {
        return previous;
      }

      return {
        ...previous,

        trees: previous.trees.filter(
          (tree) => tree.id !== treeId
        ),
      };
    });
  };

  const validateForm = () => {
    const errors = {};

    if (!form.requesterName.trim()) {
      errors.requesterName = "Requester name is required.";
    }

    if (!form.organization.trim()) {
      errors.organization = "Organization is required.";
    }

    if (!form.contactNumber.trim()) {
      errors.contactNumber = "Contact number is required.";
    } else if (!/^09\d{9}$/.test(form.contactNumber.replace(/\s/g, ""))) {
      errors.contactNumber = "Enter a valid 11-digit mobile number.";
    }

    const invalidTree = form.trees.some(
      (tree) =>
        !tree.treeName.trim() ||
        !tree.quantity ||
        Number(tree.quantity) <= 0
    );

    if (invalidTree) {
      errors.trees = "Enter a tree name and valid quantity for every row.";
    }

    if (!form.purpose.trim()) {
      errors.purpose = "Purpose / Activity is required.";
    }

    if (!form.preferredReleaseDate) {
      errors.preferredReleaseDate = "Preferred release date is required.";
    }

    if (!form.eventName.trim()) {
      errors.eventName = "Event name is required.";
    }

    if (!form.eventBarangay) {
      errors.eventBarangay = "Barangay is required.";
    }

    if (!form.plantingSite) {
      errors.plantingSite = "Planting site is required.";
    }

    if (!form.proposedDate) {
      errors.proposedDate = "Proposed date is required.";
    }

    if (!form.startTime) {
      errors.startTime = "Start time is required.";
    }

    if (!form.endTime) {
      errors.endTime = "End time is required.";
    } else if (form.startTime && form.endTime <= form.startTime) {
      errors.endTime = "End time must be later than start time.";
    }

    if (!form.expectedParticipants || Number(form.expectedParticipants) < 1) {
      errors.expectedParticipants = "Enter the expected number of participants.";
    }

    if (!form.confirmedInformation) {
      errors.confirmedInformation = "Please confirm that the information is correct.";
    }

    return errors;
  };

  const resetForm = () => {
    setForm(getInitialForm());
    setFormErrors({});
  };

  const closeNewRequestModal = () => {
    setShowNewRequest(false);
    resetForm();
  };

  const handleSubmitRequest = (event) => {
    event.preventDefault();

    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const now = new Date().toISOString();
    const selectedSite =
      plantingSites.find((site) => site.id === form.plantingSite) || null;

    const newRequest = {
      id: createRequestId(requests, archivedRequests),

      requesterName: form.requesterName.trim(),
      requesterRole: form.requesterRole.trim(),
      organization: form.organization.trim(),
      contactNumber: form.contactNumber.trim(),

      barangay: form.eventBarangay,
      requestType: "New Planting",

      trees: form.trees.map((tree) => ({
        treeName: tree.treeName.trim(),
        quantity: Number(tree.quantity),
      })),

      purpose: form.purpose.trim(),
      purposeDetails: "",
      preferredReleaseDate: form.preferredReleaseDate,

      eventName: form.eventName.trim(),
      eventBarangay: form.eventBarangay,
      plantingSiteId: selectedSite?.id || "",
      plantingSiteName: selectedSite ? getPlantingSiteDisplayName(selectedSite) : "",
      plantingSiteLocation: getPlantingSiteLocationText(selectedSite),
      plantingSiteLatitude: selectedSite?.latitude ?? null,
      plantingSiteLongitude: selectedSite?.longitude ?? null,
      proposedDate: form.proposedDate,
      startTime: form.startTime,
      endTime: form.endTime,
      expectedParticipants: Number(form.expectedParticipants),
      eventLocation: getPlantingSiteLocationText(selectedSite),
      eventDescription: form.eventDescription.trim(),
      confirmedInformation: form.confirmedInformation,

      requestDate: now,
      reviewedDate: null,
      approvedDate: null,
      rejectedDate: null,
      status: "Pending Review",
      createdByRole: userRole || "admin",
    };

    setRequests((previous) => [newRequest, ...previous]);
    setActiveTab("all");
    closeNewRequestModal();

    setSuccessMessage(`${newRequest.id} was created successfully.`);

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);
  };

  const updateRequestStatus = (
    requestId,
    status
  ) => {
    const now = new Date().toISOString();

    setRequests((previous) =>
      previous.map((request) => {
        if (request.id !== requestId) {
          return request;
        }

        const updates = { status };

        if (status === "Reviewed") {
          updates.reviewedDate = now;
        }

        if (status === "Approved") {
          updates.approvedDate = now;
        }

        if (status === "Rejected") {
          updates.rejectedDate = now;
        }

        return {
          ...request,
          ...updates,
        };
      })
    );

    setSelectedRequest((previous) => {
      if (
        !previous ||
        previous.id !== requestId
      ) {
        return previous;
      }

      return {
        ...previous,
        status,

        reviewedDate:
          status === "Reviewed"
            ? now
            : previous.reviewedDate,

        approvedDate:
          status === "Approved"
            ? now
            : previous.approvedDate,

        rejectedDate:
          status === "Rejected"
            ? now
            : previous.rejectedDate,
      };
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setBarangayFilter("");
    setRequestTypeFilter("");
    setDateFrom("");
    setDateTo("");
    setActiveTab("all");
    setPage(1);
  };

  const toggleArchiveMode = () => {
    setShowArchiveMode((previous) => {
      const next = !previous;

      if (!next) {
        setSelectedIds([]);
      }

      return next;
    });

    setShowMoreMenu(false);
  };

  const toggleSelectedRequest = (
    requestId
  ) => {
    setSelectedIds((previous) =>
      previous.includes(requestId)
        ? previous.filter(
            (id) => id !== requestId
          )
        : [...previous, requestId]
    );
  };

  const archiveSelectedRequests = () => {
    if (selectedIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Archive ${selectedIds.length} selected request${
        selectedIds.length > 1 ? "s" : ""
      }?`
    );

    if (!confirmed) {
      return;
    }

    const now = new Date().toISOString();

    const toArchive = requests
      .filter((request) =>
        selectedIds.includes(request.id)
      )
      .map((request) => ({
        ...request,
        archivedAt: now,
      }));

    setArchivedRequests((previous) => [
      ...toArchive,
      ...previous,
    ]);

    setRequests((previous) =>
      previous.filter(
        (request) =>
          !selectedIds.includes(request.id)
      )
    );

    setSelectedIds([]);
    setShowArchiveMode(false);
    setPage(1);

    setSuccessMessage(
      `${toArchive.length} request${
        toArchive.length > 1 ? "s were" : " was"
      } archived.`
    );

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);
  };

  const archiveSingleRequest = (
    requestId
  ) => {
    const request = requests.find(
      (item) => item.id === requestId
    );

    if (!request) {
      return;
    }

    const confirmed = window.confirm(
      `Archive ${request.id}? You can restore it later from Archived Records.`
    );

    if (!confirmed) {
      return;
    }

    const archivedRequest = {
      ...request,
      archivedAt:
        new Date().toISOString(),
    };

    setArchivedRequests((previous) => [
      archivedRequest,
      ...previous,
    ]);

    setRequests((previous) =>
      previous.filter(
        (item) => item.id !== requestId
      )
    );

    setSelectedRequest(null);

    setSuccessMessage(
      `${request.id} was archived.`
    );

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);
  };

  const restoreArchivedRequest = (requestId) => {
  const request = archivedRequests.find(
    (item) => item.id === requestId
  );

  if (!request) {
    return;
  }

  const restoredRequest = { ...request };

  delete restoredRequest.archivedAt;

  setRequests((previous) => [
    restoredRequest,
    ...previous,
  ]);

  setArchivedRequests((previous) =>
    previous.filter(
      (item) => item.id !== requestId
    )
  );

  setSuccessMessage(
    `${request.id} was restored.`
  );

  window.setTimeout(() => {
    setSuccessMessage("");
  }, 3000);
};

  const currentTabCount = (tab) => {
    if (tab.id === "all")
      return counts.total;

    if (tab.id === "pending")
      return counts.pending;

    if (tab.id === "under-review")
      return counts.underReview;

    if (tab.id === "reviewed")
      return counts.reviewed;

    if (tab.id === "approved")
      return counts.approved;

    if (tab.id === "rejected")
      return counts.rejected;

    return 0;
  };

  const getDateColumn = () => {
    if (activeTab === "approved") {
      return "APPROVED DATE";
    }

    if (activeTab === "rejected") {
      return "REJECTED DATE";
    }

    return null;
  };

  const secondaryDateColumn =
    getDateColumn();

  const dateRangeLabel =
    dateFrom || dateTo
      ? `${dateFrom || "Start"} — ${
          dateTo || "End"
        }`
      : "Select Date Range";

  const selectedPlantingSite =
    plantingSites.find((site) => site.id === form.plantingSite) || null;

  const plantingSitesForBarangay = plantingSites.filter(
    (site) => site.barangay === form.eventBarangay
  );


  if (userRole === "participant") {
  return (
    <ParticipantSeedlingRequest
      currentUser={currentUser}
    />
  );
}

  return (
    <div className="seedling-requests-page">
      <section className="sr-page-header">
        <div className="sr-title-wrap">
          <div className="sr-title-icon">
            <Sprout
              size={21}
              strokeWidth={1.8}
            />
          </div>

          <div>
            <h1>Seedling Requests</h1>

            <p>
              Manage and review all seedling
              requests from barangays and
              organizations.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="sr-primary-btn"
          onClick={() =>
            setShowNewRequest(true)
          }
        >
          <Plus size={16} />
          New Request
        </button>
      </section>

      {successMessage && (
        <div className="sr-success-message">
          <CircleCheckBig size={16} />
          {successMessage}
        </div>
      )}

      <section className="sr-kpi-grid">
        <KpiCard
          label="Total Requests"
          value={counts.total}
          note="Active requests"
          icon={ClipboardList}
          variant="green"
        />

        <KpiCard
          label="Pending Review"
          value={counts.pending}
          note="Awaiting review"
          icon={Clock3}
          variant="orange"
        />

        <KpiCard
          label="Under Review"
          value={counts.underReview}
          note="Being evaluated"
          icon={Eye}
          variant="blue"
        />

        <KpiCard
          label="Reviewed"
          value={counts.reviewed}
          note="Reviewed by staff"
          icon={UserRoundCheck}
          variant="orange"
        />

        <KpiCard
          label="Approved"
          value={counts.approved}
          note="Successfully approved"
          icon={CircleCheckBig}
          variant="green"
        />

        <KpiCard
          label="Rejected"
          value={counts.rejected}
          note="Not approved"
          icon={CircleX}
          variant="red"
        />

        <KpiCard
          label="This Month"
          value={counts.thisMonth}
          note="New active requests"
          icon={CalendarDays}
          variant="purple"
        />
      </section>

      <section className="sr-record-card">
        <div className="sr-tabs">
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={`sr-tab ${
                activeTab === tab.id
                  ? "active"
                  : ""
              }`}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
            >
              {tab.label}

              {tab.id !== "all" && (
                <span
                  className={`sr-tab-count sr-count-${tab.id}`}
                >
                  {currentTabCount(tab)}
                </span>
              )}

              {tab.id === "all" &&
                counts.total > 0 && (
                  <span className="sr-tab-count sr-count-all">
                    {counts.total}
                  </span>
                )}
            </button>
          ))}
        </div>

        <div className="sr-filter-bar">
          <div className="sr-search">
            <Search size={15} />

            <input
              type="search"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(
                  event.target.value
                );

                setPage(1);
              }}
            />
          </div>

          <FilterSelect
            icon={MapPin}
            value={barangayFilter}
            onChange={(value) => {
              setBarangayFilter(value);
              setPage(1);
            }}
            placeholder="All Barangays"
            options={BARANGAYS}
          />

          <FilterSelect
            icon={ClipboardList}
            value={requestTypeFilter}
            onChange={(value) => {
              setRequestTypeFilter(value);
              setPage(1);
            }}
            placeholder="All Request Types"
            options={REQUEST_TYPES}
          />

          <div
            className="sr-date-filter-wrap"
            ref={dateFilterRef}
          >
            <button
              type="button"
              className={`sr-filter-btn ${
                dateFrom || dateTo
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setShowDateFilter(
                  (previous) => !previous
                )
              }
            >
              <CalendarDays size={15} />

              <span>
                {dateRangeLabel}
              </span>
            </button>

            {showDateFilter && (
              <div className="sr-date-popover">
                <div className="sr-date-popover-head">
                  <div>
                    <strong>
                      Request Date
                    </strong>

                    <span>
                      Filter requests by date
                      range.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowDateFilter(false)
                    }
                  >
                    <X size={15} />
                  </button>
                </div>

                <label className="sr-date-field">
                  <span>From</span>

                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      setDateFrom(
                        event.target.value
                      );
                      setPage(1);
                    }}
                  />
                </label>

                <label className="sr-date-field">
                  <span>To</span>

                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(event) => {
                      setDateTo(
                        event.target.value
                      );
                      setPage(1);
                    }}
                  />
                </label>

                <div className="sr-date-popover-footer">
                  <button
                    type="button"
                    className="sr-date-clear"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setPage(1);
                    }}
                  >
                    Clear dates
                  </button>

                  <button
                    type="button"
                    className="sr-date-done"
                    onClick={() =>
                      setShowDateFilter(false)
                    }
                  >
                    <Check size={14} />
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="sr-filter-spacer" />

          {showArchiveMode && (
            <div className="sr-archive-selection-actions">
              <span>
                {selectedIds.length} selected
              </span>

              <button
                type="button"
                className="sr-cancel-archive-btn"
                onClick={() => {
                  setShowArchiveMode(false);
                  setSelectedIds([]);
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="sr-confirm-archive-btn"
                disabled={
                  selectedIds.length === 0
                }
                onClick={
                  archiveSelectedRequests
                }
              >
                <Archive size={14} />
                Archive
              </button>
            </div>
          )}

          <div
            className="sr-more-wrap"
            ref={moreMenuRef}
          >
            <button
              type="button"
              className="sr-more-btn"
              aria-label="More request options"
              title="More options"
              onClick={() =>
                setShowMoreMenu(
                  (previous) => !previous
                )
              }
            >
              <MoreVertical size={18} />
            </button>

            {showMoreMenu && (
              <div className="sr-more-menu">
                <button
                  type="button"
                  onClick={() => {
                    clearFilters();
                    setShowMoreMenu(false);
                  }}
                >
                  <RotateCcw size={15} />

                  <div>
                    <strong>
                      Reset Filters
                    </strong>

                    <span>
                      Clear search and filters
                    </span>
                  </div>
                </button>

                <div className="sr-more-divider" />

                <button
                  type="button"
                  onClick={toggleArchiveMode}
                >
                  <Archive size={15} />

                  <div>
                    <strong>
                      Archive Records
                    </strong>

                    <span>
                      Select records to archive
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowArchivedRecords(true);
                    setShowMoreMenu(false);
                  }}
                >
                  <History size={15} />

                  <div>
                    <strong>
                      Archived Records
                    </strong>

                    <span>
                      {archivedRequests.length} archived
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="sr-table-scroll">
          <table className="sr-table">
            <thead>
              <tr>
                {showArchiveMode && (
                  <th className="sr-select-column">
                    SELECT
                  </th>
                )}

                <th>#</th>
                <th>REQUEST ID</th>
                <th>REQUESTER</th>
                <th>
                  BARANGAY / ORGANIZATION
                </th>
                <th>REQUEST TYPE</th>
                <th>
                  SEEDLINGS REQUESTED
                </th>
                <th>PURPOSE / ACTIVITY</th>
                <th>REQUEST DATE</th>

                {secondaryDateColumn && (
                  <th>
                    {secondaryDateColumn}
                  </th>
                )}

                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {paginatedRequests.map(
                (request, index) => (
                  <tr key={request.id}>
                    {showArchiveMode && (
                      <td className="sr-select-column">
                        <input
                          type="checkbox"
                          className="sr-record-checkbox"
                          checked={selectedIds.includes(
                            request.id
                          )}
                          onChange={() =>
                            toggleSelectedRequest(
                              request.id
                            )
                          }
                          aria-label={`Select ${request.id}`}
                        />
                      </td>
                    )}

                    <td>
                      {pageStart + index}
                    </td>

                    <td className="sr-request-id">
                      {request.id}
                    </td>

                    <td>
                      <div className="sr-primary-text">
                        {
                          request.requesterName
                        }
                      </div>

                      <div className="sr-secondary-text">
                        {request.requesterRole ||
                          "Requester"}
                      </div>
                    </td>

                    <td>
                      <div className="sr-primary-text">
                        {request.barangay}
                      </div>

                      <div className="sr-secondary-text">
                        {
                          request.organization
                        }
                      </div>
                    </td>

                    <td>
                      <span
                        className={`sr-request-type ${
                          request.requestType ===
                          "Replacement"
                            ? "replacement"
                            : ""
                        }`}
                      >
                        {
                          request.requestType
                        }
                      </span>
                    </td>

                    <td>
                      <div className="sr-tree-list">
                        {(request.trees || []).map(
                          (tree) => (
                            <span
                              key={`${request.id}-${tree.treeName}`}
                            >
                              {tree.treeName} (
                              {tree.quantity})
                            </span>
                          )
                        )}

                        <strong>
                          Total:{" "}
                          {getTotalSeedlings(
                            request.trees
                          )}{" "}
                          seedlings
                        </strong>
                      </div>
                    </td>

                    <td>
                      <div className="sr-primary-text">
                        {request.purpose}
                      </div>

                      <div className="sr-secondary-text">
                        {request.purposeDetails ||
                          "—"}
                      </div>
                    </td>

                    <td>
                      <div className="sr-primary-text">
                        {formatDate(
                          request.requestDate
                        )}
                      </div>

                      <div className="sr-secondary-text">
                        {formatTime(
                          request.requestDate
                        )}
                      </div>
                    </td>

                    {secondaryDateColumn && (
                      <td>
                        <div className="sr-primary-text">
                          {formatDate(
                            activeTab ===
                              "approved"
                              ? request.approvedDate
                              : request.rejectedDate
                          )}
                        </div>

                        <div className="sr-secondary-text">
                          {formatTime(
                            activeTab ===
                              "approved"
                              ? request.approvedDate
                              : request.rejectedDate
                          )}
                        </div>
                      </td>
                    )}

                    <td>
                      <StatusBadge
                        status={request.status}
                      />
                    </td>

                    <td>
                      <div className="sr-actions">
                        <button
                          type="button"
                          className="sr-view-btn"
                          title="View details"
                          onClick={() =>
                            setSelectedRequest(
                              request
                            )
                          }
                        >
                          <Eye size={15} />
                        </button>

                        {userRole ===
                          "admin" &&
                          request.status ===
                            "Reviewed" && (
                            <>
                              <button
                                type="button"
                                className="sr-approve-btn"
                                onClick={() =>
                                  updateRequestStatus(
                                    request.id,
                                    "Approved"
                                  )
                                }
                              >
                                Approve
                              </button>

                              <button
                                type="button"
                                className="sr-reject-btn"
                                onClick={() =>
                                  updateRequestStatus(
                                    request.id,
                                    "Rejected"
                                  )
                                }
                              >
                                Reject
                              </button>
                            </>
                          )}
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {filteredRequests.length === 0 && (
          <div className="sr-empty-state">
            <div className="sr-empty-icon">
              <ClipboardList
                size={37}
                strokeWidth={1.5}
              />

              <Sprout
                size={20}
                strokeWidth={1.8}
              />
            </div>

            <h2>
              {requests.length === 0
                ? "No seedling requests yet"
                : "No matching requests"}
            </h2>

            <p>
              {requests.length === 0
                ? "There are no active seedling requests."
                : "Try changing your search or filter settings."}
            </p>
          </div>
        )}

        <div className="sr-table-footer">
          <div className="sr-results-text">
            Showing {pageStart} to{" "}
            {pageEnd} of{" "}
            {filteredRequests.length}{" "}
            requests
          </div>

          <div className="sr-pagination">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() =>
                setPage((previous) =>
                  Math.max(
                    1,
                    previous - 1
                  )
                )
              }
            >
              <ChevronLeft size={15} />
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
                currentPage >= totalPages
              }
              onClick={() =>
                setPage((previous) =>
                  Math.min(
                    totalPages,
                    previous + 1
                  )
                )
              }
            >
              <ChevronRight size={15} />
            </button>

            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(
                  Number(
                    event.target.value
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
      </section>

      {showNewRequest && (
        <div className="sr-modal-backdrop">
          <div className="sr-modal sr-new-modal">
            <div className="sr-modal-header">
              <div>
                <h2>New Seedling Request</h2>
                <p>Complete the requester and proposed planting event information.</p>
              </div>

              <button
                type="button"
                className="sr-modal-close"
                onClick={closeNewRequestModal}
              >
                <X size={18} />
              </button>
            </div>

            <form className="sr-modal-body" onSubmit={handleSubmitRequest}>
              <div className="sr-form-grid">
                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "14px",
                  }}
                >
                  <FormField label="Requester Name" error={formErrors.requesterName}>
                    <input
                      type="text"
                      value={form.requesterName}
                      placeholder="Enter requester name"
                      onChange={(event) => updateForm("requesterName", event.target.value)}
                    />
                  </FormField>

                  <FormField label="Organization" error={formErrors.organization}>
                    <input
                      type="text"
                      value={form.organization}
                      placeholder="Enter organization"
                      onChange={(event) => updateForm("organization", event.target.value)}
                    />
                  </FormField>

                  <FormField label="Contact Number" error={formErrors.contactNumber}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={11}
                      value={form.contactNumber}
                      placeholder="09XXXXXXXXX"
                      onChange={(event) => updateForm("contactNumber", event.target.value.replace(/\D/g, ""))}
                    />
                  </FormField>
                </div>

                <FormField label="Position / Role" fullWidth>
                  <input
                    type="text"
                    value={form.requesterRole}
                    placeholder="e.g. Barangay Captain"
                    onChange={(event) => updateForm("requesterRole", event.target.value)}
                  />
                </FormField>

                <div className="sr-tree-section">
                  <div className="sr-tree-heading">
                    <div>
                      <h3>Seedlings Requested</h3>
                      <p>Add one or more tree names and quantities.</p>
                    </div>
                  </div>

                  <div className="sr-tree-column-labels">
                    <span>Tree Name</span>
                    <span>Quantity</span>
                    <span />
                  </div>

                  {form.trees.map((tree) => (
                    <div className="sr-tree-row" key={tree.id}>
                      <input
                        type="text"
                        placeholder="Enter tree name"
                        value={tree.treeName}
                        onChange={(event) => updateTree(tree.id, "treeName", event.target.value)}
                      />

                      <input
                        type="number"
                        min="1"
                        placeholder="0"
                        value={tree.quantity}
                        onChange={(event) => updateTree(tree.id, "quantity", event.target.value)}
                      />

                      <button
                        type="button"
                        className="sr-remove-tree"
                        disabled={form.trees.length === 1}
                        onClick={() => removeTreeRow(tree.id)}
                        title="Remove tree"
                      >
                        <Minus size={15} />
                      </button>
                    </div>
                  ))}

                  {formErrors.trees && <div className="sr-field-error">{formErrors.trees}</div>}

                  <button type="button" className="sr-add-tree" onClick={addTreeRow}>
                    <Plus size={14} />
                    Add Another Tree
                  </button>
                </div>

                <FormField label="Purpose / Activity" error={formErrors.purpose}>
                  <input
                    type="text"
                    value={form.purpose}
                    placeholder="Enter purpose or activity"
                    onChange={(event) => updateForm("purpose", event.target.value)}
                  />
                </FormField>

                <FormField label="Preferred Release Date" error={formErrors.preferredReleaseDate}>
                  <input
                    type="date"
                    value={form.preferredReleaseDate}
                    onChange={(event) => updateForm("preferredReleaseDate", event.target.value)}
                  />
                </FormField>

                <div style={{ gridColumn: "1 / -1", marginTop: "2px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#087443", letterSpacing: ".04em", marginBottom: "2px" }}>
                    PROPOSED PLANTING EVENT
                  </div>
                </div>

                <FormField label="Event Name" error={formErrors.eventName} fullWidth>
                  <input
                    type="text"
                    value={form.eventName}
                    placeholder="Enter planting event name"
                    onChange={(event) => updateForm("eventName", event.target.value)}
                  />
                </FormField>

                <FormField label="Barangay" error={formErrors.eventBarangay}>
                  <select
                    value={form.eventBarangay}
                    onChange={(event) => {
                      const barangay = event.target.value;
                      setForm((previous) => ({
                        ...previous,
                        eventBarangay: barangay,
                        plantingSite: "",
                        eventLocation: "",
                      }));
                      setFormErrors((previous) => ({
                        ...previous,
                        eventBarangay: "",
                        plantingSite: "",
                      }));
                    }}
                  >
                    <option value="">Select barangay</option>
                    {BARANGAYS.map((barangay) => (
                      <option key={barangay} value={barangay}>{barangay}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Planting Site" error={formErrors.plantingSite}>
                  <select
                    value={form.plantingSite}
                    disabled={!form.eventBarangay}
                    onChange={(event) => {
                      const siteId = event.target.value;
                      const site = plantingSites.find((item) => item.id === siteId);
                      setForm((previous) => ({
                        ...previous,
                        plantingSite: siteId,
                        eventLocation: getPlantingSiteLocationText(site),
                      }));
                      setFormErrors((previous) => ({ ...previous, plantingSite: "" }));
                    }}
                  >
                    <option value="">{form.eventBarangay ? "Select planting site" : "Select barangay first"}</option>
                    {plantingSitesForBarangay.map((site) => (
                      <option key={site.id} value={site.id}>{site.id} - {getPlantingSiteDisplayName(site)}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Proposed Date" error={formErrors.proposedDate}>
                  <input
                    type="date"
                    value={form.proposedDate}
                    onChange={(event) => updateForm("proposedDate", event.target.value)}
                  />
                </FormField>

                <FormField label="Start Time" error={formErrors.startTime}>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) => updateForm("startTime", event.target.value)}
                  />
                </FormField>

                <FormField label="End Time" error={formErrors.endTime}>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) => updateForm("endTime", event.target.value)}
                  />
                </FormField>

                <FormField label="Expected Participants" error={formErrors.expectedParticipants}>
                  <input
                    type="number"
                    min="1"
                    value={form.expectedParticipants}
                    placeholder="Enter number of participants"
                    onChange={(event) => updateForm("expectedParticipants", event.target.value)}
                  />
                </FormField>

                <FormField label="Event Location" fullWidth>
                  <input
                    type="text"
                    value={selectedPlantingSite?.location || ""}
                    placeholder="Location will appear after the planting site is completed."
                    readOnly
                  />
                </FormField>

                <FormField label="Event Description" fullWidth>
                  <textarea
                    value={form.eventDescription}
                    placeholder="Enter event description"
                    onChange={(event) =>
                      updateForm(
                        "eventDescription",
                        event.target.value
                      )
                    }
                  />
                </FormField>

                <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    id="confirmedInformation"
                    type="checkbox"
                    checked={form.confirmedInformation}
                    onChange={(event) => updateForm("confirmedInformation", event.target.checked)}
                  />
                  <label htmlFor="confirmedInformation" style={{ fontSize: "9.2px", color: "#3b4940", fontWeight: 600 }}>
                    I confirm that the information provided is correct.
                  </label>
                </div>
                {formErrors.confirmedInformation && (
                  <div className="sr-field-error" style={{ gridColumn: "1 / -1" }}>{formErrors.confirmedInformation}</div>
                )}
              </div>

              <div className="sr-modal-footer">
                <button type="button" className="sr-secondary-btn" onClick={closeNewRequestModal}>
                  Cancel
                </button>
                <button type="submit" className="sr-primary-btn">
                  <Plus size={15} />
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedRequest && (
        <div className="sr-modal-backdrop">
          <div className="sr-modal sr-details-modal">
            <div className="sr-modal-header">
              <div>
                <span className="sr-detail-id">
                  {selectedRequest.id}
                </span>

                <h2>
                  Request Details
                </h2>

                <p>
                  Complete information for
                  this seedling request.
                </p>
              </div>

              <button
                type="button"
                className="sr-modal-close"
                onClick={() =>
                  setSelectedRequest(null)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="sr-modal-body">
              <div className="sr-detail-status-line">
                <StatusBadge status={selectedRequest.status} />
              </div>

              <div className="sr-details-grid">
                <DetailItem
                  label="Requester"
                  value={selectedRequest.requesterName}
                  subvalue={selectedRequest.requesterRole || "—"}
                />
                <DetailItem
                  label="Organization"
                  value={selectedRequest.organization}
                  subvalue={selectedRequest.contactNumber || "—"}
                />
                <DetailItem label="Purpose / Activity" value={selectedRequest.purpose} />
                <DetailItem label="Preferred Release Date" value={formatDate(selectedRequest.preferredReleaseDate)} />
                <DetailItem label="Event Name" value={selectedRequest.eventName} fullWidth />
                <DetailItem label="Barangay" value={selectedRequest.eventBarangay || selectedRequest.barangay} />
                <DetailItem
                  label="Planting Site"
                  value={selectedRequest.plantingSiteId || "—"}
                  subvalue={selectedRequest.plantingSiteName || "—"}
                />
                <DetailItem label="Proposed Date" value={formatDate(selectedRequest.proposedDate)} />
                <DetailItem label="Time" value={`${selectedRequest.startTime || "—"} - ${selectedRequest.endTime || "—"}`} />
                <DetailItem label="Expected Participants" value={selectedRequest.expectedParticipants || "—"} />
                <DetailItem label="Event Location" value={selectedRequest.eventLocation || "—"} />
                <DetailItem label="Request Date" value={formatDate(selectedRequest.requestDate)} subvalue={formatTime(selectedRequest.requestDate)} />
              </div>

              

              <div className="sr-detail-seedlings">
                <h3>Seedlings Requested</h3>
                {(selectedRequest.trees || []).map((tree) => (
                  <div className="sr-detail-tree-row" key={`${selectedRequest.id}-${tree.treeName}`}>
                    <span>{tree.treeName}</span>
                    <strong>{tree.quantity}</strong>
                  </div>
                ))}
                <div className="sr-detail-tree-total">
                  <span>Total Seedlings</span>
                  <strong>{getTotalSeedlings(selectedRequest.trees)}</strong>
                </div>
              </div>

              {selectedRequest.eventDescription && (
                <div className="sr-detail-remarks">
                  <span>Event Description</span>
                  <p>{selectedRequest.eventDescription}</p>
                </div>
              )}
            </div>

            <div className="sr-modal-footer sr-details-footer">
              <button
                type="button"
                className="sr-archive-detail-btn"
                onClick={() =>
                  archiveSingleRequest(
                    selectedRequest.id
                  )
                }
              >
                <Archive size={15} />
                Archive
              </button>

              <div className="sr-detail-footer-actions">
                <button
                  type="button"
                  className="sr-secondary-btn"
                  onClick={() =>
                    setSelectedRequest(null)
                  }
                >
                  Close
                </button>

                {userRole === "admin" &&
                  selectedRequest.status ===
                    "Reviewed" && (
                    <>
                      <button
                        type="button"
                        className="sr-reject-btn sr-large-action"
                        onClick={() =>
                          updateRequestStatus(
                            selectedRequest.id,
                            "Rejected"
                          )
                        }
                      >
                        Reject
                      </button>

                      <button
                        type="button"
                        className="sr-approve-btn sr-large-action"
                        onClick={() =>
                          updateRequestStatus(
                            selectedRequest.id,
                            "Approved"
                          )
                        }
                      >
                        Approve
                      </button>
                    </>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showArchivedRecords && (
        <div className="sr-modal-backdrop">
          <div className="sr-modal sr-archive-modal">
            <div className="sr-modal-header">
              <div>
                <h2>
                  Archived Records
                </h2>

                <p>
                  Archived seedling requests
                  can be restored to the
                  active records.
                </p>
              </div>

              <button
                type="button"
                className="sr-modal-close"
                onClick={() =>
                  setShowArchivedRecords(
                    false
                  )
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="sr-archive-modal-body">
              {archivedRequests.length ===
              0 ? (
                <div className="sr-archive-empty">
                  <div className="sr-archive-empty-icon">
                    <Archive
                      size={28}
                      strokeWidth={1.6}
                    />
                  </div>

                  <h3>
                    No archived records
                  </h3>

                  <p>
                    Requests you archive will
                    appear here.
                  </p>
                </div>
              ) : (
                <div className="sr-archive-list">
                  {archivedRequests.map(
                    (request) => (
                      <div
                        className="sr-archive-item"
                        key={request.id}
                      >
                        <div className="sr-archive-item-main">
                          <div className="sr-archive-item-top">
                            <strong>
                              {request.id}
                            </strong>

                            <StatusBadge
                              status={
                                request.status
                              }
                            />
                          </div>

                          <div className="sr-archive-item-title">
                            {
                              request.requesterName
                            }
                          </div>

                          <div className="sr-archive-item-meta">
                            <span>
                              {
                                request.barangay
                              }
                            </span>

                            <span>
                              {
                                request.requestType
                              }
                            </span>

                            <span>
                              Archived{" "}
                              {formatDate(
                                request.archivedAt
                              )}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="sr-restore-btn"
                          onClick={() =>
                            restoreArchivedRequest(
                              request.id
                            )
                          }
                        >
                          <ArchiveRestore
                            size={15}
                          />
                          Restore
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="sr-modal-footer">
              <button
                type="button"
                className="sr-secondary-btn"
                onClick={() =>
                  setShowArchivedRecords(
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
}) {
  return (
    <div className="sr-kpi-card">
      <div
        className={`sr-kpi-icon ${variant}`}
      >
        <Icon
          size={25}
          strokeWidth={1.8}
        />
      </div>

      <div>
        <span className="sr-kpi-label">
          {label}
        </span>

        <strong className="sr-kpi-value">
          {value}
        </strong>

        <span className="sr-kpi-note">
          {note}
        </span>
      </div>
    </div>
  );
}

function FilterSelect({
  icon: Icon,
  value,
  onChange,
  placeholder,
  options,
}) {
  return (
    <div className="sr-filter-select">
      <Icon size={15} />

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      >
        <option value="">
          {placeholder}
        </option>

        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}
      </select>
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
      className={`sr-form-field ${
        fullWidth ? "full-width" : ""
      }`}
    >
      <span>{label}</span>

      {children}

      {error && (
        <small className="sr-field-error">
          {error}
        </small>
      )}
    </label>
  );
}

function DetailItem({
  label,
  value,
  subvalue,
  fullWidth = false,
}) {
  return (
    <div
      className={`sr-detail-item ${
        fullWidth ? "full-width" : ""
      }`}
    >
      <span>{label}</span>

      <strong>
        {value || "—"}
      </strong>

      {subvalue && (
        <small>{subvalue}</small>
      )}
    </div>
  );
}

function ParticipantLocationPreview({ barangay, site }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const boundaryLayerRef = useRef(null);
  const siteLayerRef = useRef(null);
  const [mapError, setMapError] = useState("");

  const panMap = (x, y) => {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.panBy([x, y], {
      animate: true,
      duration: 0.2,
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapContainerRef.current, {
      center: [12.82, 124.0],
      zoom: 12,
      minZoom: 10,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: true,
    });

    const mapTilerKey =
      import.meta.env.VITE_MAPTILER_API_KEY;

    if (mapTilerKey) {
      L.tileLayer(
        `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerKey}`,
        {
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 20,
          crossOrigin: true,
          attribution:
            '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }
      ).addTo(map);
    } else {
      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }
      ).addTo(map);
    }

    mapRef.current = map;

    window.setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => {
      map.remove();
      mapRef.current = null;
      boundaryLayerRef.current = null;
      siteLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function updatePreview() {
      const map = mapRef.current;

      if (!map) {
        return;
      }

      setMapError("");

      if (boundaryLayerRef.current) {
        map.removeLayer(boundaryLayerRef.current);
        boundaryLayerRef.current = null;
      }

      if (siteLayerRef.current) {
        map.removeLayer(siteLayerRef.current);
        siteLayerRef.current = null;
      }

      let jubanBounds = null;
      let selectedBarangayBounds = null;

      try {
        const response = await fetch(
          BARANGAY_GEOJSON_URL
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load barangay boundaries (${response.status}).`
          );
        }

        const geoJson = await response.json();

        if (cancelled || !mapRef.current) {
          return;
        }

        const normalizeBarangayName = (value) =>
          String(value || "")
            .trim()
            .toLowerCase();

        const getFeatureBarangayName = (feature) =>
          feature?.properties?.brgy_name ||
          feature?.properties?.barangay ||
          feature?.properties?.name ||
          feature?.properties?.NAME ||
          "";

        const selectedBarangayName =
          normalizeBarangayName(barangay);

        const boundaryLayer = L.geoJSON(
          geoJson,
          {
            style: (feature) => {
              const featureBarangayName =
                normalizeBarangayName(
                  getFeatureBarangayName(feature)
                );

              const isSelected =
                selectedBarangayName &&
                featureBarangayName ===
                  selectedBarangayName;

              return {
                color: isSelected
                  ? "#087443"
                  : "#48725c",
                weight: isSelected ? 3 : 1.4,
                opacity: 1,
                fillColor: isSelected
                  ? "#76c893"
                  : "#dff2e5",
                fillOpacity: isSelected
                  ? 0.32
                  : 0.12,
              };
            },
            interactive: false,
            onEachFeature: (feature, layer) => {
              const featureBarangay =
                getFeatureBarangayName(feature);

              if (featureBarangay) {
                layer.bindTooltip(
                  String(featureBarangay),
                  {
                    permanent: true,
                    direction: "center",
                    className:
                      "participant-barangay-label participant-barangay-label-plain",
                    interactive: false,
                    opacity: 1,
                  }
                );
              }

              const isSelected =
                selectedBarangayName &&
                normalizeBarangayName(
                  featureBarangay
                ) === selectedBarangayName;

              if (
                isSelected &&
                typeof layer.getBounds === "function"
              ) {
                const bounds = layer.getBounds();

                if (bounds.isValid()) {
                  selectedBarangayBounds =
                    selectedBarangayBounds
                      ? selectedBarangayBounds.extend(
                          bounds
                        )
                      : L.latLngBounds(bounds);
                }
              }
            },
          }
        ).addTo(map);

        boundaryLayerRef.current =
          boundaryLayer;

        const bounds =
          boundaryLayer.getBounds();

        if (bounds.isValid()) {
          jubanBounds = bounds;
        }
      } catch (error) {
        console.error(
          "Unable to load Juban barangay preview:",
          error
        );

        setMapError(
          "Juban barangay boundary preview is unavailable."
        );
      }

      const latitude = Number(site?.latitude);
      const longitude = Number(site?.longitude);

      if (
        site &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
      ) {
        const group =
          L.layerGroup().addTo(map);

        const polygonPath = Array.isArray(
          site.polygon
        )
          ? site.polygon
              .filter(
                (point) =>
                  Number.isFinite(
                    Number(point.lat)
                  ) &&
                  Number.isFinite(
                    Number(point.lng)
                  )
              )
              .map((point) => [
                Number(point.lat),
                Number(point.lng),
              ])
          : [];

        if (polygonPath.length >= 3) {
          L.polygon(polygonPath, {
            color: "#065f3d",
            weight: 2.5,
            fillColor: "#2f9e63",
            fillOpacity: 0.3,
          }).addTo(group);
        }

        L.circleMarker(
          [latitude, longitude],
          {
            radius: 8,
            color: "#ffffff",
            weight: 3,
            fillColor: "#087443",
            fillOpacity: 1,
          }
        )
          .bindTooltip(
            getPlantingSiteDisplayName(site),
            {
              permanent: false,
              direction: "top",
            }
          )
          .addTo(group);

        siteLayerRef.current = group;

        map.setView(
          [latitude, longitude],
          16,
          { animate: false }
        );
      } else if (
        barangay &&
        selectedBarangayBounds?.isValid()
      ) {
        map.fitBounds(
          selectedBarangayBounds,
          {
            padding: [28, 28],
            maxZoom: 14,
            animate: false,
          }
        );
      } else if (jubanBounds?.isValid()) {
        map.fitBounds(
          jubanBounds.pad(0.05),
          {
            padding: [18, 18],
            maxZoom: 12,
            animate: false,
          }
        );
      } else {
        map.setView(
          [12.82, 124.0],
          12,
          { animate: false }
        );
      }

      window.setTimeout(() => {
        map.invalidateSize();
      }, 0);
    }

    updatePreview();

    return () => {
      cancelled = true;
    };
  }, [barangay, site]);

  return (
    <div
      className="participant-location-preview"
      style={{
        position: "relative",
        width: "100%",
        minHeight: "320px",
        border: "1px solid #dfe8e2",
        borderRadius: "10px",
        overflow: "hidden",
        background: "#f7faf8",
      }}
    >
      <style>{`
        .participant-barangay-label-plain {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: #263a2f !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          padding: 0 !important;
          white-space: nowrap !important;
        }

        .participant-barangay-label-plain::before {
          display: none !important;
        }
      `}</style>

      <div
        ref={mapContainerRef}
        className="participant-location-map"
        style={{
          width: "100%",
          height: "320px",
        }}
      />

      {!barangay && (
        <div
          className="participant-location-map-hint"
          style={{
            position: "absolute",
            left: "12px",
            right: "12px",
            bottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "9px 11px",
            borderRadius: "8px",
            background:
              "rgba(255, 255, 255, 0.94)",
            border: "1px solid #dfe8e2",
            color: "#526159",
            fontSize: "12px",
            fontWeight: 600,
            pointerEvents: "none",
            zIndex: 500,
          }}
        >
          <MapPin size={16} />
          <span>
            Select a barangay. All Juban barangay
            boundaries are shown on the map.
          </span>
        </div>
      )}

      {barangay && !site && (
        <div
          className="participant-location-map-hint"
          style={{
            position: "absolute",
            left: "12px",
            right: "12px",
            bottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "9px 11px",
            borderRadius: "8px",
            background:
              "rgba(255, 255, 255, 0.94)",
            border: "1px solid #dfe8e2",
            color: "#526159",
            fontSize: "12px",
            fontWeight: 600,
            pointerEvents: "none",
            zIndex: 500,
          }}
        >
          <MapPin size={16} />
          <span>
            {barangay} is highlighted. Select a
            registered planting site to show its
            exact marker.
          </span>
        </div>
      )}

      <div
        className="participant-map-pan-controls"
        style={{
          position: "absolute",
          right: "12px",
          bottom: "58px",
          zIndex: 500,
          display: "grid",
          gridTemplateColumns: "34px 34px 34px",
          gridTemplateRows: "34px 34px 34px",
          gap: "4px",
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
          aria-label="Move map up"
          title="Move map up"
          onClick={() => panMap(0, -120)}
          style={{
            gridColumn: "2",
            gridRow: "1",
            width: "34px",
            height: "34px",
            display: "grid",
            placeItems: "center",
            border: "1px solid #cfdad3",
            borderRadius: "7px",
            background: "rgba(255, 255, 255, 0.96)",
            color: "#2f4638",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
          }}
        >
          <ChevronUp size={18} />
        </button>

        <button
          type="button"
          aria-label="Move map left"
          title="Move map left"
          onClick={() => panMap(-120, 0)}
          style={{
            gridColumn: "1",
            gridRow: "2",
            width: "34px",
            height: "34px",
            display: "grid",
            placeItems: "center",
            border: "1px solid #cfdad3",
            borderRadius: "7px",
            background: "rgba(255, 255, 255, 0.96)",
            color: "#2f4638",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
          }}
        >
          <ChevronLeft size={18} />
        </button>

        <button
          type="button"
          aria-label="Move map right"
          title="Move map right"
          onClick={() => panMap(120, 0)}
          style={{
            gridColumn: "3",
            gridRow: "2",
            width: "34px",
            height: "34px",
            display: "grid",
            placeItems: "center",
            border: "1px solid #cfdad3",
            borderRadius: "7px",
            background: "rgba(255, 255, 255, 0.96)",
            color: "#2f4638",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
          }}
        >
          <ChevronRight size={18} />
        </button>

        <button
          type="button"
          aria-label="Move map down"
          title="Move map down"
          onClick={() => panMap(0, 120)}
          style={{
            gridColumn: "2",
            gridRow: "3",
            width: "34px",
            height: "34px",
            display: "grid",
            placeItems: "center",
            border: "1px solid #cfdad3",
            borderRadius: "7px",
            background: "rgba(255, 255, 255, 0.96)",
            color: "#2f4638",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
          }}
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {mapError && (
        <div
          className="participant-location-map-error"
          style={{
            position: "absolute",
            top: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 500,
            padding: "8px 10px",
            borderRadius: "8px",
            background:
              "rgba(255, 255, 255, 0.96)",
            border: "1px solid #ead8d8",
            color: "#9d3434",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          {mapError}
        </div>
      )}
    </div>
  );
}

function ParticipantSeedlingRequest({ currentUser }) {
  const [form, setForm] = useState(() => ({
    requesterName:
      currentUser?.displayName ||
      currentUser?.fullName ||
      currentUser?.name ||
      "",

    requesterRole:
      currentUser?.role === "participant"
        ? "Participant"
        : currentUser?.role || "Participant",

    organization:
      currentUser?.organization ||
      currentUser?.barangay ||
      "",

    contactNumber:
      currentUser?.contactNumber ||
      currentUser?.phoneNumber ||
      currentUser?.phone ||
      "",

    trees: [
      {
        id: crypto.randomUUID(),
        treeName: "",
        quantity: "",
      },
    ],

    purpose: "",
    preferredReleaseDate: "",

    eventName: "",
    eventBarangay:
      currentUser?.barangay || "",
    plantingSite: "",
    proposedDate: "",
    startTime: "",
    endTime: "",
    expectedParticipants: "",
    eventLocation: "",
    eventDescription: "",

    confirmedInformation: false,
  }));

  const [formErrors, setFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [plantingSites, setPlantingSites] =
    useState(getStoredPlantingSites);

  useEffect(() => {
    const handleStorage = (event) => {
      if (
        !event.key ||
        event.key === PLANTING_SITES_STORAGE_KEY
      ) {
        setPlantingSites(getStoredPlantingSites());
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const plantingSitesForBarangay = plantingSites.filter(
    (site) =>
      site.barangay === form.eventBarangay
  );

  const selectedPlantingSite =
    plantingSites.find(
      (site) => site.id === form.plantingSite
    ) || null;

  const updateForm = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,

      ...(field === "eventBarangay"
        ? {
            plantingSite: "",
            eventLocation: "",
          }
        : {}),
    }));

    setFormErrors((previous) => ({
      ...previous,
      [field]: "",
      ...(field === "eventBarangay"
        ? {
            plantingSite: "",
          }
        : {}),
    }));
  };

  const updateTree = (
    treeId,
    field,
    value
  ) => {
    setForm((previous) => ({
      ...previous,
      trees: previous.trees.map((tree) =>
        tree.id === treeId
          ? {
              ...tree,
              [field]: value,
            }
          : tree
      ),
    }));

    setFormErrors((previous) => ({
      ...previous,
      trees: "",
    }));
  };

  const addTreeRow = () => {
    setForm((previous) => ({
      ...previous,
      trees: [
        ...previous.trees,
        {
          id: crypto.randomUUID(),
          treeName: "",
          quantity: "",
        },
      ],
    }));
  };

  const removeTreeRow = (treeId) => {
    setForm((previous) => {
      if (previous.trees.length === 1) {
        return previous;
      }

      return {
        ...previous,
        trees: previous.trees.filter(
          (tree) => tree.id !== treeId
        ),
      };
    });
  };

  const validateForm = () => {
    const errors = {};

    if (!form.requesterName.trim()) {
      errors.requesterName =
        "Your account name is required.";
    }

    if (!form.organization.trim()) {
      errors.organization =
        "Organization / Barangay is required.";
    }

    if (!form.contactNumber.trim()) {
      errors.contactNumber =
        "Contact number is required.";
    } else if (
      !/^09\d{9}$/.test(
        form.contactNumber.replace(/\s/g, "")
      )
    ) {
      errors.contactNumber =
        "Enter a valid 11-digit mobile number.";
    }

    const invalidTree = form.trees.some(
      (tree) =>
        !tree.treeName.trim() ||
        !tree.quantity ||
        !Number.isInteger(
          Number(tree.quantity)
        ) ||
        Number(tree.quantity) <= 0
    );

    if (invalidTree) {
      errors.trees =
        "Enter a tree name and valid quantity for every row.";
    }

    if (!form.purpose.trim()) {
      errors.purpose =
        "Purpose / Activity is required.";
    }

    if (!form.preferredReleaseDate) {
      errors.preferredReleaseDate =
        "Preferred release date is required.";
    }

    if (!form.eventName.trim()) {
      errors.eventName =
        "Event name is required.";
    }

    if (!form.eventBarangay) {
      errors.eventBarangay =
        "Barangay is required.";
    }

    if (!form.proposedDate) {
      errors.proposedDate =
        "Proposed date is required.";
    }

    if (!form.startTime) {
      errors.startTime =
        "Start time is required.";
    }

    if (!form.endTime) {
      errors.endTime =
        "End time is required.";
    }

    if (
      form.startTime &&
      form.endTime &&
      form.endTime <= form.startTime
    ) {
      errors.endTime =
        "End time must be later than start time.";
    }

    if (
      !form.expectedParticipants ||
      Number(form.expectedParticipants) < 1
    ) {
      errors.expectedParticipants =
        "Enter the expected number of participants.";
    }

    if (!form.confirmedInformation) {
      errors.confirmedInformation =
        "Please confirm that the information is correct.";
    }

    return errors;
  };

  const handlePlantingSiteChange = (value) => {
    const site =
      plantingSites.find(
        (item) => item.id === value
      ) || null;

    setForm((previous) => ({
      ...previous,
      plantingSite: value,
      eventLocation: getPlantingSiteLocationText(site),
    }));

    setFormErrors((previous) => ({
      ...previous,
      plantingSite: "",
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const existingRequests =
      getStoredRequests();

    const existingArchived =
      getStoredArchivedRequests();

    const now =
      new Date().toISOString();

    const selectedSite =
      plantingSites.find(
        (site) =>
          site.id === form.plantingSite
      ) || null;

    const newRequest = {
      id: createRequestId(
        existingRequests,
        existingArchived
      ),

      requesterName:
        form.requesterName.trim(),

      requesterRole:
        form.requesterRole.trim(),

      organization:
        form.organization.trim(),

      contactNumber:
        form.contactNumber.trim(),

      barangay:
        form.eventBarangay,

      requestType: "New Planting",

      trees: form.trees.map((tree) => ({
        treeName:
          tree.treeName.trim(),

        quantity:
          Number(tree.quantity),
      })),

      purpose:
        form.purpose.trim(),

      purposeDetails: "",

      preferredReleaseDate:
        form.preferredReleaseDate,

      eventName:
        form.eventName.trim(),

      eventBarangay:
        form.eventBarangay,

      plantingSiteId:
        selectedSite?.id || "",

      plantingSiteName:
        selectedSite ? getPlantingSiteDisplayName(selectedSite) : "",

      plantingSiteLocation:
        getPlantingSiteLocationText(selectedSite),

      plantingSiteLatitude:
        selectedSite?.latitude ?? null,

      plantingSiteLongitude:
        selectedSite?.longitude ?? null,

      proposedDate:
        form.proposedDate,

      startTime:
        form.startTime,

      endTime:
        form.endTime,

      expectedParticipants:
        Number(form.expectedParticipants),

      eventLocation:
        getPlantingSiteLocationText(selectedSite),

      eventDescription:
        form.eventDescription.trim(),

      confirmedInformation:
        form.confirmedInformation,

      requestDate: now,
      createdAt: now,
      dateSubmitted: now,
      submittedAt: now,

      reviewedDate: null,

      approvedDate: null,

      rejectedDate: null,

      status: "Pending Review",

      createdByRole: "participant",

      participantId: getParticipantId(currentUser),
      createdByUid: getParticipantId(currentUser),
      userId: getParticipantId(currentUser),
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        newRequest,
        ...existingRequests,
      ])
    );

    setSuccessMessage(
      "You successfully submitted your seedling request."
    );

    setForm({
      requesterName:
        currentUser?.displayName ||
        currentUser?.fullName ||
        currentUser?.name ||
        "",

      requesterRole: "Participant",

      organization:
        currentUser?.organization ||
        currentUser?.barangay ||
        "",

      contactNumber:
        currentUser?.contactNumber ||
        currentUser?.phoneNumber ||
        currentUser?.phone ||
        "",

      trees: [
        {
          id: crypto.randomUUID(),
          treeName: "",
          quantity: "",
        },
      ],

      purpose: "",
      preferredReleaseDate: "",

      eventName: "",
      eventBarangay:
        currentUser?.barangay || "",
      plantingSite: "",
      proposedDate: "",
      startTime: "",
      endTime: "",
      expectedParticipants: "",
      eventLocation: "",
      eventDescription: "",

      confirmedInformation: false,
    });

    setFormErrors({});

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 3500);
  };

  return (
    <div className="seedling-requests-page participant-seedling-page">
      <section className="sr-page-header participant-request-header">
        <div className="sr-title-wrap">
          <div className="sr-title-icon">
            <Sprout
              size={21}
              strokeWidth={1.8}
            />
          </div>

          <div>
            <h1>Request Seedlings</h1>

            <p>
              Submit a seedling request for your
              planting activity.
            </p>
          </div>
        </div>
      </section>

      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "18px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            padding: "11px 16px",
            border: "1px solid #b8dcc8",
            borderRadius: "8px",
            background: "#ffffff",
            color: "#087443",
            fontSize: "13px",
            fontWeight: 700,
            boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)",
            textAlign: "center",
          }}
        >
          {successMessage}
        </div>
      )}

      <section className="sr-record-card participant-request-card">
        <div className="participant-form-header">
          <div>
            <h2>Seedling Request Form</h2>

            <p>
              Fill out the form below to submit your seedling request.
            </p>
          </div>
        </div>

        <form
          className="sr-modal-body participant-request-form"
          onSubmit={handleSubmit}
        >
          <div className="participant-section-title">
            <div>
              <h3>Requester Information</h3>
              <p>
                Your account information is used for
                this request.
              </p>
            </div>
          </div>

          <div className="sr-form-grid">
            <FormField
              label="Requester Name"
              error={formErrors.requesterName}
            >
              <input
                type="text"
                value={form.requesterName}
                readOnly
              />
            </FormField>

            <FormField label="Position / Role">
              <input
                type="text"
                value={form.requesterRole}
                readOnly
              />
            </FormField>

            <FormField
              label="Organization / Barangay"
              error={formErrors.organization}
            >
              <input
                type="text"
                value={form.organization}
                onChange={(event) =>
                  updateForm(
                    "organization",
                    event.target.value
                  )
                }
                placeholder="Enter organization or barangay"
              />
            </FormField>

            <FormField
              label="Contact Number"
              error={formErrors.contactNumber}
            >
              <input
                type="tel"
                inputMode="numeric"
                maxLength={11}
                value={form.contactNumber}
                onChange={(event) =>
                  updateForm(
                    "contactNumber",
                    event.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
                placeholder="09XXXXXXXXX"
              />
            </FormField>
          </div>

          <div className="participant-section-title">
            <div>
              <h3>Seedlings Requested</h3>
              <p>
                Add the tree species and quantity you
                are requesting.
              </p>
            </div>
          </div>

          <div className="sr-tree-section participant-tree-section">
            <div className="sr-tree-column-labels">
              <span>Tree Name</span>
              <span>Quantity</span>
              <span />
            </div>

            {form.trees.map((tree) => (
              <div
                className="sr-tree-row"
                key={tree.id}
              >
                <input
                  type="text"
                  placeholder="Enter tree or seedling name"
                  value={tree.treeName}
                  onChange={(event) =>
                    updateTree(
                      tree.id,
                      "treeName",
                      event.target.value
                    )
                  }
                />

                <input
                  type="number"
                  min="1"
                  placeholder="Quantity"
                  value={tree.quantity}
                  onChange={(event) =>
                    updateTree(
                      tree.id,
                      "quantity",
                      event.target.value
                    )
                  }
                />

                <button
                  type="button"
                  className="sr-remove-tree"
                  disabled={
                    form.trees.length === 1
                  }
                  onClick={() =>
                    removeTreeRow(tree.id)
                  }
                  title="Remove tree"
                >
                  <Minus size={15} />
                </button>
              </div>
            ))}

            {formErrors.trees && (
              <div className="sr-field-error">
                {formErrors.trees}
              </div>
            )}

            <button
              type="button"
              className="sr-add-tree"
              onClick={addTreeRow}
            >
              <Plus size={14} />
              Add Another Tree
            </button>
          </div>

          <div className="sr-form-grid">
            <FormField
              label="Purpose / Activity"
              error={formErrors.purpose}
              fullWidth
            >
              <textarea
                value={form.purpose}
                onChange={(event) =>
                  updateForm(
                    "purpose",
                    event.target.value
                  )
                }
                placeholder="Describe the purpose or planting activity"
              />
            </FormField>

            <FormField
              label="Preferred Release Date"
              error={
                formErrors.preferredReleaseDate
              }
            >
              <input
                type="date"
                value={
                  form.preferredReleaseDate
                }
                onChange={(event) =>
                  updateForm(
                    "preferredReleaseDate",
                    event.target.value
                  )
                }
              />
            </FormField>
          </div>

          <div className="participant-event-section">
            <div className="participant-section-title">
              <div>
                <h3>Proposed Planting Event</h3>
                <p>
                  Provide the details of your proposed
                  planting activity.
                </p>
              </div>
            </div>

            <div className="sr-form-grid">
              <FormField
                label="Event Name"
                error={formErrors.eventName}
              >
                <input
                  type="text"
                  value={form.eventName}
                  onChange={(event) =>
                    updateForm(
                      "eventName",
                      event.target.value
                    )
                  }
                  placeholder="Enter planting event name"
                />
              </FormField>

              <FormField
                label="Barangay"
                error={formErrors.eventBarangay}
              >
                <select
                  value={form.eventBarangay}
                  onChange={(event) =>
                    updateForm(
                      "eventBarangay",
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
                        key={barangay}
                        value={barangay}
                      >
                        {barangay}
                      </option>
                    )
                  )}
                </select>
              </FormField>

              <FormField
                label="Planting Site (Optional)"
                error={formErrors.plantingSite}
              >
                <select
                  value={form.plantingSite}
                  onChange={(event) =>
                    handlePlantingSiteChange(
                      event.target.value
                    )
                  }
                  disabled={
                    !form.eventBarangay
                  }
                >
                  <option value="">
                    {form.eventBarangay
                      ? plantingSitesForBarangay.length > 0
                        ? "Select planting site (optional)"
                        : "No registered planting site yet"
                      : "Select barangay first"}
                  </option>

                  {plantingSitesForBarangay.map(
                    (site) => (
                      <option
                        key={site.id}
                        value={site.id}
                      >
                        {getPlantingSiteDisplayName(site)}
                      </option>
                    )
                  )}
                </select>
              </FormField>

              <FormField
                label="Proposed Date"
                error={formErrors.proposedDate}
              >
                <input
                  type="date"
                  value={form.proposedDate}
                  onChange={(event) =>
                    updateForm(
                      "proposedDate",
                      event.target.value
                    )
                  }
                />
              </FormField>

              <FormField
                label="Start Time"
                error={formErrors.startTime}
              >
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(event) =>
                    updateForm(
                      "startTime",
                      event.target.value
                    )
                  }
                />
              </FormField>

              <FormField
                label="End Time"
                error={formErrors.endTime}
              >
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(event) =>
                    updateForm(
                      "endTime",
                      event.target.value
                    )
                  }
                />
              </FormField>

              <FormField
                label="Expected Participants"
                error={
                  formErrors.expectedParticipants
                }
              >
                <input
                  type="number"
                  min="1"
                  value={
                    form.expectedParticipants
                  }
                  onChange={(event) =>
                    updateForm(
                      "expectedParticipants",
                      event.target.value
                    )
                  }
                  placeholder="Enter number"
                />
              </FormField>

              <FormField
                label="Event Location"
                fullWidth
              >
                <textarea
                  value={
                    selectedPlantingSite
                      ? `${getPlantingSiteDisplayName(selectedPlantingSite)}\n${getPlantingSiteLocationText(selectedPlantingSite)}`
                      : "Select a registered planting site to view its exact location."
                  }
                  readOnly
                  rows={3}
                />
              </FormField>

              <div
                className="participant-location-preview-field"
                style={{ gridColumn: "1 / -1" }}
              >
                <span
                  className="participant-location-preview-label"
                  style={{
                    display: "block",
                    marginBottom: "7px",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#34463c",
                  }}
                >
                  Location Preview
                </span>

                <ParticipantLocationPreview
                  barangay={form.eventBarangay}
                  site={selectedPlantingSite}
                />
              </div>

              <FormField
                label="Event Description"
                fullWidth
              >
                <textarea
                  value={
                    form.eventDescription
                  }
                  onChange={(event) =>
                    updateForm(
                      "eventDescription",
                      event.target.value
                    )
                  }
                  placeholder="Describe the proposed planting activity"
                />
              </FormField>
            </div>
          </div>

          <div className="participant-confirmation">
            <label>
              <input
                type="checkbox"
                checked={
                  form.confirmedInformation
                }
                onChange={(event) =>
                  updateForm(
                    "confirmedInformation",
                    event.target.checked
                  )
                }
              />

              <span>
                I confirm that the information provided
                in this seedling request is correct.
              </span>
            </label>

            {formErrors.confirmedInformation && (
              <small className="sr-field-error">
                {
                  formErrors.confirmedInformation
                }
              </small>
            )}
          </div>

          <div className="participant-form-footer">
            <div className="sr-participant-form-actions">
            <button
                type="button"
                className="sr-participant-clear-btn"
                onClick={() =>
                  setForm({
                    requesterName:
                      currentUser?.displayName ||
                      currentUser?.fullName ||
                      currentUser?.name ||
                      "",
                    requesterRole: "Participant",
                    organization:
                      currentUser?.organization ||
                      currentUser?.barangay ||
                      "",
                    contactNumber:
                      currentUser?.contactNumber ||
                      currentUser?.phoneNumber ||
                      currentUser?.phone ||
                      "",
                    trees: [
                      {
                        id: crypto.randomUUID(),
                        treeName: "",
                        quantity: "",
                      },
                    ],
                    purpose: "",
                    preferredReleaseDate: "",
                    eventName: "",
                    eventBarangay:
                      currentUser?.barangay || "",
                    plantingSite: "",
                    proposedDate: "",
                    startTime: "",
                    endTime: "",
                    expectedParticipants: "",
                    eventLocation: "",
                    eventDescription: "",
                    confirmedInformation: false,
                  })
                }
              >
                <RotateCcw size={15} />
                Clear
              </button>
              </div>
            <button
              type="submit"
              className="sr-primary-btn participant-submit-btn"
            >
              <Check size={15} />
              Submit Request
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}