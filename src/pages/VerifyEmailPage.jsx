import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { applyActionCode, checkActionCode, signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { getVerificationErrorMessage } from "../utils/authErrors";
import menroLogo from "../assets/menro-logo.png";
import "../styles/register.css";
import "../styles/verify-email.css";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ status: "loading", message: "Verifying your email..." });

  useEffect(() => {
    let active = true;
    const verify = async () => {
      const mode = searchParams.get("mode");
      const oobCode = searchParams.get("oobCode");
      if (mode !== "verifyEmail" || !oobCode) {
        setState({ status: "error", message: "This verification link is incomplete or invalid." });
        return;
      }
      try {
        await checkActionCode(auth, oobCode);
        await applyActionCode(auth, oobCode);
        if (auth.currentUser) await signOut(auth);
        if (active) setState({ status: "success", message: "Your email address has been verified. You may now continue to your MENRO account." });
      } catch (error) {
        if (active) setState({ status: "error", message: getVerificationErrorMessage(error) });
      }
    };
    void verify();
    return () => { active = false; };
  }, [searchParams]);

  return (
    <div className="register-page verify-email-page">
      <main className="register-shell verify-email-shell">
        <div className="register-brand">
          <img src={menroLogo} alt="MENRO Juban logo" className="register-brand-logo" />
          <div className="register-brand-copy"><strong>MENRO</strong><span>ENVIRONMENT OFFICE · JUBAN</span></div>
        </div>
        <section className="register-card verify-email-card" aria-live="polite">
          <div className={`verify-email-icon verify-email-icon-${state.status}`} aria-hidden="true">
            {state.status === "loading" ? "…" : state.status === "success" ? "✓" : "!"}
          </div>
          <div className="register-heading">
            <h1>{state.status === "success" ? "Email Verified Successfully" : state.status === "error" ? "Verification Link Problem" : "Verifying your email..."}</h1>
            <p>{state.message}</p>
          </div>
          {state.status !== "loading" && (
            <Link className="register-primary-btn verify-email-link" to="/login">
              {state.status === "success" ? "Continue to Login" : "Return to Login"}
            </Link>
          )}
        </section>
      </main>
    </div>
  );
}
