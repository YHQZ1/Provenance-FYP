import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock, X } from "lucide-react";

const cx = (...classes) => classes.filter(Boolean).join(" ");

// Trace's mark: three points joined into a path, the last one lit, like a trail being followed.
export function TraceMark({ className, accent = "#059669" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 17.5 10.5 12l3.5 3.5L19 8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="5" cy="17.5" r="1.9" fill="currentColor" />
      <circle cx="10.5" cy="12" r="1.9" fill="currentColor" />
      <circle cx="19" cy="8" r="2.4" fill={accent} />
    </svg>
  );
}

const PREVIEW = [
  "Ask about CPCB rules and get the answer with the page it's on",
  "Understand why a line needs review, and what to enter",
  "See what's left before you can finalize the year",
];

// Panel size once open; the launcher tile grows from 48px into this, anchored bottom-right.
const PANEL =
  "w-[min(360px,calc(100vw-2.5rem))] h-[min(468px,calc(100vh-6rem))]";
const EASE = "ease-[cubic-bezier(0.2,0.8,0.2,1)]";

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const launcherRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const launcher = launcherRef.current;
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    // Move focus into the panel once it has grown, and back to the launcher when it closes.
    const focusTimer = setTimeout(() => closeRef.current?.focus(), 200);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      launcher?.focus();
    };
  }, [open]);

  return (
    <div className="group fixed bottom-5 right-5 z-40 print:hidden">
      {/* Name on hover or keyboard focus, only while closed. */}
      <span
        role="tooltip"
        className={cx(
          "pointer-events-none absolute bottom-3 right-full mr-3 whitespace-nowrap rounded-md bg-neutral-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity duration-150",
          !open && "group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        Ask Trace
      </span>

      {/* One element: the launcher tile itself grows into the chat panel. */}
      <div
        ref={rootRef}
        className={cx(
          "relative overflow-hidden bg-neutral-950 shadow-[0_12px_36px_rgba(0,0,0,0.2)]",
          "transition-[width,height,border-radius] duration-300 motion-reduce:transition-none",
          EASE,
          open ? `${PANEL} rounded-xl` : "size-12 rounded-xl",
        )}
      >
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label="Open Trace, your EPR assistant"
          tabIndex={open ? -1 : 0}
          className={cx(
            "absolute bottom-0 right-0 flex size-12 items-center justify-center text-white transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500",
            open ? "pointer-events-none opacity-0" : "opacity-100 delay-150",
          )}
        >
          <TraceMark className="size-6" />
        </button>

        {/* Laid out at full size and pinned bottom-right, so growing the tile unfolds it instead of reflowing it. */}
        <section
          role="dialog"
          aria-label="Trace, your EPR assistant"
          aria-hidden={!open}
          inert={!open}
          className={cx(
            "absolute bottom-0 right-0 flex flex-col",
            PANEL,
            "transition-opacity motion-reduce:transition-none",
            open
              ? "opacity-100 delay-150 duration-200"
              : "pointer-events-none opacity-0 duration-100",
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-md bg-white/10">
                <TraceMark className="size-5 text-white" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">Trace</p>
                <p className="text-xs text-neutral-400">Your EPR assistant</p>
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Close Trace"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-t-lg bg-white">
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <span className="mono inline-flex items-center rounded-sm border border-emerald-600/30 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-800">
                Coming soon
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-950">
                  An assistant that knows your filing
                </p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  Trace will answer questions on any page, using the official
                  sources and your own documents.
                </p>
              </div>
              <ul className="space-y-2">
                {PREVIEW.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2.5 text-sm text-neutral-700"
                  >
                    <span
                      className="mt-[7px] size-1.5 shrink-0 rounded-full bg-emerald-600"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="shrink-0 border-t border-neutral-100 px-4 py-3">
              <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-400">
                <Lock className="size-3.5 shrink-0" aria-hidden />
                Ask Trace anything…
              </div>
              <Link
                to="/regulatory"
                onClick={() => setOpen(false)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:text-emerald-700"
              >
                Until then, ask Regulatory research{" "}
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
