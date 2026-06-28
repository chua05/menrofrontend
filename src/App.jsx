import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import MainLayout from "./layouts/MainLayout";

// Auth
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

// Admin
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageUsers from "./pages/admin/ManageUsers";

// Staff
import StaffDashboard from "./pages/staff/StaffDashboard";
import ManageSeedlings from "./pages/staff/ManageSeedlings";
import ProcessRequests from "./pages/staff/ProcessRequests";
import VerifyReports from "./pages/staff/VerifyReports";

// Shared pages (multiple roles)
import SeedlingRequests from "./pages/shared/SeedlingRequests";
import PlantingEvents from "./pages/shared/PlantingEvents";
import EventSchedule from "./pages/shared/EventSchedule";
import SubmitPlantingReport from "./pages/shared/SubmitPlantingReport";
import TreeMonitoring from "./pages/shared/TreeMonitoring";
import PlantingMap from "./pages/shared/PlantingMap";
import Reports from "./pages/shared/Reports";

// Volunteer
import VolunteerDashboard from "./pages/volunteer/VolunteerDashboard";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Admin routes */}
          <Route path="/admin" element={<MainLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="requests" element={<SeedlingRequests />} />
            <Route path="process-requests" element={<ProcessRequests />} />
            <Route path="events" element={<PlantingEvents />} />
            <Route path="schedule" element={<EventSchedule />} />
            <Route path="map" element={<PlantingMap />} />
            <Route path="submit-report" element={<SubmitPlantingReport />} />
            <Route path="verify-reports" element={<VerifyReports />} />
            <Route path="monitoring" element={<TreeMonitoring />} />
            <Route path="reports" element={<Reports />} />
          </Route>

          {/* Staff routes */}
          <Route path="/staff" element={<MainLayout />}>
            <Route path="dashboard" element={<StaffDashboard />} />
            <Route path="seedlings" element={<ManageSeedlings />} />
            <Route path="process-requests" element={<ProcessRequests />} />
            <Route path="events" element={<PlantingEvents />} />
            <Route path="schedule" element={<EventSchedule />} />
            <Route path="map" element={<PlantingMap />} />
            <Route path="submit-report" element={<SubmitPlantingReport />} />
            <Route path="verify-reports" element={<VerifyReports />} />
            <Route path="monitoring" element={<TreeMonitoring />} />
            <Route path="reports" element={<Reports />} />
          </Route>

          {/* Volunteer routes */}
          <Route path="/volunteer" element={<MainLayout />}>
            <Route path="dashboard" element={<VolunteerDashboard />} />
            <Route path="requests" element={<SeedlingRequests />} />
            <Route path="schedule" element={<EventSchedule />} />
            <Route path="map" element={<PlantingMap />} />
            <Route path="submit-report" element={<SubmitPlantingReport />} />
            <Route path="monitoring" element={<TreeMonitoring />} />
            <Route path="reports" element={<Reports />} />
          </Route>

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;