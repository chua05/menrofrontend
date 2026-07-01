import { useAuth } from "../context/AuthContext";

// Role-based card configs
const CARDS = {
  admin: [
    { label: "Registered Users", value: "—", icon: "👥" },
    { label: "Pending Requests", value: "—", icon: "📋" },
    { label: "Planting Sites", value: "—", icon: "📍" },
    { label: "Verified Reports", value: "—", icon: "✅" },
  ],
  staff: [
    { label: "Seedling Requests", value: "—", icon: "🌱" },
    { label: "Tree Reports", value: "—", icon: "🌳" },
    { label: "Planting Sites", value: "—", icon: "📍" },
    { label: "Available Seedlings", value: "—", icon: "📦" },
  ],
  volunteer: [
    { label: "My Requests", value: "—", icon: "📋" },
    { label: "Joined Events", value: "—", icon: "📅" },
    { label: "Submitted Reports", value: "—", icon: "📄" },
    { label: "Planting Sites", value: "—", icon: "📍" },
  ],
};

const WELCOME = {
  admin: "Welcome back, Administrator. Here is the system overview.",
  staff: "Welcome back. Here are your current operational tasks.",
  volunteer: "Welcome! Here is a summary of your reforestation activities.",
};

export default function DashboardPage() {
  const { currentUser, userRole } = useAuth();
  const cards = CARDS[userRole] || CARDS.volunteer;
  const welcome = WELCOME[userRole] || WELCOME.volunteer;

  return (
    <div style={{ padding: "32px" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#1a1a1a",
          marginBottom: "4px"
        }}>
          Dashboard
        </h1>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          {welcome}
        </p>
      </div>

      {/* Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
        marginBottom: "32px"
      }}>
        {cards.map((card) => (
          <div key={card.label} style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
            <span style={{ fontSize: "24px" }}>{card.icon}</span>
            <div style={{
              fontSize: "22px",
              fontWeight: "700",
              color: "#1a1a1a"
            }}>
              {card.value}
            </div>
            <div style={{
              fontSize: "13px",
              color: "#6b7280"
            }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Coming soon */}
      <div style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "24px",
        color: "#6b7280",
        fontSize: "14px",
        textAlign: "center"
      }}>
        📊 Charts and recent activity will appear here once backend is connected.
      </div>

    </div>
  );
}