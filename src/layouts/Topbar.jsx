import { useEffect, useRef, useState } from "react";
import {
  Activity, Bell, CalendarDays, ChevronDown, Copy, FileText,
  MapPin, Menu, Package, Search, Sprout, UserRound, X,
} from "lucide-react";
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

const SEARCH_ICONS = {
  Event: CalendarDays,
  "Planting Site": MapPin,
  "Sapling Request": FileText,
  "Planting Report": Sprout,
  "Monitoring Record": Activity,
  "Generated Report": FileText,
  "Inventory Sapling": Package,
};

function timestampText(value) {
  const seconds = value?.seconds ?? value?._seconds;
  return seconds != null ? new Date(seconds * 1000).toLocaleString("en-PH") : "—";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);

  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const searchRef = useRef(null);
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

      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
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
    const query = searchQuery.trim();
    if (query.length < 2) {
      const resetTimer = window.setTimeout(() => {
        setSearchResults([]);
        setSearchError("");
        setSearchLoading(false);
        setActiveSearchIndex(-1);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Please sign in again.");
        const response = await fetch(
          `${API_BASE_URL}/search?q=${encodeURIComponent(query)}&limit=10`,
          { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message || "Unable to search system records.");
        setSearchResults(payload?.data?.results || []);
        setSearchOpen(true);
        setActiveSearchIndex(-1);
      } catch (error) {
        if (error.name !== "AbortError") {
          setSearchResults([]);
          setSearchError(error.message || "Unable to search system records.");
          setSearchOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

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
  }, [showNotifications, currentUser?.uid]);

  function clearSearch() {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setSearchOpen(false);
    setActiveSearchIndex(-1);
  }

  function openSearchResult(item) {
    clearSearch();
    navigate(item.path);
  }

  function handleSearchKeyDown(event) {
    if (event.key === "Escape") {
      setSearchOpen(false);
      return;
    }
    if (!searchOpen || searchResults.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSearchIndex((index) => (index + 1) % searchResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSearchIndex((index) => index <= 0 ? searchResults.length - 1 : index - 1);
    } else if (event.key === "Enter" && activeSearchIndex >= 0) {
      event.preventDefault();
      openSearchResult(searchResults[activeSearchIndex]);
    }
  }

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
  const unreadCount = notifications.filter((item) => !item.isRead).length;

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

        <div className="topbar-search" ref={searchRef}>
          <input
            type="search"
            placeholder={getSearchPlaceholder(userRole)}
            aria-label="Search system"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => {
              if (searchQuery.trim().length >= 2) setSearchOpen(true);
            }}
            onKeyDown={handleSearchKeyDown}
            aria-expanded={searchOpen}
            aria-controls="global-search-results"
          />

          <Search
            className="topbar-search-icon"
            size={17}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          {searchQuery && (
            <button type="button" className="topbar-search-clear" onClick={clearSearch} aria-label="Clear search">
              <X size={16} />
            </button>
          )}

          {searchOpen && searchQuery.trim().length >= 2 && (
            <div id="global-search-results" className="topbar-search-results" role="listbox">
              {searchLoading && <div className="topbar-search-state">Searching...</div>}
              {!searchLoading && searchError && (
                <div className="topbar-search-state error" role="alert">{searchError}</div>
              )}
              {!searchLoading && !searchError && searchResults.length === 0 && (
                <div className="topbar-search-state">No results found for “{searchQuery.trim()}”</div>
              )}
              {!searchLoading && !searchError && searchResults.map((item, index) => {
                const ResultIcon = SEARCH_ICONS[item.type] || Search;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeSearchIndex}
                    className={`topbar-search-result${index === activeSearchIndex ? " active" : ""}`}
                    key={`${item.type}-${item.id}`}
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    onClick={() => openSearchResult(item)}
                  >
                    <span className="topbar-search-result-icon"><ResultIcon size={17} /></span>
                    <span className="topbar-search-result-copy">
                      <strong>{item.title}</strong>
                      <span>{item.type}{item.subtitle ? ` · ${item.subtitle}` : ""}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
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

            {unreadCount > 0 && (
              <span className="notification-badge" aria-label={`${unreadCount} unread notifications`}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}

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
                  <button type="button" key={item.id} className={`notification-item notification-${item.type || "info"}${item.isRead ? "" : " unread"}`} onClick={() => void openNotification(item)}>
                    <span className={`notification-dot${item.isRead ? " read" : ""}`} />
                    <span className="notification-item-content">
                      <strong className="notification-message">{item.title}</strong>
                      <span className="notification-message">{item.message}</span>
                      <span className="notification-time">{timestampText(item.createdAt)}</span>
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
          <section className={`notification-detail-drawer notification-detail-${selectedNotification.type || "info"}`} role="dialog" aria-modal="true" aria-labelledby="notification-detail-title">
            <div className="notification-detail-head">
              <h2 id="notification-detail-title">Notification Details</h2>
              <button ref={notificationCloseRef} type="button" onClick={() => setSelectedNotification(null)} aria-label="Close notification details"><X size={20} /></button>
            </div>
            <div className="notification-detail-body">
              <div className="notification-detail-summary">
                <span className="notification-detail-icon"><Bell size={20} /></span>
                <div>
                  <h3>{selectedNotification.title}</h3>
                  <span>{timestampText(selectedNotification.createdAt)}</span>
                </div>
              </div>

              <div className="notification-detail-message">{selectedNotification.message}</div>

              {(selectedNotification.requestNumber || selectedNotification.reportNumber || selectedNotification.relatedRecordId) && (
                <section className="notification-detail-section">
                  <h4>Related Record</h4>
                  <div className="notification-record-field">
                    <FileText size={16} />
                    <strong>{selectedNotification.requestNumber || selectedNotification.reportNumber || selectedNotification.relatedRecordId}</strong>
                  </div>
                </section>
              )}

              {(selectedNotification.reason || selectedNotification.returnedAt || selectedNotification.details || selectedNotification.event) && (
                <section className="notification-detail-section">
                  <h4>Details</h4>
                  <dl>
                    {selectedNotification.reason && <div><dt>Reason</dt><dd>{selectedNotification.reason}</dd></div>}
                    {selectedNotification.returnedAt && <div><dt>Returned</dt><dd>{timestampText(selectedNotification.returnedAt)}</dd></div>}
                    {selectedNotification.details?.reviewedByName && <div><dt>Reviewed By</dt><dd>{selectedNotification.details.reviewedByName}</dd></div>}
                    {selectedNotification.details?.requesterName && <div><dt>Requester</dt><dd>{selectedNotification.details.requesterName}</dd></div>}
                    {selectedNotification.details?.approvedAt && <div><dt>Approved</dt><dd>{timestampText(selectedNotification.details.approvedAt)}</dd></div>}
                    {selectedNotification.details?.rejectedAt && <div><dt>Decision Date</dt><dd>{timestampText(selectedNotification.details.rejectedAt)}</dd></div>}
                    {selectedNotification.details?.releasedAt && <div><dt>Released</dt><dd>{timestampText(selectedNotification.details.releasedAt)}</dd></div>}
                    {selectedNotification.details?.availableQuantity !== undefined && <div><dt>Available Stock</dt><dd>{selectedNotification.details.availableQuantity} saplings</dd></div>}
                    {selectedNotification.details?.lowStockThreshold !== undefined && <div><dt>Low-stock Threshold</dt><dd>{selectedNotification.details.lowStockThreshold} saplings</dd></div>}
                    {selectedNotification.event && <div><dt>Event</dt><dd>{selectedNotification.event.name || selectedNotification.event.id}<br />{selectedNotification.event.date || ""}{selectedNotification.event.location ? ` · ${selectedNotification.event.location}` : ""}</dd></div>}
                  </dl>
                  {selectedNotification.details?.releasedItems?.length > 0 && (
                    <div className="notification-released-items">
                      <strong>Saplings Released</strong>
                      {selectedNotification.details.releasedItems.map((item) => (
                        <div key={item.inventoryId || item.species}>
                          <span>{item.species || "Sapling"}</span>
                          <strong>{item.releasedQuantity} saplings</strong>
                          {item.shortReleaseReason && <small>{item.shortReleaseReason}</small>}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {guestLink && <div className="notification-guest-link"><label htmlFor="notification-guest-url">Guest Invitation Link</label><input id="notification-guest-url" readOnly value={guestLink} /><button type="button" onClick={copyGuestLink}><Copy size={15} /> Copy</button></div>}
              {copyMessage && <p className="notification-copy-message" role="status">{copyMessage}</p>}
            </div>
            <div className="notification-detail-actions">
              {(selectedNotification.relatedRecordType || selectedNotification.relatedEventId) && <button type="button" onClick={() => {
                const item = selectedNotification;
                setSelectedNotification(null);
                if (item.relatedRecordType === "seedlingRequest") navigate(userRole === "participant" ? `/participant/my-requests?request=${encodeURIComponent(item.relatedRecordId)}` : `/${userRole}/requests`);
                else if (item.relatedRecordType === "plantingReport") navigate(userRole === "participant" ? "/participant/my-planting-reports" : `/${userRole}/planting-reports`);
                else if (item.relatedRecordType === "inventory") navigate(`/${userRole}/seedlings?inventory=${encodeURIComponent(item.relatedRecordId)}`);
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
