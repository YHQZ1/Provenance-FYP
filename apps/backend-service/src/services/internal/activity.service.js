import { supabaseAdmin } from "../../config/database.js";
import { schema } from "../../config/schema.js";

// Every action the app records, grouped the way the Activity page filters them.
export const ACTIVITY_GROUPS = {
  documents: ["document.uploaded", "document.deleted", "document.retried", "document.redated"],
  review: ["line.approved", "line.corrected", "line.excluded", "lines.approved_in_bulk"],
  filing: ["filing.finalized", "filing.reopened", "obligations.updated"],
  settings: ["company.updated", "trade_name.added", "trade_name.removed"],
};

export const actorName = (actor) => actor?.name || actor?.email || null;

export const activityService = {
  // Recording is best-effort: a missing table or a failed insert must never fail the action
  // being recorded, so errors are logged and swallowed.
  async record(actor, { action, summary, documentId = null, financialYear = null, details = {} }) {
    try {
      if (!actor?.id || !(await schema()).activityLog) return;
      const { error } = await supabaseAdmin.from("activity_events").insert({
        company_id: actor.id,
        actor_id: actor.id,
        actor_name: actorName(actor),
        action,
        summary,
        document_id: documentId,
        financial_year: financialYear,
        details,
      });
      if (error) throw error;
    } catch (error) {
      console.error(`[Activity] Could not record ${action}:`, error.message);
    }
  },

  async list(userId, { fy, group, before, limit = 50 } = {}) {
    if (!(await schema()).activityLog) return { available: false, data: [], next_before: null };

    let query = supabaseAdmin
      .from("activity_events")
      .select("id, actor_name, action, summary, document_id, financial_year, details, created_at")
      .eq("company_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    // Company-wide events (profile, trade names) have no year and show under every year.
    if (fy != null) query = query.or(`financial_year.eq.${fy},financial_year.is.null`);
    if (group && ACTIVITY_GROUPS[group]) query = query.in("action", ACTIVITY_GROUPS[group]);
    if (before) query = query.lt("created_at", before);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to read activity: ${error.message}`);

    const page = (data || []).slice(0, limit);
    return {
      available: true,
      data: page,
      next_before: data.length > limit ? page[page.length - 1].created_at : null,
    };
  },
};
