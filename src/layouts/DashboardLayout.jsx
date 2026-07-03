import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardLayout() {
  return (
    <div className="layout">
      <Sidebar />
      <Topbar />
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}