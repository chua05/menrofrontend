import { useEffect, useRef, useState } from "react";
import { Bell, Menu, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";

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
                <div className="notification-empty">
                  Notifications are unavailable until the server provides them.
                </div>
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
