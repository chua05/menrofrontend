import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import DashboardLayout from "./layouts/DashboardLayout";
import ProtectedRoute from "./routes/ProtectedRoute";

// Auth
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";

// Pages
import UsersPage from "./pages/UsersPage";
import SeedlingsPage from "./pages/SeedlingsPage";
import SeedlingRequestsPage from "./pages/SeedlingRequestsPage";
import ProcessRequestsPage from "./pages/ProcessRequestsPage";
import VerifyReportsPage from "./pages/VerifyReportsPage";
import EventsPage from "./pages/EventsPage";
import EventSchedulePage from "./pages/EventSchedulePage";
import SitesPage from "./pages/SitesPage";
import PlantingPage from "./pages/PlantingPage";
import MonitoringPage from "./pages/MonitoringPage";
import ReportsPage from "./pages/ReportsPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";

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
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/admin" element={<DashboardLayout />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="seedlings" element={<SeedlingsPage />} />
              <Route path="requests" element={<SeedlingRequestsPage />} />
              <Route path="process-requests" element={<ProcessRequestsPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="schedule" element={<EventSchedulePage />} />
              <Route path="sites" element={<SitesPage />} />
              <Route path="planting" element={<PlantingPage />} />
              <Route path="verify-reports" element={<VerifyReportsPage />} />
              <Route path="monitoring" element={<MonitoringPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Staff routes */}
          <Route element={<ProtectedRoute allowedRoles={["staff"]} />}>
            <Route path="/staff" element={<DashboardLayout />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="seedlings" element={<SeedlingsPage />} />
              <Route path="requests" element={<SeedlingRequestsPage />} />
              <Route path="process-requests" element={<ProcessRequestsPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="schedule" element={<EventSchedulePage />} />
              <Route path="sites" element={<SitesPage />} />
              <Route path="planting" element={<PlantingPage />} />
              <Route path="verify-reports" element={<VerifyReportsPage />} />
              <Route path="monitoring" element={<MonitoringPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />  
            </Route>
          </Route>

          {/* Participant routes */}
          <Route element={<ProtectedRoute allowedRoles={["participant"]} />}>
            <Route path="/participant" element={<DashboardLayout />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="request-seedlings" element={<SeedlingRequestsPage />} />
              <Route path="my-requests" element={<SeedlingRequestsPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="my-sites" element={<SitesPage />} />
              <Route path="my-activities" element={<PlantingPage />} />
              <Route path="monitoring" element={<MonitoringPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;