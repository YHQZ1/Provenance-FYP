import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Circle, Loader2, Lock, Upload } from "lucide-react";
import { Alert, Button, Card, Skeleton, StageBadge } from "../components/ui";
import {
  CPCB_CATEGORIES,
  FY_MONTHS,
  MATERIALS,
  annualReturnDue,
  documentTypeLabel,
  formatDate,
  formatKg,
  fyLabel,
} from "../lib/domain";
import { useWorkspace } from "../lib/workspace";

const cx = (...classes) => classes.filter(Boolean).join(" ");
const DAY_MS = 86400000;

// One clear next step, derived from the same filing data the Filing page uses.
const nextAction = (filing, profileComplete) => {
  const counts = filing.counts;
  if (!profileComplete) {
    return {
      title: "Complete your company profile",
      body: "Your GSTIN and PIBO category appear on the filing and decide which obligations apply.",
      cta: "Open settings",
      to: "/settings",
    };
  }
  if (counts.documents === 0) {
    return {
      title: `Upload documents for ${filing.financial_year.label}`,
      body: "Start with purchase invoices for plastic packaging. Provenance reads each line and suggests the material.",
      cta: "Upload documents",
      to: "/documents",
    };
  }
  if (counts.failed > 0) {
    return {
      title: `${counts.failed} document(s) could not be processed`,
      body: "Retry them, or delete them if they are not needed.",
      cta: "Go to documents",
      to: "/documents",
    };
  }
  if (counts.pending_items > 0) {
    return {
      title: `Review ${counts.pending_items} line item(s)`,
      body: "Confirm the suggested material and weight for each line. Only reviewed lines count toward the filing.",
      cta: "Start review",
      to: "/review",
    };
  }
  if (counts.processing > 0) {
    return {
      title: `${counts.processing} document(s) are being processed`,
      body: "This page updates automatically. Review opens as soon as suggestions are ready.",
      busy: true,
    };
  }
  if (filing.status === "FINALIZED") {
    return {
      title: `${filing.financial_year.label} is finalized`,
      body: "Download the report for your records or for the CPCB portal.",
      cta: "Open filing",
      to: "/filing",
    };
  }
  if (filing.ready) {
    return {
      title: "Everything is reviewed. Ready to finalize.",
      body: "Check the totals and sign off the financial year.",
      cta: "Review filing",
      to: "/filing",
    };
  }
  return {
    title: "Add the documents that are still missing",
    body: filing.blockers[0]?.message,
    cta: "Open filing checklist",
    to: "/filing",
  };
};

/* ------------------------------------------------------------------ */
/* Derived insights. Everything here comes from the filing summary; nothing is estimated. */

const useInsights = (filing) =>
  useMemo(() => {
    if (!filing) return null;
    const start = filing.financial_year.start_year;
    const today = new Date();

    // Purchase-invoice intake per month of the financial year, by invoice date.
    const months = FY_MONTHS.map((label, index) => {
      const year = index < 9 ? start : start + 1;
      const month = ((index + 3) % 12) + 1;
      return {
        label,
        key: `${year}-${String(month).padStart(2, "0")}`,
        name: new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
          month: "long",
          year: "numeric",
        }),
        // A month can only be "missing" once it has started.
        started: new Date(year, month - 1, 1) <= today,
        kg: 0,
        documents: 0,
      };
    });
    const byKey = Object.fromEntries(months.map((m) => [m.key, m]));
    for (const doc of filing.documents) {
      if (doc.document_type !== "purchase_invoice") continue;
      const month = byKey[String(doc.effective_date).slice(0, 7)];
      if (!month) continue;
      month.documents += 1;
      month.kg += doc.verified_kg;
    }
    const missing = months.filter((m) => m.started && m.documents === 0);

    const introduced = filing.totals.introduced.total_kg;
    const recycled = filing.totals.recycled.total_kg;
    const due = annualReturnDue(start);
    const daysLeft = Math.ceil((due - today) / DAY_MS);
    const uploadDated = filing.documents.filter(
      (doc) => doc.date_source === "upload",
    ).length;

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
      {
        label: "Financial year finalized",
        done: filing.status === "FINALIZED",
        to: "/filing",
      },
    ];

    return {
      months,
      missing,
      introduced,
      recycled,
      coverage: introduced > 0 ? recycled / introduced : null,
      due,
      daysLeft,
      uploadDated,
      checks,
    };
  }, [filing]);

/* ------------------------------------------------------------------ */

function Panel({ title, description, action, children, className }) {
  return (
    // min-w-0 lets grid columns shrink below their longest unwrapped label on small screens.
    <Card className={cx("flex min-w-0 flex-col", className)}>
      <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-5">
        <div>
          <h2 className="text-sm font-semibold text-neutral-950">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="flex-1 px-5 pb-5 pt-4">{children}</div>
    </Card>
  );
}

function Kpi({ label, value, detail, foot }) {
  return (
    <Card className="flex min-w-0 flex-col px-5 py-4">
      <p className="mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-neutral-950">
        {value}
      </p>
      {detail && <p className="mt-2 text-xs text-neutral-500">{detail}</p>}
      {foot && <div className="mt-auto pt-4">{foot}</div>}
    </Card>
  );
}

function Meter({ value }) {
  return (
    <div className="h-1.5 rounded-sm bg-neutral-100" aria-hidden>
      <div
        className="h-1.5 rounded-sm bg-emerald-600"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

function NextStep({ filing, profileComplete, checks }) {
  const action = nextAction(filing, profileComplete);
  const done = checks.filter((check) => check.done).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-6 bg-neutral-950 px-6 py-6 text-white">
        <div className="max-w-2xl">
          <p className="mono text-[10px] uppercase tracking-[0.14em] text-emerald-500">
            Next step
          </p>
          <p className="mt-2 text-lg font-semibold">{action.title}</p>
          {action.body && (
            <p className="mt-1 text-sm text-neutral-400">{action.body}</p>
          )}
        </div>
        {action.busy ? (
          <span className="flex items-center gap-2 text-sm text-neutral-300">
            <Loader2 className="size-4 animate-spin" /> Processing…
          </span>
        ) : (
          <Button to={action.to} variant="accent">
            {action.cta} <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-4 px-6 py-3">
        <p className="mono shrink-0 text-[11px] text-neutral-500">
          {done} of {checks.length} checks
        </p>
        <div className="flex-1">
          <Meter value={done / checks.length} />
        </div>
      </div>
    </Card>
  );
}

function IntakeChart({ months, missing, startYear }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(...months.map((m) => m.kg));
  const scaleMax = max > 0 ? niceCeiling(max) : 1;
  const ticks = [scaleMax, scaleMax / 2, 0];

  return (
    <div>
      <div className="relative flex h-56 gap-2">
        {/* y-axis */}
        <div className="flex w-14 shrink-0 flex-col justify-between pb-6 text-right">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="mono -translate-y-1/2 text-[10px] text-neutral-400 first:translate-y-0 last:translate-y-0"
            >
              {max > 0 ? formatKg(tick) : ""}
            </span>
          ))}
        </div>

        <div className="relative flex-1">
          {/* gridlines */}
          <div
            className="absolute inset-x-0 bottom-6 top-0 flex flex-col justify-between"
            aria-hidden
          >
            {ticks.map((tick) => (
              <span key={tick} className="h-px bg-neutral-100" />
            ))}
          </div>

          <div className="absolute inset-0 grid grid-cols-12 gap-1">
            {months.map((month, index) => {
              const height = max > 0 ? (month.kg / scaleMax) * 100 : 0;
              const isGap = month.started && month.documents === 0;
              return (
                <div
                  key={month.key}
                  className="relative flex flex-col items-center"
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(index)}
                  onBlur={() => setHovered(null)}
                  tabIndex={0}
                  aria-label={`${month.name}: ${month.documents} purchase invoice(s), ${formatKg(month.kg)} reviewed`}
                >
                  <div className="relative flex w-full flex-1 items-end justify-center pb-0">
                    {isGap ? (
                      <span
                        className="mb-0 h-6 w-full max-w-6 border border-dashed border-neutral-300"
                        aria-hidden
                      />
                    ) : (
                      <span
                        className={cx(
                          "w-full max-w-6 rounded-t-[3px] transition-colors",
                          hovered === index
                            ? "bg-emerald-700"
                            : "bg-emerald-600",
                          month.kg === 0 && "bg-neutral-200",
                        )}
                        style={{
                          height:
                            month.kg > 0
                              ? `max(${height}%, 3px)`
                              : month.documents
                                ? "3px"
                                : 0,
                        }}
                        aria-hidden
                      />
                    )}
                  </div>
                  <span
                    className={cx(
                      "mono h-6 pt-1.5 text-[10px]",
                      isGap ? "text-neutral-950" : "text-neutral-400",
                    )}
                  >
                    {month.label}
                  </span>

                  {hovered === index && (
                    <div className="pointer-events-none absolute bottom-full z-20 mb-1 w-max rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
                      <p className="font-medium text-neutral-950">
                        {month.name}
                      </p>
                      <p className="mt-0.5 text-neutral-600">
                        {month.documents === 0
                          ? month.started
                            ? "No purchase invoices"
                            : "Not started yet"
                          : `${formatKg(month.kg)} reviewed · ${month.documents} invoice${month.documents === 1 ? "" : "s"}`}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-neutral-100 pt-4 text-sm">
        {missing.length === 0 ? (
          <p className="text-neutral-600">
            Every month of {fyLabel(startYear)} so far has at least one purchase
            invoice.
          </p>
        ) : (
          <p className="text-neutral-600">
            <span className="font-medium text-neutral-950">
              No purchase invoices dated in{" "}
              {listMonths(missing.map((m) => m.label))}.
            </span>{" "}
            If you bought plastic packaging in{" "}
            {missing.length === 1 ? "that month" : "those months"}, upload the
            invoices so the year is complete.
          </p>
        )}
      </div>
    </div>
  );
}

const listMonths = (labels) =>
  labels.length <= 2
    ? labels.join(" and ")
    : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;

// Rounds an axis maximum up to 1, 2 or 5 × a power of ten.
function niceCeiling(value) {
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((m) => m * power >= value);
  return step * power;
}

function Breakdown({ rows, total, empty }) {
  if (rows.length === 0)
    return <p className="text-sm text-neutral-500">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.kg));
  return (
    <ul className="space-y-4">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
            <span className="min-w-0 truncate">
              <span className="font-medium text-neutral-950">{row.title}</span>
              {row.subtitle && (
                <span className="text-neutral-500"> · {row.subtitle}</span>
              )}
            </span>
            <span className="shrink-0 tabular-nums text-neutral-600">
              {formatKg(row.kg)}
              <span className="mono ml-2 text-[11px] text-neutral-400">
                {Math.round((row.kg / total) * 100)}%
              </span>
            </span>
          </div>
          <div className="h-1.5 rounded-sm bg-neutral-100" aria-hidden>
            <div
              className="h-1.5 rounded-sm bg-emerald-600"
              style={{ width: `${(row.kg / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Pipeline({ counts }) {
  const stages = [
    {
      key: "processing",
      label: "Processing",
      hint: "Being read and classified",
    },
    { key: "review", label: "Needs review", hint: "Lines waiting for you" },
    { key: "verified", label: "Reviewed", hint: "Counted in the filing" },
    { key: "failed", label: "Failed", hint: "Retry or delete" },
    {
      key: "evidence",
      label: "Stored as evidence",
      hint: "EPR records, not quantified",
    },
  ];
  const total = counts.documents || 0;

  return (
    <ul className="divide-y divide-neutral-100">
      {stages.map((stage) => {
        const value = counts[stage.key] || 0;
        return (
          <li key={stage.key} className="flex items-center gap-4 py-2.5">
            <span className="w-40 shrink-0">
              <span
                className={cx(
                  "block text-sm",
                  stage.key === "failed" && value > 0
                    ? "font-medium text-red-700"
                    : "text-neutral-950",
                )}
              >
                {stage.label}
              </span>
              <span className="block text-xs text-neutral-500">
                {stage.hint}
              </span>
            </span>
            <span className="flex-1">
              <span
                className="block h-1.5 rounded-sm bg-neutral-100"
                aria-hidden
              >
                <span
                  className={cx(
                    "block h-1.5 rounded-sm",
                    stage.key === "failed" ? "bg-red-600" : "bg-neutral-950",
                  )}
                  style={{ width: total ? `${(value / total) * 100}%` : 0 }}
                />
              </span>
            </span>
            <span className="mono w-8 shrink-0 text-right text-sm tabular-nums text-neutral-950">
              {value}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Checklist({ checks }) {
  return (
    <ul className="space-y-1">
      {checks.map((check) => (
        <li key={check.label}>
          <Link
            to={check.to}
            className="group flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-neutral-50"
          >
            {check.done ? (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-emerald-600 text-white">
                <Check className="size-3" strokeWidth={3} aria-hidden />
              </span>
            ) : (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-neutral-300 text-neutral-400">
                <Circle className="size-2" aria-hidden />
              </span>
            )}
            <span
              className={cx(
                "flex-1",
                check.done
                  ? "text-neutral-500"
                  : "font-medium text-neutral-950",
              )}
            >
              {check.label}
            </span>
            {!check.done && (
              <ArrowRight
                className="size-3.5 text-neutral-400 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RecentDocuments({ documents }) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No documents dated in this financial year yet.
      </p>
    );
  }
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
            <th className="px-5 pb-2 font-medium">Document</th>
            <th className="px-3 pb-2 font-medium">Dated</th>
            <th className="px-3 pb-2 font-medium">Status</th>
            <th className="px-5 pb-2 text-right font-medium">Reviewed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-neutral-50">
              <td className="max-w-xs px-5 py-2.5">
                <Link
                  to={`/documents?open=${doc.id}`}
                  className="block truncate font-medium text-neutral-950 hover:underline"
                >
                  {doc.filename}
                </Link>
                <span className="text-xs text-neutral-500">
                  {doc.document_type_label ||
                    documentTypeLabel(doc.document_type)}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-neutral-600">
                {formatDate(doc.effective_date)}
                {doc.date_source === "upload" && (
                  <span className="block text-xs text-neutral-400">
                    upload date
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <StageBadge stage={doc.stage} />
              </td>
              <td className="mono whitespace-nowrap px-5 py-2.5 text-right text-neutral-950">
                {doc.stage === "evidence" ? "—" : formatKg(doc.verified_kg)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function Home() {
  const { filing, filingError, refreshFiling, profileComplete, company } =
    useWorkspace();
  const insights = useInsights(filing);

  if (filingError && !filing) {
    return (
      <Alert
        tone="error"
        title="Couldn't load your workspace"
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

  if (!filing || !insights) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-36 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const label = filing.financial_year.label;
  const finalized = filing.status === "FINALIZED";
  const introducedRows = Object.entries(filing.totals.introduced.by_material)
    .sort((a, b) => b[1] - a[1])
    .map(([code, kg]) => ({
      key: code,
      title: code,
      subtitle: MATERIALS.find((m) => m.code === code)?.name.split("— ")[1],
      kg,
    }));
  const categoryRows = Object.entries(
    filing.totals.introduced.by_category || {},
  )
    .sort((a, b) => b[1] - a[1])
    .map(([key, kg]) => ({
      key,
      title: CPCB_CATEGORIES[key]?.short || key,
      subtitle: CPCB_CATEGORIES[key]?.label,
      kg,
    }));
  const showCategories = filing.categories_tracked && categoryRows.length > 0;

  const { daysLeft } = insights;
  const dueDetail = finalized
    ? `Finalized ${formatDate(filing.finalized_at)}`
    : daysLeft < 0
      ? `${Math.abs(daysLeft)} days overdue`
      : daysLeft === 0
        ? "Due today"
        : `${daysLeft} days left`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
            {label} · Plastic EPR
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {company?.company_name || "Overview"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button to="/filing">Open filing</Button>
          <Button to="/documents" variant="primary">
            <Upload className="size-4" /> Upload documents
          </Button>
        </div>
      </div>

      <NextStep
        filing={filing}
        profileComplete={profileComplete}
        checks={insights.checks}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Plastic introduced"
          value={formatKg(insights.introduced)}
          detail={`From reviewed purchase invoices · ${introducedRows.length} material${introducedRows.length === 1 ? "" : "s"}`}
        />
        <Kpi
          label="Recycling evidence"
          value={formatKg(insights.recycled)}
          detail={
            insights.coverage == null
              ? "Shown against plastic introduced once invoices are reviewed"
              : `Certificates equal to ${Math.round(insights.coverage * 100)}% of plastic introduced`
          }
          foot={
            insights.coverage != null && <Meter value={insights.coverage} />
          }
        />
        <Kpi
          label="Waiting for review"
          value={filing.counts.pending_items}
          detail={
            filing.counts.processing > 0
              ? `${filing.counts.processing} document(s) still processing`
              : filing.counts.pending_items === 0
                ? "Nothing waiting"
                : "Lines that don't count until reviewed"
          }
          foot={
            filing.counts.pending_items > 0 && (
              <Link
                to="/review"
                className="inline-flex items-center gap-1 text-sm font-medium text-neutral-950 hover:text-emerald-700"
              >
                Start review <ArrowRight className="size-3.5" />
              </Link>
            )
          }
        />
        <Kpi
          label="Annual return due"
          value={insights.due.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          detail={dueDetail}
          foot={
            finalized ? (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
                <Lock className="size-3.5" /> Year finalized
              </span>
            ) : null
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Purchase invoices by month"
          description={`Reviewed plastic introduced in ${label}, by invoice date. Dashed months have no invoices yet.`}
        >
          <IntakeChart
            months={insights.months}
            missing={insights.missing}
            startYear={filing.financial_year.start_year}
          />
        </Panel>

        <Panel
          title="Readiness"
          description="What stands between you and a finalized year."
        >
          <Checklist checks={insights.checks} />
          {(filing.warnings?.length > 0 || insights.uploadDated > 0) && (
            <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4 text-sm text-neutral-600">
              {insights.uploadDated > 0 && (
                <p>
                  <span className="font-medium text-neutral-950">
                    {insights.uploadDated} document(s)
                  </span>{" "}
                  had no readable invoice date and use their upload date.{" "}
                  <Link
                    to="/documents"
                    className="font-medium text-neutral-950 underline underline-offset-2"
                  >
                    Confirm dates
                  </Link>
                </p>
              )}
              {filing.warnings?.map((warning) => (
                <p key={warning.key}>{warning.message}</p>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Plastic introduced by material"
          description="Share of reviewed purchase-invoice quantities."
        >
          <Breakdown
            rows={introducedRows}
            total={insights.introduced}
            empty="Quantities appear here as purchase-invoice lines are reviewed."
          />
        </Panel>

        <Panel
          title="By CPCB category"
          description="EPR targets are set per category."
        >
          {showCategories ? (
            <Breakdown
              rows={categoryRows}
              total={insights.introduced}
              empty=""
            />
          ) : (
            <p className="text-sm text-neutral-500">
              Category totals appear here as classified lines are reviewed.
            </p>
          )}
        </Panel>

        <Panel
          title="Document pipeline"
          description={`${filing.counts.documents} document(s) dated in ${label}.`}
        >
          <Pipeline counts={filing.counts} />
        </Panel>
      </div>

      <Panel
        title="Latest documents"
        description="Most recent by document date."
        action={
          <Link
            to="/documents"
            className="inline-flex items-center gap-1 text-sm font-medium text-neutral-950 hover:text-emerald-700"
          >
            All documents <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        <RecentDocuments documents={filing.documents.slice(0, 6)} />
      </Panel>
    </div>
  );
}
