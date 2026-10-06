import assert from "node:assert/strict";
import test from "node:test";

import { filingPosition } from "../src/services/internal/filing.lock.js";

const doc = (id, date) => ({
  id,
  created_at: "2026-06-01T10:00:00Z",
  extracted_data: { document_date: date },
});

// FY 2025-26 is finalized and its snapshot covers only "filed".
const years = new Map([[2025, new Set(["filed"])]]);

test("a document in the finalized snapshot is included, not late", () => {
  assert.deepEqual(filingPosition(doc("filed", "2025-09-10"), years), {
    financial_year: 2025,
    finalized: true,
    included: true,
    late: false,
  });
});

test("a document dated in a finalized year but not in its snapshot is late", () => {
  const position = filingPosition(doc("new", "2026-02-14"), years);
  assert.equal(position.late, true);
  assert.equal(position.included, false);
});

test("a document in an open year is neither", () => {
  const position = filingPosition(doc("open", null), years);
  assert.equal(position.financial_year, 2026);
  assert.equal(position.finalized, false);
  assert.equal(position.late, false);
});
