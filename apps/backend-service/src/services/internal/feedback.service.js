import { supabaseAdmin } from "../../config/database.js";

export const feedbackService = {
  async getPendingReview(userId, options = {}) {
    const { page = 1, limit = 20, documentId } = options;

    let query = supabaseAdmin
      .from("document_classifications")
      .select(
        `id, document_id, material_code, quantity_kg, confidence_score, reasoning, matched_synonym, created_at, documents!inner(id, filename, company_id)`,
        { count: "exact" },
      )
      .eq("documents.company_id", userId)
      .eq("verified_by_user", false)
      .order("created_at", { ascending: false });

    if (documentId) query = query.eq("document_id", documentId);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);

    if (error)
      throw new Error(`Failed to fetch pending reviews: ${error.message}`);

    const enhancedData = [];

    if (data && data.length > 0) {
      for (const item of data) {
        let materialName = null;

        if (item.material_code) {
          const { data: materialData } = await supabaseAdmin
            .from("materials_master")
            .select("material_name, category")
            .eq("material_code", item.material_code)
            .single();

          if (materialData) materialName = materialData.material_name;
        }

        enhancedData.push({
          id: item.id,
          document_id: item.document_id,
          document_filename: item.documents?.filename,
          material_code: item.material_code,
          material_name: materialName,
          quantity_kg: item.quantity_kg,
          confidence_score: item.confidence_score,
          reasoning: item.reasoning,
          matched_synonym: item.matched_synonym,
          created_at: item.created_at,
        });
      }
    }

    return {
      data: enhancedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  },

  async verifyClassification(classificationId, userId, notes = "") {
    const { data: classification, error: fetchError } = await supabaseAdmin
      .from("document_classifications")
      .select("*, documents!inner(company_id)")
      .eq("id", classificationId)
      .eq("documents.company_id", userId)
      .single();

    if (fetchError || !classification) throw new Error("Access denied");

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("document_classifications")
      .update({
        verified_by_user: true,
        requires_human_review: false,
        reviewer_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", classificationId)
      .select()
      .single();

    if (updateError)
      throw new Error(`Verification failed: ${updateError.message}`);

    await this.updateDocumentReviewStatus(classification.document_id);
    return updated;
  },

  async correctClassification(classificationId, userId, correction) {
    const {
      corrected_material_code,
      corrected_quantity_kg,
      feedback_type,
      notes,
    } = correction;

    const { data: original, error: fetchError } = await supabaseAdmin
      .from("document_classifications")
      .select("*, documents!inner(company_id)")
      .eq("id", classificationId)
      .eq("documents.company_id", userId)
      .single();

    if (fetchError || !original) throw new Error("Access denied");

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("document_classifications")
      .update({
        corrected_material_code:
          corrected_material_code || original.material_code,
        corrected_quantity_kg: corrected_quantity_kg || original.quantity_kg,
        verified_by_user: true,
        requires_human_review: false,
        reviewer_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", classificationId)
      .select()
      .single();

    if (updateError)
      throw new Error(`Correction failed: ${updateError.message}`);

    await supabaseAdmin.from("classification_feedback").insert({
      classification_id: classificationId,
      original_material_code: original.material_code,
      original_quantity_kg: original.quantity_kg,
      corrected_material_code:
        corrected_material_code || original.material_code,
      corrected_quantity_kg: corrected_quantity_kg || original.quantity_kg,
      user_id: userId,
      feedback_type,
      notes,
      processed: false,
    });

    await this.updateDocumentReviewStatus(original.document_id);
    return updated;
  },

  async getClassification(classificationId, userId) {
    const { data, error } = await supabaseAdmin
      .from("document_classifications")
      .select(`*, documents!inner(id, filename, company_id)`)
      .eq("id", classificationId)
      .eq("documents.company_id", userId)
      .single();

    if (error || !data) throw new Error("Not found");

    let materialData = null;
    if (data.material_code) {
      const { data: material } = await supabaseAdmin
        .from("materials_master")
        .select("material_name, category")
        .eq("material_code", data.material_code)
        .single();
      materialData = material;
    }

    return { ...data, materials_master: materialData };
  },

  async bulkVerify(classificationIds, userId) {
    const results = [];
    for (const id of classificationIds) {
      try {
        await this.verifyClassification(id, userId, "Bulk verified");
        results.push({ id, success: true });
      } catch (e) {
        results.push({ id, success: false, error: e.message });
      }
    }
    return results;
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);
  },
};
