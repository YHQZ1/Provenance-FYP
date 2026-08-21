/* eslint-disable react-hooks/refs */
import React, { useState, useEffect, useRef } from "react";

const MODULES = [
  {
    id: "MOD-01",
    label: "EPR Compliance",
    title: "Deterministic CPCB Filings.",
    body: "Transform raw SKUs and packaging data into standardized plastic EPR outputs. Provenance calculates quarterly targets and generates submission-ready draft CSVs. No heuristics, just traceable math.",
    pills: ["Plastic PWM", "E-Waste", "Battery", "Tyres"],
    preview: "epr",
  },
  {
    id: "MOD-02",
    label: "BRSR Reporting",
    title: "BRSR Core assurance requirements.",
    body: "Every environmental indicator, auto-filled from your operational data. We map utilities, fuel logs, and purchase registers directly to SEBI-aligned metrics. Fully reproducible.",
    pills: ["SEBI Aligned", "Principle 6", "Scope 1 & 2"],
    preview: "brsr",
  },
  {
    id: "MOD-03",
    label: "Carbon BOM",
    title: "Scope 3 Proxy Emissions.",
    body: "Generate a product-level Carbon Bill of Materials. Provenance maps purchased goods and explicit transport factors to give you a transparent emissions intensity metric without SaaS dependencies.",
    pills: ["Proxy Emissions", "Intensity Metrics", "Local-First"],
    preview: "analytics",
  },
  {
    id: "MOD-04",
    label: "Audit Provenance",
    title: "Defensible traceability.",
    body: "Every reported number traces back through: KPI → Input Row → Emission Factor → Formula Version. Structured provenance logs ensure you are always audit-defensible.",
    pills: ["KPI Trace", "Versioned Factors", "Immutable Logs"],
    preview: "audit",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Ingest Raw Records",
    body: "Import GST purchase registers, utility consumption, and production output. Provenance normalizes all quantities to base units (kWh, kg, L) automatically.",
  },
  {
    n: "02",
    title: "Apply Deterministic Logic",
    body: "The engine applies explicit, versioned emission factors to your data. No black boxes. Every calculation is transparent and stored in the KPI Trace table.",
  },
  {
    n: "03",
    title: "Generate Defensible Reports",
    body: "Export BRSR Core-aligned tables, Scope 1-3 reports, and CPCB schemas. Everything is backed by an audit-grade provenance log ready for inspection.",
  },
];

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export default function Provenance() {
  const [activeModule, setActiveModule] = useState(0);
  const [email, setEmail] = useState("");
  const [mounted, setMounted] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleModuleChange = (i) => {
    if (i === activeModule) return;
    setTransitioning(true);
    setTimeout(() => {
      setActiveModule(i);
      setTransitioning(false);
    }, 160);
  };

  const hero = useInView(0.1);
  const dash = useInView(0.1);
  const mods = useInView(0.1);
  const steps = useInView(0.1);
  const cta = useInView(0.1);

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "#fff",
        color: "#0a0a0a",
        overflowX: "hidden",
        width: "100%",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

        html { scroll-behavior: smooth; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #059669; color: #fff; }

        /* Animation Classes */
        .fade-up { opacity: 0; transform: translateY(20px); transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
        .fade-up.visible { opacity: 1; transform: none; }
        .fade-up.d1 { transition-delay: 0.05s; }
        .fade-up.d2 { transition-delay: 0.12s; }
        .fade-up.d3 { transition-delay: 0.19s; }
        .fade-up.d4 { transition-delay: 0.26s; }

        .hero-enter { opacity: 0; transform: translateY(28px); transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
        .hero-enter.mounted { opacity: 1; transform: none; }
        .hero-enter.d1 { transition-delay: 0.1s; }
        .hero-enter.d2 { transition-delay: 0.2s; }
        .hero-enter.d3 { transition-delay: 0.3s; }
        .hero-enter.d4 { transition-delay: 0.45s; }

        .module-preview { opacity: 1; transform: none; transition: opacity 0.16s ease, transform 0.16s ease; }
        .module-preview.out { opacity: 0; transform: translateY(6px); }

        .mono { font-family: 'DM Mono', monospace; }

        /* Components */
        .content-wrapper {
          max-width: 100%;
          margin: 0 auto;
          padding: 0 32px;
        }

        .nav-link {
          font-size: 16px;
          font-weight: 500;
          color: #737373;
          text-decoration: none;
          transition: color 0.2s;
        }
        .nav-link:hover { color: #0a0a0a; }

        .btn-dark {
          display: inline-flex; align-items: center; justify-content: center;
          background: #0a0a0a; color: #fff; font-size: 13px; font-weight: 500;
          padding: 12px 24px; border-radius: 6px; border: none; cursor: pointer;
          text-decoration: none; transition: background 0.2s, transform 0.15s;
        }
        .btn-dark:hover { background: #1a1a1a; }
        .btn-dark:active { transform: scale(0.98); }

        .btn-outline {
          display: inline-flex; align-items: center; justify-content: center;
          background: transparent; color: #0a0a0a; font-size: 13px; font-weight: 500;
          padding: 12px 24px; border-radius: 6px; border: 1px solid #e5e5e5;
          cursor: pointer; text-decoration: none; transition: border-color 0.2s, background 0.2s, transform 0.15s;
        }
        .btn-outline:hover { border-color: #0a0a0a; background: #fafafa; }
        .btn-outline:active { transform: scale(0.98); }

        .btn-green {
          display: inline-flex; align-items: center; justify-content: center;
          background: #059669; color: #fff; font-size: 13px; font-weight: 500;
          padding: 12px 24px; border-radius: 6px; border: none; cursor: pointer;
          text-decoration: none; transition: background 0.2s, transform 0.15s;
        }
        .btn-green:hover { background: #047857; }
        .btn-green:active { transform: scale(0.98); }

        .mod-tab {
          padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 500;
          border: 1px solid #e5e5e5; background: #fff; color: #737373;
          cursor: pointer; transition: all 0.18s ease;
        }
        .mod-tab:hover { color: #0a0a0a; border-color: #d4d4d4; }
        .mod-tab.active { background: #0a0a0a; color: #fff; border-color: #0a0a0a; }

        .stat-card { padding: 20px 24px; border: 1px solid #e5e5e5; border-radius: 8px; background: #fafafa; }

        .progress-bar { height: 3px; border-radius: 99px; background: #e5e5e5; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 99px; background: #059669; }
        .progress-fill.dark { background: #0a0a0a; }

        .pill { font-size: 11px; font-weight: 500; padding: 6px 12px; border-radius: 5px; background: #f5f5f5; color: #525252; border: 1px solid #e5e5e5; }

        .step-card { padding: 32px; border-radius: 12px; border: 1px solid #262626; background: #111; transition: background 0.2s; }
        .step-card:hover { background: #161616; }

        .tag { display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 10px; border-radius: 99px; border: 1px solid #e5e5e5; color: #737373; }

        input[type="email"] {
          font-family: 'DM Sans', sans-serif; font-size: 14px; padding: 12px 16px;
          border: 1px solid #e5e5e5; border-radius: 6px; outline: none; background: #fafafa;
          color: #0a0a0a; transition: border-color 0.2s, background 0.2s; width: 100%;
        }
        input[type="email"]::placeholder { color: #a3a3a3; }
        input[type="email"]:focus { border-color: #059669; background: #fff; }

        .sidebar-item { padding: 10px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; color: #737373; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; }
        .sidebar-item:hover { color: #0a0a0a; background: #f5f5f5; }
        .sidebar-item.active { background: #fff; border-color: #e5e5e5; color: #0a0a0a; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }

        .deadline-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border: 1px solid #e5e5e5; border-radius: 8px; cursor: pointer; transition: border-color 0.15s; }
        .deadline-row:hover { border-color: #d4d4d4; }

        @media (max-width: 1024px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .dash-layout { flex-direction: column !important; }
          .mods-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .footer-grid { flex-direction: column !important; }
        }
      `}</style>

      {/* HEADER */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #e5e5e5",
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}
      >
        <div
          className="content-wrapper"
          style={{
            height: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/provenance.png"
              alt="Provenance Logo"
              style={{ height: 32 }}
            />
            <span
              style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              Provenance
            </span>
          </div>

          <nav style={{ display: "flex", gap: 32 }}>
            {["Platform", "Solutions", "Architecture"].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} className="nav-link">
                {l}
              </a>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a href="/auth?mode=login" className="nav-link">
              Sign in
            </a>
            <a href="/auth?mode=signup" className="btn-dark">
              Get Access
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{ width: "100%", padding: "160px 0 80px" }}>
        <div
          ref={hero.ref}
          className="content-wrapper hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
            alignItems: "center",
          }}
        >
          <div>
            <div className={`hero-enter ${mounted ? "mounted" : ""}`}>
              <span className="tag">Deterministic Compliance Engine</span>
            </div>
            <h1
              className={`hero-enter ${mounted ? "mounted" : ""} d1`}
              style={{
                fontSize: 64,
                fontWeight: 600,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                color: "#0a0a0a",
                margin: "24px 0 24px",
              }}
            >
              Correctness over
              <br />
              <span style={{ color: "#059669" }}>convenience.</span>
            </h1>
            <p
              className={`hero-enter ${mounted ? "mounted" : ""} d2`}
              style={{
                fontSize: 18,
                color: "#525252",
                lineHeight: 1.6,
                fontWeight: 400,
                maxWidth: 480,
                marginBottom: 40,
              }}
            >
              Convert operational and finance data into regulator-ready reports
              with full traceability, reproducible calculations, and audit-grade
              provenance. No black boxes.
            </p>
            <div
              className={`hero-enter ${mounted ? "mounted" : ""} d3`}
              style={{ display: "flex", gap: 12 }}
            >
              <a href="/auth?mode=signup" className="btn-dark">
                Deploy System
              </a>
              <a href="#architecture" className="btn-outline">
                Read the Docs
              </a>
            </div>
          </div>

          <div
            className={`hero-enter ${mounted ? "mounted" : ""} d4`}
            style={{ position: "relative" }}
          >
            <div
              style={{
                position: "absolute",
                top: 12,
                left: -12,
                right: -12,
                bottom: -12,
                background: "#f5f5f5",
                borderRadius: 16,
                border: "1px solid #e5e5e5",
                zIndex: 0,
              }}
            />
            <div
              style={{
                position: "relative",
                zIndex: 1,
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #e5e5e5",
                boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
                padding: 32,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: 20,
                  borderBottom: "1px solid #f5f5f5",
                  marginBottom: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#059669",
                    }}
                  />
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "#737373",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Live Posture
                  </span>
                </div>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    background: "#f5f5f5",
                    borderRadius: 4,
                    padding: "4px 10px",
                    color: "#0a0a0a",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  SYS_OK
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 28,
                  paddingBottom: 24,
                  borderBottom: "1px solid #f5f5f5",
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: 88,
                    height: 88,
                    flexShrink: 0,
                  }}
                >
                  <svg
                    viewBox="0 0 80 80"
                    style={{
                      width: "100%",
                      height: "100%",
                      transform: "rotate(-90deg)",
                    }}
                  >
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      fill="none"
                      stroke="#f5f5f5"
                      strokeWidth="6"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      fill="none"
                      stroke="#059669"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${0.8 * 201} 201`}
                    />
                  </svg>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 24,
                        fontWeight: 600,
                        color: "#0a0a0a",
                      }}
                    >
                      80
                    </span>
                  </div>
                </div>
                <div>
                  <p
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "#737373",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    Global ESG Index
                  </p>
                  <p
                    style={{
                      fontSize: 16,
                      fontWeight: 500,
                      color: "#0a0a0a",
                      marginBottom: 12,
                    }}
                  >
                    Top Quartile Performance
                  </p>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      background: "#ecfdf5",
                      color: "#059669",
                      borderRadius: 4,
                      padding: "4px 10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    +12 pts YTD
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                {[
                  { label: "Plastic PWM", pct: 87, ok: true },
                  { label: "E-Waste", pct: 100, ok: true },
                  { label: "Battery", pct: 42, ok: false },
                  { label: "Tyres", pct: 95, ok: true },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      border: "1px solid #f0f0f0",
                      borderRadius: 8,
                      padding: 16,
                      background: "#fafafa",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: "#737373",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: item.ok ? "#059669" : "#0a0a0a",
                        }}
                      >
                        {item.pct}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`progress-fill${item.ok ? "" : " dark"}`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM / DASHBOARD */}
      <section id="platform" style={{ width: "100%", padding: "40px 0 100px" }}>
        <div className="content-wrapper" ref={dash.ref}>
          <div
            className={`fade-up ${dash.inView ? "visible" : ""}`}
            style={{ marginBottom: 48 }}
          >
            <p
              className="mono"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#059669",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              System Interface
            </p>
            <h2
              style={{
                fontSize: 48,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
                color: "#0a0a0a",
                maxWidth: 640,
              }}
            >
              Your entire compliance posture in one deterministic view.
            </h2>
          </div>

          <div
            className={`fade-up d1 ${dash.inView ? "visible" : ""}`}
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                borderBottom: "1px solid #e5e5e5",
                padding: "14px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#fafafa",
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "#e5e5e5",
                  }}
                />
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "#e5e5e5",
                  }}
                />
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "#e5e5e5",
                  }}
                />
              </div>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  color: "#a3a3a3",
                  letterSpacing: "0.06em",
                  background: "#fff",
                  border: "1px solid #e5e5e5",
                  borderRadius: 6,
                  padding: "4px 12px",
                }}
              >
                app.provenance.in / dashboard
              </span>
              <div style={{ width: 48 }} />
            </div>

            <div
              className="dash-layout"
              style={{ display: "flex", minHeight: 520 }}
            >
              <div
                style={{
                  width: 220,
                  flexShrink: 0,
                  borderRight: "1px solid #f0f0f0",
                  padding: "20px 16px",
                  background: "#fafafa",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {[
                  "Overview",
                  "KPI Trace",
                  "BRSR Matrix",
                  "Factor Library",
                  "Audit Logs",
                  "Configuration",
                ].map((item, i) => (
                  <div
                    key={item}
                    className={`sidebar-item ${i === 0 ? "active" : ""}`}
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div
                style={{ flex: 1, padding: "32px 40px", background: "#fff" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    marginBottom: 32,
                  }}
                >
                  <div>
                    <h2
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: "#0a0a0a",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      FY 2024–25 Telemetry
                    </h2>
                    <p
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: "#a3a3a3",
                        marginTop: 8,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      Last sync: 12.04.2025 · 14:32 IST
                    </p>
                  </div>
                  <button className="btn-dark" style={{ fontSize: 11 }}>
                    Generate Filing
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 16,
                    marginBottom: 32,
                  }}
                >
                  {[
                    {
                      label: "Total Liability",
                      value: "142.6 MT",
                      sub: "Plastics + E-Waste",
                    },
                    {
                      label: "Procured Certs",
                      value: "124.0 MT",
                      sub: "87% Coverage",
                    },
                    {
                      label: "Risk Exposure",
                      value: "₹0",
                      sub: "Within thresholds",
                    },
                  ].map((c) => (
                    <div key={c.label} className="stat-card">
                      <p
                        className="mono"
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: "#737373",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          marginBottom: 12,
                        }}
                      >
                        {c.label}
                      </p>
                      <p
                        style={{
                          fontSize: 26,
                          fontWeight: 600,
                          letterSpacing: "-0.02em",
                          color: "#0a0a0a",
                        }}
                      >
                        {c.value}
                      </p>
                      <p
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: "#059669",
                          marginTop: 8,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        {c.sub}
                      </p>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 24,
                  }}
                >
                  <div>
                    <p
                      className="mono"
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#0a0a0a",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        paddingBottom: 12,
                        borderBottom: "1px solid #f0f0f0",
                        marginBottom: 16,
                      }}
                    >
                      Upcoming Deadlines
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {[
                        {
                          name: "Plastic EPR Annual",
                          date: "Jun 30, 2025",
                          status: "Pending",
                        },
                        {
                          name: "E-Waste Q1 Cert",
                          date: "Apr 15, 2025",
                          status: "Action Req",
                        },
                      ].map((d) => (
                        <div key={d.name} className="deadline-row">
                          <div>
                            <p
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: "#0a0a0a",
                              }}
                            >
                              {d.name}
                            </p>
                            <p
                              className="mono"
                              style={{
                                fontSize: 11,
                                color: "#737373",
                                marginTop: 4,
                                letterSpacing: "0.04em",
                              }}
                            >
                              {d.date}
                            </p>
                          </div>
                          <span
                            className="mono"
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "4px 8px",
                              borderRadius: 4,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              background:
                                d.status === "Action Req"
                                  ? "#0a0a0a"
                                  : "#f5f5f5",
                              color:
                                d.status === "Action Req" ? "#fff" : "#737373",
                            }}
                          >
                            {d.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p
                      className="mono"
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#0a0a0a",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        paddingBottom: 12,
                        borderBottom: "1px solid #f0f0f0",
                        marginBottom: 16,
                      }}
                    >
                      Target Acquisition
                    </p>
                    <div
                      style={{
                        border: "1px solid #e5e5e5",
                        borderRadius: 8,
                        padding: 24,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 10,
                        }}
                      >
                        <span
                          className="mono"
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: "#737373",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                          }}
                        >
                          Q1 Plastic PWM
                        </span>
                        <span
                          className="mono"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#059669",
                          }}
                        >
                          87%
                        </span>
                      </div>
                      <div
                        className="progress-bar"
                        style={{ marginBottom: 20 }}
                      >
                        <div
                          className="progress-fill"
                          style={{ width: "87%" }}
                        />
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: 8,
                          textAlign: "center",
                        }}
                      >
                        {["Q1", "Q2", "Q3", "Q4"].map((q, i) => (
                          <div
                            key={q}
                            style={{
                              background: "#fafafa",
                              borderRadius: 6,
                              padding: "10px 4px",
                            }}
                          >
                            <div
                              className="mono"
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                marginBottom: 4,
                                color: i < 3 ? "#059669" : "#a3a3a3",
                              }}
                            >
                              {i < 2 ? "100%" : i === 2 ? "94%" : "0%"}
                            </div>
                            <div
                              className="mono"
                              style={{
                                fontSize: 10,
                                color: "#a3a3a3",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                              }}
                            >
                              {q}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTIONS / MODULES */}
      <section
        id="solutions"
        style={{
          background: "#fafafa",
          borderTop: "1px solid #e5e5e5",
          width: "100%",
          padding: "100px 0",
        }}
      >
        <div className="content-wrapper" ref={mods.ref}>
          <div
            className={`fade-up ${mods.inView ? "visible" : ""}`}
            style={{ marginBottom: 40 }}
          >
            <p
              className="mono"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#059669",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Core Architecture
            </p>
            <h2
              style={{
                fontSize: 48,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
                color: "#0a0a0a",
              }}
            >
              Everything required.
              <br />
              Nothing extraneous.
            </h2>
          </div>

          <div
            className={`fade-up d1 ${mods.inView ? "visible" : ""}`}
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 48,
              flexWrap: "wrap",
            }}
          >
            {MODULES.map((mod, i) => (
              <button
                key={i}
                onClick={() => handleModuleChange(i)}
                className={`mod-tab ${activeModule === i ? "active" : ""}`}
              >
                {mod.label}
              </button>
            ))}
          </div>

          <div
            className={`fade-up d2 mods-grid ${mods.inView ? "visible" : ""}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 64,
              alignItems: "start",
            }}
          >
            <div className={`module-preview ${transitioning ? "out" : ""}`}>
              <span
                className="mono"
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#737373",
                  background: "#fff",
                  border: "1px solid #e5e5e5",
                  borderRadius: 4,
                  padding: "4px 12px",
                  marginBottom: 24,
                  letterSpacing: "0.08em",
                }}
              >
                {MODULES[activeModule].id}
              </span>
              <h3
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  color: "#0a0a0a",
                  lineHeight: 1.2,
                  marginBottom: 20,
                }}
              >
                {MODULES[activeModule].title}
              </h3>
              <p
                style={{
                  fontSize: 16,
                  color: "#525252",
                  lineHeight: 1.7,
                  fontWeight: 400,
                  marginBottom: 32,
                }}
              >
                {MODULES[activeModule].body}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {MODULES[activeModule].pills.map((p) => (
                  <span key={p} className="pill">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div
              className={`module-preview ${transitioning ? "out" : ""}`}
              style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #e5e5e5",
                padding: 32,
                boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
              }}
            >
              {activeModule === 0 && (
                <div>
                  <p
                    className="mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: "#a3a3a3",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      paddingBottom: 16,
                      borderBottom: "1px solid #f0f0f0",
                      marginBottom: 24,
                    }}
                  >
                    Data Preview // CPCB Format
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 20,
                    }}
                  >
                    {[
                      { name: "Plastic PWM", pct: 87, ok: true },
                      { name: "E-Waste", pct: 100, ok: true },
                      { name: "Battery", pct: 42, ok: false },
                    ].map((item) => (
                      <div key={item.name}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 10,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: "#0a0a0a",
                            }}
                          >
                            {item.name}
                          </span>
                          <span
                            className="mono"
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: item.ok ? "#059669" : "#0a0a0a",
                            }}
                          >
                            {item.pct}%
                          </span>
                        </div>
                        <div className="progress-bar">
                          <div
                            className={`progress-fill${item.ok ? "" : " dark"}`}
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <a
                    href="/auth?mode=login"
                    className="btn-green"
                    style={{ width: "100%", marginTop: 32 }}
                  >
                    Initiate CPCB Transfer
                  </a>
                </div>
              )}
              {activeModule === 1 && (
                <div>
                  <p
                    className="mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: "#a3a3a3",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      paddingBottom: 16,
                      borderBottom: "1px solid #f0f0f0",
                      marginBottom: 8,
                    }}
                  >
                    BRSR Output // Section B
                  </p>
                  {[
                    "Energy consumed (GJ)",
                    "Water withdrawal (KL)",
                    "Waste generated (MT)",
                    "Scope 1 GHG (tCO₂e)",
                  ].map((row) => (
                    <div
                      key={row}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "16px 0",
                        borderBottom: "1px solid #f5f5f5",
                      }}
                    >
                      <span style={{ fontSize: 14, color: "#525252" }}>
                        {row}
                      </span>
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#0a0a0a",
                          background: "#f5f5f5",
                          borderRadius: 4,
                          padding: "4px 10px",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Mapped
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {(activeModule === 2 || activeModule === 3) && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 240,
                    border: "1px dashed #e5e5e5",
                    borderRadius: 10,
                    background: "#fafafa",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "#a3a3a3",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Console data available upon integration
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ARCHITECTURE / IMPLEMENTATION */}
      <section
        id="architecture"
        style={{ background: "#0a0a0a", width: "100%", padding: "100px 0" }}
      >
        <div className="content-wrapper" ref={steps.ref}>
          <div
            className={`fade-up ${steps.inView ? "visible" : ""}`}
            style={{ marginBottom: 64 }}
          >
            <p
              className="mono"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#059669",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Implementation
            </p>
            <h2
              style={{
                fontSize: 48,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
                color: "#fff",
                maxWidth: 600,
              }}
            >
              Operational before your next filing deadline.
            </h2>
          </div>

          <div
            className={`steps-grid ${steps.inView ? "visible" : ""}`}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 20,
            }}
          >
            {STEPS.map((step, i) => (
              <div
                key={step.n}
                className={`step-card fade-up d${i + 1} ${steps.inView ? "visible" : ""}`}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: "#059669",
                    fontWeight: 500,
                    display: "block",
                    marginBottom: 28,
                    paddingBottom: 20,
                    borderBottom: "1px solid #1f1f1f",
                    letterSpacing: "0.06em",
                  }}
                >
                  STEP_{step.n}
                </span>
                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: "#fff",
                    marginBottom: 16,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontSize: 15,
                    color: "#a3a3a3",
                    lineHeight: 1.7,
                    fontWeight: 400,
                  }}
                >
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          borderTop: "1px solid #e5e5e5",
          background: "#fff",
          width: "100%",
          padding: "100px 0",
        }}
      >
        <div className="content-wrapper" ref={cta.ref}>
          <div
            className={`fade-up ${cta.inView ? "visible" : ""}`}
            style={{ maxWidth: 600 }}
          >
            <h2
              style={{
                fontSize: 48,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
                color: "#0a0a0a",
                marginBottom: 20,
              }}
            >
              Establish control.
              <br />
              Connect your data today.
            </h2>
            <p
              style={{
                fontSize: 16,
                color: "#525252",
                fontWeight: 400,
                lineHeight: 1.7,
                marginBottom: 40,
              }}
            >
              Deploy Provenance in your environment. Secure, verifiable
              compliance.
            </p>
            <div
              className={`fade-up d1 ${cta.inView ? "visible" : ""}`}
              style={{ display: "flex", gap: 12, maxWidth: 480 }}
            >
              <input
                type="email"
                placeholder="user@enterprise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <a
                href="/auth?mode=signup"
                className="btn-dark"
                style={{ flexShrink: 0 }}
              >
                Initialize
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: "1px solid #e5e5e5",
          background: "#fafafa",
          width: "100%",
          padding: "80px 0 40px",
        }}
      >
        <div className="content-wrapper">
          <div
            className="footer-grid"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 64,
              marginBottom: 64,
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <img
                  src="/provenance.png"
                  alt="Provenance Logo"
                  style={{ height: 24 }}
                />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Provenance
                </span>
              </div>
              <p
                style={{
                  fontSize: 14,
                  color: "#737373",
                  maxWidth: 260,
                  lineHeight: 1.6,
                  fontWeight: 400,
                }}
              >
                Enterprise-grade EPR & ESG infrastructure. Deterministic
                compliance without the chaos.
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 64,
              }}
            >
              {[
                {
                  heading: "Architecture",
                  links: [
                    "EPR Engine",
                    "BRSR Automator",
                    "Risk Telemetry",
                    "Security",
                  ],
                },
                {
                  heading: "Entity",
                  links: ["About", "Careers", "Documentation", "Contact"],
                },
                {
                  heading: "Legal",
                  links: ["Privacy", "Terms of Service", "DPDPA"],
                },
              ].map((col) => (
                <div key={col.heading}>
                  <p
                    className="mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "#0a0a0a",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      marginBottom: 20,
                      paddingBottom: 12,
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    {col.heading}
                  </p>
                  <ul
                    style={{
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {col.links.map((link) => (
                      <li key={link}>
                        <a
                          href="#platform"
                          style={{
                            fontSize: 14,
                            color: "#737373",
                            textDecoration: "none",
                            transition: "color 0.15s",
                          }}
                          onMouseOver={(e) =>
                            (e.currentTarget.style.color = "#0a0a0a")
                          }
                          onMouseOut={(e) =>
                            (e.currentTarget.style.color = "#737373")
                          }
                        >
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              paddingTop: 24,
              borderTop: "1px solid #e5e5e5",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <p
              className="mono"
              style={{
                fontSize: 11,
                color: "#a3a3a3",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              © 2026 Provenance Tech // India
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
