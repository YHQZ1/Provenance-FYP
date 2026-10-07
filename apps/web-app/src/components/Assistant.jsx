import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowUp, ArrowUpRight, FileText, RotateCcw, Square, X } from "lucide-react";
import { askTrace } from "../lib/trace";
import { useWorkspace } from "../lib/workspace";
import AnswerText from "./AnswerText";

const cx = (...classes) => classes.filter(Boolean).join(" ");

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

const PANEL = "w-[min(400px,calc(100vw-2.5rem))] h-[min(600px,calc(100vh-6rem))]";
const EASE = "ease-[cubic-bezier(0.2,0.8,0.2,1)]";
const STORAGE_KEY = "provenance-trace";
const HISTORY_TURNS = 6;

const SUGGESTIONS = {
  "/dashboard": [
    "What's left before I can finalize this year?",
    "How much plastic did we introduce this year?",
  ],
  "/documents": ["Which documents still need review?", "Which documents are dated in this year?"],
  "/review": ["How many lines are waiting for review?", "Which lines have no material yet?"],
  "/filing": ["Is anything stopping me from finalizing?", "When is the annual return due?"],
  "/obligations": ["What's my shortfall in each category?", "How is the EPR quantity calculated?"],
  "/activity": ["What changed recently?", "Who approved lines this year?"],
  "/regulatory": [
    "What is extended producer responsibility?",
    "How is environmental compensation calculated?",
  ],
  "/settings": ["What's missing from my company profile?"],
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const SHORTCUT = isMac ? "⌘J" : "Ctrl+J";

const loadMessages = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
    return saved.map((message) =>
      message.status === "streaming" ? { ...message, status: "done" } : message,
    );
  } catch {
    return [];
  }
};

const nextId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function Chip({ children, ...props }) {
  const Component = props.to ? Link : "a";
  return (
    <Component
      {...props}
      className="inline-flex max-w-full items-center gap-1 rounded-sm border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-950"
    >
      {children}
    </Component>
  );
}

function Reply({ message, onRetry }) {
  if (message.status === "error") {
    return (
      <div className="text-sm">
        <p className="text-red-700">{message.error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1.5 text-xs font-medium text-neutral-700 hover:text-emerald-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const waiting = message.status === "streaming" && !message.content;
  return (
    <div className="min-w-0">
      {waiting ? (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <span className="size-1.5 rounded-full bg-emerald-600 motion-safe:animate-pulse" />
          Reading your workspace
        </p>
      ) : (
        <AnswerText text={message.content} className="text-sm" />
      )}
      {message.stopped && <p className="mt-1 text-xs text-neutral-400">Stopped</p>}
      {(message.links?.length > 0 || message.sources?.length > 0) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {message.links?.map((link) => (
            <Chip key={link.to} to={link.to}>
              {link.to.startsWith("/documents") && <FileText className="size-3" aria-hidden />}
              <span className="truncate">{link.label}</span>
              <ArrowUpRight className="size-3 shrink-0" aria-hidden />
            </Chip>
          ))}
          {message.sources?.map((source) => (
            <Chip
              key={source.url || source.name}
              href={source.pages.length ? `${source.url}#page=${source.pages[0]}` : source.url}
              target="_blank"
              rel="noreferrer"
            >
              <span className="truncate">
                {source.name}
                {source.pages.length > 0 && ` · p. ${source.pages.join(", ")}`}
              </span>
              <ArrowUpRight className="size-3 shrink-0" aria-hidden />
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(loadMessages);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const rootRef = useRef(null);
  const launcherRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const abortRef = useRef(null);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { fy } = useWorkspace() || {};

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages]);

  useEffect(() => {
    const onShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, []);

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
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 200);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      launcher?.focus();
    };
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const update = (id, change) =>
    setMessages((current) =>
      current.map((message) => (message.id === id ? change(message) : message)),
    );

  const send = useCallback(
    async (text) => {
      const question = text.trim();
      if (question.length < 2 || streaming) return;

      const history = messages
        .filter(
          (message, index) =>
            message.content &&
            message.status !== "error" &&
            messages[index + 1]?.status !== "error",
        )
        .slice(-HISTORY_TURNS)
        .map(({ role, content }) => ({ role, content }));
      const replyId = nextId();
      setMessages((current) => [
        ...current,
        { id: nextId(), role: "user", content: question, status: "done" },
        { id: replyId, role: "assistant", content: "", status: "streaming", question },
      ]);
      setDraft("");
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const result = await askTrace({
          message: question,
          history,
          context: {
            page: location.pathname,
            fy,
            documentId:
              location.pathname === "/documents"
                ? searchParams.get("open") || undefined
                : undefined,
          },
          signal: controller.signal,
          onToken: (piece) =>
            update(replyId, (message) => ({ ...message, content: message.content + piece })),
        });
        update(replyId, (message) => ({
          ...message,
          status: "done",
          links: result.links,
          sources: result.sources,
        }));
      } catch (error) {
        update(replyId, (message) =>
          error.name === "AbortError"
            ? { ...message, status: "done", stopped: true }
            : { ...message, status: "error", error: error.message },
        );
      } finally {
        abortRef.current = null;
        setStreaming(false);
      }
    },
    [messages, streaming, location.pathname, searchParams, fy],
  );

  const retry = (message) => {
    setMessages((current) => {
      const index = current.findIndex((item) => item.id === message.id);
      return current.filter((_, position) => position !== index && position !== index - 1);
    });
    send(message.question);
  };

  const clear = () => {
    abortRef.current?.abort();
    setMessages([]);
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(draft);
    }
  };

  const suggestions = SUGGESTIONS[location.pathname] || SUGGESTIONS["/dashboard"];

  return (
    <div className="group fixed bottom-5 right-5 z-40 print:hidden">
      <span
        role="tooltip"
        className={cx(
          "pointer-events-none absolute bottom-3 right-full mr-3 whitespace-nowrap rounded-md bg-neutral-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity duration-150",
          !open && "group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        Ask Trace <span className="text-neutral-400">{SHORTCUT}</span>
      </span>

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
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-label="Start a new chat"
                  title="New chat"
                >
                  <RotateCcw className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label="Close Trace"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-t-lg bg-white">
            <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
              {messages.length === 0 ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-neutral-950">
                      Ask about your filing or the rules
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                      Trace reads your documents, reviews and filings, and the CPCB and SEBI
                      sources. It can't change anything.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => send(suggestion)}
                        className="block w-full rounded-md border border-neutral-200 px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-950"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ol className="space-y-4">
                  {messages.map((message) => (
                    <li
                      key={message.id}
                      className={cx(message.role === "user" && "flex justify-end")}
                    >
                      {message.role === "user" ? (
                        <p className="max-w-[85%] whitespace-pre-wrap rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-950">
                          {message.content}
                        </p>
                      ) : (
                        <Reply message={message} onRetry={() => retry(message)} />
                      )}
                    </li>
                  ))}
                </ol>
              )}
              <div ref={endRef} />
            </div>

            <div className="shrink-0 border-t border-neutral-100 px-4 pb-3 pt-3">
              <div className="flex items-end gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 has-[:focus-visible]:border-neutral-400">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onInput={(event) => {
                    event.target.style.height = "auto";
                    event.target.style.height = `${Math.min(event.target.scrollHeight, 96)}px`;
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Ask Trace anything…"
                  aria-label="Ask Trace"
                  maxLength={1000}
                  className="max-h-24 min-h-6 flex-1 resize-none bg-transparent text-sm text-neutral-950 placeholder:text-neutral-400 focus:outline-none"
                />
                {streaming ? (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-950 text-white hover:bg-neutral-800"
                    aria-label="Stop answering"
                  >
                    <Square className="size-3" fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => send(draft)}
                    disabled={draft.trim().length < 2}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-950 text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
                    aria-label="Send"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">
                Answers can be wrong. Check the cited pages and your documents.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
