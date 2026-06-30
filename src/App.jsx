import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";

import DashboardLayout from "./layouts/DashboardLayout";

function App() {

  return (

    <BrowserRouter>

      <Routes>

        {/* Redirect */}

        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        {/* Public */}

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/register"
          element={<RegisterPage />}
        />

        {/* Protected Layout */}

        <Route element={<DashboardLayout />}>

          <Route
            path="/admin/dashboard"
            element={<DashboardPage />}
          />

          <Route
            path="/staff/dashboard"
            element={<DashboardPage />}
          />

          <Route
            path="/volunteer/dashboard"
            element={<DashboardPage />}
          />

        </Route>

      </Routes>

    </BrowserRouter>

  );

}

export default App;