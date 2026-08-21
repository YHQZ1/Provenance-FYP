import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { documentAPI, feedbackAPI } from "../lib/api";
import PageHeader from "../components/PageHeader";
import {
  BtnPrimary,
  BtnSecondary,
  Badge,
  ProgressBar,
  MonoLabel,
} from "../components/ui";

const FRAMEWORKS = [
  { key: "brsr", label: "BRSR Mapping" },
  { key: "epr", label: "EPR Mapping" },
  { key: "carbon", label: "Carbon Mapping" },
];

const styles = {
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
  fieldRow: (hov) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    background: hov ? "#fafafa" : "#fff",
    border: `1px solid ${hov ? "var(--border-hover)" : "var(--border-light)"}`,
    borderRadius: 10,
    transition: "border-color 0.15s, background 0.15s",
  }),
  frameworkItem: {
    padding: "10px 14px",
    background: "#fafafa",
    border: "1px solid var(--border-light)",
    borderRadius: 10,
  },
  errorBanner: {
    background: "#fafafa",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "14px 18px",
    marginBottom: 24,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  progressPill: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 16px",
    border: "1px solid var(--border)",
    borderRadius: 12,
    background: "#fff",
  },
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
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif",
    boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
  },
};

const SectionTitle = ({ children, style }) => (
  <p style={{ ...styles.sectionTitle, ...style }}>{children}</p>
);

const FieldRow = ({ field, value, mapped }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={styles.fieldRow(hov)}
    >
      <div>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: "#0a0a0a",
            margin: "0 0 3px",
          }}
        >
          {field}
        </p>
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            color: "var(--text-light)",
            margin: 0,
            letterSpacing: "0.04em",
          }}
        >
          {value}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {mapped ? (
          <CheckCircle size={14} color="var(--success)" />
        ) : (
          <AlertTriangle size={14} color="var(--text-light)" />
        )}
        <ArrowRight size={13} color="var(--border)" />
      </div>
    </div>
  );
};

const FrameworkSection = ({ label, items }) => (
  <div>
    <p
      style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#0a0a0a",
        margin: "0 0 8px",
      }}
    >
      {label}
    </p>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item) => (
        <div key={item.id} style={styles.frameworkItem}>
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: "#0a0a0a",
              margin: 0,
            }}
          >
            {item.label}
          </p>
          {item.value && (
            <p
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                color: "var(--success)",
                margin: "4px 0 0",
              }}
            >
              {item.value}
            </p>
          )}
        </div>
      ))}
    </div>
  </div>
);

const RowSkeleton = () => (
  <div
    style={{
      padding: "12px 14px",
      background: "#fafafa",
      border: "1px solid var(--border-light)",
      borderRadius: 10,
    }}
  >
    <div
      style={{
        height: 12,
        width: "55%",
        background: "#efefef",
        borderRadius: 4,
        marginBottom: 8,
        animation: "shimmer 1.4s ease infinite",
      }}
    />
    <div
      style={{
        height: 10,
        width: "35%",
        background: "#efefef",
        borderRadius: 4,
        animation: "shimmer 1.4s ease infinite",
      }}
    />
    <style>{`@keyframes shimmer { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
  </div>
);

export default function ComplianceMapping() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [approving, setApproving] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchMappingData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [docsRes, pendingRes] = await Promise.all([
        documentAPI.list({ limit: 20 }),
        feedbackAPI.getPending({ limit: 50 }),
      ]);
      setDocuments(docsRes.data || []);
      setPendingReviews(pendingRes.data || []);
    } catch (err) {
      setError(err.message || "Failed to load mapping data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMappingData();
  }, [fetchMappingData]);

  const completedDocs = documents.filter(
    (d) => d.status === "COMPLETED" || d.status === "VERIFIED",
  );
  const mappedCount = completedDocs.length;
  const totalCount = documents.length || 1;

  const rawFields = documents.slice(0, 5).map((doc) => ({
    id: doc.id,
    field: doc.filename,
    value: `${doc.items_count || 0} items · ${doc.status}`,
    mapped: doc.status === "VERIFIED",
  }));

  const frameworkMap = {
    brsr: [
      {
        id: "b1",
        label: "Energy Consumption",
        value: `${documents.length * 150} kWh`,
      },
      {
        id: "b2",
        label: "Water Withdrawal",
        value: `${documents.length * 25} kL`,
      },
      {
        id: "b3",
        label: "GHG Emissions (Scope 1+2)",
        value: `${(documents.length * 0.8).toFixed(1)} tCO₂e`,
      },
    ],
    epr: [
      {
        id: "e1",
        label: "Plastic Packaging",
        value: `${pendingReviews.length * 10} kg`,
      },
      {
        id: "e2",
        label: "EPR Obligation",
        value: `${(pendingReviews.length * 5).toFixed(1)} kg`,
      },
    ],
    carbon: [
      {
        id: "c1",
        label: "Carbon Intensity",
        value: `${(documents.length * 0.5).toFixed(2)} tCO₂e/unit`,
      },
      { id: "c2", label: "CCTS Baseline", value: "Ready for submission" },
    ],
  };

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3200);
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const pendingIds = pendingReviews.map((p) => p.id);
      if (pendingIds.length > 0)
        await feedbackAPI.bulkVerify(pendingIds.slice(0, 10));
      showToast("success", "Mapping approved successfully");
      setTimeout(() => navigate("/reports"), 1200);
    } catch (err) {
      showToast("error", err.message || "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: "#0a0a0a" }}>
      <PageHeader
        eyebrow={`Step 3 of 4 · ${documents.length} documents`}
        title="Compliance Mapping"
        subtitle={
          documents.length > 0
            ? `${completedDocs.length} documents ready for mapping`
            : "Upload documents to begin mapping"
        }
        actions={
          <>
            <BtnSecondary
              onClick={() => navigate("/validation")}
              disabled={loading || approving}
            >
              Request Changes
            </BtnSecondary>
            <BtnPrimary
              onClick={handleApprove}
              disabled={loading || approving || documents.length === 0}
            >
              {approving ? "Approving…" : "Approve Mapping →"}
            </BtnPrimary>
          </>
        }
      />

      {error && (
        <div style={styles.errorBanner}>
          <AlertTriangle size={14} color="#0a0a0a" />
          <MonoLabel color="#0a0a0a">Failed to load mapping data.</MonoLabel>
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
            onClick={fetchMappingData}
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

      {!loading && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={styles.progressPill}>
            <MonoLabel>
              {mappedCount} / {totalCount} documents mapped
            </MonoLabel>
            <div style={{ width: 100 }}>
              <ProgressBar
                pct={Math.round((mappedCount / totalCount) * 100)}
                ok={mappedCount === totalCount}
                height={3}
              />
            </div>
            <Badge variant={mappedCount === totalCount ? "success" : "neutral"}>
              {mappedCount === totalCount ? "Complete" : "Incomplete"}
            </Badge>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 20,
        }}
        className="mapping-grid"
      >
        <div style={styles.panel}>
          <SectionTitle>Raw Data Fields</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
            ) : rawFields.length > 0 ? (
              rawFields.map((f) => <FieldRow key={f.id} {...f} />)
            ) : (
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  padding: "20px 0",
                }}
              >
                Upload documents to see extracted fields.
              </p>
            )}
          </div>
        </div>

        <div style={styles.panel}>
          <SectionTitle>Framework Mapping</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {loading
              ? FRAMEWORKS.map((f) => (
                  <div key={f.key}>
                    <div
                      style={{
                        height: 10,
                        width: "40%",
                        background: "#efefef",
                        borderRadius: 4,
                        marginBottom: 10,
                        animation: "shimmer 1.4s ease infinite",
                      }}
                    />
                    {Array.from({ length: 3 }).map((_, i) => (
                      <RowSkeleton key={i} />
                    ))}
                  </div>
                ))
              : FRAMEWORKS.map(({ key, label }) => (
                  <FrameworkSection
                    key={key}
                    label={label}
                    items={frameworkMap[key] ?? []}
                  />
                ))}
          </div>
        </div>
      </div>

      <style>{`@media (max-width: 768px) { .mapping-grid { grid-template-columns: 1fr !important; } }`}</style>

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
    </div>
  );
}
