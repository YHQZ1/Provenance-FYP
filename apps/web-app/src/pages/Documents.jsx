import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  Recycle,
  RotateCw,
  Search,
  Trash2,
  Truck,
  UploadCloud,
  X,
} from "lucide-react";
import { documentAPI } from "../lib/api";
import {
  ACCEPTED_EXTENSIONS,
  DOCUMENT_TYPES,
  MAX_UPLOAD_MB,
  STAGES,
  documentStage,
  documentTypeLabel,
  formatDate,
  formatKg,
  formatKgExact,
  formatSize,
  fyLabel,
} from "../lib/domain";
import { useWorkspace } from "../lib/workspace";
import {
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  StageBadge,
  useToast,
} from "../components/ui";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const TYPE_ICONS = {
  purchase_invoice: FileText,
  recycling_certificate: Recycle,
  collection_receipt: Truck,
  epr_record: BadgeCheck,
};

// What the system is doing right now, in words, for documents still being processed.
const PROCESSING_PHASE = {
  PENDING: "Queued",
  OCR_PROCESSING: "Reading document",
  COMPLETED: "Classifying lines",
  RAG_PROCESSING: "Classifying lines",
};

const validate = (file) => {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext))
    return "Only PDF, JPG, PNG and TIFF files are supported.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024)
    return `Larger than ${MAX_UPLOAD_MB} MB.`;
  return null;
};

function StepLabel({ index, children }) {
  return (
    <p className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-950">
      <span className="mono flex size-5 items-center justify-center rounded-sm border border-neutral-300 text-[10px] text-neutral-500">
        {index}
      </span>
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */

function UploadPanel({ onUploaded, onOpenDocument }) {
  const [documentType, setDocumentType] = useState("purchase_invoice");
  const [queue, setQueue] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const notify = useToast();

  const addFiles = (fileList) => {
    const added = Array.from(fileList).map((file) => {
      const error = validate(file);
      return {
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        documentType,
        state: error ? "invalid" : "ready",
        message: error,
      };
    });
    setQueue((current) => [...current, ...added]);
  };

  const update = (id, patch) =>
    setQueue((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

  const uploadAll = async () => {
    const pending = queue.filter(
      (item) => item.state === "ready" || item.state === "error",
    );
    if (!pending.length) return;
    setUploading(true);
    let succeeded = 0;

    for (const item of pending) {
      update(item.id, { state: "uploading", message: null });
      try {
        await documentAPI.upload(item.file, item.documentType);
        update(item.id, {
          state: "done",
          message: "Uploaded. Processing has started.",
        });
        succeeded += 1;
      } catch (error) {
        update(item.id, {
          state: error.status === 409 ? "duplicate" : "error",
          message: error.message,
          existing: error.status === 409 ? error.details : null,
        });
      }
    }

    setUploading(false);
    if (succeeded > 0) {
      notify(
        `${succeeded} document${succeeded > 1 ? "s" : ""} uploaded. Processing has started.`,
      );
      onUploaded();
      setTimeout(
        () =>
          setQueue((current) =>
            current.filter((item) => item.state !== "done"),
          ),
        4000,
      );
    }
  };

  const readyCount = queue.filter(
    (item) => item.state === "ready" || item.state === "error",
  ).length;
  const selected = DOCUMENT_TYPES.find((type) => type.id === documentType);

  return (
    <Card className="min-w-0">
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-950">
          Upload documents
        </h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Each file is read automatically, then its lines wait for you in
          Review.
        </p>
      </div>

      <div className="grid gap-8 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <fieldset className="min-w-0">
          <legend className="contents">
            <StepLabel index={1}>What are you uploading?</StepLabel>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {DOCUMENT_TYPES.map((type) => {
              const Icon = TYPE_ICONS[type.id];
              const active = documentType === type.id;
              return (
                <label
                  key={type.id}
                  className={cx(
                    "relative flex cursor-pointer flex-col gap-2 rounded-md border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-600",
                    active
                      ? "border-neutral-950 bg-white"
                      : "border-neutral-200 hover:border-neutral-400",
                  )}
                >
                  <input
                    type="radio"
                    name="document-type"
                    value={type.id}
                    checked={active}
                    onChange={() => setDocumentType(type.id)}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between">
                    <Icon
                      className={cx(
                        "size-4",
                        active ? "text-emerald-600" : "text-neutral-400",
                      )}
                      aria-hidden
                    />
                    <span
                      className={cx(
                        "flex size-4 items-center justify-center rounded-sm border",
                        active
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-neutral-300",
                      )}
                      aria-hidden
                    >
                      {active && <Check className="size-3" strokeWidth={3} />}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-neutral-950">
                    {type.label}
                  </span>
                  <span className="text-xs leading-relaxed text-neutral-500">
                    {type.hint}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex min-w-0 flex-col">
          <StepLabel index={2}>Add files</StepLabel>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              addFiles(event.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Choose ${selected.label.toLowerCase()} files to upload`}
            className={cx(
              "flex min-h-40 flex-1 flex-col items-center justify-center rounded-md border border-dashed px-6 py-8 text-center transition-colors",
              dragOver
                ? "border-emerald-600 bg-emerald-50/50"
                : "border-neutral-300 bg-neutral-50 hover:border-neutral-400",
            )}
          >
            <UploadCloud className="mb-3 size-6 text-neutral-400" aria-hidden />
            <p className="text-sm font-medium text-neutral-950">
              Drop {selected.label.toLowerCase()}s here, or{" "}
              <span className="underline underline-offset-2">browse</span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              PDF, JPG, PNG or TIFF · up to {MAX_UPLOAD_MB} MB each
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
        </div>
      </div>

      {/* Queued files sit below both columns at full width, so a long queue never unbalances the
          tiles and drop zone. The upload action lives with them; with nothing queued, no idle button. */}
      {queue.length > 0 && (
        <div className="px-5 pb-5">
          <div className="overflow-hidden rounded-md border border-neutral-200">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 py-2 pl-4 pr-2">
              <p className="text-sm text-neutral-600">
                {uploading
                  ? "Uploading…"
                  : readyCount > 0
                    ? `${readyCount} file${readyCount === 1 ? "" : "s"} ready`
                    : "Nothing left to upload"}
              </p>
              <div className="flex items-center gap-1.5">
                {!uploading && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setQueue([])}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="primary"
                  onClick={uploadAll}
                  loading={uploading}
                  disabled={readyCount === 0}
                >
                  {readyCount > 1 ? `Upload ${readyCount} files` : "Upload"}
                </Button>
              </div>
            </div>
            <ul className="max-h-72 divide-y divide-neutral-100 overflow-y-auto">
              {queue.map((item) => {
                const failed = ["invalid", "error", "duplicate"].includes(
                  item.state,
                );
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    {item.state === "uploading" ? (
                      <Loader2 className="size-4 shrink-0 animate-spin text-neutral-400" />
                    ) : item.state === "done" ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    ) : failed ? (
                      <AlertCircle className="size-4 shrink-0 text-red-600" />
                    ) : (
                      <FileText className="size-4 shrink-0 text-neutral-400" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium text-neutral-950">
                      {item.file.name}
                    </span>
                    <span className="hidden shrink-0 text-neutral-500 md:block">
                      {documentTypeLabel(item.documentType)}
                    </span>
                    <span className="mono hidden w-16 shrink-0 text-right text-xs text-neutral-500 sm:block">
                      {formatSize(item.file.size)}
                    </span>
                    <span
                      className={cx(
                        "w-48 shrink-0 truncate text-right text-xs",
                        failed
                          ? "text-red-600"
                          : item.state === "done"
                            ? "text-emerald-700"
                            : "text-neutral-400",
                      )}
                      title={item.message || undefined}
                    >
                      {item.state === "uploading"
                        ? "Uploading…"
                        : item.state === "done"
                          ? "Uploaded"
                          : item.existing
                            ? item.existing.financial_year_label
                              ? `Already uploaded · ${item.existing.financial_year_label}`
                              : "Already uploaded"
                            : item.message || "Ready"}
                    </span>
                    {item.existing && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenDocument(item.existing.document_id)
                        }
                        className="shrink-0 text-xs font-medium text-neutral-950 underline underline-offset-2 hover:text-emerald-700"
                      >
                        Open
                      </button>
                    )}
                    <span className="flex w-6 shrink-0 justify-end">
                      {!uploading && item.state !== "done" && (
                        <button
                          type="button"
                          onClick={() =>
                            setQueue((current) =>
                              current.filter((q) => q.id !== item.id),
                            )
                          }
                          className="rounded-sm p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                          aria-label={`Remove ${item.file.name}`}
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-neutral-950">
        {children}
      </dd>
    </div>
  );
}

function DocumentDrawer({ documentId, onClose, onChanged, onRetry, onDelete }) {
  const { setFy } = useWorkspace();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const notify = useToast();

  useEffect(() => {
    if (!documentId) return;
    documentAPI
      .get(documentId)
      .then((response) => {
        setDoc(response.data);
        setDate(response.data.document_date || "");
      })
      .catch((err) => setError(err.message));
  }, [documentId]);

  const saveDate = async () => {
    setSaving(true);
    try {
      const response = await documentAPI.update(documentId, {
        document_date: date || null,
      });
      setDoc(response.data);
      notify(
        "Document date saved. It now counts toward the matching financial year.",
      );
      onChanged();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const stage = doc ? documentStage(doc) : null;
  const lines = doc?.classifications || [];
  const reviewed = lines.filter((line) => line.verified_by_user).length;

  return (
    <Drawer
      open={Boolean(documentId)}
      onClose={onClose}
      title={doc?.filename || "Document"}
      description={
        doc &&
        `${documentTypeLabel(doc.document_type)} · uploaded ${formatDate(doc.created_at)}`
      }
      footer={
        doc && (
          <>
            <Button
              variant="ghost"
              onClick={() => onDelete(doc)}
              disabled={stage === "processing"}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
            <div className="flex gap-2">
              {stage === "failed" && (
                <Button onClick={() => onRetry(doc)}>
                  <RotateCw className="size-4" /> Retry
                </Button>
              )}
              {stage === "review" && (
                <Button to={`/review?document=${doc.id}`} variant="primary">
                  Review this document <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </>
        )
      }
    >
      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : !doc ? (
        <Spinner label="Loading document…" />
      ) : (
        <div className="space-y-6">
          <div
            className={cx(
              "rounded-md border px-4 py-3",
              stage === "failed"
                ? "border-red-200 bg-red-50"
                : "border-neutral-200 bg-neutral-50",
            )}
          >
            <div className="flex items-center gap-2">
              <StageBadge stage={stage} />
              {stage === "processing" && (
                <span className="text-sm text-neutral-600">
                  {PROCESSING_PHASE[doc.status]}
                </span>
              )}
            </div>
            <p
              className={cx(
                "mt-2 text-sm",
                stage === "failed" ? "text-red-800" : "text-neutral-600",
              )}
            >
              {doc.reasoning || STAGES[stage].help}
            </p>
          </div>

          {doc.filing?.late && (
            <Alert
              tone="warn"
              title={`Not in the finalized ${doc.filing.financial_year_label} filing`}
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setFy(doc.filing.financial_year);
                    navigate("/filing");
                  }}
                >
                  Open filing
                </Button>
              }
            >
              This document is dated in a year you already signed off, so its
              quantities aren't counted. Reopen the year to review and include
              it, or delete it if it doesn't belong.
            </Alert>
          )}
          {doc.filing?.included && (
            <Alert tone="info">
              Part of the finalized {doc.filing.financial_year_label} filing.
              Reopen that year on the Filing page to change or delete it.
            </Alert>
          )}

          <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="h-[440px] overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
              {doc.file_url && doc.mime_type === "application/pdf" ? (
                <iframe
                  title="Document preview"
                  src={doc.file_url}
                  className="size-full"
                />
              ) : doc.file_url && doc.mime_type?.startsWith("image/") ? (
                <img
                  src={doc.file_url}
                  alt="Document preview"
                  className="size-full object-contain"
                />
              ) : (
                <EmptyState icon={FileText} title="Preview unavailable" />
              )}
            </div>

            <div className="min-w-0 space-y-6">
              <div>
                <p className="mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Extracted details
                </p>
                <dl className="mt-1 divide-y divide-neutral-100">
                  <DetailRow label="Invoice no.">
                    {doc.fields?.invoice_number?.value || "—"}
                  </DetailRow>
                  <DetailRow label="GSTIN">
                    <span className="mono">
                      {doc.fields?.gstin?.value || "—"}
                    </span>
                  </DetailRow>
                  <DetailRow label="Counts toward">
                    {fyLabel(doc.financial_year)}
                  </DetailRow>
                  <DetailRow label="File size">
                    {formatSize(doc.file_size) || "—"}
                  </DetailRow>
                </dl>
              </div>

              <div>
                <label
                  htmlFor="document-date"
                  className="mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500"
                >
                  Document date
                </label>
                <div className="mt-2 flex gap-2">
                  <Input
                    id="document-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                  <Button
                    onClick={saveDate}
                    loading={saving}
                    disabled={date === (doc.document_date || "")}
                  >
                    Save
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-neutral-500">
                  {doc.document_date
                    ? "Read from the document. Change it if it's wrong."
                    : "No date could be read, so the upload date is used. Enter the invoice date."}
                </p>
              </div>
            </div>
          </div>

          {doc.document_type !== "epr_record" && (
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Line items
                </p>
                {lines.length > 0 && (
                  <p className="text-xs text-neutral-500">
                    {reviewed} of {lines.length} reviewed
                  </p>
                )}
              </div>
              {lines.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  {stage === "processing"
                    ? "Lines appear here once the document has been read."
                    : "No line items."}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-neutral-200">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
                        <th className="px-3 py-2 font-medium">Line</th>
                        <th className="px-3 py-2 font-medium">Material</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Weight
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Status
                        </th>
                        <th className="px-3 py-2 font-medium">Reviewed by</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {lines.map((line) => {
                        const code =
                          line.corrected_material_code || line.material_code;
                        const kg =
                          line.corrected_quantity_kg ?? line.quantity_kg;
                        const excluded = line.verified_by_user && !code;
                        return (
                          <tr key={line.id}>
                            <td className="max-w-[16rem] truncate px-3 py-2.5 text-neutral-950">
                              {line.matched_synonym || "Line item"}
                            </td>
                            <td className="mono px-3 py-2.5 text-neutral-700">
                              {code || "—"}
                            </td>
                            <td className="mono whitespace-nowrap px-3 py-2.5 text-right text-neutral-700">
                              {formatKgExact(kg)}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {excluded ? (
                                <Badge tone="neutral">Excluded</Badge>
                              ) : line.verified_by_user ? (
                                <Badge tone="ok">Reviewed</Badge>
                              ) : (
                                <Badge tone="warn">To review</Badge>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-xs text-neutral-500">
                              {line.verified_by_user &&
                              line.reviewed_by_name ? (
                                <>
                                  <span className="block text-neutral-700">
                                    {line.reviewed_by_name}
                                  </span>
                                  {formatDate(line.reviewed_at)}
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */

const FILTERS = [
  { id: "all", label: "All" },
  { id: "processing", label: "Processing" },
  { id: "review", label: "Needs review" },
  { id: "verified", label: "Reviewed" },
  { id: "failed", label: "Failed" },
  { id: "evidence", label: "Stored" },
];

function LinesMeter({ doc }) {
  if (
    ["evidence", "processing", "failed"].includes(doc.stage) ||
    doc.items_count === 0
  ) {
    return <span className="text-neutral-400">—</span>;
  }
  const share = doc.items_verified / doc.items_count;
  return (
    <span className="flex items-center gap-2.5">
      <span className="h-1.5 w-16 rounded-sm bg-neutral-100" aria-hidden>
        <span
          className="block h-1.5 rounded-sm bg-emerald-600"
          style={{ width: `${share * 100}%` }}
        />
      </span>
      <span className="mono text-xs tabular-nums text-neutral-600">
        {doc.items_verified}/{doc.items_count}
      </span>
    </span>
  );
}

export default function Documents() {
  const { fy, filing, refreshFiling } = useWorkspace();
  const [documents, setDocuments] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showAllYears, setShowAllYears] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get("open");
  const notify = useToast();

  const load = useCallback(async () => {
    try {
      const response = await documentAPI.list({ limit: 200 });
      setDocuments(
        response.data.map((doc) => ({ ...doc, stage: documentStage(doc) })),
      );
      setLoadError(null);
    } catch (error) {
      setLoadError(error.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const anyProcessing = documents?.some((doc) => doc.stage === "processing");
  useEffect(() => {
    if (!anyProcessing) return undefined;
    const timer = setInterval(() => {
      load();
      refreshFiling();
    }, 4000);
    return () => clearInterval(timer);
  }, [anyProcessing, load, refreshFiling]);

  // Reviewed kg per document comes from the filing summary for the selected year.
  const reviewedKg = useMemo(
    () =>
      Object.fromEntries(
        (filing?.documents || []).map((doc) => [doc.id, doc.verified_kg]),
      ),
    [filing],
  );

  const inScope = useMemo(
    () =>
      (documents || []).filter(
        (doc) => showAllYears || doc.financial_year === fy,
      ),
    [documents, showAllYears, fy],
  );
  // Documents outside the selected year are hidden from the list; say so instead of letting them vanish.
  const otherYears = useMemo(() => {
    const others = (documents || []).filter((doc) => doc.financial_year !== fy);
    const years = [...new Set(others.map((doc) => doc.financial_year))].sort(
      (a, b) => a - b,
    );
    return { count: others.length, labels: years.map(fyLabel) };
  }, [documents, fy]);
  const needle = query.trim().toLowerCase();
  const visible = inScope.filter(
    (doc) =>
      (filter === "all" || doc.stage === filter) &&
      (typeFilter === "all" || doc.document_type === typeFilter) &&
      (!needle || doc.filename.toLowerCase().includes(needle)),
  );
  const countFor = (id) =>
    id === "all"
      ? inScope.length
      : inScope.filter((doc) => doc.stage === id).length;
  const filtersActive =
    Boolean(needle) || typeFilter !== "all" || filter !== "all";
  const toReview = countFor("review");

  const refreshAll = () => {
    load();
    refreshFiling();
  };

  const retry = async (doc) => {
    setBusyId(doc.id);
    try {
      await documentAPI.retry(doc.id);
      notify(`Reprocessing ${doc.filename}`);
      refreshAll();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    const doc = confirmDelete;
    setBusyId(doc.id);
    try {
      await documentAPI.remove(doc.id);
      notify(`Deleted ${doc.filename}`);
      setConfirmDelete(null);
      if (openId === doc.id) setSearchParams({});
      refreshAll();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
            Step 1 · Documents
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Documents
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Your EPR evidence for {fyLabel(fy)}. Each document counts toward the
            year of its invoice date.
          </p>
        </div>
        {toReview > 0 && (
          <Button to="/review" variant="primary">
            Review {toReview} document{toReview === 1 ? "" : "s"}{" "}
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>

      <UploadPanel
        onUploaded={refreshAll}
        onOpenDocument={(id) => {
          // The existing copy may be dated in another year, so show every year.
          setShowAllYears(true);
          setSearchParams({ open: id });
        }}
      />

      {otherYears.count > 0 && !showAllYears && (
        <Alert
          tone="info"
          action={
            <Button size="sm" onClick={() => setShowAllYears(true)}>
              Show all years
            </Button>
          }
        >
          {otherYears.count} document{otherYears.count === 1 ? " is" : "s are"}{" "}
          dated in other financial years ({otherYears.labels.join(", ")}) and{" "}
          {otherYears.count === 1 ? "isn't" : "aren't"} shown below. Each
          document counts toward the year of its invoice date.
        </Alert>
      )}

      <Card className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-neutral-200 px-5 pt-3">
          <div
            className="-mb-px flex gap-5 overflow-x-auto"
            role="tablist"
            aria-label="Filter by status"
          >
            {FILTERS.map((item) => {
              const count = countFor(item.id);
              if (item.id !== "all" && count === 0 && filter !== item.id)
                return null;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  onClick={() => setFilter(item.id)}
                  className={cx(
                    "flex shrink-0 items-center gap-1.5 border-b-2 pb-3 pt-1 text-sm transition-colors",
                    filter === item.id
                      ? "border-neutral-950 font-medium text-neutral-950"
                      : "border-transparent text-neutral-500 hover:text-neutral-950",
                  )}
                >
                  {item.label}
                  <span
                    className={cx(
                      "mono text-[11px] tabular-nums",
                      item.id === "failed" && count > 0
                        ? "text-red-600"
                        : "text-neutral-400",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <div className="relative w-56">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by file name"
                aria-label="Search documents"
                className="h-9 pl-8"
              />
            </div>
            <div className="w-48">
              <Select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                aria-label="Filter by document type"
                className="h-9"
              >
                <option value="all">All document types</option>
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex h-9 cursor-pointer items-center gap-2 px-1 text-sm text-neutral-600">
              <input
                type="checkbox"
                checked={showAllYears}
                onChange={(e) => setShowAllYears(e.target.checked)}
                className="accent-emerald-600"
              />
              All years
            </label>
          </div>
        </div>

        {loadError && !documents ? (
          <div className="p-5">
            <Alert
              tone="error"
              title="Couldn't load documents"
              action={
                <Button size="sm" onClick={load}>
                  Retry
                </Button>
              }
            >
              {loadError}
            </Alert>
          </div>
        ) : !documents ? (
          <Spinner label="Loading documents…" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={
              inScope.length === 0
                ? `No documents for ${fyLabel(fy)} yet`
                : "No documents match"
            }
            description={
              inScope.length === 0
                ? "Upload purchase invoices above to get started."
                : "Try a different status, type or search."
            }
            action={
              filtersActive && inScope.length > 0 ? (
                <Button
                  onClick={() => {
                    setFilter("all");
                    setTypeFilter("all");
                    setQuery("");
                  }}
                >
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm md:min-w-[820px]">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                  <th className="px-5 py-2.5 font-medium">Document</th>
                  <th className="hidden px-3 py-2.5 font-medium md:table-cell">
                    Dated
                  </th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="hidden px-3 py-2.5 font-medium md:table-cell">
                    Lines reviewed
                  </th>
                  <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">
                    Reviewed
                  </th>
                  <th className="hidden px-5 py-2.5 sm:table-cell">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visible.map((doc) => {
                  const Icon = TYPE_ICONS[doc.document_type] || FileText;
                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setSearchParams({ open: doc.id })}
                      className={cx(
                        "cursor-pointer transition-colors hover:bg-neutral-50",
                        openId === doc.id && "bg-neutral-50",
                      )}
                    >
                      <td className="max-w-[11rem] px-4 py-3 sm:max-w-sm sm:px-5">
                        <span className="flex items-center gap-3">
                          <span className="hidden size-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 sm:flex">
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSearchParams({ open: doc.id });
                              }}
                              className="block max-w-full truncate text-left font-medium text-neutral-950 hover:underline"
                            >
                              {doc.filename}
                            </button>
                            <span className="block text-xs text-neutral-500">
                              {documentTypeLabel(doc.document_type)}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-neutral-700 md:table-cell">
                        {formatDate(doc.effective_date)}
                        <span className="block text-xs text-neutral-400">
                          {doc.document_date ? "Invoice date" : "Upload date"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StageBadge stage={doc.stage} />
                        {doc.stage === "processing" && (
                          <span className="mt-1 block text-xs text-neutral-500">
                            {PROCESSING_PHASE[doc.status]}…
                          </span>
                        )}
                        {doc.stage === "failed" && (
                          <span
                            className="mt-1 block max-w-[8rem] truncate text-xs text-red-600 sm:max-w-[16rem]"
                            title={doc.reasoning}
                          >
                            {doc.reasoning}
                          </span>
                        )}
                        {doc.filing?.late && (
                          <span className="mt-1 block text-xs text-neutral-600">
                            Not in finalized {doc.filing.financial_year_label}
                          </span>
                        )}
                      </td>
                      <td className="hidden px-3 py-3 md:table-cell">
                        <LinesMeter doc={doc} />
                      </td>
                      <td className="mono hidden whitespace-nowrap px-3 py-3 text-right text-neutral-950 md:table-cell">
                        {doc.stage === "evidence" || reviewedKg[doc.id] == null
                          ? "—"
                          : formatKg(reviewedKg[doc.id])}
                      </td>
                      <td
                        className="hidden px-5 py-3 sm:table-cell"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1.5">
                          {doc.stage === "review" && (
                            <Button
                              size="sm"
                              variant="primary"
                              to={`/review?document=${doc.id}`}
                            >
                              Review
                            </Button>
                          )}
                          {doc.stage === "failed" && (
                            <Button
                              size="sm"
                              onClick={() => retry(doc)}
                              loading={busyId === doc.id}
                            >
                              <RotateCw className="size-3.5" /> Retry
                            </Button>
                          )}
                          {doc.stage !== "processing" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmDelete(doc)}
                              aria-label={`Delete ${doc.filename}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
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

        {documents && visible.length > 0 && (
          <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">
            Showing {visible.length} of {inScope.length} document
            {inScope.length === 1 ? "" : "s"}
            {showAllYears ? " across all years" : ` in ${fyLabel(fy)}`}.
          </p>
        )}
      </Card>

      <DocumentDrawer
        key={openId || "none"}
        documentId={openId}
        onClose={() => setSearchParams({})}
        onChanged={refreshAll}
        onRetry={(doc) => {
          retry(doc);
          setSearchParams({});
        }}
        onDelete={(doc) => setConfirmDelete(doc)}
      />

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete document?"
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={remove}
              loading={busyId === confirmDelete?.id}
            >
              Delete document
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          <span className="font-medium text-neutral-950">
            {confirmDelete?.filename}
          </span>{" "}
          and its reviewed lines will be removed, and its quantities will no
          longer count toward the filing. This can't be undone.
        </p>
      </Modal>
    </div>
  );
}
