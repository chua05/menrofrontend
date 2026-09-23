import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import axios from "axios";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { JUBAN_BARANGAYS, USER_TYPES, userTypeField } from "../utils/userTypes";

import menroLogo from "../assets/menro-logo.png";
import "../styles/register.css";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");
const localApiUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(
  configuredApiUrl || "",
);
const API_BASE_URL =
  import.meta.env.PROD && (!configuredApiUrl || localApiUrl)
    ? "https://menrobk-1.onrender.com/api"
    : configuredApiUrl || "http://localhost:5000/api";

const Field = ({ label, error, children }) => (
  <div className="register-field">
    <div className="register-label">{label}</div>

    {children}

    {error && <p className="register-field-error">{error}</p>}
  </div>
);

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    contactNumber: "",
    userType: "",
    userTypeDetail: "",
    barangay: "",
    password: "",
    confirmPassword: "",
  });

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const update = (field) => (e) =>
    setForm((prev) => ({
      ...prev,
      [field]: e.target.value,
      ...(field === "userType" ? { userTypeDetail: "", barangay: "" } : {}),
    }));

  const updateContactNumber = (event) => {
    const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 11);

    setForm((previous) => ({
      ...previous,
      contactNumber: digitsOnly,
    }));

    if (errors.contactNumber) {
      setErrors((previous) => ({ ...previous, contactNumber: "" }));
    }
  };

  const validate = () => {
    const e = {};

    if (!form.fullName.trim()) {
      e.fullName = "Required";
    }

    if (!form.username.trim()) {
      e.username = "Required";
    }

    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) {
      e.email = "Enter a valid email";
    }

    if (
      !form.contactNumber ||
      !/^09\d{9}$/.test(form.contactNumber)
    ) {
      e.contactNumber = "Enter a valid mobile number";
    }

    if (!form.userType) e.userType = "Please select your user type.";
    const conditional = userTypeField(form.userType);
    if (conditional?.kind === "barangay" && !form.barangay) e.barangay = conditional.error;
    if (conditional?.kind === "detail" && !form.userTypeDetail.trim()) e.userTypeDetail = conditional.error;

    if (!form.password || form.password.length < 6) {
      e.password = "Min. 6 characters";
    }

    if (form.password !== form.confirmPassword) {
      e.confirmPassword = "Passwords do not match";
    }

    if (!acceptedTerms) {
      e.terms = "You must accept the Terms and Privacy Policy";
    }

    return e;
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    const errs = validate();

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await axios.post(
        `${API_BASE_URL}/auth/register`,
        {
          fullName: form.fullName,
          username: form.username,
          email: form.email,
          contactNumber: form.contactNumber,
          password: form.password,
          userType: form.userType,
          userTypeDetail: form.userTypeDetail.trim(),
          barangay: form.barangay,
        }
      );

      navigate("/login");
    } catch (err) {
      setErrors({
        general:
          err.response?.data?.message ||
          (err.request
            ? "Cannot reach the registration server. Please try again shortly."
            : "Registration failed"),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setErrors({});
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      const response = await axios.post(`${API_BASE_URL}/auth/verify`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userData = response.data.data;
      login(userData, userData.role, token);
      navigate(userData.profileComplete === false ? "/complete-profile" : "/participant/dashboard", { replace: true });
    } catch (error) {
      setErrors({ general: error.response?.data?.message || error.message || "Google registration failed." });
    } finally {
      setLoading(false);
    }
  };

  const conditionalField = userTypeField(form.userType);

  return (
    <div className="register-page">
      <div className="register-bg-shape register-bg-shape-one" />
      <div className="register-bg-shape register-bg-shape-two" />
      <div className="register-bg-shape register-bg-shape-three" />

      <main className="register-shell">
        <div className="register-brand">
          <img
            src={menroLogo}
            alt="MENRO Juban logo"
            className="register-brand-logo"
          />

          <div className="register-brand-copy">
            <strong>MENRO</strong>
            <span>ENVIRONMENT OFFICE · JUBAN</span>
          </div>
        </div>

        <section className="register-card">
          <div className="register-heading">
            <h1>
              Create your <em>account.</em>
            </h1>

            <p>
              Register to access the MENRO monitoring system.
            </p>
          </div>

          <div className="register-divider" />

          {errors.general && (
            <div className="register-general-error">
              {errors.general}
            </div>
          )}

          <form
            className="register-form"
            onSubmit={handleRegister}
          >
            <div className="register-form-grid">
              <Field
                label="Full Name"
                error={errors.fullName}
              >
                <div className="register-input-wrap">
                  <FiUser
                    size={15}
                    className="register-input-icon"
                  />

                  <input
                    type="text"
                    placeholder="Juan Dela Cruz"
                    value={form.fullName}
                    onChange={update("fullName")}
                    className="register-input"
                  />
                </div>
              </Field>

              <Field
                label="Username"
                error={errors.username}
              >
                <div className="register-input-wrap">
                  <FiUser
                    size={15}
                    className="register-input-icon"
                  />

                  <input
                    type="text"
                    placeholder="juandelacruz"
                    value={form.username}
                    onChange={update("username")}
                    className="register-input"
                  />
                </div>
              </Field>

              <Field
                label="Email Address"
                error={errors.email}
              >
                <div className="register-input-wrap">
                  <FiMail
                    size={15}
                    className="register-input-icon"
                  />

                  <input
                    type="email"
                    placeholder="juan@example.com"
                    value={form.email}
                    onChange={update("email")}
                    className="register-input"
                  />
                </div>
              </Field>

              <Field
                label="Contact Number"
                error={errors.contactNumber}
              >
                <div className="register-input-wrap">
                  <FiUser
                    size={15}
                    className="register-input-icon"
                  />

                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={11}
                    autoComplete="tel"
                    placeholder="09123456789"
                    value={form.contactNumber}
                    onChange={updateContactNumber}
                    className="register-input"
                  />
                </div>
              </Field>

              <div className="register-full-width">
                <Field
                  label="User Type *"
                  error={errors.userType}
                >
                  <select
                    value={form.userType}
                    onChange={update("userType")}
                    className="register-input register-input-no-icon"
                  >
                    <option value="">Select user type</option>
                    {USER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </Field>
              </div>

              {conditionalField?.kind === "barangay" && (
                <div className="register-full-width"><Field label={conditionalField.label} error={errors.barangay}><select value={form.barangay} onChange={update("barangay")} className="register-input register-input-no-icon"><option value="">Select barangay</option>{JUBAN_BARANGAYS.map((barangay) => <option key={barangay}>{barangay}</option>)}</select></Field></div>
              )}

              {conditionalField?.kind === "detail" && (
                <div className="register-full-width"><Field label={conditionalField.label} error={errors.userTypeDetail}><input type="text" value={form.userTypeDetail} onChange={update("userTypeDetail")} className="register-input register-input-no-icon" /></Field></div>
              )}

              <Field
                label="Password"
                error={errors.password}
              >
                <div className="register-input-wrap">
                  <FiLock
                    size={14}
                    className="register-input-icon"
                  />

                  <input
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••"
                    value={form.password}
                    onChange={update("password")}
                    className="register-input register-password-input"
                  />

                  <button
                    type="button"
                    className="register-eye"
                    onClick={() =>
                      setShowPass((prev) => !prev)
                    }
                    aria-label={
                      showPass
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPass ? (
                      <FiEyeOff size={14} />
                    ) : (
                      <FiEye size={14} />
                    )}
                  </button>
                </div>
              </Field>

              <Field
                label="Confirm"
                error={errors.confirmPassword}
              >
                <div className="register-input-wrap">
                  <FiLock
                    size={14}
                    className="register-input-icon"
                  />

                  <input
                    type={
                      showConfirm ? "text" : "password"
                    }
                    autoComplete="new-password"
                    placeholder="••••••"
                    value={form.confirmPassword}
                    onChange={update("confirmPassword")}
                    className="register-input register-password-input"
                  />

                  <button
                    type="button"
                    className="register-eye"
                    onClick={() =>
                      setShowConfirm((prev) => !prev)
                    }
                    aria-label={
                      showConfirm
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                  >
                    {showConfirm ? (
                      <FiEyeOff size={14} />
                    ) : (
                      <FiEye size={14} />
                    )}
                  </button>
                </div>
              </Field>
            </div>

            <div className="register-terms">
              <input
                type="checkbox"
                id="terms"
                checked={acceptedTerms}
                onChange={(e) =>
                  setAcceptedTerms(e.target.checked)
                }
              />

              <label htmlFor="terms">
                I agree to the{" "}
                <Link to="/terms-of-service" target="_blank" rel="noopener noreferrer">
                  Terms of Service
                </Link>
                {" "}and{" "}
                <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </Link>
              </label>
            </div>

            {errors.terms && (
              <p className="register-terms-error">
                {errors.terms}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="register-primary-btn"
            >
              {loading
                ? "Creating account..."
                : "Create Account →"}
            </button>
          </form>

          <div className="register-separator">
            <span />
            <small>OR</small>
            <span />
          </div>

          <button
            type="button"
            className="register-google-btn"
            onClick={handleGoogleRegister}
            disabled={loading}
          >
            <FcGoogle size={17} />
            Continue with Google
          </button>

          <div className="register-switch">
            Already have an account?{" "}
            <Link to="/login">Sign in here</Link>
          </div>
        </section>

        <footer className="register-footer">
          © 2025 MENRO JUBAN, SORSOGON
        </footer>
      </main>
    </div>
  );
}
