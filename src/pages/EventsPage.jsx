import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { FiCalendar, FiMapPin, FiUsers, FiPlus, FiEdit2, FiTrash2, FiEye } from "react-icons/fi";

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
    date: "2026-06-10",
    time: "9:00 AM",
    participants: 30,
    maxParticipants: 30,
    status: "Completed",
    description: "Tree planting activity conducted at Juban Central School.",
    registered: false,
  },
];

const STATUS_COLORS = {
  "Upcoming": { bg: "#dbeafe", color: "#1e40af" },
  "Full": { bg: "#fef9c3", color: "#854d0e" },
  "Completed": { bg: "#dcfce7", color: "#166534" },
  "Cancelled": { bg: "#fee2e2", color: "#991b1b" },
};

export default function EventsPage() {
  const { userRole } = useAuth();
  const [events, setEvents] = useState(SAMPLE_EVENTS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({
    name: "", location: "", date: "",
    time: "", maxParticipants: "", description: ""
  });

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name || !form.location || !form.date) return;

    const newEvent = {
      id: `EVT-00${events.length + 1}`,
      name: form.name,
      location: form.location,
      date: form.date,
      time: form.time || "8:00 AM",
      participants: 0,
      maxParticipants: parseInt(form.maxParticipants) || 50,
      status: "Upcoming",
      description: form.description,
      registered: false,
    };

    setEvents((prev) => [...prev, newEvent]);
    setForm({ name: "", location: "", date: "", time: "", maxParticipants: "", description: "" });
    setShowAddModal(false);
    setSuccessMsg("Event created successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleDelete = (id) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setSuccessMsg("Event deleted.");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleRegister = (id) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, registered: !e.registered, participants: e.registered ? e.participants - 1 : e.participants + 1 }
          : e
      )
    );
  };

  return (
    <div style={{ padding: "32px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
            {userRole === "participant" ? "Planting Events" : "Manage Planting Events"}
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            {userRole === "participant"
              ? "View and register for upcoming tree planting activities."
              : "Create and manage tree planting events."}
          </p>
        </div>
        {(userRole === "admin" || userRole === "staff") && (
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              background: "#16a34a", color: "#fff",
              border: "none", borderRadius: "8px",
              padding: "10px 18px", fontSize: "13px",
              fontWeight: "600", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <FiPlus size={14} /> Create Event
          </button>
        )}
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

      {/* Summary Cards — Admin/Staff only */}
      {(userRole === "admin" || userRole === "staff") && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "16px", marginBottom: "24px"
        }}>
          {[
            { label: "Total Events", value: events.length, icon: "📅" },
            { label: "Upcoming", value: events.filter(e => e.status === "Upcoming").length, icon: "🔜" },
            { label: "Completed", value: events.filter(e => e.status === "Completed").length, icon: "✅" },
            { label: "Full", value: events.filter(e => e.status === "Full").length, icon: "👥" },
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
      )}

      {/* Events Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: "16px"
      }}>
        {events.map((event) => (
          <div key={event.id} style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "12px", padding: "20px",
            display: "flex", flexDirection: "column", gap: "12px"
          }}>
            {/* Event header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", marginBottom: "4px" }}>
                  {event.id}
                </div>
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
                  {event.name}
                </h3>
              </div>
              <span style={{
                padding: "4px 10px", borderRadius: "999px",
                fontSize: "11px", fontWeight: "600",
                background: STATUS_COLORS[event.status]?.bg,
                color: STATUS_COLORS[event.status]?.color,
                whiteSpace: "nowrap"
              }}>
                {event.status}
              </span>
            </div>

            {/* Event details */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#6b7280" }}>
                <FiCalendar size={13} />
                {event.date} — {event.time}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#6b7280" }}>
                <FiMapPin size={13} />
                {event.location}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#6b7280" }}>
                <FiUsers size={13} />
                {event.participants} / {event.maxParticipants} participants
              </div>
            </div>

            {/* Description */}
            <p style={{ fontSize: "13px", color: "#6b7280", margin: 0, lineHeight: "1.5" }}>
              {event.description}
            </p>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              {/* Participant actions */}
              {userRole === "participant" && event.status === "Upcoming" && (
                <button
                  onClick={() => handleRegister(event.id)}
                  style={{
                    flex: 1, padding: "8px 14px",
                    background: event.registered ? "#fee2e2" : "#16a34a",
                    color: event.registered ? "#991b1b" : "#fff",
                    border: "none", borderRadius: "8px",
                    fontSize: "13px", fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  {event.registered ? "Cancel Registration" : "Register"}
                </button>
              )}

              {/* Admin/Staff actions */}
              {(userRole === "admin" || userRole === "staff") && (
                <>
                  <button
                    onClick={() => { setSelectedEvent(event); setShowViewModal(true); }}
                    style={{
                      flex: 1, padding: "8px 14px",
                      background: "#f3f4f6", color: "#374151",
                      border: "none", borderRadius: "8px",
                      fontSize: "13px", fontWeight: "600",
                      cursor: "pointer", display: "flex",
                      alignItems: "center", justifyContent: "center", gap: "4px"
                    }}
                  >
                    <FiEye size={12} /> View
                  </button>
                  {userRole === "admin" && (
                    <button
                      onClick={() => handleDelete(event.id)}
                      style={{
                        padding: "8px 14px",
                        background: "#fee2e2", color: "#991b1b",
                        border: "none", borderRadius: "8px",
                        fontSize: "13px", fontWeight: "600",
                        cursor: "pointer", display: "flex",
                        alignItems: "center", gap: "4px"
                      }}
                    >
                      <FiTrash2 size={12} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "#fff", borderRadius: "16px",
            padding: "28px", width: "500px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            maxHeight: "90vh", overflowY: "auto"
          }}>
            <h2 style={{ fontSize: "17px", fontWeight: "700", marginBottom: "20px" }}>
              Create New Event
            </h2>
            <form onSubmit={handleAdd}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                    Event Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Juban Reforestation Drive"
                    value={form.name}
                    onChange={update("name")}
                    style={{
                      width: "100%", padding: "10px 12px",
                      border: "1px solid #e5e7eb", borderRadius: "8px",
                      fontSize: "13px", boxSizing: "border-box"
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                    Location *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Barangay Tughan, Juban"
                    value={form.location}
                    onChange={update("location")}
                    style={{
                      width: "100%", padding: "10px 12px",
                      border: "1px solid #e5e7eb", borderRadius: "8px",
                      fontSize: "13px", boxSizing: "border-box"
                    }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                      Date *
                    </label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={update("date")}
                      style={{
                        width: "100%", padding: "10px 12px",
                        border: "1px solid #e5e7eb", borderRadius: "8px",
                        fontSize: "13px", boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                      Time
                    </label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={update("time")}
                      style={{
                        width: "100%", padding: "10px 12px",
                        border: "1px solid #e5e7eb", borderRadius: "8px",
                        fontSize: "13px", boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                    Max Participants
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 50"
                    value={form.maxParticipants}
                    onChange={update("maxParticipants")}
                    style={{
                      width: "100%", padding: "10px 12px",
                      border: "1px solid #e5e7eb", borderRadius: "8px",
                      fontSize: "13px", boxSizing: "border-box"
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                    Description
                  </label>
                  <textarea
                    placeholder="Brief description of the event..."
                    value={form.description}
                    onChange={update("description")}
                    rows={3}
                    style={{
                      width: "100%", padding: "10px 12px",
                      border: "1px solid #e5e7eb", borderRadius: "8px",
                      fontSize: "13px", resize: "vertical",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: "10px 18px", border: "1px solid #e5e7eb",
                    borderRadius: "8px", fontSize: "13px",
                    background: "#fff", cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "10px 18px", background: "#16a34a",
                    color: "#fff", border: "none", borderRadius: "8px",
                    fontSize: "13px", fontWeight: "600", cursor: "pointer"
                  }}
                >
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Event Modal */}
      {showViewModal && selectedEvent && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "#fff", borderRadius: "16px",
            padding: "28px", width: "460px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: "700", margin: 0 }}>
                Event Details
              </h2>
              <span style={{
                padding: "4px 10px", borderRadius: "999px",
                fontSize: "11px", fontWeight: "600",
                background: STATUS_COLORS[selectedEvent.status]?.bg,
                color: STATUS_COLORS[selectedEvent.status]?.color,
              }}>
                {selectedEvent.status}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", marginBottom: "2px" }}>EVENT NAME</div>
                <div style={{ fontSize: "14px", color: "#1a1a1a", fontWeight: "600" }}>{selectedEvent.name}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", marginBottom: "2px" }}>LOCATION</div>
                <div style={{ fontSize: "14px", color: "#374151" }}>{selectedEvent.location}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", marginBottom: "2px" }}>DATE</div>
                  <div style={{ fontSize: "14px", color: "#374151" }}>{selectedEvent.date}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", marginBottom: "2px" }}>TIME</div>
                  <div style={{ fontSize: "14px", color: "#374151" }}>{selectedEvent.time}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", marginBottom: "2px" }}>PARTICIPANTS</div>
                <div style={{ fontSize: "14px", color: "#374151" }}>{selectedEvent.participants} / {selectedEvent.maxParticipants}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", marginBottom: "2px" }}>DESCRIPTION</div>
                <div style={{ fontSize: "14px", color: "#374151" }}>{selectedEvent.description}</div>
              </div>
            </div>
            <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowViewModal(false)}
                style={{
                  padding: "10px 18px", border: "1px solid #e5e7eb",
                  borderRadius: "8px", fontSize: "13px",
                  background: "#fff", cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}