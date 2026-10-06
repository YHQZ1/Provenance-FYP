import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  RotateCw,
} from "lucide-react";
import { regulatoryAPI } from "../lib/api";
import { Alert, Badge, Button, Card, Skeleton } from "../components/ui";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const SUGGESTIONS = [
  {
    topic: "Plastic EPR",
    questions: [
      "What does a brand owner need to register on the CPCB EPR portal?",
      "How are plastic packaging categories defined for EPR?",
    ],
  },
  {
    topic: "Deadlines and compensation",
    questions: [
      "How is environmental compensation calculated for a shortfall in EPR targets?",
      "What happens if annual returns are filed late?",
    ],
  },
  {
    topic: "BRSR",
    questions: ["What does BRSR Core require listed companies to disclose?"],
  },
];

const CATEGORY_LABELS = {
  plastic_epr: "Plastic EPR",
  brsr: "BRSR",
  ccts: "CCTS",
};

const MIN_LENGTH = 3;

/* ------------------------------------------------------------------ */

// Renders the model's plain-text answer: paragraphs, bullet and numbered lists, and **bold**.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-neutral-950">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

function Answer({ text }) {
  const blocks = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ type: "break" });
      continue;
    }
    const bullet = line.match(/^(?:[*+\-•]|\d+[.)])\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.type === "list") last.items.push(bullet[1]);
      else
        blocks.push({
          type: "list",
          ordered: /^\d/.test(line),
          items: [bullet[1]],
        });
    } else if (last?.type === "paragraph") {
      last.text += ` ${line}`;
    } else {
      blocks.push({ type: "paragraph", text: line });
    }
  }

  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-neutral-800">
      {blocks.map((block, index) => {
        if (block.type === "break") return null;
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={index}
              className={cx(
                "space-y-1.5 pl-5",
                block.ordered
                  ? "list-decimal"
                  : "list-disc marker:text-neutral-400",
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inline(item)}</li>
              ))}
            </List>
          );
        }
        return <p key={index}>{inline(block.text)}</p>;
      })}
    </div>
  );
}

function Citation({ source }) {
  const pages = source.pages || [];
  return (
    <li className="flex items-start gap-3 rounded-md border border-neutral-200 px-3.5 py-3">
      <FileText
        className="mt-0.5 size-4 shrink-0 text-neutral-400"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-950 hover:underline"
        >
          {source.name || source.url}
          <ExternalLink
            className="size-3.5 shrink-0 text-neutral-400"
            aria-hidden
          />
        </a>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          {source.category && (
            <Badge tone="neutral">
              {CATEGORY_LABELS[source.category] || source.category}
            </Badge>
          )}
          {pages.length > 0 && <span>Pages</span>}
          {pages.map((page) => (
            <a
              key={page}
              href={`${source.url}#page=${page}`}
              target="_blank"
              rel="noreferrer"
              className="mono rounded-sm border border-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-700 hover:border-neutral-950 hover:text-neutral-950"
              aria-label={`Open page ${page}`}
            >
              {page}
            </a>
          ))}
        </div>
      </div>
    </li>
  );
}

function ResultCard({ entry, onRetry }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const pages = (entry.result.sources || [])
      .map(
        (source) =>
          `${source.name}${source.pages?.length ? `, p. ${source.pages.join(", ")}` : ""}`,
      )
      .join("; ");
    try {
      await navigator.clipboard.writeText(
        `${entry.question}\n\n${entry.result.answer}\n\nSources: ${pages}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable; nothing to do
    }
  };

  return (
    <Card className="min-w-0">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
        <p className="text-sm font-semibold text-neutral-950">
          {entry.question}
        </p>
        <span className="mono shrink-0 text-[11px] text-neutral-400">
          {entry.askedAt}
        </span>
      </div>

      <div className="px-5 py-5">
        {entry.status === "loading" ? (
          <div className="space-y-3" role="status">
            <p className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Searching the source library and drafting an answer…{" "}
              {entry.elapsed}s
            </p>
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
            {entry.elapsed >= 20 && (
              <p className="text-xs text-neutral-400">
                Answers usually take 10 to 60 seconds; the language model runs
                on your own server.
              </p>
            )}
          </div>
        ) : entry.status === "error" ? (
          <Alert
            tone="error"
            title="No answer this time"
            action={
              <Button size="sm" onClick={() => onRetry(entry)}>
                <RotateCw className="size-3.5" /> Retry
              </Button>
            }
          >
            {entry.error}
          </Alert>
        ) : (
          <div className="space-y-5">
            <Answer text={entry.result.answer} />

            {entry.result.sources?.length > 0 ? (
              <div>
                <p className="mono mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Sources · {entry.result.sources.length}
                </p>
                <ul className="grid gap-2 lg:grid-cols-2">
                  {entry.result.sources.map((source, index) => (
                    <Citation key={`${source.url}-${index}`} source={source} />
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                No matching passage in the source library. Try rephrasing the
                question.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
              <p className="text-xs text-neutral-500">
                AI-generated from the cited documents. Check the cited pages
                before relying on it.
              </p>
              <Button size="sm" variant="ghost" onClick={copy}>
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}{" "}
                {copied ? "Copied" : "Copy answer"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Library({ sources, error }) {
  return (
    <Card className="min-w-0">
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-950">
          Source library
        </h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Answers come only from these official documents.
        </p>
      </div>
      {error ? (
        <p className="px-5 py-4 text-sm text-neutral-500">
          The library list is unavailable right now.
        </p>
      ) : !sources ? (
        <div className="space-y-3 px-5 py-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {sources.map((source) => (
            <li key={source.url} className="px-5 py-3">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium leading-snug text-neutral-950 hover:underline"
              >
                {source.title}
              </a>
              <p className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                <Badge tone="neutral">
                  {CATEGORY_LABELS[source.category] || source.category}
                </Badge>
                {source.ingested ? (
                  <span>{source.passages} passages indexed</span>
                ) : (
                  <span className="text-red-600">Not indexed yet</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export default function RegulatoryResearch() {
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState([]);
  const [sources, setSources] = useState(null);
  const [sourcesError, setSourcesError] = useState(false);
  const inputRef = useRef(null);
  const busy = entries.some((entry) => entry.status === "loading");

  useEffect(() => {
    regulatoryAPI
      .sources()
      .then((response) => setSources(response.data))
      .catch(() => setSourcesError(true));
  }, []);

  // Ticks the elapsed-time counter on the answer being drafted.
  useEffect(() => {
    if (!busy) return undefined;
    const timer = setInterval(() => {
      setEntries((current) =>
        current.map((entry) =>
          entry.status === "loading"
            ? { ...entry, elapsed: entry.elapsed + 1 }
            : entry,
        ),
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [busy]);

  const ask = async (text, existingId) => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_LENGTH || busy) return;
    const id = existingId || `${Date.now()}`;
    const askedAt = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const pending = {
      id,
      question: trimmed,
      status: "loading",
      elapsed: 0,
      askedAt,
    };

    setEntries((current) =>
      existingId
        ? current.map((entry) => (entry.id === existingId ? pending : entry))
        : [pending, ...current],
    );
    if (!existingId) setQuestion("");

    try {
      const response = await regulatoryAPI.query(trimmed);
      setEntries((current) =>
        current.map((entry) =>
          entry.id === id
            ? { ...entry, status: "done", result: response.data }
            : entry,
        ),
      );
    } catch (error) {
      setEntries((current) =>
        current.map((entry) =>
          entry.id === id
            ? { ...entry, status: "error", error: error.message }
            : entry,
        ),
      );
    }
  };

  const submit = (event) => {
    event.preventDefault();
    ask(question);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
          Tools · Regulatory research
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Regulatory research
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Ask about plastic EPR, environmental compensation or BRSR. Answers are
          drawn only from official CPCB and SEBI documents and cite the page
          they came from.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="p-4">
            <form onSubmit={submit} className="flex items-end gap-3">
              <label htmlFor="research-question" className="sr-only">
                Your question
              </label>
              <textarea
                id="research-question"
                ref={inputRef}
                rows={2}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    ask(question);
                  }
                }}
                placeholder="Ask a question, e.g. What are the EPR obligations for a brand owner?"
                className="block min-h-14 w-full resize-none border-0 bg-transparent px-1 py-1 text-[15px] text-neutral-950 placeholder:text-neutral-400 focus:outline-none"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={busy || question.trim().length < MIN_LENGTH}
                aria-label="Ask"
                className="h-10 w-10 shrink-0 px-0!"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </Button>
            </form>
            <p className="mt-2 border-t border-neutral-100 px-1 pt-2 text-xs text-neutral-400">
              Enter to ask · Shift + Enter for a new line
              {busy ? " · one question at a time" : ""}
            </p>
          </Card>

          {entries.length === 0 ? (
            <Card className="px-5 py-5">
              <p className="mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                Try asking
              </p>
              <div className="mt-4 grid gap-5 md:grid-cols-3">
                {SUGGESTIONS.map((group) => (
                  <div key={group.topic}>
                    <p className="text-sm font-medium text-neutral-950">
                      {group.topic}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {group.questions.map((suggestion) => (
                        <li key={suggestion}>
                          <button
                            type="button"
                            onClick={() => ask(suggestion)}
                            disabled={busy}
                            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:border-neutral-950 hover:text-neutral-950"
                          >
                            {suggestion}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <div className="space-y-4" aria-live="polite">
              {entries.map((entry) => (
                <ResultCard
                  key={entry.id}
                  entry={entry}
                  onRetry={(failed) => ask(failed.question, failed.id)}
                />
              ))}
            </div>
          )}

          {entries.length > 0 && !busy && (
            <p className="text-xs text-neutral-400">
              Questions and answers on this page clear when you leave it.
            </p>
          )}
        </div>

        <div className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Library sources={sources} error={sourcesError} />
          <Card className="px-5 py-4">
            <div className="flex items-start gap-3">
              <BookOpen
                className="mt-0.5 size-4 shrink-0 text-neutral-400"
                aria-hidden
              />
              <div className="space-y-2 text-sm text-neutral-600">
                <p className="font-medium text-neutral-950">How answers work</p>
                <p>
                  Your question is matched to the most relevant passages in the
                  library, and a language model writes an answer from those
                  passages only.
                </p>
                <p>
                  It can still misread a table or miss a clause, so treat
                  answers as a pointer to the right page, not legal advice.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
