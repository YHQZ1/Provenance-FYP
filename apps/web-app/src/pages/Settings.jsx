import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  LogOut,
  RotateCw,
  XCircle,
} from "lucide-react";
import { companyAPI, documentAPI, filingAPI, systemAPI } from "../lib/api";
import { PIBO_CATEGORIES, fyLabel } from "../lib/domain";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../lib/workspace";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  Spinner,
  useToast,
} from "../components/ui";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
const EPR_PATTERN = /^[A-Z0-9/\-. ]{0,60}$/;
const MIN_PASSWORD = 8;

const SERVICE_NAMES = {
  ocr: { name: "Document reading", purpose: "Reads uploaded PDFs and scans" },
  classifier: {
    name: "Material classification",
    purpose: "Suggests the material and category for each line",
  },
  regulatory: {
    name: "Regulatory research",
    purpose: "Answers questions from CPCB and SEBI documents",
  },
  queue: {
    name: "Processing queue",
    purpose: "Runs uploads in the background and retries failures",
  },
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

function Section({ id, title, description, children, footer }) {
  return (
    <Card id={id} className="min-w-0 scroll-mt-6 overflow-hidden">
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-950">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
        )}
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-5 py-3">
          {footer}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function CompanySection() {
  const { company, refreshAccount, refreshFiling } = useWorkspace();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const notify = useToast();

  useEffect(() => {
    if (company && !form) {
      setForm({
        company_name: company.company_name || "",
        gst_number: company.gst_number || "",
        epr_registration_number: company.epr_registration_number || "",
        Pibo_category: company.Pibo_category || [],
      });
    }
  }, [company, form]);

  if (!form)
    return (
      <Section id="company" title="Company profile">
        <Spinner label="Loading profile…" />
      </Section>
    );

  const gst = form.gst_number.trim().toUpperCase();
  const epr = form.epr_registration_number.trim().toUpperCase();
  const errors = {
    name:
      form.company_name.trim().length < 2 ? "Company name is required." : null,
    gst:
      gst && !GSTIN_PATTERN.test(gst)
        ? "Enter a valid 15-character GSTIN, e.g. 27ABCDE1234F1Z5."
        : null,
    epr:
      epr && !EPR_PATTERN.test(epr)
        ? "Use letters, numbers, /, - and . only."
        : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const dirty =
    form.company_name !== (company?.company_name || "") ||
    gst !== (company?.gst_number || "") ||
    epr !== (company?.epr_registration_number || "") ||
    JSON.stringify([...form.Pibo_category].sort()) !==
      JSON.stringify([...(company?.Pibo_category || [])].sort());
  const missing = [
    !company?.gst_number && "GSTIN",
    !company?.Pibo_category?.length && "PIBO category",
  ].filter(Boolean);

  const toggleCategory = (id) =>
    setForm((current) => ({
      ...current,
      Pibo_category: current.Pibo_category.includes(id)
        ? current.Pibo_category.filter((c) => c !== id)
        : [...current.Pibo_category, id],
    }));

  const save = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      await companyAPI.update({
        company_name: form.company_name.trim(),
        gst_number: gst,
        epr_registration_number: epr,
        Pibo_category: form.Pibo_category,
      });
      notify("Company profile saved");
      await refreshAccount();
      refreshFiling();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      id="company"
      title="Company profile"
      description="Appears on every filing and export, and decides which obligations apply."
      footer={
        <>
          {dirty && !saving && (
            <Button
              variant="ghost"
              onClick={() =>
                setForm({
                  company_name: company.company_name || "",
                  gst_number: company.gst_number || "",
                  epr_registration_number:
                    company.epr_registration_number || "",
                  Pibo_category: company.Pibo_category || [],
                })
              }
            >
              Discard changes
            </Button>
          )}
          <Button
            variant="primary"
            onClick={save}
            loading={saving}
            disabled={!dirty || invalid}
          >
            Save profile
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {missing.length > 0 && (
          <Alert tone="warn" title={`Add your ${missing.join(" and ")}`}>
            Required before you can finalize a financial year.
          </Alert>
        )}
        <Field label="Company name" htmlFor="company-name" error={errors.name}>
          <Input
            id="company-name"
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="GSTIN"
            htmlFor="gstin"
            error={errors.gst}
            hint="15 characters, as on your GST registration."
          >
            <Input
              id="gstin"
              value={form.gst_number}
              maxLength={15}
              onChange={(e) =>
                setForm({ ...form, gst_number: e.target.value.toUpperCase() })
              }
              placeholder="27ABCDE1234F1Z5"
              className="mono uppercase"
            />
          </Field>
          <Field
            label={
              <>
                CPCB EPR registration number{" "}
                <span className="font-normal text-neutral-500">(optional)</span>
              </>
            }
            htmlFor="epr-registration"
            error={errors.epr}
            hint="From your registration on the centralized EPR portal. Shown on exports."
          >
            <Input
              id="epr-registration"
              value={form.epr_registration_number}
              maxLength={60}
              onChange={(e) =>
                setForm({
                  ...form,
                  epr_registration_number: e.target.value.toUpperCase(),
                })
              }
              className="mono uppercase"
            />
          </Field>
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-neutral-800">
            PIBO category
          </legend>
          <p className="mb-3 mt-0.5 text-xs text-neutral-500">
            Select every role that applies under the Plastic Waste Management
            Rules.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {PIBO_CATEGORIES.map((category) => {
              const checked = form.Pibo_category.includes(category.id);
              return (
                <label
                  key={category.id}
                  className={cx(
                    "flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-600",
                    checked
                      ? "border-neutral-950"
                      : "border-neutral-200 hover:border-neutral-400",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(category.id)}
                    className="sr-only"
                  />
                  <span
                    className={cx(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border",
                      checked
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-neutral-300",
                    )}
                    aria-hidden
                  >
                    {checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-neutral-950">
                      {category.label}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {category.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

function AccountSection() {
  const [authUser, setAuthUser] = useState(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const notify = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthUser(data.user);
      setName(data.user?.user_metadata?.full_name || "");
    });
  }, []);

  if (!authUser)
    return (
      <Section id="account" title="Account">
        <Spinner label="Loading account…" />
      </Section>
    );

  const provider = authUser.app_metadata?.provider || "email";
  const usesPassword = provider === "email";
  const providerName =
    { google: "Google", azure: "Microsoft" }[provider] || provider;

  const saveName = async () => {
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name.trim() },
    });
    setSavingName(false);
    notify(error ? error.message : "Name saved", error ? "error" : "ok");
  };

  const mismatch = passwords.confirm && passwords.next !== passwords.confirm;
  const tooShort = passwords.next && passwords.next.length < MIN_PASSWORD;

  const changePassword = async (event) => {
    event.preventDefault();
    if (mismatch || tooShort) return;
    setSavingPassword(true);
    setPasswordError(null);
    // Confirm the current password first, so an unlocked laptop can't be used to take over the account.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: passwords.current,
    });
    if (verifyError) {
      setSavingPassword(false);
      setPasswordError("Your current password is incorrect.");
      return;
    }
    const { error } = await supabase.auth.updateUser({
      password: passwords.next,
    });
    setSavingPassword(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setPasswords({ current: "", next: "", confirm: "" });
    notify("Password changed");
  };

  const signOutEverywhere = async () => {
    setSigningOut(true);
    await supabase.auth.signOut({ scope: "global" });
    navigate("/auth?mode=login", { replace: true });
  };

  return (
    <Section id="account" title="Account" description="Your sign-in details.">
      <div className="space-y-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Your name" htmlFor="full-name">
            <div className="flex gap-2">
              <Input
                id="full-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
              <Button
                onClick={saveName}
                loading={savingName}
                disabled={
                  name.trim() === (authUser.user_metadata?.full_name || "")
                }
              >
                Save
              </Button>
            </div>
          </Field>
          <Field
            label="Email"
            htmlFor="email"
            hint={
              usesPassword
                ? "Used to sign in."
                : `You sign in with ${providerName}.`
            }
          >
            <Input id="email" value={authUser.email || ""} disabled />
          </Field>
        </div>

        <div className="border-t border-neutral-100 pt-6">
          <p className="text-sm font-medium text-neutral-950">Password</p>
          {usesPassword ? (
            <form onSubmit={changePassword} className="mt-3 space-y-4">
              {passwordError && <Alert tone="error">{passwordError}</Alert>}
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Current password" htmlFor="current-password">
                  <Input
                    id="current-password"
                    type="password"
                    value={passwords.current}
                    onChange={(e) =>
                      setPasswords({ ...passwords, current: e.target.value })
                    }
                    autoComplete="current-password"
                    required
                  />
                </Field>
                <Field
                  label="New password"
                  htmlFor="new-password"
                  error={
                    tooShort ? `At least ${MIN_PASSWORD} characters.` : null
                  }
                >
                  <Input
                    id="new-password"
                    type="password"
                    value={passwords.next}
                    onChange={(e) =>
                      setPasswords({ ...passwords, next: e.target.value })
                    }
                    autoComplete="new-password"
                    required
                  />
                </Field>
                <Field
                  label="Confirm new password"
                  htmlFor="confirm-password"
                  error={mismatch ? "Passwords don't match." : null}
                >
                  <Input
                    id="confirm-password"
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) =>
                      setPasswords({ ...passwords, confirm: e.target.value })
                    }
                    autoComplete="new-password"
                    required
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  loading={savingPassword}
                  disabled={
                    !passwords.current ||
                    !passwords.next ||
                    Boolean(mismatch) ||
                    Boolean(tooShort)
                  }
                >
                  Change password
                </Button>
              </div>
            </form>
          ) : (
            <p className="mt-1 text-sm text-neutral-500">
              You sign in with {providerName}, so there's no Provenance password
              to change.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-neutral-100 pt-6">
          <div>
            <p className="text-sm font-medium text-neutral-950">
              Sign out of all devices
            </p>
            <p className="mt-0.5 text-sm text-neutral-500">
              Ends every session, including this one. Use it if you signed in on
              a shared computer.
            </p>
          </div>
          <Button variant="danger" onClick={() => setSignOutOpen(true)}>
            <LogOut className="size-4" /> Sign out everywhere
          </Button>
        </div>
      </div>

      <Modal
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out of all devices?"
        footer={
          <>
            <Button onClick={() => setSignOutOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={signOutEverywhere}
              loading={signingOut}
            >
              Sign out everywhere
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          You'll be signed out here and on every other device, and need to sign
          in again.
        </p>
      </Modal>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

function SystemSection() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await systemAPI.status();
      setStatus(response.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const features = status
    ? [
        {
          name: "Finalizing a financial year",
          on: status.features.finalization,
          fix: "Run supabase/migrations/001_fy_filings.sql on the database.",
        },
        {
          name: "CPCB category tracking",
          on: status.features.category_tracking,
          fix: "Run supabase/migrations/002_classification_category.sql on the database.",
        },
        {
          name: "Activity log, obligation inputs and trade names",
          // Older backends don't report these; treat missing as unknown rather than off.
          on: status.features.activity_log !== false && status.features.obligations !== false &&
            status.features.trade_names !== false,
          fix: "Run supabase/migrations/007_activity_obligations_trade_names.sql on the database.",
        },
      ]
    : [];

  return (
    <Section
      id="system"
      title="System status"
      description="Whether the services behind Provenance are running. Checked when you open this page."
    >
      {error ? (
        <Alert tone="error" title="Couldn't reach the Provenance server">
          The backend isn't responding, so nothing can be checked. Make sure
          it's running.
        </Alert>
      ) : !status ? (
        <Spinner label="Checking services…" />
      ) : (
        <div className="space-y-6">
          {status.mock_services && (
            <Alert tone="info" title="Demo mode">
              Document reading and classification return sample results, not
              real ones.
            </Alert>
          )}
          <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200">
            {status.services.map((service) => {
              const meta = SERVICE_NAMES[service.name] || {
                name: service.name,
                purpose: "",
              };
              const ok = service.status === "up" || service.status === "mocked";
              const down =
                service.status === "down" ||
                service.status === "not_configured";
              return (
                <li
                  key={service.name}
                  className="flex items-start gap-3 px-4 py-3"
                >
                  {ok ? (
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-emerald-600"
                      aria-hidden
                    />
                  ) : down ? (
                    <XCircle
                      className="mt-0.5 size-4 shrink-0 text-red-600"
                      aria-hidden
                    />
                  ) : (
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-neutral-500"
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-950">
                      {meta.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {service.detail || meta.purpose}
                    </p>
                  </div>
                  <Badge tone={ok ? "ok" : down ? "error" : "neutral"}>
                    {
                      {
                        up: "Running",
                        mocked: "Sample data",
                        degraded: "Degraded",
                        down: "Unavailable",
                        not_configured: "Not configured",
                      }[service.status]
                    }
                  </Badge>
                </li>
              );
            })}
          </ul>

          <div>
            <p className="mono mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Features
            </p>
            <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200">
              {features.map((feature) => (
                <li
                  key={feature.name}
                  className="flex items-start gap-3 px-4 py-3"
                >
                  {feature.on ? (
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-emerald-600"
                      aria-hidden
                    />
                  ) : (
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-neutral-500"
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-950">
                      {feature.name}
                    </p>
                    {!feature.on && (
                      <p className="text-xs text-neutral-500">{feature.fix}</p>
                    )}
                  </div>
                  <Badge tone={feature.on ? "ok" : "neutral"}>
                    {feature.on ? "On" : "Off"}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-500">
              Last checked{" "}
              {new Date(status.checked_at).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
            <Button size="sm" onClick={load} loading={loading}>
              {!loading && <RotateCw className="size-3.5" />} Check again
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

function DataSection() {
  const { filing, company } = useWorkspace();
  const [exporting, setExporting] = useState(null);
  const notify = useToast();
  const years = filing?.available_years || [];

  const exportAll = async () => {
    setExporting("all");
    try {
      const [documents, ...positions] = await Promise.all([
        documentAPI.list({ limit: 200 }),
        ...years.map((year) => filingAPI.get(year)),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        company: {
          company_name: company?.company_name || null,
          gst_number: company?.gst_number || null,
          epr_registration_number: company?.epr_registration_number || null,
          pibo_category: company?.Pibo_category || [],
        },
        financial_years: positions.map((response) => {
          const { snapshot, ...live } = response.data;
          return {
            ...(snapshot || live),
            status: live.status,
            finalized_at: live.finalized_at,
          };
        }),
        documents: documents.data,
      };
      download(
        `provenance-export-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(payload, null, 2),
        "application/json",
      );
      notify("Export downloaded");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setExporting(null);
    }
  };

  const exportDocuments = async () => {
    setExporting("documents");
    try {
      const response = await documentAPI.list({ limit: 200 });
      const rows = [
        [
          "File",
          "Type",
          "Document date",
          "Financial year",
          "Status",
          "Lines",
          "Lines reviewed",
          "Uploaded",
        ],
      ];
      for (const doc of response.data) {
        rows.push([
          doc.filename,
          doc.document_type,
          doc.document_date || "",
          fyLabel(doc.financial_year),
          doc.status,
          doc.items_count,
          doc.items_verified,
          doc.created_at,
        ]);
      }
      download(
        `provenance-documents-${new Date().toISOString().slice(0, 10)}.csv`,
        rows.map((row) => row.map(csvCell).join(",")).join("\n"),
        "text/csv",
      );
      notify("Document list downloaded");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setExporting(null);
    }
  };

  return (
    <Section
      id="data"
      title="Your data"
      description="Download a copy of everything in your workspace, for backup or your auditor."
    >
      <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200">
        <li className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5">
          <div>
            <p className="text-sm font-medium text-neutral-950">
              Everything, as JSON
            </p>
            <p className="text-xs text-neutral-500">
              Company details, the position for {years.length} financial year
              {years.length === 1 ? "" : "s"} (signed-off numbers where
              finalized) and every document.
            </p>
          </div>
          <Button
            onClick={exportAll}
            loading={exporting === "all"}
            disabled={Boolean(exporting) || years.length === 0}
          >
            {exporting !== "all" && <Download className="size-4" />} Download
          </Button>
        </li>
        <li className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5">
          <div>
            <p className="text-sm font-medium text-neutral-950">
              Document list, as CSV
            </p>
            <p className="text-xs text-neutral-500">
              One row per document: type, date, year, status and review
              progress.
            </p>
          </div>
          <Button
            onClick={exportDocuments}
            loading={exporting === "documents"}
            disabled={Boolean(exporting)}
          >
            {exporting !== "documents" && <Download className="size-4" />}{" "}
            Download
          </Button>
        </li>
      </ul>
      <p className="mt-3 text-xs text-neutral-500">
        Original files stay in your document storage; open any document to view
        or download it.
      </p>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
          Tools · Settings
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Your company, your account, and the health of the services behind
          Provenance.
        </p>
      </div>

      <CompanySection />
      <AccountSection />
      <SystemSection />
      <DataSection />
    </div>
  );
}
