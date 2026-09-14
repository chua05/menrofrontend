import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiBell,
  FiDatabase,
  FiDownload,
  FiImage,
  FiRefreshCw,
  FiSave,
  FiSettings,
  FiShield,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";

import { useAuth } from "../context/AuthContext";
import "../styles/settings-page.css";

const SETTINGS_STORAGE_KEY = "menro_system_settings";

const DEFAULT_SETTINGS = {
  systemName: "MENRO Geo-Tagged Reforestation Monitoring System",
  municipality: "Juban, Sorsogon",
  systemDescription:
    "A centralized platform for monitoring reforestation efforts, seedling distribution, and environmental reporting across the Municipality of Juban, Sorsogon.",
  systemLogo: "",

  lowStockThreshold: "10",
  gpsToleranceRadius: "20",
  maxMonitoringYears: "2",
  defaultMapView: "satellite",
  defaultItemsPerPage: "10",
  dataRetentionYears: "5",

  allowDuplicateDetection: true,
  allowTimestampValidation: true,
  allowGPSValidation: true,

  emailNotifications: true,
  lowStockAlerts: true,
  systemAnnouncements: true,

  allowNewRegistrations: true,
  defaultUserRole: "participant",
};

const SAFE_CACHE_PREFIXES = [
  "menro_cache_",
  "menro_temp_",
  "menro_ui_cache_",
];

function loadStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(raw);

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function ToggleSwitch({ checked, onChange, disabled = false, label }) {
  return (
    <label
      className={`settings-toggle ${disabled ? "is-disabled" : ""}`}
      aria-label={label}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="settings-toggle-track">
        <span className="settings-toggle-thumb" />
      </span>
    </label>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
  className = "",
}) {
  return (
    <section className={`settings-card ${className}`}>
      <div className="settings-card-header">
        <div className="settings-card-icon">
          <Icon size={20} />
        </div>

        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { userRole } = useAuth();
  const fileInputRef = useRef(null);

  const [settings, setSettings] = useState(loadStoredSettings);
  const [savedSettings, setSavedSettings] = useState(loadStoredSettings);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isAdmin = userRole === "admin";
  const isStaff = userRole === "staff";
  const canEdit = isAdmin;

  const hasChanges = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings]
  );

  useEffect(() => {
    if (!successMsg && !errorMsg) return undefined;

    const timer = window.setTimeout(() => {
      setSuccessMsg("");
      setErrorMsg("");
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [successMsg, errorMsg]);

  const update = (field) => (event) => {
    if (!canEdit) return;

    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;

    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateToggle = (field) => () => {
    if (!canEdit) return;

    setSettings((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleLogoPick = () => {
    if (!canEdit) return;
    fileInputRef.current?.click();
  };

  const handleLogoChange = (event) => {
    if (!canEdit) return;

    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setErrorMsg("Please select a PNG, JPG, JPEG, or WEBP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("System logo must not exceed 2 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setSettings((prev) => ({
        ...prev,
        systemLogo: String(reader.result || ""),
      }));
      setErrorMsg("");
    };

    reader.onerror = () => {
      setErrorMsg("Unable to read the selected image.");
    };

    reader.readAsDataURL(file);
  };

  const handleSave = (event) => {
    event.preventDefault();

    if (!canEdit) {
      setErrorMsg("Only administrators can modify system settings.");
      return;
    }

    const gps = Number(settings.gpsToleranceRadius);
    const threshold = Number(settings.lowStockThreshold);
    const years = Number(settings.maxMonitoringYears);
    const retention = Number(settings.dataRetentionYears);

    if (Number.isNaN(gps) || gps < 5 || gps > 100) {
      setErrorMsg("GPS tolerance radius must be between 5 and 100 meters.");
      return;
    }

    if (Number.isNaN(threshold) || threshold < 1) {
      setErrorMsg("Low stock alert threshold must be at least 1.");
      return;
    }

    if (Number.isNaN(years) || years < 1 || years > 5) {
      setErrorMsg("Maximum monitoring period must be between 1 and 5 years.");
      return;
    }

    if (Number.isNaN(retention) || retention < 1 || retention > 10) {
      setErrorMsg("Data retention period must be between 1 and 10 years.");
      return;
    }

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    setSavedSettings(settings);
    setErrorMsg("");
    setSuccessMsg("Settings saved successfully.");
  };

  const handleResetUnsaved = () => {
    setSettings(savedSettings);
    setSuccessMsg("");
    setErrorMsg("");
  };

  const handleExport = () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      system: settings.systemName,
      municipality: settings.municipality,
      settings,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `menro-settings-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    setSuccessMsg("Settings backup exported successfully.");
  };

  const handleClearCache = () => {
    const confirmed = window.confirm(
      "Clear temporary MENRO cache data? Login information and saved records will not be removed."
    );

    if (!confirmed) return;

    const keysToRemove = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);

      if (
        key &&
        SAFE_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    sessionStorage.clear();

    setSuccessMsg(
      keysToRemove.length > 0
        ? `Temporary cache cleared (${keysToRemove.length} item${
            keysToRemove.length === 1 ? "" : "s"
          }).`
        : "Temporary cache cleared."
    );
  };

  return (
    <div className="settings-page">
      <form onSubmit={handleSave}>
        <div className="settings-page-header">
          <div className="settings-page-title">
            <div className="settings-page-title-icon">
              <FiSettings size={23} />
            </div>

            <div>
              <h1>System Settings</h1>
              <p>Configure system preferences and operational parameters.</p>
            </div>
          </div>

          {canEdit && (
            <div className="settings-header-actions">
              {hasChanges && (
                <button
                  type="button"
                  className="settings-btn settings-btn-secondary"
                  onClick={handleResetUnsaved}
                >
                  <FiRefreshCw size={15} />
                  Reset Changes
                </button>
              )}

              <button
                type="submit"
                className="settings-btn settings-btn-primary"
                disabled={!hasChanges}
              >
                <FiSave size={15} />
                Save Settings
              </button>
            </div>
          )}
        </div>

        {(successMsg || errorMsg) && (
          <div
            className={`settings-toast ${
              errorMsg ? "settings-toast-error" : "settings-toast-success"
            }`}
          >
            {errorMsg || successMsg}
          </div>
        )}

        {isStaff && (
          <div className="settings-readonly-note">
            Staff accounts can view system settings. Only administrators can
            modify and save configuration changes.
          </div>
        )}

        <div className="settings-grid">
          <SettingsSection
            icon={FiSettings}
            title="General Settings"
            description="Basic information about the system and its coverage."
          >
            <div className="settings-field-stack">
              <label className="settings-field">
                <span>System Name</span>
                <input
                  type="text"
                  value={settings.systemName}
                  onChange={update("systemName")}
                  disabled={!canEdit}
                />
              </label>

              <label className="settings-field">
                <span>Municipality</span>
                <input
                  type="text"
                  value={settings.municipality}
                  onChange={update("municipality")}
                  disabled={!canEdit}
                />
              </label>

              <label className="settings-field">
                <span>System Description</span>
                <textarea
                  rows={3}
                  value={settings.systemDescription}
                  onChange={update("systemDescription")}
                  disabled={!canEdit}
                />
              </label>

              <div className="settings-logo-field">
                <span className="settings-label">System Logo</span>

                <div className="settings-logo-row">
                  <button
                    type="button"
                    className="settings-logo-preview"
                    onClick={handleLogoPick}
                    disabled={!canEdit}
                    title={canEdit ? "Choose system logo" : "System logo"}
                  >
                    {settings.systemLogo ? (
                      <img src={settings.systemLogo} alt="System logo preview" />
                    ) : (
                      <FiImage size={28} />
                    )}
                  </button>

                  <div className="settings-logo-controls">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="settings-hidden-file"
                      onChange={handleLogoChange}
                      disabled={!canEdit}
                    />

                    <button
                      type="button"
                      className="settings-file-btn"
                      onClick={handleLogoPick}
                      disabled={!canEdit}
                    >
                      Choose File
                    </button>

                    <span>
                      {settings.systemLogo ? "Image selected" : "No file chosen"}
                    </span>

                    <small>
                      Recommended size: 200x200px. PNG, JPG, JPEG, or WEBP, up
                      to 2 MB.
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={FiDatabase}
            title="Monitoring & Data Settings"
            description="Configure monitoring intervals, thresholds, and data parameters."
          >
            <div className="settings-field-grid">
              <label className="settings-field">
                <span>Low Stock Alert Threshold (units)</span>
                <input
                  type="number"
                  min="1"
                  value={settings.lowStockThreshold}
                  onChange={update("lowStockThreshold")}
                  disabled={!canEdit}
                />
                <small>Trigger an alert when seedling stock reaches this level.</small>
              </label>

              <label className="settings-field">
                <span>Maximum Monitoring Period (years)</span>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={settings.maxMonitoringYears}
                  onChange={update("maxMonitoringYears")}
                  disabled={!canEdit}
                />
                <small>Maximum configured monitoring period for a planting site.</small>
              </label>

              <label className="settings-field">
                <span>GPS Tolerance Radius (meters)</span>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={settings.gpsToleranceRadius}
                  onChange={update("gpsToleranceRadius")}
                  disabled={!canEdit}
                />
                <small>Recommended verification tolerance: 5–20 meters.</small>
              </label>

              <label className="settings-field">
                <span>Default Map View</span>
                <select
                  value={settings.defaultMapView}
                  onChange={update("defaultMapView")}
                  disabled={!canEdit}
                >
                  <option value="roadmap">Road Map</option>
                  <option value="satellite">Satellite</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="terrain">Terrain</option>
                </select>
                <small>Default map style used when opening map views.</small>
              </label>

              <label className="settings-field">
                <span>Default Items Per Page</span>
                <select
                  value={settings.defaultItemsPerPage}
                  onChange={update("defaultItemsPerPage")}
                  disabled={!canEdit}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
                <small>Default number of records displayed in tables.</small>
              </label>

              <label className="settings-field">
                <span>Data Retention Period (years)</span>
                <select
                  value={settings.dataRetentionYears}
                  onChange={update("dataRetentionYears")}
                  disabled={!canEdit}
                >
                  <option value="1">1</option>
                  <option value="3">3</option>
                  <option value="5">5</option>
                  <option value="10">10</option>
                </select>
                <small>Administrative retention preference for archived data.</small>
              </label>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={FiShield}
            title="Verification Settings"
            description="Configure validation rules for submitted planting reports."
          >
            <div className="settings-option-list">
              <div className="settings-option-row">
                <div>
                  <strong>Enable Duplicate Image Detection</strong>
                  <span>Detect and flag reused or duplicate photo submissions.</span>
                </div>

                <ToggleSwitch
                  checked={settings.allowDuplicateDetection}
                  onChange={updateToggle("allowDuplicateDetection")}
                  disabled={!canEdit}
                  label="Enable Duplicate Image Detection"
                />
              </div>

              <div className="settings-option-row">
                <div>
                  <strong>Enable Timestamp Validation</strong>
                  <span>Validate timestamps of submitted planting reports.</span>
                </div>

                <ToggleSwitch
                  checked={settings.allowTimestampValidation}
                  onChange={updateToggle("allowTimestampValidation")}
                  disabled={!canEdit}
                  label="Enable Timestamp Validation"
                />
              </div>

              <div className="settings-option-row">
                <div>
                  <strong>Enable GPS Coordinate Validation</strong>
                  <span>Validate GPS coordinates against designated planting sites.</span>
                </div>

                <ToggleSwitch
                  checked={settings.allowGPSValidation}
                  onChange={updateToggle("allowGPSValidation")}
                  disabled={!canEdit}
                  label="Enable GPS Coordinate Validation"
                />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={FiBell}
            title="Notification Settings"
            description="Manage system notifications and alerts."
          >
            <div className="settings-option-list">
              <div className="settings-option-row">
                <div>
                  <strong>Email Notifications</strong>
                  <span>Send email alerts for approvals, rejections, and updates.</span>
                </div>

                <ToggleSwitch
                  checked={settings.emailNotifications}
                  onChange={updateToggle("emailNotifications")}
                  disabled={!canEdit}
                  label="Email Notifications"
                />
              </div>

              <div className="settings-option-row">
                <div>
                  <strong>Low Stock Alerts</strong>
                  <span>Notify authorized users when seedling stock is low.</span>
                </div>

                <ToggleSwitch
                  checked={settings.lowStockAlerts}
                  onChange={updateToggle("lowStockAlerts")}
                  disabled={!canEdit}
                  label="Low Stock Alerts"
                />
              </div>

              <div className="settings-option-row">
                <div>
                  <strong>System Announcements</strong>
                  <span>Allow important system announcements to be shown to users.</span>
                </div>

                <ToggleSwitch
                  checked={settings.systemAnnouncements}
                  onChange={updateToggle("systemAnnouncements")}
                  disabled={!canEdit}
                  label="System Announcements"
                />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={FiUsers}
            title="Account & Access Settings"
            description="Manage registration and default account access rules."
          >
            <div className="settings-access-grid">
              <div className="settings-option-row settings-option-row-compact">
                <div>
                  <strong>Allow New Registrations</strong>
                  <span>Allow public users to create participant accounts.</span>
                </div>

                <ToggleSwitch
                  checked={settings.allowNewRegistrations}
                  onChange={updateToggle("allowNewRegistrations")}
                  disabled={!canEdit}
                  label="Allow New Registrations"
                />
              </div>

              <label className="settings-field">
                <span>Default User Role</span>
                <select
                  value={settings.defaultUserRole}
                  onChange={update("defaultUserRole")}
                  disabled={!canEdit}
                >
                  <option value="participant">Participant</option>
                </select>
                <small>
                  New public registrations are assigned as Participant accounts.
                </small>
              </label>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={FiDatabase}
            title="System Maintenance"
            description="Tools for system maintenance and settings backup."
          >
            <div className="settings-maintenance-grid">
              <div className="settings-maintenance-item">
                <div>
                  <strong>Backup Settings</strong>
                  <span>Export the current system configuration as a JSON file.</span>
                </div>

                <button
                  type="button"
                  className="settings-btn settings-btn-outline-green"
                  onClick={handleExport}
                >
                  <FiDownload size={15} />
                  Export Data
                </button>
              </div>

              <div className="settings-maintenance-item">
                <div>
                  <strong>Clear Cache</strong>
                  <span>Remove temporary UI data without deleting saved records.</span>
                </div>

                <button
                  type="button"
                  className="settings-btn settings-btn-danger"
                  onClick={handleClearCache}
                >
                  <FiTrash2 size={15} />
                  Clear Cache
                </button>
              </div>
            </div>
          </SettingsSection>
        </div>
      </form>
    </div>
  );
}
