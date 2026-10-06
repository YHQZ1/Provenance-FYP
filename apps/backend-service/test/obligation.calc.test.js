import assert from "node:assert/strict";
import test from "node:test";

import {
  computeObligations,
  defaultTargets,
  introducedForBasis,
} from "../src/services/internal/obligation.calc.js";

const row = (result, category) => result.rows.find((r) => r.category === category);

test("Q = A + B − C, then the EPR target and recycling minimum apply", () => {
  const result = computeObligations({
    fyStart: 2025,
    introduced: { CATEGORY_I: 200 },
    recycled: { CATEGORY_I: 100 },
    inputs: { CATEGORY_I: { pre_consumer_kg: 50, supplied_kg: 20 } },
  });
  const cat1 = row(result, "CATEGORY_I");
  assert.equal(cat1.epr_quantity_kg, 230);
  assert.equal(cat1.epr_target_pct, 100);
  assert.equal(cat1.obligation_kg, 230);
  assert.equal(cat1.recycling_min_pct, 60);
  assert.equal(cat1.recycling_min_kg, 138);
  assert.equal(cat1.shortfall_kg, 130);
  assert.equal(cat1.recycling_gap_kg, 38);
  assert.equal(cat1.epr_target_source, "default");
});

test("company targets and compensation rates override the defaults", () => {
  const result = computeObligations({
    fyStart: 2025,
    introduced: { CATEGORY_II: 1000 },
    inputs: { CATEGORY_II: { epr_target_pct: 50, recycling_min_pct: 10, ec_rate_per_kg: 5 } },
  });
  const cat2 = row(result, "CATEGORY_II");
  assert.equal(cat2.obligation_kg, 500);
  assert.equal(cat2.recycling_min_kg, 50);
  assert.equal(cat2.compensation_estimate, 2500);
  assert.equal(cat2.epr_target_source, "company");
});

test("Q never goes negative and over-fulfilment leaves no shortfall", () => {
  const result = computeObligations({
    fyStart: 2026,
    introduced: { CATEGORY_III: 10 },
    recycled: { CATEGORY_III: 50 },
    inputs: { CATEGORY_III: { supplied_kg: 40 } },
  });
  const cat3 = row(result, "CATEGORY_III");
  assert.equal(cat3.epr_quantity_kg, 0);
  assert.equal(cat3.shortfall_kg, 0);
});

test("default targets follow the guideline schedule and stop at the final value", () => {
  assert.deepEqual(defaultTargets("CATEGORY_I", 2022), { epr_target_pct: 70, recycling_min_pct: null });
  assert.deepEqual(defaultTargets("CATEGORY_II", 2024), { epr_target_pct: 100, recycling_min_pct: 30 });
  assert.deepEqual(defaultTargets("CATEGORY_I", 2030), { epr_target_pct: 100, recycling_min_pct: 80 });
  assert.deepEqual(defaultTargets("CATEGORY_IV", 2026), { epr_target_pct: null, recycling_min_pct: null });
});

test("without a target there is no obligation, and totals skip it", () => {
  const result = computeObligations({ fyStart: 2026, introduced: { CATEGORY_IV: 80 } });
  assert.equal(row(result, "CATEGORY_IV").obligation_kg, null);
  assert.equal(result.totals.introduced_kg, 80);
  assert.equal(result.totals.obligation_kg, 0);
  assert.equal(result.totals.compensation_estimate, null);
});

test("the two-year basis averages the previous two years", () => {
  const byYear = {
    2026: { CATEGORY_I: 999 },
    2025: { CATEGORY_I: 300, UNCATEGORISED: 10 },
    2024: { CATEGORY_I: 100 },
  };
  assert.deepEqual(introducedForBasis("current", byYear, 2026), { CATEGORY_I: 999 });
  assert.deepEqual(introducedForBasis("previous_two_years", byYear, 2026), {
    CATEGORY_I: 200,
    UNCATEGORISED: 5,
  });
});
