import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Ban,
  Check,
  ClipboardCheck,
  FileText,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import { documentAPI, reviewAPI } from "../lib/api";
import {
  CPCB_CATEGORIES,
  MATERIALS,
  documentTypeLabel,
  formatKgExact,
} from "../lib/domain";
import { useWorkspace } from "../lib/workspace";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
  useToast,
} from "../components/ui";

const cx = (...classes) => classes.filter(Boolean).join(" ");

// Why a line needs a person, in plain words, and what to do about it.
const REASONS = {
  locked: {
    label: "Year finalized",
    tone: "neutral",
    title: "This line belongs to a finalized year",
    body: "Its document is dated in a year you've already signed off, so it can't be changed. Reopen that year on the Filing page to review it.",
  },
  suggested: {
    label: "Suggested",
    tone: "ok",
    title: "The suggestion looks complete",
    body: "Material, weight and confidence all check out. Compare it with the invoice, then approve.",
  },
  material: {
    label: "Needs material",
    tone: "warn",
    title: "The material couldn't be identified",
    body: "The description doesn't name a polymer. Enter the material if you know it, or exclude the line if it isn't plastic packaging.",
  },
  weight: {
    label: "Needs weight",
    tone: "warn",
    title: "The quantity isn't a weight",
    body: "The invoice gives a count or another unit, not kilograms. Enter the weight in kg.",
  },
  check: {
    label: "Check suggestion",
    tone: "warn",
    title: "The suggestion is uncertain",
    body: "Confidence is low, or the description points to a different packaging category. Confirm or correct it against the invoice.",
  },
};

const reasonOf = (item) => {
  if (item.locked_financial_year) return "locked";
  if (!item.material_code) return "material";
  if (item.quantity_kg == null) return "weight";
  if (item.suggested) return "suggested";
  return "check";
};

const EXCLUDE_REASONS = [
  "Freight or service charge",
  "Not packaging (raw material or scrap)",
  "Duplicate of another line",
  "Not plastic",
];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "attention", label: "Needs attention" },
  { id: "suggested", label: "Suggested" },
];

const isTyping = (target) =>
  ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);

/* ------------------------------------------------------------------ */

// Highlights the reviewed line inside the OCR text so it can be found on the page quickly.
function HighlightedText({ text, needle }) {
  const index = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  const markRef = useRef(null);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center" });
  }, [needle]);

  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark
        ref={markRef}
        className="rounded-sm bg-neutral-950 px-0.5 text-white"
      >
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  );
}

function SourcePanel({ documentId, needle }) {
  const [doc, setDoc] = useState(null);
  const [view, setView] = useState("file");

  useEffect(() => {
    documentAPI
      .get(documentId)
      .then((response) => setDoc(response.data))
      .catch(() => setDoc({ error: true }));
  }, [documentId]);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-2 pb-3">
        <p className="mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
          Source document
        </p>
        <div
          className="flex rounded-md border border-neutral-200 p-0.5 text-xs"
          role="tablist"
        >
          {[
            ["file", "Original"],
            ["text", "Extracted text"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={cx(
                "rounded-sm px-2.5 py-1 font-medium transition-colors",
                view === id
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-500 hover:text-neutral-950",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[560px] overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
        {!doc ? (
          <Spinner label="Loading document…" />
        ) : doc.error ? (
          <EmptyState icon={FileText} title="Couldn't load the document" />
        ) : view === "text" ? (
          <pre className="mono size-full overflow-auto whitespace-pre-wrap p-4 text-xs leading-relaxed text-neutral-700">
            {doc.raw_text ? (
              <HighlightedText text={doc.raw_text} needle={needle} />
            ) : (
              "No text was extracted."
            )}
          </pre>
        ) : doc.file_url && doc.mime_type === "application/pdf" ? (
          <iframe
            title="Source document"
            src={doc.file_url}
            className="size-full"
          />
        ) : doc.file_url ? (
          <img
            src={doc.file_url}
            alt="Source document"
            className="size-full object-contain"
          />
        ) : (
          <EmptyState icon={FileText} title="Preview unavailable" />
        )}
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Tip: "Extracted text" highlights where this line was read from.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Fact({ label, value, hint, muted }) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 px-3.5 py-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p
        className={cx(
          "mt-1 truncate font-semibold",
          muted ? "text-neutral-400" : "text-neutral-950",
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 truncate text-xs text-neutral-500">{hint}</p>
      )}
    </div>
  );
}

function DecisionPanel({
  item,
  position,
  categoriesTracked,
  onDone,
  modeRequest,
}) {
  const reason = reasonOf(item);
  const meta = REASONS[reason];
  const canApprove = reason === "suggested" || reason === "check";
  const [mode, setMode] = useState(canApprove ? "view" : "edit");
  const [material, setMaterial] = useState(item.material_code || "");
  const [category, setCategory] = useState(item.cpcb_category || "");
  const [quantity, setQuantity] = useState(item.quantity_kg ?? "");
  const [notes, setNotes] = useState("");
  const [excludeReason, setExcludeReason] = useState("");
  const [saving, setSaving] = useState(null);
  const notify = useToast();
  const { setFy } = useWorkspace();
  const navigate = useNavigate();
  const locked = reason === "locked";

  const run = async (kind, action, message) => {
    setSaving(kind);
    try {
      await action();
      notify(message);
      onDone(item.id);
    } catch (error) {
      notify(error.message, "error");
      setSaving(null);
    }
  };

  const approve = () =>
    run("approve", () => reviewAPI.approve(item.id, notes), "Line approved");
  const saveCorrection = () =>
    run(
      "correct",
      () =>
        reviewAPI.correct(item.id, {
          material_code: material,
          quantity_kg: Number(quantity),
          ...(categoriesTracked && { cpcb_category: category || null }),
          notes,
        }),
      "Saved and approved",
    );
  const exclude = () =>
    run(
      "exclude",
      () =>
        reviewAPI.exclude(
          item.id,
          [excludeReason, notes].filter(Boolean).join(": "),
        ),
      "Line excluded from the filing",
    );

  // Keyboard shortcuts on the page arrive here as mode requests. Each request names the line
  // it was made for, so the next line never acts on a request meant for the previous one.
  useEffect(() => {
    if (!modeRequest || modeRequest.itemId !== item.id || saving || locked)
      return;
    if (modeRequest.mode === "approve") {
      if (canApprove && mode === "view") approve();
      return;
    }
    setMode(modeRequest.mode);
    // Only react to new requests, not to the handlers changing identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeRequest]);

  const quantityValid = quantity !== "" && Number(quantity) > 0;
  const materialName = MATERIALS.find(
    (m) => m.code === item.material_code,
  )?.name.split("— ")[1];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            Invoice line · {position}
          </p>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>
        <p className="mt-2 text-xl font-semibold leading-snug text-neutral-950">
          {item.line_description || "No line text recorded"}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {item.document_filename} · {documentTypeLabel(item.document_type)}
        </p>
      </div>

      <div
        className={cx(
          "rounded-md border px-4 py-3",
          reason === "suggested"
            ? "border-emerald-200 bg-emerald-50/60"
            : "border-neutral-300 bg-white",
        )}
      >
        <p className="text-sm font-medium text-neutral-950">{meta.title}</p>
        <p className="mt-0.5 text-sm text-neutral-600">{meta.body}</p>
      </div>

      <div
        className={cx(
          "grid gap-2.5",
          categoriesTracked ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        <Fact
          label="Suggested material"
          value={item.material_code || "Not identified"}
          hint={materialName}
          muted={!item.material_code}
        />
        {categoriesTracked && (
          <Fact
            label="CPCB category"
            value={
              CPCB_CATEGORIES[item.cpcb_category]?.short || "Not identified"
            }
            hint={CPCB_CATEGORIES[item.cpcb_category]?.label}
            muted={!item.cpcb_category}
          />
        )}
        <Fact
          label="Weight"
          value={
            item.quantity_kg == null
              ? "Not a weight"
              : formatKgExact(item.quantity_kg)
          }
          hint={
            item.confidence_score > 0
              ? `${Math.round(item.confidence_score * 100)}% confidence in the material`
              : null
          }
          muted={item.quantity_kg == null}
        />
      </div>

      {item.reasoning && (
        <div>
          <p className="text-xs text-neutral-500">Why it was suggested</p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-700">
            {item.reasoning}
          </p>
        </div>
      )}

      <div className="border-t border-neutral-100 pt-5">
        {locked ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                setFy(item.locked_financial_year_start);
                navigate("/filing");
              }}
            >
              Open {item.locked_financial_year} filing{" "}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : mode === "edit" ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-neutral-950">
              {canApprove
                ? "Correct the suggestion"
                : "Enter what this line is"}
            </p>
            <div
              className={cx(
                "grid gap-3",
                categoriesTracked
                  ? "sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,0.8fr)]"
                  : "sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]",
              )}
            >
              <Field label="Material" htmlFor="material">
                <Select
                  id="material"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                >
                  <option value="">Choose material</option>
                  {MATERIALS.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {categoriesTracked && (
                <Field label="CPCB category" htmlFor="category">
                  <Select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Not sure</option>
                    {Object.entries(CPCB_CATEGORIES)
                      .filter(([key]) => key !== "UNCATEGORISED")
                      .map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.short} · {value.label}
                        </option>
                      ))}
                  </Select>
                </Field>
              )}
              <Field label="Weight (kg)" htmlFor="quantity">
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="0.001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mono"
                />
              </Field>
            </div>
            <Field label="Note (optional)" htmlFor="note">
              <Textarea
                id="note"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why this material or weight?"
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" onClick={() => setMode("exclude")}>
                <Ban className="size-4" /> Not plastic packaging? Exclude
              </Button>
              <div className="flex gap-2">
                {canApprove && (
                  <Button variant="ghost" onClick={() => setMode("view")}>
                    Cancel
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={saveCorrection}
                  loading={saving === "correct"}
                  disabled={!material || !quantityValid}
                >
                  <Check className="size-4" /> Save and approve
                </Button>
              </div>
            </div>
          </div>
        ) : mode === "exclude" ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-neutral-950">
                Why exclude this line?
              </p>
              <p className="mt-0.5 text-sm text-neutral-500">
                It stays on record with the reason, but counts toward no total.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXCLUDE_REASONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setExcludeReason(option)}
                  aria-pressed={excludeReason === option}
                  className={cx(
                    "rounded-md border px-3 py-1.5 text-sm transition-colors",
                    excludeReason === option
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-200 text-neutral-700 hover:border-neutral-400",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add detail (optional)"
              aria-label="Exclusion note"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setMode(canApprove ? "view" : "edit")}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={exclude}
                loading={saving === "exclude"}
                disabled={!excludeReason && !notes.trim()}
              >
                <Ban className="size-4" /> Exclude line
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={approve}
              loading={saving === "approve"}
            >
              <Check className="size-4" /> Approve
            </Button>
            <Button onClick={() => setMode("edit")}>
              <Pencil className="size-4" /> Edit
            </Button>
            <Button variant="ghost" onClick={() => setMode("exclude")}>
              <Ban className="size-4" /> Exclude
            </Button>
          </div>
        )}
      </div>

      <p className="mono hidden text-[11px] text-neutral-400 lg:block">
        Keys: A approve · E edit · X exclude · ↑ ↓ move between lines
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Guide({ onDismiss }) {
  const steps = [
    ["Check", "Compare the line with the invoice on the right."],
    [
      "Decide",
      "Approve it, correct it, or exclude it if it isn't plastic packaging.",
    ],
    [
      "Repeat",
      "The next line opens automatically. Only approved lines count toward your filing.",
    ],
  ];
  return (
    <Card className="flex flex-wrap items-start gap-x-8 gap-y-4 px-5 py-4">
      {steps.map(([title, body], index) => (
        <div key={title} className="flex min-w-[14rem] flex-1 gap-3">
          <span className="mono flex size-5 shrink-0 items-center justify-center rounded-sm border border-neutral-300 text-[10px] text-neutral-500">
            {index + 1}
          </span>
          <p className="text-sm text-neutral-600">
            <span className="font-medium text-neutral-950">{title}.</span>{" "}
            {body}
          </p>
        </div>
      ))}
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-sm p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        aria-label="Hide these steps"
      >
        <X className="size-4" />
      </button>
    </Card>
  );
}

const GUIDE_KEY = "provenance_review_guide_hidden";

function Stat({ label, value, children }) {
  return (
    <Card className="min-w-0 px-5 py-4">
      <p className="mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-[26px] font-semibold leading-none tabular-nums text-neutral-950">
        {value}
      </p>
      {children}
    </Card>
  );
}

export default function Review() {
  const { refreshFiling, filing } = useWorkspace();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [modeRequest, setModeRequest] = useState(null);
  const [guideHidden, setGuideHidden] = useState(() => {
    try {
      return localStorage.getItem(GUIDE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const documentFilter = searchParams.get("document");
  const notify = useToast();

  const load = useCallback(async () => {
    try {
      const response = await reviewAPI.queue();
      setItems(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Reload as documents finish processing and new suggestions arrive.
  const processing = filing?.counts?.processing || 0;
  const pendingCount = filing?.counts?.pending_items;
  useEffect(() => {
    load();
  }, [processing, pendingCount, load]);

  const scoped = useMemo(
    () =>
      (items || []).filter(
        (item) => !documentFilter || item.document_id === documentFilter,
      ),
    [items, documentFilter],
  );
  const visible = useMemo(
    () =>
      scoped.filter((item) =>
        filter === "all"
          ? true
          : filter === "suggested"
            ? item.suggested
            : !item.suggested,
      ),
    [scoped, filter],
  );
  const selected =
    visible.find((item) => item.id === selectedId) || visible[0] || null;
  const selectedIndex = selected ? visible.indexOf(selected) : -1;
  const suggested = scoped.filter((item) => item.suggested);
  const attention = scoped.length - suggested.length;

  const groups = useMemo(() => {
    const map = new Map();
    for (const item of visible) {
      if (!map.has(item.document_id))
        map.set(item.document_id, { name: item.document_filename, items: [] });
      map.get(item.document_id).items.push(item);
    }
    return [...map.entries()];
  }, [visible]);

  const positionOf = (item) => {
    const siblings = scoped.filter(
      (other) => other.document_id === item.document_id,
    );
    return `${siblings.indexOf(item) + 1} of ${siblings.length} in this document`;
  };

  const handleDone = (id) => {
    const index = visible.findIndex((item) => item.id === id);
    const next = visible[index + 1] || visible[index - 1];
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedId(next?.id || null);
    setReviewedCount((count) => count + 1);
    refreshFiling();
  };

  const approveSuggested = async () => {
    setBulkSaving(true);
    try {
      const response = await reviewAPI.approveSuggested(
        documentFilter || undefined,
      );
      const { approved, failed } = response.data;
      notify(
        failed.length
          ? `${approved} approved, ${failed.length} could not be approved`
          : `${approved} suggestion${approved === 1 ? "" : "s"} approved`,
        failed.length ? "error" : "ok",
      );
      setReviewedCount((count) => count + approved);
      setBulkOpen(false);
      await load();
      refreshFiling();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBulkSaving(false);
    }
  };

  // A approve · E edit · X exclude · arrows (or J/K) move. Ignored while typing or in a dialog.
  useEffect(() => {
    const onKey = (event) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTyping(event.target) ||
        bulkOpen ||
        !selected
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "arrowdown" || key === "j") {
        event.preventDefault();
        const next = visible[selectedIndex + 1];
        if (next) setSelectedId(next.id);
      } else if (key === "arrowup" || key === "k") {
        event.preventDefault();
        const previous = visible[selectedIndex - 1];
        if (previous) setSelectedId(previous.id);
      } else if (key === "a" || key === "e" || key === "x") {
        event.preventDefault();
        setModeRequest({
          mode: { a: "approve", e: "edit", x: "exclude" }[key],
          itemId: selected.id,
          at: Date.now(),
        });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, selectedIndex, visible, bulkOpen]);

  const hideGuide = () => {
    setGuideHidden(true);
    try {
      localStorage.setItem(GUIDE_KEY, "1");
    } catch {
      // preference only
    }
  };

  const total = scoped.length + reviewedCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
            Step 2 · Review
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Review line items
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Each line has a suggested material and weight. Approve, correct or
            exclude it. Only approved lines count toward your filing.
          </p>
        </div>
        {suggested.length > 0 && (
          <Button variant="accent" onClick={() => setBulkOpen(true)}>
            <Sparkles className="size-4" /> Approve {suggested.length} suggested
          </Button>
        )}
      </div>

      {items && scoped.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Lines left" value={scoped.length}>
            {reviewedCount > 0 ? (
              <div className="mt-3 flex items-center gap-3">
                <span
                  className="h-1.5 flex-1 rounded-sm bg-neutral-100"
                  aria-hidden
                >
                  <span
                    className="block h-1.5 rounded-sm bg-emerald-600"
                    style={{ width: `${(reviewedCount / total) * 100}%` }}
                  />
                </span>
                <span className="text-xs text-neutral-500">
                  {reviewedCount} done this session
                </span>
              </div>
            ) : (
              <p className="mt-2 text-xs text-neutral-500">
                Across {groups.length || 1} document(s)
              </p>
            )}
          </Stat>
          <Stat label="Ready to approve" value={suggested.length}>
            <p className="mt-2 text-xs text-neutral-500">
              Complete, confident suggestions
            </p>
          </Stat>
          <Stat label="Need your input" value={attention}>
            <p className="mt-2 text-xs text-neutral-500">
              Missing material or weight, or uncertain
            </p>
          </Stat>
        </div>
      )}

      {!guideHidden && items && scoped.length > 0 && (
        <Guide onDismiss={hideGuide} />
      )}

      {documentFilter && (
        <Alert
          tone="info"
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSearchParams({})}
            >
              Show all documents
            </Button>
          }
        >
          Showing lines from one document.
        </Alert>
      )}

      {processing > 0 && (
        <Alert tone="info">
          {processing} document(s) are still being processed. Their lines will
          appear here automatically.
        </Alert>
      )}

      {error && !items ? (
        <Alert
          tone="error"
          title="Couldn't load the review queue"
          action={
            <Button size="sm" onClick={load}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : !items ? (
        <Spinner label="Loading review queue…" />
      ) : scoped.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title={reviewedCount > 0 ? "All caught up" : "Nothing to review"}
            description={
              processing > 0
                ? "Waiting for documents to finish processing."
                : documentFilter
                  ? "Every line in this document has been reviewed."
                  : "Every line has been reviewed. Your totals are ready on the Filing page."
            }
            action={
              processing > 0 ? null : (
                <div className="flex gap-2">
                  {documentFilter ? (
                    <Button onClick={() => setSearchParams({})}>
                      Review other documents
                    </Button>
                  ) : (
                    <Button to="/documents">Upload more</Button>
                  )}
                  <Button to="/filing" variant="primary">
                    Go to filing <ArrowRight className="size-4" />
                  </Button>
                </div>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="flex max-h-[80vh] min-w-0 flex-col self-start lg:sticky lg:top-6">
            <div
              className="flex gap-4 border-b border-neutral-200 px-4 pt-3"
              role="tablist"
              aria-label="Filter lines"
            >
              {FILTERS.map((option) => {
                const count =
                  option.id === "all"
                    ? scoped.length
                    : option.id === "suggested"
                      ? suggested.length
                      : attention;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === option.id}
                    onClick={() => setFilter(option.id)}
                    className={cx(
                      "-mb-px flex items-center gap-1 border-b-2 pb-2.5 text-sm transition-colors",
                      filter === option.id
                        ? "border-neutral-950 font-medium text-neutral-950"
                        : "border-transparent text-neutral-500 hover:text-neutral-950",
                    )}
                  >
                    {option.label}
                    <span className="mono text-[11px] text-neutral-400">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex-1 overflow-y-auto">
              {visible.length === 0 ? (
                <p className="px-4 py-6 text-sm text-neutral-500">
                  No lines in this view.
                </p>
              ) : (
                groups.map(([documentId, group]) => (
                  <div
                    key={documentId}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <p className="sticky top-0 truncate bg-white px-4 pb-1 pt-3 text-xs font-semibold text-neutral-500">
                      {group.name}
                    </p>
                    <ul className="px-2 pb-2">
                      {group.items.map((item) => {
                        const active = selected?.id === item.id;
                        const meta = REASONS[reasonOf(item)];
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(item.id)}
                              className={cx(
                                "relative w-full rounded-md px-3 py-2.5 text-left transition-colors",
                                active
                                  ? "bg-neutral-100"
                                  : "hover:bg-neutral-50",
                              )}
                            >
                              {active && (
                                <span
                                  className="absolute inset-y-2 left-0 w-0.5 rounded-sm bg-emerald-600"
                                  aria-hidden
                                />
                              )}
                              <span className="block truncate text-sm font-medium text-neutral-950">
                                {item.line_description || "Line item"}
                              </span>
                              <span className="mt-1 flex items-center justify-between gap-2 text-xs">
                                <span
                                  className={cx(
                                    "flex items-center gap-1.5",
                                    meta.tone === "ok"
                                      ? "text-emerald-700"
                                      : "text-neutral-700",
                                  )}
                                >
                                  <span
                                    className={cx(
                                      "size-1.5 rounded-full",
                                      meta.tone === "ok"
                                        ? "bg-emerald-600"
                                        : "bg-neutral-950",
                                    )}
                                    aria-hidden
                                  />
                                  {meta.label}
                                </span>
                                <span className="mono text-neutral-500">
                                  {item.quantity_kg == null
                                    ? "—"
                                    : formatKgExact(item.quantity_kg)}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </Card>

          {selected ? (
            <Card className="grid min-w-0 gap-8 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:p-6">
              <DecisionPanel
                key={selected.id}
                item={selected}
                position={positionOf(selected)}
                categoriesTracked={Boolean(filing?.categories_tracked)}
                onDone={handleDone}
                modeRequest={modeRequest}
              />
              <SourcePanel
                key={selected.document_id}
                documentId={selected.document_id}
                needle={selected.line_description}
              />
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon={ClipboardCheck}
                title="No lines in this view"
                description="Switch to All to see every line."
              />
            </Card>
          )}
        </div>
      )}

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title={`Approve ${suggested.length} suggested line${suggested.length === 1 ? "" : "s"}?`}
        footer={
          <>
            <Button onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={approveSuggested}
              loading={bulkSaving}
            >
              Approve {suggested.length}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          These lines have an identified material, a weight in kg and high
          confidence. They'll be recorded as approved by you. Lines that need
          your input stay in the queue.
        </p>
      </Modal>
    </div>
  );
}
