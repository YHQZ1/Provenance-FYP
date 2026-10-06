import {
  DOCUMENT_TYPES,
  documentTypeOf,
  financialYearOf,
  financialYearRange,
} from "../external/normalization.js";

export const PROCESSING_STATUSES = [
  "PENDING",
  "OCR_PROCESSING",
  "COMPLETED",
  "RAG_PROCESSING",
];
const FAILED_STATUSES = ["OCR_FAILED"];

// Which side of the EPR ledger a document type contributes to.
const LEDGER = {
  purchase_invoice: "introduced",
  recycling_certificate: "recycled",
  collection_receipt: "collected",
};

export const effectiveDate = (document) =>
  document.extracted_data?.document_date || document.created_at;

export const documentStage = (document) => {
  if (PROCESSING_STATUSES.includes(document.status)) return "processing";
  if (FAILED_STATUSES.includes(document.status)) return "failed";
  if (!LEDGER[documentTypeOf(document.extracted_data)]) return "evidence";
  const items = document.document_classifications || [];
  if (items.length > 0 && items.every((c) => c.verified_by_user)) return "verified";
  return "review";
};

// Where a document stands against finalized years: `included` is part of signed-off numbers,
// `late` is dated in a finalized year but arrived after it was signed off.
export const filingPosition = (document, years) => {
  const fy = financialYearOf(effectiveDate(document));
  const covered = years.get(fy);
  if (!covered) return { financial_year: fy, finalized: false, included: false, late: false };
  const included = covered.has(document.id);
  return { financial_year: fy, finalized: true, included, late: !included };
};

// The values a reviewer signed off: corrections win over the original suggestion.
export const effectiveLine = (line) => ({
  material_code: line.corrected_material_code || line.material_code || null,
  cpcb_category: line.corrected_cpcb_category || line.cpcb_category || null,
  quantity_kg: line.corrected_quantity_kg ?? line.quantity_kg ?? null,
});

const round = (value) => Number(value.toFixed(3));

const emptyBucket = () => ({ by_material: {}, by_category: {}, total_kg: 0 });

const addLine = (bucket, line) => {
  const kg = Number(line.quantity_kg);
  bucket.by_material[line.material_code] = round((bucket.by_material[line.material_code] || 0) + kg);
  const category = line.cpcb_category || "UNCATEGORISED";
  bucket.by_category[category] = round((bucket.by_category[category] || 0) + kg);
  bucket.total_kg = round(bucket.total_kg + kg);
};

export const summarizeFiling = ({ documents, company, fyStart, currentFy, categoriesTracked = false }) => {
  const ledger = { introduced: emptyBucket(), recycled: emptyBucket(), collected: emptyBucket() };
  const stages = { processing: 0, failed: 0, review: 0, verified: 0, evidence: 0 };
  let pendingItems = 0;
  let excludedItems = 0;
  let uncategorisedItems = 0;
  const years = new Set([currentFy]);
  const yearDocuments = [];

  for (const document of documents) {
    const date = effectiveDate(document);
    const fy = financialYearOf(date);
    years.add(fy);
    if (fy !== fyStart) continue;

    const type = documentTypeOf(document.extracted_data);
    const stage = documentStage(document);
    stages[stage] += 1;
    const items = document.document_classifications || [];
    let documentKg = 0;

    for (const item of items) {
      if (!item.verified_by_user) {
        pendingItems += 1;
        continue;
      }
      const line = effectiveLine(item);
      if (!line.material_code || line.quantity_kg == null) {
        excludedItems += 1;
        continue;
      }
      if (LEDGER[type]) {
        addLine(ledger[LEDGER[type]], line);
        if (type === "purchase_invoice" && !line.cpcb_category) uncategorisedItems += 1;
      }
      documentKg += Number(line.quantity_kg);
    }

    yearDocuments.push({
      id: document.id,
      filename: document.filename,
      document_type: type,
      document_type_label: DOCUMENT_TYPES[type],
      stage,
      status: document.status,
      effective_date: date,
      date_source: document.extracted_data?.document_date ? "document" : "upload",
      items_total: items.length,
      items_pending: items.filter((c) => !c.verified_by_user).length,
      verified_kg: round(documentKg),
    });
  }

  const blockers = [];
  if (!company?.gst_number) {
    blockers.push({ key: "gst", message: "Add your company GSTIN.", action: "settings" });
  }
  if (!company?.Pibo_category?.length) {
    blockers.push({ key: "pibo", message: "Select your PIBO category (producer, importer, or brand owner).", action: "settings" });
  }
  if (stages.processing > 0) {
    blockers.push({ key: "processing", message: `${stages.processing} document(s) are still being processed.`, action: "documents" });
  }
  if (stages.failed > 0) {
    blockers.push({ key: "failed", message: `${stages.failed} document(s) failed to process. Retry or delete them.`, action: "documents" });
  }
  if (pendingItems > 0) {
    blockers.push({ key: "review", message: `${pendingItems} line item(s) are waiting for review.`, action: "review" });
  }
  if (ledger.introduced.total_kg === 0) {
    blockers.push({ key: "introduced", message: "No reviewed plastic quantities from purchase invoices yet.", action: "documents" });
  }

  // Category data is advisory until every introduced line carries one; it doesn't block finalizing.
  const warnings = [];
  if (categoriesTracked && uncategorisedItems > 0) {
    warnings.push({
      key: "uncategorised",
      message: `${uncategorisedItems} reviewed line(s) have no CPCB category, so category-wise totals are incomplete.`,
      action: "review",
    });
  }

  if (company && !company.epr_registration_number) {
    warnings.push({
      key: "epr_registration",
      message: "Add your CPCB EPR registration number in Settings so it appears on exports.",
      action: "settings",
    });
  }

  return {
    financial_year: financialYearRange(fyStart),
    available_years: [...years].sort((a, b) => b - a),
    entity: {
      company_name: company?.company_name || null,
      gst_number: company?.gst_number || null,
      epr_registration_number: company?.epr_registration_number || null,
      pibo_category: company?.Pibo_category || [],
    },
    totals: ledger,
    counts: {
      documents: yearDocuments.length,
      ...stages,
      pending_items: pendingItems,
      excluded_items: excludedItems,
      uncategorised_items: uncategorisedItems,
    },
    documents: yearDocuments.sort((a, b) =>
      String(b.effective_date).localeCompare(String(a.effective_date)),
    ),
    blockers,
    warnings,
    ready: blockers.length === 0,
    categories_tracked: categoriesTracked,
  };
};
