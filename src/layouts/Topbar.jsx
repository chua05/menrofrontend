import { useEffect, useRef, useState } from "react";
import { Bell, Menu, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const SAMPLE_NOTIFICATIONS = {
  alerts: [
    {
      id: 1,
      message: "New seedling request submitted.",
      time: "2 mins ago",
      read: false,
    },
    {
      id: 2,
      message: "Seedling request SR-2026-0041 was approved.",
      time: "1 hour ago",
      read: false,
    },
  ],

  events: [
    {
      id: 3,
      message: "Barangay Roque Tree Planting Activity was scheduled.",
      time: "Yesterday",
      read: false,
    },
  ],

  logs: [
    {
      id: 4,
      message: "Planting report PR-2026-001 was approved.",
      time: "Aug 25, 2026",
      read: true,
    },
  ],
};

function getDisplayName(user, role) {
  if (user?.fullName?.trim()) {
    return user.fullName;
  }

  if (role === "admin") return "MENRO Administrator";
  if (role === "staff") return "MENRO Staff";

  return "Participant";
}

function getRoleLabel(role) {
  if (role === "admin") return "Office Head";
  if (role === "staff") return "Staff";

  return "Participant";
}

function getInitials(name, role) {
  if (!name) {
    if (role === "admin") return "MA";
    if (role === "staff") return "MS";

    return "P";
  }

  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getSearchPlaceholder(role) {
  if (role === "participant") {
    return "Search reports, sites, events...";
  }

  return "Search requests, reports, sites, users...";
}

export default function Topbar({ onOpenSidebar }) {
  const { currentUser, userRole } = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState("alerts");
  const [notifications, setNotifications] = useState(
    SAMPLE_NOTIFICATIONS
  );

  const notificationRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  const allNotifications = [
    ...notifications.alerts,
    ...notifications.events,
    ...notifications.logs,
  ];

  const unreadCount = allNotifications.filter(
    (notification) => !notification.read
  ).length;

  const currentNotifications =
    notifications[activeTab] || [];

  const displayName = getDisplayName(
    currentUser,
    userRole
  );

  const roleLabel = getRoleLabel(userRole);

  const initials = getInitials(
    displayName,
    userRole
  );

  const handleMarkRead = (tab, id) => {
    setNotifications((previous) => ({
      ...previous,

      [tab]: previous[tab].map((notification) =>
        notification.id === id
          ? {
              ...notification,
              read: true,
            }
          : notification
      ),
    }));
  };

  const handleMarkAllRead = () => {
    setNotifications((previous) => ({
      alerts: previous.alerts.map((item) => ({
        ...item,
        read: true,
      })),

      events: previous.events.map((item) => ({
        ...item,
        read: true,
      })),

      logs: previous.logs.map((item) => ({
        ...item,
        read: true,
      })),
    }));
  };

  return (
    <header className="topbar">
      {/* LEFT SIDE */}
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-btn"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          title="Open navigation"
        >
          <Menu
            size={20}
            strokeWidth={1.8}
          />
        </button>

        <div className="topbar-search">
          <input
            type="search"
            placeholder={getSearchPlaceholder(userRole)}
            aria-label="Search system"
          />

          <Search
            className="topbar-search-icon"
            size={17}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="topbar-right">
        {/* Notifications */}
        <div
          className="notification-wrap"
          ref={notificationRef}
        >
          <button
            type="button"
            className="topbar-icon-btn"
            onClick={() =>
              setShowNotifications(
                (previous) => !previous
              )
            }
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell
              size={19}
              strokeWidth={1.8}
            />

            {unreadCount > 0 && (
              <span className="topbar-notif-dot">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="notification-panel">
              <div className="notification-head">
                <div className="notification-title">
                  Notifications
                </div>

                <div className="notification-tabs">
                  {["alerts", "events", "logs"].map(
                    (tab) => (
                      <button
                        type="button"
                        key={tab}
                        className={`notification-tab ${
                          activeTab === tab
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setActiveTab(tab)
                        }
                      >
                        {tab
                          .charAt(0)
                          .toUpperCase() +
                          tab.slice(1)}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="notification-list">
                {currentNotifications.length ===
                0 ? (
                  <div className="notification-empty">
                    No notifications.
                  </div>
                ) : (
                  currentNotifications.map(
                    (notification) => (
                      <button
                        type="button"
                        key={notification.id}
                        className={`notification-item ${
                          notification.read
                            ? ""
                            : "unread"
                        }`}
                        onClick={() =>
                          handleMarkRead(
                            activeTab,
                            notification.id
                          )
                        }
                      >
                        <span
                          className={`notification-dot ${
                            notification.read
                              ? "read"
                              : ""
                          }`}
                        />

                        <span className="notification-item-content">
                          <span className="notification-message">
                            {notification.message}
                          </span>

                          <span className="notification-time">
                            {notification.time}
                          </span>
                        </span>
                      </button>
                    )
                  )
                )}
              </div>

              <div className="notification-footer">
                <button
                  type="button"
                  className="notification-close"
                  onClick={() =>
                    setShowNotifications(false)
                  }
                >
                  Close
                </button>

                <button
                  type="button"
                  className="notification-read-all"
                  onClick={handleMarkAllRead}
                >
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Current User */}
        <div className="topbar-user">
          <div className="topbar-user-copy">
            <div className="topbar-user-name">
              {displayName}
            </div>

            <div className="topbar-user-role">
              {roleLabel}
            </div>
          </div>

          <div className="topbar-avatar">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}