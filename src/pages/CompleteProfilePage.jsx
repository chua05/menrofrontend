import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { JUBAN_BARANGAYS, USER_TYPES, userTypeField } from "../utils/userTypes";
import menroLogo from "../assets/menro-logo.png";
import "../styles/register.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function CompleteProfilePage() {
  const { currentUser, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: currentUser?.username || "",
    contactNumber: currentUser?.contactNumber || "",
    userType: currentUser?.userType || "",
    userTypeDetail: currentUser?.userTypeDetail || "",
    barangay: currentUser?.barangay || "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.profileComplete !== false) return <Navigate to="/participant/dashboard" replace />;

  const conditional = userTypeField(form.userType);
  const update = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
      ...(field === "userType" ? { userTypeDetail: "", barangay: "" } : {}),
    }));
    setErrors((previous) => ({ ...previous, [field]: "", general: "" }));
  };

  async function submit(event) {
    event.preventDefault();
    const next = {};
    if (!form.username.trim()) next.username = "Required";
    if (!/^09\d{9}$/.test(form.contactNumber.trim())) next.contactNumber = "Enter a valid mobile number";
    if (!form.userType) next.userType = "Please select your user type.";
    if (conditional?.kind === "barangay" && !form.barangay) next.barangay = conditional.error;
    if (conditional?.kind === "detail" && !form.userTypeDetail.trim()) next.userTypeDetail = conditional.error;
    if (Object.keys(next).length) { setErrors(next); return; }

    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username.trim(),
          contactNumber: form.contactNumber.trim(),
          userType: form.userType,
          userTypeDetail: form.userTypeDetail.trim(),
          barangay: form.barangay,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to complete your profile.");
      const profile = payload.data;
      login(profile, profile.role, token);
      navigate("/participant/dashboard", { replace: true });
    } catch (error) {
      setErrors({ general: error.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="register-page">
      <main className="register-shell">
        <div className="register-brand">
          <img src={menroLogo} alt="MENRO Juban logo" className="register-brand-logo" />
          <div className="register-brand-copy"><strong>MENRO</strong><span>ENVIRONMENT OFFICE · JUBAN</span></div>
        </div>
        <section className="register-card">
          <div className="register-heading"><h1>Complete your <em>profile.</em></h1><p>Tell MENRO how you participate in local environmental activities.</p></div>
          <div className="register-divider" />
          {errors.general && <div className="register-general-error">{errors.general}</div>}
          <form className="register-form" onSubmit={submit}>
            <div className="register-form-grid">
              <label className="register-field"><span className="register-label">Username *</span><input className="register-input register-input-no-icon" value={form.username} onChange={(e) => update("username", e.target.value)} />{errors.username && <p className="register-field-error">{errors.username}</p>}</label>
              <label className="register-field"><span className="register-label">Contact Number *</span><input className="register-input register-input-no-icon" inputMode="numeric" maxLength={11} value={form.contactNumber} onChange={(e) => update("contactNumber", e.target.value)} />{errors.contactNumber && <p className="register-field-error">{errors.contactNumber}</p>}</label>
              <label className="register-field register-full-width"><span className="register-label">User Type *</span><select className="register-input register-input-no-icon" value={form.userType} onChange={(e) => update("userType", e.target.value)}><option value="">Select user type</option>{USER_TYPES.map((type) => <option key={type}>{type}</option>)}</select>{errors.userType && <p className="register-field-error">{errors.userType}</p>}</label>
              {conditional?.kind === "barangay" && <label className="register-field register-full-width"><span className="register-label">{conditional.label}</span><select className="register-input register-input-no-icon" value={form.barangay} onChange={(e) => update("barangay", e.target.value)}><option value="">Select barangay</option>{JUBAN_BARANGAYS.map((barangay) => <option key={barangay}>{barangay}</option>)}</select>{errors.barangay && <p className="register-field-error">{errors.barangay}</p>}</label>}
              {conditional?.kind === "detail" && <label className="register-field register-full-width"><span className="register-label">{conditional.label}</span><input className="register-input register-input-no-icon" value={form.userTypeDetail} onChange={(e) => update("userTypeDetail", e.target.value)} />{errors.userTypeDetail && <p className="register-field-error">{errors.userTypeDetail}</p>}</label>}
            </div>
            <button className="register-primary-btn" type="submit" disabled={loading}>{loading ? "Saving profile..." : "Save and Continue →"}</button>
          </form>
        </section>
      </main>
    </div>
  );
}
