import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClassificationText,
  normalizeLineItems,
  normalizeMaterialCode,
  normalizeQuantity,
} from "../src/services/external/normalization.js";

test("converts metric tons to kilograms", () => {
  assert.equal(normalizeQuantity({ quantity: 2, unit: "MT" }), 2000);
});

test("keeps kilogram quantities unchanged", () => {
  assert.equal(normalizeQuantity({ quantity: "500", unit: "kg" }), 500);
});

test("does not treat item counts as kilograms", () => {
  assert.equal(normalizeQuantity({ quantity: 1, unit: "unit" }), null);
  assert.equal(normalizeQuantity({ quantity: 4, unit: "pieces" }), null);
});

test("maps unknown RAG materials to a nullable code", () => {
  assert.equal(normalizeMaterialCode("UNKNOWN"), null);
  assert.equal(normalizeMaterialCode(null), null);
  assert.equal(normalizeMaterialCode("pet"), "PET");
});

test("prefers nested OCR line items when the top-level array is empty", () => {
  const items = normalizeLineItems({
    line_items: [],
    extracted_data: {
      line_items: [{ description: "PET resin", quantity: 500, unit: "kg" }],
    },
  });

  assert.deepEqual(items, [{ description: "PET resin", quantity: 500, unit: "kg" }]);
});

test("builds a valid classifier request from short item text", () => {
  assert.equal(
    buildClassificationText({ description: "PET", quantity: 2, unit: "kg" }),
    "PET 2 kg material invoice item",
  );
});

import {
  financialYearOf,
  financialYearRange,
  normalizeDocumentType,
  parseDocumentDate,
  parseNumber,
} from "../src/services/external/normalization.js";

test("parses Indian and international thousands separators", () => {
  assert.equal(parseNumber("1,00,000"), 100000);
  assert.equal(parseNumber("1,250.50"), 1250.5);
  assert.equal(parseNumber("abc"), null);
});

test("converts grams, tonnes and quintals to kilograms", () => {
  assert.equal(normalizeQuantity({ quantity: 500, unit: "g" }), 0.5);
  assert.equal(normalizeQuantity({ quantity: "1,200", unit: "kgs" }), 1200);
  assert.equal(normalizeQuantity({ quantity: 2, unit: "tonnes" }), 2000);
  assert.equal(normalizeQuantity({ quantity: 3, unit: "qtl" }), 300);
});

test("treats metres as a non-weight unit", () => {
  assert.equal(normalizeQuantity({ quantity: 25, unit: "MTR" }), null);
});

test("parses day-first document dates", () => {
  assert.equal(parseDocumentDate("27/07/2020"), "2020-07-27");
  assert.equal(parseDocumentDate("12-07-22"), "2022-07-12");
  assert.equal(parseDocumentDate("31/02/2024"), null);
  assert.equal(parseDocumentDate(null), null);
});

test("assigns dates to the Indian financial year", () => {
  assert.equal(financialYearOf("2026-03-31"), 2025);
  assert.equal(financialYearOf("2026-04-01"), 2026);
  assert.equal(financialYearRange(2026).label, "FY 2026-27");
});

test("falls back to purchase invoice for unknown document types", () => {
  assert.equal(normalizeDocumentType("recycling_certificate"), "recycling_certificate");
  assert.equal(normalizeDocumentType("utility"), "purchase_invoice");
});

import { documentTypeOf } from "../src/services/external/normalization.js";

test("treats legacy OCR document types as purchase invoices", () => {
  assert.equal(documentTypeOf({ document_type: "invoice" }), "purchase_invoice");
  assert.equal(documentTypeOf(undefined), "purchase_invoice");
  assert.equal(documentTypeOf({ document_type: "epr_record" }), "epr_record");
});

test("parses month-name document dates", () => {
  assert.equal(parseDocumentDate("12-Jul-22"), "2022-07-12");
  assert.equal(parseDocumentDate("3rd Sept 2026"), "2026-09-03");
  assert.equal(parseDocumentDate("12 Foo 2022"), null);
});
