export function normalizeRole(role) {
  const normalizedRole = String(role || "participant").trim().toLowerCase();
  return ["admin", "staff", "participant"].includes(normalizedRole)
    ? normalizedRole
    : "participant";
}

export function dashboardPathForRole(role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "admin") return "/admin/dashboard";
  if (normalizedRole === "staff") return "/staff/dashboard";
  return "/participant/dashboard";
}
