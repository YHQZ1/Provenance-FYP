import { useCallback, useEffect, useMemo, useState } from "react";
import { Library, Plus, Search, Sparkles, Tag, X } from "lucide-react";
import { materialsAPI } from "../lib/api";
import { CPCB_CATEGORIES, MATERIALS, formatDate } from "../lib/domain";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  useToast,
} from "../components/ui";

const CATEGORY_OPTIONS = [
  "CATEGORY_I",
  "CATEGORY_II",
  "CATEGORY_III",
  "CATEGORY_IV",
];
const EMPTY_FORM = {
  trade_name: "",
  material_code: "",
  cpcb_category: "",
  notes: "",
};

const matches = (query, ...values) =>
  !query ||
  values.some((value) =>
    String(value || "")
      .toLowerCase()
      .includes(query),
  );

function AddModal({ open, initial, onClose, onSaved }) {
  const notify = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...EMPTY_FORM, ...initial });
  }, [open, initial]);

  const set = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const valid = form.trade_name.trim().length >= 2 && form.material_code;

  const save = async () => {
    setSaving(true);
    try {
      await materialsAPI.addTradeName({
        ...form,
        cpcb_category: form.cpcb_category || null,
      });
      notify(`"${form.trade_name.trim()}" added`);
      onSaved();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a trade name"
      description="Invoice lines that mention this name get its material suggested straight away. You still approve every line."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={save}
            loading={saving}
            disabled={!valid}
          >
            Add trade name
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Trade name"
          htmlFor="trade-name"
          hint="As it appears on invoices, for example POLYPET 3020. Matching ignores case and punctuation."
        >
          <Input
            id="trade-name"
            value={form.trade_name}
            onChange={set("trade_name")}
            autoFocus
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Material" htmlFor="trade-material">
            <Select
              id="trade-material"
              value={form.material_code}
              onChange={set("material_code")}
            >
              <option value="">Choose material</option>
              {MATERIALS.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="CPCB category"
            htmlFor="trade-category"
            hint="Optional. Without it the line still needs a category in review."
          >
            <Select
              id="trade-category"
              value={form.cpcb_category}
              onChange={set("cpcb_category")}
            >
              <option value="">Not sure</option>
              {CATEGORY_OPTIONS.map((key) => (
                <option key={key} value={key}>
                  {CPCB_CATEGORIES[key].short} · {CPCB_CATEGORIES[key].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Note (optional)" htmlFor="trade-notes">
          <Input
            id="trade-notes"
            value={form.notes}
            onChange={set("notes")}
            placeholder="Supplier, grade or anything useful"
          />
        </Field>
      </div>
    </Modal>
  );
}

export default function Materials() {
  const notify = useToast();
  const [library, setLibrary] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(() => {
    setError(null);
    return materialsAPI
      .library()
      .then((response) => setLibrary(response.data))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (entry) => {
    setRemoving(entry.id);
    try {
      await materialsAPI.removeTradeName(entry.id);
      notify(`"${entry.trade_name}" removed`);
      await load();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setRemoving(null);
    }
  };

  const q = query.trim().toLowerCase();
  const names = useMemo(() => {
    const byCode = Object.fromEntries(
      (library?.materials || []).map((m) => [m.material_code, m]),
    );
    return { byCode };
  }, [library]);

  if (error && !library) {
    return (
      <Alert
        tone="error"
        title="Couldn't load the materials library"
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
  if (!library) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const tradeNames = library.trade_names.filter((t) =>
    matches(q, t.trade_name, t.material_code, t.notes),
  );
  const catalogue = library.catalogue.filter((c) =>
    matches(q, c.synonym, c.material_code, c.manufacturer, c.description),
  );
  const catalogueCount = (code) =>
    library.catalogue.filter((c) => c.material_code === code).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
            Tools · Materials library
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Materials library
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            The trade names Provenance recognises on invoices. Add your
            suppliers&apos; names and lines that mention them are suggested
            straight away, without waiting on the classifier.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setAdding({})}
          disabled={!library.available}
        >
          <Plus className="size-4" /> Add trade name
        </Button>
      </div>

      {!library.available && (
        <Alert tone="warn" title="Your own trade names aren't set up yet">
          Apply supabase/migrations/007_activity_obligations_trade_names.sql to
          add trade names. The built-in catalogue below already works.
        </Alert>
      )}

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search trade names, materials or manufacturers"
          aria-label="Search the materials library"
          className="pl-9"
        />
      </div>

      <Card className="min-w-0">
        <CardHeader
          title="Your trade names"
          description="Checked against every new invoice line before the classifier runs."
        />
        {library.trade_names.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No trade names yet"
            description="Add the names your suppliers use, or pick from the suggestions below when you have corrected lines in review."
          />
        ) : tradeNames.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-neutral-500">
            No trade names match “{query}”.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
                  <th className="px-5 py-2.5 font-medium">Trade name</th>
                  <th className="px-3 py-2.5 font-medium">Material</th>
                  <th className="px-3 py-2.5 font-medium">Category</th>
                  <th className="px-3 py-2.5 font-medium">Added</th>
                  <th className="px-5 py-2.5">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {tradeNames.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-neutral-950">
                        {entry.trade_name}
                      </p>
                      {entry.notes && (
                        <p className="text-xs text-neutral-500">
                          {entry.notes}
                        </p>
                      )}
                    </td>
                    <td className="mono px-3 py-3 text-neutral-700">
                      {entry.material_code}
                    </td>
                    <td className="px-3 py-3 text-neutral-700">
                      {entry.cpcb_category ? (
                        CPCB_CATEGORIES[entry.cpcb_category]?.short
                      ) : (
                        <span className="text-neutral-400">Not set</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-neutral-500">
                      {entry.created_by_name && (
                        <span className="block text-neutral-700">
                          {entry.created_by_name}
                        </span>
                      )}
                      {formatDate(entry.created_at)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(entry)}
                        loading={removing === entry.id}
                        aria-label={`Remove ${entry.trade_name}`}
                      >
                        {removing !== entry.id && <X className="size-3.5" />}{" "}
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {library.available && library.suggestions.length > 0 && (
        <Card className="min-w-0">
          <CardHeader
            title="Suggested from your corrections"
            description="Lines you corrected in review. Add the trade name they contain so the next invoice gets it right."
          />
          <ul className="divide-y divide-neutral-100">
            {library.suggestions
              .filter((s) => matches(q, s.line, s.material_code))
              .map((suggestion) => (
                <li
                  key={`${suggestion.line}-${suggestion.material_code}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <Sparkles
                    className="size-4 shrink-0 text-emerald-600"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-neutral-950">
                      {suggestion.line}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Corrected to{" "}
                      <span className="mono text-neutral-700">
                        {suggestion.material_code}
                      </span>
                      {suggestion.times > 1 && ` ${suggestion.times} times`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      setAdding({
                        trade_name: suggestion.line,
                        material_code: suggestion.material_code,
                        cpcb_category: suggestion.cpcb_category || "",
                      })
                    }
                  >
                    <Plus className="size-3.5" /> Add
                  </Button>
                </li>
              ))}
          </ul>
        </Card>
      )}

      <Card className="min-w-0">
        <CardHeader
          title="Built-in catalogue"
          description="Polymers and common trade names the classifier searches for every line. Shared by all workspaces."
        />
        <div className="grid gap-px border-b border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {library.materials.map((material) => (
            <div
              key={material.material_code}
              className="min-w-0 bg-white px-4 py-3"
            >
              <p className="mono text-sm font-medium text-neutral-950">
                {material.material_code}
              </p>
              <p
                className="truncate text-xs text-neutral-600"
                title={material.material_name}
              >
                {material.material_name}
              </p>
              <p className="mt-1 text-[11px] text-neutral-400">
                {catalogueCount(material.material_code)} trade name
                {catalogueCount(material.material_code) === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
        {catalogue.length === 0 ? (
          <EmptyState
            icon={Library}
            title="Nothing matches"
            description={`No built-in names match “${query}”.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
                  <th className="px-5 py-2.5 font-medium">Trade name</th>
                  <th className="px-3 py-2.5 font-medium">Material</th>
                  <th className="px-3 py-2.5 font-medium">Manufacturer</th>
                  <th className="px-5 py-2.5 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {catalogue.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-5 py-2.5 text-neutral-950">
                      {entry.synonym}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone="neutral" className="mono">
                        {entry.material_code}
                      </Badge>
                      <span className="ml-2 hidden text-xs text-neutral-500 xl:inline">
                        {names.byCode[entry.material_code]?.material_name}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-700">
                      {entry.manufacturer || "—"}
                    </td>
                    <td className="px-5 py-2.5 text-neutral-500">
                      {entry.description || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddModal
        open={Boolean(adding)}
        initial={adding}
        onClose={() => setAdding(null)}
        onSaved={() => {
          setAdding(null);
          load();
        }}
      />
    </div>
  );
}
