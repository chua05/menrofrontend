import { useEffect, useRef, useState } from "react";
import { Bell, Menu, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase/config";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");

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

  useEffect(() => {
    if (!showNotifications) return;
    let cancelled = false;
    async function loadNotifications() {
      setNotificationLoading(true);
      setNotificationError("");
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Please sign in again.");
        const response = await fetch(`${API_BASE_URL}/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message || "Unable to load notifications.");
        if (!cancelled) setNotifications(payload?.data?.notifications || []);
      } catch (error) {
        if (!cancelled) setNotificationError(error.message || "Unable to load notifications.");
      } finally {
        if (!cancelled) setNotificationLoading(false);
      }
    }
    void loadNotifications();
    return () => { cancelled = true; };
  }, [showNotifications]);

  async function openNotification(item) {
    if (!item.isRead) {
      try {
        const token = await auth.currentUser?.getIdToken();
        const response = await fetch(`${API_BASE_URL}/notifications/${encodeURIComponent(item.id)}/read`, {
          method: "PATCH", headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Unable to mark notification as read.");
        setNotifications((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry));
      } catch (error) {
        setNotificationError(error.message);
        return;
      }
    }
    setShowNotifications(false);
    if (item.relatedRecordType === "seedlingRequest") {
      navigate(userRole === "participant" ? "/participant/my-requests" : `/${userRole}/requests`);
    } else if (item.relatedRecordType === "plantingReport") {
      navigate(userRole === "participant" ? "/participant/my-planting-reports" : `/${userRole}/planting-reports`);
    } else if (item.relatedEventId) {
      navigate(`/${userRole}/event-calendar`);
    }
  }

  const displayName = getDisplayName(
    currentUser,
    userRole
  );

  const roleLabel = getRoleLabel(userRole);

  const initials = getInitials(
    displayName,
    userRole
  );

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

          </button>

          {showNotifications && (
            <div className="notification-panel">
              <div className="notification-head">
                <div className="notification-title">
                  Notifications
                </div>

              </div>

              <div className="notification-list">
                {notificationLoading && <div className="notification-empty">Loading notifications...</div>}
                {notificationError && <div className="notification-empty" role="alert">{notificationError}</div>}
                {!notificationLoading && !notificationError && notifications.length === 0 && <div className="notification-empty">No notifications yet.</div>}
                {!notificationLoading && notifications.map((item) => (
                  <button type="button" key={item.id} className={`notification-item${item.isRead ? "" : " unread"}`} onClick={() => void openNotification(item)}>
                    <span className={`notification-dot${item.isRead ? " read" : ""}`} />
                    <span className="notification-item-content">
                      <strong className="notification-message">{item.title}</strong>
                      <span className="notification-message">{item.message}</span>
                      <span className="notification-time">{(item.createdAt?.seconds ?? item.createdAt?._seconds) != null
                        ? new Date((item.createdAt.seconds ?? item.createdAt._seconds) * 1000).toLocaleString("en-PH") : ""}</span>
                    </span>
                  </button>
                ))}
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
