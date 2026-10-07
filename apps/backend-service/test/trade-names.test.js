import assert from "node:assert/strict";
import test from "node:test";

import { matchTradeName, suggestTradeNames } from "../src/services/internal/trade-names.js";

const names = [
  { trade_name: "Polypet", material_code: "PET" },
  { trade_name: "POLYPET 3020", material_code: "PET", cpcb_category: "CATEGORY_I" },
  { trade_name: "HD5400G", material_code: "HDPE" },
];

test("matches whole words, ignoring case and punctuation, preferring the longest name", () => {
  assert.equal(
    matchTradeName("Reliance Polypet-3020 bottle grade", names).trade_name,
    "POLYPET 3020",
  );
  assert.equal(matchTradeName("SPIL HD5400G granules", names).material_code, "HDPE");
  assert.equal(matchTradeName("Polypetrol drums", names), null);
  assert.equal(matchTradeName("", names), null);
});

test("suggests corrected lines once, most frequent first, skipping covered ones", () => {
  const suggestions = suggestTradeNames(
    [
      { line: "Bopp film 20 micron", material_code: "PP", created_at: "2026-05-01" },
      { line: "BOPP film 20 micron", material_code: "PP", created_at: "2026-06-01" },
      { line: "Laminated pouch", material_code: "MLP", created_at: "2026-06-02" },
      { line: "Polypet 3020 bottle", material_code: "PET", created_at: "2026-06-03" },
      { line: "", material_code: "PET", created_at: "2026-06-04" },
      {
        line: "DESCRIPTION OF GOODS HSN RATE DSC% PRICE QTY NET AMT",
        material_code: "HDPE",
        created_at: "2026-06-05",
      },
    ],
    names,
  );
  assert.deepEqual(
    suggestions.map((s) => [s.material_code, s.times]),
    [
      ["PP", 2],
      ["MLP", 1],
    ],
  );
  assert.equal(suggestions[0].last_corrected_at, "2026-06-01");
});
