/* eslint-disable no-unused-vars */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  FileText,
  Truck,
  Recycle,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { documentAPI } from "../lib/api";
import PageHeader from "../components/PageHeader";
import {
  BtnPrimary,
  BtnSecondary,
  Badge,
  MonoLabel,
  Toast,
} from "../components/ui";

const TABS = [
  {
    id: "gst",
    label: "GST Invoices",
    icon: FileText,
    hint: "Upload your GST purchase register exports. Provenance maps each line item to the correct EPR category.",
  },
  {
    id: "utility",
    label: "Utility Bills",
    icon: FileText,
    hint: "Monthly electricity, gas, and water bills. Used to compute Scope 2 and Scope 3 emissions.",
  },
  {
    id: "shipment",
    label: "Shipment Logs",
    icon: Truck,
    hint: "Outbound shipment manifests or logistics reports. Used for transport emission factors.",
  },
  {
    id: "plastic",
    label: "Plastic Records",
    icon: Recycle,
    hint: "Plastic packaging weight records by SKU. Drives quarterly PWM liability calculations.",
  },
];

const ACCEPTED = ".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.tiff";
const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const styles = {
  container: { fontFamily: "'DM Sans', sans-serif", color: "#0a0a0a" },
  tabBar: {
    display: "flex",
    gap: 2,
    padding: 4,
    background: "#f5f5f5",
    borderRadius: 10,
    width: "fit-content",
  },
  tabButton: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    background: active ? "#fff" : "transparent",
    color: active ? "#0a0a0a" : "var(--text-muted)",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.07)" : "none",
    transition: "background 0.15s, color 0.15s",
  }),
  dropZone: (isDragOver) => ({
    border: `1.5px dashed ${isDragOver ? "var(--success)" : "var(--border)"}`,
    borderRadius: 14,
    padding: "52px 32px",
    textAlign: "center",
    background: isDragOver ? "var(--success-bg)" : "#fafafa",
    transition: "border-color 0.2s, background 0.2s",
  }),
  hintBox: {
    border: "1px solid var(--border-light)",
    borderRadius: 12,
    padding: "14px 16px",
    background: "#fafafa",
  },
  fileQueue: {
    border: "1px solid var(--border)",
    borderRadius: 14,
    background: "#fff",
    overflow: "hidden",
    minHeight: 220,
  },
  queueHeader: {
    padding: "13px 18px",
    borderBottom: "1px solid var(--border-light)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#fafafa",
  },
  fileRow: (hov, hasError) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "11px 14px",
    borderRadius: 10,
    background: hov ? "#fafafa" : "#fff",
    border: `1px solid ${hasError ? "var(--border)" : "var(--border-light)"}`,
    transition: "background 0.15s",
    gap: 12,
  }),
  summaryPill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    border: "1px solid var(--border)",
    borderRadius: 10,
    background: "#fafafa",
  },
};

const fmtSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const fileExt = (name) => name.split(".").pop().toLowerCase();

const validateFile = (file) => {
  if (file.size > MAX_BYTES) return `Exceeds ${MAX_MB} MB limit`;
  const allowed = ["csv", "xlsx", "xls", "pdf", "jpg", "jpeg", "png", "tiff"];
  if (!allowed.includes(fileExt(file.name))) return "Unsupported file type";
  return null;
};

const TabBar = ({ active, onChange }) => (
  <div style={styles.tabBar}>
    {TABS.map(({ id, label, icon: Icon }) => (
      <button
        key={id}
        onClick={() => onChange(id)}
        style={styles.tabButton(active === id)}
      >
        <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
        {label}
      </button>
    ))}
  </div>
);

const DropZone = ({
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onSelect,
}) => (
  <div
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
    style={styles.dropZone(isDragOver)}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: isDragOver ? "#dcfce7" : "#f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 16px",
        transition: "background 0.2s",
      }}
    >
      <Upload
        style={{
          width: 20,
          height: 20,
          color: isDragOver ? "var(--success)" : "var(--text-light)",
        }}
      />
    </div>
    <p
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 15,
        fontWeight: 500,
        color: "#0a0a0a",
        margin: "0 0 6px",
      }}
    >
      Drop files here or{" "}
      <label
        htmlFor="file-upload"
        style={{
          color: "var(--success)",
          cursor: "pointer",
          textDecoration: "underline",
          textDecorationStyle: "dotted",
        }}
      >
        browse
      </label>
    </p>
    <MonoLabel color="var(--text-light)">
      CSV · XLSX · XLS · PDF · max {MAX_MB} MB each
    </MonoLabel>
    <input
      type="file"
      id="file-upload"
      multiple
      accept={ACCEPTED}
      onChange={onSelect}
      style={{ display: "none" }}
    />
  </div>
);

const FileRow = ({ file, onRemove, uploading }) => {
  const [hov, setHov] = useState(false);
  const hasError = !!file.error;
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={styles.fileRow(hov, hasError)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            flexShrink: 0,
            background: hasError
              ? "#0a0a0a"
              : uploading || file.status === "uploading"
                ? "var(--text-light)"
                : "var(--success)",
            transition: "background 0.2s",
          }}
        />
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
            {file.name}
          </p>
          <p
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: hasError ? "#0a0a0a" : "var(--text-light)",
              margin: "3px 0 0",
              letterSpacing: "0.04em",
            }}
          >
            {hasError ? file.error : fmtSize(file.size)}
          </p>
        </div>
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
      >
        <Badge
          variant={
            hasError
              ? "warn"
              : uploading || file.status === "uploading"
                ? "neutral"
                : "ok"
          }
        >
          {hasError
            ? "Invalid"
            : uploading || file.status === "uploading"
              ? "Uploading"
              : "Ready"}
        </Badge>
        {!uploading && (
          <button
            onClick={() => onRemove(file.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: hov ? "#0a0a0a" : "var(--border)",
              lineHeight: 1,
              padding: "2px 4px",
              fontSize: 16,
              transition: "color 0.15s",
            }}
            aria-label={`Remove ${file.name}`}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>
    </div>
  );
};

export default function UploadData() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("gst");
  const [files, setFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadingFileId, setUploadingFileId] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: "", ok: true });

  const addFiles = useCallback(
    (rawFiles) => {
      const next = Array.from(rawFiles).map((f, i) => {
        const err = validateFile(f);
        return {
          id: `${Date.now()}-${i}`,
          name: f.name,
          size: f.size,
          raw: f,
          status: err ? "error" : "ready",
          error: err ?? null,
          tab: activeTab,
        };
      });
      setFiles((prev) => [...prev, ...next]);
    },
    [activeTab],
  );

  const removeFile = (id) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));
  const clearAll = () => setFiles([]);
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );
  const handleSelect = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const showToast = (message, ok = true) => {
    setToast({ visible: true, message, ok });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  };

  const uploadSingleFile = async (file) => {
    setUploadingFileId(file.id);
    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, status: "uploading" } : f)),
    );
    try {
      await documentAPI.upload(file.raw);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      return true;
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, status: "error", error: err.message } : f,
        ),
      );
      return false;
    } finally {
      setUploadingFileId(null);
    }
  };

  const handleProcess = async () => {
    const readyFiles = files.filter((f) => f.status === "ready");
    if (!readyFiles.length) return;
    setProcessing(true);
    let successCount = 0;
    try {
      for (const file of readyFiles) {
        const success = await uploadSingleFile(file);
        if (success) successCount++;
      }
      if (successCount > 0) {
        showToast(
          `${successCount} file${successCount > 1 ? "s" : ""} uploaded successfully`,
        );
        setTimeout(() => navigate("/validation"), 1500);
      }
    } catch (err) {
      showToast(`Upload failed: ${err.message}`, false);
    } finally {
      setProcessing(false);
    }
  };

  const tabFiles = files.filter((f) => f.tab === activeTab);
  const readyCount = files.filter((f) => f.status === "ready").length;
  const currentTabHint = TABS.find((t) => t.id === activeTab)?.hint || "";

  return (
    <div style={styles.container}>
      <PageHeader
        eyebrow="Step 1 of 4"
        title="Upload Data"
        subtitle={`CSV, XLSX, PDF · Max ${MAX_MB} MB per file`}
      />

      <div style={{ marginBottom: 24 }}>
        <TabBar active={activeTab} onChange={setActiveTab} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          alignItems: "start",
          marginBottom: 24,
        }}
        className="upload-grid"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <DropZone
            isDragOver={isDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onSelect={handleSelect}
          />
          <div style={styles.hintBox}>
            <MonoLabel color="#0a0a0a">
              {TABS.find((t) => t.id === activeTab)?.label}
            </MonoLabel>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                color: "var(--text-muted)",
                margin: "8px 0 0",
                lineHeight: 1.5,
              }}
            >
              {currentTabHint}
            </p>
          </div>
        </div>

        <div style={styles.fileQueue}>
          <div style={styles.queueHeader}>
            <MonoLabel>
              {tabFiles.length > 0
                ? `${tabFiles.length} file${tabFiles.length > 1 ? "s" : ""} queued`
                : "No files yet"}
            </MonoLabel>
            {tabFiles.length > 0 && !processing && (
              <button
                onClick={clearAll}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
                className="hover:text-[#0a0a0a]"
              >
                Clear All
              </button>
            )}
          </div>
          {tabFiles.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 160,
                flexDirection: "column",
                gap: 8,
              }}
            >
              <MonoLabel color="var(--border)">
                Drop files to add them
              </MonoLabel>
            </div>
          ) : (
            <div
              style={{
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 340,
                overflowY: "auto",
              }}
            >
              {tabFiles.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  onRemove={removeFile}
                  uploading={uploadingFileId === f.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {files.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          {TABS.map(({ id, label }) => {
            const count = files.filter((f) => f.tab === id).length;
            if (!count) return null;
            return (
              <div key={id} style={styles.summaryPill}>
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#0a0a0a",
                  }}
                >
                  {label}
                </span>
                <Badge variant="neutral">{count}</Badge>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <BtnSecondary
          onClick={() => navigate("/dashboard")}
          disabled={processing}
        >
          Cancel
        </BtnSecondary>
        <BtnPrimary
          onClick={handleProcess}
          disabled={readyCount === 0 || processing}
        >
          {processing
            ? "Uploading…"
            : `Process ${readyCount} file${readyCount !== 1 ? "s" : ""}`}
        </BtnPrimary>
      </div>

      <Toast
        visible={toast.visible}
        message={toast.message}
        icon={
          toast.ok ? (
            <CheckCircle
              style={{ width: 15, height: 15, color: "var(--success)" }}
            />
          ) : (
            <AlertCircle
              style={{ width: 15, height: 15, color: "var(--border)" }}
            />
          )
        }
      />

      <style>{`@media (max-width: 720px) { .upload-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
