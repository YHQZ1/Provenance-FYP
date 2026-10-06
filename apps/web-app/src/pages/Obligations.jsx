import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock, Pencil, Scale } from "lucide-react";
import { obligationAPI } from "../lib/api";
import { CPCB_CATEGORIES, formatKg, formatKgExact } from "../lib/domain";
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
  Skeleton,
  useToast,
} from "../components/ui";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const formatPct = (value) =>
  value == null ? "—" : `${Number(value).toLocaleString("en-IN")}%`;
const formatInr = (value) =>
  value == null
    ? "—"
    : `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function Kpi({ label, value, detail, tone }) {
  return (
    <Card className="min-w-0 px-5 py-4">
      <p className="mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </p>
      <p
        className={cx(
          "mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums",
          tone === "ok" ? "text-emerald-700" : "text-neutral-950",
        )}
      >
        {value}
      </p>
      {detail && <p className="mt-2 text-xs text-neutral-500">{detail}</p>}
    </Card>
  );
}

function SourceTag({ source }) {
  if (source === "default")
    return <span className="ml-1 text-[11px] text-neutral-400">default</span>;
  if (source === "company")
    return <span className="ml-1 text-[11px] text-emerald-700">yours</span>;
  return null;
}

const FIELDS = [
  {
    key: "pre_consumer_kg",
    label: "B · Pre-consumer waste (kg)",
    hint: "Plastic packaging waste generated before it reached consumers.",
  },
  {
    key: "supplied_kg",
    label: "C · Supplied to registered entities (kg)",
    hint: "Packaging passed to other registered or exempted PIBOs, which carry the obligation instead.",
  },
  {
    key: "epr_target_pct",
    label: "EPR target (%)",
    hint: "Share of Q you must fulfil. Leave blank to use the default.",
  },
  {
    key: "recycling_min_pct",
    label: "Minimum recycling (%)",
    hint: "Share of the obligation that must be met by recycling. Leave blank to use the default.",
  },
  {
    key: "ec_rate_per_kg",
    label: "Compensation rate (₹ per kg)",
    hint: "Used only to estimate environmental compensation on a shortfall.",
  },
];

function EditModal({ row, fy, onClose, onSaved }) {
  const notify = useToast();
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    setValues({
      pre_consumer_kg: row.pre_consumer_kg || "",
      supplied_kg: row.supplied_kg || "",
      epr_target_pct:
        row.epr_target_source === "company" ? row.epr_target_pct : "",
      recycling_min_pct:
        row.recycling_min_source === "company" ? row.recycling_min_pct : "",
      ec_rate_per_kg: row.ec_rate_per_kg ?? "",
    });
  }, [row]);

  const placeholder = (key) => {
    if (key === "epr_target_pct" && row?.epr_target_source === "default")
      return `Default ${row.epr_target_pct}`;
    if (key === "recycling_min_pct" && row?.recycling_min_source === "default")
      return `Default ${row.recycling_min_pct}`;
    return key.endsWith("_kg") ? "0" : "Not set";
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          value === "" ? null : Number(value),
        ]),
      );
      const response = await obligationAPI.update(fy, row.category, payload);
      notify(`${CPCB_CATEGORIES[row.category].short} updated`);
      onSaved(response.data);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(row)}
      onClose={onClose}
      wide
      title={row ? `${CPCB_CATEGORIES[row.category].short} inputs` : ""}
      description="Figures your documents don't provide, and any target you want to use instead of the default."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            hint={field.hint}
            htmlFor={field.key}
          >
            <Input
              id={field.key}
              type="number"
              min="0"
              step="any"
              className="mono"
              value={values[field.key] ?? ""}
              placeholder={placeholder(field.key)}
              onChange={(e) =>
                setValues((v) => ({ ...v, [field.key]: e.target.value }))
              }
            />
          </Field>
        ))}
      </div>
    </Modal>
  );
}

export default function Obligations() {
  const { fy } = useWorkspace();
  const [basis, setBasis] = useState("current");
  const [editing, setEditing] = useState(null);
  // Results are keyed by year and basis, so switching either shows the loading state.
  const key = `${fy}:${basis}`;
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const data = result.key === key ? result.data : null;
  const error = result.key === key ? result.error : null;

  const load = useCallback(
    () =>
      obligationAPI
        .get(fy, basis)
        .then((response) =>
          setResult({ key, data: response.data, error: null }),
        )
        .catch((err) =>
          setResult((current) => ({ ...current, key, error: err.message })),
        ),
    [fy, basis, key],
  );

  useEffect(() => {
    load();
  }, [load]);

  if (error && !data) {
    return (
      <Alert
        tone="error"
        title="Couldn't load obligations"
        action={
          <Button size="sm" onClick={load}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const label = data.financial_year.label;
  const { totals } = data;
  const rows = data.rows;
  const anyDefaults = rows.some(
    (row) =>
      row.epr_target_source === "default" ||
      row.recycling_min_source === "default",
  );
  const hasRates = rows.some((row) => row.ec_rate_per_kg != null);
  const editable = data.available && !data.locked;
  const nothingIntroduced = !totals.introduced_kg;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
            Overview · Obligations
          </p>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {label} EPR obligations
            </h1>
            {data.locked && (
              <Badge tone="ok">
                <Lock className="size-3" /> Finalized
              </Badge>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            What you owe per CPCB category, worked out from your reviewed
            documents. Q = A + B − C, then your targets apply.
          </p>
        </div>
        <div className="w-72">
          <Select
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            aria-label="Basis for plastic introduced"
          >
            <option value="current">A from {label} purchases</option>
            <option value="previous_two_years">
              A as the average of the two years before
            </option>
          </Select>
        </div>
      </div>

      {!data.available && (
        <Alert tone="warn" title="Inputs can't be saved yet">
          The figures below use default targets. Apply
          supabase/migrations/007_activity_obligations_trade_names.sql to enter
          pre-consumer waste, supplied quantities, your own targets and
          compensation rates.
        </Alert>
      )}
      {data.locked && (
        <Alert tone="info">
          {label} is finalized, so these use its signed-off numbers and the
          inputs are locked. Reopen the year on the Filing page to change them.
        </Alert>
      )}
      {data.uncategorised_introduced_kg > 0 && (
        <Alert
          tone="warn"
          title={`${formatKgExact(data.uncategorised_introduced_kg)} introduced has no CPCB category`}
          action={
            <Button size="sm" to="/filing">
              View filing
            </Button>
          }
        >
          Those lines aren't in any category below, so the obligation is
          understated. Categories are set when lines are reviewed.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="EPR obligation"
          value={formatKg(totals.obligation_kg)}
          detail={`From Q of ${formatKgExact(totals.epr_quantity_kg)}`}
        />
        <Kpi
          label="Recycled"
          value={formatKg(totals.recycled_kg)}
          detail="Reviewed recycling certificates"
        />
        <Kpi
          label="Shortfall"
          value={formatKg(totals.shortfall_kg)}
          tone={
            totals.obligation_kg > 0 && !totals.shortfall_kg ? "ok" : undefined
          }
          detail={
            totals.obligation_kg > 0 && !totals.shortfall_kg
              ? "Obligation met by recycling"
              : "Obligation not yet covered by certificates"
          }
        />
        <Kpi
          label="Compensation estimate"
          value={hasRates ? formatInr(totals.compensation_estimate) : "—"}
          detail={
            hasRates
              ? "Shortfall × your rates"
              : "Set a rate per kg to estimate"
          }
        />
      </div>

      <Card className="min-w-0 overflow-hidden">
        {nothingIntroduced && basis === "current" ? (
          <EmptyState
            icon={Scale}
            title={`No reviewed plastic introduced in ${label}`}
            description="Obligations start from reviewed purchase invoices. Upload and review them first."
            action={
              <Button to="/documents" variant="primary">
                Go to Documents <ArrowRight className="size-4" />
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
                  <th className="px-5 py-2.5 font-medium">Category</th>
                  <th
                    className="px-3 py-2.5 text-right font-medium"
                    title="Plastic introduced"
                  >
                    A
                  </th>
                  <th
                    className="px-3 py-2.5 text-right font-medium"
                    title="Pre-consumer waste"
                  >
                    B
                  </th>
                  <th
                    className="px-3 py-2.5 text-right font-medium"
                    title="Supplied to registered entities"
                  >
                    C
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">Q</th>
                  <th className="px-3 py-2.5 text-right font-medium">Target</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Obligation
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Recycled
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Shortfall
                  </th>
                  <th className="px-5 py-2.5">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((row) => (
                  <tr key={row.category} className="align-top">
                    <td className="px-5 py-3">
                      <p className="font-medium text-neutral-950">
                        {CPCB_CATEGORIES[row.category].short}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {CPCB_CATEGORIES[row.category].label}
                      </p>
                    </td>
                    <td className="mono whitespace-nowrap px-3 py-3 text-right text-neutral-700">
                      {formatKgExact(row.introduced_kg)}
                    </td>
                    <td className="mono whitespace-nowrap px-3 py-3 text-right text-neutral-700">
                      {formatKgExact(row.pre_consumer_kg)}
                    </td>
                    <td className="mono whitespace-nowrap px-3 py-3 text-right text-neutral-700">
                      {formatKgExact(row.supplied_kg)}
                    </td>
                    <td className="mono whitespace-nowrap px-3 py-3 text-right font-medium text-neutral-950">
                      {formatKgExact(row.epr_quantity_kg)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <span className="mono text-neutral-700">
                        {formatPct(row.epr_target_pct)}
                      </span>
                      <SourceTag source={row.epr_target_source} />
                      {row.recycling_min_pct != null && (
                        <p className="text-xs text-neutral-500">
                          min. {formatPct(row.recycling_min_pct)} recycled
                          <SourceTag source={row.recycling_min_source} />
                        </p>
                      )}
                    </td>
                    <td className="mono whitespace-nowrap px-3 py-3 text-right font-medium text-neutral-950">
                      {row.obligation_kg == null ? (
                        <span className="font-sans text-xs font-normal text-neutral-500">
                          Set a target
                        </span>
                      ) : (
                        formatKgExact(row.obligation_kg)
                      )}
                    </td>
                    <td className="mono whitespace-nowrap px-3 py-3 text-right text-neutral-700">
                      {formatKgExact(row.recycled_kg)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <span
                        className={cx(
                          "mono",
                          row.shortfall_kg > 0
                            ? "font-medium text-neutral-950"
                            : "text-emerald-700",
                        )}
                      >
                        {formatKgExact(row.shortfall_kg)}
                      </span>
                      {row.recycling_gap_kg > 0 && (
                        <p className="text-xs text-neutral-500">
                          {formatKgExact(row.recycling_gap_kg)} below recycling
                          minimum
                        </p>
                      )}
                      {row.compensation_estimate != null && (
                        <p className="text-xs text-neutral-500">
                          ≈ {formatInr(row.compensation_estimate)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(row)}
                        disabled={!editable}
                        aria-label={`Edit ${CPCB_CATEGORIES[row.category].short} inputs`}
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-200 bg-neutral-50 font-medium">
                  <td className="px-5 py-3 text-neutral-950">Total</td>
                  <td className="mono whitespace-nowrap px-3 py-3 text-right">
                    {formatKgExact(totals.introduced_kg)}
                  </td>
                  <td colSpan={2} />
                  <td className="mono whitespace-nowrap px-3 py-3 text-right">
                    {formatKgExact(totals.epr_quantity_kg)}
                  </td>
                  <td />
                  <td className="mono whitespace-nowrap px-3 py-3 text-right">
                    {formatKgExact(totals.obligation_kg)}
                  </td>
                  <td className="mono whitespace-nowrap px-3 py-3 text-right">
                    {formatKgExact(totals.recycled_kg)}
                  </td>
                  <td className="mono whitespace-nowrap px-3 py-3 text-right">
                    {formatKgExact(totals.shortfall_kg)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="px-5 py-4 text-sm text-neutral-600">
          <p className="font-medium text-neutral-950">How this is worked out</p>
          <ul className="mt-2 space-y-1.5">
            <li>
              <span className="mono text-neutral-950">A</span> plastic
              introduced:{" "}
              {data.basis === "current"
                ? `reviewed purchase invoices in ${label}.`
                : `the average of ${data.basis_years.join(" and ")}, as the guidelines define it.`}
            </li>
            <li>
              <span className="mono text-neutral-950">B</span> pre-consumer
              waste and <span className="mono text-neutral-950">C</span>{" "}
              quantities supplied to registered entities: entered by you.
            </li>
            <li>
              <span className="mono text-neutral-950">Q = A + B − C</span>, the
              obligation is Q × the EPR target, and recycled counts reviewed
              recycling certificates in the same category.
            </li>
          </ul>
        </Card>
        <Card className="px-5 py-4 text-sm text-neutral-600">
          <p className="font-medium text-neutral-950">About the targets</p>
          <p className="mt-2">
            {anyDefaults
              ? `Targets marked "default" come from the ${data.target_source}. The rules have been amended before, so check them against the current notification and set your own where they differ.`
              : "Every target here is one you set."}{" "}
            Compostable packaging (Category IV) has no default.
          </p>
          <Link
            to="/regulatory"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-neutral-950 hover:text-emerald-700"
          >
            Check in Regulatory research <ArrowRight className="size-3.5" />
          </Link>
        </Card>
      </div>

      <EditModal
        row={editing}
        fy={fy}
        onClose={() => setEditing(null)}
        onSaved={(next) => {
          setEditing(null);
          if (next.basis === basis) setResult({ key, data: next, error: null });
          else load();
        }}
      />
    </div>
  );
}
