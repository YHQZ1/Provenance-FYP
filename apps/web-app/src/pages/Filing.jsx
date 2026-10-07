import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Circle,
  Download,
  FileJson,
  FileSpreadsheet,
  Lock,
  Printer,
  Unlock,
} from "lucide-react";
import { filingAPI } from "../lib/api";
import { CPCB_CATEGORIES, MATERIALS, formatDate, formatKg, formatKgExact } from "../lib/domain";
import { useWorkspace } from "../lib/workspace";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Modal,
  Skeleton,
  StageBadge,
  Textarea,
  useToast,
} from "../components/ui";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const ACTION_LINKS = {
  settings: "/settings",
  documents: "/documents",
  review: "/review",
};

const download = (filename, content, type) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const toCsv = (report) => {
  const rows = [["Section", "Item", "Value (kg)"]];
  rows.push(["Entity", "Company", report.entity.company_name || ""]);
  rows.push(["Entity", "GSTIN", report.entity.gst_number || ""]);
  rows.push(["Entity", "EPR registration number", report.entity.epr_registration_number || ""]);
  rows.push(["Entity", "PIBO category", (report.entity.pibo_category || []).join(" / ")]);
  rows.push(["Period", "Financial year", report.financial_year.label]);
  rows.push(["Period", "Status", report.status]);
  for (const [section, label] of [
    ["introduced", "Plastic introduced"],
    ["recycled", "Recycling certificates"],
    ["collected", "Collection receipts"],
  ]) {
    for (const [code, kg] of Object.entries(report.totals[section].by_material))
      rows.push([label, code, kg]);
    rows.push([label, "Total", report.totals[section].total_kg]);
  }
  for (const [category, kg] of Object.entries(report.totals.introduced.by_category || {})) {
    rows.push([
      "Plastic introduced by CPCB category",
      CPCB_CATEGORIES[category]?.short || category,
      kg,
    ]);
  }
  for (const doc of report.documents) {
    rows.push([
      "Evidence",
      `${doc.filename} (${doc.document_type_label}, ${String(doc.effective_date).slice(0, 10)})`,
      doc.verified_kg,
    ]);
  }
  return rows
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
};

const share = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

function ExportMenu({ report, fileStem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => !ref.current?.contains(event.target) && setOpen(false);
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options = [
    {
      icon: FileSpreadsheet,
      label: "CSV spreadsheet",
      hint: "Totals and evidence, one row each",
      run: () => download(`${fileStem}.csv`, toCsv(report), "text/csv"),
    },
    {
      icon: FileJson,
      label: "JSON",
      hint: "The full position, for other systems",
      run: () => download(`${fileStem}.json`, JSON.stringify(report, null, 2), "application/json"),
    },
    {
      icon: Printer,
      label: "Print or save as PDF",
      hint: "A clean report of this page",
      run: () => window.print(),
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <Button onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu">
        <Download className="size-4" /> Export{" "}
        <ChevronDown className={cx("size-3.5 transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-md border border-neutral-200 bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
        >
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                option.run();
              }}
              className="flex w-full items-start gap-3 rounded-sm px-3 py-2.5 text-left hover:bg-neutral-50"
            >
              <option.icon className="mt-0.5 size-4 shrink-0 text-neutral-500" aria-hidden />
              <span>
                <span className="block text-sm font-medium text-neutral-950">{option.label}</span>
                <span className="block text-xs text-neutral-500">{option.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Panel({ title, description, action, children, className, flush }) {
  return (
    <Card className={cx("min-w-0", flush && "overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-1 pt-5">
        <div>
          <h2 className="text-sm font-semibold text-neutral-950">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className={flush ? "pt-3" : "px-5 pb-5 pt-4"}>{children}</div>
    </Card>
  );
}

function Kpi({ label, value, exact, detail }) {
  return (
    <Card className="min-w-0 px-5 py-4">
      <p className="mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-neutral-950">
        {value}
      </p>
      {exact && <p className="mono mt-1.5 text-xs text-neutral-500">{exact}</p>}
      {detail && <p className="mt-2 text-xs text-neutral-500">{detail}</p>}
    </Card>
  );
}

function Readiness({ filing, onFinalize }) {
  const blocked = new Set(filing.blockers.map((b) => b.key));
  const checks = [
    {
      label: "Company profile complete",
      done: !blocked.has("gst") && !blocked.has("pibo"),
      to: "/settings",
    },
    {
      label: "Documents uploaded",
      done: filing.counts.documents > 0,
      to: "/documents",
    },
    {
      label: "All documents processed",
      done: !blocked.has("processing") && !blocked.has("failed"),
      to: "/documents",
    },
    {
      label: "Every line reviewed",
      done: !blocked.has("review") && filing.counts.documents > 0,
      to: "/review",
    },
    {
      label: "Plastic introduced recorded",
      done: !blocked.has("introduced"),
      to: "/documents",
    },
  ];
  const messages = Object.fromEntries(filing.blockers.map((b) => [b.key, b.message]));
  const detailFor = (check) =>
    check.done
      ? null
      : check.label === "Company profile complete"
        ? [messages.gst, messages.pibo].filter(Boolean).join(" ")
        : check.label === "All documents processed"
          ? [messages.processing, messages.failed].filter(Boolean).join(" ")
          : check.label === "Every line reviewed"
            ? messages.review
            : check.label === "Plastic introduced recorded"
              ? messages.introduced
              : "Upload purchase invoices to begin.";
  const done = checks.filter((check) => check.done).length;

  return (
    <Card className="grid min-w-0 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-neutral-950">Before you finalize</h2>
          <span className="mono text-[11px] text-neutral-500">
            {done} of {checks.length} done
          </span>
        </div>
        <ul className="mt-4 space-y-1">
          {checks.map((check) => (
            <li key={check.label}>
              <div className="flex items-start gap-3 rounded-md px-2 py-2">
                {check.done ? (
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm bg-emerald-600 text-white">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                ) : (
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border border-neutral-300 text-neutral-400">
                    <Circle className="size-2" aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={cx(
                      "block text-sm",
                      check.done ? "text-neutral-500" : "font-medium text-neutral-950",
                    )}
                  >
                    {check.label}
                  </span>
                  {!check.done && detailFor(check) && (
                    <span className="block text-xs text-neutral-500">{detailFor(check)}</span>
                  )}
                </span>
                {!check.done && (
                  <Link
                    to={check.to}
                    className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-neutral-950 hover:text-emerald-700"
                  >
                    Fix <ArrowRight className="size-3.5" />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
        {filing.warnings?.length > 0 && (
          <div className="mt-4 space-y-1 border-t border-neutral-100 pt-4 text-sm text-neutral-600">
            {filing.warnings.map((warning) => (
              <p key={warning.key}>{warning.message}</p>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col justify-between gap-6 border-t border-neutral-100 bg-neutral-50 px-5 py-5 lg:border-l lg:border-t-0">
        {filing.ready ? (
          <div>
            <p className="text-sm font-semibold text-neutral-950">Ready to finalize</p>
            <p className="mt-1 text-sm text-neutral-600">
              Finalizing records these totals as your signed-off position for{" "}
              {filing.financial_year.label} and locks its documents. You can reopen it later if
              something changes.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-neutral-950">Not ready yet</p>
            <p className="mt-1 text-sm text-neutral-600">
              Finish the {checks.length - done} open item
              {checks.length - done === 1 ? "" : "s"} in the list. It updates as you work.
            </p>
          </div>
        )}
        <div>
          <Button
            variant="primary"
            onClick={onFinalize}
            disabled={!filing.ready || !filing.finalization_available}
            className="w-full"
          >
            <Lock className="size-4" /> Finalize {filing.financial_year.label}
          </Button>
          {!filing.finalization_available && (
            <p className="mt-2 text-xs text-neutral-500">
              Finalizing needs the <code className="mono">fy_filings</code> table. Run{" "}
              <code className="mono">supabase/migrations/001_fy_filings.sql</code>.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function MaterialTable({ totals }) {
  const codes = [
    ...new Set([
      ...Object.keys(totals.introduced.by_material),
      ...Object.keys(totals.recycled.by_material),
      ...Object.keys(totals.collected.by_material),
    ]),
  ].sort(
    (a, b) => (totals.introduced.by_material[b] || 0) - (totals.introduced.by_material[a] || 0),
  );

  if (codes.length === 0) {
    return (
      <p className="px-5 pb-5 text-sm text-neutral-500">
        No reviewed quantities yet. Totals appear as you approve lines in Review.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-y border-neutral-100 text-left text-xs text-neutral-500">
            <th className="px-5 py-2.5 font-medium">Material</th>
            <th className="px-3 py-2.5 text-right font-medium">Introduced</th>
            <th className="px-3 py-2.5 text-right font-medium">Share</th>
            <th className="px-3 py-2.5 text-right font-medium">Recycling certificates</th>
            <th className="px-5 py-2.5 text-right font-medium">Collected</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {codes.map((code) => {
            const introduced = totals.introduced.by_material[code] || 0;
            return (
              <tr key={code}>
                <td className="px-5 py-3">
                  <span className="font-medium text-neutral-950">{code}</span>
                  <span className="text-neutral-500">
                    {" "}
                    · {MATERIALS.find((m) => m.code === code)?.name.split("— ")[1] || ""}
                  </span>
                </td>
                <td className="mono whitespace-nowrap px-3 py-3 text-right text-neutral-950">
                  {formatKgExact(introduced)}
                </td>
                <td className="mono whitespace-nowrap px-3 py-3 text-right text-neutral-500">
                  {share(introduced, totals.introduced.total_kg)}
                </td>
                <td className="mono whitespace-nowrap px-3 py-3 text-right text-neutral-700">
                  {formatKgExact(totals.recycled.by_material[code] || 0)}
                </td>
                <td className="mono whitespace-nowrap px-5 py-3 text-right text-neutral-700">
                  {formatKgExact(totals.collected.by_material[code] || 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-200 bg-neutral-50 font-semibold">
            <td className="px-5 py-3">Total</td>
            <td className="mono whitespace-nowrap px-3 py-3 text-right">
              {formatKgExact(totals.introduced.total_kg)}
            </td>
            <td className="mono whitespace-nowrap px-3 py-3 text-right text-neutral-500">100%</td>
            <td className="mono whitespace-nowrap px-3 py-3 text-right">
              {formatKgExact(totals.recycled.total_kg)}
            </td>
            <td className="mono whitespace-nowrap px-5 py-3 text-right">
              {formatKgExact(totals.collected.total_kg)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CategoryTable({ totals }) {
  const rows = Object.entries(totals.introduced.by_category || {}).sort((a, b) => b[1] - a[1]);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-y border-neutral-100 text-left text-xs text-neutral-500">
          <th className="px-5 py-2.5 font-medium">Category</th>
          <th className="px-3 py-2.5 text-right font-medium">Introduced</th>
          <th className="px-5 py-2.5 text-right font-medium">Share</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-100">
        {rows.map(([key, kg]) => (
          <tr key={key}>
            <td className="px-5 py-3">
              <span className="block font-medium text-neutral-950">
                {CPCB_CATEGORIES[key]?.short || key}
              </span>
              <span className="block text-xs text-neutral-500">{CPCB_CATEGORIES[key]?.label}</span>
            </td>
            <td className="mono whitespace-nowrap px-3 py-3 text-right text-neutral-950">
              {formatKgExact(kg)}
            </td>
            <td className="mono whitespace-nowrap px-5 py-3 text-right text-neutral-500">
              {share(kg, totals.introduced.total_kg)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EvidenceTable({ documents }) {
  if (documents.length === 0) {
    return (
      <p className="px-5 pb-5 text-sm text-neutral-500">
        No documents are dated in this financial year.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-y border-neutral-100 text-left text-xs text-neutral-500">
            <th className="px-5 py-2.5 font-medium">Document</th>
            <th className="px-3 py-2.5 font-medium">Type</th>
            <th className="px-3 py-2.5 font-medium">Dated</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-5 py-2.5 text-right font-medium">Counted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-neutral-50">
              <td className="max-w-xs px-5 py-3">
                <Link
                  to={`/documents?open=${doc.id}`}
                  className="block truncate font-medium text-neutral-950 hover:underline"
                >
                  {doc.filename}
                </Link>
              </td>
              <td className="px-3 py-3 text-neutral-600">{doc.document_type_label}</td>
              <td className="whitespace-nowrap px-3 py-3 text-neutral-600">
                {formatDate(doc.effective_date)}
                {doc.date_source === "upload" && (
                  <span className="block text-xs text-neutral-400">upload date</span>
                )}
              </td>
              <td className="px-3 py-3">
                <StageBadge stage={doc.stage} />
              </td>
              <td className="mono whitespace-nowrap px-5 py-3 text-right text-neutral-950">
                {doc.stage === "evidence" ? "—" : formatKgExact(doc.verified_kg)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegulatoryCheck({ fy }) {
  const [state, setState] = useState({
    loading: false,
    result: null,
    error: null,
  });

  const run = async () => {
    setState({ loading: true, result: null, error: null });
    try {
      const response = await filingAPI.regulatoryReview(fy);
      setState({ loading: false, result: response.data, error: null });
    } catch (error) {
      setState({ loading: false, result: null, error: error.message });
    }
  };

  return (
    <Panel
      className="print:hidden"
      title="Regulatory check"
      description="Ask the CPCB and SEBI source library about this year's position. Answers cite the document and page, and can take up to a minute."
      action={
        <Button size="sm" onClick={run} loading={state.loading}>
          {!state.loading && <BookOpen className="size-3.5" />}{" "}
          {state.result ? "Run again" : "Run check"}
        </Button>
      }
    >
      {state.error ? (
        <Alert tone="warn" title="The regulatory service didn't respond">
          {state.error} This doesn't affect your filing.
        </Alert>
      ) : state.result ? (
        <div className="space-y-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
            {state.result.answer}
          </p>
          {state.result.sources?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {state.result.sources.map((source, index) => (
                <a
                  key={`${source.url}-${index}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-950 hover:border-neutral-400"
                >
                  {source.name || source.url}
                  {source.pages?.length > 0 && (
                    <span className="mono ml-1.5 text-neutral-500">
                      p. {source.pages.join(", ")}
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}
          <p className="text-xs text-neutral-400">
            AI-generated from the source library. Check the cited pages before relying on it.
          </p>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">Not run yet.</p>
      )}
    </Panel>
  );
}

export default function Filing() {
  const { filing: live, filingError, refreshFiling, fy } = useWorkspace();
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const notify = useToast();

  if (filingError && !live) {
    return (
      <Alert
        tone="error"
        title="Couldn't load the filing"
        action={
          <Button size="sm" onClick={refreshFiling}>
            Retry
          </Button>
        }
      >
        {filingError}
      </Alert>
    );
  }
  if (!live) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const finalized = live.status === "FINALIZED";
  const report = finalized && live.snapshot ? { ...live.snapshot, status: "FINALIZED" } : live;
  const label = report.financial_year.label;
  const totals = report.totals;
  const changedSinceFinalized =
    finalized &&
    live.snapshot &&
    (live.totals.introduced.total_kg !== live.snapshot.totals.introduced.total_kg ||
      live.totals.recycled.total_kg !== live.snapshot.totals.recycled.total_kg ||
      live.counts.documents !== live.snapshot.counts.documents);
  const lateDocuments = (finalized && live.late_documents) || [];
  const showCategories =
    report.categories_tracked && Object.keys(totals.introduced.by_category || {}).length > 0;
  const coverage =
    totals.introduced.total_kg > 0 ? totals.recycled.total_kg / totals.introduced.total_kg : null;
  const fileStem = `provenance-epr-${label.replace(/\s+/g, "-").toLowerCase()}`;

  const finalize = async () => {
    setSaving(true);
    try {
      await filingAPI.finalize(fy, notes);
      notify(`${label} finalized`);
      setFinalizeOpen(false);
      refreshFiling();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const reopen = async () => {
    setSaving(true);
    try {
      await filingAPI.reopen(fy);
      notify(`${label} reopened for changes`);
      setReopenOpen(false);
      refreshFiling();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="hidden border-b border-neutral-300 pb-4 print:block">
        <p className="text-lg font-semibold">Plastic EPR position · {label}</p>
        <p className="text-sm">
          {report.entity.company_name || "Company"} · GSTIN {report.entity.gst_number || "not set"}{" "}
          · EPR registration {report.entity.epr_registration_number || "not set"} ·{" "}
          {(report.entity.pibo_category || []).join(", ") || "PIBO category not set"}
        </p>
        <p className="text-xs text-neutral-600">
          {finalized ? `Finalized ${formatDate(live.finalized_at, true)}` : "Draft, not finalized"}{" "}
          · generated {formatDate(new Date(), true)}
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
            Step 3 · Filing
          </p>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{label} EPR position</h1>
            <Badge tone={finalized ? "ok" : "neutral"}>
              {finalized && <Lock className="size-3" />}
              {finalized ? "Finalized" : "Open"}
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Built only from reviewed lines. {report.entity.company_name || "Your company"} · GSTIN{" "}
            {report.entity.gst_number || "not set"}
            {report.entity.epr_registration_number &&
              ` · EPR ${report.entity.epr_registration_number}`}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu report={report} fileStem={fileStem} />
        </div>
      </div>

      {finalized ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-emerald-200 bg-emerald-50/50 px-5 py-4 print:hidden">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white">
              <Lock className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-neutral-950">
                Finalized on {formatDate(live.finalized_at, true)}
              </p>
              <p className="mt-0.5 text-sm text-neutral-600">
                These are your signed-off numbers. Documents dated in {label} are locked until you
                reopen the year.
              </p>
            </div>
          </div>
          <Button onClick={() => setReopenOpen(true)}>
            <Unlock className="size-4" /> Reopen year
          </Button>
        </Card>
      ) : (
        <Readiness filing={live} onFinalize={() => setFinalizeOpen(true)} />
      )}

      {lateDocuments.length > 0 && (
        <Alert
          tone="warn"
          title={`${lateDocuments.length} ${lateDocuments.length === 1 ? "document is" : "documents are"} dated in ${label} but arrived after it was finalized`}
          action={
            <Button size="sm" to="/documents">
              View documents
            </Button>
          }
        >
          {lateDocuments
            .slice(0, 3)
            .map((d) => d.filename)
            .join(", ")}
          {lateDocuments.length > 3 && ` and ${lateDocuments.length - 3} more`}. They aren't in the
          signed-off numbers. Reopen the year to review and include them, or delete them if they
          don't belong.
        </Alert>
      )}
      {changedSinceFinalized && lateDocuments.length === 0 && (
        <Alert tone="warn" title="Your documents have changed since this year was finalized">
          The numbers below are the signed-off ones. Reopen the year and finalize again to include
          the changes.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Plastic introduced"
          value={formatKg(totals.introduced.total_kg)}
          exact={formatKgExact(totals.introduced.total_kg)}
          detail="Reviewed purchase invoices"
        />
        <Kpi
          label="Recycling certificates"
          value={formatKg(totals.recycled.total_kg)}
          exact={formatKgExact(totals.recycled.total_kg)}
          detail="Reviewed recycler certificates"
        />
        <Kpi
          label="Collected"
          value={formatKg(totals.collected.total_kg)}
          exact={formatKgExact(totals.collected.total_kg)}
          detail="Reviewed collection receipts"
        />
        <Kpi
          label="Evidence coverage"
          value={coverage == null ? "—" : `${Math.round(coverage * 100)}%`}
          detail="Recycling certificates as a share of plastic introduced. Not your EPR target, which is set per category."
        />
      </div>

      <div
        className={cx(
          "grid gap-4",
          showCategories && "xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]",
        )}
      >
        <Panel
          title="Totals by material"
          description="Exact reviewed quantities by polymer, with recycling and collection evidence alongside."
          flush
        >
          <MaterialTable totals={totals} />
        </Panel>
        {showCategories && (
          <Panel
            title="Plastic introduced by CPCB category"
            description="EPR targets are set per category."
            flush
          >
            <CategoryTable totals={totals} />
          </Panel>
        )}
      </div>

      <Panel
        title="Evidence"
        description={`${report.counts.documents} document(s) dated in ${label}${
          report.counts.excluded_items
            ? ` · ${report.counts.excluded_items} line(s) excluded during review`
            : ""
        }.`}
        action={
          <Link
            to="/documents"
            className="inline-flex items-center gap-1 text-sm font-medium text-neutral-950 hover:text-emerald-700 print:hidden"
          >
            All documents <ArrowRight className="size-3.5" />
          </Link>
        }
        flush
      >
        <EvidenceTable documents={report.documents} />
      </Panel>

      <RegulatoryCheck fy={fy} />

      <p className="text-xs leading-relaxed text-neutral-500">
        Provenance prepares your EPR position and the evidence behind it. It does not submit to the
        CPCB portal. References:{" "}
        {report.source_basis?.map((source, index) => (
          <span key={source.url}>
            {index > 0 && ", "}
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-neutral-950"
            >
              {source.title}
            </a>
          </span>
        ))}
        .
      </p>

      <Modal
        open={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        title={`Finalize ${label}?`}
        description="This records the totals below as your signed-off position and locks this year's documents."
        footer={
          <>
            <Button onClick={() => setFinalizeOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={finalize} loading={saving}>
              <Lock className="size-4" /> Finalize
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <dl className="divide-y divide-neutral-100 rounded-md border border-neutral-200">
            {[
              ["Plastic introduced", formatKgExact(live.totals.introduced.total_kg)],
              ["Recycling certificates", formatKgExact(live.totals.recycled.total_kg)],
              ["Collected", formatKgExact(live.totals.collected.total_kg)],
              ["Documents", live.counts.documents],
            ].map(([term, value]) => (
              <div key={term} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <dt className="text-neutral-600">{term}</dt>
                <dd className="mono font-medium text-neutral-950">{value}</dd>
              </div>
            ))}
          </dl>
          <Field
            label="Note (optional)"
            htmlFor="finalize-notes"
            hint="Anything an auditor should know about this year."
          >
            <Textarea
              id="finalize-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <p className="text-xs text-neutral-500">
            You can reopen the year later if something changes.
          </p>
        </div>
      </Modal>

      <Modal
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        title={`Reopen ${label}?`}
        footer={
          <>
            <Button onClick={() => setReopenOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={reopen} loading={saving}>
              <Unlock className="size-4" /> Reopen
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          The signed-off snapshot is discarded and this year's documents can be changed again.
          You'll need to finalize again afterwards.
        </p>
      </Modal>
    </div>
  );
}
