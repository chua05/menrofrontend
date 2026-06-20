import { FiMapPin, FiPlus, FiClock, FiAlertCircle, FiCheckCircle } from "react-icons/fi";

const myRequests = [
  { id: "#SR-2024-082", qty: 150, species: "Pili", status: "IN REVIEW", date: "OCT 12, 2025" },
  { id: "#SR-2024-075", qty: 50, species: "Calamansi", status: "READY FOR PICKUP", date: "OCT 12, 2025" },
  { id: "#SR-2024-061", qty: 200, species: "Lansones", status: "COMPLETED", date: "OCT 12, 2025" },
];

const survivalTasks = [
  { location: "Purok 2 - Bacolod, Juban", due: "Due: 2 days ago", species: "Lansones Saplings", overdue: true },
  { location: "Purok 5 - Biriran, Juban", due: "Due: Today", species: "Lansones", overdue: true },
  { location: "Purok 3 - Lajong, Juban", due: "Starts in 3 days", species: "Calamansi", overdue: false },
];

const upcomingEvents = [
  { title: "Tree Planting - Barangay Bacolod", date: "OCT 18", status: "PLANNED", seedlings: 300 },
  { title: "Tree Planting - Barangay Catanagan", date: "OCT 21", status: "PLANNED", seedlings: 250 },
];

const statusStyle = {
  "IN REVIEW":       { bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
  "READY FOR PICKUP":{ bg: "#dcfce7", color: "#166534", dot: "#22c55e" },
  "COMPLETED":       { bg: "#f3f4f6", color: "#6b7280", dot: "#9ca3af" },
};

export default function VolunteerDashboard() {
  return (
    <div className="page-wrapper">

      {/* ── Page Header ── */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: "24px",
      }}>
        <div>
          <div className="page-title">Overview</div>
          <div className="page-subtitle">
            Welcome back. You have 3 monitoring reports due this week.
          </div>
        </div>

        {/* Total Trees Planted card */}
        <div style={{
          background: "#166534",
          borderRadius: "10px",
          padding: "12px 20px",
          textAlign: "center",
          minWidth: "130px",
        }}>
          <div style={{
            fontSize: "10px",
            color: "rgba(255,255,255,.6)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            marginBottom: "4px",
          }}>
            Total Trees Planted
          </div>
          <div style={{
            fontSize: "32px",
            fontFamily: "'DM Serif Display', serif",
            color: "#fff",
            lineHeight: 1,
          }}>
            350
          </div>
          <div style={{
            fontSize: "10px",
            color: "rgba(255,255,255,.5)",
            marginTop: "4px",
          }}>
            trees this month
          </div>
        </div>
      </div>

      {/* ── My Seedling Requests ── */}
      <div style={{
        background: "#fff",
        border: "1px solid #ede9e4",
        borderRadius: "10px",
        overflow: "hidden",
        marginBottom: "16px",
      }}>
        <div style={{
          padding: "14px 16px",
          borderBottom: "1px solid #f5f4f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#1c1917",
            display: "flex",
            alignItems: "center",
            gap: "7px",
          }}>
            🌱 My Seedling Requests
          </div>
          <span style={{
            fontSize: "11px",
            color: "#166534",
            cursor: "pointer",
            fontWeight: 500,
          }}>
            View All →
          </span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#faf9f6" }}>
              {["Request ID", "Quantity", "Species", "Status", "Date"].map((h) => (
                <th key={h} style={{
                  padding: "8px 16px",
                  textAlign: "left",
                  fontSize: "10px",
                  color: "#a8a29e",
                  fontWeight: 500,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  borderBottom: "1px solid #ede9e4",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {myRequests.map((row, i) => {
              const s = statusStyle[row.status];
              return (
                <tr key={i} style={{ borderBottom: "1px solid #f5f4f0" }}>
                  <td style={{
                    padding: "12px 16px",
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#1c1917",
                  }}>
                    {row.id}
                  </td>
                  <td style={{
                    padding: "12px 16px",
                    fontSize: "12px",
                    color: "#78716c",
                  }}>
                    {row.qty}
                  </td>
                  <td style={{
                    padding: "12px 16px",
                    fontSize: "12px",
                    color: "#78716c",
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                  }}>
                    {row.species}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 500,
                      background: s.bg,
                      color: s.color,
                      padding: "3px 9px",
                      borderRadius: "10px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}>
                      <span style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: s.dot,
                        display: "inline-block",
                      }} />
                      {row.status}
                    </span>
                  </td>
                  <td style={{
                    padding: "12px 16px",
                    fontSize: "11px",
                    color: "#a8a29e",
                  }}>
                    {row.date}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* New Request button */}
        <div style={{
          padding: "12px 16px",
          borderTop: "1px solid #f5f4f0",
          background: "#faf9f6",
        }}>
          <button style={{
            height: "34px",
            padding: "0 14px",
            background: "#166534",
            border: "none",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#fff",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}>
            <FiPlus size={13} /> New Request
          </button>
        </div>
      </div>

      {/* ── Bottom Row: Map + Survival Monitoring ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr",
        gap: "14px",
      }}>

        {/* Assigned Planting Areas — Map placeholder */}
        <div style={{
          background: "#fff",
          border: "1px solid #ede9e4",
          borderRadius: "10px",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "14px 16px",
            borderBottom: "1px solid #f5f4f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#1c1917",
              display: "flex",
              alignItems: "center",
              gap: "7px",
            }}>
              🗺️ Assigned Planting Areas
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#166534" }} />
                <span style={{ fontSize: "10px", color: "#78716c" }}>Active</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b" }} />
                <span style={{ fontSize: "10px", color: "#78716c" }}>Maintenance</span>
              </div>
            </div>
          </div>

          {/* Map placeholder */}
          <div style={{
            position: "relative",
            height: "240px",
            background: "#e8f5e9",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(160deg, #b7dfc0 0%, #a5d6a7 40%, #81c784 100%)",
              opacity: 0.5,
            }} />
            <svg
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              viewBox="0 0 600 240"
            >
              {/* Roads */}
              <path d="M0 120 Q150 100 300 120 Q450 140 600 120" fill="none" stroke="#fff" strokeWidth="4" opacity="0.5" />
              <path d="M0 60 Q200 80 400 50 Q500 40 600 60" fill="none" stroke="#fff" strokeWidth="2" opacity="0.3" />
              <path d="M100 0 Q120 100 100 240" fill="none" stroke="#fff" strokeWidth="2" opacity="0.3" />
              <path d="M350 0 Q370 120 350 240" fill="none" stroke="#fff" strokeWidth="2" opacity="0.25" />
              {/* River */}
              <path d="M0 180 Q100 160 200 180 Q300 200 400 175 Q500 155 600 180" fill="none" stroke="#64b5f6" strokeWidth="6" opacity="0.4" />
              {/* Pins */}
              <circle cx="180" cy="110" r="10" fill="#166534" opacity="0.9" />
              <circle cx="180" cy="110" r="4" fill="#fff" />
              <circle cx="320" cy="90" r="10" fill="#f59e0b" opacity="0.9" />
              <circle cx="320" cy="90" r="4" fill="#fff" />
              <circle cx="450" cy="130" r="10" fill="#166534" opacity="0.9" />
              <circle cx="450" cy="130" r="4" fill="#fff" />
              <circle cx="120" cy="160" r="10" fill="#166534" opacity="0.9" />
              <circle cx="120" cy="160" r="4" fill="#fff" />
            </svg>

            {/* Location tooltip */}
            <div style={{
              position: "absolute",
              bottom: "12px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(255,255,255,.95)",
              borderRadius: "8px",
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,.1)",
              minWidth: "280px",
            }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 500, color: "#1c1917" }}>
                  Barangay Bacolod, Purok 2
                </div>
                <div style={{ fontSize: "10px", color: "#a8a29e", marginTop: "2px" }}>
                  200 Seedlings Planted • 60% Survival Rate
                </div>
              </div>
              <button style={{
                height: "28px",
                padding: "0 10px",
                background: "#166534",
                border: "none",
                borderRadius: "6px",
                fontSize: "11px",
                color: "#fff",
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}>
                Update Status
              </button>
            </div>
          </div>

          {/* Upcoming events */}
          <div style={{ padding: "12px 16px" }}>
            <div style={{
              fontSize: "11px",
              color: "#a8a29e",
              letterSpacing: ".06em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}>
              Upcoming Events
            </div>
            {upcomingEvents.map((ev, i) => (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 0",
                borderBottom: i < upcomingEvents.length - 1 ? "1px solid #f5f4f0" : "none",
              }}>
                <div style={{
                  background: "#0f2818",
                  color: "#fff",
                  borderRadius: "7px",
                  padding: "4px 8px",
                  textAlign: "center",
                  flexShrink: 0,
                }}>
                  <div style={{ fontSize: "9px", opacity: .6 }}>OCT</div>
                  <div style={{
                    fontSize: "14px",
                    fontFamily: "'DM Serif Display', serif",
                    lineHeight: 1,
                  }}>
                    {ev.date.split(" ")[1]}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "12px", color: "#1c1917", fontWeight: 400 }}>
                    {ev.title}
                  </div>
                  <div style={{ fontSize: "10px", color: "#a8a29e", marginTop: "1px" }}>
                    {ev.seedlings} seedlings planned
                  </div>
                </div>
                <span style={{
                  fontSize: "10px",
                  background: "#dcfce7",
                  color: "#166534",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontWeight: 500,
                }}>
                  {ev.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Survival Monitoring */}
        <div style={{
          background: "#fff",
          border: "1px solid #ede9e4",
          borderRadius: "10px",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "14px 16px",
            borderBottom: "1px solid #f5f4f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#1c1917",
              display: "flex",
              alignItems: "center",
              gap: "7px",
            }}>
              ⏰ Survival Monitoring
            </div>
            <span style={{
              fontSize: "10px",
              background: "#fee2e2",
              color: "#dc2626",
              padding: "2px 8px",
              borderRadius: "10px",
              fontWeight: 500,
            }}>
              2 OVERDUE
            </span>
          </div>

          <div style={{ padding: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {survivalTasks.map((task, i) => (
                <div key={i} style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: `1px solid ${task.overdue ? "#fecaca" : "#ede9e4"}`,
                  background: task.overdue ? "#fff5f5" : "#faf9f6",
                  borderLeft: `3px solid ${task.overdue ? "#ef4444" : "#166534"}`,
                }}>
                  <div style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#1c1917",
                    marginBottom: "3px",
                  }}>
                    {task.location}
                  </div>
                  <div style={{
                    fontSize: "10px",
                    color: task.overdue ? "#ef4444" : "#a8a29e",
                    marginBottom: "2px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}>
                    {task.overdue
                      ? <FiAlertCircle size={10} />
                      : <FiClock size={10} />
                    }
                    {task.due}
                  </div>
                  <div style={{ fontSize: "10px", color: "#a8a29e" }}>
                    {task.species}
                  </div>
                </div>
              ))}
            </div>

            <button style={{
              width: "100%",
              marginTop: "10px",
              height: "34px",
              background: "#fff",
              border: "1px solid #ede9e4",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#78716c",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}>
              View All Tasks →
            </button>
          </div>

          {/* Quick stats */}
          <div style={{
            padding: "12px 16px",
            borderTop: "1px solid #f5f4f0",
            background: "#faf9f6",
          }}>
            <div style={{
              fontSize: "11px",
              color: "#a8a29e",
              letterSpacing: ".06em",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}>
              My Planting Summary
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
            }}>
              {[
                { label: "Trees Planted", value: "350", color: "#166534" },
                { label: "Survival Rate", value: "87%", color: "#166534" },
                { label: "Active Sites", value: "3", color: "#1c1917" },
                { label: "Reports Filed", value: "8", color: "#1c1917" },
              ].map((s) => (
                <div key={s.label} style={{
                  background: "#fff",
                  border: "1px solid #ede9e4",
                  borderRadius: "7px",
                  padding: "8px 10px",
                }}>
                  <div style={{
                    fontSize: "16px",
                    fontFamily: "'DM Serif Display', serif",
                    color: s.color,
                  }}>
                    {s.value}
                  </div>
                  <div style={{
                    fontSize: "10px",
                    color: "#a8a29e",
                    marginTop: "2px",
                  }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}