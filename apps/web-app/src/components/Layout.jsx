import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Home,
  Lock,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { authAPI, systemAPI } from "../lib/api";
import { fyLabel } from "../lib/domain";
import { useWorkspace } from "../lib/workspace";
import Assistant from "./Assistant";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const SERVICE_NAMES = {
  ocr: "Document reading",
  classifier: "Material classification",
  regulatory: "Regulatory research",
};

const navItemClass = (isActive) =>
  cx(
    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
    isActive
      ? "bg-neutral-100 font-medium text-neutral-950"
      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950",
  );

function ActiveBar({ isActive }) {
  return (
    <span
      aria-hidden
      className={cx(
        "absolute inset-y-1.5 left-0 w-0.5 rounded-sm bg-emerald-600 transition-opacity",
        isActive ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

// Square counter for things that need attention; deliberately not a pill.
function Counter({ value, tone = "neutral" }) {
  if (!value) return null;
  return (
    <span
      className={cx(
        "mono min-w-5 rounded-sm border px-1 text-center text-[11px] leading-[18px] tabular-nums",
        tone === "error"
          ? "border-red-200 text-red-700"
          : "border-neutral-300 text-neutral-950",
      )}
    >
      {value}
    </span>
  );
}

function NavItem({ to, icon: Icon, label, meta, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) => navItemClass(isActive)}
    >
      {({ isActive }) => (
        <>
          <ActiveBar isActive={isActive} />
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{label}</span>
          {meta}
        </>
      )}
    </NavLink>
  );
}

// One step of the EPR workflow. The markers are joined by a line so the sidebar reads as a sequence.
function StepItem({ to, index, label, state, meta, last, onNavigate }) {
  return (
    <li className="relative">
      {!last && (
        <span
          aria-hidden
          className="absolute left-[21px] top-8 h-[calc(100%-1rem)] w-px bg-neutral-200"
        />
      )}
      <NavLink
        to={to}
        onClick={onNavigate}
        className={({ isActive }) => navItemClass(isActive)}
      >
        {({ isActive }) => (
          <>
            <ActiveBar isActive={isActive} />
            <span
              className={cx(
                "mono relative z-10 flex size-5 shrink-0 items-center justify-center rounded-sm border text-[10px]",
                state === "done" &&
                  "border-emerald-600 bg-emerald-600 text-white",
                state === "current" &&
                  "border-neutral-950 bg-white text-neutral-950",
                state === "upcoming" &&
                  "border-neutral-200 bg-white text-neutral-400",
              )}
            >
              {state === "done" ? (
                <Check className="size-3" strokeWidth={3} aria-hidden />
              ) : (
                index
              )}
            </span>
            <span className="flex-1">{label}</span>
            {meta}
          </>
        )}
      </NavLink>
    </li>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="mono px-3 pb-2 pt-6 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
      {children}
    </p>
  );
}

function YearSwitcher() {
  const { fy, setFy, filing } = useWorkspace();
  const years = [...new Set([...(filing?.available_years || []), fy])].sort(
    (a, b) => b - a,
  );
  const finalized =
    filing?.financial_year?.start_year === fy && filing?.status === "FINALIZED";

  return (
    <div className="px-3">
      <label
        htmlFor="fy-select"
        className="mono block px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400"
      >
        Financial year
      </label>
      <div className="relative">
        <select
          id="fy-select"
          value={fy}
          onChange={(event) => setFy(Number(event.target.value))}
          className="h-10 w-full appearance-none rounded-md border border-neutral-200 bg-white pl-3 pr-9 text-sm font-medium text-neutral-950 transition-colors hover:border-neutral-400 focus:border-emerald-600 focus:outline-none"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {fyLabel(year)}
            </option>
          ))}
        </select>
        <ChevronsUpDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
      </div>
      <p className="mt-2 flex items-center justify-between px-1 text-xs text-neutral-500">
        <span>
          1 Apr {fy} – 31 Mar {fy + 1}
        </span>
        <span
          className={cx(
            "flex items-center gap-1",
            finalized ? "text-emerald-700" : "text-neutral-500",
          )}
        >
          {finalized && <Lock className="size-3" aria-hidden />}
          {finalized ? "Finalized" : "Open"}
        </span>
      </p>
    </div>
  );
}

function ServiceStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      systemAPI
        .status()
        .then((response) => active && setStatus(response.data))
        .catch(() => active && setStatus({ unreachable: true }));
    load();
    const timer = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (!status) return null;

  const down = (status.services || []).filter(
    (service) => service.status === "down",
  );
  const degraded = (status.services || []).filter(
    (service) => service.status === "degraded",
  );

  let tone = "ok";
  let text = "All services running";
  let detail = null;
  if (status.unreachable) {
    tone = "error";
    text = "Server unreachable";
  } else if (status.mock_services) {
    tone = "neutral";
    text = "Demo mode: sample results";
  } else if (down.length) {
    tone = "error";
    text =
      down.length === 1
        ? `${SERVICE_NAMES[down[0].name]} unavailable`
        : `${down.length} services unavailable`;
    detail = down
      .map(
        (service) =>
          `${SERVICE_NAMES[service.name]}: ${service.detail || "down"}`,
      )
      .join("\n");
  } else if (degraded.length) {
    tone = "neutral";
    text = `${SERVICE_NAMES[degraded[0].name]} degraded`;
    detail = degraded
      .map(
        (service) =>
          `${SERVICE_NAMES[service.name]}: ${service.detail || "degraded"}`,
      )
      .join("\n");
  }

  return (
    <p
      className="flex items-center gap-2 px-3 pb-3 text-xs text-neutral-500"
      title={detail || undefined}
      role="status"
    >
      <span
        className={cx(
          "size-1.5 shrink-0 rounded-full",
          tone === "ok" && "bg-emerald-600",
          tone === "error" && "bg-red-600",
          tone === "neutral" && "bg-neutral-400",
        )}
        aria-hidden
      />
      <span className={cx("truncate", tone === "error" && "text-red-700")}>
        {text}
      </span>
    </p>
  );
}

function AccountMenu({ user, company }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) =>
      !ref.current?.contains(event.target) && setOpen(false);
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = async () => {
    await authAPI.logout().catch(() => {});
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  const name = company?.company_name || user?.email?.split("@")[0] || "Account";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-neutral-50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-neutral-950 text-xs font-semibold text-white">
          {name.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-neutral-950">
            {name}
          </span>
          <span className="block truncate text-xs text-neutral-500">
            {user?.email}
          </span>
        </span>
        <ChevronDown
          className={cx(
            "size-4 shrink-0 text-neutral-400 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-2 w-full rounded-md border border-neutral-200 bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
            className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950"
          >
            <Settings className="size-4" aria-hidden /> Company settings
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Brand() {
  return (
    <Link
      to="/dashboard"
      className="inline-flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-80"
    >
      <img src="/provenance.png" alt="" className="size-7" />
      <span className="text-[17px] font-semibold tracking-tight text-neutral-950">
        Provenance
      </span>
    </Link>
  );
}

function Sidebar({ onNavigate }) {
  const { filing, user, company, profileComplete } = useWorkspace();
  const counts = filing?.counts || {};

  const stepDone = [
    counts.documents > 0,
    counts.documents > 0 &&
      counts.pending_items === 0 &&
      counts.processing === 0,
    filing?.status === "FINALIZED",
  ];
  const current = stepDone.findIndex((done) => !done);
  const stateOf = (index) =>
    stepDone[index] ? "done" : index === current ? "current" : "upcoming";

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-neutral-100 px-5">
        <Brand />
      </div>

      <div className="flex-1 overflow-y-auto pb-4 pt-5">
        <YearSwitcher />

        <nav className="mt-2 px-3" aria-label="Main">
          <SectionLabel>Overview</SectionLabel>
          <NavItem
            to="/dashboard"
            icon={Home}
            label="Home"
            onNavigate={onNavigate}
          />

          <SectionLabel>EPR workflow</SectionLabel>
          <ol>
            <StepItem
              to="/documents"
              index={1}
              label="Documents"
              state={filing ? stateOf(0) : "upcoming"}
              meta={<Counter value={counts.failed} tone="error" />}
              onNavigate={onNavigate}
            />
            <StepItem
              to="/review"
              index={2}
              label="Review"
              state={filing ? stateOf(1) : "upcoming"}
              meta={<Counter value={counts.pending_items} />}
              onNavigate={onNavigate}
            />
            <StepItem
              to="/filing"
              index={3}
              label="Filing"
              state={filing ? stateOf(2) : "upcoming"}
              last
              onNavigate={onNavigate}
            />
          </ol>

          <SectionLabel>Tools</SectionLabel>
          <div className="space-y-0.5">
            <NavItem
              to="/regulatory"
              icon={BookOpen}
              label="Regulatory research"
              onNavigate={onNavigate}
            />
            <NavItem
              to="/settings"
              icon={Settings}
              label="Settings"
              meta={
                company && !profileComplete ? (
                  <span
                    className="size-1.5 rounded-full bg-neutral-950"
                    title="Company profile incomplete"
                    aria-label="Profile incomplete"
                  />
                ) : null
              }
              onNavigate={onNavigate}
            />
          </div>
        </nav>
      </div>

      <div className="shrink-0 border-t border-neutral-100 px-3 pt-3 pb-3">
        <ServiceStatus />
        <AccountMenu user={user} company={company} />
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-neutral-200 bg-white lg:block print:hidden">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:hidden print:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-neutral-700 hover:bg-neutral-100"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-neutral-950/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-10 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <Assistant />

      <main className="lg:pl-64 print:pl-0">
        <div className="mx-auto max-w-[1680px] px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pt-10">
          {children}
        </div>
      </main>
    </div>
  );
}
