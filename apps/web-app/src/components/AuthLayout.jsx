import { Link } from "react-router-dom";
import { Check } from "lucide-react";

// Logo and name double as the way back to the website.
// The logo's charcoal mark would vanish on the dark panel, so it sits on a white tile there.
function Brand({ onDark }) {
  return (
    <Link
      to="/"
      aria-label="Provenance home"
      className="inline-flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
    >
      {onDark ? (
        <span className="flex size-9 items-center justify-center rounded-md bg-white">
          <img src="/provenance.png" alt="" className="size-7" />
        </span>
      ) : (
        <img src="/provenance.png" alt="" className="size-7" />
      )}
      <span className="text-lg font-semibold tracking-tight">Provenance</span>
    </Link>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden flex-col justify-between bg-neutral-950 p-10 text-white lg:flex xl:p-14">
      <div>
        <Brand onDark />
      </div>

      <div className="max-w-md">
        <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-600">
          Plastic EPR compliance
        </p>
        <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl">
          Every kilogram in your filing, traced to its source.
        </h1>
        <ul className="mt-10 space-y-4 text-sm text-neutral-300">
          {[
            "Upload invoices and recycling certificates as they are",
            "Review a suggested material and CPCB category for every line",
            "Finalize the financial year and export your position",
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <Check
                className="mt-0.5 size-4 shrink-0 text-emerald-600"
                aria-hidden
              />{" "}
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="max-w-md text-xs leading-relaxed text-neutral-500">
        Built around CPCB's EPR guidelines under the Plastic Waste Management
        Rules, for producers, importers and brand owners.
      </p>
    </aside>
  );
}

// Shared shell for sign-in, sign-up and password reset: brand panel left, form right.
// On desktop the brand panel stays put and only the form column scrolls.
export default function AuthLayout({ children }) {
  return (
    <div className="grid min-h-screen bg-white lg:h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:overflow-hidden">
      <BrandPanel />

      <main className="flex flex-col px-4 py-6 sm:px-6 lg:h-screen lg:overflow-y-auto lg:px-12 lg:py-0">
        <div className="lg:hidden">
          <Brand />
        </div>

        {/* Anchored from the top rather than centred, so the heading and switch stay still
            when the form below grows or shrinks. */}
        <div className="mx-auto w-full max-w-md pb-10 pt-10 lg:pb-8 lg:pt-12">
          {children}
        </div>
      </main>
    </div>
  );
}
