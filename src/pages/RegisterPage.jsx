import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "../context/AuthContext";
import { JUBAN_BARANGAYS, USER_TYPES, userTypeField } from "../utils/userTypes";
import { dashboardPathForRole } from "../utils/roleRoutes";
import { publicApiFetch, verifyMenroSession } from "../services/authenticatedApi";
import { startGooglePopup } from "../services/googleRedirectAuth";
import { getAuthErrorMessage, isGoogleCancellation } from "../utils/authErrors";

import menroLogo from "../assets/menro-logo.png";
import "../styles/register.css";

const Field = ({ label, htmlFor, error, children }) => (
  <div className="register-field">
    <div className="register-label"><label htmlFor={htmlFor}>{label}</label></div>

    {children}

    {error && <p className="register-field-error">{error}</p>}
  </div>
);

export default function RegisterPage() {
  const registrationInProgress = useRef(false);
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
    if (registrationInProgress.current) return;

    const errs = validate();

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    registrationInProgress.current = true;
    setLoading(true);

    try {
      const response = await publicApiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          fullName: form.fullName,
          username: form.username,
          email: form.email,
          contactNumber: form.contactNumber,
          password: form.password,
          userType: form.userType,
          userTypeDetail: form.userTypeDetail.trim(),
          barangay: form.barangay,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(payload?.message || "Registration failed.");
        error.status = response.status;
        throw error;
      }
      const verificationSent = payload?.data?.emailDelivery?.verification?.sent === true;
      navigate("/login", {
        state: {
          message: verificationSent
            ? "Account created. Check your email and verify your address before signing in."
            : "Account created, but the verification email could not be sent. Sign in and use Resend Verification Email.",
        },
      });
    } catch (err) {
      setErrors({
        general: err.status === 409
          ? "An account with this email already exists."
          : err.status
            ? err.message || "Registration failed. Please try again."
            : "Cannot reach the registration server. Please check your connection and try again.",
      });
    } finally {
      registrationInProgress.current = false;
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    if (registrationInProgress.current) return;
    registrationInProgress.current = true;
    setErrors({});
    setLoading(true);
    try {
      const result = await startGooglePopup();
      const userData = await verifyMenroSession(result.user);

      login(userData, userData.role);
      navigate(
        userData.profileComplete === false
          ? "/complete-profile"
          : dashboardPathForRole(userData.role),
        { replace: true }
      );
    } catch (error) {
      if (isGoogleCancellation(error)) {
        console.info("Google registration window was closed before completion.");
        setErrors({});
        return;
      }
      console.error("Google registration failed:", error?.code || error?.message);
      setErrors({
        general: getAuthErrorMessage(error, {
          provider: "google",
          online: navigator.onLine !== false,
        }),
      });
    } finally {
      registrationInProgress.current = false;
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
                htmlFor="register-full-name"
                error={errors.fullName}
              >
                <div className="register-input-wrap">
                  <FiUser
                    size={15}
                    className="register-input-icon"
                  />

                  <input
                    id="register-full-name"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    placeholder="Juan Dela Cruz"
                    value={form.fullName}
                    onChange={update("fullName")}
                    className="register-input"
                  />
                </div>
              </Field>

              <Field
                label="Username"
                htmlFor="register-username"
                error={errors.username}
              >
                <div className="register-input-wrap">
                  <FiUser
                    size={15}
                    className="register-input-icon"
                  />

                  <input
                    id="register-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="juandelacruz"
                    value={form.username}
                    onChange={update("username")}
                    className="register-input"
                  />
                </div>
              </Field>

              <Field
                label="Email Address"
                htmlFor="register-email"
                error={errors.email}
              >
                <div className="register-input-wrap">
                  <FiMail
                    size={15}
                    className="register-input-icon"
                  />

                  <input
                    id="register-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="juan@example.com"
                    value={form.email}
                    onChange={update("email")}
                    className="register-input"
                  />
                </div>
              </Field>

              <Field
                label="Contact Number"
                htmlFor="register-contact-number"
                error={errors.contactNumber}
              >
                <div className="register-input-wrap">
                  <FiUser
                    size={15}
                    className="register-input-icon"
                  />

                  <input
                    id="register-contact-number"
                    name="contactNumber"
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
                  htmlFor="register-user-type"
                  error={errors.userType}
                >
                  <select
                    id="register-user-type"
                    name="userType"
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
                <div className="register-full-width"><Field label={conditionalField.label} htmlFor="register-barangay" error={errors.barangay}><select id="register-barangay" name="barangay" value={form.barangay} onChange={update("barangay")} className="register-input register-input-no-icon"><option value="">Select barangay</option>{JUBAN_BARANGAYS.map((barangay) => <option key={barangay}>{barangay}</option>)}</select></Field></div>
              )}

              {conditionalField?.kind === "detail" && (
                <div className="register-full-width"><Field label={conditionalField.label} htmlFor="register-user-type-detail" error={errors.userTypeDetail}><input id="register-user-type-detail" name="userTypeDetail" type="text" value={form.userTypeDetail} onChange={update("userTypeDetail")} className="register-input register-input-no-icon" /></Field></div>
              )}

              <Field
                label="Password"
                htmlFor="register-password"
                error={errors.password}
              >
                <div className="register-input-wrap">
                  <FiLock
                    size={14}
                    className="register-input-icon"
                  />

                  <input
                    id="register-password"
                    name="password"
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
                htmlFor="register-confirm-password"
                error={errors.confirmPassword}
              >
                <div className="register-input-wrap">
                  <FiLock
                    size={14}
                    className="register-input-icon"
                  />

                  <input
                    id="register-confirm-password"
                    name="confirmPassword"
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
                name="acceptedTerms"
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
