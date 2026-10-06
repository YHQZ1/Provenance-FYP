import { supabaseAdmin } from "../../config/database.js";
import { env } from "../../config/env.js";
import { schema } from "../../config/schema.js";
import {
  buildClassificationText,
  normalizeMaterialCode,
  normalizeQuantity,
} from "./normalization.js";
import { listTradeNames } from "../internal/materials.service.js";
import { matchTradeName } from "../internal/trade-names.js";

const REVIEW_THRESHOLD = 0.85;

// Runs fn over items with at most `limit` in flight, keeping result order.
const mapWithConcurrency = async (items, limit, fn) => {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

export const ragService = {
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

      const classifications = await this.classifyWithTradeNames(documentId, items);

      // Suggestions are never auto-approved: a person confirms every line,
      // high-confidence ones in bulk. verified_by_user stays a human signal.
      const { classificationCategory } = await schema();
      const classificationInserts = classifications.map((classification) => ({
        ...(classificationCategory && { cpcb_category: classification.cpcb_category || null }),
        document_id: documentId,
        material_code: classification.material_code,
        quantity_kg: classification.quantity_kg,
        confidence_score: classification.confidence_score,
        reasoning: classification.reasoning,
        matched_synonym: classification.matched_synonym,
        vector_similarity: classification.vector_similarity,
        requires_human_review: classification.requires_human_review,
        verified_by_user: false,
      }));

      const { error: deleteError } = await supabaseAdmin
        .from("document_classifications")
        .delete()
        .eq("document_id", documentId);
      if (deleteError) throw new Error(`Classification reset failed: ${deleteError.message}`);

      const { error } = await supabaseAdmin
        .from("document_classifications")
        .insert(classificationInserts);

      if (error) {
        throw new Error(`Classification insert failed: ${error.message}`);
      }

      const failedCount = classifications.filter((c) => c.failed).length;
      const averageConfidence =
        classifications.reduce((sum, c) => sum + c.confidence_score, 0) /
        classifications.length;

      const { error: updateError } = await supabaseAdmin
        .from("documents")
        .update({
          rag_confidence: averageConfidence,
          status: failedCount === classifications.length ? "RAG_FAILED" : "CLASSIFIED",
          verified_by_user: false,
          requires_human_review: true,
          reasoning:
            failedCount > 0
              ? `${failedCount} of ${classifications.length} line(s) could not be classified automatically and need a material chosen manually.`
              : "Materials suggested for every line. Confirm them in review.",
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

  // Lines naming one of the company's own trade names are suggested from the Materials library;
  // the rest go to the classifier. Either way a person still approves every line.
  async classifyWithTradeNames(documentId, items) {
    const { data: document } = await supabaseAdmin
      .from("documents")
      .select("company_id")
      .eq("id", documentId)
      .maybeSingle();
    const tradeNames = document
      ? await listTradeNames(document.company_id).catch((error) => {
          console.error("[RAG] Trade names unavailable:", error.message);
          return [];
        })
      : [];

    const matches = items.map((item) => matchTradeName(item.description, tradeNames));
    const remaining = items.filter((_, index) => !matches[index]);
    const classified = env.USE_MOCK_SERVICES
      ? this.mockClassifyItems(remaining)
      : await this.classifyItems(remaining);

    let next = 0;
    return items.map((item, index) => {
      const match = matches[index];
      if (!match) return classified[next++];
      return {
        material_code: match.material_code,
        cpcb_category: match.cpcb_category || null,
        quantity_kg: normalizeQuantity(item),
        confidence_score: 0.95,
        reasoning: `Matches your trade name "${match.trade_name}" in the Materials library.`,
        matched_synonym: item.description,
        vector_similarity: null,
        requires_human_review: !match.cpcb_category,
      };
    });
  },

  async classifyItems(items) {
    return mapWithConcurrency(items, env.RAG_CONCURRENCY, async (item) => {
      try {
        const response = await requestRagService(buildClassificationText(item));
        const result = response.classifications?.[0];
        if (!result) throw new Error("RAG service returned no classification");

        const confidence = Number(result.confidence_score) || 0;
        const match = result.matched_synonyms?.[0];
        const materialCode = normalizeMaterialCode(result.material_code);
        const reasoning = [
          result.reasoning || "Classification returned by the RAG service.",
          match?.synonym
            ? `Closest catalogue match: "${match.synonym}" (${match.material_code}).`
            : null,
        ]
          .filter(Boolean)
          .join(" ");

        return {
          material_code: materialCode,
          cpcb_category: result.cpcb_category || null,
          quantity_kg: normalizeQuantity(item),
          confidence_score: confidence,
          reasoning,
          matched_synonym: item.description,
          vector_similarity: match?.similarity_score ?? null,
          requires_human_review:
            !materialCode ||
            !result.cpcb_category ||
            Boolean(result.requires_human_review) ||
            confidence < REVIEW_THRESHOLD,
        };
      } catch (error) {
        console.error("[RAG] Line classification failed:", error.message);
        return {
          material_code: null,
          cpcb_category: null,
          quantity_kg: normalizeQuantity(item),
          confidence_score: 0,
          reasoning: `Automatic classification failed (${error.message}). Choose the material manually.`,
          matched_synonym: item.description,
          vector_similarity: null,
          requires_human_review: true,
          failed: true,
        };
      }
    });
  },

  mockClassifyItems(items) {
    return items.map((item) => ({
      material_code: null,
      cpcb_category: null,
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
