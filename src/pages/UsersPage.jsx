import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  EllipsisVertical,
  Eye,
  KeyRound,
  MapPin,
  MoreVertical,
  Pencil,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sprout,
  UserCog,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase/config";
import "../styles/registered-users.css";

const API_BASE_URL = "http://localhost:5000/api";
const PAGE_SIZE_OPTIONS = [10, 20, 50];

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

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrator" },
  { value: "staff", label: "Staff" },
  { value: "participant", label: "Participant" },
];

function normalizeStatus(value) {
  return String(value || "active").toLowerCase() === "inactive"
    ? "Inactive"
    : "Active";
}

function normalizeRole(value) {
  const role = String(value || "participant").toLowerCase();

  if (role === "admin" || role === "staff" || role === "participant") {
    return role;
  }

  return "participant";
}

function toRegistryUser(user) {
  return {
    id: user?.uid || user?.id || user?.email || "",
    uid: user?.uid || "",
    fullName: user?.fullName || "Unnamed User",
    username: user?.username || "",
    email: user?.email || "",
    contact: user?.contactNumber || "",
    organization: user?.organization || "",
    role: normalizeRole(user?.role),
    barangay: user?.barangay || "",
    status: normalizeStatus(user?.status),
    photoURL: user?.photoURL || "",
    createdAt: user?.createdAt || null,
    updatedAt: user?.updatedAt || null,
    lastLoginAt: user?.lastLoginAt || null,
  };
}

function formatDateTime(value) {
  if (!value) {
    return { date: "—", time: "" };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { date: "—", time: "" };
  }

  return {
    date: date.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function getInitials(name) {
  return String(name || "User")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getRoleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "staff") return "Staff";
  return "Participant";
}

export default function UsersPage() {
  const { userRole } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [openRowMenuId, setOpenRowMenuId] = useState(null);

  const [selectedRole, setSelectedRole] = useState("participant");

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const moreMenuRef = useRef(null);

  const canManage = userRole === "admin";

  const getFreshToken = async () => {
    const getTokenFromUser = async (firebaseUser) => {
      const token = await firebaseUser.getIdToken();

      localStorage.setItem("token", token);

      return token;
    };

    if (auth.currentUser) {
      return getTokenFromUser(auth.currentUser);
    }

    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};

      const timeoutId = window.setTimeout(() => {
        unsubscribe();
        reject(new Error("Firebase authentication session not found."));
      }, 5000);

      unsubscribe = auth.onAuthStateChanged(
        async (firebaseUser) => {
          if (!firebaseUser) return;

          window.clearTimeout(timeoutId);
          unsubscribe();

          try {
            resolve(await getTokenFromUser(firebaseUser));
          } catch (error) {
            reject(error);
          }
        },
        (error) => {
          window.clearTimeout(timeoutId);
          unsubscribe();
          reject(error);
        }
      );
    });
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const token = await getFreshToken();

      if (!token) {
        throw new Error("Authentication token not found.");
      }

      const response = await fetch(`${API_BASE_URL}/users`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to retrieve users.");
      }

      const mappedUsers = Array.isArray(result.data)
        ? result.data.map(toRegistryUser)
        : [];

      setUsers(mappedUsers);
    } catch (error) {
      console.error(error);
      setUsers([]);
      setErrorMessage(error.message || "Failed to retrieve users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  let cancelled = false;

  const loadUsers = async () => {
    try {
      const token = await getFreshToken();

      if (!token) {
        throw new Error("Authentication token not found.");
      }

      const response = await fetch(
        `${API_BASE_URL}/users`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to retrieve users."
        );
      }

      if (cancelled) return;

      const mappedUsers = Array.isArray(result.data)
        ? result.data.map(toRegistryUser)
        : [];

      setUsers(mappedUsers);
      setLoading(false);
    } catch (error) {
      console.error(error);

      if (cancelled) return;

      setUsers([]);
      setErrorMessage(
        error.message || "Failed to retrieve users."
      );
      setLoading(false);
    }
  };

  loadUsers();

  return () => {
    cancelled = true;
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

      if (!event.target.closest("[data-user-row-menu]")) {
        setOpenRowMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const counts = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((user) => user.role === "admin").length,
      staff: users.filter((user) => user.role === "staff").length,
      participants: users.filter((user) => user.role === "participant").length,
      active: users.filter((user) => user.status === "Active").length,
      inactive: users.filter((user) => user.status === "Inactive").length,
    };
  }, [users]);

  const tabs = useMemo(
    () => [
      { id: "all", label: "All Users", count: counts.total },
      { id: "admin", label: "Admins", count: counts.admins },
      { id: "staff", label: "Staff", count: counts.staff },
      {
        id: "participant",
        label: "Participants",
        count: counts.participants,
      },
      { id: "active", label: "Active", count: counts.active },
      { id: "inactive", label: "Inactive", count: counts.inactive },
    ],
    [counts]
  );

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (activeTab === "admin" && user.role !== "admin") return false;
      if (activeTab === "staff" && user.role !== "staff") return false;

      if (activeTab === "participant" && user.role !== "participant") {
        return false;
      }

      if (activeTab === "active" && user.status !== "Active") {
        return false;
      }

      if (activeTab === "inactive" && user.status !== "Inactive") {
        return false;
      }

      if (roleFilter && user.role !== roleFilter) return false;
      if (statusFilter && user.status !== statusFilter) return false;
      if (barangayFilter && user.barangay !== barangayFilter) return false;

      if (search.trim()) {
        const query = search.trim().toLowerCase();

        const haystack = [
          user.fullName,
          user.username,
          user.email,
          user.contact,
          user.organization,
          user.barangay,
          user.role,
          user.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [
    users,
    activeTab,
    roleFilter,
    statusFilter,
    barangayFilter,
    search,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / pageSize)
  );

  const currentPage = Math.min(page, totalPages);

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const pageStart =
    filteredUsers.length === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;

  const pageEnd = Math.min(
    currentPage * pageSize,
    filteredUsers.length
  );

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setErrorMessage("");

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);
  };

  const showError = (message) => {
    setErrorMessage(message);
    setSuccessMessage("");

    window.setTimeout(() => {
      setErrorMessage("");
    }, 3500);
  };

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("");
    setStatusFilter("");
    setBarangayFilter("");
    setActiveTab("all");
    setPage(1);
    setShowMoreMenu(false);
  };

  const openUserDetails = (user) => {
    setSelectedUser(user);
    setShowDetails(true);
    setOpenRowMenuId(null);
  };

  const openRoleEditor = (user) => {
    if (!canManage) return;

    setSelectedUser(user);
    setSelectedRole(user.role);
    setShowRoleModal(true);
    setOpenRowMenuId(null);
  };

  const handleRoleSave = async (event) => {
    event.preventDefault();

    if (!selectedUser || !canManage) return;

    try {
      const token = await getFreshToken();

      if (!token) {
        throw new Error("Authentication token not found.");
      }

      const response = await fetch(
        `${API_BASE_URL}/users/${selectedUser.uid}/role`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            role: selectedRole,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update user role.");
      }

      const updatedUser = toRegistryUser(result.data);

      setUsers((previous) =>
        previous.map((user) =>
          user.uid === updatedUser.uid ? updatedUser : user
        )
      );

      setShowRoleModal(false);
      setSelectedUser(null);

      showSuccess("User role updated successfully.");
    } catch (error) {
      console.error(error);
      showError(error.message || "Failed to update user role.");
    }
  };

  const handleToggleStatus = async (user) => {
    if (!canManage) return;

    const nextStatus =
      user.status === "Active" ? "inactive" : "active";

    try {
      const token = await getFreshToken();

      if (!token) {
        throw new Error("Authentication token not found.");
      }

      const response = await fetch(
        `${API_BASE_URL}/users/${user.uid}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update user status.");
      }

      const updatedUser = toRegistryUser(result.data);

      setUsers((previous) =>
        previous.map((item) =>
          item.uid === updatedUser.uid ? updatedUser : item
        )
      );

      setOpenRowMenuId(null);

      showSuccess(
        `${user.fullName} is now ${updatedUser.status.toLowerCase()}.`
      );
    } catch (error) {
      console.error(error);
      showError(error.message || "Failed to update user status.");
    }
  };

  return (
    <div className="ru-page">
      {successMessage && (
        <div className="ru-toast ru-toast-success">
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="ru-toast ru-toast-error">
          <X size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      <section className="ru-page-header">
        <div className="ru-title-wrap">
          <div className="ru-title-icon">
            <Users size={21} strokeWidth={1.8} />
          </div>

          <div>
            <h1>Registered Users</h1>
            <p>
              View registered accounts, roles, access status, and recent
              account activity.
            </p>
          </div>
        </div>
      </section>

      <section className="ru-kpi-grid">
        <KpiCard
          label="Total Users"
          value={counts.total}
          note="Registered accounts"
          icon={Users}
          variant="green"
        />

        <KpiCard
          label="Admins"
          value={counts.admins}
          note="System administrators"
          icon={KeyRound}
          variant="orange"
        />

        <KpiCard
          label="Staff"
          value={counts.staff}
          note="MENRO staff accounts"
          icon={UserCog}
          variant="blue"
        />

        <KpiCard
          label="Participants"
          value={counts.participants}
          note="Community participants"
          icon={Sprout}
          variant="green"
        />

        <KpiCard
          label="Active Accounts"
          value={counts.active}
          note="Currently active"
          icon={ShieldCheck}
          variant="purple"
        />

        <KpiCard
          label="Inactive Accounts"
          value={counts.inactive}
          note="Deactivated users"
          icon={Archive}
          variant="red"
        />
      </section>

      <section className="ru-record-card">
        <div className="ru-tabs">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={`ru-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
            >
              {tab.label}

              <span className={`ru-tab-count ru-count-${tab.id}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="ru-filter-bar">
          <div className="ru-search">
            <Search size={15} />

            <input
              type="search"
              value={search}
              placeholder="Search by name, email or contact..."
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <FilterSelect
            icon={MapPin}
            value={barangayFilter}
            placeholder="All Barangays"
            options={BARANGAYS}
            onChange={(value) => {
              setBarangayFilter(value);
              setPage(1);
            }}
          />

          <FilterSelect
            icon={CircleUserRound}
            value={roleFilter}
            placeholder="All Roles"
            options={[
              { value: "admin", label: "Admin" },
              { value: "staff", label: "Staff" },
              { value: "participant", label: "Participant" },
            ]}
            onChange={(value) => {
              setRoleFilter(value);
              setPage(1);
            }}
          />

          <FilterSelect
            icon={CheckCircle2}
            value={statusFilter}
            placeholder="All Status"
            options={["Active", "Inactive"]}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          />

          <div className="ru-filter-spacer" />

          <div className="ru-more-wrap" ref={moreMenuRef}>
            <button
              type="button"
              className="ru-more-btn"
              title="More options"
              aria-label="More user options"
              onClick={() =>
                setShowMoreMenu((previous) => !previous)
              }
            >
              <MoreVertical size={18} />
            </button>

            {showMoreMenu && (
              <div className="ru-more-menu">
                <button type="button" onClick={resetFilters}>
                  <RefreshCcw size={15} />

                  <div>
                    <strong>Reset Filters</strong>
                    <span>Clear tabs, search, and filters</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fetchUsers();
                    setShowMoreMenu(false);
                  }}
                >
                  <RefreshCcw size={15} />

                  <div>
                    <strong>Refresh Users</strong>
                    <span>Reload registered users from the server</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="ru-table-scroll">
          <table className="ru-table">
            <thead>
              <tr>
                <th>#</th>
                <th>USER</th>
                <th>CONTACT</th>
                <th>ROLE</th>
                <th>BARANGAY</th>
                <th>DATE REGISTERED</th>
                <th>STATUS</th>
                <th>LAST LOGIN</th>
                <th className="ru-actions-heading">ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                paginatedUsers.map((user, index) => {
                  const registered = formatDateTime(user.createdAt);
                  const lastLogin = formatDateTime(user.lastLoginAt);

                  return (
                    <tr key={user.uid || user.id}>
                      <td>{pageStart + index}</td>

                      <td>
                        <div className="ru-user-cell">
                          <div className="ru-avatar">
                            {user.photoURL ? (
                              <img
                                src={user.photoURL}
                                alt={`${user.fullName} profile`}
                              />
                            ) : (
                              getInitials(user.fullName)
                            )}
                          </div>

                          <div className="ru-user-copy">
                            <strong>{user.fullName}</strong>
                            <span>{user.email || "—"}</span>
                          </div>
                        </div>
                      </td>

                      <td>{user.contact || "—"}</td>

                      <td>
                        <span className={`ru-role ru-role-${user.role}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>

                      <td>{user.barangay || "—"}</td>

                      <td>
                        <div className="ru-date-cell">
                          <strong>{registered.date}</strong>
                          <span>{registered.time}</span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`ru-status ru-status-${user.status.toLowerCase()}`}
                        >
                          <i />
                          {user.status}
                        </span>
                      </td>

                      <td>
                        <div className="ru-date-cell">
                          <strong>{lastLogin.date}</strong>
                          <span>{lastLogin.time}</span>
                        </div>
                      </td>

                      <td>
                        <div
                          className="ru-row-actions"
                          data-user-row-menu
                        >
                          <button
                            type="button"
                            className="ru-row-icon-btn"
                            title="View user"
                            onClick={() => openUserDetails(user)}
                          >
                            <Eye size={15} />
                          </button>

                          {canManage && (
                            <>
                              <button
                                type="button"
                                className="ru-row-icon-btn"
                                title="Edit role"
                                onClick={() => openRoleEditor(user)}
                              >
                                <Pencil size={14} />
                              </button>

                              <button
                                type="button"
                                className="ru-row-icon-btn"
                                title="More actions"
                                onClick={() =>
                                  setOpenRowMenuId((previous) =>
                                    previous === user.uid
                                      ? null
                                      : user.uid
                                  )
                                }
                              >
                                <EllipsisVertical size={15} />
                              </button>

                              {openRowMenuId === user.uid && (
                                <div className="ru-row-menu">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleStatus(user)
                                    }
                                  >
                                    {user.status === "Active" ? (
                                      <Archive size={14} />
                                    ) : (
                                      <CheckCircle2 size={14} />
                                    )}

                                    {user.status === "Active"
                                      ? "Deactivate User"
                                      : "Activate User"}
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="ru-empty-state">
            <div className="ru-empty-icon">
              <RefreshCcw size={31} strokeWidth={1.6} />
            </div>

            <h2>Loading users...</h2>

            <p>
              Retrieving registered accounts from the MENRO system.
            </p>
          </div>
        )}

        {!loading && filteredUsers.length === 0 && (
          <div className="ru-empty-state">
            <div className="ru-empty-icon">
              <Users size={31} strokeWidth={1.6} />
            </div>

            <h2>No users found</h2>

            <p>
              No registered users match the current search or filter
              settings.
            </p>
          </div>
        )}

        <div className="ru-table-footer">
          <span>
            Showing {pageStart} to {pageEnd} of {filteredUsers.length} users
          </span>

          <div className="ru-pagination">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() =>
                setPage((previous) => Math.max(1, previous - 1))
              }
            >
              <ChevronLeft size={15} />
            </button>

            <button type="button" className="active">
              {currentPage}
            </button>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() =>
                setPage((previous) =>
                  Math.min(totalPages, previous + 1)
                )
              }
            >
              <ChevronRight size={15} />
            </button>

            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {showDetails && selectedUser && (
        <div className="ru-modal-backdrop">
          <div className="ru-modal ru-details-modal">
            <div className="ru-modal-header">
              <div>
                <span className="ru-modal-eyebrow">REGISTERED USER</span>
                <h2>User Details</h2>
                <p>Registered account information from the MENRO system.</p>
              </div>

              <button
                type="button"
                className="ru-modal-close"
                onClick={() => {
                  setShowDetails(false);
                  setSelectedUser(null);
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="ru-modal-body">
              <div className="ru-detail-profile">
                <div className="ru-detail-avatar">
                  {selectedUser.photoURL ? (
                    <img
                      src={selectedUser.photoURL}
                      alt={`${selectedUser.fullName} profile`}
                    />
                  ) : (
                    getInitials(selectedUser.fullName)
                  )}
                </div>

                <div>
                  <h3>{selectedUser.fullName}</h3>
                  <p>{selectedUser.email || "—"}</p>

                  <div className="ru-detail-badges">
                    <span
                      className={`ru-role ru-role-${selectedUser.role}`}
                    >
                      {getRoleLabel(selectedUser.role)}
                    </span>

                    <span
                      className={`ru-status ru-status-${selectedUser.status.toLowerCase()}`}
                    >
                      <i />
                      {selectedUser.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="ru-detail-grid">
                <DetailItem
                  label="User ID"
                  value={selectedUser.uid || selectedUser.id}
                />

                <DetailItem
                  label="Username"
                  value={selectedUser.username || "—"}
                />

                <DetailItem
                  label="Contact Number"
                  value={selectedUser.contact || "—"}
                />

                <DetailItem
                  label="Organization"
                  value={selectedUser.organization || "—"}
                />

                <DetailItem
                  label="Barangay"
                  value={selectedUser.barangay || "—"}
                />

                <DetailItem
                  label="Role"
                  value={getRoleLabel(selectedUser.role)}
                />

                <DetailItem
                  label="Date Registered"
                  value={formatDateTime(selectedUser.createdAt).date}
                  subvalue={formatDateTime(selectedUser.createdAt).time}
                />

                <DetailItem
                  label="Last Login"
                  value={formatDateTime(selectedUser.lastLoginAt).date}
                  subvalue={formatDateTime(selectedUser.lastLoginAt).time}
                />
              </div>
            </div>

            <div className="ru-modal-footer">
              <button
                type="button"
                className="ru-secondary-btn"
                onClick={() => {
                  setShowDetails(false);
                  setSelectedUser(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoleModal && selectedUser && canManage && (
        <div className="ru-modal-backdrop">
          <div className="ru-modal ru-role-modal">
            <div className="ru-modal-header">
              <div>
                <span className="ru-modal-eyebrow">ACCOUNT ROLE</span>
                <h2>Edit User Role</h2>
                <p>{selectedUser.fullName}</p>
              </div>

              <button
                type="button"
                className="ru-modal-close"
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedUser(null);
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form className="ru-modal-body" onSubmit={handleRoleSave}>
              <label className="ru-form-field">
                <span>Role</span>

                <select
                  value={selectedRole}
                  onChange={(event) =>
                    setSelectedRole(event.target.value)
                  }
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="ru-modal-footer ru-inline-footer">
                <button
                  type="button"
                  className="ru-secondary-btn"
                  onClick={() => {
                    setShowRoleModal(false);
                    setSelectedUser(null);
                  }}
                >
                  Cancel
                </button>

                <button type="submit" className="ru-primary-btn">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, note, icon: Icon, variant }) {
  return (
    <div className="ru-kpi-card">
      <div className={`ru-kpi-icon ${variant}`}>
        <Icon size={22} strokeWidth={1.8} />
      </div>

      <div>
        <span className="ru-kpi-label">{label}</span>
        <strong className="ru-kpi-value">{value}</strong>
        <small className="ru-kpi-note">{note}</small>
      </div>
    </div>
  );
}

function FilterSelect({
  icon: Icon,
  value,
  placeholder,
  options,
  onChange,
}) {
  return (
    <div className="ru-filter-select">
      <Icon size={15} />

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>

        {options.map((option) => {
          const normalized =
            typeof option === "string"
              ? {
                  value: option,
                  label: option,
                }
              : option;

          return (
            <option
              key={normalized.value}
              value={normalized.value}
            >
              {normalized.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}

function DetailItem({ label, value, subvalue = "" }) {
  return (
    <div className="ru-detail-item">
      <span>{label}</span>
      <strong>{value || "—"}</strong>

      {subvalue && (
        <small>{subvalue}</small>
      )}
    </div>
  );
}