import { supabaseAdmin } from "../../config/database.js";
import { env } from "../../config/env.js";
import {
  isQuantifiedDocumentType,
  normalizeLineItems,
  normalizeQuantity,
  parseDocumentDate,
} from "./normalization.js";

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
  async submitForOcr(documentId, file, meta = {}) {
    try {
      const result = env.USE_MOCK_SERVICES
        ? MOCK_OCR_RESULTS[0]
        : await requestOcrService(file);
      const documentType = meta.document_type || "purchase_invoice";
      const quantified = isQuantifiedDocumentType(documentType);
      const items = quantified
        ? normalizeLineItems(result).filter((item) => item.quantity > 0)
        : [];
      const fields = result.fields || {};

      const status = !quantified
        ? "VERIFIED"
        : items.length > 0
          ? "RAG_PROCESSING"
          : "REVIEW_PENDING";

      const { error: updateError } = await supabaseAdmin
        .from("documents")
        .update({
          raw_text: result.raw_text,
          extracted_data: {
            document_type: documentType,
            detected_type: result.document_type || "unknown",
            file_hash: meta.file_hash || null,
            document_date: parseDocumentDate(fields.invoice_date?.value),
            fields,
            line_items: items,
            items,
            warnings: result.warnings || [],
            metadata: result.metadata || {},
          },
          ocr_confidence: result.confidence,
          status,
          verified_by_user: !quantified,
          requires_human_review: quantified,
          reasoning: !quantified
            ? "Stored as supporting evidence. No quantities are taken from this document."
            : items.length > 0
              ? "Line items extracted and sent for material classification."
              : "No line items with quantities were found. Add them during review or delete the document.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      if (updateError) {
        throw new Error(`OCR result update failed: ${updateError.message}`);
      }

      await supabaseAdmin
        .from("document_classifications")
        .delete()
        .eq("document_id", documentId);

      const classifications = items.map((item) => ({
        document_id: documentId,
        material_code: null,
        quantity_kg: normalizeQuantity(item),
        confidence_score: 0,
        reasoning: "Awaiting material classification.",
        matched_synonym: item.description,
        requires_human_review: true,
        verified_by_user: false,
      }));

      if (quantified && items.length === 0) {
        classifications.push({
          document_id: documentId,
          material_code: null,
          quantity_kg: null,
          confidence_score: 0,
          reasoning: "No line items were extracted. Enter the material and quantity from the document, or exclude it.",
          matched_synonym: "Whole document (no line items detected)",
          requires_human_review: true,
          verified_by_user: false,
        });
      }

      if (classifications.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from("document_classifications")
          .insert(classifications);
        if (insertError) {
          throw new Error(`OCR line item insert failed: ${insertError.message}`);
        }
      }

      console.log(`[OCR] Document ${documentId} processed successfully`);
      return { ...result, line_items: items };
    } catch (error) {
      console.error(`[OCR] Failed for document ${documentId}:`, error);
      await supabaseAdmin
        .from("documents")
        .update({
          status: "OCR_FAILED",
          reasoning: `Text extraction failed: ${error.message}`,
          requires_human_review: true,
          verified_by_user: false,
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
