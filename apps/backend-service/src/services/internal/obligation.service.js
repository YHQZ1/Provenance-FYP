import { supabaseAdmin } from "../../config/database.js";
import { schema } from "../../config/schema.js";
import { financialYearOf, financialYearRange } from "../external/normalization.js";
import { badRequest, unavailable } from "../../utils/errors.js";
import { activityService, actorName } from "./activity.service.js";
import { documentService } from "./document.service.js";
import { assertYearOpen } from "./filing.lock.js";
import { summarizeFiling } from "./filing.summary.js";
import {
  OBLIGATION_CATEGORIES,
  TARGET_SOURCE,
  computeObligations,
  introducedForBasis,
} from "./obligation.calc.js";
import { workspaceCache } from "./workspace.cache.js";

const OBLIGATIONS_CACHE_SECONDS = 600;

const BASES = ["current", "previous_two_years"];
const INPUT_FIELDS = [
  "pre_consumer_kg",
  "supplied_kg",
  "epr_target_pct",
  "recycling_min_pct",
  "ec_rate_per_kg",
];

// Finalized years contribute their signed-off numbers; open years their live ones.
const ledgerByYear = async (userId, years) => {
  const [{ data: company }, documents, capabilities] = await Promise.all([
    supabaseAdmin.from("companies").select("*").eq("id", userId).maybeSingle(),
    documentService.listAllWithClassifications(userId),
    schema(),
  ]);

  const snapshots = {};
  if (capabilities.fyFilings) {
    const { data } = await supabaseAdmin
      .from("fy_filings")
      .select("financial_year, snapshot")
      .eq("company_id", userId)
      .in("financial_year", years);
    for (const row of data || []) snapshots[row.financial_year] = row.snapshot;
  }

  const ledgers = {};
  for (const year of years) {
    const totals =
      snapshots[year]?.totals ||
      summarizeFiling({
        documents,
        company,
        fyStart: year,
        currentFy: financialYearOf(new Date()),
        categoriesTracked: capabilities.classificationCategory,
      }).totals;
    ledgers[year] = {
      introduced: totals.introduced.by_category || {},
      recycled: totals.recycled.by_category || {},
      finalized: Boolean(snapshots[year]),
    };
  }
  return { ledgers, categoriesTracked: capabilities.classificationCategory };
};

const readInputs = async (userId, fyStart) => {
  const { data, error } = await supabaseAdmin
    .from("epr_obligation_inputs")
    .select("*")
    .eq("company_id", userId)
    .eq("financial_year", fyStart);
  if (error) throw new Error(`Failed to read obligation inputs: ${error.message}`);
  return Object.fromEntries((data || []).map((row) => [row.category, row]));
};

const parseInput = (field, value) => {
  if (value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw badRequest(`${field} must be a number of 0 or more`);
  }
  if (field.endsWith("_pct") && number > 100) throw badRequest(`${field} can't be more than 100`);
  return number;
};

export const obligationService = {
  async get(userId, fyStart, basis = "current") {
    if (!BASES.includes(basis)) throw badRequest(`basis must be one of ${BASES.join(", ")}`);
    return workspaceCache.wrap(userId, ["obligations", fyStart, basis], OBLIGATIONS_CACHE_SECONDS, () =>
      this.compute(userId, fyStart, basis),
    );
  },

  async compute(userId, fyStart, basis) {
    const { obligations: available } = await schema();
    const years = [fyStart, fyStart - 1, fyStart - 2];
    const [{ ledgers, categoriesTracked }, inputs] = await Promise.all([
      ledgerByYear(userId, years),
      available ? readInputs(userId, fyStart) : {},
    ]);

    const introducedByYear = Object.fromEntries(
      years.map((year) => [year, ledgers[year].introduced]),
    );
    const introduced = introducedForBasis(basis, introducedByYear, fyStart);
    const { rows, totals } = computeObligations({
      fyStart,
      introduced,
      recycled: ledgers[fyStart].recycled,
      inputs,
    });

    return {
      financial_year: financialYearRange(fyStart),
      basis,
      basis_years:
        basis === "current"
          ? [financialYearRange(fyStart).label]
          : [fyStart - 2, fyStart - 1].map((year) => financialYearRange(year).label),
      available,
      locked: ledgers[fyStart].finalized,
      categories_tracked: categoriesTracked,
      uncategorised_introduced_kg: introduced.UNCATEGORISED || 0,
      target_source: TARGET_SOURCE,
      rows,
      totals,
    };
  },

  async update(actor, fyStart, category, values = {}) {
    if (!(await schema()).obligations) {
      throw unavailable(
        "Saving obligation inputs needs supabase/migrations/007_activity_obligations_trade_names.sql.",
      );
    }
    if (!OBLIGATION_CATEGORIES.includes(category)) {
      throw badRequest(`category must be one of ${OBLIGATION_CATEGORIES.join(", ")}`);
    }
    await assertYearOpen(actor.id, fyStart);

    const changes = {};
    for (const field of INPUT_FIELDS) {
      if (values[field] !== undefined) changes[field] = parseInput(field, values[field]);
    }
    if (Object.keys(changes).length === 0) throw badRequest("Nothing to update");

    const { error } = await supabaseAdmin.from("epr_obligation_inputs").upsert(
      {
        company_id: actor.id,
        financial_year: fyStart,
        category,
        ...changes,
        updated_by_name: actorName(actor),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,financial_year,category" },
    );
    if (error) throw new Error(`Failed to save obligation inputs: ${error.message}`);
    await workspaceCache.invalidate(actor.id);

    const label = category.replace("CATEGORY_", "Category ");
    await activityService.record(actor, {
      action: "obligations.updated",
      summary: `updated ${label} obligation inputs for ${financialYearRange(fyStart).label}`,
      financialYear: fyStart,
      details: { category, ...changes },
    });

    return this.get(actor.id, fyStart);
  },
};
