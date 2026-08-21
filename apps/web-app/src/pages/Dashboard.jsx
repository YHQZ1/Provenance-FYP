/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { complianceAPI, documentAPI, feedbackAPI } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { BtnSecondary, Badge, ProgressBar, MonoLabel } from "../components/ui";

const styles = {
  container: { fontFamily: "'DM Sans', sans-serif", color: "#0a0a0a" },
  errorBanner: {
    background: "var(--error-bg)",
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "14px 18px",
    marginBottom: 24,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  retryButton: {
    marginLeft: "auto",
    padding: "4px 12px",
    fontSize: 11,
    fontFamily: "'DM Mono', monospace",
    background: "none",
    border: "1px solid #fecaca",
    borderRadius: 6,
    cursor: "pointer",
    color: "var(--error)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 24,
  },
  midGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
    marginBottom: 20,
  },
  panel: {
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 24,
    background: "#fff",
  },
  card: {
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "22px 24px",
    background: "#fff",
  },
  statValue: {
    fontSize: 30,
    fontWeight: 600,
    letterSpacing: "-0.025em",
    color: "#0a0a0a",
    margin: "12px 0 4px",
  },
  statSubtext: (ok) => ({
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    color: ok ? "var(--success)" : "var(--warning)",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    margin: "0 0 14px",
  }),
  sectionTitle: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    fontWeight: 500,
    color: "#0a0a0a",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    margin: "0 0 16px",
    paddingBottom: 12,
    borderBottom: "1px solid var(--border-light)",
  },
  emptyText: {
    fontSize: 13,
    color: "var(--text-muted)",
    textAlign: "center",
    padding: "20px 0",
  },
};

const formatSync = (dateString) => {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const CardSkeleton = () => (
  <div style={{ ...styles.card, background: "#fafafa" }}>
    {[80, 48, 28, 12].map((w, i) => (
      <div
        key={i}
        style={{
          height: i === 1 ? 32 : 12,
          width: `${w}%`,
          background: "#efefef",
          borderRadius: 4,
          marginBottom: 12,
          animation: "shimmer 1.4s ease infinite",
        }}
      />
    ))}
    <style>{`@keyframes shimmer { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
  </div>
);

const StatCard = ({ label, value, pct, ok, loading }) => {
  if (loading) return <CardSkeleton />;
  return (
    <div style={styles.card}>
      <MonoLabel>{label}</MonoLabel>
      <p style={styles.statValue}>{value}</p>
      <p style={styles.statSubtext(ok)}>
        {ok ? "In Compliance" : "Review Required"}
      </p>
      <ProgressBar pct={pct} ok={ok} height={3} />
    </div>
  );
};

const TargetRow = ({ label, value, unit, ok }) => {
  const pct = Math.min(100, Math.round((value / 1000) * 100));
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: "#0a0a0a",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            fontWeight: 600,
            color: ok ? "var(--success)" : "#0a0a0a",
          }}
        >
          {value.toFixed(2)} {unit}
        </span>
      </div>
      <ProgressBar pct={pct} ok={ok} height={3} />
    </div>
  );
};

const DeadlineRow = ({ name, date, status }) => {
  const [hov, setHov] = useState(false);
  const formattedDate = date
    ? new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "N/A";
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "13px 16px",
        borderRadius: 10,
        border: `1px solid ${hov ? "var(--border-hover)" : "var(--border-light)"}`,
        background: hov ? "#fafafa" : "#fff",
        cursor: "default",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <div>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: "#0a0a0a",
            margin: 0,
          }}
        >
          {name}
        </p>
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: "var(--text-light)",
            margin: "4px 0 0",
            letterSpacing: "0.05em",
          }}
        >
          Due: {formattedDate}
        </p>
      </div>
      <Badge variant={status === "SUBMITTED" ? "success" : "neutral"}>
        {status}
      </Badge>
    </div>
  );
};

const RecentActivityRow = ({ filename, status, created_at }) => {
  const [hov, setHov] = useState(false);
  const formattedTime = created_at
    ? new Date(created_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const formattedDate = created_at
    ? new Date(created_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      })
    : "";
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid var(--border-light)",
        background: hov ? "#fafafa" : "transparent",
        transition: "background 0.15s",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: "#0a0a0a",
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {filename}
        </p>
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: "var(--text-light)",
            margin: "2px 0 0",
            letterSpacing: "0.04em",
          }}
        >
          {formattedDate} · {formattedTime}
        </p>
      </div>
      <Badge
        variant={
          status === "COMPLETED" || status === "VERIFIED"
            ? "success"
            : "neutral"
        }
      >
        {status}
      </Badge>
    </div>
  );
};

const SectionTitle = ({ children, style }) => (
  <p style={{ ...styles.sectionTitle, ...style }}>{children}</p>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [currentFiling, setCurrentFiling] = useState(null);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);
  const [documents, setDocuments] = useState({
    total: 0,
    verified: 0,
    pending: 0,
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, filingRes, activityRes, pendingRes, docsRes] =
        await Promise.all([
          complianceAPI.getStats(),
          complianceAPI.getCurrentFiling().catch(() => ({ data: null })),
          complianceAPI.getRecentActivity(),
          feedbackAPI.getPending({ limit: 5 }),
          documentAPI.list({ limit: 100 }),
        ]);
      setStats(statsRes.data);
      setCurrentFiling(filingRes.data);
      setRecentActivity(activityRes.data?.recent_uploads || []);
      const pendingData = pendingRes.data || [];
      setPendingReviews(pendingData.length);
      const docsData = docsRes.data || [];
      setDocuments({
        total: docsData.length,
        verified: docsData.filter((d) => d.verified_by_user).length,
        pending: docsData.filter((d) => !d.verified_by_user).length,
      });
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const {
    total: totalDocs,
    verified: verifiedDocs,
    pending: pendingDocs,
  } = documents;
  const score =
    totalDocs > 0 ? Math.round((verifiedDocs / totalDocs) * 100) : 0;

  const statCards = [
    {
      id: "total",
      label: "Total Ingested",
      value: totalDocs.toString(),
      pct: 100,
      ok: true,
    },
    {
      id: "pending",
      label: "Pending Review",
      value: pendingDocs.toString(),
      pct: totalDocs > 0 ? Math.round((pendingDocs / totalDocs) * 100) : 0,
      ok: pendingDocs === 0,
    },
    {
      id: "verified",
      label: "Verified records",
      value: verifiedDocs.toString(),
      pct: score,
      ok: score > 80,
    },
  ];

  const materialEntries = currentFiling?.materials
    ? Object.entries(currentFiling.materials)
    : [];
  const currentYear = new Date().getFullYear();
  const fy = currentFiling?.year
    ? `FY ${currentFiling.year}-${(currentFiling.year + 1).toString().slice(-2)}`
    : `FY ${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
  const lastSync = currentFiling?.updated_at || new Date().toISOString();

  return (
    <div style={styles.container}>
      <PageHeader
        eyebrow={fy}
        title="Compliance Overview"
        subtitle={`Last telemetry sync: ${formatSync(lastSync)}`}
        actions={
          <BtnSecondary onClick={() => navigate("/upload")}>
            Upload Records
          </BtnSecondary>
        }
      />

      {error && (
        <div style={styles.errorBanner}>
          <MonoLabel color="var(--error)">SYSTEM_FETCH_ERROR</MonoLabel>
          <span style={{ fontSize: 13, color: "var(--error)" }}>{error}</span>
          <button onClick={fetchDashboardData} style={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      <div style={styles.statsGrid} className="dash-stats">
        {statCards.map((c) => (
          <StatCard key={c.id} {...c} loading={loading} />
        ))}
      </div>

      <div style={styles.midGrid} className="dash-mid">
        <div style={styles.panel}>
          <SectionTitle>Material Ingest (KG)</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {loading ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : materialEntries.length > 0 ? (
              materialEntries.map(([key, val]) => (
                <TargetRow
                  key={key}
                  label={key}
                  value={val}
                  unit="kg"
                  ok={val > 0}
                />
              ))
            ) : (
              <p style={styles.emptyText}>
                Upload documents to see material breakdown.
              </p>
            )}
          </div>
        </div>

        <div style={styles.panel}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <SectionTitle style={{ margin: 0, padding: 0, border: "none" }}>
              Current Filing Status
            </SectionTitle>
            {currentFiling && (
              <Badge
                variant={
                  currentFiling.status === "SUBMITTED" ? "success" : "neutral"
                }
              >
                {currentFiling.quarter}
              </Badge>
            )}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {loading ? (
              <CardSkeleton />
            ) : currentFiling ? (
              <DeadlineRow
                name={`${currentFiling.quarter} Filing Period`}
                date={currentFiling.end_date}
                status={currentFiling.status}
              />
            ) : (
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  padding: "10px 0",
                }}
              >
                No active filing period.
              </p>
            )}
          </div>
          <SectionTitle style={{ marginTop: 8 }}>Recent Activity</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {loading ? (
              <>
                <div style={{ height: 40 }} />
                <div style={{ height: 40 }} />
              </>
            ) : recentActivity.length > 0 ? (
              recentActivity
                .slice(0, 3)
                .map((doc) => <RecentActivityRow key={doc.id} {...doc} />)
            ) : (
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  padding: "10px 0",
                }}
              >
                No recent uploads.
              </p>
            )}
          </div>
        </div>
      </div>

      <div style={styles.panel}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <SectionTitle style={{ margin: 0, padding: 0, border: "none" }}>
            Data Reliability Score
          </SectionTitle>
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "#0a0a0a",
              }}
            >
              {loading ? "—" : score}
            </span>
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 13,
                color: "var(--text-light)",
                marginLeft: 2,
              }}
            >
              /100
            </span>
          </div>
        </div>
        <ProgressBar pct={loading ? 0 : score} ok={score > 70} height={5} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 10,
          }}
        >
          <MonoLabel color="var(--text-light)">
            {pendingReviews} items pending review
          </MonoLabel>
          <MonoLabel color="var(--success)">
            {verifiedDocs} verified records
          </MonoLabel>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) { .dash-stats { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 640px) { .dash-stats { grid-template-columns: 1fr !important; } .dash-mid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
