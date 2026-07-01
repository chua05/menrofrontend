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
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <DashboardLayout/>
            </ProtectedRoute>
          }>
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
          </Route>

          {/* Staff routes */}
          <Route path="/staff" element={
            <ProtectedRoute allowedRoles={["staff"]}>
             <DashboardLayout/>
            </ProtectedRoute>
          }>
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
          </Route>

          {/* Volunteer routes */}
          <Route path="/volunteer" element={
            <ProtectedRoute allowedRoles={["volunteer"]}>
              <DashboardLayout/>
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="request-seedlings" element={<SeedlingRequestsPage />} />
            <Route path="my-requests" element={<SeedlingRequestsPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="my-sites" element={<SitesPage />} />
            <Route path="my-activities" element={<PlantingPage />} />
            <Route path="monitoring" element={<MonitoringPage />} />
          </Route>

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;