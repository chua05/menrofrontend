import { NavLink } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
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
import menroLogo from "../assets/menro-logo.png";

const NAVIGATION = {
  admin: [
    {
      section: "Main",
      items: [
        {
          label: "Dashboard",
          icon: LayoutDashboard,
          to: "/admin/dashboard",
        },
      ],
    },
    {
      section: "Management",
      items: [
        {
          label: "Sapling Requests",
          icon: ClipboardList,
          to: "/admin/requests",
        },
        {
          label: "Saplings",
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
      ],
    },
    {
      section: "Analytics",
      items: [
        {
          label: "Reforestation Analytics",
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
      section: "Main",
      items: [
        {
          label: "Dashboard",
          icon: LayoutDashboard,
          to: "/staff/dashboard",
        },
      ],
    },
    {
      section: "Management",
      items: [
        {
          label: "Sapling Requests",
          icon: ClipboardList,
          to: "/staff/requests",
        },
        {
          label: "Saplings",
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
      ],
    },
    {
      section: "Analytics",
      items: [
        {
          label: "Reforestation Analytics",
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
      section: "Main",
      items: [
        {
          label: "Dashboard",
          icon: LayoutDashboard,
          to: "/participant/dashboard",
        },
      ],
    },
    {
      section: "Saplings",
      items: [
        {
          label: "Request Saplings",
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
        {
          label: "Survival Monitoring",
          icon: Activity,
          to: "/participant/survival-monitoring",
        },
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

export default function Sidebar({ isOpen, onClose }) {
  const { userRole, currentUser } = useAuth();

  const [notifications, setNotifications] = useState(getPublishedNotifications);

  const resolvedRole =
    userRole && NAVIGATION[userRole] ? userRole : "participant";

  const navigation = NAVIGATION[resolvedRole];
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

  return (
    <aside
      className={`sidebar ${isOpen ? "open" : ""}`}
      aria-hidden={!isOpen}
    >
      {/* Header */}
      <div className="sb-header">
        <div className="sb-brand">
          <img
            src={menroLogo}
            alt="MENRO Bulan logo"
            className="sb-brand-logo"
          />

          <div className="sb-brand-text">
            <div className="sb-brand-name">MENRO</div>
            <div className="sb-brand-location">Bulan, Sorsogon</div>
          </div>
        </div>

        <button
          type="button"
          className="sb-close"
          onClick={onClose}
          aria-label="Close sidebar"
          title="Close sidebar"
        >
          <X size={20} strokeWidth={1.9} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sb-nav">
        {navigation.map((group) => (
          <div className="sb-group" key={group.section}>
            <div className="sb-section">{group.section}</div>

            {group.items.map((item) => {
              const Icon = item.icon;
              const unreadCount = unreadCounts[item.to] || 0;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
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
                      aria-label={`${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="sb-bottom">
        <div className="sb-user">
          <div className="sb-avatar">{initials}</div>

          <div className="sb-user-content">
            <div className="sb-user-name">{displayName}</div>
            <div className="sb-user-role">{roleLabel}</div>
          </div>
        </div>

      </div>
    </aside>
  );
}
