import { useState } from "react";
import { Info, Minus, Plus, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { plantingSites } from "../../data/dashboardMockData";

const sitePositions = {
  "BAC-001": { x: 90, y: 82 },
  "BAC-002": { x: 175, y: 110 },
  "SJO-001": { x: 325, y: 128 },
  "SJO-002": { x: 402, y: 92 },
  "SJO-003": { x: 338, y: 178 },
  "HIL-001": { x: 530, y: 82 },
  "POB-001": { x: 455, y: 215 },
  "POB-002": { x: 520, y: 205 },
  "SGD-001": { x: 280, y: 305 },
  "CAN-001": { x: 450, y: 330 },
  "CAN-002": { x: 535, y: 330 },
};

function getUtilizationColor(status) {
  if (status === "Available") {
    return { fill: "#dff4df", stroke: "#5da96d" };
  }

  if (status === "Partially Occupied") {
    return { fill: "#fff1c2", stroke: "#e7aa27" };
  }

  return { fill: "#ffe0da", stroke: "#e45742" };
}

function getConditionColor(condition) {
  if (condition === "Healthy") return "#16813d";
  if (condition === "Needs Attention") return "#f0aa12";
  if (condition === "Critical") return "#ea3b27";
  return "#2563eb";
}

export default function PlantingSitesMap() {
  const navigate = useNavigate();
  const [selectedSite, setSelectedSite] = useState(null);
  const [zoom, setZoom] = useState(1);

  return (
    <section className="dash-card map-card">
      <div className="dash-card-header">
        <div className="dash-card-title-row">
          <h2>Planting Sites Map</h2>
          <Info size={15} strokeWidth={1.8} />
        </div>
      </div>

      <div className="map-canvas">
        <div
          className="map-svg-wrapper"
          style={{ transform: `scale(${zoom})` }}
        >
          <svg
            className="site-map-svg"
            viewBox="0 0 620 390"
            role="img"
            aria-label="Planting sites map"
          >
            <rect width="620" height="390" fill="#eef3e9" />

            <path
              d="M25,25 L235,20 L250,150 L190,190 L40,160 Z"
              className="barangay-boundary"
            />
            <path
              d="M245,20 L460,25 L470,175 L285,205 L250,150 Z"
              className="barangay-boundary"
            />
            <path
              d="M465,25 L610,35 L595,190 L470,175 Z"
              className="barangay-boundary"
            />
            <path
              d="M40,165 L190,190 L280,260 L220,375 L35,360 Z"
              className="barangay-boundary"
            />
            <path
              d="M285,205 L470,175 L600,190 L600,380 L220,375 L280,260 Z"
              className="barangay-boundary"
            />

            <text x="105" y="40" className="barangay-name">
              Bacolod
            </text>
            <text x="335" y="42" className="barangay-name">
              San Jose
            </text>
            <text x="520" y="45" className="barangay-name">
              Hillside
            </text>
            <text x="455" y="190" className="barangay-name">
              Poblacion
            </text>
            <text x="250" y="285" className="barangay-name">
              Sagrada
            </text>
            <text x="490" y="295" className="barangay-name">
              Canaway
            </text>

            {plantingSites.map((site) => {
              const position = sitePositions[site.id];
              if (!position) return null;

              const utilization = getUtilizationColor(
                site.utilizationStatus
              );

              const conditionColor = getConditionColor(
                site.condition
              );

              const selected = selectedSite?.id === site.id;

              return (
                <g
                  key={site.id}
                  className="map-site-group"
                  onClick={() => setSelectedSite(site)}
                >
                  <ellipse
                    cx={position.x}
                    cy={position.y + 10}
                    rx={selected ? 35 : 30}
                    ry={selected ? 22 : 19}
                    fill={utilization.fill}
                    stroke={utilization.stroke}
                    strokeWidth={selected ? 2.5 : 1.3}
                  />

                  <rect
                    x={position.x - 26}
                    y={position.y - 22}
                    width="52"
                    height="20"
                    rx="5"
                    fill="#fff"
                    stroke="#d9e2dc"
                  />

                  <text
                    x={position.x}
                    y={position.y - 8}
                    textAnchor="middle"
                    className="site-id-label"
                  >
                    {site.id}
                  </text>

                  <circle
                    cx={position.x}
                    cy={position.y + 10}
                    r="6"
                    fill={conditionColor}
                    stroke="#fff"
                    strokeWidth="2"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="map-legend">
          <div className="map-legend-group">
            <strong>SITE UTILIZATION</strong>

            <div>
              <span className="legend-box available" />
              Available (0% - 49%)
            </div>
            <div>
              <span className="legend-box partial" />
              Partially Occupied (50% - 89%)
            </div>
            <div>
              <span className="legend-box full" />
              Full (90% - 100%)
            </div>
          </div>

          <div className="map-legend-divider" />

          <div className="map-legend-group">
            <strong>TREE / SEEDLING CONDITION</strong>

            <div>
              <span className="legend-dot healthy" />
              Healthy
            </div>
            <div>
              <span className="legend-dot attention" />
              Needs Attention
            </div>
            <div>
              <span className="legend-dot critical" />
              Critical
            </div>
            <div>
              <span className="legend-dot unmonitored" />
              Not Yet Monitored
            </div>
          </div>
        </div>

        <div className="map-controls">
          <button
            type="button"
            onClick={() =>
              setZoom((z) => Math.min(z + 0.08, 1.25))
            }
          >
            <Plus size={17} />
          </button>

          <button
            type="button"
            onClick={() =>
              setZoom((z) => Math.max(z - 0.08, 0.88))
            }
          >
            <Minus size={17} />
          </button>

          <button type="button">
            <Settings2 size={16} />
          </button>
        </div>

        {selectedSite && (
          <div className="map-site-popup">
            <button
              type="button"
              className="map-popup-close"
              onClick={() => setSelectedSite(null)}
            >
              ×
            </button>

            <strong>{selectedSite.id}</strong>
            <span>{selectedSite.barangay}</span>

            <div>
              Utilization: <b>{selectedSite.utilization}%</b>
            </div>

            <div>
              Condition: <b>{selectedSite.condition}</b>
            </div>

            <button
              type="button"
              className="map-popup-link"
              onClick={() => navigate("/admin/planting-sites")}
            >
              View site details
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="dash-card-footer-link"
        onClick={() => navigate("/admin/map-visualization")}
      >
        View all sites on map <span>›</span>
      </button>
    </section>
  );
}