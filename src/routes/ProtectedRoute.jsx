import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ allowedRoles }) {
  const { currentUser: effectiveUser, userRole: effectiveRole, authLoading } = useAuth();

  if (authLoading) return null;

  if (!effectiveUser) return <Navigate to="/login" replace />;

  if (effectiveRole === "participant" && effectiveUser.profileComplete === false) {
    return <Navigate to="/complete-profile" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
