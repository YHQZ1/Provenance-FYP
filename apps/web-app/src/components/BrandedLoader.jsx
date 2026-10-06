import { Loader2 } from "lucide-react";

// Shown while a session is checked or a sign-in completes.
export default function BrandedLoader({ message = "Loading your workspace…" }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-neutral-50" role="status">
      <div className="flex items-center gap-2.5">
        <img src="/provenance.png" alt="" className="size-8" />
        <span className="text-xl font-semibold tracking-tight text-neutral-950">Provenance</span>
      </div>
      <p className="mono flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
        <Loader2 className="size-3.5 animate-spin text-emerald-600" aria-hidden />
        {message}
      </p>
    </div>
  );
}
