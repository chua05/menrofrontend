import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

import "../styles/legal.css";

export default function PrivacyPolicyPage() {
  return (
    <div className="legal-page">
      <div className="legal-shell">
        <Link to="/register" className="legal-back-link">
          <FiArrowLeft size={14} />
          Back to registration
        </Link>

        <section className="legal-card">
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last updated: September 2026</p>

          <p>
            This Privacy Policy explains what information the MENRO Juban
            Reforestation Monitoring System (the "System") collects, how it
            is used, and how it is protected.
          </p>

          <h2>1. Information we collect</h2>
          <ul>
            <li>
              <strong>Account information:</strong> full name, username, email
              address, contact number, and organization/affiliation provided
              at registration.
            </li>
            <li>
              <strong>Program activity:</strong> seedling requests, planting
              reports, monitoring updates, event registrations, and any
              photos submitted as evidence for these activities.
            </li>
            <li>
              <strong>Authentication data:</strong> your account is
              authenticated through Firebase Authentication, including via
              Google Sign-In if you choose that option. We receive your
              email address and display name from Google; we never receive
              or store your Google password.
            </li>
          </ul>

          <h2>2. How we use this information</h2>
          <ul>
            <li>To create and manage your account, and to apply the correct role-based access (participant, staff, or admin).</li>
            <li>To process seedling requests, track planting and monitoring activity, and generate program reports.</li>
            <li>To contact you about your requests, events you've registered for, or account status changes.</li>
            <li>To maintain the security and integrity of the System, including detecting misuse.</li>
          </ul>

          <h2>3. Where your data is stored</h2>
          <p>
            Account and program data is stored using Google Firebase
            (Authentication and Firestore) and, for uploaded photo evidence,
            a managed file storage service. Access to this data is
            restricted to authorized MENRO staff and administrators based on
            their assigned role.
          </p>

          <h2>4. Sharing of information</h2>
          <p>
            We do not sell your personal information. Information may be
            shared internally within MENRO Juban for program administration,
            or disclosed if required by law or a valid government request.
          </p>

          <h2>5. Your choices</h2>
          <ul>
            <li>You can review and update parts of your profile from your account settings.</li>
            <li>You may request correction or removal of your account data by contacting your MENRO program coordinator.</li>
          </ul>

          <h2>6. Data retention</h2>
          <p>
            We retain account and program activity records for as long as
            your account is active and as needed to maintain accurate
            reforestation program records, or as required by applicable
            government recordkeeping rules.
          </p>

          <h2>7. Changes to this policy</h2>
          <p>
            This Privacy Policy may be updated from time to time. Material
            changes will be reflected by updating the date at the top of
            this page. It should be read together with the{" "}
            <Link to="/terms-of-service">Terms of Service</Link>.
          </p>

          <h2>8. Contact</h2>
          <p>
            Questions about this Privacy Policy or your data can be directed
            to the MENRO Juban office through your program coordinator or
            the contact details listed on the municipal office's official
            channels.
          </p>
        </section>
      </div>
    </div>
  );
}
