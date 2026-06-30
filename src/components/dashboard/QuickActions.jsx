import {
  FiPlusCircle,
  FiUsers,
  FiClipboard,
  FiCalendar,
  FiFileText,
  FiMapPin,
} from "react-icons/fi";

import { useAuth } from "../../context/AuthContext";

export default function QuickActions() {

  const { userRole } = useAuth();

  const role = userRole;

  let actions = [];

  if (role === "admin") {

    actions = [

      {
        title: "Add Site",
        icon: <FiMapPin />,
      },

      {
        title: "Manage Users",
        icon: <FiUsers />,
      },

      {
        title: "Create Event",
        icon: <FiCalendar />,
      },

      {
        title: "Generate Report",
        icon: <FiFileText />,
      },

    ];

  }

  else if (role === "staff") {

    actions = [

      {
        title: "Verify Request",
        icon: <FiClipboard />,
      },

      {
        title: "Update Inventory",
        icon: <FiPlusCircle />,
      },

      {
        title: "Field Monitoring",
        icon: <FiMapPin />,
      },

      {
        title: "Create Report",
        icon: <FiFileText />,
      },

    ];

  }

  else {

    actions = [

      {
        title: "Request Seedlings",
        icon: <FiClipboard />,
      },

      {
        title: "Submit Report",
        icon: <FiFileText />,
      },

      {
        title: "View Sites",
        icon: <FiMapPin />,
      },

      {
        title: "Join Event",
        icon: <FiCalendar />,
      },

    ];

  }

  return (

    <div className="dashboard-panel">

      <div className="panel-header">

        <h3>Quick Actions</h3>

      </div>

      <div className="quick-actions">

        {actions.map((action) => (

          <button

            key={action.title}

            className="quick-action-btn"

          >

            <span className="quick-action-icon">

              {action.icon}

            </span>

            <span>

              {action.title}

            </span>

          </button>

        ))}

      </div>

    </div>

  );

}