import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  auth,
  googleProvider,
} from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { dashboardPathForRole } from "../utils/roleRoutes";
import axios from "axios";

import menroLogo from "../assets/menro-logo.png";
import "../styles/login.css";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");
const localApiUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(
  configuredApiUrl || "",
);
const API_BASE_URL =
  import.meta.env.PROD && (!configuredApiUrl || localApiUrl)
    ? "https://menrobk-1.onrender.com/api"
    : configuredApiUrl || "http://localhost:5000/api";

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

const getLoginErrorMessage = (error, provider = "email") => {
  if (error?.response?.status === 429 ||
      /Too many requests\. Please slow down\./i.test(error?.response?.data?.message || "")) {
    return "Sign in is temporarily unavailable. Please try again later.";
  }

  if (isFirebaseNetworkError(error)) {
    return navigator.onLine === false
      ? "You appear to be offline. Reconnect to the internet, then try again."
      : "Unable to reach Firebase Authentication. Check your connection or disable any VPN/ad blocker, then try again.";
  }

  const firebaseMessages = {
    "auth/invalid-credential": "Invalid email or password.",
    "auth/user-not-found": "Account not found.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-disabled": "This account has been disabled. Please contact the administrator.",
    "auth/too-many-requests": "Too many failed attempts. Please wait a while, then try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/popup-blocked": "The Google sign-in window was blocked. Allow pop-ups, then try again.",
    "auth/unauthorized-domain": "Google sign-in is not enabled for this website. Please contact the administrator.",
  };

  if (firebaseMessages[error?.code]) {
    return firebaseMessages[error.code];
  }

  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.code === "ERR_NETWORK") {
    return "Signed in to Firebase, but the MENRO server could not be reached. Please try again shortly.";
  }

  return provider === "google"
    ? "Google sign-in failed. Please try again."
    : "Login failed. Please try again.";
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
  const [pendingLogin, setPendingLogin] = useState(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const successButtonRef = useRef(null);

  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    if (pendingLogin) successButtonRef.current?.focus();
  }, [pendingLogin]);

  const queueSuccessfulLogin = (userData, token, destination) => {
    setError("");
    setSuccess("");
    setPendingLogin({ userData, token, destination });
  };

  const acknowledgeSuccessfulLogin = () => {
    if (!pendingLogin || acknowledging) return;
    setAcknowledging(true);
    const { userData, token, destination } = pendingLogin;
    login(userData, userData.role, token);
    navigate(destination, { replace: true });
  };

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

      const token =
        await credential.user.getIdToken();

      const response =
        await axios.post(
          `${API_BASE_URL}/auth/verify`,
          {},
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const userData =
        response.data.data;

      queueSuccessfulLogin(
        userData,
        token,
        dashboardPathForRole(userData.role)
      );
    } catch (err) {
      setSuccess("");
      console.error("Email sign in failed:", err?.code || err?.message);
      setError(getLoginErrorMessage(err));
    } finally {
      signInInProgress.current = false;
      setLoading(false);
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
        const result =
          await signInWithPopup(
            auth,
            googleProvider
          );

        const token =
          await result.user.getIdToken();

        const response =
          await axios.post(
            `${API_BASE_URL}/auth/verify`,
            {},
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const userData =
          response.data.data;

        if (userData.role === "participant" && userData.profileComplete === false) {
          login(userData, userData.role, token);
          navigate("/complete-profile", { replace: true });
        } else {
          queueSuccessfulLogin(
            userData,
            token,
            dashboardPathForRole(userData.role)
          );
        }
      } catch (err) {
        console.error("Google sign in failed:", err?.code || err?.message);
        setSuccess("");
        setError(getLoginErrorMessage(err, "google"));
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

      {pendingLogin && (
        <div className="login-success-backdrop">
          <section
            className="login-success-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-success-title"
          >
            <CheckCircle2 className="login-success-icon" size={58} strokeWidth={1.7} aria-hidden="true" />
            <h2 id="login-success-title">You have successfully logged in!</h2>
            <button
              ref={successButtonRef}
              type="button"
              className="login-success-button"
              onClick={acknowledgeSuccessfulLogin}
              disabled={acknowledging}
            >
              {acknowledging ? "Continuing..." : "OK, got it!"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
