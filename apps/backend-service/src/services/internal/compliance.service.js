import { supabaseAdmin } from "../../config/database.js";

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
      return this.enrichFiling(latest, userId);
    }

    return this.enrichFiling(period, userId);
  },

  async getFilingDetails(filingId, userId) {
    const { data, error } = await supabaseAdmin
      .from("filing_periods")
      .select("*")
      .eq("id", filingId)
      .eq("company_id", userId)
      .single();

    if (error || !data) throw new Error("Filing not found");
    return this.enrichFiling(data, userId);
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
        "*, document_classifications(id, material_code, quantity_kg, verified_by_user)",
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
          (sum, c) => sum + (c.quantity_kg || 0),
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
        "id, document_classifications!inner(material_code, quantity_kg, verified_by_user)",
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
        totals[cls.material_code] =
          (totals[cls.material_code] || 0) + (cls.quantity_kg || 0);
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
