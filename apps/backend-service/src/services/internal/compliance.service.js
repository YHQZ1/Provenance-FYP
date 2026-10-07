import { supabaseAdmin } from "../../config/database.js";
import { schema } from "../../config/schema.js";
import { regulatoryService } from "../external/regulatory.service.js";
import { financialYearOf } from "../external/normalization.js";
import { documentService } from "./document.service.js";
import { summarizeFiling } from "./filing.summary.js";
import { workspaceCache } from "./workspace.cache.js";

import { conflict, unavailable } from "../../utils/errors.js";
import { env } from "../../config/env.js";

const FILING_CACHE_SECONDS = 600;

const SOURCE_BASIS = [
  {
    title: "CPCB Guidance Manual for Centralized EPR Portal for Plastic Packaging",
    url: env.EPR_GUIDANCE_MANUAL_URL,
  },
  { title: "CPCB Centralized EPR Portal for Plastic Packaging", url: env.EPR_PORTAL_URL },
].filter((source) => source.url);

export const currentFinancialYear = () => financialYearOf(new Date());

export const complianceService = {
  async getFinalization(userId, fyStart) {
    const { fyFilings } = await schema();
    if (!fyFilings) return { record: null, available: false };

    const { data, error } = await supabaseAdmin
      .from("fy_filings")
      .select("*")
      .eq("company_id", userId)
      .eq("financial_year", fyStart)
      .maybeSingle();

    if (error) throw new Error(`Failed to read filing status: ${error.message}`);
    return { record: data, available: true };
  },

  async buildFiling(userId, fyStart) {
    const [{ data: company }, documents, capabilities] = await Promise.all([
      supabaseAdmin.from("companies").select("*").eq("id", userId).maybeSingle(),
      documentService.listAllWithClassifications(userId),
      schema(),
    ]);

    return {
      ...summarizeFiling({
        documents,
        company,
        fyStart,
        currentFy: currentFinancialYear(),
        categoriesTracked: capabilities.classificationCategory,
      }),
      source_basis: SOURCE_BASIS,
      generated_at: new Date().toISOString(),
    };
  },

  getFiling(userId, fyStart = currentFinancialYear()) {
    return workspaceCache.wrap(userId, ["filing", fyStart], FILING_CACHE_SECONDS, () =>
      this.buildFilingView(userId, fyStart),
    );
  },

  async buildFilingView(userId, fyStart) {
    const [filing, finalization] = await Promise.all([
      this.buildFiling(userId, fyStart),
      this.getFinalization(userId, fyStart),
    ]);

    const record = finalization.record;
    const covered = new Set((record?.snapshot?.documents || []).map((d) => d.id));
    const lateDocuments = record
      ? filing.documents
          .filter((d) => !covered.has(d.id))
          .map(({ id, filename, effective_date }) => ({ id, filename, effective_date }))
      : [];
    return {
      ...filing,
      status: record ? "FINALIZED" : "OPEN",
      finalized_at: record?.finalized_at || null,
      late_documents: lateDocuments,
      snapshot: record?.snapshot || null,
      finalization_available: finalization.available,
    };
  },

  async finalize(userId, fyStart, notes) {
    const filing = await this.buildFilingView(userId, fyStart);
    if (!filing.finalization_available) {
      throw unavailable(
        "Filing finalization needs the fy_filings table. Run supabase/migrations/001_fy_filings.sql.",
      );
    }
    if (filing.status === "FINALIZED") throw conflict("This financial year is already finalized.");
    if (!filing.ready) {
      throw conflict("Resolve the open items before finalizing.", { blockers: filing.blockers });
    }

    const { snapshot, late_documents, ...live } = filing;
    const { error } = await supabaseAdmin.from("fy_filings").insert({
      company_id: userId,
      financial_year: fyStart,
      status: "FINALIZED",
      snapshot: { ...live, status: "FINALIZED" },
      notes: notes || null,
      finalized_at: new Date().toISOString(),
    });
    if (error?.code === "23505") throw conflict("This financial year is already finalized.");
    if (error) throw new Error(`Finalization failed: ${error.message}`);
    await workspaceCache.invalidate(userId);

    return this.getFiling(userId, fyStart);
  },

  async reopen(userId, fyStart) {
    if (!(await schema()).fyFilings) throw unavailable("Filing finalization is not set up.");
    const { error } = await supabaseAdmin
      .from("fy_filings")
      .delete()
      .eq("company_id", userId)
      .eq("financial_year", fyStart);
    if (error) throw new Error(`Reopen failed: ${error.message}`);
    await workspaceCache.invalidate(userId);
    return this.getFiling(userId, fyStart);
  },

  async getRegulatoryReview(userId, fyStart) {
    const filing = await this.buildFiling(userId, fyStart);
    const describe = (bucket) =>
      Object.entries(bucket.by_material)
        .map(([code, kg]) => `${code} ${kg} kg`)
        .join(", ") || "none";
    const categories = Object.entries(filing.totals.introduced.by_category)
      .map(([category, kg]) => `${category.replace("_", " ").toLowerCase()} ${kg} kg`)
      .join(", ");

    const query = [
      `Review a plastic EPR compliance position for ${filing.financial_year.label}.`,
      `Plastic introduced (reviewed purchase invoices): ${describe(filing.totals.introduced)}.`,
      categories ? `By CPCB category: ${categories}.` : null,
      `Recycling certificates: ${describe(filing.totals.recycled)}.`,
      `Open issues: ${filing.blockers.map((b) => b.message).join(" ") || "none"}.`,
      "Identify the relevant obligations, evidence gaps, and reporting considerations. Be concise and cite sources.",
    ]
      .filter(Boolean)
      .join(" ");

    const result = await regulatoryService.query(query);
    return { ...result, generated_at: new Date().toISOString() };
  },
};
