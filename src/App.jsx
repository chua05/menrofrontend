import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";

import DashboardLayout from "./layouts/DashboardLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import { RootRedirect, GuestOnlyRoute } from "./routes/RootRedirect";

/* =========================
   AUTH
========================= */

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import CompleteProfilePage from "./pages/CompleteProfilePage";
import GuestEventPage from "./pages/GuestEventPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";

/* =========================
   SHARED
========================= */

import DashboardPage from "./pages/DashboardPage";

import UsersPage from "./pages/UsersPage";
import SeedlingsPage from "./pages/SeedlingsPage";
import SeedlingRequestsPage from "./pages/SeedlingRequestsPage";
import MyRequestsPage from "./pages/MyRequestsPage";

import EventSchedulePage from "./pages/EventSchedulePage";

import SitesPage from "./pages/SitesPage";
import PlantingPage from "./pages/PlantingPage";
import MonitoringPage from "./pages/MonitoringPage";

import ReportsPage from "./pages/ReportsPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";

/* Temporary pages until their final UI is built */
import ReforestationAnalyticsPage from "./pages/ReforestationAnalyticsPage";
import MapVisualizationPage from "./pages/MapVisualizationPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* =========================
              PUBLIC
          ========================= */}

          <Route
            path="/"
            element={<RootRedirect />}
          />

          <Route
            path="/login"
            element={
              <GuestOnlyRoute>
                <LoginPage />
              </GuestOnlyRoute>
            }
          />

          <Route
            path="/register"
            element={
              <GuestOnlyRoute>
                <RegisterPage />
              </GuestOnlyRoute>
            }
          />

          <Route path="/join-event/:token" element={<GuestEventPage />} />

          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/complete-profile" element={<CompleteProfilePage />} />

          {/* =========================
              ADMIN
          ========================= */}

          <Route
            element={
              <ProtectedRoute
                allowedRoles={["admin"]}
              />
            }
          >
            <Route
              path="/admin"
              element={<DashboardLayout />}
            >
              <Route
                index
                element={
                  <Navigate
                    to="dashboard"
                    replace
                  />
                }
              />

              <Route
                path="dashboard"
                element={<DashboardPage />}
              />

              <Route
                path="requests"
                element={
                  <SeedlingRequestsPage />
                }
              />

              <Route
                path="seedlings"
                element={<SeedlingsPage />}
              />

              <Route
                path="event-calendar"
                element={
                  <EventSchedulePage />
                }
              />

              <Route
                path="planting-sites"
                element={<SitesPage />}
              />

              <Route
                path="planting-reports"
                element={<PlantingPage />}
              />

              <Route
                path="survival-monitoring"
                element={<MonitoringPage />}
              />

              <Route
                path="reforestation-analytics"
                element={
                  <ReforestationAnalyticsPage />
                }
              />

              <Route
                path="map-visualization"
                element={
                  <MapVisualizationPage />
                }
              />

              <Route
                path="reports"
                element={<ReportsPage />}
              />

              <Route
                path="registered-users"
                element={<UsersPage />}
              />

              <Route
                path="settings"
                element={<SettingsPage />}
              />

              <Route
                path="profile"
                element={<ProfilePage />}
              />


              <Route
                path="users"
                element={
                  <Navigate
                    to="../registered-users"
                    replace
                  />
                }
              />

              <Route
                path="events"
                element={
                  <Navigate
                    to="../event-calendar"
                    replace
                  />
                }
              />

              <Route
                path="schedule"
                element={
                  <Navigate
                    to="../event-calendar"
                    replace
                  />
                }
              />

              <Route
                path="sites"
                element={
                  <Navigate
                    to="../planting-sites"
                    replace
                  />
                }
              />

              <Route
                path="planting"
                element={
                  <Navigate
                    to="../planting-reports"
                    replace
                  />
                }
              />

              <Route
                path="verify-reports"
                element={
                  <Navigate
                    to="../planting-reports"
                    replace
                  />
                }
              />

              <Route
                path="monitoring"
                element={
                  <Navigate
                    to="../survival-monitoring"
                    replace
                  />
                }
              />
            </Route>
          </Route>

          {/* =========================
              STAFF
          ========================= */}

          <Route
            element={
              <ProtectedRoute
                allowedRoles={["staff"]}
              />
            }
          >
            <Route
              path="/staff"
              element={<DashboardLayout />}
            >
              <Route
                index
                element={
                  <Navigate
                    to="dashboard"
                    replace
                  />
                }
              />

              <Route
                path="dashboard"
                element={<DashboardPage />}
              />

              <Route
                path="requests"
                element={
                  <SeedlingRequestsPage />
                }
              />

              <Route
                path="seedlings"
                element={<SeedlingsPage />}
              />

              <Route
                path="event-calendar"
                element={
                  <EventSchedulePage />
                }
              />

              <Route
                path="planting-sites"
                element={<SitesPage />}
              />

              <Route
                path="planting-reports"
                element={<PlantingPage />}
              />

              <Route
                path="survival-monitoring"
                element={<MonitoringPage />}
              />

              <Route
                path="reforestation-analytics"
                element={
                  <ReforestationAnalyticsPage />
                }
              />

              <Route
                path="map-visualization"
                element={
                  <MapVisualizationPage />
                }
              />

              <Route
                path="reports"
                element={<ReportsPage />}
              />

              {/* Staff = VIEW ONLY later inside UsersPage */}
              <Route
                path="registered-users"
                element={<UsersPage />}
              />

              <Route
                path="settings"
                element={<SettingsPage />}
              />

              <Route
                path="profile"
                element={<ProfilePage />}
              />

              {/* OLD ROUTE COMPATIBILITY */}

              <Route
                path="users"
                element={
                  <Navigate
                    to="../registered-users"
                    replace
                  />
                }
              />

              <Route
                path="events"
                element={
                  <Navigate
                    to="../event-calendar"
                    replace
                  />
                }
              />

              <Route
                path="schedule"
                element={
                  <Navigate
                    to="../event-calendar"
                    replace
                  />
                }
              />

              <Route
                path="sites"
                element={
                  <Navigate
                    to="../planting-sites"
                    replace
                  />
                }
              />

              <Route
                path="planting"
                element={
                  <Navigate
                    to="../planting-reports"
                    replace
                  />
                }
              />

              <Route
                path="verify-reports"
                element={
                  <Navigate
                    to="../planting-reports"
                    replace
                  />
                }
              />

              <Route
                path="monitoring"
                element={
                  <Navigate
                    to="../survival-monitoring"
                    replace
                  />
                }
              />
            </Route>
          </Route>

          {/* =========================
              PARTICIPANT
          ========================= */}

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "participant",
                ]}
              />
            }
          >
            <Route
              path="/participant"
              element={<DashboardLayout />}
            >
              <Route
                index
                element={
                  <Navigate
                    to="dashboard"
                    replace
                  />
                }
              />

              <Route
                path="dashboard"
                element={<DashboardPage />}
              />

              <Route
                path="request-seedlings"
                element={
                  <SeedlingRequestsPage />
                }
              />

              <Route
                path="my-requests"
                element={
                  <MyRequestsPage />
                }
              />

              <Route
                path="event-calendar"
                element={
                  <EventSchedulePage />
                }
              />

              <Route
                path="planting-sites"
                element={<SitesPage />}
              />

              <Route
                path="my-planting-reports"
                element={<PlantingPage />}
              />

              <Route
                path="survival-monitoring"
                element={<MonitoringPage />}
              />

              <Route
                path="profile"
                element={<ProfilePage />}
              />

              {/* OLD PARTICIPANT LINKS */}

              <Route
                path="events"
                element={
                  <Navigate
                    to="../event-calendar"
                    replace
                  />
                }
              />

              <Route
                path="my-sites"
                element={
                  <Navigate
                    to="../planting-sites"
                    replace
                  />
                }
              />

              <Route
                path="my-activities"
                element={
                  <Navigate
                    to="../my-planting-reports"
                    replace
                  />
                }
              />

              <Route
                path="monitoring"
                element={
                  <Navigate
                    to="../survival-monitoring"
                    replace
                  />
                }
              />
            </Route>
          </Route>

          {/* UNKNOWN ROUTE */}

          <Route
            path="*"
            element={
              <Navigate
                to="/login"
                replace
              />
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
