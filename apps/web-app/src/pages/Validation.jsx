import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Upload,
  CheckSquare,
  ChevronUp,
  ChevronDown,
  X
} from "lucide-react";
import { documentAPI, feedbackAPI } from "../lib/api";
import PageHeader from "../components/PageHeader";
import {
  BtnPrimary,
  BtnSecondary,
  Badge,
  MonoLabel,
  Toast,
} from "../components/ui";

const statusVariant = {
  COMPLETED: "ok",
  VERIFIED: "success",
  PENDING: "neutral",
  PROCESSING: "warn",
  FAILED: "dark",
};
const statusLabel = {
  COMPLETED: "Completed",
  VERIFIED: "Verified",
  PENDING: "Pending",
  PROCESSING: "Processing",
  FAILED: "Failed",
};

const StatTile = ({ label, value, variant }) => {
  const colors = {
    ok: { num: "#059669", bg: "#ecfdf5" },
    warn: { num: "#0a0a0a", bg: "#f5f5f5" },
    neutral: { num: "#0a0a0a", bg: "#f5f5f5" },
  };
  const c = colors[variant] ?? colors.neutral;
  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        padding: "18px 22px",
        background: c.bg,
        flex: 1,
      }}
    >
      <MonoLabel>{label}</MonoLabel>
      <p
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: c.num,
          margin: "10px 0 0",
        }}
      >
        {value}
      </p>
    </div>
  );
};

const SortIcon = ({ direction }) => {
  if (!direction)
    return <ChevronUp style={{ width: 12, height: 12, color: "#d4d4d4" }} />;
  return direction === "asc" ? (
    <ChevronUp style={{ width: 12, height: 12, color: "#0a0a0a" }} />
  ) : (
    <ChevronDown style={{ width: 12, height: 12, color: "#0a0a0a" }} />
  );
};

const FilterBar = ({ active, onChange, counts }) => {
  const filters = [
    { key: "all", label: "All", count: counts.all },
    { key: "PENDING", label: "Pending", count: counts.pending },
    { key: "COMPLETED", label: "Completed", count: counts.completed },
    { key: "VERIFIED", label: "Verified", count: counts.verified },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        background: "#f5f5f5",
        borderRadius: 10,
        width: "fit-content",
      }}
    >
      {filters.map(({ key, label, count }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            borderRadius: 8,
            border: "none",
            background: active === key ? "#fff" : "transparent",
            color: active === key ? "#0a0a0a" : "#737373",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            boxShadow: active === key ? "0 1px 3px rgba(0,0,0,0.07)" : "none",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {label}
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              fontWeight: 600,
              padding: "1px 6px",
              borderRadius: 4,
              background: active === key ? "#f5f5f5" : "transparent",
              color: active === key ? "#0a0a0a" : "#a3a3a3",
            }}
          >
            {count}
          </span>
        </button>
      ))}
    </div>
  );
};

export default function DataValidation() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [selected, setSelected] = useState(new Set());
  const [toast, setToast] = useState({ visible: false, message: "", ok: true });
  const [viewMode, setViewMode] = useState("documents");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [docsRes, pendingRes] = await Promise.all([
        documentAPI.list({ limit: 100 }),
        feedbackAPI.getPending({ limit: 100 }),
      ]);
      setDocuments(docsRes.data || []);
      setClassifications(pendingRes.data || []);
    } catch (err) {
      showToast(err.message || "Failed to load data", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const counts = useMemo(
    () => ({
      all: documents.length,
      pending: documents.filter(
        (d) => d.status === "PENDING" || d.status === "PROCESSING",
      ).length,
      completed: documents.filter((d) => d.status === "COMPLETED").length,
      verified: documents.filter((d) => d.status === "VERIFIED").length,
    }),
    [documents],
  );

  const visible = useMemo(() => {
    let rows = viewMode === "documents" ? documents : classifications;
    if (!rows) return [];
    if (viewMode === "documents") {
      rows = filter === "all" ? rows : rows.filter((r) => r.status === filter);
    }
    if (sortCol) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortCol],
          bv = b[sortCol];
        const cmp =
          typeof av === "number"
            ? av - bv
            : String(av || "").localeCompare(String(bv || ""));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [documents, classifications, viewMode, filter, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const showToast = (msg, ok = true) => {
    setToast({ visible: true, message: msg, ok });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  };

  const handleVerify = async (classificationId) => {
    try {
      await feedbackAPI.verify(classificationId);
      showToast("Classification verified");
      fetchData();
    } catch (err) {
      showToast(`Verification failed: ${err.message}`, false);
    }
  };

  const handleBulkVerify = async () => {
    const ids = [...selected];
    if (!ids.length) {
      showToast("No items selected", false);
      return;
    }
    setApproving(true);
    try {
      await feedbackAPI.bulkVerify(ids);
      showToast(`${ids.length} items verified`);
      setSelected(new Set());
      fetchData();
    } catch (err) {
      showToast(`Bulk verify failed: ${err.message}`, false);
    } finally {
      setApproving(false);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!confirm("Delete this document permanently?")) return;
    try {
      await documentAPI.delete(documentId);
      showToast("Document deleted", true);
      fetchData();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, false);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allSelected =
    visible.length > 0 && visible.every((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visible.map((r) => r.id)));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: "#0a0a0a" }}>
      <PageHeader
        eyebrow="Step 2 of 4"
        title="Data Validation"
        subtitle="Review and verify extracted data before processing"
        actions={
          <>
            <BtnSecondary onClick={() => navigate("/upload")}>
              <Upload style={{ width: 14, height: 14 }} />
              Upload More
            </BtnSecondary>
            <BtnSecondary onClick={fetchData} disabled={loading}>
              Refresh
            </BtnSecondary>
            <BtnPrimary
              onClick={handleBulkVerify}
              disabled={approving || selected.size === 0}
            >
              <CheckSquare style={{ width: 14, height: 14 }} />
              {approving ? "Verifying…" : `Verify ${selected.size}`}
            </BtnPrimary>
          </>
        }
      />

      <div
        style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}
      >
        <StatTile label="Total" value={counts.all} variant="neutral" />
        <StatTile label="Pending" value={counts.pending} variant="warn" />
        <StatTile label="Completed" value={counts.completed} variant="ok" />
        <StatTile label="Verified" value={counts.verified} variant="ok" />
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <FilterBar active={filter} onChange={setFilter} counts={counts} />
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          <button
            onClick={() => setViewMode("documents")}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "none",
              background: viewMode === "documents" ? "#0a0a0a" : "#f5f5f5",
              color: viewMode === "documents" ? "#fff" : "#737373",
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Documents
          </button>
          <button
            onClick={() => setViewMode("classifications")}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "none",
              background:
                viewMode === "classifications" ? "#0a0a0a" : "#f5f5f5",
              color: viewMode === "classifications" ? "#fff" : "#737373",
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Classifications ({classifications.length})
          </button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 14,
          background: "#fff",
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <MonoLabel color="#a3a3a3">Loading records…</MonoLabel>
          </div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <MonoLabel color="#d4d4d4">No records match this filter</MonoLabel>
            <p style={{ fontSize: 12, color: "#a3a3a3", marginTop: 8 }}>
              Upload documents to get started.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                minWidth: 640,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#fafafa",
                    borderBottom: "1px solid #e5e5e5",
                  }}
                >
                  <th style={{ padding: "11px 16px", width: 40 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      style={{ cursor: "pointer", accentColor: "#059669" }}
                    />
                  </th>
                  {viewMode === "documents" ? (
                    <>
                      <th
                        onClick={() => toggleSort("filename")}
                        style={{
                          padding: "11px 16px",
                          textAlign: "left",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 10,
                          fontWeight: 500,
                          color: sortCol === "filename" ? "#0a0a0a" : "#737373",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          Filename
                          <SortIcon
                            direction={sortCol === "filename" ? sortDir : null}
                          />
                        </span>
                      </th>
                      <th
                        onClick={() => toggleSort("status")}
                        style={{
                          padding: "11px 16px",
                          textAlign: "left",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 10,
                          fontWeight: 500,
                          color: sortCol === "status" ? "#0a0a0a" : "#737373",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          Status
                          <SortIcon
                            direction={sortCol === "status" ? sortDir : null}
                          />
                        </span>
                      </th>
                      <th
                        onClick={() => toggleSort("created_at")}
                        style={{
                          padding: "11px 16px",
                          textAlign: "left",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 10,
                          fontWeight: 500,
                          color:
                            sortCol === "created_at" ? "#0a0a0a" : "#737373",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          Uploaded
                          <SortIcon
                            direction={
                              sortCol === "created_at" ? sortDir : null
                            }
                          />
                        </span>
                      </th>
                    </>
                  ) : (
                    <>
                      <th
                        style={{
                          padding: "11px 16px",
                          textAlign: "left",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 10,
                          fontWeight: 500,
                          color: "#737373",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        Document
                      </th>
                      <th
                        style={{
                          padding: "11px 16px",
                          textAlign: "left",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 10,
                          fontWeight: 500,
                          color: "#737373",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        Material
                      </th>
                      <th
                        style={{
                          padding: "11px 16px",
                          textAlign: "left",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 10,
                          fontWeight: 500,
                          color: "#737373",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        Quantity (kg)
                      </th>
                      <th
                        style={{
                          padding: "11px 16px",
                          textAlign: "left",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 10,
                          fontWeight: 500,
                          color: "#737373",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        Confidence
                      </th>
                    </>
                  )}
                  <th
                    style={{
                      padding: "11px 16px",
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 10,
                      color: "#737373",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item, i) => {
                  const isSel = selected.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom:
                          i === visible.length - 1
                            ? "none"
                            : "1px solid #f5f5f5",
                        background: isSel ? "#f9fffe" : "#fff",
                        transition: "background 0.15s",
                      }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelect(item.id)}
                          style={{ cursor: "pointer", accentColor: "#059669" }}
                        />
                      </td>
                      {viewMode === "documents" ? (
                        <>
                          <td style={{ padding: "12px 16px", maxWidth: 200 }}>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: "#0a0a0a",
                              }}
                            >
                              {item.filename}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <Badge
                              variant={statusVariant[item.status] ?? "neutral"}
                            >
                              {statusLabel[item.status] ?? item.status}
                            </Badge>
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 11,
                              color: "#737373",
                            }}
                          >
                            {formatDate(item.created_at)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: "12px 16px", maxWidth: 150 }}>
                            <span style={{ fontSize: 12, color: "#525252" }}>
                              {item.document_filename || item.document_id}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: "#0a0a0a",
                              }}
                            >
                              {item.material_code ||
                                item.material_name ||
                                "Unknown"}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 12,
                              color: "#0a0a0a",
                            }}
                          >
                            {item.quantity_kg?.toFixed(2) || "0.00"}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 11,
                              color: "#737373",
                            }}
                          >
                            {item.confidence_score
                              ? `${(item.confidence_score * 100).toFixed(0)}%`
                              : "—"}
                          </td>
                        </>
                      )}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {viewMode === "classifications" && (
                            <button
                              onClick={() => handleVerify(item.id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                border: "none",
                                cursor: "pointer",
                                background: "transparent",
                                color: "var(--success)",
                              }}
                              aria-label="Verify"
                            >
                              <Check style={{ width: 14, height: 14 }} />
                            </button>
                          )}
                          {viewMode === "documents" && (
                            <button
                              onClick={() => handleDeleteDocument(item.id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                border: "none",
                                cursor: "pointer",
                                background: "transparent",
                                color: "var(--error)",
                              }}
                              aria-label="Delete"
                            >
                              <X style={{ width: 14, height: 14 }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Toast
        visible={toast.visible}
        message={toast.message}
        icon={
          <CheckSquare
            style={{
              width: 15,
              height: 15,
              color: toast.ok ? "#059669" : "#e5e5e5",
            }}
          />
        }
      />
    </div>
  );
}
