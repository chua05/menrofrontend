import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./routes/ProtectedRoute";

// Auth
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";

// Admin
import ManageUsers from "./pages/admin/ManageUsers";

// Staff
import ManageSeedlings from "./pages/staff/ManageSeedlings";
import ProcessRequests from "./pages/staff/ProcessRequests";
import VerifyReports from "./pages/staff/VerifyReports";

// Shared
import PlantingEvents from "./pages/shared/PlantingEvents";
import EventSchedule from "./pages/shared/EventSchedule";
import SubmitPlantingReport from "./pages/shared/SubmitPlantingReport";
import TreeMonitoring from "./pages/shared/TreeMonitoring";
import PlantingMap from "./pages/shared/PlantingMap";
import Reports from "./pages/shared/Reports";
import SeedlingRequests from "./pages/shared/SeedlingRequests";

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
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="requests" element={<SeedlingRequests />} />
            <Route path="seedlings" element={<ManageSeedlings />} />
            <Route path="process-requests" element={<ProcessRequests />} />
            <Route path="events" element={<PlantingEvents />} />
            <Route path="schedule" element={<EventSchedule />} />
            <Route path="map" element={<PlantingMap />} />
            <Route path="planting" element={<SubmitPlantingReport />} />
            <Route path="verify-reports" element={<VerifyReports />} />
            <Route path="monitoring" element={<TreeMonitoring />} />
            <Route path="reports" element={<Reports />} />
          </Route>

          {/* Staff routes */}
          <Route path="/staff" element={
            <ProtectedRoute allowedRoles={["staff"]}>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="seedlings" element={<ManageSeedlings />} />
            <Route path="requests" element={<SeedlingRequests />} />
            <Route path="process-requests" element={<ProcessRequests />} />
            <Route path="events" element={<PlantingEvents />} />
            <Route path="schedule" element={<EventSchedule />} />
            <Route path="map" element={<PlantingMap />} />
            <Route path="planting" element={<SubmitPlantingReport />} />
            <Route path="verify-reports" element={<VerifyReports />} />
            <Route path="monitoring" element={<TreeMonitoring />} />
            <Route path="reports" element={<Reports />} />
          </Route>

          {/* Volunteer routes */}
          <Route path="/volunteer" element={
            <ProtectedRoute allowedRoles={["volunteer"]}>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="request-seedlings" element={<SeedlingRequests />} />
            <Route path="my-requests" element={<SeedlingRequests />} />
            <Route path="events" element={<PlantingEvents />} />
            <Route path="my-sites" element={<PlantingMap />} />
            <Route path="my-activities" element={<SubmitPlantingReport />} />
            <Route path="monitoring" element={<TreeMonitoring />} />
          </Route>

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;