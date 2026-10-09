import { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { dashboardPathForRole } from "../utils/roleRoutes";
import { authenticatedFetch, verifyMenroSession } from "../services/authenticatedApi";
import { startGooglePopup } from "../services/googleRedirectAuth";
import {
  getAuthErrorMessage,
  hasNewGoogleSession,
  isGoogleCancellation,
} from "../utils/authErrors";

import menroLogo from "../assets/menro-logo.png";
import "../styles/login.css";

const isFirebaseNetworkError = (error) =>
  error?.code === "auth/network-request-failed";

const wait = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const signInWithNetworkRetry = async (email, password) => {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    // Firebase occasionally reports a transient fetch failure even while the
    // browser is online. Retry once; genuine credential errors are never retried.
    if (!isFirebaseNetworkError(error) || navigator.onLine === false) {
      throw error;
    }

    await wait(500);
    return signInWithEmailAndPassword(auth, email, password);
  }
};

export default function LoginPage() {
  const signInInProgress = useRef(false);
  const googleAttempt = useRef(0);
  const mounted = useRef(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState(() => location.state?.message || "");
  const [loading, setLoading] =
    useState(false);
  const [loginStage, setLoginStage] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const { login, verificationRequired } = useAuth();

  const [verificationSending, setVerificationSending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      googleAttempt.current += 1;
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setInterval(
      () => setResendCooldown((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (signInInProgress.current) return;

    setError("");
    setSuccess("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError(
        "Please fill in all fields."
      );
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    signInInProgress.current = true;
    setLoading(true);
    setLoginStage("Signing in...");

    try {
      const credential = await signInWithNetworkRetry(
        normalizedEmail,
        password
      );

      setLoginStage("Verifying with MENRO...");
      const userData = await verifyMenroSession(credential.user);

      login(userData, userData.role);
      navigate(dashboardPathForRole(userData.role), { replace: true });
    } catch (err) {
      setSuccess("");
      console.error("Email sign in failed:", err?.code || err?.message);
      setError(getAuthErrorMessage(err, { online: navigator.onLine !== false }));
    } finally {
      signInInProgress.current = false;
      setLoading(false);
      setLoginStage("");
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser || verificationSending || resendCooldown > 0) return;
    setVerificationSending(true);
    try {
      const response = await authenticatedFetch("/auth/resend-verification", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Unable to resend verification email.");
      setError("");
      setSuccess("A new verification email was sent. Verify your address, then sign in again.");
      setResendCooldown(60);
    } catch (resendError) {
      setError(resendError.message || "Unable to resend the verification email right now. Please try again later.");
    } finally {
      setVerificationSending(false);
    }
  };

  const handleGoogleLogin =
    async () => {
      if (signInInProgress.current) return;
      const attempt = ++googleAttempt.current;
      const isCurrentAttempt = () =>
        mounted.current && googleAttempt.current === attempt;
      const userBeforePopup = auth.currentUser;
      signInInProgress.current = true;
      setError("");
      setSuccess("");
      setLoading(true);
      setLoginStage("Waiting for Google...");

      try {
        let firebaseUser = auth.currentUser;

        if (!firebaseUser?.providerData?.some(
          (provider) => provider.providerId === "google.com"
        )) {
          try {
            const result = await startGooglePopup();
            firebaseUser = result.user;
          } catch (popupError) {
            if (!isCurrentAttempt()) return;
            const authenticatedUser = auth.currentUser;
            if (hasNewGoogleSession(userBeforePopup, authenticatedUser)) {
              firebaseUser = authenticatedUser;
            } else if (isGoogleCancellation(popupError)) {
              console.info("Google sign-in was cancelled before authentication completed.");
              setError("");
              return;
            } else {
              throw popupError;
            }
          }
        }

        if (!isCurrentAttempt()) return;
        setLoginStage("Verifying with MENRO...");
        const userData = await verifyMenroSession(firebaseUser);
        if (!isCurrentAttempt()) return;

        setError("");
        setSuccess("");
        login(userData, userData.role);
        navigate(
          userData.role === "participant" && userData.profileComplete === false
            ? "/complete-profile"
            : dashboardPathForRole(userData.role),
          { replace: true }
        );
      } catch (err) {
        if (!isCurrentAttempt()) return;
        console.error("Google sign in failed:", err?.code || err?.message);
        setSuccess("");
        setError(getAuthErrorMessage(err, {
          provider: "google",
          online: navigator.onLine !== false,
        }));
      } finally {
        if (isCurrentAttempt()) {
          signInInProgress.current = false;
          setLoading(false);
          setLoginStage("");
        }
      }
    };

  const handleForgotPassword = async () => {
    setError("");
    setSuccess("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { setError("Please enter your email address first."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setSuccess("If this email uses a MENRO email/password account, Firebase sent a reset link. Google accounts should continue with Google.");
    } catch (resetError) {
      setError(resetError.code === "auth/invalid-email"
        ? "Please enter a valid email address."
        : "Unable to send a password reset email. If this account uses Google, sign in with Google instead.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-shape login-bg-shape-one" />
      <div className="login-bg-shape login-bg-shape-two" />
      <div className="login-bg-shape login-bg-shape-three" />

      <main className="login-shell">
        <div className="login-brand">
          <img
            src={menroLogo}
            alt="MENRO Bulan logo"
            className="login-brand-logo"
          />

          <div className="login-brand-copy">
            <strong>MENRO</strong>
            <span>
              ENVIRONMENT OFFICE · BULAN
            </span>
          </div>
        </div>

        <section className="login-card">
          <div className="login-heading">
            <h1>
              Welcome <em>back.</em>
            </h1>

            <p>
              Sign in to access the
              reforestation monitoring
              system.
            </p>
          </div>

          <div className="login-divider" />

          {success && (
            <div
              role="status"
              aria-live="polite"
              style={{
                marginBottom:
                  "14px",
                textAlign:
                  "center",
                fontSize:
                  "13px",
                fontWeight: 600,
                color: "#087443",
              }}
            >
              {success}
            </div>
          )}

          {error && (
            <div className="login-error">
              <FiLock size={13} />
              <span>{error}</span>
            </div>
          )}

          {(verificationRequired || error === "Please verify your email address before continuing.") && auth.currentUser && (
            <button type="button" className="login-forgot-button" onClick={handleResendVerification} disabled={verificationSending || resendCooldown > 0}>
              {verificationSending
                ? "Sending verification email..."
                : resendCooldown > 0
                  ? `Resend available in ${resendCooldown}s`
                  : "Resend verification email"}
            </button>
          )}

          <form
            className="login-form"
            onSubmit={handleLogin}
          >
            <div className="login-field">
              <div className="login-label">
                <label htmlFor="login-email">Email Address</label>
              </div>

              <div className="login-input-wrap">
                <FiMail
                  size={15}
                  className="login-input-icon"
                />

                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value
                    )
                  }
                  className="login-input"
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-label login-password-label">
                <label htmlFor="login-password">Password</label>
                <button type="button" className="login-forgot-button" onClick={handleForgotPassword} disabled={loading || resetLoading}>
                  {resetLoading ? "Sending..." : "Forgot password?"}
                </button>
              </div>

              <div className="login-input-wrap">
                <FiLock
                  size={15}
                  className="login-input-icon"
                />

                <input
                  id="login-password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                  className="login-input login-password-input"
                />

                <button
                  type="button"
                  className="login-eye"
                  onClick={() =>
                    setShowPassword(
                      (previous) =>
                        !previous
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <FiEyeOff size={14} />
                  ) : (
                    <FiEye size={14} />
                  )}
                </button>
              </div>
            </div>

            <div className="login-remember">
              <input
                type="checkbox"
                id="remember"
                name="rememberMe"
              />

              <label htmlFor="remember">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="login-primary-btn"
            >
              {loading
                ? loginStage || "Continuing..."
                : "Continue →"}
            </button>
          </form>

          <div className="login-separator">
            <span />
            <small>OR</small>
            <span />
          </div>

          <button
            type="button"
            className="login-google-btn"
            onClick={
              handleGoogleLogin
            }
            disabled={loading}
          >
            <FcGoogle size={17} />
            {loading ? loginStage || "Continuing..." : "Continue with Google"}
          </button>

          <div className="login-switch">
            Don't have an account?{" "}
            <Link to="/register">
              Create account
            </Link>
          </div>
        </section>

        <footer className="login-footer">
          © 2025 MENRO BULAN, SORSOGON
        </footer>
      </main>

    </div>
  );
}
