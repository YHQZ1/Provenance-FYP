export const DOCUMENT_TYPES = [
  {
    id: "purchase_invoice",
    label: "Purchase invoice",
    short: "Invoice",
    hint: "Plastic packaging or raw material you bought. Counts toward plastic introduced.",
  },
  {
    id: "recycling_certificate",
    label: "Recycling certificate",
    short: "Recycling cert.",
    hint: "Issued by a registered recycler. Counts toward obligations fulfilled.",
  },
  {
    id: "collection_receipt",
    label: "Collection receipt",
    short: "Collection",
    hint: "Waste collected or handed over. Supports your collection trail.",
  },
  {
    id: "epr_record",
    label: "EPR record",
    short: "EPR record",
    hint: "Registration certificates and other evidence. Stored, not quantified.",
  },
];

export const documentTypeLabel = (id) =>
  DOCUMENT_TYPES.find((t) => t.id === id)?.label || "Purchase invoice";

export const MATERIALS = [
  { code: "PET", name: "PET — polyethylene terephthalate" },
  { code: "HDPE", name: "HDPE — high-density polyethylene" },
  { code: "LDPE", name: "LDPE — low-density polyethylene" },
  { code: "PP", name: "PP — polypropylene" },
  { code: "PS", name: "PS — polystyrene" },
  { code: "PVC", name: "PVC — polyvinyl chloride" },
  { code: "MLP", name: "MLP — multi-layer plastic" },
];

export const CPCB_CATEGORIES = {
  CATEGORY_I: { short: "Category I", label: "Rigid plastic packaging" },
  CATEGORY_II: { short: "Category II", label: "Flexible plastic packaging" },
  CATEGORY_III: { short: "Category III", label: "Multilayered, with a non-plastic layer" },
  CATEGORY_IV: { short: "Category IV", label: "Compostable plastic packaging" },
  BIODEGRADABLE: { short: "Biodegradable", label: "Category to be confirmed" },
  UNCATEGORISED: { short: "Uncategorised", label: "No category recorded yet" },
};

export const annualReturnDue = (startYear) => new Date(startYear + 1, 5, 30);

export const FY_MONTHS = [
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
];

export const PIBO_CATEGORIES = [
  { id: "PRODUCER", label: "Producer", hint: "You manufacture plastic packaging." },
  { id: "IMPORTER", label: "Importer", hint: "You import plastic packaging or packaged goods." },
  {
    id: "BRAND_OWNER",
    label: "Brand owner",
    hint: "You sell goods under your brand in plastic packaging.",
  },
];

const PROCESSING = ["PENDING", "OCR_PROCESSING", "COMPLETED", "RAG_PROCESSING"];

export const documentStage = (doc) => {
  if (PROCESSING.includes(doc.status)) return "processing";
  if (doc.status === "OCR_FAILED") return "failed";
  if (doc.document_type === "epr_record") return "evidence";
  if (doc.items_count > 0 && doc.items_pending === 0) return "verified";
  return "review";
};

export const STAGES = {
  processing: {
    label: "Processing",
    tone: "info",
    help: "Reading the document and suggesting materials. This usually takes a minute or two.",
  },
  review: {
    label: "Needs review",
    tone: "warn",
    help: "Check the extracted lines and confirm or correct them.",
  },
  verified: {
    label: "Reviewed",
    tone: "ok",
    help: "Every line has been reviewed. Quantities count toward the filing.",
  },
  failed: {
    label: "Failed",
    tone: "error",
    help: "Processing failed. Retry the document or delete it.",
  },
  evidence: {
    label: "Stored",
    tone: "neutral",
    help: "Kept as supporting evidence. No quantities are taken from it.",
  },
};

export const currentFinancialYear = (date = new Date()) =>
  date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;

export const fyLabel = (startYear) => `FY ${startYear}-${String(startYear + 1).slice(-2)}`;

export const formatKg = (value) => {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const kg = Number(value);
  if (kg >= 1000) {
    return `${(kg / 1000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} t`;
  }
  return `${kg.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg`;
};

export const formatKgExact = (value) => {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 })} kg`;
};

export const formatDate = (value, withTime = false) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime && { hour: "2-digit", minute: "2-digit" }),
  });
};

export const formatSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const ACCEPTED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "tif", "tiff"];
export const MAX_UPLOAD_MB = 10;
