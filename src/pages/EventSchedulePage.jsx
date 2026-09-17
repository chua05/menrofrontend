import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Clock3,
  Edit3,
  EllipsisVertical,
  MapPin,
  Plus,
  RotateCcw,
  Sprout,
  Trash2,
  Users,
  X,
  XCircle,
  Activity,
  Leaf,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase/config";

import "../styles/event-calendar.css";
import "../styles/dashboard-page.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const EVENT_TYPES = [
  "Tree Planting",
  "Other MENRO Activity",
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

const WEEK_DAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getInitialForm() {
  return {
    name: "",
    type: "Tree Planting",

    barangay: "",
    plantingSiteId: "",
    location: "",

    date: "",
    startTime: "",
    endTime: "",

    expectedParticipants: "",
    actualParticipants: "",

    organizer: "",
    description: "",
  };
}

function getSiteId(site) {
  return site?.siteId || site?.id || "";
}

function getSiteName(site) {
  return site?.siteName || site?.name || "";
}

function getSiteBarangay(site) {
  return site?.barangay || "";
}

function normalizeTimestamp(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value === "object") {
    const seconds =
      value._seconds ??
      value.seconds;

    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000);
    }
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function formatDateTime(value) {
  const date = normalizeTimestamp(value);

  if (!date) return "—";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(dateString) {
  if (!dateString) return "—";

  const date = new Date(
    `${dateString}T00:00:00`
  );

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(dateString) {
  if (!dateString) return "—";

  const date = new Date(
    `${dateString}T00:00:00`
  );

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(time) {
  if (!time) return "—";

  const [hourString, minute] =
    time.split(":");

  const hour = Number(hourString);

  const suffix =
    hour >= 12 ? "PM" : "AM";

  const displayHour =
    hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

function formatDateKey(
  year,
  month,
  day
) {
  return `${year}-${String(
    month + 1
  ).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}`;
}

/*
 * Calendar/display status only.
 *
 * This is separate from recordStatus.
 *
 * recordStatus is supplied by the backend; an approved request's
 * Tree Planting event is already scheduled.
 *
 * calendar status:
 * Upcoming / Ongoing / Completed / Cancelled
 */
function getEventStatus(event) {
  if (
    event.status === "Completed" ||
    event.status === "Cancelled"
  ) {
    return event.status;
  }

  if (!event.date) {
    return "Upcoming";
  }

  const now = new Date();

  const start = new Date(
    `${event.date}T${
      event.startTime || "00:00"
    }:00`
  );

  const end = new Date(
    `${event.date}T${
      event.endTime || "23:59"
    }:00`
  );

  if (now < start) {
    return "Upcoming";
  }

  if (
    now >= start &&
    now <= end
  ) {
    return "Ongoing";
  }

  /*
   * Past events are not automatically completed.
   * MENRO explicitly marks them Completed.
   */
  return event.status || "Upcoming";
}

function getEventTypeIcon(type) {
  if (type === "Tree Planting") {
    return Sprout;
  }

  return Leaf;
}

function getEventTypeClass(type) {
  if (type === "Tree Planting") {
    return "tree-planting";
  }

  return "other";
}

function StatusBadge({ status }) {
  const className = String(
    status || ""
  )
    .toLowerCase()
    .replaceAll(" ", "-");

  return (
    <span
      className={`ec-status ec-status-${className}`}
    >
      {status}
    </span>
  );
}

export default function EventSchedulePage() {
  const { userRole } = useAuth();

  const canManage =
    userRole === "admin" ||
    userRole === "staff";

  const [events, setEvents] =
    useState([]);
  const [contributions, setContributions] = useState([]);
  const [contributionItem, setContributionItem] = useState("");
  const [contributionQuantity, setContributionQuantity] = useState("");
  const [contributionError, setContributionError] = useState("");
  const [contributionLoading, setContributionLoading] = useState(false);

  const [
    archivedEvents,
    setArchivedEvents,
  ] = useState([]);

  const [sites, setSites] =
    useState([]);

  const [loading, setLoading] =
    useState(true);
  const [initialError, setInitialError] = useState("");

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const today = new Date();

  const [
    calendarDate,
    setCalendarDate,
  ] = useState(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    )
  );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    formatDateKey(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    )
  );

  const [
    selectedEvent,
    setSelectedEvent,
  ] = useState(null);

  const [
    showAddModal,
    setShowAddModal,
  ] = useState(false);

  const [
    showEditModal,
    setShowEditModal,
  ] = useState(false);

  const [
    showArchiveModal,
    setShowArchiveModal,
  ] = useState(false);

  const [
    showEventMenu,
    setShowEventMenu,
  ] = useState(false);

  const [form, setForm] =
    useState(getInitialForm);

  const [editForm, setEditForm] =
    useState(getInitialForm);

  const [
    formErrors,
    setFormErrors,
  ] = useState({});

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const menuRef = useRef(null);

  async function getAuthToken(
    forceRefresh = false
  ) {
    if (
      typeof auth.authStateReady ===
      "function"
    ) {
      await auth.authStateReady();
    }

    const firebaseUser =
      auth.currentUser;

    if (!firebaseUser) {
      return "";
    }

    const token =
      await firebaseUser.getIdToken(
        forceRefresh
      );

    /*
     * Temporary compatibility for
     * other older frontend modules.
     */
    window.localStorage.setItem(
      "token",
      token
    );

    return token;
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
      Authorization:
        `Bearer ${authToken}`,

      ...(
        options.body instanceof FormData
          ? {}
          : {
              "Content-Type":
                "application/json",
            }
      ),

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

      if (!refreshedToken) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

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
      payload = {};
    }

    if (!response.ok) {
      throw new Error(
        payload.message ||
          "The request could not be completed."
      );
    }

    return payload;
  }

  async function loadSites() {
    const response =
      await apiRequest("/sites");

    const records =
      Array.isArray(response.data)
        ? response.data
        : [];

    setSites(
      records.filter(
        (site) =>
          String(
            site?.status || ""
          )
            .trim()
            .toLowerCase() ===
          "active"
      )
    );
  }

  async function loadEvents() {
    const response =
      await apiRequest("/events");

    setEvents(
      Array.isArray(response.data)
        ? response.data.filter((event) =>
            EVENT_TYPES.includes(event?.type)
          )
        : []
    );
  }

  async function loadArchivedEvents() {
    if (!canManage) {
      setArchivedEvents([]);
      return;
    }

    const response =
      await apiRequest(
        "/events/archived"
      );

    setArchivedEvents(
      Array.isArray(response.data)
        ? response.data.filter((event) =>
            EVENT_TYPES.includes(event?.type)
          )
        : []
    );
  }

  async function loadInitialData() {
    setLoading(true);
    setInitialError("");

    try {
      await Promise.all([
        loadSites(),
        loadEvents(),
        canManage
          ? loadArchivedEvents()
          : Promise.resolve(),
      ]);
    } catch (error) {
      console.error(
        "Failed to load event calendar data:",
        error
      );

      setInitialError(
        "Unable to load event calendar data. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        loadInitialData();
      }, 0);

    return () =>
      window.clearTimeout(timer);
  }, [userRole]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleOutsideClick = (
      event
    ) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target
        )
      ) {
        setShowEventMenu(false);
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
    if (!successMessage) {
      return undefined;
    }

    const timer =
      window.setTimeout(() => {
        setSuccessMessage("");
      }, 3000);

    return () =>
      window.clearTimeout(timer);
  }, [successMessage]);

  const normalizedEvents =
    useMemo(
      () =>
        events.map((event) => ({
          ...event,
          status:
            getEventStatus(event),
        })),
      [events]
    );

  const counts = useMemo(
    () => ({
      total:
        normalizedEvents.length,

      upcoming:
        normalizedEvents.filter(
          (event) =>
            event.status ===
            "Upcoming"
        ).length,

      ongoing:
        normalizedEvents.filter(
          (event) =>
            event.status ===
            "Ongoing"
        ).length,

      completed:
        normalizedEvents.filter(
          (event) =>
            event.status ===
            "Completed"
        ).length,

      cancelled:
        normalizedEvents.filter(
          (event) =>
            event.status ===
            "Cancelled"
        ).length,
    }),
    [normalizedEvents]
  );

  const calendarDays =
    useMemo(() => {
      const year =
        calendarDate.getFullYear();

      const month =
        calendarDate.getMonth();

      const firstDay =
        new Date(
          year,
          month,
          1
        ).getDay();

      const daysInMonth =
        new Date(
          year,
          month + 1,
          0
        ).getDate();

      const previousMonthDays =
        new Date(
          year,
          month,
          0
        ).getDate();

      const cells = [];

      for (
        let index =
          firstDay - 1;
        index >= 0;
        index -= 1
      ) {
        const day =
          previousMonthDays -
          index;

        const previousMonthDate =
          new Date(
            year,
            month - 1,
            day
          );

        cells.push({
          date:
            previousMonthDate,
          day,
          currentMonth: false,
        });
      }

      for (
        let day = 1;
        day <= daysInMonth;
        day += 1
      ) {
        cells.push({
          date: new Date(
            year,
            month,
            day
          ),
          day,
          currentMonth: true,
        });
      }

      let nextDay = 1;

      while (
        cells.length < 42
      ) {
        cells.push({
          date: new Date(
            year,
            month + 1,
            nextDay
          ),
          day: nextDay,
          currentMonth: false,
        });

        nextDay += 1;
      }

      return cells;
    }, [calendarDate]);

  const selectedDateEvents =
    useMemo(
      () =>
        normalizedEvents
          .filter(
            (event) =>
              event.date ===
              selectedDate
          )
          .sort((a, b) =>
            String(
              a.startTime || ""
            ).localeCompare(
              String(
                b.startTime || ""
              )
            )
          ),
      [
        normalizedEvents,
        selectedDate,
      ]
    );

  const upcomingEvents =
    useMemo(() => {
      const now = new Date();

      return normalizedEvents
        .filter((event) => {
          if (
            event.status ===
              "Completed" ||
            event.status ===
              "Cancelled"
          ) {
            return false;
          }

          if (!event.date) {
            return false;
          }

          const eventDate =
            new Date(
              `${event.date}T${
                event.startTime ||
                "00:00"
              }`
            );

          return (
            eventDate >= now
          );
        })
        .sort((a, b) => {
          const first =
            new Date(
              `${a.date}T${
                a.startTime ||
                "00:00"
              }`
            );

          const second =
            new Date(
              `${b.date}T${
                b.startTime ||
                "00:00"
              }`
            );

          return first - second;
        })
        .slice(0, 5);
    }, [normalizedEvents]);

  const updateForm = (
    field,
    value
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setFormErrors(
      (previous) => ({
        ...previous,
        [field]: "",
      })
    );
  };

  const updateEditForm = (
    field,
    value
  ) => {
    setEditForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setFormErrors(
      (previous) => ({
        ...previous,
        [field]: "",
      })
    );
  };

  const validateForm = (
    data
  ) => {
    const errors = {};

    if (!data.name.trim()) {
      errors.name =
        "Event name is required.";
    }

    if (!data.type) {
      errors.type =
        "Event type is required.";
    }

    if (!data.date) {
      errors.date =
        "Event date is required.";
    }

    if (!data.startTime) {
      errors.startTime =
        "Start time is required.";
    }

    if (!data.endTime) {
      errors.endTime =
        "End time is required.";
    }

    if (
      data.startTime &&
      data.endTime &&
      data.endTime <=
        data.startTime
    ) {
      errors.endTime =
        "End time must be later than start time.";
    }

    if (!data.barangay) {
      errors.barangay =
        "Barangay is required.";
    }

    if (!data.plantingSiteId) {
      errors.plantingSiteId =
        "Planting site is required.";
    }

    if (
      !data.expectedParticipants ||
      Number(
        data.expectedParticipants
      ) < 1
    ) {
      errors.expectedParticipants =
        "Enter expected participants.";
    }

    return errors;
  };

  const resetForm = () => {
    setForm(getInitialForm());
    setFormErrors({});
  };

  const closeAddModal = () => {
    if (actionLoading) return;

    setShowAddModal(false);
    resetForm();
  };

  const showSuccess = (
    message
  ) => {
    setSuccessMessage(message);
  };

  const getSelectedSite = (
    siteId
  ) =>
    sites.find(
      (site) =>
        String(getSiteId(site)) ===
        String(siteId)
    ) || null;

  const buildEventPayload = (
    data
  ) => {
    const selectedSite =
      getSelectedSite(
        data.plantingSiteId
      );

    return {
      name: data.name.trim(),
      type: data.type,

      barangay:
        data.barangay,

      plantingSiteId:
        getSiteId(
          selectedSite
        ),

      /*
       * Keep event location empty
       * unless a real site record
       * actually provides one.
       */
      location:
        selectedSite?.location ||
        data.location?.trim() ||
        "",

      date: data.date,
      startTime:
        data.startTime,
      endTime:
        data.endTime,

      expectedParticipants:
        Number(
          data.expectedParticipants
        ),

      ...(data.actualParticipants !==
      ""
        ? {
            actualParticipants:
              Number(
                data.actualParticipants ||
                  0
              ),
          }
        : {}),

      organizer:
        data.organizer.trim(),

      description:
        data.description.trim(),
    };
  };

  const handleAddEvent =
    async (event) => {
      event.preventDefault();

      const errors =
        validateForm(form);

      if (
        Object.keys(errors)
          .length > 0
      ) {
        setFormErrors(errors);
        return;
      }

      setActionLoading(true);
      setPageError("");

      try {
        const response =
          await apiRequest(
            "/events",
            {
              method: "POST",
              body: JSON.stringify(
                buildEventPayload(
                  form
                )
              ),
            }
          );

        const newEvent =
          response.data;

        if (newEvent) {
          setEvents(
            (previous) => [
              newEvent,
              ...previous,
            ]
          );

          if (newEvent.date) {
            setSelectedDate(
              newEvent.date
            );

            setCalendarDate(
              new Date(
                `${newEvent.date}T00:00:00`
              )
            );
          }
        }

        closeAddModal();

        showSuccess(
          `${
            newEvent?.id ||
            newEvent?.eventId ||
            "Event"
          } was added successfully.`
        );
      } catch (error) {
        console.error(
          "Failed to create event:",
          error
        );

        setPageError(
          error.message ||
            "Failed to create event."
        );
      } finally {
        setActionLoading(false);
      }
    };

  const openEventDetails = (
    event
  ) => {
    setSelectedEvent(event);
    setShowEventMenu(false);
    setContributionItem("");
    setContributionQuantity("");
    setContributionError("");
    setContributions([]);
    if (userRole === "participant" && event?.id) {
      void apiRequest(`/events/${encodeURIComponent(event.id)}/contributions/my`)
        .then((response) => setContributions(Array.isArray(response.data) ? response.data : []))
        .catch((error) => setContributionError(error.message));
    }
  };

  async function recordContribution(eventSubmit) {
    eventSubmit.preventDefault();
    if (!selectedEvent?.id || !contributionItem) return;
    const quantity = Number(contributionQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setContributionError("Enter a positive whole-number quantity.");
      return;
    }
    setContributionLoading(true);
    setContributionError("");
    try {
      const id = encodeURIComponent(selectedEvent.id);
      await apiRequest(`/events/${id}/join`, { method: "POST" });
      await apiRequest(`/events/${id}/contributions`, {
        method: "POST",
        body: JSON.stringify({ inventoryId: contributionItem, quantity }),
      });
      const [eventResponse, ownResponse] = await Promise.all([
        apiRequest(`/events/${id}`),
        apiRequest(`/events/${id}/contributions/my`),
      ]);
      if (eventResponse.data) {
        setSelectedEvent(eventResponse.data);
        setEvents((previous) => previous.map((item) => item.id === selectedEvent.id ? eventResponse.data : item));
      }
      setContributions(Array.isArray(ownResponse.data) ? ownResponse.data : []);
      setContributionQuantity("");
    } catch (error) {
      setContributionError(error.message || "Unable to record planting.");
    } finally {
      setContributionLoading(false);
    }
  }

  const openEditEvent = () => {
    if (!selectedEvent) {
      return;
    }

    setEditForm({
      name:
        selectedEvent.name || "",

      type:
        selectedEvent.type ||
        "Tree Planting",

      barangay:
        selectedEvent.barangay ||
        "",

      plantingSiteId:
        selectedEvent.plantingSiteId ||
        "",

      location:
        selectedEvent.location ||
        "",

      date:
        selectedEvent.date || "",

      startTime:
        selectedEvent.startTime ||
        "",

      endTime:
        selectedEvent.endTime ||
        "",

      expectedParticipants:
        selectedEvent.expectedParticipants ??
        "",

      actualParticipants:
        selectedEvent.actualParticipants ??
        "",

      organizer:
        selectedEvent.organizer ||
        "",

      description:
        selectedEvent.description ||
        "",
    });

    setFormErrors({});
    setShowEditModal(true);
    setShowEventMenu(false);
  };

  const handleEditEvent =
    async (event) => {
      event.preventDefault();

      if (!selectedEvent) {
        return;
      }

      const errors =
        validateForm(editForm);

      if (
        Object.keys(errors)
          .length > 0
      ) {
        setFormErrors(errors);
        return;
      }

      setActionLoading(true);
      setPageError("");

      try {
        const eventId =
          selectedEvent.id ||
          selectedEvent.eventId;

        const response =
          await apiRequest(
            `/events/${eventId}`,
            {
              method: "PUT",
              body: JSON.stringify(
                buildEventPayload(
                  editForm
                )
              ),
            }
          );

        const updatedEvent =
          response.data;

        setEvents(
          (previous) =>
            previous.map(
              (item) =>
                (item.id ||
                  item.eventId) ===
                eventId
                  ? updatedEvent
                  : item
            )
        );

        setSelectedEvent(
          updatedEvent
        );

        setShowEditModal(false);
        setFormErrors({});

        showSuccess(
          `${eventId} was updated successfully.`
        );
      } catch (error) {
        console.error(
          "Failed to update event:",
          error
        );

        setPageError(
          error.message ||
            "Failed to update event."
        );
      } finally {
        setActionLoading(false);
      }
    };

  const markCompleted =
    async () => {
      if (!selectedEvent) {
        return;
      }

      setActionLoading(true);
      setPageError("");

      try {
        const eventId =
          selectedEvent.id ||
          selectedEvent.eventId;

        const response =
          await apiRequest(
            `/events/${eventId}/complete`,
            {
              method: "PATCH",
              body: JSON.stringify(
                {}
              ),
            }
          );

        const updated =
          response.data;

        setEvents(
          (previous) =>
            previous.map(
              (item) =>
                (item.id ||
                  item.eventId) ===
                eventId
                  ? updated
                  : item
            )
        );

        setSelectedEvent(
          updated
        );

        showSuccess(
          `${eventId} was marked as completed.`
        );
      } catch (error) {
        setPageError(
          error.message ||
            "Failed to complete event."
        );
      } finally {
        setActionLoading(false);
      }
    };

  const cancelEvent =
    async () => {
      if (!selectedEvent) {
        return;
      }

      const confirmed =
        window.confirm(
          `Cancel ${selectedEvent.name}?`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading(true);
      setPageError("");

      try {
        const eventId =
          selectedEvent.id ||
          selectedEvent.eventId;

        const response =
          await apiRequest(
            `/events/${eventId}/cancel`,
            {
              method: "PATCH",
              body: JSON.stringify(
                {}
              ),
            }
          );

        const updated =
          response.data;

        setEvents(
          (previous) =>
            previous.map(
              (item) =>
                (item.id ||
                  item.eventId) ===
                eventId
                  ? updated
                  : item
            )
        );

        setSelectedEvent(
          updated
        );

        setShowEventMenu(false);

        showSuccess(
          `${eventId} was cancelled.`
        );
      } catch (error) {
        setPageError(
          error.message ||
            "Failed to cancel event."
        );
      } finally {
        setActionLoading(false);
      }
    };

  const archiveEvent =
    async () => {
      if (!selectedEvent) {
        return;
      }

      const confirmed =
        window.confirm(
          `Archive ${selectedEvent.name}?`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading(true);
      setPageError("");

      try {
        const eventId =
          selectedEvent.id ||
          selectedEvent.eventId;

        const response =
          await apiRequest(
            `/events/${eventId}/archive`,
            {
              method: "PATCH",
              body: JSON.stringify(
                {}
              ),
            }
          );

        const archived =
          response.data;

        setEvents(
          (previous) =>
            previous.filter(
              (item) =>
                (item.id ||
                  item.eventId) !==
                eventId
            )
        );

        setArchivedEvents(
          (previous) => [
            archived,
            ...previous.filter(
              (item) =>
                (item.id ||
                  item.eventId) !==
                eventId
            ),
          ]
        );

        setSelectedEvent(null);
        setShowEventMenu(false);

        showSuccess(
          `${eventId} was archived.`
        );
      } catch (error) {
        setPageError(
          error.message ||
            "Failed to archive event."
        );
      } finally {
        setActionLoading(false);
      }
    };

  const deleteEvent =
    async () => {
      if (!selectedEvent) {
        return;
      }

      const confirmed =
        window.confirm(
          `Delete ${selectedEvent.name} permanently? This cannot be undone.`
        );

      if (!confirmed) {
        return;
      }

      setActionLoading(true);
      setPageError("");

      try {
        const eventId =
          selectedEvent.id ||
          selectedEvent.eventId;

        await apiRequest(
          `/events/${eventId}`,
          {
            method: "DELETE",
          }
        );

        setEvents(
          (previous) =>
            previous.filter(
              (item) =>
                (item.id ||
                  item.eventId) !==
                eventId
            )
        );

        setArchivedEvents(
          (previous) =>
            previous.filter(
              (item) =>
                (item.id ||
                  item.eventId) !==
                eventId
            )
        );

        setSelectedEvent(null);
        setShowEventMenu(false);

        showSuccess(
          `${eventId} was deleted permanently.`
        );
      } catch (error) {
        setPageError(
          error.message ||
            "Failed to delete event."
        );
      } finally {
        setActionLoading(false);
      }
    };

  const restoreArchivedEvent =
    async (eventId) => {
      setActionLoading(true);
      setPageError("");

      try {
        const response =
          await apiRequest(
            `/events/${eventId}/restore`,
            {
              method: "PATCH",
              body: JSON.stringify(
                {}
              ),
            }
          );

        const restored =
          response.data;

        setArchivedEvents(
          (previous) =>
            previous.filter(
              (event) =>
                (event.id ||
                  event.eventId) !==
                eventId
            )
        );

        setEvents(
          (previous) => [
            restored,
            ...previous.filter(
              (event) =>
                (event.id ||
                  event.eventId) !==
                eventId
            ),
          ]
        );

        showSuccess(
          `${eventId} was restored.`
        );
      } catch (error) {
        setPageError(
          error.message ||
            "Failed to restore event."
        );
      } finally {
        setActionLoading(false);
      }
    };

  const goToPreviousMonth =
    () => {
      setCalendarDate(
        (previous) =>
          new Date(
            previous.getFullYear(),
            previous.getMonth() -
              1,
            1
          )
      );
    };

  const goToNextMonth = () => {
    setCalendarDate(
      (previous) =>
        new Date(
          previous.getFullYear(),
          previous.getMonth() +
            1,
          1
        )
    );
  };

  const goToToday = () => {
    const current = new Date();

    setCalendarDate(
      new Date(
        current.getFullYear(),
        current.getMonth(),
        1
      )
    );

    setSelectedDate(
      formatDateKey(
        current.getFullYear(),
        current.getMonth(),
        current.getDate()
      )
    );
  };

  if (loading) {
    return (
      <div className="event-calendar-page">
        <div style={{ minHeight: "420px", display: "grid", placeItems: "center", color: "#526159", fontSize: "13px", fontWeight: 600 }}>Loading events...</div>
      </div>
    );
  }

  if (initialError) {
    return <div className="event-calendar-page"><div role="alert" style={{ minHeight: "420px", display: "grid", placeContent: "center", justifyItems: "center", gap: "14px", color: "#526159", fontSize: "13px", fontWeight: 600 }}><span>{initialError}</span><button type="button" className="ec-secondary-btn" onClick={loadInitialData}>Retry</button></div></div>;
  }

  return (
    <div className="event-calendar-page">
      <section className="ec-page-header">
        <div className="ec-title-wrap">
          <div className="ec-title-icon">
            <CalendarDays
              size={21}
              strokeWidth={1.8}
            />
          </div>

          <div>
            <h1>Event Calendar</h1>

            <p>
              {canManage
                ? "Manage planting events, schedules, and MENRO environmental activities."
                : ""}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="ec-header-actions">
            <button
              type="button"
              className="ec-secondary-btn"
              disabled={actionLoading}
              onClick={async () => {
                try {
                  await loadArchivedEvents();
                  setShowArchiveModal(
                    true
                  );
                } catch (error) {
                  setPageError(
                    error.message
                  );
                }
              }}
            >
              <Archive size={15} />
              Archived Events
            </button>

            <button
              type="button"
              className="ec-primary-btn"
              disabled={actionLoading}
              onClick={() => {
                resetForm();

                setForm(
                  (previous) => ({
                    ...previous,
                    date:
                      selectedDate,
                  })
                );

                setShowAddModal(
                  true
                );
              }}
            >
              <Plus size={16} />
              Add Event
            </button>
          </div>
        )}
      </section>

      {successMessage && (
        <div className="ec-success-message">
          <CircleCheckBig
            size={16}
          />
          {successMessage}
        </div>
      )}

      {pageError && (
        <div
          className="ec-success-message"
          role="alert"
        >
          <XCircle size={16} />
          {pageError}
        </div>
      )}

      {canManage && (
        <section className="ec-kpi-grid">
          <KpiCard
            label="Total Events"
            value={counts.total}
            icon={CalendarDays}
            variant="green"
          />

          <KpiCard
            label="Upcoming"
            value={
              counts.upcoming
            }
            icon={Clock3}
            variant="blue"
          />

          <KpiCard
            label="Ongoing"
            value={
              counts.ongoing
            }
            icon={Activity}
            variant="orange"
          />

          <KpiCard
            label="Completed"
            value={
              counts.completed
            }
            icon={CircleCheckBig}
            variant="green"
          />

          <KpiCard
            label="Cancelled"
            value={
              counts.cancelled
            }
            icon={XCircle}
            variant="red"
          />
        </section>
      )}

      <section className="ec-main-grid">
          <div className="ec-calendar-card">
            <div className="ec-calendar-toolbar">
              <div className="ec-month-navigation">
                <button
                  type="button"
                  onClick={
                    goToPreviousMonth
                  }
                  aria-label="Previous month"
                >
                  <ChevronLeft
                    size={17}
                  />
                </button>

                <div>
                  <strong>
                    {
                      MONTHS[
                        calendarDate.getMonth()
                      ]
                    }{" "}
                    {calendarDate.getFullYear()}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={
                    goToNextMonth
                  }
                  aria-label="Next month"
                >
                  <ChevronRight
                    size={17}
                  />
                </button>

                <button
                  type="button"
                  className="ec-today-btn"
                  onClick={
                    goToToday
                  }
                >
                  Today
                </button>
              </div>

              <div className="ec-calendar-legend">
                <span>
                  <i className="tree-planting" />
                  Tree Planting
                </span>

                <span>
                  <i className="other" />
                  Other
                </span>
              </div>
            </div>

            <div className="ec-week-header">
              {WEEK_DAYS.map(
                (day) => (
                  <div key={day}>
                    {day}
                  </div>
                )
              )}
            </div>

            <div className="ec-calendar-grid">
              {calendarDays.map(
                (cell) => {
                  const dateKey =
                    formatDateKey(
                      cell.date.getFullYear(),
                      cell.date.getMonth(),
                      cell.date.getDate()
                    );

                  const dayEvents =
                    normalizedEvents.filter(
                      (event) =>
                        event.date ===
                        dateKey
                    );

                  const isToday =
                    dateKey ===
                    formatDateKey(
                      today.getFullYear(),
                      today.getMonth(),
                      today.getDate()
                    );

                  const isSelected =
                    dateKey ===
                    selectedDate;

                  return (
                    <button
                      type="button"
                      className={`ec-calendar-day ${
                        !cell.currentMonth
                          ? "outside-month"
                          : ""
                      } ${
                        isSelected
                          ? "selected"
                          : ""
                      }`}
                      key={dateKey}
                      onClick={() =>
                        setSelectedDate(
                          dateKey
                        )
                      }
                    >
                      <div className="ec-day-number-row">
                        <span
                          className={
                            isToday
                              ? "today"
                              : ""
                          }
                        >
                          {cell.day}
                        </span>
                      </div>

                      <div className="ec-day-events">
                        {dayEvents
                          .slice(0, 3)
                          .map(
                            (event) => {
                              const Icon =
                                getEventTypeIcon(
                                  event.type
                                );

                              return (
                                <div
                                  key={
                                    event.id ||
                                    event.eventId
                                  }
                                  className={`ec-calendar-event ${getEventTypeClass(
                                    event.type
                                  )}`}
                                  onClick={(
                                    clickEvent
                                  ) => {
                                    clickEvent.stopPropagation();

                                    openEventDetails(
                                      event
                                    );
                                  }}
                                >
                                  <Icon
                                    size={
                                      11
                                    }
                                  />

                                  <span>
                                    {event.startTime
                                      ? formatTime(
                                          event.startTime
                                        )
                                      : ""}{" "}
                                    {
                                      event.name
                                    }
                                  </span>
                                </div>
                              );
                            }
                          )}

                        {dayEvents.length >
                          3 && (
                          <span className="ec-more-events">
                            +
                            {dayEvents.length -
                              3}{" "}
                            more
                          </span>
                        )}
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <aside className="ec-side-column">
            <section className="ec-side-card">
              <div className="ec-side-heading">
                <div>
                  <span>
                    Selected Date
                  </span>

                  <h2>
                    {formatDate(
                      selectedDate
                    )}
                  </h2>
                </div>

                <CalendarDays
                  size={18}
                />
              </div>

              <div className="ec-selected-events">
                {selectedDateEvents.length ===
                0 ? (
                  <div className="ec-side-empty">
                    <CalendarDays
                      size={28}
                      strokeWidth={
                        1.5
                      }
                    />

                    <strong>
                      No events
                    </strong>

                    <span>
                      No scheduled
                      events for this
                      date.
                    </span>
                  </div>
                ) : (
                  selectedDateEvents.map(
                    (event) => (
                      <button
                        type="button"
                        className="ec-side-event"
                        key={
                          event.id ||
                          event.eventId
                        }
                        onClick={() =>
                          openEventDetails(
                            event
                          )
                        }
                      >
                        <div
                          className={`ec-side-event-mark ${getEventTypeClass(
                            event.type
                          )}`}
                        />

                        <div className="ec-side-event-copy">
                          <strong>
                            {
                              event.name
                            }
                          </strong>

                          <span>
                            {formatTime(
                              event.startTime
                            )}{" "}
                            -{" "}
                            {formatTime(
                              event.endTime
                            )}
                          </span>

                          <small>
                            {event.barangay ||
                              "No barangay"}
                          </small>
                        </div>

                        <StatusBadge
                          status={
                            event.status
                          }
                        />
                      </button>
                    )
                  )
                )}
              </div>
            </section>

            <section className="ec-side-card">
              <div className="ec-side-title-line">
                <h2>
                  Upcoming Events
                </h2>

                <span>
                  {
                    upcomingEvents.length
                  }
                </span>
              </div>

              <div className="ec-upcoming-list">
                {upcomingEvents.length ===
                0 ? (
                  <div className="ec-small-empty">
                    No upcoming
                    events.
                  </div>
                ) : (
                  upcomingEvents.map(
                    (event) => (
                      <button
                        type="button"
                        className="ec-upcoming-event"
                        key={
                          event.id ||
                          event.eventId
                        }
                        onClick={() => {
                          setSelectedDate(
                            event.date
                          );

                          setCalendarDate(
                            new Date(
                              `${event.date}T00:00:00`
                            )
                          );

                          openEventDetails(
                            event
                          );
                        }}
                      >
                        <div className="ec-upcoming-date">
                          <strong>
                            {new Date(
                              `${event.date}T00:00:00`
                            ).getDate()}
                          </strong>

                          <span>
                            {MONTHS[
                              new Date(
                                `${event.date}T00:00:00`
                              ).getMonth()
                            ]
                              .slice(
                                0,
                                3
                              )
                              .toUpperCase()}
                          </span>
                        </div>

                        <div>
                          <strong>
                            {
                              event.name
                            }
                          </strong>

                          <span>
                            {formatTime(
                              event.startTime
                            )}
                          </span>

                          <small>
                            {event.barangay ||
                              "—"}
                          </small>
                        </div>
                      </button>
                    )
                  )
                )}
              </div>
            </section>
          </aside>
        </section>

      {showAddModal && (
        <div className="ec-modal-backdrop">
          <div className="ec-modal">
            <div className="ec-modal-header">
              <div>
                <h2>Add Event</h2>

                <p>
                  Create a new MENRO
                  environmental
                  activity.
                </p>
              </div>

              <button
                type="button"
                className="ec-modal-close"
                onClick={
                  closeAddModal
                }
                disabled={
                  actionLoading
                }
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="ec-modal-body"
              onSubmit={
                handleAddEvent
              }
            >
              <EventForm
                form={form}
                errors={
                  formErrors
                }
                updateForm={
                  updateForm
                }
                sites={sites}
              />

              <div className="ec-modal-footer">
                <button
                  type="button"
                  className="ec-secondary-btn"
                  onClick={
                    closeAddModal
                  }
                  disabled={
                    actionLoading
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="ec-primary-btn"
                  disabled={
                    actionLoading
                  }
                >
                  <Plus size={15} />

                  {actionLoading
                    ? "Adding..."
                    : "Add Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEvent &&
        !showEditModal && (
          <div className="ec-modal-backdrop">
            <div className="ec-modal ec-details-modal">
              <div className="ec-modal-header">
                <div>
                  <span className="ec-detail-id">
                    {selectedEvent.id ||
                      selectedEvent.eventId}
                  </span>

                  <h2>
                    {
                      selectedEvent.name
                    }
                  </h2>

                  <p>
                    {
                      selectedEvent.type
                    }
                  </p>
                </div>

                <div className="ec-detail-head-actions">
                  {canManage && (
                    <div
                      className="ec-event-menu-wrap"
                      ref={
                        menuRef
                      }
                    >
                      <button
                        type="button"
                        className="ec-event-menu-btn"
                        disabled={
                          actionLoading
                        }
                        onClick={() =>
                          setShowEventMenu(
                            (
                              previous
                            ) =>
                              !previous
                          )
                        }
                      >
                        <EllipsisVertical
                          size={
                            18
                          }
                        />
                      </button>

                      {showEventMenu && (
                        <div className="ec-event-menu">
                          {selectedEvent.status !==
                            "Cancelled" && (
                            <button
                              type="button"
                              onClick={
                                cancelEvent
                              }
                            >
                              <XCircle
                                size={
                                  15
                                }
                              />
                              Cancel
                              Event
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={
                              deleteEvent
                            }
                            className="danger"
                          >
                            <Trash2
                              size={
                                15
                              }
                            />
                            Delete
                            Permanently
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    className="ec-modal-close"
                    disabled={
                      actionLoading
                    }
                    onClick={() => {
                      setSelectedEvent(
                        null
                      );
                      setShowEventMenu(
                        false
                      );
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="ec-modal-body">
                <div className="ec-detail-status-row">
                  <StatusBadge
                    status={getEventStatus(
                      selectedEvent
                    )}
                  />

                  <span
                    className={`ec-event-type-badge ${getEventTypeClass(
                      selectedEvent.type
                    )}`}
                  >
                    {
                      selectedEvent.type
                    }
                  </span>
                </div>

                <div className="ec-detail-grid">
                  <DetailItem
                    icon={
                      CalendarDays
                    }
                    label="Date"
                    value={formatDate(
                      selectedEvent.date
                    )}
                  />

                  <DetailItem
                    icon={Clock3}
                    label="Time"
                    value={`${formatTime(
                      selectedEvent.startTime
                    )} - ${formatTime(
                      selectedEvent.endTime
                    )}`}
                  />

                  <DetailItem
                    icon={MapPin}
                    label="Barangay"
                    value={
                      selectedEvent.barangay
                    }
                  />

                  <DetailItem
                    icon={Sprout}
                    label="Planting Site"
                    value={
                      selectedEvent.plantingSiteId
                        ? `${selectedEvent.plantingSiteId} - ${
                            selectedEvent.plantingSiteName ||
                            ""
                          }`
                        : "—"
                    }
                  />

                  <DetailItem
                    icon={MapPin}
                    label="Location"
                    value={
                      selectedEvent.location ||
                      "—"
                    }
                    fullWidth
                  />

                  <DetailItem
                    icon={Users}
                    label="Expected Participants"
                    value={
                      selectedEvent.expectedParticipants
                    }
                  />

                  <DetailItem
                    icon={Users}
                    label="Actual Participants"
                    value={
                      selectedEvent.actualParticipants ??
                      "—"
                    }
                  />

                  {selectedEvent.recordStatus && (
                    <DetailItem
                      icon={CalendarDays}
                      label="Record Status"
                      value={selectedEvent.recordStatus}
                    />
                  )}

                  {(selectedEvent.sourceRequestId || selectedEvent.requestId) && (
                    <DetailItem
                      icon={Sprout}
                      label="Source Request"
                      value={selectedEvent.sourceRequestId || selectedEvent.requestId}
                    />
                  )}

                  {selectedEvent.sourceRequestId && selectedEvent.allocationReleasedAt &&
                    Array.isArray(selectedEvent.seedlingItems) && selectedEvent.seedlingItems.map((item, index) => (
                      <DetailItem
                        key={`${item.inventoryId}-${index}`}
                        icon={Sprout}
                        label={`${item.species} Allocation`}
                        value={item.quantity}
                      />
                    ))}

                  {selectedEvent.sourceRequestId && !selectedEvent.allocationReleasedAt && (
                    <DetailItem icon={Sprout} label="Event Allocation" value="Awaiting Seedling Release" />
                  )}

                  <DetailItem
                    icon={Users}
                    label="Organizer / Created By"
                    value={
                      selectedEvent.organizer ||
                      "—"
                    }
                    fullWidth
                  />
                </div>

                {userRole === "participant" && selectedEvent.allocationReleasedAt &&
                  Array.isArray(selectedEvent.seedlingItems) && selectedEvent.seedlingItems.length > 0 && (
                    <div className="ec-detail-description">
                      <h3>Record My Planting</h3>
                      <p>Joining registers you for this event; it does not confirm physical attendance.</p>
                      <form onSubmit={recordContribution}>
                        <label className="ec-form-field full-width">
                          <span>Seedling *</span>
                          <select required value={contributionItem} onChange={(event) => setContributionItem(event.target.value)}>
                            <option value="">Select allocated seedling</option>
                            {selectedEvent.seedlingItems.map((item) => (
                              <option key={item.inventoryId} value={item.inventoryId}>
                                {item.species} — {Math.max(0, Number(item.quantity) - Number(selectedEvent.recordedSeedlingsByInventory?.[item.inventoryId] || 0))} remaining
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="ec-form-field full-width">
                          <span>Quantity planted *</span>
                          <input type="number" min="1" step="1" required value={contributionQuantity}
                            onChange={(event) => setContributionQuantity(event.target.value)} />
                        </label>
                        {contributionError && <p role="alert">{contributionError}</p>}
                        <button className="ec-primary-btn" type="submit" disabled={contributionLoading}>
                          {contributionLoading ? "Recording..." : "Join and Record Planting"}
                        </button>
                      </form>
                      <h3>My Contributions</h3>
                      {contributions.length ? <ul>{contributions.map((item) => (
                        <li key={item.id}>{item.species}: {item.quantity}</li>
                      ))}</ul> : <p>No planting contributions recorded yet.</p>}
                    </div>
                  )}

                {selectedEvent.description && (
                  <div className="ec-detail-description">
                    <span>
                      Event
                      Description
                    </span>

                    <p>
                      {
                        selectedEvent.description
                      }
                    </p>
                  </div>
                )}

                <div className="ec-detail-meta">
                  <span>
                    Created:{" "}
                    {formatDateTime(
                      selectedEvent.createdAt
                    )}
                  </span>

                  <span>
                    Last Updated:{" "}
                    {formatDateTime(
                      selectedEvent.updatedAt
                    )}
                  </span>
                </div>
              </div>

              <div className="ec-modal-footer ec-details-footer">
                {canManage && (
                  <button
                    type="button"
                    className="ec-archive-btn"
                    onClick={
                      archiveEvent
                    }
                    disabled={
                      actionLoading
                    }
                  >
                    <Archive
                      size={15}
                    />

                    Archive
                  </button>
                )}

                <div className="ec-detail-footer-actions">
                  {canManage &&
                    getEventStatus(
                      selectedEvent
                    ) !==
                      "Completed" &&
                    getEventStatus(
                      selectedEvent
                    ) !==
                      "Cancelled" && (
                      <button
                        type="button"
                        className="ec-complete-btn"
                        onClick={
                          markCompleted
                        }
                        disabled={
                          actionLoading
                        }
                      >
                        <Check
                          size={
                            15
                          }
                        />

                        {actionLoading
                          ? "Saving..."
                          : "Mark Completed"}
                      </button>
                    )}

                  {canManage && (
                    <button
                      type="button"
                      className="ec-secondary-btn"
                      onClick={
                        openEditEvent
                      }
                      disabled={
                        actionLoading
                      }
                    >
                      <Edit3
                        size={14}
                      />

                      Edit Event
                    </button>
                  )}

                  <button
                    type="button"
                    className="ec-secondary-btn"
                    disabled={
                      actionLoading
                    }
                    onClick={() =>
                      setSelectedEvent(
                        null
                      )
                    }
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {showEditModal &&
        selectedEvent && (
          <div className="ec-modal-backdrop">
            <div className="ec-modal">
              <div className="ec-modal-header">
                <div>
                  <span className="ec-detail-id">
                    {selectedEvent.id ||
                      selectedEvent.eventId}
                  </span>

                  <h2>
                    Edit Event
                  </h2>

                  <p>
                    Update event
                    information.
                  </p>
                </div>

                <button
                  type="button"
                  className="ec-modal-close"
                  disabled={
                    actionLoading
                  }
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
                className="ec-modal-body"
                onSubmit={
                  handleEditEvent
                }
              >
                <EventForm
                  form={
                    editForm
                  }
                  errors={
                    formErrors
                  }
                  updateForm={
                    updateEditForm
                  }
                  sites={sites}
                  editMode
                />

                <div className="ec-modal-footer">
                  <button
                    type="button"
                    className="ec-secondary-btn"
                    disabled={
                      actionLoading
                    }
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
                    className="ec-primary-btn"
                    disabled={
                      actionLoading
                    }
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

      {canManage &&
        showArchiveModal && (
          <div className="ec-modal-backdrop">
            <div className="ec-modal ec-archive-modal">
              <div className="ec-modal-header">
                <div>
                  <h2>
                    Archived Events
                  </h2>

                  <p>
                    View or restore
                    archived event
                    records.
                  </p>
                </div>

                <button
                  type="button"
                  className="ec-modal-close"
                  disabled={
                    actionLoading
                  }
                  onClick={() =>
                    setShowArchiveModal(
                      false
                    )
                  }
                >
                  <X size={18} />
                </button>
              </div>

              <div className="ec-archive-body">
                {archivedEvents.length ===
                0 ? (
                  <div className="ec-archive-empty">
                    <Archive
                      size={31}
                      strokeWidth={
                        1.5
                      }
                    />

                    <h3>
                      No archived
                      events
                    </h3>

                    <p>
                      Archived event
                      records will
                      appear here.
                    </p>
                  </div>
                ) : (
                  archivedEvents.map(
                    (event) => {
                      const eventId =
                        event.id ||
                        event.eventId;

                      return (
                        <div
                          className="ec-archive-row"
                          key={
                            eventId
                          }
                        >
                          <div>
                            <strong>
                              {
                                event.name
                              }
                            </strong>

                            <span>
                              {
                                eventId
                              }{" "}
                              ·{" "}
                              {formatShortDate(
                                event.date
                              )}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={
                              actionLoading
                            }
                            onClick={() =>
                              restoreArchivedEvent(
                                eventId
                              )
                            }
                          >
                            <RotateCcw
                              size={
                                14
                              }
                            />

                            Restore
                          </button>
                        </div>
                      );
                    }
                  )
                )}
              </div>

              <div className="ec-modal-footer">
                <button
                  type="button"
                  className="ec-secondary-btn"
                  disabled={
                    actionLoading
                  }
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
  icon: Icon,
  variant,
}) {
  return (
    <div className="ec-kpi-card">
      <div
        className={`ec-kpi-icon ${variant}`}
      >
        <Icon
          size={23}
          strokeWidth={1.8}
        />
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function EventForm({
  form,
  errors,
  updateForm,
  sites,
  editMode = false,
}) {
  const availableSites =
    useMemo(() => {
      if (!form.barangay) {
        return [];
      }

      return sites.filter(
        (site) =>
          getSiteBarangay(site)
            .trim()
            .toLowerCase() ===
          form.barangay
            .trim()
            .toLowerCase()
      );
    }, [
      sites,
      form.barangay,
    ]);

  return (
    <div className="ec-form-sections">
      <section className="ec-form-section">
        <div className="ec-form-section-title">
          <h3>
            Event Information
          </h3>
        </div>

        <div className="ec-form-grid">
          <FormField
            label="Event Name *"
            error={errors.name}
            fullWidth
          >
            <input
              type="text"
              value={form.name}
              placeholder="Enter event name"
              onChange={(event) =>
                updateForm(
                  "name",
                  event.target.value
                )
              }
            />
          </FormField>

          <FormField
            label="Event Type *"
            error={errors.type}
          >
            <select
              value={form.type}
              onChange={(event) =>
                updateForm(
                  "type",
                  event.target.value
                )
              }
            >
              {EVENT_TYPES.map(
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

          <FormField label="Organizer / Created By">
            <input
              type="text"
              value={
                form.organizer
              }
              placeholder="e.g. MENRO Office"
              onChange={(event) =>
                updateForm(
                  "organizer",
                  event.target.value
                )
              }
            />
          </FormField>
        </div>
      </section>

      <section className="ec-form-section">
        <div className="ec-form-section-title">
          <h3>Schedule</h3>
        </div>

        <div className="ec-form-grid">
          <FormField
            label="Event Date *"
            error={errors.date}
          >
            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                updateForm(
                  "date",
                  event.target.value
                )
              }
            />
          </FormField>

          <div />

          <FormField
            label="Start Time *"
            error={
              errors.startTime
            }
          >
            <input
              type="time"
              value={
                form.startTime
              }
              onChange={(event) =>
                updateForm(
                  "startTime",
                  event.target.value
                )
              }
            />
          </FormField>

          <FormField
            label="End Time *"
            error={
              errors.endTime
            }
          >
            <input
              type="time"
              value={
                form.endTime
              }
              onChange={(event) =>
                updateForm(
                  "endTime",
                  event.target.value
                )
              }
            />
          </FormField>
        </div>
      </section>

      <section className="ec-form-section">
        <div className="ec-form-section-title">
          <h3>Location</h3>
        </div>

        <div className="ec-form-grid">
          <FormField
            label="Barangay *"
            error={
              errors.barangay
            }
          >
            <select
              value={
                form.barangay
              }
              onChange={(event) => {
                updateForm(
                  "barangay",
                  event.target.value
                );

                updateForm(
                  "plantingSiteId",
                  ""
                );

                updateForm(
                  "location",
                  ""
                );
              }}
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
                    {barangay}
                  </option>
                )
              )}
            </select>
          </FormField>

          <FormField
            label="Planting Site *"
            error={
              errors.plantingSiteId
            }
          >
            <select
              value={
                form.plantingSiteId
              }
              disabled={
                !form.barangay
              }
              onChange={(
                event
              ) => {
                const siteId =
                  event.target.value;

                updateForm(
                  "plantingSiteId",
                  siteId
                );

                const selectedSite =
                  sites.find(
                    (site) =>
                      String(
                        getSiteId(
                          site
                        )
                      ) ===
                      String(
                        siteId
                      )
                  );

                updateForm(
                  "location",
                  selectedSite?.location ||
                    ""
                );
              }}
            >
              <option value="">
                {!form.barangay
                  ? "Select barangay first"
                  : availableSites.length ===
                    0
                  ? "No registered site available"
                  : "Select planting site"}
              </option>

              {availableSites.map(
                (site) => (
                  <option
                    key={getSiteId(
                      site
                    )}
                    value={getSiteId(
                      site
                    )}
                  >
                    {getSiteId(
                      site
                    )}{" "}
                    -{" "}
                    {getSiteName(
                      site
                    )}
                  </option>
                )
              )}
            </select>

            {form.barangay &&
              availableSites.length ===
                0 && (
                <small>
                  No active
                  registered
                  planting site is
                  available for{" "}
                  {form.barangay}.
                </small>
              )}
          </FormField>

          <FormField
            label="Event Location"
            fullWidth
          >
            <input
              type="text"
              value={
                form.location
              }
              placeholder="Location will appear when the registered site has a saved location"
              readOnly
            />
          </FormField>
        </div>
      </section>

      <section className="ec-form-section">
        <div className="ec-form-section-title">
          <h3>
            Participation
          </h3>
        </div>

        <div className="ec-form-grid">
          <FormField
            label="Expected Participants *"
            error={
              errors.expectedParticipants
            }
          >
            <input
              type="number"
              min="1"
              value={
                form.expectedParticipants
              }
              placeholder="Enter expected participants"
              onChange={(event) =>
                updateForm(
                  "expectedParticipants",
                  event.target.value
                )
              }
            />
          </FormField>

          {editMode ? (
            <FormField label="Actual Participants">
              <input
                type="number"
                min="0"
                value={
                  form.actualParticipants
                }
                placeholder="Enter actual attendance"
                onChange={(
                  event
                ) =>
                  updateForm(
                    "actualParticipants",
                    event.target.value
                  )
                }
              />
            </FormField>
          ) : (
            <div />
          )}

          <FormField
            label="Event Description"
            fullWidth
          >
            <textarea
              value={
                form.description
              }
              placeholder="Enter event description"
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
      className={`ec-form-field ${
        fullWidth
          ? "full-width"
          : ""
      }`}
    >
      <span>{label}</span>

      {children}

      {error && (
        <small>{error}</small>
      )}
    </label>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
  fullWidth = false,
}) {
  return (
    <div
      className={`ec-detail-item ${
        fullWidth
          ? "full-width"
          : ""
      }`}
    >
      <div className="ec-detail-item-icon">
        <Icon size={15} />
      </div>

      <div>
        <span>{label}</span>

        <strong>
          {value ?? "—"}
        </strong>
      </div>
    </div>
  );
}
