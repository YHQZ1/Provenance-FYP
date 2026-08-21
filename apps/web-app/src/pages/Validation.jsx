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
  CLASSIFIED: "warn",
  REVIEW_PENDING: "warn",
  VERIFIED: "success",
  PENDING: "neutral",
  PROCESSING: "warn",
  OCR_PROCESSING: "warn",
  RAG_PROCESSING: "warn",
  FAILED: "dark",
};
const statusLabel = {
  COMPLETED: "Processed",
  CLASSIFIED: "Needs review",
  REVIEW_PENDING: "Needs review",
  VERIFIED: "Verified",
  PENDING: "Pending",
  PROCESSING: "Processing",
  OCR_PROCESSING: "OCR processing",
  RAG_PROCESSING: "Classification processing",
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
    { key: "PROCESSING", label: "Processing", count: counts.processing },
    { key: "REVIEW", label: "Needs review", count: counts.review },
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
  const [reviewItem, setReviewItem] = useState(null);
  const [reviewMaterial, setReviewMaterial] = useState("");
  const [reviewQuantity, setReviewQuantity] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewDocument, setReviewDocument] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);

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

  const counts = useMemo(() => {
    const processingStatuses = new Set([
      "PENDING",
      "PROCESSING",
      "OCR_PROCESSING",
      "RAG_PROCESSING",
    ]);
    const reviewStatuses = new Set(["CLASSIFIED", "REVIEW_PENDING"]);

    return {
      all: documents.length,
      processing: documents.filter((d) => processingStatuses.has(d.status)).length,
      review: documents.filter(
        (d) => reviewStatuses.has(d.status) || d.requires_human_review,
      ).length,
      verified: documents.filter(
        (d) => d.status === "VERIFIED" || d.verified_by_user,
      ).length,
    };
  }, [documents]);

  const visible = useMemo(() => {
    let rows = viewMode === "documents" ? documents : classifications;
    if (!rows) return [];
    if (viewMode === "documents") {
      if (filter === "PROCESSING") {
        rows = rows.filter((r) =>
          ["PENDING", "PROCESSING", "OCR_PROCESSING", "RAG_PROCESSING"].includes(
            r.status,
          ),
        );
      } else if (filter === "REVIEW") {
        rows = rows.filter(
          (r) =>
            ["CLASSIFIED", "REVIEW_PENDING"].includes(r.status) ||
            r.requires_human_review,
        );
      } else if (filter === "VERIFIED") {
        rows = rows.filter(
          (r) => r.status === "VERIFIED" || r.verified_by_user,
        );
      }
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

  const openReview = async (item) => {
    setReviewItem(item);
    setReviewMaterial(item.material_code || "");
    setReviewQuantity(String(item.quantity_kg ?? ""));
    setReviewNotes("");
    setReviewDocument(null);
    setReviewLoading(true);
    try {
      const response = await documentAPI.getById(item.document_id);
      setReviewDocument(response.data);
    } catch (err) {
      showToast(`Original document unavailable: ${err.message}`, false);
    } finally {
      setReviewLoading(false);
    }
  };

  const closeReview = () => {
    if (reviewSaving) return;
    setReviewItem(null);
    setReviewDocument(null);
  };

  const handleNextReview = () => {
    if (!reviewItem) return;
    const index = visible.findIndex((item) => item.id === reviewItem.id);
    const nextItem = visible[index + 1];
    if (nextItem) openReview(nextItem);
  };

  const handleReviewVerify = async () => {
    if (!reviewItem) return;
    setReviewSaving(true);
    try {
      await feedbackAPI.verify(reviewItem.id, reviewNotes);
      showToast("Review approved");
      const index = visible.findIndex((item) => item.id === reviewItem.id);
      const nextItem = visible[index + 1];
      setReviewSaving(false);
      if (nextItem) openReview(nextItem);
      else closeReview();
      fetchData();
    } catch (err) {
      showToast(`Verification failed: ${err.message}`, false);
    } finally {
      setReviewSaving(false);
    }
  };

  const handleReviewCorrection = async () => {
    if (!reviewItem || !reviewMaterial || !reviewQuantity) {
      showToast("Add a material and quantity before saving a correction", false);
      return;
    }
    setReviewSaving(true);
    try {
      await feedbackAPI.correct(reviewItem.id, {
        corrected_material_code: reviewMaterial,
        corrected_quantity_kg: Number(reviewQuantity),
        feedback_type: "HUMAN_REVIEW",
        notes: reviewNotes,
      });
      showToast("Correction saved and review approved");
      const index = visible.findIndex((item) => item.id === reviewItem.id);
      const nextItem = visible[index + 1];
      setReviewSaving(false);
      if (nextItem) openReview(nextItem);
      else closeReview();
      fetchData();
    } catch (err) {
      showToast(`Correction failed: ${err.message}`, false);
    } finally {
      setReviewSaving(false);
    }
  };

  const handleReviewReject = async () => {
    if (!reviewItem || !reviewNotes.trim()) {
      showToast("Add a note explaining what needs correction", false);
      return;
    }
    setReviewSaving(true);
    try {
      await feedbackAPI.reject(reviewItem.id, reviewNotes);
      showToast("Item returned for correction");
      const index = visible.findIndex((item) => item.id === reviewItem.id);
      const nextItem = visible[index + 1];
      setReviewSaving(false);
      if (nextItem) openReview(nextItem);
      else closeReview();
      fetchData();
    } catch (err) {
      showToast(`Could not return item: ${err.message}`, false);
    } finally {
      setReviewSaving(false);
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
        <StatTile label="Processing" value={counts.processing} variant="warn" />
        <StatTile label="Needs review" value={counts.review} variant="warn" />
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
        <div style={{ marginLeft: "auto" }}>
          <MonoLabel color="#737373">View</MonoLabel>
          <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
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
            Review items ({classifications.length})
          </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 20px",
          padding: "12px 16px",
          marginBottom: 16,
          border: "1px solid #e5e5e5",
          borderRadius: 10,
          background: "#fafafa",
          fontSize: 12,
          color: "#525252",
        }}
      >
        <span><strong>Processing:</strong> still running</span>
        <span><strong>Needs review:</strong> low-confidence classification</span>
        <span><strong>Verified:</strong> ready for reporting</span>
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
                              onClick={() => openReview(item)}
                              style={{
                                padding: "7px 12px",
                                borderRadius: 7,
                                border: "1px solid #d1fae5",
                                cursor: "pointer",
                                background: "#ecfdf5",
                                color: "#047857",
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                              aria-label="Review item"
                            >
                              Review
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

      {reviewItem && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeReview();
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(10,10,10,0.28)",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
            style={{
              width: "min(560px, 100%)",
              height: "100%",
              overflowY: "auto",
              background: "#fff",
              padding: 28,
              boxShadow: "-8px 0 30px rgba(0,0,0,0.12)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div>
                <MonoLabel color="#059669">Human review</MonoLabel>
                <h2
                  id="review-title"
                  style={{ fontSize: 24, margin: "8px 0 6px" }}
                >
                  {reviewItem.document_filename}
                </h2>
                <p style={{ margin: 0, color: "#737373", fontSize: 13 }}>
                  Check the source evidence, then approve or correct the classification.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleNextReview}
                  disabled={!visible[visible.findIndex((item) => item.id === reviewItem.id) + 1]}
                  style={{
                    padding: "8px 11px",
                    border: "1px solid #e5e5e5",
                    borderRadius: 8,
                    background: "#fff",
                    color: "#525252",
                    cursor: "pointer",
                    opacity: visible[visible.findIndex((item) => item.id === reviewItem.id) + 1] ? 1 : 0.45,
                  }}
                >
                  Next item
                </button>
                <button
                  type="button"
                  onClick={closeReview}
                  aria-label="Close review"
                  style={{
                    border: "none",
                    background: "#f5f5f5",
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    cursor: "pointer",
                  }}
                >
                  <X style={{ width: 15, height: 15 }} />
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 14 }}>
                <MonoLabel>Detected material</MonoLabel>
                <strong style={{ display: "block", marginTop: 8, fontSize: 18 }}>
                  {reviewItem.material_code || "Unknown"}
                </strong>
              </div>
              <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 14 }}>
                <MonoLabel>Confidence</MonoLabel>
                <strong style={{ display: "block", marginTop: 8, fontSize: 18 }}>
                  {reviewItem.confidence_score
                    ? `${(reviewItem.confidence_score * 100).toFixed(0)}%`
                    : "Unknown"}
                </strong>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <MonoLabel>Why it was classified</MonoLabel>
              <p
                style={{
                  margin: "8px 0 0",
                  padding: 12,
                  background: "#fafafa",
                  border: "1px solid #e5e5e5",
                  borderRadius: 8,
                  color: "#525252",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {reviewItem.reasoning || "No reasoning was recorded."}
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div>
                <MonoLabel>Original document</MonoLabel>
                <div
                  style={{
                    height: 220,
                    marginTop: 8,
                    border: "1px solid #e5e5e5",
                    borderRadius: 8,
                    background: "#fafafa",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {reviewLoading ? (
                    <MonoLabel color="#a3a3a3">Loading preview…</MonoLabel>
                  ) : reviewDocument?.file_url && reviewDocument.mime_type?.startsWith("image/") ? (
                    <img
                      src={reviewDocument.file_url}
                      alt={`Original ${reviewItem.document_filename}`}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : reviewDocument?.file_url && reviewDocument.mime_type === "application/pdf" ? (
                    <iframe
                      title={`Original ${reviewItem.document_filename}`}
                      src={reviewDocument.file_url}
                      style={{ width: "100%", height: "100%", border: "none" }}
                    />
                  ) : reviewDocument?.file_url ? (
                    <a href={reviewDocument.file_url} target="_blank" rel="noreferrer">
                      Open original document
                    </a>
                  ) : (
                    <MonoLabel color="#a3a3a3">Preview unavailable</MonoLabel>
                  )}
                </div>
              </div>
              <div>
                <MonoLabel>OCR source text</MonoLabel>
                <pre
                  style={{
                    height: 220,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    margin: "8px 0 0",
                    padding: 12,
                    background: "#0a0a0a",
                    color: "#d4d4d4",
                    borderRadius: 8,
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                    lineHeight: 1.6,
                  }}
                >
                  {reviewItem.raw_text || "No OCR text available."}
                </pre>
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid #e5e5e5",
                paddingTop: 20,
                marginTop: 20,
              }}
            >
              <MonoLabel>Review decision</MonoLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginTop: 10,
                }}
              >
                <label style={{ fontSize: 12, color: "#525252" }}>
                  Material code
                  <select
                    value={reviewMaterial}
                    onChange={(event) => setReviewMaterial(event.target.value)}
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: 6,
                      padding: "10px 12px",
                      border: "1px solid #e5e5e5",
                      borderRadius: 8,
                      background: "#fafafa",
                    }}
                  >
                    <option value="">Select material</option>
                    {['PET', 'HDPE', 'PVC', 'LDPE', 'PP', 'PS', 'MLP', 'OTHER'].map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: "#525252" }}>
                  Quantity (kg)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={reviewQuantity}
                    onChange={(event) => setReviewQuantity(event.target.value)}
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: 6,
                      padding: "10px 12px",
                      border: "1px solid #e5e5e5",
                      borderRadius: 8,
                      background: "#fafafa",
                    }}
                  />
                </label>
              </div>
              <label
                style={{ display: "block", marginTop: 14, fontSize: 12, color: "#525252" }}
              >
                Reviewer notes
                <textarea
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  placeholder="Explain why you approved or corrected this item."
                  rows={4}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 6,
                    padding: "10px 12px",
                    border: "1px solid #e5e5e5",
                    borderRadius: 8,
                    background: "#fafafa",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </label>
              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <BtnSecondary
                  onClick={handleReviewReject}
                  disabled={reviewSaving}
                  style={{ color: "#b91c1c", borderColor: "#fecaca" }}
                >
                  Request correction
                </BtnSecondary>
                <BtnSecondary onClick={handleReviewCorrection} disabled={reviewSaving}>
                  {reviewSaving ? "Saving…" : "Save correction"}
                </BtnSecondary>
                <BtnPrimary onClick={handleReviewVerify} disabled={reviewSaving}>
                  {reviewSaving ? "Saving…" : "Approve as detected"}
                </BtnPrimary>
              </div>
            </div>
          </section>
        </div>
      )}

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
