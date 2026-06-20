import { FiCheckCircle, FiMapPin } from "react-icons/fi";

const statCards = [
  {
    label: "Average Survival Rate",
    value: "87.4%",
    sub: "Verified via site inspections",
    icon: "📈",
    urgent: false,
  },
  {
    label: "Pending Verification",
    value: "15",
    sub: "Requires immediate site visits",
    icon: "⚠️",
    urgent: true,
  },
  {
    label: "Total Seedlings Available",
    value: "40,205",
    sub: "Seeds in stock",
    icon: "🌱",
    urgent: false,
  },
  {
    label: "Total Seedlings Distributed",
    value: "10,000",
    sub: "Total distributed: 3,500",
    icon: "📦",
    urgent: false,
  },
  {
    label: "Total Trees Planted",
    value: "5,000",
    sub: "Target: 10,000 trees",
    icon: "🌳",
    urgent: false,
  },
];

const verificationQueue = [
  { id: "#TM-8842", location: "Brgy. Bacolod", species: "Lansones", status: "URGENT" },
  { id: "#TM-8845", location: "Brgy. Lajong", species: "Pili", status: "NORMAL" },
  { id: "#TM-8850", location: "Brgy. Biriran", species: "Calamansi", status: "DRAFT" },
  { id: "#TM-8851", location: "Brgy. Bacolod", species: "Lansones", status: "URGENT" },
  { id: "#TM-8853", location: "Brgy. Lajong", species: "Pili", status: "NORMAL" },
];

const recentActivities = [
  { text: "500 Lansones dispatched to Brgy. Biriran", time: "10:45 AM" },
  { text: "Planting report from Brgy. Bacolod submitted", time: "9:30 AM" },
  { text: "Seedling request from Brgy. Lajong approved", time: "Yesterday" },
];

const seedlingStock = [
  { name: "Calamansi", current: 1240, total: 2000 },
  { name: "Lansones", current: 850, total: 5000 },
  { name: "Pili", current: 3400, total: 4000 },
];

const statusStyle = {
  URGENT: { bg: "#fee2e2", color: "#dc2626", dot: "#dc2626" },
  NORMAL: { bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
  DRAFT:  { bg: "#f3f4f6", color: "#6b7280", dot: "#9ca3af" },
};

const barData = [
  { label: "Anog", val: 65 },
  { label: "Bacolod", val: 90 },
  { label: "Aroyoy", val: 50 },
  { label: "Binanuahan", val: 75 },
  { label: "Biriran", val: 85 },
  { label: "Lajong", val: 40 },
];

export default function StaffDashboard() {
  return (
    <div className="page-wrapper">

      {/* Page header */}
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-subtitle">
          Welcome back. Here is the current status of the municipality's reforestation efforts.
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "12px",
        marginBottom: "20px",
      }}>
        {statCards.map((card) => (
          <div key={card.label} style={{
            background: "#fff",
            border: card.urgent ? "1px solid #fecaca" : "1px solid #ede9e4",
            borderRadius: "10px",
            padding: "14px",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}>
              <span style={{ fontSize: "20px" }}>{card.icon}</span>
              {card.urgent && (
                <span style={{
                  fontSize: "10px",
                  background: "#fee2e2",
                  color: "#dc2626",
                  padding: "2px 7px",
                  borderRadius: "10px",
                  fontWeight: 500,
                }}>
                  URGENT
                </span>
              )}
            </div>
            <div style={{
              fontSize: "22px",
              fontFamily: "'DM Serif Display', serif",
              color: card.urgent ? "#dc2626" : "#1c1917",
              lineHeight: 1,
            }}>
              {card.value}
            </div>
            <div style={{
              fontSize: "11px",
              color: "#78716c",
              marginTop: "5px",
              fontWeight: 400,
            }}>
              {card.label}
            </div>
            <div style={{
              fontSize: "10px",
              color: "#c4bfba",
              marginTop: "2px",
              fontWeight: 300,
            }}>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Map + Chart Row ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
        marginBottom: "20px",
      }}>

        {/* Map placeholder */}
        <div style={{
          background: "#fff",
          border: "1px solid #ede9e4",
          borderRadius: "10px",
          overflow: "hidden",
        }}>
          <div style={{
            position: "relative",
            height: "220px",
            background: "#e8f5e9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 40%, #81c784 100%)",
              opacity: 0.5,
            }} />
            <svg
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              viewBox="0 0 400 220"
            >
              <line x1="0" y1="110" x2="400" y2="110" stroke="#fff" strokeWidth="3" opacity="0.5" />
              <line x1="200" y1="0" x2="200" y2="220" stroke="#fff" strokeWidth="2" opacity="0.4" />
              <line x1="0" y1="60" x2="400" y2="160" stroke="#fff" strokeWidth="1.5" opacity="0.3" />
              <line x1="0" y1="160" x2="300" y2="60" stroke="#fff" strokeWidth="1.5" opacity="0.3" />
              <circle cx="150" cy="100" r="9" fill="#166534" opacity="0.9" />
              <circle cx="150" cy="100" r="4" fill="#fff" />
              <circle cx="250" cy="130" r="9" fill="#dc2626" opacity="0.9" />
              <circle cx="250" cy="130" r="4" fill="#fff" />
              <circle cx="180" cy="70" r="9" fill="#166534" opacity="0.9" />
              <circle cx="180" cy="70" r="4" fill="#fff" />
              <circle cx="310" cy="90" r="9" fill="#f59e0b" opacity="0.9" />
              <circle cx="310" cy="90" r="4" fill="#fff" />
            </svg>
            <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
              <FiMapPin size={28} color="#166534" />
              <div style={{ fontSize: "11px", color: "#166534", fontWeight: 500, marginTop: "4px" }}>
                Juban, Sorsogon
              </div>
              <div style={{ fontSize: "10px", color: "#4b7a5a", fontWeight: 300 }}>
                Showing last 24hr geo-tagged activity
              </div>
            </div>
          </div>
          <div style={{
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}>
            {[
              { label: "Active", color: "#166534" },
              { label: "Pending", color: "#dc2626" },
              { label: "Maintenance", color: "#f59e0b" },
            ].map((leg) => (
              <div key={leg.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: leg.color }} />
                <span style={{ fontSize: "11px", color: "#78716c" }}>{leg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart */}
        <div style={{
          background: "#fff",
          border: "1px solid #ede9e4",
          borderRadius: "10px",
          padding: "16px",
        }}>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "#1c1917", marginBottom: "3px" }}>
            Planting Activity by Barangay
          </div>
          <div style={{ fontSize: "11px", color: "#a8a29e", fontWeight: 300, marginBottom: "16px" }}>
            Number of trees planted per barangay
          </div>
          <div style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "10px",
            height: "140px",
            padding: "0 4px",
          }}>
            {barData.map((b) => (
              <div key={b.label} style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                height: "100%",
                justifyContent: "flex-end",
              }}>
                <div style={{
                  width: "100%",
                  height: `${b.val}%`,
                  background: "#dcfce7",
                  borderRadius: "4px 4px 0 0",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "65%",
                    background: "#166534",
                    borderRadius: "4px 4px 0 0",
                    opacity: 0.8,
                  }} />
                </div>
                <span style={{ fontSize: "9px", color: "#a8a29e", textAlign: "center" }}>
                  {b.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr",
        gap: "12px",
      }}>

        {/* Verification Queue */}
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
            <div style={{ fontSize: "13px", fontWeight: 500, color: "#1c1917" }}>
              Pending Verification Queue
            </div>
            <button style={{
              fontSize: "11px",
              color: "#166534",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
            }}>
              View All Reports →
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#faf9f6" }}>
                {["Report ID", "Location / Site", "Species", "Status", "Action"].map((h) => (
                  <th key={h} style={{
                    padding: "8px 12px",
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
              {verificationQueue.map((row, i) => {
                const s = statusStyle[row.status];
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #f5f4f0" }}>
                    <td style={{
                      padding: "10px 12px",
                      fontSize: "12px",
                      color: "#1c1917",
                      fontWeight: 500,
                    }}>
                      {row.id}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <FiMapPin size={11} color="#a8a29e" />
                        <span style={{ fontSize: "12px", color: "#78716c" }}>{row.location}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "#78716c" }}>
                      {row.species}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        fontSize: "10px",
                        fontWeight: 500,
                        background: s.bg,
                        color: s.color,
                        padding: "3px 8px",
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
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button style={{
                          fontSize: "11px",
                          background: "#166534",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "4px 10px",
                          cursor: "pointer",
                          fontFamily: "'DM Sans', sans-serif",
                        }}>
                          Verify
                        </button>
                        {row.status === "DRAFT" && (
                          <button style={{
                            fontSize: "11px",
                            background: "none",
                            color: "#78716c",
                            border: "1px solid #ede9e4",
                            borderRadius: "6px",
                            padding: "4px 10px",
                            cursor: "pointer",
                            fontFamily: "'DM Sans', sans-serif",
                          }}>
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{
            padding: "10px 16px",
            background: "#faf9f6",
            borderTop: "1px solid #ede9e4",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ fontSize: "11px", color: "#a8a29e" }}>
              Showing 5 of 15 pending reports
            </span>
            <span style={{
              fontSize: "11px",
              color: "#166534",
              cursor: "pointer",
              fontWeight: 500,
            }}>
              View all →
            </span>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* Recent Activities */}
          <div style={{
            background: "#fff",
            border: "1px solid #ede9e4",
            borderRadius: "10px",
            padding: "14px 16px",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "#1c1917" }}>
                Recent Activities
              </div>
              <span style={{
                fontSize: "11px",
                color: "#166534",
                cursor: "pointer",
                fontWeight: 400,
              }}>
                View logs →
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recentActivities.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "#dcfce7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <FiCheckCircle size={13} color="#166534" />
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "#1c1917", lineHeight: 1.4 }}>
                      {a.text}
                    </div>
                    <div style={{ fontSize: "10px", color: "#a8a29e", marginTop: "2px" }}>
                      {a.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seedling Stock */}
          <div style={{
            background: "#fff",
            border: "1px solid #ede9e4",
            borderRadius: "10px",
            padding: "14px 16px",
          }}>
            <div style={{ fontSize: "13px", fontWeight: 500, color: "#1c1917", marginBottom: "12px" }}>
              Seedling Stock
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {seedlingStock.map((s) => {
                const pct = Math.round((s.current / s.total) * 100);
                return (
                  <div key={s.name}>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "5px",
                    }}>
                      <span style={{ fontSize: "12px", color: "#1c1917" }}>{s.name}</span>
                      <span style={{ fontSize: "11px", color: "#a8a29e" }}>
                        {s.current.toLocaleString()} / {s.total.toLocaleString()}
                      </span>
                    </div>
                    <div style={{
                      width: "100%",
                      height: "5px",
                      background: "#f5f4f0",
                      borderRadius: "10px",
                    }}>
                      <div style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: pct < 30 ? "#ef4444" : "#166534",
                        borderRadius: "10px",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{
              marginTop: "14px",
              paddingTop: "12px",
              borderTop: "1px solid #f5f4f0",
              display: "flex",
              justifyContent: "space-between",
            }}>
              <div>
                <div style={{
                  fontSize: "18px",
                  fontFamily: "'DM Serif Display', serif",
                  color: "#1c1917",
                }}>
                  14,200
                </div>
                <div style={{ fontSize: "10px", color: "#a8a29e" }}>Total Inventory</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontSize: "18px",
                  fontFamily: "'DM Serif Display', serif",
                  color: "#ef4444",
                }}>
                  420
                </div>
                <div style={{ fontSize: "10px", color: "#a8a29e" }}>Mortality (MoM)</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}