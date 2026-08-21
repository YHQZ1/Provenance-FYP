import { supabaseAdmin } from "../../config/database.js";

const MATERIAL_KEYWORDS = {
  pet: "PET",
  "polyethylene terephthalate": "PET",
  hdpe: "HDPE",
  "high density polyethylene": "HDPE",
  pp: "PP",
  polypropylene: "PP",
  ldpe: "LDPE",
  "low density polyethylene": "LDPE",
  pvc: "PVC",
  "polyvinyl chloride": "PVC",
  ps: "PS",
  polystyrene: "PS",
  bottle: "PET",
  container: "HDPE",
  film: "LDPE",
  pipe: "PVC",
  scrap: "PP",
  tray: "PS",
  flake: "PET",
  regrind: "HDPE",
  copolymer: "PP",
};

export const ragService = {
  async submitForClassification(documentId, items, companyId) {
    setTimeout(async () => {
      try {
        const classifications = await this.classifyItems(items);

        await supabaseAdmin
          .from("document_classifications")
          .delete()
          .eq("document_id", documentId);

        const classificationInserts = classifications.map((cls) => ({
          document_id: documentId,
          material_code: cls.material_code,
          quantity_kg: cls.quantity_kg,
          confidence_score: cls.confidence_score,
          reasoning: cls.reasoning,
          matched_synonym: cls.matched_synonym,
          vector_similarity: cls.vector_similarity,
          requires_human_review: cls.confidence_score < 0.85,
          verified_by_user: false,
        }));

        await supabaseAdmin
          .from("document_classifications")
          .insert(classificationInserts);

        const avgConfidence =
          classifications.reduce((sum, c) => sum + c.confidence_score, 0) /
          classifications.length;

        await supabaseAdmin
          .from("documents")
          .update({
            rag_confidence: avgConfidence,
            status: "CLASSIFIED",
            requires_human_review: classifications.some(
              (c) => c.confidence_score < 0.85,
            ),
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentId);

        console.log(
          `[RAG] Document ${documentId} classified successfully with ${classifications.length} items`,
        );
      } catch (error) {
        console.error(`[RAG] Failed for document ${documentId}:`, error);
        await supabaseAdmin
          .from("documents")
          .update({
            status: "RAG_FAILED",
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentId);
      }
    }, 3000);

    return {
      jobId: `rag-${documentId}-${Date.now()}`,
      status: "SUBMITTED",
    };
  },

  async classifyItems(items) {
    const classifications = [];

    for (const item of items) {
      const description = (item.description || "").toLowerCase();
      let matchedMaterial = null;
      let confidence = 0.65;
      let matchedSynonym = item.description;

      for (const [keyword, materialCode] of Object.entries(MATERIAL_KEYWORDS)) {
        if (description.includes(keyword)) {
          matchedMaterial = materialCode;
          confidence = 0.92;
          matchedSynonym = keyword;
          break;
        }
      }

      if (!matchedMaterial) {
        if (description.includes("clear") || description.includes("bottle")) {
          matchedMaterial = "PET";
          confidence = 0.78;
        } else if (
          description.includes("natural") ||
          description.includes("container")
        ) {
          matchedMaterial = "HDPE";
          confidence = 0.75;
        } else if (
          description.includes("mixed") ||
          description.includes("scrap")
        ) {
          matchedMaterial = "PP";
          confidence = 0.7;
        } else {
          matchedMaterial = "PET";
          confidence = 0.45;
        }
      }

      classifications.push({
        material_code: matchedMaterial,
        quantity_kg: parseFloat(item.quantity) || 0,
        confidence_score: confidence,
        reasoning: `Classified as ${matchedMaterial} based on keyword matching: "${item.description}"`,
        matched_synonym: matchedSynonym,
        vector_similarity: confidence - 0.05,
      });
    }

    return classifications;
  },

  async mockSubmit(documentId, items, companyId) {
    return this.submitForClassification(documentId, items, companyId);
  },
};
