import { supabaseAdmin } from "../../config/database.js";
import { env } from "../../config/env.js";
import {
  buildClassificationText,
  normalizeMaterialCode,
  normalizeQuantity,
} from "./normalization.js";

const REVIEW_THRESHOLD = 0.85;

export const ragService = {
  async submitForClassification(documentId, items, companyId) {
    const jobId = `rag-${documentId}-${Date.now()}`;

    void this.processDocument(documentId, items, companyId).catch((error) => {
      console.error(`[RAG] Failed for document ${documentId}:`, error);
    });

    return { jobId, status: "SUBMITTED" };
  },

  async processDocument(documentId, items) {
    await supabaseAdmin
      .from("documents")
      .update({
        status: "RAG_PROCESSING",
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    try {
      if (!items || items.length === 0) {
        const { error: emptyDocumentError } = await supabaseAdmin
          .from("documents")
          .update({
            status: "REVIEW_PENDING",
            rag_confidence: 0,
            requires_human_review: true,
            verified_by_user: false,
            reasoning: "No line items were available for material classification.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentId);

        if (emptyDocumentError) throw emptyDocumentError;
        return [];
      }

      const classifications = env.USE_MOCK_SERVICES
        ? this.mockClassifyItems(items)
        : await this.classifyItems(items);

      await supabaseAdmin
        .from("document_classifications")
        .delete()
        .eq("document_id", documentId);

      const requiresHumanReview = classifications.some(
        (classification) => classification.requires_human_review,
      );

      const classificationInserts = classifications.map((classification) => ({
        document_id: documentId,
        material_code: classification.material_code,
        quantity_kg: classification.quantity_kg,
        confidence_score: classification.confidence_score,
        reasoning: classification.reasoning,
        matched_synonym: classification.matched_synonym,
        vector_similarity: classification.vector_similarity,
        requires_human_review: classification.requires_human_review,
        verified_by_user: !classification.requires_human_review,
      }));

      if (classificationInserts.length > 0) {
        const { error } = await supabaseAdmin
          .from("document_classifications")
          .insert(classificationInserts);

        if (error) {
          throw new Error(`Classification insert failed: ${error.message}`);
        }
      }

      const averageConfidence = classifications.length
        ? classifications.reduce(
            (sum, classification) => sum + classification.confidence_score,
            0,
          ) / classifications.length
        : 1;

      const status = classifications.length === 0
        ? "COMPLETED"
        : requiresHumanReview
          ? "CLASSIFIED"
          : "VERIFIED";

      const { error: updateError } = await supabaseAdmin
        .from("documents")
        .update({
          rag_confidence: averageConfidence,
          status,
          verified_by_user: !requiresHumanReview,
          requires_human_review: requiresHumanReview,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      if (updateError) {
        throw new Error(`Document classification update failed: ${updateError.message}`);
      }

      console.log(
        `[RAG] Document ${documentId} classified successfully with ${classifications.length} items`,
      );

      return classifications;
    } catch (error) {
      console.error(`[RAG] Failed for document ${documentId}:`, error);
      await supabaseAdmin
        .from("documents")
        .update({
          status: "RAG_FAILED",
          reasoning: error.message,
          requires_human_review: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);
      throw error;
    }
  },

  async classifyItems(items) {
    const classifications = [];

    for (const item of items) {
      const response = await requestRagService(buildClassificationText(item));
      const result = response.classifications?.[0];

      if (!result) {
        throw new Error("RAG service returned no classification");
      }

      const confidence = Number(result.confidence_score) || 0;
      const matchedSynonym = result.matched_synonyms?.[0];

      classifications.push({
        material_code: normalizeMaterialCode(result.material_code),
        quantity_kg: normalizeQuantity(item),
        confidence_score: confidence,
        reasoning: result.reasoning || "Classification returned by the RAG service.",
        matched_synonym: matchedSynonym?.synonym || item.description,
        vector_similarity: matchedSynonym?.similarity_score ?? null,
        requires_human_review:
          Boolean(result.requires_human_review) || confidence < REVIEW_THRESHOLD,
      });
    }

    return classifications;
  },

  mockClassifyItems(items) {
    return items.map((item) => ({
      material_code: "UNKNOWN",
      quantity_kg: normalizeQuantity(item),
      confidence_score: 0,
      reasoning: "Mock classification result.",
      matched_synonym: item.description,
      vector_similarity: null,
      requires_human_review: true,
    }));
  },
};

const requestRagService = async (text) => {
  if (!env.RAG_SERVICE_URL) {
    throw new Error("RAG_SERVICE_URL is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.RAG_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${env.RAG_SERVICE_URL.replace(/\/$/, "")}/classify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      },
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = typeof payload.detail === "string"
        ? payload.detail
        : payload.detail?.error || payload.message || "request failed";
      throw new Error(`RAG service returned ${response.status}: ${detail}`);
    }

    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`RAG service timed out after ${env.RAG_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
