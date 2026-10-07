import { supabaseAdmin } from "../../config/database.js";
import { schema } from "../../config/schema.js";
import { financialYearOf, financialYearRange } from "../external/normalization.js";
import { conflict } from "../../utils/errors.js";
import { effectiveDate, filingPosition } from "./filing.summary.js";

export { filingPosition };

export const isYearFinalized = async (userId, fyStart) => {
  if (!(await schema()).fyFilings) return false;
  const { data } = await supabaseAdmin
    .from("fy_filings")
    .select("id")
    .eq("company_id", userId)
    .eq("financial_year", fyStart)
    .maybeSingle();
  return Boolean(data);
};

export const assertYearOpen = async (userId, fyStart) => {
  if (await isYearFinalized(userId, fyStart)) {
    throw conflict(
      `${financialYearRange(fyStart).label} is finalized. Reopen it on the Filing page before changing its documents.`,
    );
  }
};

export const assertDocumentEditable = async (userId, document) =>
  assertYearOpen(userId, financialYearOf(effectiveDate(document)));

export const finalizedYears = async (userId) => {
  const years = new Map();
  if (!(await schema()).fyFilings) return years;
  const { data, error } = await supabaseAdmin
    .from("fy_filings")
    .select("financial_year, snapshot")
    .eq("company_id", userId);
  if (error) throw new Error(`Failed to read filing status: ${error.message}`);
  for (const filing of data || []) {
    years.set(filing.financial_year, new Set((filing.snapshot?.documents || []).map((d) => d.id)));
  }
  return years;
};

export const assertDocumentRemovable = async (userId, document) => {
  const position = filingPosition(document, await finalizedYears(userId));
  if (position.included) {
    throw conflict(
      `${financialYearRange(position.financial_year).label} is finalized and includes this document. Reopen it on the Filing page before deleting it.`,
    );
  }
};
