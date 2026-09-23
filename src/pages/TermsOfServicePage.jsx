import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

import "../styles/legal.css";

export default function TermsOfServicePage() {
  return (
    <div className="legal-page">
      <div className="legal-shell">
        <Link to="/" className="legal-back-link">
          <FiArrowLeft size={14} />
          Back to home
        </Link>

        <section className="legal-card">
          <h1>Terms of Service</h1>
          <p className="legal-updated">Last updated: September 2026</p>

          <p>
            These Terms of Service ("Terms") govern your access to and use of
            the MENRO Juban Reforestation Monitoring System (the "System"),
            operated by the Municipal Environment and Natural Resources
            Office (MENRO) of Juban, Sorsogon. By creating an account or
            otherwise using the System, you agree to these Terms.
          </p>

          <h2>1. Who can use the System</h2>
          <p>
            The System is intended for MENRO staff, administrators, and
            registered participants (e.g. seedling recipients, event
            volunteers, and partner organizations) taking part in Juban's
            reforestation and tree-planting programs. You must provide
            accurate registration information, including your full name,
            a valid contact number, and your organization or affiliation.
          </p>

          <h2>2. Your account</h2>
          <ul>
            <li>You are responsible for keeping your login credentials confidential.</li>
            <li>You must notify MENRO staff promptly if you suspect unauthorized use of your account.</li>
            <li>Accounts may be marked inactive if information provided is found to be false or misleading.</li>
          </ul>

          <h2>3. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Submit planting reports, monitoring updates, or photo evidence that you know to be false or altered.</li>
            <li>Attempt to access data, accounts, or administrative functions you are not authorized to use.</li>
            <li>Use the System in any way that disrupts its normal operation or the experience of other users.</li>
          </ul>

          <h2>4. Content you submit</h2>
          <p>
            When you submit planting reports, monitoring updates, event
            registrations, or photo evidence, you confirm that the
            information is accurate to the best of your knowledge. MENRO
            may use this content to track reforestation progress, generate
            reports, and verify program compliance, as described in the{" "}
            <Link to="/privacy-policy">Privacy Policy</Link>.
          </p>

          <h2>5. Availability and changes</h2>
          <p>
            The System is provided as-is for the administration of MENRO's
            reforestation programs. Features may be added, changed, or
            removed, and these Terms may be updated from time to time.
            Continued use of the System after changes take effect
            constitutes acceptance of the revised Terms.
          </p>

          <h2>6. Contact</h2>
          <p>
            Questions about these Terms can be directed to the MENRO Juban
            office through your program coordinator or the contact details
            listed on the municipal office's official channels.
          </p>
        </section>
      </div>
    </div>
  );
}
