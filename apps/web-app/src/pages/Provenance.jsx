import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EPR_PORTAL_URL } from "../lib/config";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  FileSearch,
  FileText,
  Layers,
  Lock,
  Menu,
  ScanLine,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";

const cx = (...classes) => classes.filter(Boolean).join(" ");

function Reveal({ children, className, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cx(
        "transition duration-700 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, dark }) {
  return (
    <p
      className={cx(
        "mono text-[11px] font-medium uppercase tracking-[0.14em]",
        dark ? "text-emerald-600" : "text-emerald-700",
      )}
    >
      {children}
    </p>
  );
}

function SectionHeading({ eyebrow, title, body, dark, center }) {
  return (
    <div className={cx("max-w-2xl", center && "mx-auto text-center")}>
      <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
      <h2
        className={cx(
          "mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl",
          dark ? "text-white" : "text-neutral-950",
        )}
      >
        {title}
      </h2>
      {body && (
        <p
          className={cx(
            "mt-4 text-base leading-relaxed sm:text-lg",
            dark ? "text-neutral-400" : "text-neutral-600",
          )}
        >
          {body}
        </p>
      )}
    </div>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2";

function PrimaryLink({ to, children, className }) {
  return (
    <Link
      to={to}
      className={cx(buttonBase, "bg-neutral-950 text-white hover:bg-neutral-800", className)}
    >
      {children}
    </Link>
  );
}

function OutlineLink({ href, children, dark }) {
  return (
    <a
      href={href}
      className={cx(
        buttonBase,
        "border",
        dark
          ? "border-neutral-700 text-white hover:border-neutral-500"
          : "border-neutral-200 text-neutral-950 hover:border-neutral-950 hover:bg-neutral-50",
      )}
    >
      {children}
    </a>
  );
}

function ReviewPreview() {
  return (
    <div className="relative">
      <div
        className="absolute -bottom-3 -left-3 right-3 top-3 rounded-2xl border border-neutral-200 bg-neutral-100"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-emerald-600" />
            <span className="mono text-[11px] font-medium uppercase tracking-widest text-neutral-500">
              Review · line 3 of 12
            </span>
          </div>
          <span className="mono text-[11px] text-neutral-400">FY 2026-27</span>
        </div>

        <div className="grid sm:grid-cols-[1.1fr_1fr]">
          <div className="space-y-5 p-5">
            <div>
              <p className="text-xs text-neutral-500">Invoice line</p>
              <p className="mt-1 text-[15px] font-semibold leading-snug">
                Reliance Polypet 3020 bottle grade
              </p>
              <p className="mt-1 text-xs text-neutral-500">INV-2026-0418.pdf · Purchase invoice</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-[11px] text-neutral-500">Suggested material</p>
                <p className="mt-1 text-sm font-semibold">PET</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">Category I · rigid</p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-[11px] text-neutral-500">Weight</p>
                <p className="mt-1 text-sm font-semibold">500 kg</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">95% confidence</p>
              </div>
            </div>

            <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-xs leading-relaxed text-neutral-600">
              POLYPET is a trade name for PET resin; "bottle grade" indicates rigid packaging.
            </p>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-950 px-3 py-2 text-xs font-medium text-white">
                <Check className="size-3.5" /> Approve
              </span>
              <span className="inline-flex items-center rounded-md border border-neutral-200 px-3 py-2 text-xs font-medium">
                Edit
              </span>
              <span className="inline-flex items-center rounded-md px-3 py-2 text-xs font-medium text-neutral-500">
                Exclude
              </span>
            </div>
          </div>

          <div className="border-t border-neutral-100 bg-neutral-50 p-5 sm:border-l sm:border-t-0">
            <p className="text-xs text-neutral-500">Source document</p>
            <div className="mono mt-2 space-y-2 rounded-lg border border-neutral-200 bg-white p-3.5 text-[10.5px] leading-relaxed text-neutral-500">
              <p className="font-semibold text-neutral-800">TAX INVOICE</p>
              <p>Invoice Date: 12-Jun-2026</p>
              <p>GSTIN: 27ABCDE1234F1Z5</p>
              <div className="border-t border-dashed border-neutral-200 pt-2">
                <p>1 HDPE caps 38mm 3923 120 kg</p>
                <p>2 LDPE liner film 3920 80 kg</p>
                <p className="-mx-1.5 rounded bg-neutral-950 px-1.5 py-0.5 text-white">
                  3 Reliance Polypet 3020 3907 500 kg
                </p>
                <p>4 Freight charges 9965</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PROBLEMS = [
  {
    title: "The data is everywhere except one place",
    body: "Plastic purchases sit in ERP exports, GST records and PDF invoices. Recycling proof arrives as certificates from different recyclers. Someone has to bring it all together, every year.",
  },
  {
    title: "Categorising is done line by line, by hand",
    body: 'EPR targets are set per CPCB category. Somebody has to decide whether "BOPP laminate roll" is rigid, flexible or multilayer, across thousands of invoice lines.',
  },
  {
    title: "Auditors ask where a number came from",
    body: "A total typed into a spreadsheet can't show which invoice, which line, or who decided its category. Rebuilding that trail later costs more than the filing itself.",
  },
];

const STEPS = [
  {
    icon: FileText,
    who: "You",
    title: "Upload what you already have",
    body: "Purchase invoices, recycling certificates, collection receipts and EPR records, as PDFs or scans. Duplicate files are caught so nothing is counted twice.",
  },
  {
    icon: ScanLine,
    who: "Automatic",
    title: "Every line is read",
    body: "Line items, quantities, units and invoice dates are extracted, including Indian formats like 1,00,000 kg and 12‑Jul‑26. Scanned pages are read with OCR.",
  },
  {
    icon: UserCheck,
    who: "Suggested, then you decide",
    title: "Material and CPCB category, verified",
    body: "Each line gets a suggested polymer and category with its reasoning, next to the source document. You approve, correct, or exclude. Nothing counts until a person signs off.",
  },
  {
    icon: Lock,
    who: "You",
    title: "Finalize the year and export",
    body: "Totals build up per financial year, by material and category, with a checklist of anything still open. Finalizing locks the numbers. Export to CSV or JSON for your filing.",
  },
];

const FEATURES = [
  {
    icon: FileSearch,
    title: "Built for Indian invoices",
    body: "Reads lakh-grouped quantities, day-first dates, GSTINs, HSN table rows, and kg, tonnes, quintals or grams.",
  },
  {
    icon: Layers,
    title: "CPCB categories, not generic tags",
    body: "Lines are classified into Category I rigid, II flexible, III multilayer and IV compostable, the way EPR targets are set.",
  },
  {
    icon: UserCheck,
    title: "Human-verified by design",
    body: "The model suggests; your team decides. When the description and the suggestion disagree, the line is flagged for review.",
  },
  {
    icon: Calendar,
    title: "Financial-year aware",
    body: "Each document counts toward the April–March year of its invoice date, not the day it was uploaded.",
  },
  {
    icon: Lock,
    title: "Locked once finalized",
    body: "A finalized year is a snapshot. Its documents can't change until you deliberately reopen it.",
  },
  {
    icon: ShieldCheck,
    title: "Models that stay with you",
    body: "Classification and research run on open models you host, so your invoices aren't sent to a third-party AI service.",
  },
];

const COMPARISON = [
  [
    "Categorising invoice lines",
    "Done by hand, line by line",
    "Suggested for every line; you confirm",
  ],
  [
    "Where a total came from",
    "Rebuilt from memory and email",
    "Each kg links to its document, line and review decision",
  ],
  ["Same invoice uploaded twice", "Easy to miss", "Blocked at upload"],
  [
    "Which financial year it belongs to",
    "Depends on who filed it",
    "Set by the invoice date, editable",
  ],
  ["Changes after sign-off", "Silent edits to the sheet", "Locked until the year is reopened"],
];

const FAQ = [
  {
    q: "Does Provenance file my return on the CPCB portal?",
    a: "No. It prepares your position for the year: totals by material and category, the evidence behind them, and an export. You or your consultant file it on the CPCB portal.",
  },
  {
    q: "What happens when the AI gets a line wrong?",
    a: "Nothing counts until a person reviews it. You see the suggestion, the reasoning and the source document side by side, and can correct the material, category or weight, or exclude the line entirely.",
  },
  {
    q: "Which documents should I upload first?",
    a: "Purchase invoices for plastic packaging and packaging materials. They establish the plastic you introduced. Add recycling certificates and collection receipts as evidence of what has been fulfilled.",
  },
  {
    q: "Who is it for?",
    a: "Producers, importers and brand owners (PIBOs) registered under the Plastic Waste Management Rules, and the compliance or finance teams who prepare their EPR filings.",
  },
  {
    q: "Is it only for plastic EPR?",
    a: "Plastic EPR is where it starts. The same document-to-verified-number pipeline is being extended to BRSR Core disclosures and carbon baselines.",
  },
];

function Nav() {
  const [open, setOpen] = useState(false);
  const links = [
    ["How it works", "#how-it-works"],
    ["Why Provenance", "#why"],
    ["Research", "#research"],
    ["FAQ", "#faq"],
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1920px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <img src="/provenance.png" alt="" className="size-7" />
          <span className="text-lg font-semibold tracking-tight">Provenance</span>
        </a>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-950"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-5 md:flex">
          <Link
            to="/auth?mode=login"
            className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-950"
          >
            Sign in
          </Link>
          <PrimaryLink to="/auth?mode=signup" className="px-4 py-2.5">
            Get started
          </PrimaryLink>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-md p-2 text-neutral-700 hover:bg-neutral-100 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-neutral-200 bg-white px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {links.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-neutral-100 pt-4">
            <OutlineLink href="/auth?mode=login">Sign in</OutlineLink>
            <PrimaryLink to="/auth?mode=signup">Get started</PrimaryLink>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="px-4 pb-20 pt-32 sm:px-6 lg:px-8 lg:pb-28 lg:pt-40">
      <div className="mx-auto grid max-w-[1920px] items-center gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <Reveal>
          <Eyebrow>Plastic EPR compliance for Indian PIBOs</Eyebrow>
          <h1 className="mt-5 text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-neutral-950 sm:text-6xl">
            Your EPR filing, built from the invoices you{" "}
            <span className="text-emerald-600">already have.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600">
            Provenance reads your purchase invoices and recycling certificates, suggests the
            material and CPCB category for every line, and lets your team verify each one. Every
            kilogram in your annual position traces back to the document it came from.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <PrimaryLink to="/auth?mode=signup">
              Start with your documents <ArrowRight className="size-4" />
            </PrimaryLink>
            <OutlineLink href="#how-it-works">See how it works</OutlineLink>
          </div>
          <p className="mt-8 max-w-lg text-sm text-neutral-500">
            Built around CPCB's EPR guidelines under the Plastic Waste Management Rules. Producers,
            importers and brand owners.
          </p>
        </Reveal>

        <Reveal delay={150}>
          <ReviewPreview />
        </Reveal>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="border-t border-neutral-200 bg-neutral-50 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1920px]">
        <Reveal>
          <SectionHeading
            eyebrow="The problem"
            title="The numbers exist. The trail behind them usually doesn't."
            body="Every financial year, each producer, importer and brand owner has to report the plastic packaging it introduced, category by category, and show recycling to match. Most teams still assemble that by hand."
          />
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200 md:grid-cols-3">
          {PROBLEMS.map((problem, index) => (
            <Reveal key={problem.title} delay={index * 80} className="h-full">
              <div className="h-full bg-white p-7">
                <p className="mono text-xs text-neutral-400">0{index + 1}</p>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{problem.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">{problem.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-6">
          <div className="grid gap-6 rounded-xl border border-neutral-200 bg-white p-7 md:grid-cols-[1fr_auto_auto] md:items-center md:gap-12">
            <p className="text-sm leading-relaxed text-neutral-600">
              <span className="font-semibold text-neutral-950">Getting it wrong is expensive.</span>{" "}
              Annual returns are due by 30 June for the previous financial year, and shortfalls in
              EPR targets attract environmental compensation.
            </p>
            <div>
              <p className="text-3xl font-semibold tracking-tight">
                ₹5,000<span className="text-base font-medium text-neutral-500"> /ton</span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">First shortfall in EPR targets</p>
            </div>
            <div>
              <p className="text-3xl font-semibold tracking-tight">
                ₹20,000<span className="text-base font-medium text-neutral-500"> /ton</span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">By the third time</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-neutral-400">
            Source: CPCB, Guidelines for Assessment of Environmental Compensation for violation of
            the Plastic Waste Management Rules (April 2024).
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1920px]">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="Four steps from a folder of PDFs to a finalized year."
            body="The system does the reading and the suggesting. Your team does the deciding. Every screen makes clear which is which."
          />
        </Reveal>

        <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <Reveal key={step.title} delay={index * 80} className="h-full">
              <li className="flex h-full flex-col rounded-xl border border-neutral-200 p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-950">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <span className="mono text-xs text-neutral-400">Step {index + 1}</span>
                </div>
                <h3 className="mt-6 text-base font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">{step.body}</p>
                <p
                  className={cx(
                    "mono mt-6 border-t border-neutral-100 pt-4 text-[11px] uppercase tracking-widest",
                    step.who === "You" ? "text-neutral-950" : "text-emerald-700",
                  )}
                >
                  {step.who}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function TraceRow({ label, title, meta, last }) {
  return (
    <div className="relative pl-8">
      {!last && (
        <span className="absolute left-[7px] top-6 h-full w-px bg-neutral-700" aria-hidden />
      )}
      <span
        className="absolute left-0 top-1.5 size-[15px] rounded-full border-2 border-emerald-600 bg-neutral-950"
        aria-hidden
      />
      <p className="mono text-[10px] uppercase tracking-widest text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{title}</p>
      <p className="mt-0.5 text-xs text-neutral-400">{meta}</p>
    </div>
  );
}

function EvidenceTrail() {
  return (
    <section className="bg-neutral-950 px-4 py-20 text-white sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-[1920px] items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <SectionHeading
            dark
            eyebrow="Provenance"
            title="Every kilogram has a paper trail."
            body="Pick any total in your filing and follow it back: which documents it came from, the exact invoice line, how it was classified, and when it was reviewed. That's the question auditors ask, answered before they ask it."
          />
          <ul className="mt-8 space-y-3 text-sm text-neutral-300">
            {[
              "Corrections are recorded next to the original suggestion",
              "Excluded lines stay in the record with the reason",
              "Finalized years keep the exact numbers you signed off",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> {item}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={150}>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-7">
            <div className="flex items-baseline justify-between border-b border-neutral-800 pb-5">
              <div>
                <p className="mono text-[10px] uppercase tracking-widest text-neutral-500">
                  FY 2026-27 · Category I
                </p>
                <p className="mt-1 text-sm text-neutral-300">PET introduced</p>
              </div>
              <p className="text-3xl font-semibold tracking-tight">1,500 kg</p>
            </div>
            <div className="mt-6 space-y-6">
              <TraceRow
                label="Document"
                title="INV-2026-0418.pdf"
                meta="Purchase invoice · dated 12 Jun 2026 · one of 3 documents"
              />
              <TraceRow
                label="Invoice line"
                title="Reliance Polypet 3020 bottle grade · 500 kg"
                meta="Line 3 of 4 · read from the original PDF"
              />
              <TraceRow
                label="Classification"
                title="PET · Category I rigid"
                meta='Suggested at 95% confidence · trade name and "bottle grade"'
              />
              <TraceRow
                label="Review"
                title="Approved as suggested"
                meta="Reviewed 14 Jun 2026 · no corrections"
                last
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Why() {
  return (
    <section id="why" className="px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1920px]">
        <Reveal>
          <SectionHeading
            eyebrow="Why Provenance"
            title="Made for the way EPR actually works in India."
            body="Not a generic ESG dashboard. Each part is shaped around the documents PIBOs hold and the categories CPCB reports in."
          />
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={(index % 3) * 80} className="h-full">
              <div className="h-full bg-white p-7">
                <feature.icon className="size-5 text-emerald-600" aria-hidden />
                <h3 className="mt-5 text-base font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{feature.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16">
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th scope="col" className="px-6 py-4 font-medium text-neutral-500" />
                    <th scope="col" className="px-6 py-4 font-medium text-neutral-500">
                      Spreadsheets and email
                    </th>
                    <th scope="col" className="px-6 py-4 font-semibold text-neutral-950">
                      With Provenance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {COMPARISON.map(([topic, before, after]) => (
                    <tr key={topic}>
                      <th scope="row" className="px-6 py-4 font-medium text-neutral-950">
                        {topic}
                      </th>
                      <td className="px-6 py-4 text-neutral-500">{before}</td>
                      <td className="px-6 py-4 text-neutral-950">
                        <span className="flex gap-2.5">
                          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />{" "}
                          {after}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Research() {
  return (
    <section
      id="research"
      className="border-y border-neutral-200 bg-neutral-50 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
    >
      <div className="mx-auto grid max-w-[1920px] items-center gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <Reveal>
          <SectionHeading
            eyebrow="Regulatory research"
            title="Ask the rules a question. Get the page it's on."
            body="Answers come only from official CPCB and SEBI documents in the source library, with the document and page cited, so you can check the wording yourself."
          />
          <p className="mt-6 text-sm text-neutral-500">
            Covers the CPCB EPR portal guidance, environmental compensation guidelines, EPR trading
            guidelines and SEBI's BRSR Core framework.
          </p>
        </Reveal>

        <Reveal delay={150}>
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
              <BookOpen className="size-4 text-neutral-400" aria-hidden />
              <p className="text-sm text-neutral-800">
                How is environmental compensation calculated for a shortfall in EPR targets?
              </p>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm leading-relaxed text-neutral-700">
                Environmental compensation is levied on producers, importers and brand owners for a
                shortfall in EPR targets at Rs. 5,000 per ton, rising to Rs. 10,000 per ton the
                second time and Rs. 20,000 per ton the third time. Compensation is partly returned
                if the shortfall is made good: 75% within one year, 60% within two and 40% within
                three.
              </p>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    CPCB Environmental Compensation Regime for Plastic Waste
                  </p>
                  <p className="mono mt-0.5 text-[11px] text-neutral-500">p. 27</p>
                </div>
                <FileText className="size-4 shrink-0 text-neutral-400" aria-hidden />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-[1920px] gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <Reveal>
          <SectionHeading eyebrow="FAQ" title="What teams ask before they start." />
          <p className="mt-6 text-sm leading-relaxed text-neutral-500">
            Provenance prepares and evidences your EPR position. It doesn't replace your auditor or
            file on the portal for you.
          </p>
        </Reveal>

        <Reveal delay={100}>
          <div className="divide-y divide-neutral-200 border-y border-neutral-200">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-base font-medium text-neutral-950 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown
                    className="size-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">{item.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCta() {
  const [email, setEmail] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const params = new URLSearchParams({ mode: "signup" });
    if (email.trim()) params.set("email", email.trim());
    window.location.href = `/auth?${params.toString()}`;
  };

  return (
    <section className="px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
      <Reveal className="mx-auto max-w-[1920px]">
        <div className="grid gap-10 rounded-2xl bg-neutral-950 p-8 text-white sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:p-16">
          <div>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Start this year's filing with the invoices on your desk.
            </h2>
            <p className="mt-4 max-w-lg text-neutral-400">
              Set up your company, upload a few purchase invoices, and see the suggestions for every
              line in minutes.
            </p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="cta-email" className="sr-only">
              Work email
            </label>
            <input
              id="cta-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="h-12 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-4 text-sm text-white placeholder:text-neutral-500 focus:border-emerald-600 focus:outline-none"
            />
            <button
              type="submit"
              className={cx(
                buttonBase,
                "h-12 bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-offset-neutral-950",
              )}
            >
              Create account <ArrowRight className="size-4" />
            </button>
          </form>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-neutral-200 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/provenance.png" alt="" className="size-6" />
          <span className="font-semibold tracking-tight">Provenance</span>
          <span className="text-sm text-neutral-400">
            · Plastic EPR compliance with an evidence trail
          </span>
        </div>
        <nav className="flex flex-wrap gap-6 text-sm text-neutral-500" aria-label="Footer">
          <a href="#how-it-works" className="hover:text-neutral-950">
            How it works
          </a>
          <a href="#faq" className="hover:text-neutral-950">
            FAQ
          </a>
          <Link to="/auth?mode=login" className="hover:text-neutral-950">
            Sign in
          </Link>
          {EPR_PORTAL_URL && (
            <a
              href={EPR_PORTAL_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-neutral-950"
            >
              CPCB EPR portal
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}

export default function Provenance() {
  return (
    <div className="min-h-screen bg-white text-neutral-950 [scroll-padding-top:80px]">
      <Nav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <EvidenceTrail />
        <Why />
        <Research />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
