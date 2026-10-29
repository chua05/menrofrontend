import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ allowedRoles }) {
  const { currentUser: effectiveUser, userRole: effectiveRole, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) return null;

  if (!effectiveUser) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  if (effectiveRole === "participant" && effectiveUser.profileComplete === false) {
    return <Navigate to="/complete-profile" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
