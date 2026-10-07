import { supabaseAdmin } from "../../config/database.js";
import { schema } from "../../config/schema.js";
import { badRequest, conflict, notFound, unavailable } from "../../utils/errors.js";
import { activityService, actorName } from "./activity.service.js";
import { CPCB_CATEGORIES, MATERIAL_CODES } from "./feedback.service.js";
import { suggestTradeNames } from "./trade-names.js";
import { cache } from "../../config/redis.js";

// Polymers and built-in trade names change only when the seed is re-run.
const CATALOGUE_CACHE_SECONDS = 3600;

const readCatalogue = () =>
  cache.wrap(cache.key("catalogue", "v1"), CATALOGUE_CACHE_SECONDS, async () => {
    const [materials, builtIn] = await Promise.all([
      supabaseAdmin.from("materials_master").select("material_code, material_name, category, description"),
      supabaseAdmin
        .from("material_synonyms")
        .select("id, material_code, synonym, manufacturer, description")
        .order("material_code"),
    ]);
    if (materials.error) throw new Error(`Failed to read materials: ${materials.error.message}`);
    if (builtIn.error) throw new Error(`Failed to read the catalogue: ${builtIn.error.message}`);
    return { materials: materials.data || [], catalogue: builtIn.data || [] };
  });

const MIGRATION_HINT =
  "Trade names need supabase/migrations/007_activity_obligations_trade_names.sql.";

export const listTradeNames = async (userId) => {
  if (!(await schema()).tradeNames) return [];
  const { data, error } = await supabaseAdmin
    .from("company_trade_names")
    .select("id, trade_name, material_code, cpcb_category, notes, created_by_name, created_at")
    .eq("company_id", userId)
    .order("trade_name");
  if (error) throw new Error(`Failed to read trade names: ${error.message}`);
  return data || [];
};

// Corrections this company made in review, as raw material for trade-name suggestions.
const readCorrections = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from("classification_feedback")
    .select("corrected_material_code, created_at, document_classifications(matched_synonym, corrected_cpcb_category)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Failed to read corrections: ${error.message}`);
  return (data || []).map((row) => ({
    line: row.document_classifications?.matched_synonym,
    material_code: row.corrected_material_code,
    cpcb_category: row.document_classifications?.corrected_cpcb_category || null,
    created_at: row.created_at,
  }));
};

export const materialsService = {
  async library(userId) {
    const { tradeNames: available } = await schema();
    const [{ materials, catalogue }, tradeNames, corrections] = await Promise.all([
      readCatalogue(),
      listTradeNames(userId),
      readCorrections(userId),
    ]);

    return {
      available,
      materials,
      catalogue,
      trade_names: tradeNames,
      suggestions: suggestTradeNames(corrections, tradeNames),
    };
  },

  async addTradeName(actor, { trade_name, material_code, cpcb_category, notes } = {}) {
    if (!(await schema()).tradeNames) throw unavailable(MIGRATION_HINT);
    const name = String(trade_name || "").trim();
    if (name.length < 2 || name.length > 120) {
      throw badRequest("Trade name must be between 2 and 120 characters");
    }
    if (!MATERIAL_CODES.includes(material_code)) {
      throw badRequest(`Material must be one of ${MATERIAL_CODES.join(", ")}`);
    }
    if (cpcb_category != null && cpcb_category !== "" && !CPCB_CATEGORIES.includes(cpcb_category)) {
      throw badRequest(`Category must be one of ${CPCB_CATEGORIES.join(", ")}`);
    }

    const { data, error } = await supabaseAdmin
      .from("company_trade_names")
      .insert({
        company_id: actor.id,
        trade_name: name,
        material_code,
        cpcb_category: cpcb_category || null,
        notes: notes?.trim() || null,
        created_by_name: actorName(actor),
      })
      .select()
      .single();
    if (error?.code === "23505") throw conflict(`"${name}" is already in your trade names.`);
    if (error) throw new Error(`Failed to save trade name: ${error.message}`);

    await activityService.record(actor, {
      action: "trade_name.added",
      summary: `added trade name "${name}" as ${material_code}`,
      details: { trade_name: name, material_code, cpcb_category: cpcb_category || null },
    });
    return data;
  },

  async removeTradeName(actor, id) {
    if (!(await schema()).tradeNames) throw unavailable(MIGRATION_HINT);
    const { data, error } = await supabaseAdmin
      .from("company_trade_names")
      .delete()
      .eq("id", id)
      .eq("company_id", actor.id)
      .select()
      .maybeSingle();
    if (error) throw new Error(`Failed to remove trade name: ${error.message}`);
    if (!data) throw notFound("Trade name not found");

    await activityService.record(actor, {
      action: "trade_name.removed",
      summary: `removed trade name "${data.trade_name}"`,
      details: { trade_name: data.trade_name, material_code: data.material_code },
    });
    return data;
  },
};
