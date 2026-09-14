import { useMemo, useRef, useState } from "react";
import {
  FiCamera,
  FiCheckCircle,
  FiCopy,
  FiEdit2,
  FiFileText,
  FiHome,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSave,
  FiTrash2,
  FiUser,
} from "react-icons/fi";

import { useAuth } from "../context/AuthContext";

const BARANGAYS = [
  "Añog",
  "Aroroy",
  "Bacolod",
  "Binanuahan",
  "Biriran",
  "Buraburan",
  "Calateo",
  "Calmayon",
  "Caruhayon",
  "Catanagan",
  "Catanusan",
  "Cogon",
  "Embarcadero",
  "Guruyan",
  "Lajong",
  "Maalo",
  "North Poblacion",
  "South Poblacion",
  "Puting Sapa",
  "Rangas",
  "Sablayan",
  "Sipaya",
  "Taboc",
  "Tinago",
  "Tughan",
];

function getInitialForm(currentUser) {
  return {
    fullName:
      currentUser?.fullName ||
      currentUser?.displayName ||
      currentUser?.name ||
      "",
    email: currentUser?.email || "",
    contact:
      currentUser?.contactNumber ||
      currentUser?.contact ||
      currentUser?.phoneNumber ||
      currentUser?.phone ||
      "",
    barangay: currentUser?.barangay || "",
    address: currentUser?.address || "",
    bio: currentUser?.bio || "",
    photoURL:
      currentUser?.photoURL ||
      currentUser?.photoUrl ||
      currentUser?.picture ||
      "",
  };
}

function formatAccountDate(value) {
  if (!value) return "—";

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ForestBanner() {
  return (
    <svg
      viewBox="0 0 1200 180"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        display: "block",
        width: "100%",
        height: "118px",
      }}
    >
      <defs>
        <linearGradient
          id="profileSky"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor="#eef9f2" />
          <stop offset="100%" stopColor="#dff3e6" />
        </linearGradient>

        <linearGradient
          id="profileHillBack"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >
          <stop offset="0%" stopColor="#d7eedf" />
          <stop offset="100%" stopColor="#c7e7d2" />
        </linearGradient>

        <linearGradient
          id="profileHillFront"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >
          <stop offset="0%" stopColor="#b8dfc5" />
          <stop offset="100%" stopColor="#9fd3b1" />
        </linearGradient>
      </defs>

      <rect
        width="1200"
        height="180"
        fill="url(#profileSky)"
      />

      <circle
        cx="170"
        cy="40"
        r="48"
        fill="#ffffff"
        opacity="0.34"
      />
      <circle
        cx="225"
        cy="32"
        r="34"
        fill="#ffffff"
        opacity="0.32"
      />
      <circle
        cx="820"
        cy="38"
        r="46"
        fill="#ffffff"
        opacity="0.25"
      />

      <path
        d="M0 125 L150 68 L265 104 L420 52 L560 102 L720 54 L870 108 L1035 58 L1200 105 L1200 180 L0 180 Z"
        fill="url(#profileHillBack)"
      />

      <path
        d="M0 145 L115 98 L255 133 L380 87 L510 132 L650 92 L790 138 L925 88 L1070 136 L1200 100 L1200 180 L0 180 Z"
        fill="url(#profileHillFront)"
        opacity="0.92"
      />

      {[
        [60, 106, 18],
        [115, 94, 24],
        [172, 111, 17],
        [235, 88, 27],
        [305, 107, 21],
        [372, 82, 28],
        [438, 107, 20],
        [506, 91, 25],
        [585, 108, 19],
        [660, 80, 29],
        [735, 106, 22],
        [812, 88, 26],
        [885, 110, 18],
        [952, 83, 29],
        [1027, 106, 21],
        [1105, 86, 28],
        [1162, 105, 19],
      ].map(([x, y, r], index) => (
        <g key={`${x}-${y}-${index}`}>
          <rect
            x={x - 2}
            y={y + r * 0.55}
            width="4"
            height={32}
            rx="2"
            fill="#6da981"
            opacity="0.8"
          />
          <circle
            cx={x}
            cy={y}
            r={r}
            fill={
              index % 3 === 0
                ? "#66b07d"
                : index % 3 === 1
                ? "#75bd88"
                : "#5ba473"
            }
            opacity="0.9"
          />
          <circle
            cx={x - r * 0.48}
            cy={y + r * 0.15}
            r={r * 0.68}
            fill="#7cc590"
            opacity="0.82"
          />
          <circle
            cx={x + r * 0.5}
            cy={y + r * 0.12}
            r={r * 0.64}
            fill="#4f9a68"
            opacity="0.76"
          />
        </g>
      ))}

      <path
        d="M0 160 C150 138 245 154 355 145 C475 135 590 157 720 145 C845 133 975 157 1200 139 L1200 180 L0 180 Z"
        fill="#8bc79f"
        opacity="0.68"
      />
    </svg>
  );
}

export default function ProfilePage() {
  const { currentUser, userRole } = useAuth();

  const photoInputRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [form, setForm] = useState(() =>
    getInitialForm(currentUser)
  );

  const initials = useMemo(() => {
    const source =
      form.fullName ||
      currentUser?.email ||
      "Participant";

    return source
      .split(" ")
      .filter(Boolean)
      .map((name) => name[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [form.fullName, currentUser?.email]);

  const roleLabel =
    userRole === "admin"
      ? "Administrator"
      : userRole === "staff"
      ? "Office Member"
      : "Participant";

  const userId =
    currentUser?.uid ||
    currentUser?.id ||
    currentUser?.userId ||
    "—";

  const accountStatus =
    currentUser?.status || "active";

  const memberSince =
    currentUser?.createdAt ||
    currentUser?.memberSince ||
    "";

  const lastUpdated =
    currentUser?.updatedAt ||
    currentUser?.lastUpdated ||
    "";

  const update = (field) => (event) => {
    const value = event.target.value;

    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setPhotoError("");
  };

  const handleCancelEdit = () => {
    setForm(getInitialForm(currentUser));
    setIsEditing(false);
    setPhotoError("");

    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const handleProfilePhotoClick = () => {
    setPhotoMenuOpen((previous) => !previous);
    setPhotoError("");
  };

  const handleAddProfilePhoto = () => {
    setIsEditing(true);
    setPhotoMenuOpen(false);
    setPhotoError("");
    photoInputRef.current?.click();
  };

  const handleProfilePhotoChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setPhotoError(
        "Please select a JPG, PNG, or WEBP image."
      );
      event.target.value = "";
      return;
    }

    const maxPhotoSize = 2 * 1024 * 1024;

    if (file.size > maxPhotoSize) {
      setPhotoError(
        "Profile photo must be 2 MB or smaller."
      );
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setForm((previous) => ({
        ...previous,
        photoURL: String(reader.result || ""),
      }));
      setPhotoError("");
    };

    reader.onerror = () => {
      setPhotoError(
        "Unable to read the selected image. Please try another file."
      );
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveProfilePhoto = () => {
    setForm((previous) => ({
      ...previous,
      photoURL: "",
    }));
    setIsEditing(true);
    setPhotoMenuOpen(false);
    setPhotoError("");

    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const handleSave = (event) => {
    event.preventDefault();

    const savedUser = {
      ...(currentUser || {}),
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      contactNumber: form.contact.trim(),
      barangay: form.barangay,
      address: form.address.trim(),
      bio: form.bio.trim(),
      photoURL: form.photoURL || "",
      role:
        userRole ||
        currentUser?.role ||
        "participant",
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(
      "user",
      JSON.stringify(savedUser)
    );

    setIsEditing(false);
    setPhotoError("");

    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }

    setSuccessMsg(
      "You successfully updated your profile."
    );

    window.setTimeout(() => {
      setSuccessMsg("");
    }, 3000);
  };

  const copyUserId = async () => {
    if (!userId || userId === "—") return;

    try {
      await navigator.clipboard.writeText(
        String(userId)
      );

      setSuccessMsg("User ID copied.");

      window.setTimeout(() => {
        setSuccessMsg("");
      }, 2000);
    } catch {
      // Clipboard access may be blocked by the browser.
    }
  };

  return (
    <div
      style={{
        minHeight: "100%",
        padding: "48px 40px 42px",
        background: "#f8faf9",
        color: "#1f2937",
      }}
    >
      {successMsg && (
        <div
          style={{
            position: "fixed",
            top: "84px",
            right: "24px",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: "280px",
            maxWidth: "390px",
            padding: "12px 14px",
            borderRadius: "10px",
            background: "#17643a",
            color: "#ffffff",
            fontSize: "12.5px",
            fontWeight: 600,
            boxShadow:
              "0 12px 35px rgba(0,0,0,0.18)",
          }}
        >
          <FiCheckCircle size={17} />
          <span>{successMsg}</span>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 2fr) minmax(300px, 0.95fr)",
          gap: "20px",
          alignItems: "start",
        }}
        className="profile-page-main-grid"
      >
        <div>
          {/* PROFILE CARD */}
          <section
            style={{
              overflow: "hidden",
              background: "#ffffff",
              border: "1px solid #e1e8e3",
              borderRadius: "16px",
              boxShadow:
                "0 1px 3px rgba(15, 23, 42, 0.025)",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                height: "118px",
                position: "relative",
                overflow: "hidden",
                background: "#eaf7ef",
              }}
            >
              <ForestBanner />
            </div>

            <div
              style={{
                position: "relative",
                padding: "0 28px 25px 260px",
                minHeight: "220px",
              }}
              className="profile-card-body"
            >
              <div
                style={{
                  position: "absolute",
                  left: "34px",
                  top: "-56px",
                  width: "156px",
                  height: "156px",
                }}
                className="profile-avatar-wrap"
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background:
                      "linear-gradient(145deg, #0c6d3d, #15944d)",
                    border: "6px solid #ffffff",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "44px",
                    fontWeight: 750,
                    boxShadow:
                      "0 7px 20px rgba(10, 81, 45, 0.14)",
                    overflow: "hidden",
                  }}
                >
                  {form.photoURL ? (
                    <img
                      src={form.photoURL}
                      alt={`${form.fullName || "Participant"} profile`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : (
                    initials
                  )}
                </div>

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleProfilePhotoChange}
                  style={{ display: "none" }}
                />

                <button
                  type="button"
                  title="Change profile photo"
                  aria-label="Change profile photo"
                  onClick={handleProfilePhotoClick}
                  style={{
                    position: "absolute",
                    right: "-4px",
                    bottom: "4px",
                    width: "46px",
                    height: "46px",
                    borderRadius: "50%",
                    border: "5px solid #ffffff",
                    background: "#ffffff",
                    color: "#243a31",
                    display: "grid",
                    placeItems: "center",
                    boxShadow:
                      "0 4px 14px rgba(15, 23, 42, 0.12)",
                    cursor: "pointer",
                  }}
                >
                  <FiCamera size={18} />
                </button>

                {photoMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: "-10px",
                      bottom: "-92px",
                      zIndex: 20,
                      width: "178px",
                      padding: "6px",
                      border: "1px solid #dfe6e1",
                      borderRadius: "10px",
                      background: "#ffffff",
                      boxShadow: "0 12px 28px rgba(15, 23, 42, 0.14)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleAddProfilePhoto}
                      style={{
                        width: "100%",
                        minHeight: "36px",
                        padding: "0 10px",
                        border: "none",
                        borderRadius: "7px",
                        background: "transparent",
                        color: "#37443c",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12px",
                        fontWeight: 650,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <FiCamera size={14} />
                      Add Profile Picture
                    </button>

                    {form.photoURL && (
                      <button
                        type="button"
                        onClick={handleRemoveProfilePhoto}
                        style={{
                          width: "100%",
                          minHeight: "36px",
                          padding: "0 10px",
                          border: "none",
                          borderRadius: "7px",
                          background: "transparent",
                          color: "#b91c1c",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "12px",
                          fontWeight: 650,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <FiTrash2 size={14} />
                        Remove Profile Picture
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "18px",
                  paddingTop: "23px",
                }}
                className="profile-main-info-row"
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <h1
                      style={{
                        margin: 0,
                        fontSize: "24px",
                        lineHeight: 1.2,
                        color: "#17211b",
                        fontWeight: 750,
                      }}
                    >
                      {form.fullName || "Participant"}
                    </h1>

                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background:
                          userRole === "admin"
                            ? "#ede9fe"
                            : userRole === "staff"
                            ? "#dbeafe"
                            : "#dcfce7",
                        color:
                          userRole === "admin"
                            ? "#6d28d9"
                            : userRole === "staff"
                            ? "#1e40af"
                            : "#166534",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {roleLabel}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: "15px",
                      display: "grid",
                      gap: "9px",
                      color: "#49564f",
                      fontSize: "13px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <FiMail size={15} />
                      <span>
                        {form.email || "—"}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <FiPhone size={15} />
                      <span>
                        {form.contact || "—"}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <FiMapPin size={15} />
                      <span>
                        {form.barangay
                          ? `${form.barangay}, Juban, Sorsogon`
                          : "Juban, Sorsogon"}
                      </span>
                    </div>
                  </div>

                  {form.bio && (
                    <div
                      style={{
                        marginTop: "14px",
                        color: "#6c7a72",
                        fontSize: "12.5px",
                        fontStyle: "italic",
                        lineHeight: 1.5,
                      }}
                    >
                      “{form.bio}”
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleStartEdit}
                  style={{
                    minHeight: "40px",
                    padding: "0 15px",
                    border:
                      "1px solid #dce9e0",
                    borderRadius: "9px",
                    background: "#eef9f2",
                    color: "#17643a",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "7px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <FiEdit2 size={15} />
                  Edit Profile
                </button>
              </div>
            </div>
          </section>

          {photoError && (
            <div
              style={{
                marginTop: "-8px",
                marginBottom: "14px",
                padding: "10px 12px",
                border: "1px solid #fecaca",
                borderRadius: "9px",
                background: "#fef2f2",
                color: "#991b1b",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {photoError}
            </div>
          )}

          {/* PERSONAL INFORMATION */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e1e8e3",
              borderRadius: "16px",
              padding: "24px",
              boxShadow:
                "0 1px 3px rgba(15, 23, 42, 0.025)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "11px",
                marginBottom: "22px",
              }}
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "11px",
                  background: "#eaf7ef",
                  color: "#17643a",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <FiUser size={18} />
              </div>

              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    color: "#1d2822",
                    fontWeight: 750,
                  }}
                >
                  Personal Information
                </h2>

                {isEditing && (
                  <p
                    style={{
                      margin: "3px 0 0",
                      color: "#7a847e",
                      fontSize: "12px",
                    }}
                  >
                    Update your personal information below.
                  </p>
                )}
              </div>
            </div>

            <form onSubmit={handleSave}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "17px 20px",
                }}
                className="profile-form-grid"
              >
                <ProfileField
                  label="Full Name"
                  icon={<FiUser size={15} />}
                >
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={update("fullName")}
                    disabled={!isEditing}
                    style={fieldStyle(isEditing)}
                  />
                </ProfileField>

                <ProfileField
                  label="Barangay"
                  icon={<FiMapPin size={15} />}
                >
                  <select
                    value={form.barangay}
                    onChange={update("barangay")}
                    disabled={!isEditing}
                    style={fieldStyle(
                      isEditing,
                      "select"
                    )}
                  >
                    <option value="">
                      Select barangay
                    </option>

                    {BARANGAYS.map((barangay) => (
                      <option
                        key={barangay}
                        value={barangay}
                      >
                        {barangay}
                      </option>
                    ))}
                  </select>
                </ProfileField>

                <ProfileField
                  label="Email Address"
                  icon={<FiMail size={15} />}
                >
                  <input
                    type="email"
                    value={form.email}
                    disabled
                    style={fieldStyle(false)}
                  />
                </ProfileField>

                <ProfileField
                  label="Address (Optional)"
                  icon={<FiHome size={15} />}
                >
                  <input
                    type="text"
                    value={form.address}
                    onChange={update("address")}
                    disabled={!isEditing}
                    placeholder={
                      isEditing
                        ? "Enter your address"
                        : ""
                    }
                    style={fieldStyle(isEditing)}
                  />
                </ProfileField>

                <ProfileField
                  label="Contact Number"
                  icon={<FiPhone size={15} />}
                >
                  <input
                    type="text"
                    value={form.contact}
                    onChange={(event) => {
                      const value =
                        event.target.value.replace(
                          /\D/g,
                          ""
                        );

                      setForm((previous) => ({
                        ...previous,
                        contact: value.slice(0, 11),
                      }));
                    }}
                    disabled={!isEditing}
                    inputMode="numeric"
                    maxLength={11}
                    placeholder={
                      isEditing
                        ? "09XXXXXXXXX"
                        : ""
                    }
                    style={fieldStyle(isEditing)}
                  />
                </ProfileField>

                <ProfileField
                  label="Bio (Optional)"
                  icon={<FiFileText size={15} />}
                >
                  <div
                    style={{
                      position: "relative",
                    }}
                  >
                    <textarea
                      value={form.bio}
                      onChange={(event) => {
                        setForm((previous) => ({
                          ...previous,
                          bio: event.target.value.slice(
                            0,
                            200
                          ),
                        }));
                      }}
                      disabled={!isEditing}
                      placeholder={
                        isEditing
                          ? "Tell us a bit about yourself..."
                          : ""
                      }
                      style={{
                        ...fieldStyle(isEditing),
                        height: "78px",
                        minHeight: "78px",
                        paddingTop: "10px",
                        paddingBottom: "22px",
                        resize: isEditing
                          ? "vertical"
                          : "none",
                      }}
                    />

                    {isEditing && (
                      <span
                        style={{
                          position: "absolute",
                          right: "10px",
                          bottom: "8px",
                          color: "#8d9891",
                          fontSize: "10.5px",
                        }}
                      >
                        {form.bio.length}/200
                      </span>
                    )}
                  </div>
                </ProfileField>
              </div>

              {isEditing && (
                <div
                  style={{
                    marginTop: "22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "10px",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    style={{
                      minHeight: "40px",
                      padding: "0 16px",
                      border:
                        "1px solid #dfe5e1",
                      borderRadius: "9px",
                      background: "#ffffff",
                      color: "#374151",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    style={{
                      minHeight: "40px",
                      padding: "0 17px",
                      border: "none",
                      borderRadius: "9px",
                      background: "#17643a",
                      color: "#ffffff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "7px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow:
                        "0 2px 6px rgba(23, 100, 58, 0.16)",
                    }}
                  >
                    <FiSave size={15} />
                    Save Changes
                  </button>
                </div>
              )}
            </form>
          </section>
        </div>

        {/* ACCOUNT DETAILS */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e1e8e3",
            borderRadius: "16px",
            padding: "22px",
            boxShadow:
              "0 1px 3px rgba(15, 23, 42, 0.025)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "11px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "11px",
                background: "#eaf7ef",
                color: "#17643a",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <FiFileText size={18} />
            </div>

            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "16px",
                  color: "#1d2822",
                  fontWeight: 750,
                }}
              >
                Account Details
              </h2>
            </div>
          </div>

          <AccountRow
            label="User ID"
            value={String(userId)}
            action={
              userId !== "—" ? (
                <button
                  type="button"
                  onClick={copyUserId}
                  title="Copy User ID"
                  aria-label="Copy User ID"
                  style={{
                    width: "30px",
                    height: "30px",
                    border: "none",
                    background: "transparent",
                    color: "#7a857f",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <FiCopy size={15} />
                </button>
              ) : null
            }
          />

          <AccountRow
            label="Role"
            value={roleLabel}
          />

          <AccountRow
            label="Status"
            value={
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  textTransform: "capitalize",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background:
                      accountStatus === "active"
                        ? "#16a34a"
                        : "#9ca3af",
                  }}
                />
                {accountStatus}
              </span>
            }
          />

          <AccountRow
            label="Member Since"
            value={formatAccountDate(memberSince)}
          />

          <AccountRow
            label="Last Updated"
            value={formatAccountDate(lastUpdated)}
            isLast
          />
        </section>
      </div>

      <style>{`
        @media (max-width: 1050px) {
          .profile-page-main-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 760px) {
          .profile-card-body {
            padding: 72px 20px 22px !important;
            min-height: auto !important;
          }

          .profile-avatar-wrap {
            left: 20px !important;
            width: 118px !important;
            height: 118px !important;
          }

          .profile-main-info-row {
            flex-direction: column !important;
          }

          .profile-form-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function ProfileField({
  label,
  icon,
  children,
}) {
  return (
    <label>
      <span
        style={{
          display: "block",
          marginBottom: "6px",
          color: "#37443c",
          fontSize: "12.5px",
          fontWeight: 650,
        }}
      >
        {label}
      </span>

      <div
        style={{
          position: "relative",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: "12px",
            top: "12px",
            zIndex: 1,
            color: "#92a099",
            pointerEvents: "none",
          }}
        >
          {icon}
        </span>

        {children}
      </div>
    </label>
  );
}

function AccountRow({
  label,
  value,
  action = null,
  isLast = false,
}) {
  return (
    <div
      style={{
        minHeight: "44px",
        display: "grid",
        gridTemplateColumns:
          "minmax(90px, 0.9fr) minmax(0, 1.2fr) auto",
        alignItems: "center",
        gap: "10px",
        padding: "0 12px",
        borderRadius: "7px",
        background: isLast
          ? "#f8faf9"
          : "#f7f9f8",
        marginBottom: isLast ? 0 : "6px",
      }}
    >
      <span
        style={{
          color: "#45534b",
          fontSize: "12.5px",
          fontWeight: 650,
        }}
      >
        {label}
      </span>

      <span
        style={{
          color: "#2f3c34",
          fontSize: "12.5px",
          fontWeight: 500,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value || "—"}
      </span>

      {action}
    </div>
  );
}

function fieldStyle(isEditing, type = "input") {
  return {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "42px",
    border: isEditing
      ? "1px solid #cad8cf"
      : "1px solid #e0e6e2",
    borderRadius: "8px",
    padding:
      type === "select"
        ? "0 34px 0 36px"
        : "0 11px 0 36px",
    outline: "none",
    background: isEditing
      ? "#ffffff"
      : "#f9fbfa",
    color: "#37443c",
    fontSize: "13px",
    fontFamily: "inherit",
    cursor: isEditing
      ? type === "select"
        ? "pointer"
        : "text"
      : "default",
  };
}
