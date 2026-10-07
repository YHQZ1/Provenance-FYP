import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 px-4 py-6 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2.5 self-start transition-opacity hover:opacity-80"
      >
        <img src="/provenance.png" alt="" className="size-7" />
        <span className="text-lg font-semibold tracking-tight">Provenance</span>
      </Link>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16 text-center">
        <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
          Error 404
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-950">
          This page doesn't exist
        </h1>
        <p className="mt-3 text-neutral-600">
          The link may be old or mistyped. Nothing in your workspace has changed.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button to="/dashboard" variant="primary">
            Go to Home
          </Button>
          <Button to="/documents">Your documents</Button>
        </div>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to the website
        </Link>
      </main>
    </div>
  );
}
