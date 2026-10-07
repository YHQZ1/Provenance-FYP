const CATEGORY_NAMES = {
  CATEGORY_I: "Category I (rigid)",
  CATEGORY_II: "Category II (flexible)",
  CATEGORY_III: "Category III (multilayered)",
  CATEGORY_IV: "Category IV (compostable)",
  BIODEGRADABLE: "Biodegradable",
  UNCATEGORISED: "no category",
};

const MAX_DOCUMENTS = 20;
const MAX_QUEUE = 10;

export const kg = (value) =>
  value == null
    ? "unknown"
    : `${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 })} kg`;

const day = (value) => (value ? String(value).slice(0, 10) : "no date");

const count = (value, noun) => (value ? `${value} ${noun}${value === 1 ? "" : "s"}` : "none");

const fyLabel = (start) => `FY ${start}-${String(start + 1).slice(-2)}`;

const fyPeriod = (start) => `${fyLabel(start)}, 1 April ${start} to 31 March ${start + 1}`;

const documentStatus = (document) => {
  if (document.stage === "processing") return "still being processed";
  if (document.stage === "failed") return "processing failed and it needs a retry";
  if (document.stage === "evidence") return "stored as evidence, nothing to review";
  if (document.items_pending) return `${count(document.items_pending, "line")} waiting for review`;
  return "fully reviewed, nothing waiting";
};

const breakdown = (byKey = {}, names = {}) =>
  Object.entries(byKey)
    .filter(([, value]) => value)
    .map(([key, value]) => `${names[key] || key} ${kg(value)}`)
    .join(", ") || "none";

const filingSection = (filing) => {
  const view = filing.status === "FINALIZED" && filing.snapshot ? filing.snapshot : filing;
  const { totals, counts, entity } = view;
  const lines = [
    `Financial year: ${fyPeriod(filing.financial_year.start_year)}, ${
      filing.status === "FINALIZED"
        ? `finalized on ${day(filing.finalized_at)}`
        : "open (not finalized)"
    }.`,
    `Company: ${entity.company_name || "name not set"}, GSTIN ${entity.gst_number || "not set"}, EPR registration ${
      entity.epr_registration_number || "not set"
    }.`,
    `Plastic introduced (reviewed purchase invoices): ${kg(totals.introduced.total_kg)}. By material: ${breakdown(
      totals.introduced.by_material,
    )}. By CPCB category: ${breakdown(totals.introduced.by_category, CATEGORY_NAMES)}.`,
    `Recycled (reviewed recycling certificates): ${kg(totals.recycled.total_kg)}. Collected: ${kg(
      totals.collected.total_kg,
    )}.`,
    `Documents dated in this year: ${count(counts.documents, "document")}. Fully reviewed: ${count(
      counts.verified,
      "document",
    )}. Documents needing review: ${count(counts.review, "document")}. Being processed: ${count(
      counts.processing,
      "document",
    )}. Failed: ${count(counts.failed, "document")}. Lines waiting for review: ${count(
      counts.pending_items,
      "line",
    )}.`,
    `Blockers to finalizing: ${view.blockers.length ? "" : "none."}`,
    ...view.blockers.map((blocker) => `- ${blocker.message}`),
  ];
  if (view.warnings?.length) {
    lines.push("Warnings:", ...view.warnings.map((warning) => `- ${warning.message}`));
  }
  if (filing.late_documents?.length) {
    lines.push(
      `Documents dated in this year that arrived after it was finalized: ${filing.late_documents
        .map((document) => document.filename)
        .join(", ")}.`,
    );
  }
  const documents = filing.documents || [];
  if (documents.length) {
    lines.push("Documents:");
    for (const document of documents.slice(0, MAX_DOCUMENTS)) {
      lines.push(
        `- ${document.filename}: ${document.document_type_label}, dated ${day(
          document.effective_date,
        )}, ${documentStatus(document)}, ${kg(document.verified_kg)} counted`,
      );
    }
    if (documents.length > MAX_DOCUMENTS) {
      lines.push(`- and ${documents.length - MAX_DOCUMENTS} more`);
    }
  }
  return lines;
};

const queueSection = (queue) => {
  const { summary, data } = queue;
  const lines = [
    `Review queue: ${summary.total} line(s) waiting (${summary.suggested} ready to approve as suggested, ${summary.needs_attention} needing attention).`,
  ];
  for (const item of data.slice(0, MAX_QUEUE)) {
    const suggestion = item.material_code
      ? `suggested ${item.material_code}${item.cpcb_category ? `, ${CATEGORY_NAMES[item.cpcb_category]}` : ""}`
      : "no material identified";
    lines.push(
      `- ${item.document_filename}: "${item.line_description || "line"}", ${suggestion}, ${kg(item.quantity_kg)}`,
    );
  }
  if (data.length > MAX_QUEUE) lines.push(`- and ${data.length - MAX_QUEUE} more`);
  return lines;
};

const obligationsSection = (obligations) => {
  const lines = [`EPR obligations for ${obligations.financial_year.label} (Q = A + B - C):`];
  for (const row of obligations.rows) {
    if (!row.introduced_kg && !row.epr_quantity_kg && !row.recycled_kg) continue;
    lines.push(
      `- ${CATEGORY_NAMES[row.category]}: introduced ${kg(row.introduced_kg)}, Q ${kg(row.epr_quantity_kg)}, target ${
        row.epr_target_pct ?? "not set"
      }%, obligation ${kg(row.obligation_kg)}, recycled ${kg(row.recycled_kg)}, shortfall ${kg(row.shortfall_kg)}`,
    );
  }
  lines.push(
    `- Total: obligation ${kg(obligations.totals.obligation_kg)}, recycled ${kg(
      obligations.totals.recycled_kg,
    )}, shortfall ${kg(obligations.totals.shortfall_kg)}`,
  );
  return lines;
};

const activitySection = (activity) => {
  const reviewers = [
    ...new Set(
      activity.data
        .filter((event) => event.action.startsWith("line") && event.actor_name)
        .map((event) => event.actor_name),
    ),
  ];
  const finalized = activity.data.find((event) => event.action === "filing.finalized");
  return [
    `People who made review decisions (approved, corrected or excluded lines) recently: ${
      reviewers.join(", ") || "none recorded"
    }.`,
    finalized
      ? `Last finalized by ${finalized.actor_name || "someone"} on ${day(finalized.created_at)}.`
      : "No finalization recorded recently.",
    "Recent activity:",
    ...(activity.data.length
      ? activity.data.map(
          (event) =>
            `- ${day(event.created_at)}: ${event.actor_name || "Someone"} ${event.summary}`,
        )
      : ["- nothing recorded"]),
  ];
};

const documentSection = (document) => {
  const fields = document.fields || {};
  const lines = [
    `Open document: ${document.filename} (${String(document.document_type).replace(/_/g, " ")}), dated ${day(
      document.effective_date,
    )} (${document.document_date ? "invoice date" : "upload date"}), so it counts toward ${fyPeriod(
      document.financial_year,
    )}.`,
    `Does this document need attention? ${
      document.items_pending
        ? `Yes: ${count(document.items_pending, "line")} waiting for review.`
        : document.status === "OCR_FAILED"
          ? "Yes: processing failed and it needs a retry."
          : document.filing?.late
            ? "Yes: it is dated in a finalized year but arrived after sign-off, so it isn't in the filed numbers."
            : "No. Nothing on it is flagged and all its lines are reviewed."
    }`,
    `Invoice number ${fields.invoice_number?.value || "not read"}, GSTIN ${fields.gstin?.value || "not read"}.`,
    `Status note: ${document.reasoning || "none"}`,
    "Lines:",
  ];
  for (const line of document.classifications || []) {
    const material = line.corrected_material_code || line.material_code;
    const quantity = line.corrected_quantity_kg ?? line.quantity_kg;
    const state = !line.verified_by_user
      ? "waiting for review"
      : material
        ? `approved${line.reviewed_by_name ? ` by ${line.reviewed_by_name}` : ""}`
        : "excluded";
    lines.push(
      `- "${line.matched_synonym || "line"}": ${material || "no material"}, ${kg(quantity)}, ${state}`,
    );
  }
  if (document.warnings?.length) lines.push(`Reading warnings: ${document.warnings.join("; ")}`);
  return lines;
};

export const buildBrief = ({
  filing,
  obligations,
  queue,
  activity,
  document,
  unavailable = [],
}) => {
  const sections = [];
  if (filing) sections.push(filingSection(filing));
  if (queue) sections.push(queueSection(queue));
  if (obligations) sections.push(obligationsSection(obligations));
  if (activity) sections.push(activitySection(activity));
  if (document) sections.push(documentSection(document));
  if (unavailable.length) sections.push([`Couldn't load: ${unavailable.join(", ")}.`]);
  return sections.map((lines) => lines.join("\n")).join("\n\n");
};
