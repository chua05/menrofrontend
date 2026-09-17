import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { dashboardPathForRole } from "../utils/roleRoutes";

function useEffectiveAuth() {
  const { currentUser, userRole } = useAuth();
  const storedUser = JSON.parse(localStorage.getItem("user") || "null");

  return {
    effectiveUser: currentUser || storedUser,
    effectiveRole: userRole || storedUser?.role,
  };
}

// Root route ("/"): send an already-signed-in visitor straight to their
// dashboard instead of always showing the login page, so a persisted
// session behaves the same whether you refresh, reopen, or paste the
// bare site URL into a new tab.
export function RootRedirect() {
  const { effectiveUser, effectiveRole } = useEffectiveAuth();

  if (effectiveUser) {
    return <Navigate to={dashboardPathForRole(effectiveRole)} replace />;
  }

  return <Navigate to="/login" replace />;
}

// Wraps public-only pages (login, register): if you're already signed
// in, skip straight to your dashboard instead of showing the form again.
export function GuestOnlyRoute({ children }) {
  const { effectiveUser, effectiveRole } = useEffectiveAuth();

  if (effectiveUser) {
    return <Navigate to={dashboardPathForRole(effectiveRole)} replace />;
  }

  return children;
}
