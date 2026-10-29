import { dashboardPathForRole, normalizeRole } from "./roleRoutes.js";

const isInternalPath = (path) =>
  typeof path === "string" &&
  path.startsWith("/") &&
  !path.startsWith("//") &&
  !path.includes("\\");

export function resolvePostLoginPath(requestedPath, user) {
  const role = normalizeRole(user?.role);
  const dashboardPath = dashboardPathForRole(role);

  if (role === "participant" && user?.profileComplete === false) {
    return "/complete-profile";
  }

  if (!isInternalPath(requestedPath)) return dashboardPath;

  const pathname = requestedPath.split(/[?#]/, 1)[0];
  const rolePath = `/${role}`;
  if (pathname === rolePath || pathname.startsWith(`${rolePath}/`)) {
    return requestedPath;
  }

  return dashboardPath;
}
