import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import forestImg from "../assets/forest.jpg";
import axios from "axios";

const Field = ({ label, error, children }) => (
  <div className="auth-field">
    <div className="auth-label">{label}</div>

    {children}

    {error && (
      <p
        style={{
          color: "#f87171",
          fontSize: "11px",
          marginTop: "4px",
          fontWeight: 300
        }}
      >
        {error}
      </p>
    )}
  </div>
);

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
  fullName: "",
  username: "",
  email: "",
  contactNumber: "",
  organization: "",
  password: "",
  confirmPassword: "",
  });

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));


  const validate = () => {
  const e = {};

  if (!form.fullName.trim())
    e.fullName = "Required";

  if (!form.username.trim())
    e.username = "Required";

  if (
    !form.email ||
    !/\S+@\S+\.\S+/.test(form.email)
  )
    e.email = "Enter a valid email";

  if (
  !form.contactNumber ||
  !/^09\d{9}$/.test(form.contactNumber)
)
  e.contactNumber =
    "Enter a valid mobile number";


  if (
    !form.password ||
    form.password.length < 6
  )
    e.password = "Min. 6 characters";

  if (
    form.password !== form.confirmPassword
  )
    e.confirmPassword =
      "Passwords do not match";

  if (!acceptedTerms)
    e.terms = 
      "You must accept the Terms and Privacy Policy";

  return e;

};

  const handleRegister = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try{
      await axios.post(
        "http://localhost:5000/api/auth/register",
        {
          fullName: form.fullName,
          username: form.username,
          email: form.email,
          contactNumber: form.contactNumber,
          password: form.password,
          organization: form.organization
        }
      );
      navigate("/login");
    }
    catch(err){
      setErrors({
        general: err.response?.data?.message ||"Registration failed"});
      }
      finally{
   setLoading(false);
}
  };


  return (
    <div className="auth-page">

      {/* ── Left Panel ── */}
      <div className="auth-left">
        <div className="auth-form-box" style={{ marginTop: "90px" }}>

          {/* Logo */}
          <div className="auth-logo">
            <div className="auth-logo-mark">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
              </svg>
            </div>
            <div>
              <div className="auth-logo-name">MENRO</div>
              <div className="auth-logo-sub">ENVIRONMENT OFFICE · JUBAN</div>
            </div>
          </div>

          {/* Heading */}
          <div className="auth-heading">
            <h1>Create your <em>account.</em></h1>
            <p>Register to access the MENRO monitoring system.</p>
          </div>

          <div className="auth-divider" />

          {errors.general && (
            <div className="auth-error">{errors.general}</div>
          )}

          <form onSubmit={handleRegister}>

            <Field label="Full Name" error={errors.fullName}>
              <div className="auth-input-wrap">
                <FiUser size={14} className="auth-icon" />
                <input type="text" placeholder="Juan Dela Cruz"
                  value={form.fullName} onChange={update("fullName")}
                  className="auth-input" />
              </div>
            </Field>

            <Field label="Username" error={errors.username}>
              <div className="auth-input-wrap">
                <FiUser size={14} className="auth-icon" />
                <input type="text" placeholder="juandelacruz"
                  value={form.username} onChange={update("username")}
                  className="auth-input" />
              </div>
            </Field>

            <Field label="Email Address" error={errors.email}>
              <div className="auth-input-wrap">
                <FiMail size={14} className="auth-icon" />
                <input type="email" placeholder="juan@example.com"
                  value={form.email} onChange={update("email")}
                  className="auth-input" />
              </div>
            </Field>

            <Field
                label="Contact Number"
                error={errors.contactNumber}
              >
                <div className="auth-input-wrap">
                  <FiUser size={14}
                    className="auth-icon"
                  />

                  <input
                    type="text"
                    placeholder="09123456789"
                    value={form.contactNumber}
                    onChange={update("contactNumber")}
                    className="auth-input"
                  />
                </div>
              </Field>

            <Field label="Organization (optional)">
              <input
                type="text"
                placeholder="e.g. Juban Environment Office"
                value={form.organization}
                onChange={update("organization")}
                className="auth-input no-icon"
              />
            </Field>

            {/* Password row */}
            <div className="auth-pass-grid">
              <Field label="Password" error={errors.password}>
                <div className="auth-input-wrap">
                  <FiLock size={13} className="auth-icon" />
                  <input type={showPass ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••"
                  value={form.password} onChange={update("password")}
                  className="auth-input" style={{ paddingRight: '36px' }} />
                  <button type="button" className="auth-eye" onClick={() => setShowPass(!showPass)}>
                    {showPass ? <FiEyeOff size={13} /> : <FiEye size={13} />}
                  </button>
                </div>
              </Field>

              <Field label="Confirm" error={errors.confirmPassword}>
                <div className="auth-input-wrap">
                  <FiLock size={13} className="auth-icon" />
                  <input type={showConfirm ? "text" : "password"} 
                  autoComplete="new-password"
                  placeholder="••••••"
                  value={form.confirmPassword} onChange={update("confirmPassword")}
                  className="auth-input" style={{ paddingRight: '36px' }} />
                  <button type="button" className="auth-eye" onClick={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? <FiEyeOff size={13} /> : <FiEye size={13} />}
                  </button>
                </div>
              </Field>
            </div>

            {/* Terms */}
            <div className="auth-terms" style={{ marginBottom: '16px', marginTop: '4px' }}>
              <input type="checkbox" id="terms" checked={acceptedTerms} onChange={(e) =>
              setAcceptedTerms(e.target.checked)
                  }
                />
              <label htmlFor="terms">
                I agree to the{" "}
                <a href="#">Terms of Service</a>
                {" "}and{" "}
                <a href="#">Privacy Policy</a>
              </label>
            </div>

            {errors.terms && (
                <p
                  style={{
                    color: "#f87171",
                    fontSize: "11px",
                    marginTop: "-10px",
                    marginBottom: "12px",
                    fontWeight: 300
                  }}
                >
                  {errors.terms}
                </p>
              )}

            <button type="submit" disabled={loading} className="auth-btn-primary">
              {loading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Creating account...
                </>
              ) : "Create Account →"}
            </button>
          </form>

          <div className="auth-sep">
            <div className="auth-sep-line" />
            <span className="auth-sep-txt">OR</span>
            <div className="auth-sep-line" />
          </div>

          <button className="auth-btn-google">
            <FcGoogle size={15} />
            Continue with Google
          </button>

          <div className="auth-switch">
            Already have an account?{" "}
            <Link to="/login">Sign in here</Link>
          </div>

          <div className="auth-footer">© 2025 MENRO JUBAN, SORSOGON</div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="auth-right" style={{ backgroundImage: `url(${forestImg})` }}>
        <div className="auth-right-overlay" />
        <div className="auth-right-content">
          <div className="auth-right-pill">
            <div className="auth-right-pill-dot" />
            <span>SYSTEM ACTIVE</span>
          </div>
          <div className="auth-right-bottom">
            <div className="auth-right-label">REFORESTATION MONITORING</div>
            <div className="auth-right-heading">
              Preserving the<br />verdant <em>heritage</em><br />of Juban.
            </div>
            <div className="auth-right-body">
              A centralized platform for monitoring reforestation efforts,
              seedling distribution, and environmental reporting across
              the Municipality of Juban, Sorsogon.
            </div>
            <div className="auth-right-line" />
          </div>
        </div>
      </div>

    </div>
  );
  }