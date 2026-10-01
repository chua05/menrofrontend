import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { dashboardPathForRole } from "../utils/roleRoutes";
import { verifyMenroSession } from "../services/authenticatedApi";
import { startGooglePopup } from "../services/googleRedirectAuth";
import { getAuthErrorMessage, isGoogleCancellation } from "../utils/authErrors";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");
  const [loading, setLoading] =
    useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const [verificationSending, setVerificationSending] = useState(false);

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

    try {
      const credential = await signInWithNetworkRetry(
        normalizedEmail,
        password
      );

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
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser || verificationSending) return;
    setVerificationSending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setError("");
      setSuccess("A new verification email was sent. Verify your address, then sign in again.");
    } catch {
      setError("Unable to resend the verification email right now. Please try again later.");
    } finally {
      setVerificationSending(false);
    }
  };

  const handleGoogleLogin =
    async () => {
      if (signInInProgress.current) return;
      signInInProgress.current = true;
      setError("");
      setSuccess("");
      setLoading(true);

      try {
        const result = await startGooglePopup();
        const userData = await verifyMenroSession(result.user);

        login(userData, userData.role);
        navigate(
          userData.role === "participant" && userData.profileComplete === false
            ? "/complete-profile"
            : dashboardPathForRole(userData.role),
          { replace: true }
        );
      } catch (err) {
        if (isGoogleCancellation(err)) {
          // Chrome/Firebase can report popup-closed after the OAuth credential
          // has already been persisted. In that case Firebase is authoritative:
          // finish MENRO verification instead of treating the normal close as a
          // cancelled sign-in.
          const firebaseUser = auth.currentUser;
          if (firebaseUser) {
            try {
              const userData = await verifyMenroSession(firebaseUser);
              login(userData, userData.role);
              navigate(
                userData.role === "participant" && userData.profileComplete === false
                  ? "/complete-profile"
                  : dashboardPathForRole(userData.role),
                { replace: true }
              );
              return;
            } catch (verificationError) {
              console.error(
                "MENRO verification after Google sign-in failed:",
                verificationError?.code || verificationError?.message
              );
              setError(getAuthErrorMessage(verificationError, {
                provider: "google",
                online: navigator.onLine !== false,
              }));
              return;
            }
          }

          console.info("Google sign-in was cancelled before authentication completed.");
          setError("");
          return;
        }
        console.error("Google sign in failed:", err?.code || err?.message);
        setSuccess("");
        setError(getAuthErrorMessage(err, {
          provider: "google",
          online: navigator.onLine !== false,
        }));
      } finally {
        signInInProgress.current = false;
        setLoading(false);
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
            alt="MENRO Juban logo"
            className="login-brand-logo"
          />

          <div className="login-brand-copy">
            <strong>MENRO</strong>
            <span>
              ENVIRONMENT OFFICE · JUBAN
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

          {error === "Please verify your email address before continuing." && auth.currentUser && (
            <button type="button" className="login-forgot-button" onClick={handleResendVerification} disabled={verificationSending}>
              {verificationSending ? "Sending verification email..." : "Resend verification email"}
            </button>
          )}

          <form
            className="login-form"
            onSubmit={handleLogin}
          >
            <div className="login-field">
              <div className="login-label">
                Email Address
              </div>

              <div className="login-input-wrap">
                <FiMail
                  size={15}
                  className="login-input-icon"
                />

                <input
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
                <span>Password</span>
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
                ? "Continuing..."
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
            Continue with Google
          </button>

          <div className="login-switch">
            Don't have an account?{" "}
            <Link to="/register">
              Create account
            </Link>
          </div>
        </section>

        <footer className="login-footer">
          © 2025 MENRO JUBAN, SORSOGON
        </footer>
      </main>

    </div>
  );
}
