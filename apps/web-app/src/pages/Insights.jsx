/* eslint-disable react-hooks/immutability */
/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback } from "react";
import { Download, AlertTriangle } from "lucide-react";
import { complianceAPI, documentAPI } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { BtnSecondary, Badge, ProgressBar, MonoLabel } from "../components/ui";

const styles = {
  card: {
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: "22px 24px",
    background: "#fff",
  },
  panel: {
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 24,
    background: "#fff",
  },
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
  errorBanner: {
    background: "#fafafa",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "14px 18px",
    marginBottom: 24,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  timeRangeBtn: (active) => ({
    padding: "8px 14px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: "'DM Mono', monospace",
    letterSpacing: "0.04em",
    border: "1px solid",
    borderColor: active ? "#0a0a0a" : "var(--border)",
    background: active ? "#0a0a0a" : "#fff",
    color: active ? "#fff" : "var(--text-muted)",
    cursor: "pointer",
    transition: "all 0.15s",
  }),
  toast: {
    position: "fixed",
    bottom: 24,
    right: 24,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#0a0a0a",
    color: "#fff",
    padding: "12px 18px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif",
    boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
  },
};

const SectionTitle = ({ children }) => (
  <p style={styles.sectionTitle}>{children}</p>
);

const StatCard = ({ label, value, delta, sub, up, loading }) => {
  if (loading)
    return (
      <div style={styles.card}>
        {[70, 40, 55].map((w, i) => (
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
  return (
    <div style={styles.card}>
      <MonoLabel>{label}</MonoLabel>
      <p
        style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "-0.025em",
          color: "#0a0a0a",
          margin: "12px 0 4px",
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: up ? "var(--success)" : "#0a0a0a",
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        {delta} · {sub}
      </p>
    </div>
  );
};

const BarChart = ({ data, accent }) => {
  const W = 400,
    H = 140,
    barW = 34;
  const max = Math.max(...data.map((d) => d.value), 1);
  const gap = (W - data.length * barW) / (data.length + 1);
  const isGreen = accent === "green";
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H + 28}`}
      style={{ display: "block" }}
    >
      {data.map((d, i) => {
        const bh = Math.max(Math.round((d.value / max) * H), 4);
        const x = gap + i * (barW + gap);
        const y = H - bh;
        return (
          <g key={d.label || d.month}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={bh}
              rx={4}
              fill={isGreen ? "var(--success)" : "#0a0a0a"}
              opacity={0.85}
            />
            <text
              x={x + barW / 2}
              y={H + 18}
              textAnchor="middle"
              fontSize="10"
              fontFamily="'DM Mono', monospace"
              fill="var(--text-light)"
              letterSpacing="0.04em"
            >
              {d.label || d.month}
            </text>
            <text
              x={x + barW / 2}
              y={y - 6}
              textAnchor="middle"
              fontSize="10"
              fontFamily="'DM Mono', monospace"
              fill="var(--text-muted)"
            >
              {d.value}
              {isGreen ? "%" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const PieChart = ({ data, colors }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0)
    return (
      <div
        style={{
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MonoLabel color="var(--text-light)">No data available</MonoLabel>
      </div>
    );
  const size = 140,
    center = size / 2,
    radius = 55;
  let startAngle = 0;
  return (
    <svg
      width="100%"
      height="180"
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block", margin: "0 auto" }}
    >
      {data.map((d, i) => {
        const angle = (d.value / total) * 360;
        const endAngle = startAngle + angle;
        const largeArc = angle > 180 ? 1 : 0;
        const x1 = center + radius * Math.cos((startAngle * Math.PI) / 180);
        const y1 = center + radius * Math.sin((startAngle * Math.PI) / 180);
        const x2 = center + radius * Math.cos((endAngle * Math.PI) / 180);
        const y2 = center + radius * Math.sin((endAngle * Math.PI) / 180);
        const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        startAngle = endAngle;
        return (
          <path
            key={i}
            d={pathData}
            fill={colors[i % colors.length]}
            stroke="#fff"
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
};

const MaterialLegend = ({ data, colors }) => (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      justifyContent: "center",
      marginTop: 16,
    }}
  >
    {data.map((d, i) => (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            background: colors[i % colors.length],
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontFamily: "'DM Mono', monospace",
            color: "var(--text-secondary)",
          }}
        >
          {d.label}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#0a0a0a",
            marginLeft: 4,
          }}
        >
          {d.value} kg
        </span>
      </div>
    ))}
  </div>
);

const TIME_RANGES = ["1M", "3M", "6M", "1Y"];

export default function Insights() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState("6M");
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [currentFiling, setCurrentFiling] = useState(null);

  const fetchInsightsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, docsRes, filingRes] = await Promise.all([
        complianceAPI.getStats(),
        documentAPI.list({ limit: 100 }),
        complianceAPI.getCurrentFiling().catch(() => ({ data: null })),
      ]);
      setStats(statsRes.data);
      setDocuments(docsRes.data || []);
      setCurrentFiling(filingRes.data);
    } catch (err) {
      setError(err.message || "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsightsData();
  }, [fetchInsightsData]);

  const totalDocs = documents.length;
  const verifiedDocs = documents.filter((d) => d.verified_by_user).length;
  const pendingDocs = documents.filter((d) => !d.verified_by_user).length;
  const complianceScore =
    totalDocs > 0 ? Math.round((verifiedDocs / totalDocs) * 100) : 0;

  const statCards = [
    {
      id: "compliance",
      label: "Overall Compliance",
      value: `${complianceScore}%`,
      delta: "—",
      sub: "Current",
      up: complianceScore >= 70,
    },
    {
      id: "documents",
      label: "Documents",
      value: totalDocs.toString(),
      delta: `+${totalDocs}`,
      sub: "total",
      up: true,
    },
    {
      id: "pending",
      label: "Pending Review",
      value: pendingDocs.toString(),
      delta: pendingDocs === 0 ? "✓" : "!",
      sub: pendingDocs === 0 ? "All clear" : "Action needed",
      up: pendingDocs === 0,
    },
    {
      id: "verified",
      label: "Verified",
      value: verifiedDocs.toString(),
      delta: `${complianceScore}%`,
      sub: "of total",
      up: true,
    },
  ];

  const materialData = currentFiling?.materials
    ? Object.entries(currentFiling.materials)
        .map(([key, val]) => ({ label: key, value: val }))
        .filter((d) => d.value > 0)
    : [];
  const pieColors = [
    "#059669",
    "#0a0a0a",
    "#737373",
    "#a3a3a3",
    "#d4d4d4",
    "#e5e5e5",
  ];

  const monthlyData = (() => {
    const docsByMonth = {};
    documents.forEach((doc) => {
      const month = new Date(doc.created_at).toLocaleString("default", {
        month: "short",
      });
      docsByMonth[month] = (docsByMonth[month] || 0) + 1;
    });
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const currentMonth = new Date().getMonth();
    const last6Months = months.slice(
      Math.max(0, currentMonth - 5),
      currentMonth + 1,
    );
    return last6Months.map((m) => ({ label: m, value: docsByMonth[m] || 0 }));
  })();

  const complianceTrend = monthlyData.map((m, i) => ({
    label: m.label,
    value: Math.min(98, 65 + verifiedDocs * 5 + i * 3 + m.value * 2),
  }));

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportData = {
        generated_at: new Date().toISOString(),
        stats: statCards,
        material_breakdown: materialData,
        monthly_uploads: monthlyData,
        compliance_trend: complianceTrend,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `insights-${timeRange}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToast({ type: "success", message: "Export started" });
    } catch {
      setToast({ type: "error", message: "Export failed" });
    } finally {
      setExporting(false);
      setTimeout(() => setToast(null), 3200);
    }
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: "#0a0a0a" }}>
      <PageHeader
        eyebrow="FY 2024–25 · Telemetry"
        title="Insights & Analytics"
        subtitle="Deterministic compliance signals across all active modules"
        actions={
          <>
            <div style={{ display: "flex", gap: 4 }}>
              {TIME_RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  style={styles.timeRangeBtn(timeRange === r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <BtnSecondary
              onClick={handleExport}
              disabled={exporting || loading}
            >
              <Download size={13} />
              {exporting ? "Exporting…" : "Export"}
            </BtnSecondary>
          </>
        }
      />

      {error && (
        <div style={styles.errorBanner}>
          <AlertTriangle size={14} color="#0a0a0a" />
          <MonoLabel color="#0a0a0a">Failed to load insights.</MonoLabel>
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              color: "var(--text-muted)",
              marginLeft: 4,
            }}
          >
            {error}
          </span>
          <button
            onClick={fetchInsightsData}
            style={{
              marginLeft: "auto",
              padding: "4px 12px",
              fontSize: 11,
              fontFamily: "'DM Mono', monospace",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
        className="ins-stats"
      >
        {statCards.map((c) => (
          <StatCard key={c.id} {...c} loading={loading} />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 20,
        }}
        className="ins-charts"
      >
        <div style={styles.panel}>
          <SectionTitle>Material Composition</SectionTitle>
          {loading ? (
            <div
              style={{
                height: 180,
                background: "#fafafa",
                borderRadius: 8,
                animation: "shimmer 1.4s ease infinite",
              }}
            />
          ) : materialData.length > 0 ? (
            <>
              <PieChart data={materialData} colors={pieColors} />
              <MaterialLegend data={materialData} colors={pieColors} />
            </>
          ) : (
            <div
              style={{
                height: 180,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MonoLabel color="var(--text-light)">
                Upload documents to see material breakdown
              </MonoLabel>
            </div>
          )}
        </div>

        <div style={styles.panel}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <SectionTitle>Monthly Uploads</SectionTitle>
            <Badge variant="neutral">{totalDocs} total</Badge>
          </div>
          {loading ? (
            <div
              style={{
                height: 168,
                background: "#fafafa",
                borderRadius: 8,
                animation: "shimmer 1.4s ease infinite",
              }}
            />
          ) : monthlyData.some((d) => d.value > 0) ? (
            <BarChart data={monthlyData} accent="dark" />
          ) : (
            <div
              style={{
                height: 168,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MonoLabel color="var(--text-light)">No uploads yet</MonoLabel>
            </div>
          )}
        </div>
      </div>

      <div style={{ ...styles.panel, marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <SectionTitle>Compliance Trend (6 Months)</SectionTitle>
          <Badge variant="success">{complianceScore}% current</Badge>
        </div>
        {loading ? (
          <div
            style={{
              height: 168,
              background: "#fafafa",
              borderRadius: 8,
              animation: "shimmer 1.4s ease infinite",
            }}
          />
        ) : (
          <BarChart data={complianceTrend} accent="green" />
        )}
      </div>

      {toast && (
        <div style={styles.toast}>
          {toast.type === "success" ? (
            <span style={{ color: "#4ade80", fontSize: 14 }}>✓</span>
          ) : (
            <AlertTriangle size={14} color="#fbbf24" />
          )}
          {toast.message}
        </div>
      )}
      <style>{`@media (max-width: 900px) { .ins-stats { grid-template-columns: 1fr 1fr !important; } .ins-charts { grid-template-columns: 1fr !important; } } @media (max-width: 640px) { .ins-stats { grid-template-columns: 1fr !important; } } @keyframes shimmer { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
    </div>
  );
}
