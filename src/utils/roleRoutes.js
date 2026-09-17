export function dashboardPathForRole(role) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "staff") return "/staff/dashboard";
  return "/participant/dashboard";
}
