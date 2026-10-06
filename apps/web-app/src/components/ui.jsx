/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  X,
  XCircle,
} from "lucide-react";
import { STAGES } from "../lib/domain";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const BUTTON_VARIANTS = {
  primary:
    "bg-neutral-950 text-white hover:bg-neutral-800 border border-neutral-950",
  secondary:
    "bg-white text-neutral-900 border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50",
  ghost:
    "bg-transparent text-neutral-600 border border-transparent hover:bg-neutral-100 hover:text-neutral-900",
  danger:
    "bg-white text-red-700 border border-red-200 hover:bg-red-50 hover:border-red-300",
  accent:
    "bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700",
};

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  to,
  type = "button",
  ...props
}) {
  const classes = cx(
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors whitespace-nowrap",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cx("rounded-xl border border-neutral-200 bg-white", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// Tags stay inside the product palette: emerald for done, red only for errors,
// and dark ink for things that need attention.
const TONES = {
  ok: "bg-emerald-50 text-emerald-800 ring-emerald-600/25",
  warn: "bg-white text-neutral-950 ring-neutral-950/40",
  error: "bg-red-50 text-red-700 ring-red-600/25",
  info: "bg-neutral-100 text-neutral-700 ring-neutral-300",
  neutral: "bg-neutral-50 text-neutral-500 ring-neutral-200",
};

export function Badge({ tone = "neutral", children, className }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StageBadge({ stage }) {
  const meta = STAGES[stage] || STAGES.review;
  return (
    <Badge tone={meta.tone}>
      {stage === "processing" && (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      )}
      {meta.label}
    </Badge>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-widest text-emerald-700">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-neutral-500">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function Stat({ label, value, hint, tone }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-5 py-4">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p
        className={cx(
          "mt-1.5 text-2xl font-semibold tracking-tight tabular-nums",
          tone === "ok" ? "text-emerald-700" : "text-neutral-950",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 flex size-11 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500">
          <Icon className="size-5" aria-hidden />
        </div>
      )}
      <p className="text-sm font-semibold text-neutral-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "info", title, children, action }) {
  const icons = {
    info: Info,
    warn: AlertTriangle,
    error: XCircle,
    ok: CheckCircle2,
  };
  const styles = {
    info: "border-neutral-200 bg-neutral-50 text-neutral-800",
    warn: "border-neutral-300 bg-white text-neutral-950",
    error: "border-red-200 bg-red-50 text-red-900",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  const Icon = icons[tone];
  return (
    <div
      className={cx(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        styles[tone],
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && (
          <div className={cx(title && "mt-0.5", "opacity-90")}>{children}</div>
        )}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500"
      role="status"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function Skeleton({ className }) {
  return (
    <div className={cx("animate-pulse rounded-md bg-neutral-100", className)} />
  );
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-neutral-800"
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="text-xs text-neutral-500">{hint}</p>
      )}
    </div>
  );
}

const controlClasses =
  "block w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-neutral-50 disabled:text-neutral-500";

export function Input({ className, ...props }) {
  return <input className={cx(controlClasses, "h-10", className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <div className="relative">
      <select
        className={cx(controlClasses, "h-10 appearance-none pr-9", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
        aria-hidden
      />
    </div>
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea className={cx(controlClasses, "py-2", className)} {...props} />
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4"
      onMouseDown={(event) =>
        event.target === event.currentTarget && onClose?.()
      }
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none",
          wide ? "max-w-5xl" : "max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-neutral-950">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-6 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Slide-over panel from the right, for details that shouldn't hide the list behind them.
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-neutral-950/30"
        onClick={onClose}
        aria-hidden
      />
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col bg-white shadow-[-12px_0_40px_rgba(0,0,0,0.08)] outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-neutral-950">
              {title}
            </h2>
            {description && (
              <div className="mt-0.5 text-sm text-neutral-500">
                {description}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 bg-neutral-50 px-6 py-3">
            {footer}
          </div>
        )}
      </section>
    </div>
  );
}

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((message, tone = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(
      () => setToasts((current) => current.filter((t) => t.id !== id)),
      4500,
    );
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cx(
              "pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-white px-4 py-3 text-sm shadow-lg",
              toast.tone === "error" ? "border-red-200" : "border-neutral-200",
            )}
          >
            {toast.tone === "error" ? (
              <XCircle
                className="mt-0.5 size-4 shrink-0 text-red-600"
                aria-hidden
              />
            ) : (
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-emerald-600"
                aria-hidden
              />
            )}
            <span className="text-neutral-800">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
