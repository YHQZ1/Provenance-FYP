import { supabaseAdmin } from "../../config/database.js";

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
      confidence: 0.95,
    },
    confidence: 0.95,
  },
  {
    raw_text:
      "PURCHASE ORDER #PO-2024-001\nVendor: Green Materials Co.\n\nLine Items:\n- PVC Pipes Scrap: 750 kg\n- LDPE Film Bales: 450 kg\n- PET Flakes Hot Washed: 600 kg",
    extracted_data: {
      items: [
        { description: "PVC Pipes Scrap", quantity: 750, unit: "kg" },
        { description: "LDPE Film Bales", quantity: 450, unit: "kg" },
        { description: "PET Flakes Hot Washed", quantity: 600, unit: "kg" },
      ],
      confidence: 0.92,
    },
    confidence: 0.92,
  },
  {
    raw_text:
      "RECEIPT OF MATERIALS\nDate: March 10, 2024\nReceived from: Industrial Plastics Ltd.\n\nMaterials Received:\n- HDPE Regrind Natural - 1200 kg\n- PP Copolymer - 800 kg\n- PS Trays - 300 kg",
    extracted_data: {
      items: [
        { description: "HDPE Regrind Natural", quantity: 1200, unit: "kg" },
        { description: "PP Copolymer", quantity: 800, unit: "kg" },
        { description: "PS Trays", quantity: 300, unit: "kg" },
      ],
      confidence: 0.88,
    },
    confidence: 0.88,
  },
];

export const ocrService = {
  async submitForOcr(documentId, storagePath) {
    setTimeout(async () => {
      try {
        const mockData =
          MOCK_OCR_RESULTS[Math.floor(Math.random() * MOCK_OCR_RESULTS.length)];

        await supabaseAdmin
          .from("documents")
          .update({
            raw_text: mockData.raw_text,
            extracted_data: mockData.extracted_data,
            ocr_confidence: mockData.confidence,
            status: "COMPLETED",
            requires_human_review: true,
            reasoning:
              "Items extracted via OCR. Please map materials manually.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentId);

        const items = mockData.extracted_data?.items || [];

        if (items.length > 0) {
          const classifications = items.map((item) => ({
            document_id: documentId,
            material_code: null,
            quantity_kg: item.quantity || 0,
            confidence_score: 0,
            reasoning: `Extracted from OCR: "${item.description}"`,
            matched_synonym: item.description,
            requires_human_review: true,
            verified_by_user: false,
          }));

          await supabaseAdmin
            .from("document_classifications")
            .insert(classifications);
        }

        console.log(`[OCR] Document ${documentId} processed successfully`);
      } catch (error) {
        console.error(`[OCR] Failed for document ${documentId}:`, error);
        await supabaseAdmin
          .from("documents")
          .update({
            status: "OCR_FAILED",
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentId);
      }
    }, 2000);
  },

  async mockSubmit(documentId) {
    return this.submitForOcr(documentId, null);
  },
};
