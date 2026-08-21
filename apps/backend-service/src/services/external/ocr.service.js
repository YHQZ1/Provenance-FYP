import { supabaseAdmin } from "../../config/database.js";
import { env } from "../../config/env.js";

const MOCK_OCR_RESULTS = [
  {
    raw_text:
      "INVOICE #12345\nSupplier: Plastic Recyclers Inc.\nDate: 2024-01-15\n\nItems:\n1. PET Bottles Clear - 500 kg\n2. HDPE Containers Natural - 300 kg\n3. PP Scrap Mixed - 200 kg\nTotal: 1000 kg",
    extracted_data: {
      items: [
        { description: "PET Bottles Clear", quantity: 500, unit: "kg" },
        { description: "HDPE Containers Natural", quantity: 300, unit: "kg" },
        { description: "PP Scrap Mixed", quantity: 200, unit: "kg" },
      ],
    },
    confidence: 0.95,
  },
];

export const ocrService = {
  async submitForOcr(documentId, file) {
    try {
      const result = env.USE_MOCK_SERVICES
        ? MOCK_OCR_RESULTS[0]
        : await requestOcrService(file);
      const items = normalizeLineItems(result);

      const { error: updateError } = await supabaseAdmin
        .from("documents")
        .update({
          raw_text: result.raw_text,
          extracted_data: {
            document_type: result.document_type || "unknown",
            fields: result.fields || {},
            line_items: result.line_items || [],
            items,
            warnings: result.warnings || [],
            metadata: result.metadata || {},
          },
          ocr_confidence: result.confidence,
          status: "COMPLETED",
          requires_human_review: Boolean(result.warnings?.length),
          reasoning: "Items extracted via OCR and ready for material classification.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      if (updateError) {
        throw new Error(`OCR result update failed: ${updateError.message}`);
      }

      const classifications = items
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          document_id: documentId,
          material_code: null,
          quantity_kg: item.quantity,
          confidence_score: 0,
          reasoning: `Extracted from OCR: "${item.description}"`,
          matched_synonym: item.description,
          requires_human_review: true,
          verified_by_user: false,
        }));

      if (classifications.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from("document_classifications")
          .insert(classifications);
        if (insertError) {
          throw new Error(`OCR line item insert failed: ${insertError.message}`);
        }
      }

      console.log(`[OCR] Document ${documentId} processed successfully`);
      return result;
    } catch (error) {
      console.error(`[OCR] Failed for document ${documentId}:`, error);
      await supabaseAdmin
        .from("documents")
        .update({
          status: "OCR_FAILED",
          reasoning: error.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);
      throw error;
    }
  },
};

const requestOcrService = async (file) => {
  if (!env.OCR_SERVICE_URL) {
    throw new Error("OCR_SERVICE_URL is not configured");
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([file.buffer], { type: file.mimetype }),
    file.originalname,
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.OCR_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${env.OCR_SERVICE_URL.replace(/\/$/, "")}/v1/ocr`,
      { method: "POST", body: form, signal: controller.signal },
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        `OCR service returned ${response.status}: ${payload.detail || payload.message || "request failed"}`,
      );
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`OCR service timed out after ${env.OCR_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeLineItems = (result) =>
  (result.line_items || result.extracted_data?.items || [])
    .map((item) => ({
      description: item.description || item.raw_text || "Unknown item",
      quantity: Number(item.quantity) || 0,
      unit: item.unit || "kg",
    }))
    .filter((item) => item.description && item.quantity >= 0);
