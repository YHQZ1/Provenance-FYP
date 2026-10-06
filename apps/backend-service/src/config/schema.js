import { supabaseAdmin } from "./database.js";

// Optional schema pieces added by supabase/migrations. Features that need them
// degrade gracefully until the migration is applied.
const capabilities = {
  fyFilings: false,
  classificationCategory: false,
  reviewerIdentity: false,
  activityLog: false,
  obligations: false,
  tradeNames: false,
};

let detected = null;

const probe = async (table, columns) => {
  const { error } = await supabaseAdmin.from(table).select(columns).limit(1);
  return !error;
};

export const detectSchema = async () => {
  const [fyFilings, classificationCategory, reviewerIdentity, activityLog, obligations, tradeNames] =
    await Promise.all([
      probe("fy_filings", "id"),
      probe("document_classifications", "cpcb_category, corrected_cpcb_category"),
      probe("document_classifications", "reviewed_by, reviewed_by_name, reviewed_at"),
      probe("activity_events", "id"),
      probe("epr_obligation_inputs", "id"),
      probe("company_trade_names", "id"),
    ]);
  capabilities.fyFilings = fyFilings;
  capabilities.classificationCategory = classificationCategory;
  capabilities.reviewerIdentity = reviewerIdentity;
  capabilities.activityLog = activityLog;
  capabilities.obligations = obligations;
  capabilities.tradeNames = tradeNames;

  const missing = Object.entries(capabilities)
    .filter(([, available]) => !available)
    .map(([name]) => name);
  if (missing.length) {
    console.warn(
      `[Schema] Missing optional schema: ${missing.join(", ")}. Apply supabase/migrations to enable them.`,
    );
  }
  return capabilities;
};

export const schema = async () => {
  detected ??= detectSchema().catch((error) => {
    detected = null;
    console.error("[Schema] Detection failed:", error.message);
    return capabilities;
  });
  return detected;
};
