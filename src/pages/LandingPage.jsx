import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";

import menroLogo from "../assets/menro-logo.png";
import heroImage from "../assets/headerimg.jpg";
import aboutImage from "../assets/aboutsys.jpg";
import "../styles/landing-page.css";

const PROGRAM_ITEMS = [
  {
    id: "seedling-request",
    label: "Seedling Request Management",
    purpose: "Supports the organized submission and processing of requests for seedlings or saplings.",
    problem: "Helps reduce reliance on scattered or manual request records and makes requests easier to organize and monitor.",
  },
  {
    id: "sapling-distribution",
    label: "Sapling Distribution",
    purpose: "Supports the recording of approved saplings released for planting activities.",
    problem: "Helps MENRO maintain organized distribution records and distinguish requested quantities from saplings actually released.",
  },
  {
    id: "planting-activity",
    label: "Planting Activity Management",
    purpose: "Supports the organization of scheduled tree-planting activities and related event information.",
    problem: "Helps keep planting activities, schedules, participants, and related records organized in one system.",
  },
  {
    id: "planting-site",
    label: "Planting Site Management",
    purpose: "Maintains information about registered planting sites, including their location and relevant site details.",
    problem: "Helps organize planting-site records and provides a clearer reference for where planting activities take place.",
  },
  {
    id: "planting-reports",
    label: "Tree Planting Reports",
    purpose: "Allows planting activities to be documented using planting records and geo-tagged photo evidence.",
    problem: "Helps improve documentation and verification of reported tree-planting activities.",
  },
  {
    id: "survival-monitoring",
    label: "Survival Monitoring",
    purpose: "Supports periodic recording of the condition and survival of planted trees.",
    problem: "Helps MENRO maintain continuing records after planting instead of recording only the initial planting activity.",
  },
  {
    id: "reports-analytics",
    label: "Reports and Analytics",
    purpose: "Organizes system records into summaries, reports, and visual information for authorized MENRO users.",
    problem: "Helps reduce the difficulty of manually consolidating records from different reforestation activities.",
  },
];

function scrollToSection(sectionId) {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [programMenuOpen, setProgramMenuOpen] = useState(false);
  const [activeProgram, setActiveProgram] = useState("overview");
  const programMenuRef = useRef(null);

  useEffect(() => {
    const closeOutside = (event) => {
      if (programMenuRef.current && !programMenuRef.current.contains(event.target)) {
        setProgramMenuOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setProgramMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const goTo = (sectionId) => {
    setMobileMenuOpen(false);
    setProgramMenuOpen(false);
    scrollToSection(sectionId);
  };

  const openProgram = (programId) => {
    setActiveProgram(programId);
    goTo("reforestation-program");
  };

  return (
    <div className="landing-page">
      <header className="landing-header">
        <nav className="landing-nav" aria-label="Public navigation">
          <button type="button" className="landing-brand" onClick={() => goTo("home")} aria-label="MENRO home">
            <img src={menroLogo} alt="MENRO Juban logo" />
            <span>
              <strong>Municipal Environment and Natural Resources Office</strong>
              <small>Municipality of Juban, Sorsogon</small>
            </span>
          </button>

          <button
            type="button"
            className="landing-menu-toggle"
            onClick={() => setMobileMenuOpen((current) => !current)}
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-navigation-links"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div id="landing-navigation-links" className={`landing-nav-links${mobileMenuOpen ? " open" : ""}`}>
            <button type="button" onClick={() => goTo("home")}>Home</button>
            <button type="button" onClick={() => goTo("about")}>About</button>

            <div className="landing-program-menu" ref={programMenuRef}>
              <button
                type="button"
                className="landing-program-trigger"
                onClick={() => setProgramMenuOpen((current) => !current)}
                aria-expanded={programMenuOpen}
                aria-haspopup="menu"
              >
                Reforestation Program
                <ChevronDown size={15} aria-hidden="true" />
              </button>

              {programMenuOpen && (
                <div className="landing-program-dropdown" role="menu">
                  <button type="button" role="menuitem" onClick={() => openProgram("overview")}>Overview</button>
                  {PROGRAM_ITEMS.map((item) => (
                    <button type="button" role="menuitem" key={item.id} onClick={() => openProgram(item.id)}>
                      <span>{item.label}</span><span aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" onClick={() => goTo("guidelines")}>Guidelines</button>
            <button type="button" onClick={() => goTo("contact")}>Contact</button>
            <Link className="landing-get-started landing-nav-cta" to="/login">Get Started →</Link>
          </div>
        </nav>
      </header>

      <main>
        <section id="home" className="landing-hero" style={{ "--landing-hero-image": `url(${heroImage})` }}>
          <div className="landing-hero-content">
            <p className="landing-eyebrow">GREENER JUBAN. BRIGHTER TOMORROW.</p>
            <h1>GEO-TAGGED REFORESTATION MONITORING SYSTEM</h1>
            <h2>Municipality of Juban, Sorsogon</h2>
            <p className="landing-hero-description">
              A digital platform that supports MENRO in managing sapling requests, distribution, planting activities,
              geo-tagged planting records, and tree survival monitoring in the Municipality of Juban.
            </p>
            <div className="landing-hero-actions">
              <Link className="landing-get-started" to="/login">Get Started →</Link>
              <button type="button" className="landing-secondary-action" onClick={() => goTo("about")}>Learn More</button>
            </div>
          </div>
        </section>

        <section id="about" className="landing-section landing-about">
          <div className="landing-section-inner landing-about-grid">
            <div className="landing-about-copy">
              <p className="landing-section-kicker">PUBLIC INFORMATION</p>
              <h2>About the System</h2>
              <p>
                The GEO-TAGGED Reforestation Monitoring System is a digital platform developed to support the Municipal
                Environment and Natural Resources Office (MENRO) of Juban, Sorsogon in organizing and monitoring
                reforestation-related activities.
              </p>
              <p>
                The system brings together sapling requests, distribution records, planting activities, planting-site
                information, geo-tagged planting reports, survival monitoring, and reporting in one platform.
              </p>
              <p>
                Its purpose is to improve record organization, monitoring, coordination, and access to information used
                in MENRO&apos;s reforestation activities.
              </p>
            </div>
            <figure className="landing-about-image">
              <img src={aboutImage} alt="Tree planting activity in Juban, Sorsogon" />
            </figure>
          </div>
        </section>

        <section id="reforestation-program" className="landing-section landing-program-section">
          <div className="landing-section-inner">
            <div className="landing-section-heading">
              <p className="landing-section-kicker">SUPPORTED ACTIVITIES</p>
              <h2>Reforestation Program</h2>
              <p>
                The Reforestation Program supports the management and monitoring of tree-planting activities in the
                Municipality of Juban. The system helps organize sapling requests, distribution, planting records, site
                information, and survival monitoring to improve record management and coordination.
              </p>
            </div>

            <div className="landing-program-accordion">
              {PROGRAM_ITEMS.map((item) => {
                const expanded = activeProgram === item.id;
                return (
                  <article className={`landing-program-item${expanded ? " expanded" : ""}`} key={item.id}>
                    <button
                      type="button"
                      onClick={() => setActiveProgram(expanded ? "overview" : item.id)}
                      aria-expanded={expanded}
                      aria-controls={`program-${item.id}`}
                    >
                      <span>{item.label}</span><span aria-hidden="true">→</span>
                    </button>
                    {expanded && (
                      <div id={`program-${item.id}`} className="landing-program-detail">
                        <p><strong>Purpose</strong>{item.purpose}</p>
                        <p><strong>Problem addressed</strong>{item.problem}</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="guidelines" className="landing-section landing-guidelines">
          <div className="landing-section-inner">
            <div className="landing-section-heading">
              <p className="landing-section-kicker">PUBLIC RESOURCES</p>
              <h2>Guidelines and Resources</h2>
              <p>Access information, requirements, and resources related to the reforestation activities supported by the system.</p>
            </div>

            <div className="landing-resource-grid">
              <button type="button" className="landing-resource-card" onClick={() => goTo("guidelines-details")}>
                <strong>Guidelines &amp; Requirements →</strong>
                <span>View general information and requirements related to sapling requests, tree planting records, geo-tagged evidence, and survival monitoring.</span>
              </button>
              <button type="button" className="landing-resource-card" onClick={() => openProgram("overview")}>
                <strong>Reforestation Program →</strong>
                <span>Learn about the reforestation processes supported by the system.</span>
              </button>
            </div>

            <div id="guidelines-details" className="landing-guideline-details">
              <div className="landing-guideline-intro">
                <h3>General System Guidelines</h3>
                <p>
                  These are general instructions for using the system. They are not presented as official MENRO Juban
                  policies or regulatory requirements.
                </p>
              </div>
              <div className="landing-guideline-list">
                <article><h4>Sapling Request Information</h4><p>Provide complete and accurate requester, planting activity, and requested sapling information.</p></article>
                <article><h4>Planting Report Requirements</h4><p>Submit records that accurately describe the completed planting activity and its related planting site.</p></article>
                <article><h4>Geo-Tagged Photo Information</h4><p>Use original location-enabled photo evidence related to the reported planting activity. Location data supports record review but does not by itself guarantee legitimacy.</p></article>
                <article><h4>Survival Monitoring Information</h4><p>Record current tree conditions accurately when a planting record becomes available for monitoring in the system.</p></article>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <img src={menroLogo} alt="MENRO Juban logo" />
            <div><strong>Municipal Environment and Natural Resources Office</strong><span>Municipality of Juban, Sorsogon</span></div>
          </div>
          <div className="landing-footer-links">
            <strong>Quick Links</strong>
            <button type="button" onClick={() => goTo("home")}>Home</button>
            <button type="button" onClick={() => goTo("about")}>About</button>
            <button type="button" onClick={() => openProgram("overview")}>Reforestation Program</button>
            <button type="button" onClick={() => goTo("guidelines")}>Guidelines</button>
            <button type="button" onClick={() => goTo("contact")}>Contact</button>
          </div>
          <div className="landing-footer-contact">
            <strong>Contact</strong>
            <span>Municipal Environment and Natural Resources Office</span>
            <span>Municipality of Juban, Sorsogon</span>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>© 2026 Municipal Environment and Natural Resources Office (MENRO)<br />Municipality of Juban, Sorsogon.</p>
          <div><Link to="/privacy-policy">Privacy Notice</Link><Link to="/terms-of-service">Terms of Use</Link></div>
        </div>
      </footer>
    </div>
  );
}
