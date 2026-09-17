import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
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

  const navigate = useNavigate();
  const { login } = useAuth();

  const redirectByRole = (role) => {
    navigate(dashboardPathForRole(role));
  };

  const showLoginSuccess =
    async () => {
      setSuccess(
        "Signed in successfully. Redirecting..."
      );

      await new Promise(
        (resolve) => {
          window.setTimeout(
            resolve,
            700
          );
        }
      );
    };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (signInInProgress.current) return;

    setError("");
    setSuccess("");

    if (!email || !password) {
      setError(
        "Please fill in all fields."
      );
      return;
    }

    signInInProgress.current = true;
    setLoading(true);

    try {
      const credential =
        await signInWithEmailAndPassword(
          auth,
          email,
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

      login(
        userData,
        userData.role,
        token
      );

      const role =
        userData.role;

      await showLoginSuccess();

      redirectByRole(role);
    } catch (err) {
      setSuccess("");

      if (
        err.code ===
        "auth/user-not-found"
      ) {
        setError(
          "Account not found."
        );
      } else if (
        err.code ===
        "auth/wrong-password"
      ) {
        setError(
          "Incorrect password."
        );
      } else if (
        err.code ===
        "auth/invalid-credential"
      ) {
        setError(
          "Invalid email or password."
        );
      } else {
        setError(
          err.response?.status === 429 || /Too many requests\. Please slow down\./i.test(err.response?.data?.message || "")
            ? "Sign in is temporarily unavailable. Please try again later."
            : err.response?.data?.message ||
            err.message ||
            "Login failed."
        );
      }
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

        login(
          userData,
          userData.role,
          token
        );

        const role =
          userData.role;

        await showLoginSuccess();

        redirectByRole(role);
      } catch (err) {
        console.error("Google sign in failed:", err?.code || err?.message);
        setSuccess("");
        setError(
          err.response?.status === 429 || /Too many requests\. Please slow down\./i.test(err.response?.data?.message || "")
            ? "Sign in is temporarily unavailable. Please try again later."
            : err.response?.data?.message ||
            err.message ||
            "Google sign in failed."
        );
      } finally {
        signInInProgress.current = false;
        setLoading(false);
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
                <a href="#">
                  Forgot password?
                </a>
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
                  autoComplete="new-password"
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
                ? success
                  ? "Redirecting..."
                  : "Signing in..."
                : "Sign in →"}
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
