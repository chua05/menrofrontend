import { FiCheckCircle, FiClipboard, FiMapPin } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";

export default function RecentActivities() {
  const { userRole } = useAuth();

  const role = userRole;

  let activities = [];

  if (role === "admin") {
    activities = [
      {
        icon: <FiCheckCircle />,
        title: "New planting site created",
        description: "Mangrove Area 3 • Juban",
        time: "5 minutes ago",
      },
      {
        icon: <FiClipboard />,
        title: "Seedling request approved",
        description: "125 Mahogany seedlings",
        time: "20 minutes ago",
      },
      {
        icon: <FiMapPin />,
        title: "Monitoring report submitted",
        description: "Barangay Bacolod",
        time: "1 hour ago",
      },
    ];
  }

  else if (role === "staff") {
    activities = [
      {
        icon: <FiClipboard />,
        title: "New seedling request received",
        description: "Awaiting verification",
        time: "10 minutes ago",
      },
      {
        icon: <FiCheckCircle />,
        title: "Inventory updated",
        description: "Nursery stock adjusted",
        time: "40 minutes ago",
      },
      {
        icon: <FiMapPin />,
        title: "Field inspection completed",
        description: "Sitio Proper",
        time: "Today",
      },
    ];
  }

  else {
    activities = [
      {
        icon: <FiClipboard />,
        title: "Seedling request submitted",
        description: "Pending approval",
        time: "Today",
      },
      {
        icon: <FiMapPin />,
        title: "Monitoring report uploaded",
        description: "Waiting verification",
        time: "Yesterday",
      },
      {
        icon: <FiCheckCircle />,
        title: "Joined planting activity",
        description: "Community Reforestation",
        time: "2 days ago",
      },
    ];
  }

  return (
    <div className="dashboard-panel">

      <div className="panel-header">
        <h3>Recent Activities</h3>
      </div>

      <div className="activity-list">

        {activities.map((activity, index) => (

          <div
            key={index}
            className="activity-item"
          >

            <div className="activity-icon">
              {activity.icon}
            </div>

            <div className="activity-content">

              <div className="activity-title">
                {activity.title}
              </div>

              <div className="activity-description">
                {activity.description}
              </div>

            </div>

            <div className="activity-time">
              {activity.time}
            </div>

          </div>

        ))}

      </div>

    </div>
  );
}