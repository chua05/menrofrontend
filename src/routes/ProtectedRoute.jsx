import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ allowedRoles }) {
  const { currentUser, userRole } = useAuth();

  const storedUser = JSON.parse(localStorage.getItem("user") || "null");
  const effectiveUser = currentUser || storedUser;
  const effectiveRole = userRole || storedUser?.role;

  if (!effectiveUser) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}