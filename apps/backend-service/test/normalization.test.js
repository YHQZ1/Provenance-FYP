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
      line_items: [
        { description: "PET resin", quantity: 500, unit: "kg" },
      ],
    },
  });

  assert.deepEqual(items, [
    { description: "PET resin", quantity: 500, unit: "kg" },
  ]);
});

test("builds a valid classifier request from short item text", () => {
  assert.equal(
    buildClassificationText({ description: "PET", quantity: 2, unit: "kg" }),
    "PET 2 kg material invoice item",
  );
});
