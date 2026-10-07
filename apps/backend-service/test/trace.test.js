import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildBrief } from "../src/services/internal/trace/brief.js";
import { gatherFacts } from "../src/services/internal/trace/facts.js";
import { detectAction } from "../src/services/internal/trace/action.js";
import { detectIntents } from "../src/services/internal/trace/intent.js";
import { buildLinks, buildSources } from "../src/services/internal/trace/links.js";
import { buildMessages } from "../src/services/internal/trace/prompt.js";
import { parseTraceRequest } from "../src/services/internal/trace/request.js";
import { createLineParser } from "../src/lib/ndjson.js";

const filing = {
  financial_year: { label: "FY 2026-27", start_year: 2026 },
  status: "OPEN",
  entity: { company_name: "Acme", gst_number: "27ABCDE1234F1Z5", epr_registration_number: null },
  totals: {
    introduced: {
      total_kg: 1500,
      by_material: { PET: 1200, HDPE: 300 },
      by_category: { CATEGORY_I: 1500 },
    },
    recycled: { total_kg: 400, by_material: { PET: 400 }, by_category: {} },
    collected: { total_kg: 0, by_material: {}, by_category: {} },
  },
  counts: {
    documents: 2,
    verified: 1,
    review: 1,
    processing: 0,
    failed: 0,
    evidence: 0,
    pending_items: 3,
  },
  blockers: [{ message: "3 line item(s) are waiting for review." }],
  warnings: [],
  documents: [
    {
      id: "d1",
      filename: "invoice-001.pdf",
      document_type_label: "Purchase invoice",
      effective_date: "2026-05-01",
      stage: "verified",
      items_total: 2,
      items_pending: 0,
      verified_kg: 1500,
    },
    {
      id: "d2",
      filename: "invoice-002.pdf",
      document_type_label: "Purchase invoice",
      effective_date: "2026-06-01",
      stage: "review",
      items_total: 3,
      items_pending: 3,
      verified_kg: 0,
    },
  ],
};

test("questions about the user's data fetch workspace facts; regulation questions fetch sources", () => {
  assert.deepEqual(pick(detectIntents("How much PET did we introduce this year?")), {
    workspace: true,
    regulation: false,
  });
  assert.deepEqual(pick(detectIntents("What does CPCB say about environmental compensation?")), {
    workspace: false,
    regulation: true,
  });
  assert.equal(detectIntents("What's my shortfall?").obligations, true);
  assert.equal(detectIntents("Who approved the HDPE line?").activity, true);
  assert.equal(detectIntents("Which lines are pending?").review, true);
});

test("the page and open document shape what is fetched", () => {
  assert.equal(detectIntents("explain this", { page: "/review" }).review, true);
  assert.equal(detectIntents("why is this flagged?", { documentId: "x" }).document, true);
  assert.equal(detectIntents("hello", { page: "/regulatory" }).regulation, true);
  assert.deepEqual(pick(detectIntents("hello", { page: "/dashboard" })), {
    workspace: true,
    regulation: false,
  });
  assert.deepEqual(pick(detectIntents("Delete invoice_4.jpg")), {
    workspace: true,
    regulation: false,
  });
});

test("facts are gathered through read-only readers, scoped to the user, tolerating failures", async () => {
  const calls = [];
  const reader =
    (name, value) =>
    (...args) => {
      calls.push([name, ...args]);
      if (value instanceof Error) throw value;
      return value;
    };
  const facts = await gatherFacts({
    readers: {
      filing: reader("filing", filing),
      obligations: reader("obligations", new Error("down")),
      reviewQueue: reader("reviewQueue", { summary: {}, data: [] }),
      activity: reader("activity", { data: [] }),
      document: reader("document", null),
      regulations: reader("regulations", { passages: [{ text: "t", citation: "c" }] }),
    },
    userId: "user-1",
    intents: {
      workspace: true,
      obligations: true,
      review: false,
      activity: false,
      document: false,
      regulation: true,
    },
    fy: 2026,
    question: "q",
  });

  assert.deepEqual(calls.map(([name]) => name).sort(), ["filing", "obligations", "regulations"]);
  assert.deepEqual(calls.find(([name]) => name === "filing").slice(1), ["user-1", 2026]);
  assert.equal(facts.filing, filing);
  assert.equal(facts.obligations, null);
  assert.deepEqual(facts.unavailable, ["obligations"]);
  assert.equal(facts.passages.length, 1);
});

test("Trace's code never calls anything that writes", () => {
  const files = [
    ...fs
      .readdirSync("src/services/internal/trace")
      .map((file) => path.join("src/services/internal/trace", file)),
    "src/services/external/ollama.service.js",
    "src/controllers/trace.controller.js",
  ];
  const writes =
    /\.(approve|correct|exclude|approveSuggested|createDocument|updateDocument|deleteDocument|retryDocument|finalize|reopen|update|upsert|insert|delete|remove|record|schedule|addTradeName|removeTradeName|updateCompany|createCompany)\(/;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(writes.test(source), false, `${file} calls a write method`);
  }
});

test("the brief states totals, blockers and documents in plain words", () => {
  const brief = buildBrief({ filing, unavailable: ["obligations"] });
  assert.match(brief, /FY 2026-27, 1 April 2026 to 31 March 2027, open \(not finalized\)/);
  assert.match(brief, /Documents needing review: 1 document\. Being processed: none\./);
  assert.match(brief, /Plastic introduced .*: 1,500 kg\. By material: PET 1,200 kg, HDPE 300 kg/);
  assert.match(brief, /- 3 line item\(s\) are waiting for review\./);
  assert.match(
    brief,
    /- invoice-002\.pdf: Purchase invoice, dated 2026-06-01, 3 lines waiting for review/,
  );
  assert.match(brief, /- invoice-001\.pdf: .*fully reviewed, nothing waiting, 1,500 kg counted/);
  assert.match(brief, /EPR registration not set/);
  assert.match(brief, /Couldn't load: obligations\./);
});

test("a finalized year is described with its signed-off numbers", () => {
  const snapshot = {
    ...filing,
    totals: {
      ...filing.totals,
      introduced: { total_kg: 999, by_material: { PET: 999 }, by_category: {} },
    },
  };
  const brief = buildBrief({
    filing: { ...filing, status: "FINALIZED", finalized_at: "2027-06-01", snapshot },
  });
  assert.match(brief, /finalized on 2027-06-01/);
  assert.match(brief, /Plastic introduced .*: 999 kg/);
});

test("the prompt carries the rules, recent history and the facts", () => {
  const messages = buildMessages({
    question: "What's blocking me?",
    history: Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user",
      content: `turn ${index}`,
    })),
    brief: "Blockers to finalizing: none.",
    passages: [{ citation: "EC Regime, p. 28", text: "by the 30th June" }],
    page: "/filing",
    fyLabel: "FY 2026-27",
    today: "2026-10-07",
  });
  assert.equal(messages[0].role, "system");
  assert.match(messages[0].content, /can't change anything/);
  assert.match(messages[0].content, /Filing page, looking at FY 2026-27/);
  assert.equal(messages.length, 1 + 6 + 1);
  assert.equal(messages[1].content, "turn 4");
  assert.match(messages.at(-1).content, /Workspace facts:\nBlockers/);
  assert.match(messages.at(-1).content, /\[Source: EC Regime, p\. 28\]\nby the 30th June/);
  assert.match(messages.at(-1).content, /Question: What's blocking me\?$/);
});

test("links point only to documents the answer names and pages the question needs", () => {
  const links = buildLinks({
    answer: "invoice-002.pdf still has 3 lines to review before you can finalize.",
    documents: [
      { id: "d1", filename: "invoice-001.pdf" },
      { id: "d2", filename: "invoice-002.pdf" },
    ],
    intents: { review: true, obligations: false },
    page: "/dashboard",
  });
  assert.deepEqual(links, [
    { label: "invoice-002.pdf", to: "/documents?open=d2" },
    { label: "Open Review", to: "/review" },
    { label: "Open Filing", to: "/filing" },
  ]);
  assert.deepEqual(buildLinks({ answer: "x", intents: { review: true }, page: "/review" }), []);
});

test("sources are grouped by document with sorted pages", () => {
  assert.deepEqual(
    buildSources(
      [
        { source: "EC Regime", url: "u1", page: 29 },
        { source: "EC Regime", url: "u1", page: 28 },
        { source: "Manual", url: "u2", page: 99 },
      ],
      "Due by 30 June (EC Regime, p. 28).",
    ),
    [
      { name: "EC Regime", url: "u1", pages: [28, 29] },
      { name: "Manual", url: "u2", pages: [99] },
    ],
  );
});

test("sources are omitted when the answer cites no page", () => {
  assert.deepEqual(
    buildSources([{ source: "EC Regime", url: "u1", page: 28 }], "You can't delete it."),
    [],
  );
});

test("requests are validated and trimmed", () => {
  const parsed = parseTraceRequest({
    message: "  What's my shortfall?  ",
    history: [{ role: "user", content: "hi" }],
    context: { fy: "2026", documentId: "not-a-uuid", page: "/obligations" },
  });
  assert.deepEqual(parsed.context, { fy: 2026, documentId: null, page: "/obligations" });
  assert.equal(parsed.question, "What's my shortfall?");
  assert.throws(() => parseTraceRequest({ message: "" }), /between 2 and 1,000/);
  assert.throws(
    () => parseTraceRequest({ message: "hi there", history: [{ role: "system", content: "x" }] }),
    /History/,
  );
  assert.throws(
    () => parseTraceRequest({ message: "hi there", context: { fy: 1900 } }),
    /fy must be/,
  );
});

test("streamed NDJSON is parsed across chunk boundaries", () => {
  const seen = [];
  const parser = createLineParser((object) => seen.push(object.n));
  parser.push('{"n":1}\n{"n"');
  parser.push(':2}\n{"n":3}');
  parser.end();
  assert.deepEqual(seen, [1, 2, 3]);
});

test("requests to change something are refused with the page that does it, without the model", () => {
  const page = (message) => detectAction(message)?.link.to ?? null;
  assert.equal(page("Approve all pending lines for me"), "/review");
  assert.equal(page("Delete invoice_4.jpg"), "/documents");
  assert.equal(page("please finalize FY 2026-27"), "/filing");
  assert.equal(page("Can you change my GSTIN?"), "/settings");
  assert.equal(page("remove the trade name POLYPET"), "/materials");
  assert.equal(page("How do I approve lines?"), "/review");
  assert.match(detectAction("Where can I delete a document?")?.answer, /^Open Documents/);
  assert.equal(page("What can I delete?"), null);
  assert.match(detectAction("Approve everything")?.answer, /^I can't make changes in Provenance/);
});

test("activity facts name the reviewers and the last finalization", () => {
  const brief = buildBrief({
    activity: {
      data: [
        {
          action: "filing.finalized",
          actor_name: "Asha",
          summary: "finalized FY 2024-25",
          created_at: "2026-10-07T10:00:00Z",
        },
        {
          action: "line.corrected",
          actor_name: "Ravi",
          summary: "corrected a line",
          created_at: "2026-10-06T10:00:00Z",
        },
        {
          action: "lines.approved_in_bulk",
          actor_name: "Asha",
          summary: "approved 3 lines",
          created_at: "2026-10-05T10:00:00Z",
        },
      ],
    },
  });
  assert.match(brief, /review decisions .*: Ravi, Asha\./);
  assert.match(brief, /Last finalized by Asha on 2026-10-07\./);
});

function pick(intents) {
  return { workspace: intents.workspace, regulation: intents.regulation };
}
