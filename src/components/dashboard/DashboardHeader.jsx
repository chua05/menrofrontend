import { FiCalendar } from "react-icons/fi";

export default function DashboardHeader({ user, role }) {

  const roleTitle = {
    admin: "Administrator",
    staff: "Office Staff",
    volunteer: "Participant",
  };

  return (
    <div className="dashboard-header">

      <div className="dashboard-header-left">

        <h1>
          Welcome, {user?.fullName || "User"}
        </h1>

        <p>
          {roleTitle[role]} Dashboard
        </p>

      </div>

      <div className="dashboard-date">

        <FiCalendar />

        <span>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>

      </div>

    </div>
  );
}