import {  useCallback, useEffect, useMemo, useRef, useState, } from "react";
import { createPortal } from "react-dom";
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
import { auth } from "../firebase/config";

import "../styles/seedling-requests.css";


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

const BARANGAY_GEOJSON_URL = "/data/juban-barangays.geojson";

const REQUEST_TYPES = ["New Planting", "Replacement"];

const ADMIN_REJECTION_REASONS = [
  "The proposed tree planting activity does not meet MENRO requirements.",
  "The purpose of the seedling request is not aligned with the intended MENRO program or activity.",
  "MENRO cannot accommodate the request at this time due to operational limitations.",
  "Other reason.",
];

const OTHER_REJECTION_REASON = "Other reason.";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function getAuthToken() {
  const token = await auth.currentUser?.getIdToken();
  if (token) localStorage.setItem("token", token);
  return token || localStorage.getItem("token") || "";
}

async function apiRequest(path, options = {}) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error(
      "Authentication token is missing. Please log in again."
    );
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const payload = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        payload?.error ||
        "Unable to complete the request."
    );
  }

  return payload?.data ?? payload;
}

function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const seconds = value.seconds ?? value._seconds;
  if (Number.isFinite(Number(seconds))) {
    return new Date(Number(seconds) * 1000);
  }

  return null;
}

function toIsoString(value) {
  const date = toDateValue(value);
  return date ? date.toISOString() : "";
}

function normalizeRequestForUi(request = {}) {
  const proposal = request.eventProposal || {};
  const items =
    Array.isArray(request.items) && request.items.length > 0
      ? request.items
      : request.inventoryId
        ? [
            {
              inventoryId: request.inventoryId,
              species: request.species || "",
              scientificName: request.scientificName || "",
              quantity: Number(request.quantity || 0),
            },
          ]
        : [];

  const uiStatus =
    request.status === "Pending" ? "Pending Review" : request.status || "Pending Review";

  return {
    ...request,
    backendStatus: request.status,
    status: uiStatus,
    requesterName:
      request.participantName ||
      request.requesterName ||
      request.fullName ||
      "",
    requesterRole: request.requesterRole || "Participant",
    organization:
      request.organization ||
      request.participantOrganization ||
      request.barangay ||
      "",
    contactNumber:
      request.contactNumber ||
      request.participantContactNumber ||
      "",
    barangay: proposal.barangay || request.barangay || "",
    requestType: request.requestType || "New Planting",
    trees: items.map((item) => ({
      ...item,
      inventoryId: item.inventoryId || "",
      treeName: item.species || item.treeName || "Seedling",
      scientificName: item.scientificName || "",
      quantity: Number(item.quantity || 0),
    })),
    requestDate:
      toIsoString(request.createdAt) ||
      toIsoString(request.submittedAt) ||
      request.requestDate ||
      "",
    reviewedDate:
      toIsoString(request.reviewedAt) || request.reviewedDate || "",
    reviewedBy:
      request.reviewedBy ||
      request.reviewedByName ||
      request.staffReviewerName ||
      request.reviewerName ||
      "",
    reviewFindings:
      request.reviewFindings ||
      request.reviewRemarks ||
      request.staffRemarks ||
      request.remarks ||
      "",
    approvedDate:
      toIsoString(request.decisionAt) ||
      toIsoString(request.approvedAt) ||
      request.approvedDate ||
      "",
    rejectedDate:
      toIsoString(request.decisionAt) ||
      toIsoString(request.rejectedAt) ||
      request.rejectedDate ||
      "",
    decisionDate:
      toIsoString(request.decisionAt) ||
      toIsoString(request.approvedAt) ||
      toIsoString(request.rejectedAt) ||
      "",
    decisionReason:
      request.decisionReason ||
      request.reason ||
      request.adminReason ||
      request.rejectionReason ||
      "",
    eventName: proposal.eventName || request.eventName || "",
    eventBarangay: proposal.barangay || request.eventBarangay || "",
    plantingSiteId:
      proposal.plantingSiteId || request.plantingSiteId || "",
    plantingSiteName:
      proposal.plantingSiteName || request.plantingSiteName || "",
    plantingSiteLocation:
      proposal.eventLocation ||
      proposal.plantingLocation ||
      request.plantingSiteLocation ||
      request.plantingLocation ||
      "",
    plantingSiteLatitude:
      proposal.latitude ?? request.plantingSiteLatitude ?? null,
    plantingSiteLongitude:
      proposal.longitude ?? request.plantingSiteLongitude ?? null,
    proposedDate: proposal.proposedDate || request.proposedDate || "",
    startTime: proposal.proposedStartTime || proposal.startTime || request.startTime || "",
    endTime: proposal.proposedEndTime || proposal.endTime || request.endTime || "",
    expectedParticipants:
      proposal.expectedParticipants ?? request.expectedParticipants ?? "",
    eventLocation: proposal.eventLocation || request.eventLocation || "",
    eventDescription:
      proposal.description || proposal.eventDescription || request.eventDescription || "",
  };
}



function getPlantingSiteDisplayName(site) {
  return site?.siteName || site?.name || site?.id || "Planting Site";
}

function getSiteUtilization(site) {
  const capacity = Number(site?.maximumCapacity || 0);
  const planted = Number(site?.planted || 0);

  if (capacity <= 0) return 0;

  return Math.min(100, Math.round((planted / capacity) * 100));
}

function getSiteUtilizationStatus(site) {
  const utilization = getSiteUtilization(site);

  if (utilization >= 90) return "Full";
  if (utilization >= 50) return "Partially Occupied";
  return "Available";
}

function isPlantingSiteFull(site) {
  return getSiteUtilizationStatus(site) === "Full";
}

function getPlantingSiteOptionLabel(site) {
  const name = getPlantingSiteDisplayName(site);
  const utilization = getSiteUtilization(site);
  const status = getSiteUtilizationStatus(site);

  return `${name} — ${status} (${utilization}%)`;
}

function hasStaffReviewData(request) {
  if (!request) return false;

  return Boolean(
    request.reviewedBy ||
      request.reviewFindings ||
      request.reviewedDate ||
      request.status === "Reviewed" ||
      request.status === "Approved" ||
      request.status === "Rejected" ||
      request.status === "Released"
  );
}

function formatLocalDateLabel(dateString = getLocalDateString()) {
  if (!dateString) return "—";

  const [year, month, day] = String(dateString).split("-").map(Number);

  if (!year || !month || !day) {
    return formatDate(dateString);
  }

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
        inventoryId: "",
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

  const [requests, setRequests] = useState([]);
  const [archivedRequests, setArchivedRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [decisionModal, setDecisionModal] = useState(null);
  const [rejectionChoice, setRejectionChoice] = useState("");
  const [otherRejectionReason, setOtherRejectionReason] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewFindings, setReviewFindings] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [releaseModal, setReleaseModal] = useState(null);
  const [releaseInventory, setReleaseInventory] = useState([]);
  const [releaseEntries, setReleaseEntries] = useState([]);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState("");

  const [plantingSites, setPlantingSites] = useState([]);
  const [loadingSites, setLoadingSites] = useState(false);

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
    let cancelled = false;

    async function loadPlantingSites() {
      setLoadingSites(true);

      try {
        const data = await apiRequest("/sites");
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];

        if (!cancelled) {
          setPlantingSites(list);
        }
      } catch (error) {
        console.error("Failed to load planting sites:", error);

        if (!cancelled) {
          setPlantingSites([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSites(false);
        }
      }
    }

    void loadPlantingSites();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadRequests = useCallback(async () => {
  if (userRole === "participant") {
    return;
  }

  setLoadingRequests(true);
  setLoadError("");

  try {
    const data = await apiRequest("/seedling-requests");
    const list = Array.isArray(data) ? data : [];

    setRequests(list.map(normalizeRequestForUi));
  } catch (error) {
    console.error("Failed to load seedling requests:", error);

    setLoadError("Unable to load seedling requests. Please try again.");
  } finally {
    setLoadingRequests(false);
  }
}, [userRole]);

useEffect(() => {
  // Initial backend synchronization for the current role.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void loadRequests();
}, [loadRequests]);

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
          inventoryId: "",
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
    } else {
      const selectedSite = plantingSites.find(
        (site) => site.id === form.plantingSite
      );

      if (selectedSite && isPlantingSiteFull(selectedSite)) {
        errors.plantingSite =
          "Sites marked as Full are not available for new planting requests.";
      }
    }

    if (!form.proposedDate) {
      errors.proposedDate = "Proposed event date is required.";
    } else if (form.proposedDate < getLocalDateString()) {
      errors.proposedDate = "Proposed event date cannot be in the past.";
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

  const refreshSelectedRequest = (updated) => {
    const normalized = normalizeRequestForUi(updated);

    setRequests((previous) =>
      previous.map((request) =>
        request.id === normalized.id ? normalized : request
      )
    );

    setSelectedRequest((previous) =>
      previous?.id === normalized.id ? normalized : previous
    );
  };

  const openReviewModal = (request) => {
    setReviewModal({ request });
    setReviewFindings("");
    setReviewError("");
  };

  const closeReviewModal = () => {
    if (actionLoading) return;
    setReviewModal(null);
    setReviewFindings("");
    setReviewError("");
  };

  const submitReview = async () => {
    const findings = reviewFindings.trim();

    if (!findings) {
      setReviewError("Review Findings / Remarks is required.");
      return;
    }

    if (findings.length > 500) {
      setReviewError("Review Findings / Remarks must be 500 characters or fewer.");
      return;
    }

    if (!reviewModal?.request?.id) return;

    const request = reviewModal.request;

    setActionLoading(true);
    setReviewError("");
    setRequestError("");

    try {
      const payload = {
        items: (request.trees || []).map((tree) => ({
          inventoryId: tree.inventoryId,
          quantity: Number(tree.quantity),
        })),
        purpose: request.purpose || "",
        plantingLocation:
          request.plantingLocation ||
          request.plantingSiteLocation ||
          request.eventLocation ||
          "",
        preferredReleaseDate: request.preferredReleaseDate || "",
        reviewFindings: findings,
      };

      const updated = await apiRequest(
        `/seedling-requests/${request.id}/review`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );

      refreshSelectedRequest(updated);
      setSuccessMessage(`${request.id} was reviewed successfully.`);
      setReviewModal(null);
      setReviewFindings("");
    } catch (error) {
      console.error(error);
      setReviewError(error.message || "Unable to review the request.");
    } finally {
      setActionLoading(false);
    }
  };

  const releaseRequest = async (request, items) => {
    setActionLoading(true);
    setRequestError("");

    try {
      const updated = await apiRequest(
        `/seedling-requests/${request.id}/release`,
        { method: "PATCH", body: JSON.stringify({ items }) }
      );

      refreshSelectedRequest(updated);
      setSuccessMessage(`${request.id} was released successfully.`);
      return true;
    } catch (error) {
      console.error(error);
      setRequestError(error.message || "Unable to release the request.");
      setReleaseError(error.message || "Unable to release the request.");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const openReleaseModal = async (request) => {
    if (userRole !== "staff" || request.status !== "Approved") return;
    setReleaseModal(request);
    setReleaseInventory([]);
    setReleaseEntries((request.trees || []).map(() => ({ quantity: "", reason: "" })));
    setReleaseError("");
    setReleaseLoading(true);
    try {
      const inventory = await apiRequest("/inventory");
      if (!Array.isArray(inventory)) throw new Error("Inventory is unavailable.");
      setReleaseInventory(inventory);
    } catch (error) {
      console.error("Unable to load inventory for release:", error);
      setReleaseError("Unable to load current stock. Please close and try again.");
    } finally {
      setReleaseLoading(false);
    }
  };

  const confirmRelease = async () => {
    if (!releaseModal || releaseLoading || actionLoading) return;
    const trees = releaseModal.trees || [];
    if (!trees.length || releaseInventory.length === 0) {
      setReleaseError("Current stock is required before release.");
      return;
    }
    for (let index = 0; index < trees.length; index += 1) {
      const tree = trees[index];
      const quantity = Number(releaseEntries[index]?.quantity);
      const rawQuantity = releaseEntries[index]?.quantity;
      const requested = Number(tree.quantity);
      const stock = releaseInventory.find((item) => item.id === tree.inventoryId);
      const available = Number(stock?.availableQuantity) + (releaseModal.inventoryReserved === true ? Number(stock?.reservedQuantity || 0) : 0);
      if (rawQuantity === "" || !Number.isInteger(quantity) || quantity <= 0 || quantity > requested) {
        setReleaseError(`Enter a released quantity for ${tree.treeName} greater than zero and no more than requested.`);
        return;
      }
      if (!stock || !Number.isFinite(available)) {
        setReleaseError(`Current inventory for ${tree.treeName} is unavailable. Please try again.`);
        return;
      }
      if (quantity > available) {
        setReleaseError(`Released quantity for ${tree.treeName} cannot exceed the available inventory.`);
        return;
      }
      if (quantity < requested) {
        if (!releaseEntries[index]?.reason?.trim()) {
          setReleaseError(`Enter the actual short-release reason for ${tree.treeName}.`);
          return;
        }
      }
    }
    setReleaseError("");
    const items = trees.map((tree, index) => ({
      inventoryId: tree.inventoryId,
      releasedQuantity: Number(releaseEntries[index].quantity),
      shortReleaseReason: Number(releaseEntries[index].quantity) < Number(tree.quantity)
        ? releaseEntries[index].reason.trim() : "",
    }));
    if (await releaseRequest(releaseModal, items)) {
      setReleaseModal(null);
      void loadRequests();
    }
  };

  const openDecisionModal = (request, action) => {
    setDecisionModal({ request, action });
    setRejectionChoice("");
    setOtherRejectionReason("");
    setDecisionError("");
  };

  const closeDecisionModal = () => {
    if (actionLoading) return;
    setDecisionModal(null);
    setRejectionChoice("");
    setOtherRejectionReason("");
    setDecisionError("");
  };

  const submitDecision = async () => {
    if (!decisionModal?.request?.id) return;

    const { request, action } = decisionModal;
    let payload = {};

    if (action === "reject") {
      if (!rejectionChoice) {
        setDecisionError("Please select a reason for rejection.");
        return;
      }

      if (rejectionChoice === OTHER_REJECTION_REASON) {
        const customReason = otherRejectionReason.trim();

        if (!customReason) {
          setDecisionError("Please specify the reason for rejection.");
          return;
        }

        if (customReason.length > 500) {
          setDecisionError("Custom rejection reason must be 500 characters or fewer.");
          return;
        }

        payload = { reason: customReason };
      } else {
        payload = { reason: rejectionChoice };
      }
    }

    setActionLoading(true);
    setDecisionError("");
    setRequestError("");

    try {
      const updated = await apiRequest(
        `/seedling-requests/${request.id}/${action}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );

      refreshSelectedRequest(updated);
      setSuccessMessage(
        `${request.id} was ${action === "approve" ? "approved" : "rejected"} successfully.`
      );
      setDecisionModal(null);
      setRejectionChoice("");
      setOtherRejectionReason("");
    } catch (error) {
      console.error(error);
      setDecisionError(error.message || "Unable to save the MENRO decision.");
    } finally {
      setActionLoading(false);
    }
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

  if (loadingRequests) {
    return <div className="seedling-requests-page"><div style={{ minHeight: "420px", display: "grid", placeItems: "center", color: "#526159", fontSize: "13px", fontWeight: 600 }}>Loading seedling requests...</div></div>;
  }

  if (loadError) {
    return <div className="seedling-requests-page"><div role="alert" style={{ minHeight: "420px", display: "grid", placeContent: "center", justifyItems: "center", gap: "14px", color: "#526159", fontSize: "13px", fontWeight: 600 }}><span>{loadError}</span><button type="button" className="sr-secondary-btn" onClick={loadRequests}>Retry</button></div></div>;
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

      </section>

      {successMessage && (
        <div className="sr-success-message">
          <CircleCheckBig size={16} />
          {successMessage}
        </div>
      )}

      {requestError && (
        <div className="sr-api-error" role="alert">
          <CircleX size={16} />
          {requestError}
        </div>
      )}

      {loadingRequests && (
        <div className="sr-api-loading">Loading seedling requests...</div>
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
    {/* VIEW DETAILS */}
    <button
      type="button"
      className="sr-view-btn"
      title="View details"
      onClick={() =>
        setSelectedRequest(request)
      }
    >
      <Eye size={15} />
    </button>

    {/* ADMIN - APPROVE OR REJECT REVIEWED REQUEST */}
    {userRole === "admin" &&
      request.status === "Reviewed" && (
        <>
          <button
            type="button"
            className="sr-approve-btn"
            onClick={() => openDecisionModal(request, "approve")}
            disabled={actionLoading}
          >
            Approve
          </button>

          <button
            type="button"
            className="sr-reject-btn"
            onClick={() => openDecisionModal(request, "reject")}
            disabled={actionLoading}
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

      <ReviewRequestModal
        modal={reviewModal}
        findings={reviewFindings}
        setFindings={setReviewFindings}
        error={reviewError}
        loading={actionLoading}
        onClose={closeReviewModal}
        onSubmit={submitReview}
      />

      {releaseModal && createPortal(
        <div className="sr-modal-backdrop sr-review-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !actionLoading) setReleaseModal(null);
        }}>
          <div className="sr-modal sr-decision-modal" role="dialog" aria-modal="true" aria-label="Release seedlings">
            <div className="sr-modal-header">
              <div><h2>Release Seedlings</h2><p>Confirm actual quantities against current inventory.</p></div>
              <button type="button" className="sr-modal-close" onClick={() => setReleaseModal(null)} disabled={actionLoading} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="sr-modal-body">
              <div className="sr-details-grid">
                <DetailItem label="Request No." value={releaseModal.id} />
                <DetailItem label="Requester" value={releaseModal.requesterName} />
                <DetailItem label="Organization / Barangay" value={releaseModal.organization || releaseModal.eventBarangay} />
                <DetailItem label="Planting Site" value={releaseModal.plantingSiteName} />
                <DetailItem label="Proposed Event" value={releaseModal.eventName} fullWidth />
              </div>
              {releaseLoading ? <p>Loading current inventory...</p> : (releaseModal.trees || []).map((tree, index) => {
                const stock = releaseInventory.find((item) => item.id === tree.inventoryId);
                const entered = releaseEntries[index]?.quantity ?? "";
                const available = stock && Number(stock.availableQuantity) + (releaseModal.inventoryReserved === true ? Number(stock.reservedQuantity || 0) : 0);
                const difference = entered === "" ? null : Number(tree.quantity) - Number(entered);
                return (
                  <div className="sr-release-item" key={`${tree.inventoryId}-${index}`}>
                    <h3>{tree.treeName}</h3>
                    <div className="sr-details-grid">
                      <DetailItem label="Requested" value={tree.quantity} />
                      <DetailItem label="Current Available Stock" value={Number.isFinite(available) ? available : "Unavailable"} />
                    </div>
                    <label className="sr-form-field">
                      <span>Actual Released Quantity *</span>
                      <input type="number" min="1" step="1" max={Math.min(Number(tree.quantity), Number.isFinite(available) ? available : 0)} value={entered} onChange={(event) => setReleaseEntries((previous) => previous.map((entry, itemIndex) => itemIndex === index ? { ...entry, quantity: event.target.value } : entry))} placeholder="Enter actual quantity" />
                    </label>
                    {difference !== null && Number(entered) > 0 && Number.isFinite(difference) && (
                      <div className="sr-release-calculation">Difference: {difference} · {difference === 0 ? "Complete Release" : "Partial Release"}</div>
                    )}
                    {difference > 0 && Number(entered) > 0 && (
                      <label className="sr-form-field">
                        <span>Reason for Short Release *</span>
                        <textarea value={releaseEntries[index]?.reason || ""} onChange={(event) => setReleaseEntries((previous) => previous.map((entry, itemIndex) => itemIndex === index ? { ...entry, reason: event.target.value } : entry))} placeholder="Enter the actual reason" />
                      </label>
                    )}
                  </div>
                );
              })}
              {releaseError && <p className="sr-field-error" role="alert">{releaseError}</p>}
            </div>
            <div className="sr-modal-footer">
              <button type="button" className="sr-secondary-btn" onClick={() => setReleaseModal(null)} disabled={actionLoading}>Cancel</button>
              <button type="button" className="sr-approve-btn sr-large-action" onClick={confirmRelease} disabled={releaseLoading || actionLoading || releaseInventory.length === 0}>
                {actionLoading ? "Releasing..." : "Confirm Release"}
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      <AdminDecisionModal
        modal={decisionModal}
        rejectionChoice={rejectionChoice}
        setRejectionChoice={setRejectionChoice}
        otherRejectionReason={otherRejectionReason}
        setOtherRejectionReason={setOtherRejectionReason}
        error={decisionError}
        loading={actionLoading}
        onClose={closeDecisionModal}
        onSubmit={submitDecision}
      />

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

                <FormField label="Planting Site *" error={formErrors.plantingSite}>
                  <select
                    value={form.plantingSite}
                    disabled={!form.eventBarangay || loadingSites}
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
                    <option value="">
                      {!form.eventBarangay
                        ? "Select barangay first"
                        : loadingSites
                          ? "Loading planting sites..."
                          : "Select planting site"}
                    </option>
                    {plantingSitesForBarangay.map((site) => (
                      <option
                        key={site.id}
                        value={site.id}
                        disabled={isPlantingSiteFull(site)}
                      >
                        {getPlantingSiteOptionLabel(site)}
                      </option>
                    ))}
                  </select>
                  {form.eventBarangay && plantingSitesForBarangay.some(isPlantingSiteFull) && (
                    <small className="sr-field-hint">
                      Sites marked as Full are not available for new planting requests.
                    </small>
                  )}
                </FormField>

                <FormField label="Proposed Event Date *" error={formErrors.proposedDate}>
                  <input
                    type="date"
                    min={getLocalDateString()}
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

              {Array.isArray(selectedRequest.releasedItems) && selectedRequest.releasedItems.length > 0 && (
                <div className="sr-detail-seedlings">
                  <h3>Recorded Seedling Release</h3>
                  {selectedRequest.releasedItems.map((item, index) => (
                    <div className="sr-detail-tree-row" key={`${item.inventoryId}-${index}-released`}>
                      <span>{item.species} — {item.releasedQuantity} released of {item.requestedQuantity} requested; difference {item.difference}</span>
                      {item.shortReleaseReason && <span>{item.shortReleaseReason}</span>}
                    </div>
                  ))}
                  {selectedRequest.releasedBy && <div className="sr-detail-tree-row"><span>Released By</span><strong>{selectedRequest.releasedBy}</strong></div>}
                  {selectedRequest.releasedAt && <div className="sr-detail-tree-row"><span>Released At</span><strong>{formatDate(selectedRequest.releasedAt)}</strong></div>}
                </div>
              )}

              {selectedRequest.eventDescription && (
                <div className="sr-detail-remarks">
                  <span>Event Description</span>
                  <p>{selectedRequest.eventDescription}</p>
                </div>
              )}

              {hasStaffReviewData(selectedRequest) && (
                <StaffReviewSection request={selectedRequest} />
              )}

              {(selectedRequest.status === "Approved" ||
                selectedRequest.status === "Rejected") && (
                <MenroDecisionSection request={selectedRequest} />
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

                {userRole === "staff" &&
                  selectedRequest.status === "Pending Review" && (
                    <button
                      type="button"
                      className="sr-approve-btn sr-large-action"
                      onClick={() => openReviewModal(selectedRequest)}
                      disabled={actionLoading}
                    >
                      Review
                    </button>
                  )}

                {userRole === "admin" &&
                  selectedRequest.status ===
                    "Reviewed" && (
                    <>
                      <button
                        type="button"
                        className="sr-reject-btn sr-large-action"
                        onClick={() => openDecisionModal(selectedRequest, "reject")} disabled={actionLoading}
                      >
                        Reject
                      </button>

                      <button
                        type="button"
                        className="sr-approve-btn sr-large-action"
                        onClick={() => openDecisionModal(selectedRequest, "approve")} disabled={actionLoading}
                      >
                        Approve
                      </button>
                    </>
                  )}

                {userRole === "staff" &&
                  selectedRequest.status === "Approved" && (
                    <button
                      type="button"
                      className="sr-approve-btn sr-large-action"
                      onClick={() => openReleaseModal(selectedRequest)}
                      disabled={actionLoading}
                    >
                      Release Seedlings
                    </button>
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


function StaffReviewSection({ request }) {
  if (!request) return null;

  return (
    <div className="sr-menro-decision sr-staff-review">
      <div className="sr-menro-decision-head">
        <strong>MENRO Staff Review</strong>
        <StatusBadge status="Reviewed" />
      </div>

      <div className="sr-menro-decision-grid">
        <div>
          <span>Reviewed By</span>
          <strong>{request.reviewedBy || "—"}</strong>
        </div>
        <div>
          <span>Review Date</span>
          <strong>{formatDate(request.reviewedDate) || "—"}</strong>
        </div>
        <div className="full-width">
          <span>Review Findings / Remarks</span>
          <strong>{request.reviewFindings || "—"}</strong>
        </div>
        <div>
          <span>Review Status</span>
          <strong>Reviewed</strong>
        </div>
      </div>
    </div>
  );
}

function MenroDecisionSection({ request }) {
  if (!request) return null;

  const isApproved = request.status === "Approved";
  const isRejected = request.status === "Rejected";

  if (!isApproved && !isRejected) return null;

  return (
    <div className="sr-menro-decision">
      <div className="sr-menro-decision-head">
        <strong>MENRO Decision</strong>
        <StatusBadge status={request.status} />
      </div>

      <div className="sr-menro-decision-grid">
        <div>
          <span>Status</span>
          <strong>{request.status}</strong>
        </div>
        <div>
          <span>Decision Date</span>
          <strong>
            {formatDate(
              request.decisionDate ||
                request.approvedDate ||
                request.rejectedDate
            )}
          </strong>
        </div>
        {isRejected && (
          <div className="full-width">
            <span>Reason</span>
            <strong>{request.decisionReason || "—"}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewRequestModal({
  modal,
  findings,
  setFindings,
  error,
  loading,
  onClose,
  onSubmit,
}) {
  if (!modal) return null;

  return createPortal(
    <div className="sr-modal-backdrop sr-review-backdrop" onMouseDown={onClose}>
      <div
        className="sr-modal sr-decision-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sr-modal-header">
          <div>
            <h2>Review Seedling Request</h2>
            <p>
              Document your review findings before submitting this request for Admin decision.
            </p>
          </div>
          <button
            type="button"
            className="sr-modal-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sr-modal-body">
          <div className="sr-decision-request-summary">
            <span>Request</span>
            <strong>{modal.request.id}</strong>
          </div>

          <label className="sr-form-field">
            <span>Review Findings / Remarks *</span>
            <textarea
              value={findings}
              onChange={(event) => setFindings(event.target.value)}
              maxLength={500}
              placeholder="Enter what was checked or observed during the review..."
              autoFocus
            />
            <small className="sr-decision-counter">
              {findings.trim().length}/500 characters
            </small>
          </label>

          <div className="sr-form-field">
            <span>Review Date</span>
            <input
              type="text"
              value={formatLocalDateLabel()}
              readOnly
            />
          </div>

          {error && <small className="sr-field-error">{error}</small>}
        </div>

        <div className="sr-modal-footer">
          <button
            type="button"
            className="sr-secondary-btn"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="sr-approve-btn sr-large-action"
            onClick={onSubmit}
            disabled={loading || !findings.trim()}
          >
            {loading ? "Submitting..." : "Submit Review"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AdminDecisionModal({
  modal,
  rejectionChoice,
  setRejectionChoice,
  otherRejectionReason,
  setOtherRejectionReason,
  error,
  loading,
  onClose,
  onSubmit,
}) {
  if (!modal) return null;

  const isApprove = modal.action === "approve";
  const needsOtherReason = rejectionChoice === OTHER_REJECTION_REASON;

  return (
    <div className="sr-modal-backdrop" onMouseDown={onClose}>
      <div
        className="sr-modal sr-decision-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sr-modal-header">
          <div>
            <h2>
              {isApprove
                ? "Approve Seedling Request"
                : "Reject Seedling Request"}
            </h2>
            <p>
              {isApprove
                ? "Confirm approval of this seedling request. No approval reason is required."
                : "Select a standardized rejection reason for this seedling request."}
            </p>
          </div>
          <button
            type="button"
            className="sr-modal-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sr-modal-body">
          <div className="sr-decision-request-summary">
            <span>Request</span>
            <strong>{modal.request.id}</strong>
          </div>

          {isApprove ? (
            <p className="sr-decision-confirm-text">
              Are you sure you want to approve this seedling request?
            </p>
          ) : (
            <>
              <label className="sr-form-field">
                <span>Reason for Rejection *</span>
                <select
                  value={rejectionChoice}
                  onChange={(event) => {
                    setRejectionChoice(event.target.value);
                  }}
                >
                  <option value="">Select rejection reason</option>
                  {ADMIN_REJECTION_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>

              {needsOtherReason && (
                <label className="sr-form-field">
                  <span>Please specify the reason *</span>
                  <textarea
                    value={otherRejectionReason}
                    onChange={(event) =>
                      setOtherRejectionReason(event.target.value)
                    }
                    maxLength={500}
                    placeholder="Enter the custom rejection reason..."
                  />
                  <small className="sr-decision-counter">
                    {otherRejectionReason.trim().length}/500 characters
                  </small>
                </label>
              )}
            </>
          )}

          <div className="sr-form-field">
            <span>Decision Date</span>
            <input type="text" value={formatLocalDateLabel()} readOnly />
          </div>

          {error && <small className="sr-field-error">{error}</small>}
        </div>

        <div className="sr-modal-footer">
          <button
            type="button"
            className="sr-secondary-btn"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={
              isApprove
                ? "sr-approve-btn sr-large-action"
                : "sr-reject-btn sr-large-action"
            }
            onClick={onSubmit}
            disabled={
              loading ||
              (!isApprove &&
                (!rejectionChoice ||
                  (needsOtherReason && !otherRejectionReason.trim())))
            }
          >
            {loading
              ? "Saving..."
              : isApprove
                ? "Confirm Approval"
                : "Confirm Rejection"}
          </button>
        </div>
      </div>
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
        inventoryId: "",
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
  const [apiError, setApiError] = useState("");
  const [availableInventory, setAvailableInventory] = useState([]);
  const [loadingParticipantData, setLoadingParticipantData] = useState(true);
  const [participantLoadError, setParticipantLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [plantingSites, setPlantingSites] = useState([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [sitesError, setSitesError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPlantingSites() {
      setLoadingSites(true);
      setSitesError("");

      try {
        const data = await apiRequest("/sites");
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : null;

        if (!list) throw new Error("Invalid planting site response.");

        if (!cancelled) {
          setPlantingSites(list);
        }
      } catch (error) {
        console.error("Failed to load planting sites:", error);

        if (!cancelled) {
          setSitesError(error.message || "Unable to load planting sites.");
        }
      } finally {
        if (!cancelled) {
          setLoadingSites(false);
        }
      }
    }

    void loadPlantingSites();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadParticipantData = useCallback(async () => {
  setLoadingParticipantData(true);
  setParticipantLoadError("");

  try {
    const inventoryData = await apiRequest("/inventory/available");

    const inventoryList = (
      Array.isArray(inventoryData) ? inventoryData : []
    )
      .filter(
        (item) =>
          Number(item.availableQuantity || 0) > 0
      )
      .sort((a, b) =>
        String(a.species || "").localeCompare(
          String(b.species || "")
        )
      );

    setAvailableInventory(inventoryList);
  } catch (error) {
    console.error(
      "Failed to load participant seedling request data:",
      error
    );

    setParticipantLoadError("Unable to load available seedlings. Please try again.");
  } finally {
    setLoadingParticipantData(false);
  }
}, []);

useEffect(() => {
  // Initial participant data synchronization with the backend.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void loadParticipantData();
}, [loadParticipantData]);


  const plantingSitesForBarangay = plantingSites.filter(
    (site) =>
      String(site.barangay || "").trim().toLocaleLowerCase() ===
      String(form.eventBarangay || "").trim().toLocaleLowerCase()
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
          inventoryId: "",
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

    const selectedInventoryIds = form.trees
      .map((tree) => tree.inventoryId)
      .filter(Boolean);

    if (new Set(selectedInventoryIds).size !== selectedInventoryIds.length) {
      errors.trees = "The same seedling cannot be selected more than once.";
    }

    const invalidTree = form.trees.some((tree) => {
      const inventory = availableInventory.find(
        (item) => item.id === tree.inventoryId
      );
      const quantity = Number(tree.quantity);

      return (
        !tree.inventoryId ||
        !inventory ||
        !Number.isInteger(quantity) ||
        quantity < 1
      );
    });

    if (invalidTree && !errors.trees) {
      errors.trees =
        "Select a seedling and enter a positive whole-number quantity of at least 1.";
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

    if (!form.plantingSite) {
      errors.plantingSite =
        "A registered planting site is required.";
    } else {
      const selectedSite = plantingSites.find(
        (site) => site.id === form.plantingSite
      );

      if (!selectedSite) {
        errors.plantingSite =
          "A registered planting site is required.";
      } else if (isPlantingSiteFull(selectedSite)) {
        errors.plantingSite =
          "Sites marked as Full are not available for new planting requests.";
      }
    }

    if (!form.proposedDate) {
      errors.proposedDate =
        "Proposed event date is required.";
    } else if (form.proposedDate < getLocalDateString()) {
      errors.proposedDate =
        "Proposed event date cannot be in the past.";
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

  const resetParticipantForm = () => {
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
      trees: [{ id: crypto.randomUUID(), inventoryId: "", quantity: "" }],
      purpose: "",
      preferredReleaseDate: "",
      eventName: "",
      eventBarangay: currentUser?.barangay || "",
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
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const selectedSite =
      plantingSites.find((site) => site.id === form.plantingSite) || null;

    if (!selectedSite || !plantingSitesForBarangay.some((site) => site.id === selectedSite.id)) {
      setFormErrors((previous) => ({
        ...previous,
        plantingSite: "A registered planting site is required.",
      }));
      return;
    }

    const latitude = Number(selectedSite.latitude);
    const longitude = Number(selectedSite.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setFormErrors((previous) => ({
        ...previous,
        plantingSite: "The selected planting site has invalid GPS coordinates.",
      }));
      return;
    }

    const payload = {
      participantName: form.requesterName.trim(),
      organization: form.organization.trim(),
      contactNumber: form.contactNumber.replace(/\s/g, ""),
      items: form.trees.map((tree) => ({
        inventoryId: tree.inventoryId,
        quantity: Number(tree.quantity),
      })),
      purpose: form.purpose.trim(),
      plantingLocation: getPlantingSiteLocationText(selectedSite),
      preferredReleaseDate: form.preferredReleaseDate,
      eventProposal: {
        eventName: form.eventName.trim(),
        barangay: form.eventBarangay,
        plantingSiteId: selectedSite.id,
        proposedDate: form.proposedDate,
        startTime: form.startTime,
        endTime: form.endTime,
        eventLocation: getPlantingSiteLocationText(selectedSite),
        latitude,
        longitude,
        expectedParticipants: Number(form.expectedParticipants),
        eventDescription: form.eventDescription.trim(),
      },
    };

    setSubmitting(true);
    setApiError("");

    try {
      await apiRequest("/seedling-requests", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccessMessage("You successfully submitted your seedling request.");
      resetParticipantForm();
      await loadParticipantData();

      window.setTimeout(() => {
        setSuccessMessage("");
      }, 3500);
    } catch (error) {
      console.error(error);
      setApiError(error.message || "Unable to submit the seedling request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingParticipantData) {
    return <div className="seedling-requests-page participant-seedling-page"><div style={{ minHeight: "420px", display: "grid", placeItems: "center", color: "#526159", fontSize: "13px", fontWeight: 600 }}>Loading available seedlings...</div></div>;
  }

  if (participantLoadError) {
    return <div className="seedling-requests-page participant-seedling-page"><div role="alert" style={{ minHeight: "420px", display: "grid", placeContent: "center", justifyItems: "center", gap: "14px", color: "#526159", fontSize: "13px", fontWeight: 600 }}><span>{participantLoadError}</span><button type="button" className="sr-secondary-btn" onClick={loadParticipantData}>Retry</button></div></div>;
  }

  return (
    <div className="seedling-requests-page participant-seedling-page">
      {apiError && (
      <div
        role="alert"
        style={{
          marginBottom: "16px",
          padding: "12px 14px",
          borderRadius: "8px",
          border: "1px solid #fecaca",
          background: "#fef2f2",
          color: "#991b1b",
          fontSize: "14px",
          lineHeight: "1.5",
        }}
      >
        {apiError}
      </div>
    )}

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
              <span>Tree *</span>
              <span>Quantity *</span>
              <span />
            </div>

            {form.trees.map((tree) => (
              <div
                className="sr-tree-row"
                key={tree.id}
              >
                <select
                  value={tree.inventoryId}
                  onChange={(event) =>
                    updateTree(
                      tree.id,
                      "inventoryId",
                      event.target.value
                    )
                  }
                  disabled={loadingParticipantData}
                  aria-label="Tree"
                >
                  <option value="">
                    {loadingParticipantData
                      ? "Loading available seedlings..."
                      : availableInventory.length > 0
                        ? "Select tree"
                        : "No seedlings currently available"}
                  </option>

                  {availableInventory.map((item) => {
                    const selectedElsewhere =
                      form.trees.some(
                        (otherTree) =>
                          otherTree.id !== tree.id &&
                          otherTree.inventoryId === item.id
                      );

                    return (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={selectedElsewhere}
                      >
                        {item.species} — {Number(item.availableQuantity || 0)} available
                      </option>
                    );
                  })}
                </select>

                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Quantity"
                  value={tree.quantity}
                  onChange={(event) =>
                    updateTree(
                      tree.id,
                      "quantity",
                      event.target.value
                    )
                  }
                  aria-label="Quantity"
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
                label="Planting Site *"
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
                    !form.eventBarangay || loadingSites || Boolean(sitesError)
                  }
                >
                  <option value="">
                    {!form.eventBarangay
                      ? "Select barangay first"
                      : loadingSites
                        ? "Loading planting sites..."
                        : sitesError
                          ? "Planting sites unavailable"
                        : plantingSitesForBarangay.length > 0
                          ? "Select planting site"
                          : "No registered planting site yet"}
                  </option>

                  {plantingSitesForBarangay.map(
                    (site) => (
                      <option
                        key={site.id}
                        value={site.id}
                        disabled={isPlantingSiteFull(site)}
                      >
                        {getPlantingSiteOptionLabel(site)}
                      </option>
                    )
                  )}
                </select>
                {sitesError && <small className="sr-field-hint" role="alert">{sitesError}</small>}
                {form.eventBarangay &&
                  plantingSitesForBarangay.some(isPlantingSiteFull) && (
                    <small className="sr-field-hint">
                      Sites marked as Full are not available for new planting requests.
                    </small>
                  )}
              </FormField>

              <FormField
                label="Proposed Event Date *"
                error={formErrors.proposedDate}
              >
                <input
                  type="date"
                  min={getLocalDateString()}
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
                onClick={resetParticipantForm}
              >
                <RotateCcw size={15} />
                Clear
              </button>
              </div>
            <button
              type="submit"
              className="sr-primary-btn participant-submit-btn"
              disabled={submitting || loadingParticipantData}
            >
              <Check size={15} />
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </section>

    </div>
  );
}
