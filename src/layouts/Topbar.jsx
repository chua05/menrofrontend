import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Menu, Search, UserRound, X } from "lucide-react";
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
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [guestLink, setGuestLink] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const notificationCloseRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }

      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false);
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
    if (!selectedNotification) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSelectedNotification(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    notificationCloseRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedNotification]);

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
    setSelectedNotification({ ...item, isRead: true });
    setGuestLink("");
    setCopyMessage("");
    if (item.hasGuestInvitation && item.relatedEventId && userRole === "participant") {
      try {
        const token = await auth.currentUser?.getIdToken();
        const response = await fetch(`${API_BASE_URL}/guest-events/invitation/${encodeURIComponent(item.relatedEventId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.data?.token) {
          setGuestLink(`${window.location.origin}/join-event/${payload.data.token}`);
        }
      } catch {
        // Notification details remain usable when an invitation has expired.
      }
    }
  }

  async function copyGuestLink() {
    if (!guestLink) return;
    try {
      await navigator.clipboard.writeText(guestLink);
      setCopyMessage("Guest Link copied.");
    } catch {
      setCopyMessage("Unable to copy automatically. Select and copy the link manually.");
    }
  }

  const displayName = getDisplayName(
    currentUser,
    userRole
  );

  const roleLabel = userRole === "participant" && currentUser?.userType
    ? currentUser.userType
    : getRoleLabel(userRole);

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
            onClick={() => {
              setShowProfileMenu(false);
              setShowNotifications((previous) => !previous);
            }}
            aria-label="Notifications"
            aria-expanded={showNotifications}
            aria-haspopup="true"
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
        <div className="topbar-profile-wrap" ref={profileRef}>
          <button
            type="button"
            className="topbar-user"
            onClick={() => {
              setShowNotifications(false);
              setShowProfileMenu((previous) => !previous);
            }}
            aria-expanded={showProfileMenu}
            aria-haspopup="menu"
          >
            <span className="topbar-user-copy">
              <span className="topbar-user-name">{displayName}</span>
              <span className="topbar-user-role">{roleLabel}</span>
            </span>

            <span className="topbar-avatar" aria-hidden="true">
              {currentUser?.photoURL ? (
                <img src={currentUser.photoURL} alt="" referrerPolicy="no-referrer" />
              ) : initials}
            </span>
            <ChevronDown className="topbar-profile-chevron" size={15} aria-hidden="true" />
          </button>

          {showProfileMenu && (
            <div className="topbar-profile-menu" role="menu">
              <div className="topbar-profile-summary">
                <span className="topbar-profile-avatar" aria-hidden="true">
                  {currentUser?.photoURL ? (
                    <img src={currentUser.photoURL} alt="" referrerPolicy="no-referrer" />
                  ) : initials}
                </span>
                <span className="topbar-profile-details">
                  <strong>{displayName}</strong>
                  <span>{roleLabel}</span>
                  {currentUser?.email && <small>{currentUser.email}</small>}
                </span>
              </div>
              <button
                type="button"
                className="topbar-profile-link"
                role="menuitem"
                onClick={() => {
                  setShowProfileMenu(false);
                  navigate(`/${userRole}/profile`);
                }}
              >
                <UserRound size={17} aria-hidden="true" />
                Profile
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedNotification && (
        <div className="notification-detail-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedNotification(null);
        }}>
          <section className="notification-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="notification-detail-title">
            <div className="notification-detail-head">
              <h2 id="notification-detail-title">Notification Details</h2>
              <button ref={notificationCloseRef} type="button" onClick={() => setSelectedNotification(null)} aria-label="Close notification details"><X size={20} /></button>
            </div>
            <div className="notification-detail-body">
              <h3>{selectedNotification.title}</h3>
              <p>{selectedNotification.message}</p>
              <dl>
                <div><dt>Timestamp</dt><dd>{(selectedNotification.createdAt?.seconds ?? selectedNotification.createdAt?._seconds) != null ? new Date((selectedNotification.createdAt.seconds ?? selectedNotification.createdAt._seconds) * 1000).toLocaleString("en-PH") : "—"}</dd></div>
                {selectedNotification.requestNumber && <div><dt>Request Number</dt><dd>{selectedNotification.requestNumber}</dd></div>}
                {selectedNotification.reportNumber && <div><dt>Report Number</dt><dd>{selectedNotification.reportNumber}</dd></div>}
                {selectedNotification.relatedRecordId && !selectedNotification.requestNumber && !selectedNotification.reportNumber && <div><dt>Related Record</dt><dd>{selectedNotification.relatedRecordId}</dd></div>}
                {selectedNotification.reason && <div><dt>Reason</dt><dd>{selectedNotification.reason}</dd></div>}
                {selectedNotification.returnedAt && <div><dt>Returned</dt><dd>{(selectedNotification.returnedAt?.seconds ?? selectedNotification.returnedAt?._seconds) != null ? new Date((selectedNotification.returnedAt.seconds ?? selectedNotification.returnedAt._seconds) * 1000).toLocaleString("en-PH") : "—"}</dd></div>}
                {selectedNotification.event && <div><dt>Event</dt><dd>{selectedNotification.event.name || selectedNotification.event.id}<br />{selectedNotification.event.date || ""}{selectedNotification.event.location ? ` · ${selectedNotification.event.location}` : ""}</dd></div>}
              </dl>
              {guestLink && <div className="notification-guest-link"><label htmlFor="notification-guest-url">Guest Link</label><input id="notification-guest-url" readOnly value={guestLink} /><button type="button" onClick={copyGuestLink}>Copy Link</button></div>}
              {copyMessage && <p className="notification-copy-message" role="status">{copyMessage}</p>}
            </div>
            <div className="notification-detail-actions">
              {(selectedNotification.relatedRecordType || selectedNotification.relatedEventId) && <button type="button" onClick={() => {
                const item = selectedNotification;
                setSelectedNotification(null);
                if (item.relatedRecordType === "seedlingRequest") navigate(userRole === "participant" ? `/participant/my-requests?request=${encodeURIComponent(item.relatedRecordId)}` : `/${userRole}/requests`);
                else if (item.relatedRecordType === "plantingReport") navigate(userRole === "participant" ? "/participant/my-planting-reports" : `/${userRole}/planting-reports`);
                else if (item.relatedEventId) navigate(`/${userRole}/event-calendar`);
              }}>Open Related Record</button>}
              <button type="button" onClick={() => setSelectedNotification(null)}>Close</button>
            </div>
          </section>
        </div>
      )}
    </header>
  );
}
