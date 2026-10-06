import assert from "node:assert/strict";
import test from "node:test";

import { documentStage, summarizeFiling } from "../src/services/internal/filing.summary.js";

const company = { gst_number: "27ABCDE1234F1Z5", Pibo_category: ["BRAND_OWNER"] };

const doc = (overrides) => ({
  id: overrides.id,
  filename: `${overrides.id}.pdf`,
  status: "VERIFIED",
  created_at: "2026-06-01T10:00:00Z",
  extracted_data: { document_type: "purchase_invoice" },
  document_classifications: [],
  ...overrides,
});

const line = (overrides) => ({
  verified_by_user: true,
  material_code: "PET",
  quantity_kg: 100,
  cpcb_category: "CATEGORY_I",
  ...overrides,
});

const summarize = (documents, extra = {}) =>
  summarizeFiling({ documents, company, fyStart: 2026, currentFy: 2026, categoriesTracked: true, ...extra });

test("splits reviewed quantities by document type and category", () => {
  const result = summarize([
    doc({ id: "inv", document_classifications: [line({}), line({ material_code: "LDPE", cpcb_category: "CATEGORY_II", quantity_kg: 50 })] }),
    doc({ id: "cert", extracted_data: { document_type: "recycling_certificate" }, document_classifications: [line({ quantity_kg: 30 })] }),
  ]);

  assert.deepEqual(result.totals.introduced.by_material, { PET: 100, LDPE: 50 });
  assert.deepEqual(result.totals.introduced.by_category, { CATEGORY_I: 100, CATEGORY_II: 50 });
  assert.equal(result.totals.recycled.total_kg, 30);
  assert.equal(result.ready, true);
});

test("uses corrections over the original suggestion", () => {
  const result = summarize([
    doc({ id: "inv", document_classifications: [line({ corrected_material_code: "HDPE", corrected_quantity_kg: 75, corrected_cpcb_category: "CATEGORY_II" })] }),
  ]);
  assert.deepEqual(result.totals.introduced.by_material, { HDPE: 75 });
  assert.deepEqual(result.totals.introduced.by_category, { CATEGORY_II: 75 });
});

test("excluded and unreviewed lines don't count", () => {
  const result = summarize([
    doc({
      id: "inv",
      status: "REVIEW_PENDING",
      document_classifications: [line({}), line({ material_code: null }), line({ verified_by_user: false })],
    }),
  ]);
  assert.equal(result.totals.introduced.total_kg, 100);
  assert.equal(result.counts.excluded_items, 1);
  assert.equal(result.counts.pending_items, 1);
  assert.deepEqual(result.blockers.map((b) => b.key), ["review"]);
});

test("assigns documents by invoice date, not upload date", () => {
  const result = summarize([
    doc({ id: "old", extracted_data: { document_type: "purchase_invoice", document_date: "2026-02-10" }, document_classifications: [line({})] }),
  ]);
  assert.equal(result.counts.documents, 0);
  assert.deepEqual(result.available_years, [2026, 2025]);
});

test("lists blockers for missing profile, failures and processing", () => {
  const result = summarizeFiling({
    documents: [doc({ id: "a", status: "OCR_FAILED" }), doc({ id: "b", status: "OCR_PROCESSING" })],
    company: {},
    fyStart: 2026,
    currentFy: 2026,
  });
  assert.deepEqual(
    result.blockers.map((b) => b.key),
    ["gst", "pibo", "processing", "failed", "introduced"],
  );
});

test("warns, without blocking, when introduced lines have no category", () => {
  const result = summarize([doc({ id: "inv", document_classifications: [line({ cpcb_category: null })] })]);
  assert.equal(result.ready, true);
  assert.equal(result.warnings[0].key, "uncategorised");
  assert.deepEqual(result.totals.introduced.by_category, { UNCATEGORISED: 100 });
});

test("legacy and evidence documents get the right stage", () => {
  assert.equal(documentStage(doc({ id: "x", extracted_data: { document_type: "invoice" }, document_classifications: [line({})] })), "verified");
  assert.equal(documentStage(doc({ id: "y", extracted_data: { document_type: "epr_record" } })), "evidence");
});

test("reminds, without blocking, when the EPR registration number is missing", () => {
  const result = summarize([doc({ id: "inv", document_classifications: [line({})] })]);
  assert.equal(result.ready, true);
  assert.ok(result.warnings.some((w) => w.key === "epr_registration"));
  const withNumber = summarizeFiling({
    documents: [doc({ id: "inv", document_classifications: [line({})] })],
    company: { ...company, epr_registration_number: "PWP-12345" },
    fyStart: 2026,
    currentFy: 2026,
  });
  assert.equal(withNumber.entity.epr_registration_number, "PWP-12345");
  assert.ok(!withNumber.warnings.some((w) => w.key === "epr_registration"));
});
