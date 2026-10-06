import { supabaseAdmin } from "../../config/database.js";
import { schema } from "../../config/schema.js";
import { documentTypeOf } from "../external/normalization.js";
import { badRequest, notFound, unprocessable } from "../../utils/errors.js";
import { financialYearOf, financialYearRange } from "../external/normalization.js";
import { PROCESSING_STATUSES, effectiveDate } from "./filing.summary.js";
import { assertDocumentEditable, finalizedYears } from "./filing.lock.js";
import { activityService } from "./activity.service.js";

export const MATERIAL_CODES = ["PET", "HDPE", "PVC", "LDPE", "PP", "PS", "MLP"];
export const CPCB_CATEGORIES = [
  "CATEGORY_I",
  "CATEGORY_II",
  "CATEGORY_III",
  "CATEGORY_IV",
  "BIODEGRADABLE",
];

const now = () => new Date().toISOString();

// Who made the decision, kept with the line for the audit trail.
const reviewStamp = async (reviewer) => {
  if (!(await schema()).reviewerIdentity) return {};
  return {
    reviewed_by: reviewer.id,
    reviewed_by_name: reviewer.name || reviewer.email || null,
    reviewed_at: now(),
  };
};

const fetchOwned = async (classificationId, userId, { forWrite = true } = {}) => {
  const { data } = await supabaseAdmin
    .from("document_classifications")
    .select("*, documents!inner(id, filename, company_id, status, created_at, extracted_data)")
    .eq("id", classificationId)
    .eq("documents.company_id", userId)
    .maybeSingle();

  if (!data) throw notFound("Review item not found");
  if (forWrite) await assertDocumentEditable(userId, data.documents);
  return data;
};

// One audit entry per decision, tied to the document and the year it counts toward.
const recordDecision = (reviewer, item, action, summary, details = {}) =>
  activityService.record(reviewer, {
    action,
    summary: `${summary} on ${item.documents.filename}`,
    documentId: item.document_id,
    financialYear: financialYearOf(effectiveDate(item.documents)),
    details: { filename: item.documents.filename, line: item.matched_synonym, ...details },
  });

const effectiveValues = (item) => ({
  material_code: item.corrected_material_code || item.material_code,
  quantity_kg: item.corrected_quantity_kg ?? item.quantity_kg,
});

export const feedbackService = {
  async getReviewQueue(userId, options = {}) {
    const { documentId } = options;
    const { classificationCategory } = await schema();

    let query = supabaseAdmin
      .from("document_classifications")
      .select(
        `id, document_id, material_code, quantity_kg, confidence_score, reasoning, matched_synonym, requires_human_review, created_at, ${classificationCategory ? "cpcb_category, " : ""}documents!inner(id, filename, company_id, status, created_at, extracted_data)`,
      )
      .eq("documents.company_id", userId)
      .eq("verified_by_user", false)
      .order("created_at", { ascending: true })
      .limit(500);

    if (documentId) query = query.eq("document_id", documentId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch review items: ${error.message}`);

    const ready = (data || []).filter(
      (item) => !PROCESSING_STATUSES.includes(item.documents?.status),
    );

    // Lines from a finalized year stay visible but can't be decided until that year is reopened.
    const finalized = await finalizedYears(userId);
    const lockedYear = (document) => {
      const fy = financialYearOf(effectiveDate(document));
      return finalized.has(fy) ? fy : null;
    };

    const codes = [...new Set(ready.map((i) => i.material_code).filter(Boolean))];
    const names = {};
    if (codes.length) {
      const { data: materials } = await supabaseAdmin
        .from("materials_master")
        .select("material_code, material_name")
        .in("material_code", codes);
      for (const m of materials || []) names[m.material_code] = m.material_name;
    }

    const items = ready.map((item) => {
      const locked = lockedYear(item.documents);
      return {
      financial_year: financialYearOf(effectiveDate(item.documents)),
      id: item.id,
      document_id: item.document_id,
      document_filename: item.documents?.filename,
      document_type: documentTypeOf(item.documents?.extracted_data),
      line_description: item.matched_synonym,
      material_code: item.material_code,
      material_name: names[item.material_code] || null,
      cpcb_category: item.cpcb_category || null,
      quantity_kg: item.quantity_kg,
      confidence_score: item.confidence_score,
      reasoning: item.reasoning,
      locked_financial_year: locked == null ? null : financialYearRange(locked).label,
      locked_financial_year_start: locked,
      suggested:
        locked == null &&
        !item.requires_human_review &&
        Boolean(item.material_code) &&
        item.quantity_kg != null,
      created_at: item.created_at,
      };
    });

    return {
      data: items,
      summary: {
        total: items.length,
        suggested: items.filter((i) => i.suggested).length,
        needs_attention: items.filter((i) => !i.suggested && !i.locked_financial_year).length,
        locked: items.filter((i) => i.locked_financial_year).length,
      },
    };
  },

  async approve(classificationId, reviewer, notes = "", { record = true } = {}) {
    const item = await fetchOwned(classificationId, reviewer.id);
    const values = effectiveValues(item);

    if (!values.material_code) {
      throw unprocessable("Choose a material before approving, or exclude this line.");
    }
    if (values.quantity_kg == null) {
      throw unprocessable("Enter the weight in kg before approving, or exclude this line.");
    }

    const { data, error } = await supabaseAdmin
      .from("document_classifications")
      .update({
        verified_by_user: true,
        requires_human_review: false,
        reviewer_notes: notes || null,
        ...(await reviewStamp(reviewer)),
        updated_at: now(),
      })
      .eq("id", classificationId)
      .select()
      .single();

    if (error) throw new Error(`Approval failed: ${error.message}`);
    await this.updateDocumentReviewStatus(item.document_id);
    if (record) {
      await recordDecision(reviewer, item, "line.approved", `approved ${values.material_code}`, {
        material_code: values.material_code,
        quantity_kg: values.quantity_kg,
      });
    }
    return data;
  },

  async correct(classificationId, reviewer, correction) {
    const userId = reviewer.id;
    const { material_code, quantity_kg, cpcb_category, notes } = correction;

    if (cpcb_category != null && !CPCB_CATEGORIES.includes(cpcb_category)) {
      throw badRequest(`Category must be one of ${CPCB_CATEGORIES.join(", ")}`);
    }
    if (!MATERIAL_CODES.includes(material_code)) {
      throw badRequest(`Material must be one of ${MATERIAL_CODES.join(", ")}`);
    }
    const quantity = Number(quantity_kg);
    if (quantity_kg === null || quantity_kg === "" || !Number.isFinite(quantity) || quantity <= 0) {
      throw badRequest("Weight must be a positive number of kilograms");
    }

    const original = await fetchOwned(classificationId, userId);
    const { classificationCategory } = await schema();

    const { data, error } = await supabaseAdmin
      .from("document_classifications")
      .update({
        ...(classificationCategory &&
          cpcb_category !== undefined && { corrected_cpcb_category: cpcb_category }),
        corrected_material_code: material_code,
        corrected_quantity_kg: quantity,
        verified_by_user: true,
        requires_human_review: false,
        reviewer_notes: notes || null,
        ...(await reviewStamp(reviewer)),
        updated_at: now(),
      })
      .eq("id", classificationId)
      .select()
      .single();

    if (error) throw new Error(`Correction failed: ${error.message}`);

    const changed =
      material_code !== original.material_code || quantity !== original.quantity_kg;
    if (changed) {
      await supabaseAdmin.from("classification_feedback").insert({
        classification_id: classificationId,
        original_material_code: original.material_code,
        original_quantity_kg: original.quantity_kg,
        corrected_material_code: material_code,
        corrected_quantity_kg: quantity,
        user_id: userId,
        feedback_type: "HUMAN_REVIEW",
        notes: notes || null,
        processed: false,
      });
    }

    await this.updateDocumentReviewStatus(original.document_id);
    await recordDecision(
      reviewer,
      original,
      "line.corrected",
      changed
        ? `corrected ${original.material_code || "a line"} to ${material_code}`
        : `confirmed ${material_code}`,
      {
        from: { material_code: original.material_code, quantity_kg: original.quantity_kg },
        to: { material_code, quantity_kg: quantity, cpcb_category: cpcb_category ?? null },
      },
    );
    return data;
  },

  // Excluded lines are reviewed but carry no material, so they never reach filing totals.
  async exclude(classificationId, reviewer, reason = "") {
    const item = await fetchOwned(classificationId, reviewer.id);

    const { data, error } = await supabaseAdmin
      .from("document_classifications")
      .update({
        material_code: null,
        corrected_material_code: null,
        verified_by_user: true,
        requires_human_review: false,
        reviewer_notes: `Excluded: ${reason || "not plastic packaging"}`,
        ...(await reviewStamp(reviewer)),
        updated_at: now(),
      })
      .eq("id", classificationId)
      .select()
      .single();

    if (error) throw new Error(`Exclude failed: ${error.message}`);
    await this.updateDocumentReviewStatus(item.document_id);
    await recordDecision(reviewer, item, "line.excluded", "excluded a line", {
      reason: reason || "not plastic packaging",
    });
    return data;
  },

  async approveSuggested(reviewer, documentId) {
    const { data: queue } = await this.getReviewQueue(reviewer.id, { documentId });
    const suggested = queue.filter((item) => item.suggested);
    const results = [];

    for (const item of suggested) {
      try {
        await this.approve(item.id, reviewer, "Confirmed suggested classification", {
          record: false,
        });
        results.push({ id: item.id, success: true });
      } catch (error) {
        results.push({ id: item.id, success: false, error: error.message });
      }
    }

    const approved = suggested.filter((_, index) => results[index].success);
    if (approved.length) {
      const files = [...new Set(approved.map((item) => item.document_filename))];
      await activityService.record(reviewer, {
        action: "lines.approved_in_bulk",
        summary: `approved ${approved.length} suggested line${approved.length === 1 ? "" : "s"} on ${
          files.length === 1 ? files[0] : `${files.length} documents`
        }`,
        documentId: documentId || (files.length === 1 ? approved[0].document_id : null),
        financialYear:
          new Set(approved.map((item) => item.financial_year)).size === 1
            ? approved[0].financial_year
            : null,
        details: {
          count: approved.length,
          files,
          quantity_kg: approved.reduce((sum, item) => sum + Number(item.quantity_kg || 0), 0),
        },
      });
    }

    return {
      approved: approved.length,
      failed: results.filter((r) => !r.success),
    };
  },

  async getClassification(classificationId, userId) {
    return fetchOwned(classificationId, userId, { forWrite: false });
  },

  async updateDocumentReviewStatus(documentId) {
    const { data: classifications } = await supabaseAdmin
      .from("document_classifications")
      .select("verified_by_user")
      .eq("document_id", documentId);

    if (!classifications || classifications.length === 0) return;

    const total = classifications.length;
    const verified = classifications.filter((c) => c.verified_by_user).length;

    await supabaseAdmin
      .from("documents")
      .update({
        status: verified === total ? "VERIFIED" : "REVIEW_PENDING",
        verified_by_user: verified === total,
        requires_human_review: verified !== total,
        reasoning:
          verified === total
            ? "All lines reviewed."
            : `${total - verified} of ${total} line(s) still need review.`,
        updated_at: now(),
      })
      .eq("id", documentId);
  },
};
