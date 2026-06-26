import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import forestImg from "../assets/forest.jpg";
import {signInWithEmailAndPassword} from "firebase/auth";
import { auth } from "../firebase/config";
import axios from "axios";


export default function LoginPage() {
  const [email,setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password){ 
      setError("Please fill in all fields."); return; }
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

    "http://localhost:5000/api/auth/verify",

    {},

    {

    headers:{
    Authorization:
    `Bearer ${token}`
    }
    }
    );

    localStorage.setItem(
      "token",
      token
      );



      localStorage.setItem(
      "user",
      JSON.stringify(
      response.data.data
      )
      );

      navigate(
      "/dashboard"
      );
      }

      catch(error){

          if(error.code==="auth/user-not-found"){
          setError("Account not found.");
          }

          else if(error.code==="auth/wrong-password"){
          setError("Incorrect password.");
          }

          else if(error.code==="auth/invalid-credential"){
          setError("Invalid email or password.");
          }

          else{
          setError(
          error.response?.data?.message ||
          error.message ||
          "Login failed."
          );
          }
          }

        finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      {/* ── Left Panel ── */}
      <div className="auth-left">
        <div className="auth-form-box">

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
            <h1>Welcome <em>back.</em></h1>
            <p>Sign in to access the reforestation<br />monitoring system.</p>
          </div>

          <div className="auth-divider" />

          {/* Error */}
          {error && (
            <div className="auth-error">
              <FiLock size={12} /> {error}
            </div>
          )}

          <form onSubmit={handleLogin}>

            {/* Email Address */}
            <div className="auth-field">
              <div className="auth-label">Email Address</div>
              <div className="auth-input-wrap">
                <FiMail size={14} className="auth-icon" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                />
              </div>
            </div>

            {/* Password */}
            <div className="auth-field">
              <div className="auth-label">
                Password
                <a href="#">Forgot password?</a>
              </div>
              <div className="auth-input-wrap">
                <FiLock size={14} className="auth-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                  style={{ paddingRight: '36px' }}
                />
                <button type="button" className="auth-eye" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                </button>
              </div>
            </div>

            {/* Remember */}
            <div className="auth-remember">
              <input type="checkbox" id="remember" />
              <label htmlFor="remember">Keep me signed in</label>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading} className="auth-btn-primary">
              {loading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in...
                </>
              ) : "Sign in →"}
            </button>
          </form>

          {/* OR */}
          <div className="auth-sep">
            <div className="auth-sep-line" />
            <span className="auth-sep-txt">OR</span>
            <div className="auth-sep-line" />
          </div>

          {/* Google */}
          <button className="auth-btn-google">
            <FcGoogle size={15} />
            Continue with Google
          </button>

          <div className="auth-switch">
            Don't have an account?{" "}
            <Link to="/register">Create account</Link>
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