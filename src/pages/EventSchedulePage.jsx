import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { FiCalendar, FiMapPin, FiUsers, FiClock } from "react-icons/fi";

const SAMPLE_EVENTS = [
  {
    id: "EVT-001",
    name: "Juban Reforestation Drive",
    location: "Barangay Tughan, Juban",
    date: "2026-07-15",
    time: "8:00 AM",
    participants: 25,
    maxParticipants: 50,
    status: "Upcoming",
    description: "Annual tree planting activity for barangay Tughan.",
    registered: false,
  },
  {
    id: "EVT-002",
    name: "Coastal Mangrove Planting",
    location: "Barangay Bulan Shore, Juban",
    date: "2026-07-22",
    time: "7:00 AM",
    participants: 40,
    maxParticipants: 40,
    status: "Full",
    description: "Mangrove restoration along the coastal areas of Juban.",
    registered: true,
  },
  {
    id: "EVT-003",
    name: "School Greening Program",
    location: "Juban Central School",
    date: "2026-08-05",
    time: "9:00 AM",
    participants: 10,
    maxParticipants: 30,
    status: "Upcoming",
    description: "Tree planting activity at Juban Central School.",
    registered: false,
  },
  {
    id: "EVT-004",
    name: "Barangay Gatbo Planting",
    location: "Barangay Gatbo, Juban",
    date: "2026-06-10",
    time: "8:00 AM",
    participants: 30,
    maxParticipants: 30,
    status: "Completed",
    description: "Completed planting activity in Barangay Gatbo.",
    registered: false,
  },
];

const STATUS_COLORS = {
  "Upcoming": { bg: "#dbeafe", color: "#1e40af" },
  "Full": { bg: "#fef9c3", color: "#854d0e" },
  "Completed": { bg: "#dcfce7", color: "#166534" },
  "Cancelled": { bg: "#fee2e2", color: "#991b1b" },
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function EventSchedulePage() {
  const { userRole } = useAuth();
  const [events, setEvents] = useState(SAMPLE_EVENTS);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [successMsg, setSuccessMsg] = useState("");

  const handleRegister = (id) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, registered: !e.registered, participants: e.registered ? e.participants - 1 : e.participants + 1 }
          : e
      )
    );
    setSuccessMsg("Registration updated!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const filtered = events.filter((e) => {
    if (selectedMonth === "all") return true;
    const month = new Date(e.date).getMonth();
    return month === parseInt(selectedMonth);
  });

  const upcoming = filtered.filter(e => e.status === "Upcoming" || e.status === "Full");
  const completed = filtered.filter(e => e.status === "Completed");

  return (
    <div style={{ padding: "32px" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
          Event Schedule
        </h1>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          View the schedule of upcoming and completed tree planting activities.
        </p>
      </div>

      {/* Success message */}
      {successMsg && (
        <div style={{
          background: "#dcfce7", color: "#166534",
          padding: "12px 16px", borderRadius: "8px",
          marginBottom: "16px", fontSize: "13px", fontWeight: "500"
        }}>
          ✅ {successMsg}
        </div>
      )}

      {/* Summary Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "16px", marginBottom: "24px"
      }}>
        {[
          { label: "Total Events", value: events.length, icon: "📅" },
          { label: "Upcoming", value: events.filter(e => e.status === "Upcoming").length, icon: "🔜" },
          { label: "Full", value: events.filter(e => e.status === "Full").length, icon: "👥" },
          { label: "Completed", value: events.filter(e => e.status === "Completed").length, icon: "✅" },
        ].map((card) => (
          <div key={card.label} style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "12px", padding: "16px",
          }}>
            <div style={{ fontSize: "20px", marginBottom: "6px" }}>{card.icon}</div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a" }}>{card.value}</div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Month Filter */}
      <div style={{ marginBottom: "20px" }}>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            padding: "10px 14px",
            border: "1px solid #e5e7eb", borderRadius: "8px",
            fontSize: "13px", background: "#fff", color: "#374151"
          }}
        >
          <option value="all">All Months</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i}>{m}</option>
          ))}
        </select>
      </div>

      {/* Upcoming Events */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#1a1a1a", marginBottom: "16px" }}>
            🔜 Upcoming Events
          </h2>
          <div style={{
            display: "flex", flexDirection: "column", gap: "12px"
          }}>
            {upcoming.map((event) => (
              <div key={event.id} style={{
                background: "#fff", border: "1px solid #e5e7eb",
                borderRadius: "12px", padding: "20px",
                display: "flex", justifyContent: "space-between",
                alignItems: "center", gap: "16px",
                flexWrap: "wrap"
              }}>
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                  {/* Date Box */}
                  <div style={{
                    background: "#f0fdf4", border: "1px solid #86efac",
                    borderRadius: "10px", padding: "10px 14px",
                    textAlign: "center", minWidth: "56px"
                  }}>
                    <div style={{ fontSize: "20px", fontWeight: "700", color: "#16a34a" }}>
                      {new Date(event.date).getDate()}
                    </div>
                    <div style={{ fontSize: "11px", color: "#16a34a", fontWeight: "600" }}>
                      {MONTHS[new Date(event.date).getMonth()].slice(0, 3).toUpperCase()}
                    </div>
                  </div>

                  {/* Event Info */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "15px", fontWeight: "700", color: "#1a1a1a" }}>
                        {event.name}
                      </span>
                      <span style={{
                        padding: "2px 8px", borderRadius: "999px",
                        fontSize: "11px", fontWeight: "600",
                        background: STATUS_COLORS[event.status]?.bg,
                        color: STATUS_COLORS[event.status]?.color,
                      }}>{event.status}</span>
                    </div>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "13px", color: "#6b7280", display: "flex", alignItems: "center", gap: "4px" }}>
                        <FiMapPin size={12} /> {event.location}
                      </span>
                      <span style={{ fontSize: "13px", color: "#6b7280", display: "flex", alignItems: "center", gap: "4px" }}>
                        <FiCalendar size={12} /> {event.date}
                    </span>
                      <span style={{ fontSize: "13px", color: "#6b7280", display: "flex", alignItems: "center", gap: "4px" }}>
                        <FiClock size={12} /> {event.time}
                      </span>
                      <span style={{ fontSize: "13px", color: "#6b7280", display: "flex", alignItems: "center", gap: "4px" }}>
                        <FiUsers size={12} /> {event.participants}/{event.maxParticipants} attended
                      </span>
                    </div>
                  </div>
                </div>

                {/* Register button — Participant only */}
                {userRole === "participant" && event.status === "Upcoming" && (
                  <button
                    onClick={() => handleRegister(event.id)}
                    style={{
                      padding: "8px 18px",
                      background: event.registered ? "#fee2e2" : "#16a34a",
                      color: event.registered ? "#991b1b" : "#fff",
                      border: "none", borderRadius: "8px",
                      fontSize: "13px", fontWeight: "600",
                      cursor: "pointer", whiteSpace: "nowrap"
                    }}
                  >
                    {event.registered ? "Cancel" : "Register"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Events */}
      {completed.length > 0 && (
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#1a1a1a", marginBottom: "16px" }}>
            ✅ Completed Events
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {completed.map((event) => (
              <div key={event.id} style={{
                background: "#fafafa", border: "1px solid #e5e7eb",
                borderRadius: "12px", padding: "20px",
                display: "flex", gap: "16px", alignItems: "center",
                opacity: 0.8
              }}>
                <div style={{
                  background: "#f3f4f6", borderRadius: "10px",
                  padding: "10px 14px", textAlign: "center", minWidth: "56px"
                }}>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#6b7280" }}>
                    {new Date(event.date).getDate()}
                  </div>
                  <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: "600" }}>
                    {MONTHS[new Date(event.date).getMonth()].slice(0, 3).toUpperCase()}
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "15px", fontWeight: "700", color: "#374151" }}>
                      {event.name}
                    </span>
                    <span style={{
                      padding: "2px 8px", borderRadius: "999px",
                      fontSize: "11px", fontWeight: "600",
                      background: STATUS_COLORS[event.status]?.bg,
                      color: STATUS_COLORS[event.status]?.color,
                    }}>{event.status}</span>
                  </div>
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "13px", color: "#9ca3af", display: "flex", alignItems: "center", gap: "4px" }}>
                      <FiMapPin size={12} /> {event.location}
                    </span>
                    <span style={{ fontSize: "13px", color: "#9ca3af", display: "flex", alignItems: "center", gap: "4px" }}>
                      <FiUsers size={12} /> {event.participants} attended
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
          No events found for selected month.
        </div>
      )}

    </div>
  );
}