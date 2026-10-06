// EPR obligation arithmetic, kept free of I/O so it can be unit-tested.
//
// Per CPCB category, following the Guidelines on EPR for Plastic Packaging (2022):
//   Q (EPR quantity)        = A + B − C
//     A = plastic packaging introduced (reviewed purchase invoices)
//     B = pre-consumer plastic packaging waste
//     C = quantity supplied to other registered or exempted entities
//   EPR obligation          = Q × EPR target %
//   recycling minimum       = EPR obligation × minimum recycling %
//   shortfall               = EPR obligation − recycled (reviewed recycling certificates)
//   compensation estimate   = shortfall × rate per kg (only when the company sets a rate)

export const OBLIGATION_CATEGORIES = ["CATEGORY_I", "CATEGORY_II", "CATEGORY_III", "CATEGORY_IV"];

export const TARGET_SOURCE =
  "Guidelines on Extended Producer Responsibility for Plastic Packaging, 2022 (Schedule II)";

// Defaults from the 2022 guidelines. Companies can override any of them per year, and should
// check them against the current notification: the rules have been amended before.
const EPR_TARGET_BY_YEAR = { 2021: 25, 2022: 70 }; // 100% from FY 2023-24
const RECYCLING_MIN_BY_YEAR = {
  CATEGORY_I: { 2024: 50, 2025: 60, 2026: 70, 2027: 80 },
  CATEGORY_II: { 2024: 30, 2025: 40, 2026: 50, 2027: 60 },
  CATEGORY_III: { 2024: 30, 2025: 40, 2026: 50, 2027: 60 },
};

// The schedules end at a final value that applies to every later year.
const fromSchedule = (schedule, fyStart) => {
  const years = Object.keys(schedule).map(Number).sort((a, b) => a - b);
  if (fyStart < years[0]) return null;
  const applicable = years.filter((year) => year <= fyStart).pop();
  return schedule[applicable];
};

export const defaultTargets = (category, fyStart) => {
  // Compostable packaging (Category IV) follows a different regime; no default is assumed.
  if (category === "CATEGORY_IV") return { epr_target_pct: null, recycling_min_pct: null };
  const eprTarget = fyStart >= 2023 ? 100 : (EPR_TARGET_BY_YEAR[fyStart] ?? null);
  const recyclingMin =
    fyStart >= 2024 ? fromSchedule(RECYCLING_MIN_BY_YEAR[category], fyStart) : null;
  return { epr_target_pct: eprTarget, recycling_min_pct: recyclingMin };
};

const round = (value) => (value == null ? null : Number(Number(value).toFixed(3)));
const num = (value) => (value == null || value === "" ? null : Number(value));

/**
 * @param introduced  kg introduced per category for the basis period (A)
 * @param recycled    kg on reviewed recycling certificates per category this year
 * @param inputs      saved inputs per category: pre_consumer_kg, supplied_kg, epr_target_pct,
 *                    recycling_min_pct, ec_rate_per_kg (any may be null)
 */
export const computeObligations = ({ fyStart, introduced = {}, recycled = {}, inputs = {} }) => {
  const rows = OBLIGATION_CATEGORIES.map((category) => {
    const saved = inputs[category] || {};
    const defaults = defaultTargets(category, fyStart);

    const a = round(introduced[category] || 0);
    const b = round(num(saved.pre_consumer_kg) ?? 0);
    const c = round(num(saved.supplied_kg) ?? 0);
    const q = round(Math.max(0, a + b - c));

    const eprTarget = num(saved.epr_target_pct) ?? defaults.epr_target_pct;
    const recyclingMin = num(saved.recycling_min_pct) ?? defaults.recycling_min_pct;
    const rate = num(saved.ec_rate_per_kg);

    const obligation = eprTarget == null ? null : round((q * eprTarget) / 100);
    const recyclingMinKg =
      obligation == null || recyclingMin == null ? null : round((obligation * recyclingMin) / 100);
    const recycledKg = round(recycled[category] || 0);
    const shortfall = obligation == null ? null : round(Math.max(0, obligation - recycledKg));
    const recyclingGap =
      recyclingMinKg == null ? null : round(Math.max(0, recyclingMinKg - recycledKg));

    return {
      category,
      introduced_kg: a,
      pre_consumer_kg: b,
      supplied_kg: c,
      epr_quantity_kg: q,
      epr_target_pct: eprTarget,
      epr_target_source: num(saved.epr_target_pct) != null ? "company" : eprTarget == null ? "none" : "default",
      recycling_min_pct: recyclingMin,
      recycling_min_source:
        num(saved.recycling_min_pct) != null ? "company" : recyclingMin == null ? "none" : "default",
      obligation_kg: obligation,
      recycling_min_kg: recyclingMinKg,
      recycled_kg: recycledKg,
      shortfall_kg: shortfall,
      recycling_gap_kg: recyclingGap,
      ec_rate_per_kg: rate,
      compensation_estimate: rate == null || shortfall == null ? null : round(shortfall * rate),
      updated_by_name: saved.updated_by_name || null,
      updated_at: saved.updated_at || null,
    };
  });

  const sum = (key) =>
    rows.some((row) => row[key] != null)
      ? round(rows.reduce((total, row) => total + (row[key] || 0), 0))
      : null;

  return {
    rows,
    totals: {
      introduced_kg: sum("introduced_kg"),
      epr_quantity_kg: sum("epr_quantity_kg"),
      obligation_kg: sum("obligation_kg"),
      recycled_kg: sum("recycled_kg"),
      shortfall_kg: sum("shortfall_kg"),
      compensation_estimate: sum("compensation_estimate"),
    },
  };
};

// The basis for A: this year's purchases, or the average of the two years before it, which is
// how the guidelines define it for an annual obligation.
export const introducedForBasis = (basis, byYear, fyStart) => {
  if (basis !== "previous_two_years") return byYear[fyStart] || {};
  const years = [fyStart - 1, fyStart - 2];
  const average = {};
  for (const category of [...OBLIGATION_CATEGORIES, "UNCATEGORISED"]) {
    const total = years.reduce((sum, year) => sum + (byYear[year]?.[category] || 0), 0);
    if (total) average[category] = round(total / 2);
  }
  return average;
};
