import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import MainLayout from "./layouts/MainLayout";

// Auth pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";

// Staff pages
import StaffDashboard from "./pages/staff/StaffDashboard";

// Volunteer pages
import VolunteerDashboard from "./pages/volunteer/VolunteerDashboard";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Admin routes */}
          <Route path="/admin" element={<MainLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
          </Route>

          {/* Staff routes */}
          <Route path="/staff" element={<MainLayout />}>
            <Route path="dashboard" element={<StaffDashboard />} />
          </Route>

          {/* Volunteer routes */}
          <Route path="/volunteer" element={<MainLayout />}>
            <Route path="dashboard" element={<VolunteerDashboard />} />
          </Route>

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;