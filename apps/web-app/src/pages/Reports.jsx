/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  AlertTriangle,
  Info,
  Download,
  RefreshCw,
  Pencil,
} from "lucide-react";
import { complianceAPI, documentAPI } from "../lib/api";
import PageHeader from "../components/PageHeader";
import {
  BtnPrimary,
  BtnSecondary,
  Badge,
  ProgressBar,
  MonoLabel,
} from "../components/ui";

const PIPELINE_STEPS = ["Parsing", "Mapping", "Calculation", "Report Creation"];

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
  tabBar: {
    display: "flex",
    gap: 4,
    background: "#f5f5f5",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: (active) => ({
    flex: 1,
    padding: "9px 16px",
    borderRadius: 10,
    border: active ? "1px solid var(--border)" : "1px solid transparent",
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    background: active ? "#fff" : "transparent",
    color: active ? "#0a0a0a" : "var(--text-muted)",
    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
    transition: "background 0.15s, color 0.15s",
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

const PipelineStatus = ({ currentStep, status }) => (
  <div style={{ ...styles.panel, marginBottom: 20 }}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
      }}
    >
      <SectionTitle>Processing Pipeline</SectionTitle>
      <Badge variant={currentStep >= 3 ? "success" : "neutral"}>{status}</Badge>
    </div>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        flexWrap: "wrap",
        rowGap: 12,
      }}
    >
      {PIPELINE_STEPS.map((step, i) => (
        <div key={step} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {i <= currentStep ? (
              <CheckCircle size={15} color="var(--success)" />
            ) : i === currentStep + 1 ? (
              <div
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: "50%",
                  border: "2px solid var(--border)",
                  borderTopColor: "var(--success)",
                  animation: "spin 0.7s linear infinite",
                }}
              />
            ) : (
              <div
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: "50%",
                  border: "2px solid var(--border)",
                }}
              />
            )}
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                color: i <= currentStep ? "#0a0a0a" : "var(--text-light)",
              }}
            >
              {step}
            </span>
          </div>
          {i < PIPELINE_STEPS.length - 1 && (
            <div
              style={{
                width: 32,
                height: 1,
                background:
                  i < currentStep ? "var(--success)" : "var(--border)",
                margin: "0 12px",
              }}
            />
          )}
        </div>
      ))}
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const SummaryCard = ({ label, value, sub, ok, loading }) => {
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
          color:
            ok === true
              ? "var(--success)"
              : ok === false
                ? "#0a0a0a"
                : "var(--text-muted)",
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        {sub}
      </p>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    Compliant: { variant: "success", label: "Compliant" },
    "Action Req": { variant: "dark", label: "Action Req" },
    Pending: { variant: "neutral", label: "Pending" },
  };
  const { variant, label } = map[status] ?? {
    variant: "neutral",
    label: status,
  };
  return <Badge variant={variant}>{label}</Badge>;
};

const TableRow = ({ metric, value, status }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "14px 20px",
        borderBottom: "1px solid var(--border-light)",
        background: hov ? "#fafafa" : "#fff",
        transition: "background 0.15s",
      }}
    >
      <span
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          fontWeight: 500,
          color: "#0a0a0a",
          flex: 2,
        }}
      >
        {metric}
      </span>
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 12,
          color: "var(--text-secondary)",
          flex: 1,
        }}
      >
        {value}
      </span>
      <span style={{ flex: 1 }}>
        <StatusBadge status={status} />
      </span>
    </div>
  );
};

const WarningItem = ({ message, severity }) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      padding: "14px 16px",
      borderRadius: 12,
      border: `1px solid ${severity === "warning" ? "var(--border)" : "var(--border-light)"}`,
      background: severity === "warning" ? "#fafafa" : "#fff",
    }}
  >
    {severity === "warning" ? (
      <AlertTriangle
        size={14}
        color="var(--text-light)"
        style={{ marginTop: 1, flexShrink: 0 }}
      />
    ) : (
      <Info
        size={14}
        color="var(--success)"
        style={{ marginTop: 1, flexShrink: 0 }}
      />
    )}
    <p
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13,
        color: "#0a0a0a",
        lineHeight: 1.6,
        margin: 0,
      }}
    >
      {message}
    </p>
  </div>
);

export default function Reports() {
  const navigate = useNavigate();
  const TABS = [
    { id: "summary", label: "Summary" },
    { id: "tables", label: "KPI Table" },
    { id: "warnings", label: null },
  ];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [toast, setToast] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [stats, setStats] = useState(null);
  const [currentFiling, setCurrentFiling] = useState(null);
  const [documents, setDocuments] = useState([]);

  const fetchReportData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, filingRes, docsRes] = await Promise.all([
        complianceAPI.getStats(),
        complianceAPI.getCurrentFiling().catch(() => ({ data: null })),
        documentAPI.list({ limit: 100 }),
      ]);
      setStats(statsRes.data);
      setCurrentFiling(filingRes.data);
      setDocuments(docsRes.data || []);
    } catch (err) {
      setError(err.message || "Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const currentYear = new Date().getFullYear();
  const fy = currentFiling?.year
    ? `FY ${currentFiling.year}-${(currentFiling.year + 1).toString().slice(-2)}`
    : `FY ${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
  const totalDocs = documents.length;
  const verifiedDocs = documents.filter((d) => d.verified_by_user).length;
  const pendingDocs = documents.filter((d) => !d.verified_by_user).length;

  const pipelineStep = 3;
  const pipelineStatus = "Ready for Report";

  const summaryCards = [
    {
      id: "documents",
      label: "Documents Processed",
      value: totalDocs.toString(),
      sub: `${verifiedDocs} verified`,
      ok: totalDocs > 0,
    },
    {
      id: "compliance",
      label: "Compliance Score",
      value:
        totalDocs > 0
          ? `${Math.round((verifiedDocs / totalDocs) * 100)}%`
          : "—",
      sub: verifiedDocs === totalDocs ? "Ready for filing" : "Pending review",
      ok: verifiedDocs === totalDocs,
    },
    {
      id: "pending",
      label: "Pending Actions",
      value: pendingDocs.toString(),
      sub: pendingDocs === 0 ? "All clear" : "Review required",
      ok: pendingDocs === 0,
    },
  ];

  const progressItems = currentFiling?.materials
    ? Object.entries(currentFiling.materials).map(([key, val]) => ({
        id: key,
        label: key,
        pct: Math.min(100, Math.round((val / 1000) * 100)),
        ok: val > 0,
      }))
    : [];
  const tableRows = [
    {
      id: "r1",
      metric: "Documents Uploaded",
      value: totalDocs.toString(),
      status: totalDocs > 0 ? "Compliant" : "Pending",
    },
    {
      id: "r2",
      metric: "Documents Verified",
      value: verifiedDocs.toString(),
      status: verifiedDocs > 0 ? "Compliant" : "Pending",
    },
    {
      id: "r3",
      metric: "Pending Review",
      value: pendingDocs.toString(),
      status: pendingDocs === 0 ? "Compliant" : "Action Req",
    },
    {
      id: "r4",
      metric: "Current Quarter",
      value: currentFiling?.quarter || "—",
      status: currentFiling ? "Compliant" : "Pending",
    },
  ];

  const warnings = [];
  if (pendingDocs > 0)
    warnings.push({
      id: "w1",
      message: `${pendingDocs} document(s) pending review.`,
      severity: "warning",
    });
  if (!currentFiling)
    warnings.push({
      id: "w2",
      message: "No active filing period found.",
      severity: "warning",
    });
  if (totalDocs === 0)
    warnings.push({
      id: "w3",
      message: "No documents uploaded yet.",
      severity: "info",
    });

  const tabs = TABS.map((t) =>
    t.id === "warnings" ? { ...t, label: `Warnings (${warnings.length})` } : t,
  );

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };
  const handleApprove = async () => {
    if (approved) return;
    setApproving(true);
    try {
      if (currentFiling?.id) await complianceAPI.submitFiling(currentFiling.id);
      setApproved(true);
      showToast("success", "Report approved and submitted");
    } catch (err) {
      showToast("error", err.message || "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const reportData = {
        generated_at: new Date().toISOString(),
        fy,
        documents: {
          total: totalDocs,
          verified: verifiedDocs,
          pending: pendingDocs,
        },
        summary: summaryCards,
        table_rows: tableRows,
        materials: currentFiling?.materials || {},
        pipeline_status: pipelineStatus,
      };
      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-report-${fy.replace(/\s/g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("success", "Report downloaded");
    } catch {
      showToast("error", "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: "#0a0a0a" }}>
      <PageHeader
        eyebrow={fy}
        title="Compliance Report"
        subtitle="Review, verify, and finalise your generated filing"
        actions={
          <>
            <BtnSecondary
              onClick={handleDownload}
              disabled={downloading || loading}
            >
              <Download size={13} />
              {downloading ? "Downloading…" : "Download"}
            </BtnSecondary>
            <BtnPrimary
              onClick={handleApprove}
              disabled={approving || approved || loading || totalDocs === 0}
            >
              {approved ? (
                <>
                  <CheckCircle size={13} /> Approved
                </>
              ) : approving ? (
                "Approving…"
              ) : (
                "Approve & Submit"
              )}
            </BtnPrimary>
          </>
        }
      />

      {error && (
        <div style={styles.errorBanner}>
          <AlertTriangle size={14} color="#0a0a0a" />
          <MonoLabel color="#0a0a0a">Failed to load report.</MonoLabel>
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
            onClick={fetchReportData}
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

      <PipelineStatus currentStep={pipelineStep} status={pipelineStatus} />

      <div style={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={styles.tab(activeTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "summary" && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
              marginBottom: 20,
            }}
            className="rep-summary"
          >
            {summaryCards.map((c) => (
              <SummaryCard key={c.id} {...c} loading={loading} />
            ))}
          </div>
          <div style={styles.panel}>
            <SectionTitle>Overall Acquisition Progress</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {loading ? (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    textAlign: "center",
                    padding: "20px 0",
                  }}
                >
                  Loading...
                </p>
              ) : progressItems.length > 0 ? (
                progressItems.map((item) => (
                  <div key={item.id}>
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
                        {item.label}
                      </span>
                      <span
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 12,
                          fontWeight: 600,
                          color: item.ok ? "var(--success)" : "#0a0a0a",
                        }}
                      >
                        {item.pct}%
                      </span>
                    </div>
                    <ProgressBar pct={item.pct} ok={item.ok} height={3} />
                  </div>
                ))
              ) : (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    textAlign: "center",
                    padding: "20px 0",
                  }}
                >
                  Upload documents to see material breakdown.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "tables" && (
        <div style={{ ...styles.panel, padding: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 20px",
              borderBottom: "1px solid var(--border-light)",
              background: "#fafafa",
            }}
          >
            {["Metric", "Reported Value", "Status"].map((h, i) => (
              <span
                key={h}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  flex: i === 0 ? 2 : 1,
                }}
              >
                {h}
              </span>
            ))}
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <MonoLabel color="var(--text-light)">Loading...</MonoLabel>
            </div>
          ) : (
            tableRows.map((row) => <TableRow key={row.id} {...row} />)
          )}
        </div>
      )}

      {activeTab === "warnings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {warnings.length > 0 ? (
            warnings.map((w) => <WarningItem key={w.id} {...w} />)
          ) : (
            <div style={{ ...styles.panel, textAlign: "center", padding: 40 }}>
              <CheckCircle
                size={24}
                color="var(--success)"
                style={{ marginBottom: 12 }}
              />
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                No warnings. All systems nominal.
              </p>
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 32,
          paddingTop: 24,
          borderTop: "1px solid var(--border)",
        }}
      >
        <BtnSecondary onClick={() => navigate("/mapping")}>
          <Pencil size={13} /> Edit Mapping
        </BtnSecondary>
        <BtnSecondary onClick={fetchReportData}>
          <RefreshCw size={13} /> Regenerate
        </BtnSecondary>
        <BtnSecondary onClick={handleDownload} disabled={downloading}>
          <Download size={13} /> {downloading ? "Downloading…" : "Download"}
        </BtnSecondary>
        <BtnPrimary onClick={handleApprove} disabled={approving || approved}>
          {approved ? (
            <>
              <CheckCircle size={13} /> Approved
            </>
          ) : approving ? (
            "Approving…"
          ) : (
            "Approve & Submit"
          )}
        </BtnPrimary>
      </div>

      {toast && (
        <div style={styles.toast}>
          {toast.type === "success" ? (
            <CheckCircle size={14} color="#4ade80" />
          ) : (
            <AlertTriangle size={14} color="#fbbf24" />
          )}
          {toast.message}
        </div>
      )}
      <style>{`@media (max-width: 900px) { .rep-summary { grid-template-columns: 1fr 1fr !important; } } @media (max-width: 640px) { .rep-summary { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
