import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Ban,
  Building2,
  Check,
  CheckCheck,
  Download,
  FileText,
  History,
  Lock,
  Pencil,
  RotateCw,
  Scale,
  Tag,
  Trash2,
  Unlock,
  Upload,
} from "lucide-react";
import { activityAPI } from "../lib/api";
import { fyLabel, formatKgExact } from "../lib/domain";
import { useWorkspace } from "../lib/workspace";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Select,
  Skeleton,
  useToast,
} from "../components/ui";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const GROUPS = [
  { id: "", label: "All" },
  { id: "documents", label: "Documents" },
  { id: "review", label: "Review" },
  { id: "filing", label: "Filing" },
  { id: "settings", label: "Settings" },
];

const ICONS = {
  "document.uploaded": Upload,
  "document.deleted": Trash2,
  "document.retried": RotateCw,
  "document.redated": Pencil,
  "line.approved": Check,
  "line.corrected": Pencil,
  "line.excluded": Ban,
  "lines.approved_in_bulk": CheckCheck,
  "filing.finalized": Lock,
  "filing.reopened": Unlock,
  "obligations.updated": Scale,
  "company.updated": Building2,
  "trade_name.added": Tag,
  "trade_name.removed": Tag,
};

const PAGE_SIZE = 50;

const dayKey = (value) => new Date(value).toDateString();

const dayLabel = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const timeLabel = (value) =>
  new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

// The second line under an event: the specifics a reviewer or auditor would ask about.
const detailLine = (event) => {
  const d = event.details || {};
  switch (event.action) {
    case "line.approved":
      return [d.line, d.quantity_kg != null && formatKgExact(d.quantity_kg)];
    case "line.corrected":
      return [
        d.line,
        d.from &&
          d.to &&
          `${d.from.material_code || "none"} → ${d.to.material_code}`,
        d.to?.quantity_kg != null && formatKgExact(d.to.quantity_kg),
      ];
    case "line.excluded":
      return [d.line, d.reason && `Reason: ${d.reason}`];
    case "lines.approved_in_bulk":
      return [
        d.quantity_kg != null && `${formatKgExact(d.quantity_kg)} in total`,
      ];
    case "filing.finalized":
      return [
        d.introduced_kg != null &&
          `Introduced ${formatKgExact(d.introduced_kg)}`,
        d.recycled_kg != null && `recycled ${formatKgExact(d.recycled_kg)}`,
        d.notes && `“${d.notes}”`,
      ];
    case "trade_name.added":
      return [
        d.cpcb_category && d.cpcb_category.replace("CATEGORY_", "Category "),
      ];
    default:
      return [];
  }
};

const toCsv = (events) => {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["When", "Who", "Action", "What", "Financial year", "Document"],
  ];
  for (const event of events) {
    rows.push([
      new Date(event.created_at).toISOString(),
      event.actor_name || "",
      event.action,
      event.summary,
      event.financial_year != null ? fyLabel(event.financial_year) : "",
      event.details?.filename || "",
    ]);
  }
  return rows.map((row) => row.map(escape).join(",")).join("\n");
};

function EventRow({ event }) {
  const Icon = ICONS[event.action] || History;
  const details = detailLine(event).filter(Boolean);
  const canOpen = event.document_id && event.action !== "document.deleted";
  return (
    <li className="flex gap-3.5 px-5 py-3.5">
      <span
        className={cx(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border",
          event.action === "document.deleted" ||
            event.action === "line.excluded"
            ? "border-neutral-200 text-neutral-500"
            : event.action.startsWith("filing.")
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-neutral-200 text-neutral-700",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-neutral-700">
          <span className="font-medium text-neutral-950">
            {event.actor_name || "Someone"}
          </span>{" "}
          {event.summary}
        </p>
        {details.length > 0 && (
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {details.join(" · ")}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <span className="mono text-xs tabular-nums text-neutral-500">
          {timeLabel(event.created_at)}
        </span>
        {canOpen && (
          <Link
            to={`/documents?open=${event.document_id}`}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-emerald-700"
          >
            <FileText className="size-3" aria-hidden /> Open
          </Link>
        )}
      </div>
    </li>
  );
}

export default function Activity() {
  const { fy, filing } = useWorkspace();
  const notify = useToast();
  const [group, setGroup] = useState("");
  // Follows the sidebar's year switcher until the user picks a year (or all years) here.
  const [pickedYear, setPickedYear] = useState(null);
  const year = pickedYear ?? String(fy);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  const params = useCallback(
    (extra = {}) => ({
      fy: year,
      group: group || undefined,
      limit: PAGE_SIZE,
      ...extra,
    }),
    [year, group],
  );

  // Results are keyed by their filters, so changing a filter shows the loading state.
  const key = `${year}:${group}`;
  const [result, setResult] = useState({ key: null });
  const current = result.key === key ? result : null;
  const events = current?.events ?? null;
  const nextBefore = current?.nextBefore ?? null;
  const available = current?.available ?? true;
  const error = current?.error ?? null;

  useEffect(() => {
    let cancelled = false;
    activityAPI
      .list(params())
      .then((response) => {
        if (cancelled) return;
        setResult({
          key,
          available: response.available !== false,
          events: response.data || [],
          nextBefore: response.next_before || null,
        });
      })
      .catch((err) => !cancelled && setResult({ key, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [params, key]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const response = await activityAPI.list(params({ before: nextBefore }));
      setResult((state) => ({
        ...state,
        events: [...state.events, ...(response.data || [])],
        nextBefore: response.next_before || null,
      }));
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const response = await activityAPI.list(params({ limit: 1000 }));
      const url = URL.createObjectURL(
        new Blob([toCsv(response.data || [])], { type: "text/csv" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `provenance-activity-${year === "all" ? "all-years" : fyLabel(Number(year)).replace(/\s+/g, "-").toLowerCase()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const years = filing?.available_years?.length ? filing.available_years : [fy];
  const days = [];
  for (const event of events || []) {
    const key = dayKey(event.created_at);
    if (days.at(-1)?.key !== key)
      days.push({ key, label: dayLabel(event.created_at), events: [] });
    days.at(-1).events.push(event);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
            Overview · Activity
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Activity
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Every upload, review decision and filing change, with who made it
            and when. This is your audit trail.
          </p>
        </div>
        <Button
          onClick={exportCsv}
          loading={exporting}
          disabled={!events?.length}
        >
          {!exporting && <Download className="size-4" />} Export CSV
        </Button>
      </div>

      {!available && (
        <Alert tone="warn" title="Activity isn't set up yet">
          Apply supabase/migrations/007_activity_obligations_trade_names.sql to
          start recording activity. It also fills in history from your existing
          uploads, reviews and filings.
        </Alert>
      )}

      <Card className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-neutral-200 px-5 pt-3">
          <div
            className="-mb-px flex gap-5 overflow-x-auto"
            role="tablist"
            aria-label="Filter by type"
          >
            {GROUPS.map((item) => (
              <button
                key={item.id || "all"}
                type="button"
                role="tab"
                aria-selected={group === item.id}
                onClick={() => setGroup(item.id)}
                className={cx(
                  "shrink-0 border-b-2 pb-3 pt-1 text-sm transition-colors",
                  group === item.id
                    ? "border-neutral-950 font-medium text-neutral-950"
                    : "border-transparent text-neutral-500 hover:text-neutral-950",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mb-2.5 w-40">
            <Select
              value={year}
              onChange={(e) =>
                setPickedYear(
                  e.target.value === String(fy) ? null : e.target.value,
                )
              }
              aria-label="Financial year"
            >
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  {fyLabel(y)}
                </option>
              ))}
              <option value="all">All years</option>
            </Select>
          </div>
        </div>

        {error ? (
          <div className="p-5">
            <Alert tone="error" title="Couldn't load activity">
              {error}
            </Alert>
          </div>
        ) : !events ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nothing here yet"
            description={
              available
                ? "Uploads, review decisions and filing changes will appear here as they happen."
                : "Activity will appear here once the migration is applied."
            }
          />
        ) : (
          <div>
            {days.map((day) => (
              <section key={day.key} aria-label={day.label}>
                <h2 className="mono sticky top-0 border-b border-neutral-100 bg-neutral-50/90 px-5 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500 backdrop-blur">
                  {day.label}
                </h2>
                <ul className="divide-y divide-neutral-100">
                  {day.events.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </ul>
              </section>
            ))}
            {nextBefore && (
              <div className="border-t border-neutral-100 px-5 py-3 text-center">
                <Button
                  variant="ghost"
                  onClick={loadMore}
                  loading={loadingMore}
                >
                  Load older activity
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
