import ModalDialog from "../components/ModalDialog";
import SidebarTooltip from "./SidebarTooltip";
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  House,
  ClipboardList,
  Sprout,
  CalendarDays,
  MapPin,
  FileCheck2,
  Activity,
  ChartNoAxesCombined,
  Map,
  FileText,
  Users,
  Settings,
  UserRound,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import {
  getPublishedNotifications,
  getUnreadCountsByPath,
  NOTIFICATIONS_UPDATED_EVENT,
} from "../utils/notificationRoutes";
import menroLogo from "../assets/menrologo-transparent.png";
import { resolveVerifiedPlantingCohortEnabled } from "../utils/verifiedPlantingCohort";
import { informationEnabled, sampleAnalyticsEnabled } from "../utils/permanentSampleFeatures";

const NAVIGATION = {
  admin: [
    {
      section: "Home",
      items: [
        {
          label: "Home",
          icon: House,
          to: "/admin/dashboard",
        },
      ],
    },
    {
      section: "Management",
      items: [
        {
          label: "Seedling Requests",
          icon: ClipboardList,
          to: "/admin/requests",
        },
        {
          label: "Seedling Inventory",
          icon: Sprout,
          to: "/admin/seedlings",
        },
        {
          label: "Event Calendar",
          icon: CalendarDays,
          to: "/admin/event-calendar",
        },
        {
          label: "Planting Sites",
          icon: MapPin,
          to: "/admin/planting-sites",
        },
      ],
    },
    {
      section: "Monitoring",
      items: [
        {
          label: "Planting Reports",
          icon: FileCheck2,
          to: "/admin/planting-reports",
        },
        {
          label: "Survival Monitoring",
          icon: Activity,
          to: "/admin/survival-monitoring",
        },
        { label: "Permanent Sample Monitoring Analytics", icon: ChartNoAxesCombined, to: "/admin/permanent-sample-analytics", sampleAnalyticsFeature: true },
      ],
    },
    {
      section: "Analytics",
      items: [
        {
          label: "Analytics and Visualization",
          icon: ChartNoAxesCombined,
          to: "/admin/reforestation-analytics",
        },
        {
          label: "Map Visualization",
          icon: Map,
          to: "/admin/map-visualization",
        },
      ],
    },
    {
      section: "System",
      items: [
        {
          label: "Reports",
          icon: FileText,
          to: "/admin/reports",
        },
        {
          label: "Registered Users",
          icon: Users,
          to: "/admin/registered-users",
        },
        {
          label: "Settings",
          icon: Settings,
          to: "/admin/settings",
        },
      ],
    },
  ],

  staff: [
    {
      section: "Home",
      items: [
        {
          label: "Home",
          icon: House,
          to: "/staff/dashboard",
        },
      ],
    },
    {
      section: "Management",
      items: [
        {
          label: "Seedling Requests",
          icon: ClipboardList,
          to: "/staff/requests",
        },
        {
          label: "Seedling Inventory",
          icon: Sprout,
          to: "/staff/seedlings",
        },
        {
          label: "Event Calendar",
          icon: CalendarDays,
          to: "/staff/event-calendar",
        },
        {
          label: "Planting Sites",
          icon: MapPin,
          to: "/staff/planting-sites",
        },
      ],
    },
    {
      section: "Monitoring",
      items: [
        {
          label: "Planting Reports",
          icon: FileCheck2,
          to: "/staff/planting-reports",
        },
        {
          label: "Survival Monitoring",
          icon: Activity,
          to: "/staff/survival-monitoring",
        },
        // Staff reach permanent-sample monitoring only through Survival Monitoring's single submission action.
        { label: "Permanent Sample Monitoring Analytics", icon: ChartNoAxesCombined, to: "/staff/permanent-sample-analytics", sampleAnalyticsFeature: true },
      ],
    },
    {
      section: "Analytics",
      items: [
        {
          label: "Analytics and Visualization",
          icon: ChartNoAxesCombined,
          to: "/staff/reforestation-analytics",
        },
        {
          label: "Map Visualization",
          icon: Map,
          to: "/staff/map-visualization",
        },
      ],
    },
    {
      section: "System",
      items: [
        {
          label: "Reports",
          icon: FileText,
          to: "/staff/reports",
        },
        {
          label: "Registered Users",
          icon: Users,
          to: "/staff/registered-users",
        },
        {
          label: "Settings",
          icon: Settings,
          to: "/staff/settings",
        },
      ],
    },
  ],

  participant: [
    {
      section: "Home",
      items: [
        {
          label: "Home",
          icon: House,
          to: "/participant/dashboard",
        },
      ],
    },
    {
      section: "Seedlings",
      items: [
        {
          label: "Request Seedlings",
          icon: Sprout,
          to: "/participant/request-seedlings",
        },
        {
          label: "My Requests",
          icon: ClipboardList,
          to: "/participant/my-requests",
        },
      ],
    },
    {
      section: "Activities",
      items: [
        {
          label: "Event Calendar",
          icon: CalendarDays,
          to: "/participant/event-calendar",
        },
        {
          label: "Planting Sites",
          icon: MapPin,
          to: "/participant/planting-sites",
        },
      ],
    },
    {
      section: "Monitoring",
      items: [
        {
          label: "My Planting Reports",
          icon: FileCheck2,
          to: "/participant/my-planting-reports",
        },
        { label: "Monitoring Information Requests", icon: ClipboardList, to: "/participant/monitoring-information", informationFeature: true },
      ],
    },
    {
      section: "Account",
      items: [
        {
          label: "Profile",
          icon: UserRound,
          to: "/participant/profile",
        },
      ],
    },
  ],
};

function getRoleLabel(role) {
  if (role === "admin") return "Office Head";
  if (role === "staff") return "Staff";
  return "Participant";
}

function getFallbackName(role) {
  if (role === "admin") return "MENRO Administrator";
  if (role === "staff") return "MENRO Staff";
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

function badgeText(count) {
  return count > 99 ? "99+" : count;
}

function badgeLabel(count) {
  return `${count} unread update${count === 1 ? "" : "s"}`;
}

// mode "docked": a normal landmark beside the page, expanded or collapsed to the icon rail.
// mode "drawer": the modal overlay drawer used on phones.
export default function Sidebar({ mode, expanded = true, isOpen, onClose }) {
  const { userRole, currentUser } = useAuth();

  const [notifications, setNotifications] = useState(getPublishedNotifications);
  const [tooltip, setTooltip] = useState(null);

  const docked = mode === "docked";
  const rail = docked && !expanded;

  // Expanding (or leaving docked mode) drops any rail tooltip that was showing.
  // A route change also drops it: the sidebar outlives navigation, so a focused link would keep it on screen.
  const { pathname } = useLocation();
  const [tooltipKey, setTooltipKey] = useState({ rail, pathname });
  if (tooltipKey.rail !== rail || tooltipKey.pathname !== pathname) {
    setTooltipKey({ rail, pathname });
    setTooltip(null);
  }

  const resolvedRole =
    userRole && NAVIGATION[userRole] ? userRole : "participant";

  const navigation = NAVIGATION[resolvedRole].map((group) => ({ ...group, items: group.items.filter((item) =>
    (!item.cohortFeature || resolveVerifiedPlantingCohortEnabled())
    && (!item.informationFeature || informationEnabled())
    && (!item.sampleAnalyticsFeature || sampleAnalyticsEnabled())) }));
  const unreadCounts = useMemo(
    () => getUnreadCountsByPath(notifications, resolvedRole),
    [notifications, resolvedRole],
  );

  useEffect(() => {
    if (!currentUser?.uid) {
      return undefined;
    }

    const handleNotificationsUpdated = (event) => {
      if (Array.isArray(event.detail?.notifications)) {
        setNotifications(event.detail.notifications);
      }
    };

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleNotificationsUpdated);

    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleNotificationsUpdated);
    };
  }, [currentUser?.uid]);

  const displayName =
    currentUser?.fullName?.trim() || getFallbackName(resolvedRole);

  const roleLabel = resolvedRole === "participant" && currentUser?.userType
    ? currentUser.userType
    : getRoleLabel(resolvedRole);

  const initials = getInitials(displayName, resolvedRole);

  const showTooltip = (event, label) => {
    const box = event.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: box.top + box.height / 2, left: box.right + 10 });
  };
  const hideTooltip = () => setTooltip(null);

  const brand = (
    <div className="sb-brand">
      <img
        src={menroLogo}
        alt="MENRO Bulan logo"
        className="sb-brand-logo"
      />

      {!rail && (
        <div className="sb-brand-text">
          <div className="sb-brand-name">MENRO</div>
          <div className="sb-brand-location">Bulan, Sorsogon</div>
        </div>
      )}
    </div>
  );

  const navGroups = navigation.map((group) => (
    <div className="sb-group" key={group.section}>
      {!rail && <div className="sb-section">{group.section}</div>}

      {group.items.map((item) => {
        const Icon = item.icon;
        const unreadCount = unreadCounts[item.to] || 0;
        const badgeId = `sb-badge${item.to.replaceAll("/", "-")}`;

        if (rail) {
          return (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.label}
              aria-describedby={unreadCount > 0 ? badgeId : undefined}
              className={({ isActive }) =>
                `sb-item sb-rail-item ${isActive ? "active" : ""}`
              }
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") showTooltip(event, item.label);
              }}
              onFocus={(event) => {
                if (event.currentTarget.matches(":focus-visible")) showTooltip(event, item.label);
              }}
              onPointerLeave={hideTooltip}
              onClick={hideTooltip}
              onBlur={hideTooltip}
              onKeyDown={(event) => { if (event.key === "Escape") hideTooltip(); }}
            >
              <Icon
                className="sb-item-icon"
                size={19}
                strokeWidth={1.8}
                aria-hidden="true"
              />

              {unreadCount > 0 && (
                <span
                  id={badgeId}
                  className="sb-item-badge"
                  aria-label={badgeLabel(unreadCount)}
                >
                  {badgeText(unreadCount)}
                </span>
              )}
            </NavLink>
          );
        }

        return (
          <NavLink
            key={item.to}
            to={item.to}
            data-modal-close={docked ? undefined : ""}
            className={({ isActive }) =>
              `sb-item ${isActive ? "active" : ""}`
            }
          >
            <Icon
              className="sb-item-icon"
              size={17}
              strokeWidth={1.8}
            />

            <span className="sb-item-label">{item.label}</span>

            {unreadCount > 0 && (
              <span
                className="sb-item-badge"
                aria-label={badgeLabel(unreadCount)}
              >
                {badgeText(unreadCount)}
              </span>
            )}
          </NavLink>
        );
      })}
    </div>
  ));

  const user = (
    <div className="sb-bottom">
      <div className="sb-user">
        <div className="sb-avatar" title={rail ? displayName : undefined}>{initials}</div>

        {!rail && (
          <div className="sb-user-content">
            <div className="sb-user-name">{displayName}</div>
            <div className="sb-user-role">{roleLabel}</div>
          </div>
        )}
      </div>

    </div>
  );

  if (docked) {
    return (
      <aside
        id="menro-sidebar"
        className={`sidebar docked ${rail ? "rail" : "expanded"}`}
      >
        <div className="sb-header">{brand}</div>

        <nav className="sb-nav" aria-label="Main navigation" onScroll={hideTooltip}>
          {navGroups}
        </nav>

        {user}

        {rail && <SidebarTooltip tooltip={tooltip} />}
      </aside>
    );
  }

  return (
    <ModalDialog open={isOpen} onClose={onClose} className="sidebar-modal-layer" label="Main navigation" id="menro-sidebar">
      <>
      <div className="sidebar-backdrop open" data-modal-close="" aria-hidden="true" />
    <aside
      className={`sidebar ${isOpen ? "open" : ""}`}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      {/* Header */}
      <div className="sb-header">
        {brand}

        <button
          type="button"
          className="sb-close"
          data-modal-close=""
          aria-label="Close sidebar"
          title="Close sidebar"
        >
          <X size={20} strokeWidth={1.9} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sb-nav">
        {navGroups}
      </nav>

      {/* User */}
      {user}
    </aside>
      </>
    </ModalDialog>
  );
}
