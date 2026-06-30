import { useAuth } from "../context/AuthContext";

import DashboardHeader from "../components/dashboard/DashboardHeader";
import DashboardCards from "../components/dashboard/DashboardCards";
import RecentActivities from "../components/dashboard/RecentActivities";
import QuickActions from "../components/dashboard/QuickActions";

export default function DashboardPage() {

  const { currentUser, userRole } = useAuth();

  return (

    <div className="page-wrapper">

    <h1>Dashboard Loaded</h1>

    <p>User: {currentUser?.fullName}</p>

    <p>Role: {userRole}</p>

    <DashboardHeader
        user={currentUser}
        role={userRole}
    />

    <DashboardCards
        role={userRole}
    />

    <div className="dashboard-content">

        <RecentActivities />

        <QuickActions />

    </div>

</div>

  );

}