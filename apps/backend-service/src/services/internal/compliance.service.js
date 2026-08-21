import { supabaseAdmin } from "../../config/database.js";
import { regulatoryService } from "../external/regulatory.service.js";

const MATERIAL_COLUMNS = {
  PET: "total_pet_kg",
  HDPE: "total_hdpe_kg",
  PP: "total_pp_kg",
  LDPE: "total_ldpe_kg",
  PVC: "total_pvc_kg",
  PS: "total_ps_kg",
  MLP: "total_mlp_kg",
};

export const complianceService = {
  async getFilingPeriods(userId, options = {}) {
    const year = options.year || new Date().getFullYear();

    let { data: periods, error } = await supabaseAdmin
      .from("filing_periods")
      .select("*")
      .eq("company_id", userId)
      .eq("year", year)
      .order("quarter");

    if (error) throw error;

    if (!periods || periods.length === 0) {
      periods = await this.createFilingPeriods(userId, year);
    }

    for (const period of periods) {
      await this.recalculatePeriod(period.id, userId);
    }

    const { data: updated } = await supabaseAdmin
      .from("filing_periods")
      .select("*")
      .eq("company_id", userId)
      .eq("year", year)
      .order("quarter");

    return updated || [];
  },

  async createFilingPeriods(userId, year) {
    const quarters = [
      { q: "Q1", s: `${year}-01-01`, e: `${year}-03-31` },
      { q: "Q2", s: `${year}-04-01`, e: `${year}-06-30` },
      { q: "Q3", s: `${year}-07-01`, e: `${year}-09-30` },
      { q: "Q4", s: `${year}-10-01`, e: `${year}-12-31` },
    ];

    const payload = quarters.map((q) => ({
      company_id: userId,
      year,
      quarter: q.q,
      start_date: q.s,
      end_date: q.e,
      status: "OPEN",
    }));

    const { data, error } = await supabaseAdmin
      .from("filing_periods")
      .insert(payload)
      .select();
    if (error) throw error;
    return data;
  },

  async getCurrentFiling(userId) {
    const now = new Date().toISOString().split("T")[0];

    let { data: period } = await supabaseAdmin
      .from("filing_periods")
      .select("*")
      .eq("company_id", userId)
      .lte("start_date", now)
      .gte("end_date", now)
      .single();

    if (!period) {
      const year = new Date().getFullYear();
      const { data: existing } = await supabaseAdmin
        .from("filing_periods")
        .select("id")
        .eq("company_id", userId)
        .eq("year", year)
        .limit(1);

      if (!existing || existing.length === 0) {
        await this.createFilingPeriods(userId, year);
        return this.getCurrentFiling(userId);
      }

      const { data: latest } = await supabaseAdmin
        .from("filing_periods")
        .select("*")
        .eq("company_id", userId)
        .eq("status", "OPEN")
        .order("start_date", { ascending: false })
        .limit(1)
        .single();

      if (!latest) return null;
      await this.recalculatePeriod(latest.id, userId);
      return this.enrichFiling(latest, userId);
    }

    await this.recalculatePeriod(period.id, userId);
    const { data: refreshed } = await supabaseAdmin
      .from("filing_periods")
      .select("*")
      .eq("id", period.id)
      .single();

    return this.enrichFiling(refreshed || period, userId);
  },

  async getFilingDetails(filingId, userId) {
    const { data, error } = await supabaseAdmin
      .from("filing_periods")
      .select("*")
      .eq("id", filingId)
      .eq("company_id", userId)
      .single();

    if (error || !data) throw new Error("Filing not found");
    await this.recalculatePeriod(data.id, userId);
    const { data: refreshed } = await supabaseAdmin
      .from("filing_periods")
      .select("*")
      .eq("id", data.id)
      .single();
    return this.enrichFiling(refreshed || data, userId);
  },

  async getFilingDocuments(filingId, userId, options = {}) {
    const { page = 1, limit = 20 } = options;

    const { data: period } = await supabaseAdmin
      .from("filing_periods")
      .select("start_date, end_date")
      .eq("id", filingId)
      .single();

    if (!period) throw new Error("Filing not found");

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from("documents")
      .select(
        "*, document_classifications(id, material_code, quantity_kg, corrected_material_code, corrected_quantity_kg, verified_by_user)",
        { count: "exact" },
      )
      .eq("company_id", userId)
      .gte("created_at", period.start_date)
      .lte("created_at", `${period.end_date}T23:59:59`)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      data: (data || []).map((doc) => ({
        ...doc,
        total_quantity: doc.document_classifications?.reduce(
          (sum, c) =>
            sum + (c.corrected_quantity_kg ?? c.quantity_kg ?? 0),
          0,
        ),
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
      },
    };
  },

  async submitFiling(filingId, userId, notes) {
    const { data: period } = await supabaseAdmin
      .from("filing_periods")
      .select("start_date, end_date")
      .eq("id", filingId)
      .single();

    if (!period) throw new Error("Filing not found");

    const { count: unverified } = await supabaseAdmin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", userId)
      .gte("created_at", period.start_date)
      .lte("created_at", `${period.end_date}T23:59:59`)
      .eq("verified_by_user", false);

    if (unverified > 0)
      throw new Error("Cannot submit: unverified documents exist");

    await this.recalculatePeriod(filingId, userId);

    const { data, error } = await supabaseAdmin
      .from("filing_periods")
      .update({
        status: "SUBMITTED",
        submitted_at: new Date().toISOString(),
        notes,
      })
      .eq("id", filingId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async recalculatePeriod(filingId, userId) {
    const { data: period } = await supabaseAdmin
      .from("filing_periods")
      .select("start_date, end_date")
      .eq("id", filingId)
      .single();

    if (!period) return;

    const { data: docs } = await supabaseAdmin
      .from("documents")
      .select(
        "id, document_classifications!inner(material_code, quantity_kg, corrected_material_code, corrected_quantity_kg, verified_by_user)",
      )
      .eq("company_id", userId)
      .gte("created_at", period.start_date)
      .lte("created_at", `${period.end_date}T23:59:59`)
      .eq("document_classifications.verified_by_user", true);

    const totals = {};
    let docCount = 0;

    for (const doc of docs || []) {
      docCount++;
      for (const cls of doc.document_classifications) {
        const materialCode =
          cls.corrected_material_code || cls.material_code;
        const quantity = cls.corrected_quantity_kg ?? cls.quantity_kg ?? 0;
        if (!materialCode) continue;
        totals[materialCode] = (totals[materialCode] || 0) + quantity;
      }
    }

    const updates = { documents_count: docCount };
    for (const [mat, col] of Object.entries(MATERIAL_COLUMNS)) {
      updates[col] = totals[mat] || 0;
    }

    await supabaseAdmin
      .from("filing_periods")
      .update(updates)
      .eq("id", filingId);
  },

  async enrichFiling(period, userId) {
    const materials = {};
    for (const [code, col] of Object.entries(MATERIAL_COLUMNS)) {
      if (period[col] > 0) materials[code] = period[col];
    }

    const { count: pending } = await supabaseAdmin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", userId)
      .gte("created_at", period.start_date)
      .lte("created_at", `${period.end_date}T23:59:59`)
      .eq("verified_by_user", false);

    return {
      ...period,
      materials,
      total_quantity: Object.values(materials).reduce((a, b) => a + b, 0),
      pending_review: pending || 0,
      can_submit:
        period.status === "OPEN" &&
        pending === 0 &&
        Object.keys(materials).length > 0,
    };
  },

  async getDashboardStats(userId) {
    const now = new Date();
    const qStr = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;

    const [filing, total, pending, verified] = await Promise.all([
      supabaseAdmin
        .from("filing_periods")
        .select("*")
        .eq("company_id", userId)
        .eq("year", now.getFullYear())
        .eq("quarter", qStr)
        .single(),
      supabaseAdmin
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("company_id", userId),
      supabaseAdmin
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("company_id", userId)
        .eq("verified_by_user", false),
      supabaseAdmin
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("company_id", userId)
        .eq("verified_by_user", true),
    ]);

    return {
      current_quarter: filing.data,
      counts: {
        total: total.count || 0,
        pending: pending.count || 0,
        verified: verified.count || 0,
      },
    };
  },

  async getRecentActivity(userId, limit = 10) {
    const { data: docs } = await supabaseAdmin
      .from("documents")
      .select("id, filename, status, created_at")
      .eq("company_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return { recent_uploads: docs || [] };
  },

  async generateAnnualReport(userId, year) {
    const fiscalYear = Number(year) || new Date().getFullYear();
    const startDate = `${fiscalYear}-04-01`;
    const endDate = `${fiscalYear + 1}-03-31T23:59:59`;
    const [{ data: company }, { data: documents, error }] = await Promise.all([
      supabaseAdmin.from("companies").select("*").eq("id", userId).single(),
      supabaseAdmin
        .from("documents")
        .select(
          "id, filename, status, created_at, verified_by_user, ocr_confidence, rag_confidence, document_classifications(id, material_code, corrected_material_code, quantity_kg, corrected_quantity_kg, confidence_score, verified_by_user)",
        )
        .eq("company_id", userId)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: true }),
    ]);

    if (error) throw error;

    const materialTotals = {};
    const evidence = (documents || []).map((document) => {
      const classifications = document.document_classifications || [];
      const verifiedClassifications = classifications.filter(
        (classification) => classification.verified_by_user,
      );
      const verifiedQuantity = verifiedClassifications.reduce(
        (sum, classification) =>
          sum +
          (classification.corrected_quantity_kg ??
            classification.quantity_kg ??
            0),
        0,
      );

      for (const classification of verifiedClassifications) {
        const materialCode =
          classification.corrected_material_code || classification.material_code;
        if (materialCode) {
          materialTotals[materialCode] =
            (materialTotals[materialCode] || 0) +
            (classification.corrected_quantity_kg ??
              classification.quantity_kg ??
              0);
        }
      }

      return {
        document_id: document.id,
        filename: document.filename,
        document_status: document.status,
        uploaded_at: document.created_at,
        verified: Boolean(document.verified_by_user),
        verified_material_quantity_kg: verifiedQuantity,
        ocr_confidence: document.ocr_confidence,
        rag_confidence: document.rag_confidence,
      };
    });

    const pendingDocuments = evidence.filter((document) => !document.verified);
    const totalVerifiedMaterialKg = Object.values(materialTotals).reduce(
      (sum, value) => sum + value,
      0,
    );
    const categoryRows = [
      ["CATEGORY_I", "Rigid plastic packaging"],
      ["CATEGORY_II", "Flexible plastic packaging"],
      ["CATEGORY_III", "Multilayer plastic packaging"],
      ["CATEGORY_IV", "Compostable plastic packaging"],
    ].map(([code, name]) => ({
      category_code: code,
      category_name: name,
      packaging_quantity_kg: null,
      epr_target_kg: null,
      epr_certificates_achieved_kg: null,
      available_potential_kg: null,
      shortfall_kg: null,
      likely_environmental_compensation_inr: null,
      status: "DATA_REQUIRED",
    }));

    const blockers = [
      "Procurement, sales, reuse, and recycled-content quantities are not captured in structured fields.",
      "Category-wise EPR targets, certificates, and available potential are not captured.",
      "CPCB registration details and approved packaging categories are not captured in structured fields.",
    ];
    if (pendingDocuments.length > 0) {
      blockers.unshift(`${pendingDocuments.length} document(s) still require human verification.`);
    }

    return {
      schema_version: "cpcb-pibo-annual-report-draft-v1",
      report_type: "PIBO_ANNUAL_RETURN_DRAFT",
      report_status: blockers.length === 0 ? "READY_FOR_REVIEW" : "DATA_REQUIRED",
      financial_year: {
        start_year: fiscalYear,
        label: `FY ${fiscalYear}-${String(fiscalYear + 1).slice(-2)}`,
        start_date: startDate,
        end_date: endDate.split("T")[0],
      },
      entity: {
        company_name: company?.company_name || null,
        gst_number: company?.gst_number || null,
        pibo_category: company?.Pibo_category || [],
      },
      overview: {
        procurement: { status: "DATA_REQUIRED", total_kg: null, by_category: [] },
        sales: { status: "DATA_REQUIRED", total_kg: null, by_category: [] },
        reuse: { status: "DATA_REQUIRED", total_kg: null, by_category: [] },
        recycled_plastic_used: { status: "DATA_REQUIRED", total_kg: null, by_category: [] },
        verified_material_classifications: {
          status: totalVerifiedMaterialKg > 0 ? "AVAILABLE" : "DATA_REQUIRED",
          total_kg: totalVerifiedMaterialKg,
          by_material: materialTotals,
        },
      },
      compliance_status: {
        categories: categoryRows,
        epr_certificates: { status: "DATA_REQUIRED", achieved_kg: null, purchased_kg: null },
        environmental_compensation: { status: "DATA_REQUIRED", likely_amount_inr: null },
      },
      evidence,
      readiness: {
        can_submit: false,
        blockers,
        verified_documents: evidence.filter((document) => document.verified).length,
        pending_documents: pendingDocuments.length,
      },
      source_basis: [
        {
          title: "CPCB Guidance Manual for Centralized EPR Portal for Plastic Packaging",
          url: "https://eprplastic.cpcb.gov.in/assets/pdfs/Guidance_Manual.pdf",
        },
        {
          title: "Plastic Waste Management (Amendment) Rules, 2026",
          url: "https://www.eprplastic.cpcb.gov.in/plastic/downloads/Plastic_Waste_Management_2026.pdf",
        },
        {
          title: "CPCB Common EPR Portal",
          url: "https://epr.cpcb.gov.in/",
        },
      ],
      generated_at: new Date().toISOString(),
    };
  },

  async getRegulatoryReview(userId, input = {}) {
    const materials = input.materials && typeof input.materials === "object" ? input.materials : {};
    const materialSummary = Object.entries(materials)
      .map(([code, quantity]) => `${code}: ${Number(quantity) || 0} kg`)
      .join(", ") || "No verified material totals";
    const documentsCount = Number(input.documents_count) || 0;
    const pendingReview = Number(input.pending_review) || 0;
    const query = [
      "Review this plastic EPR compliance report against the applicable CPCB requirements.",
      `Verified material totals: ${materialSummary}.`,
      `Documents in the report: ${documentsCount}. Documents pending review: ${pendingReview}.`,
      "Identify the most relevant obligations, evidence gaps, and reporting considerations for this report.",
      "Keep the answer concise and cite the supplied source documents.",
    ].join(" ");

    const result = await regulatoryService.query(query);
    return {
      ...result,
      query,
      generated_at: new Date().toISOString(),
    };
  },

  async generateQuarterlyReport(userId, year, quarter) {
    const y = year || new Date().getFullYear();
    const q = quarter || `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;

    const { data: period } = await supabaseAdmin
      .from("filing_periods")
      .select("*")
      .eq("company_id", userId)
      .eq("year", y)
      .eq("quarter", q)
      .single();

    if (!period) throw new Error("Report not found");

    return { period, generated_at: new Date().toISOString() };
  },
};
