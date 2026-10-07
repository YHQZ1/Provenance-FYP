const KG_FACTORS = {
  KG: 1,
  KGS: 1,
  KILO: 1,
  KILOS: 1,
  KILOGRAM: 1,
  KILOGRAMS: 1,
  G: 0.001,
  GM: 0.001,
  GMS: 0.001,
  GRAM: 0.001,
  GRAMS: 0.001,
  MT: 1000,
  T: 1000,
  TON: 1000,
  TONS: 1000,
  TONNE: 1000,
  TONNES: 1000,
  QTL: 100,
  QUINTAL: 100,
  QUINTALS: 100,
};

export const parseNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
};

export const normalizeQuantity = (item) => {
  const quantity = parseNumber(item?.quantity);

  if (quantity == null) {
    return null;
  }

  const unit = String(item?.unit || "kg")
    .trim()
    .toUpperCase()
    .replace(/\.$/, "");
  const factor = KG_FACTORS[unit];

  return factor == null ? null : Number((quantity * factor).toFixed(3));
};

export const normalizeMaterialCode = (materialCode) => {
  const code = String(materialCode || "UNKNOWN")
    .trim()
    .toUpperCase();
  return code === "UNKNOWN" ? null : code;
};

export const buildClassificationText = (item) => {
  const description = item?.description || item?.raw_text || "Unknown material";
  const quantity = item?.quantity ? ` ${item.quantity} ${item.unit || "kg"}` : "";
  const text = `${description}${quantity}`.trim();

  return text.length >= 10 ? text : `${text} ${item?.raw_text || "material invoice item"}`.trim();
};

const firstNonEmpty = (items) => (Array.isArray(items) && items.length > 0 ? items : null);

export const normalizeLineItems = (result) =>
  (
    firstNonEmpty(result?.line_items) ||
    firstNonEmpty(result?.extracted_data?.line_items) ||
    firstNonEmpty(result?.extracted_data?.items) ||
    []
  )
    .map((item) => ({
      description: item.description || item.raw_text || "Unknown item",
      quantity: parseNumber(item.quantity) ?? 0,
      unit: item.unit || "kg",
    }))
    .filter((item) => item.description && item.quantity >= 0);

export const DOCUMENT_TYPES = {
  purchase_invoice: "Purchase invoice",
  recycling_certificate: "Recycling certificate",
  collection_receipt: "Collection receipt",
  epr_record: "EPR record",
};

export const normalizeDocumentType = (value) =>
  Object.hasOwn(DOCUMENT_TYPES, value) ? value : "purchase_invoice";

export const documentTypeOf = (extractedData) =>
  normalizeDocumentType(extractedData?.document_type);

export const isQuantifiedDocumentType = (type) => type !== "epr_record";

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const isoDate = (year, month, day) => {
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
};

export const parseDocumentDate = (value) => {
  if (!value) return null;
  const text = String(value).trim();

  const numeric = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (numeric) return isoDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));

  const named = text.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s/.-]+([A-Za-z]{3,9})[\s/.,-]+(\d{2,4})$/);
  if (named) {
    const month =
      MONTHS[named[2].slice(0, named[2].toLowerCase().startsWith("sept") ? 4 : 3).toLowerCase()];
    return month ? isoDate(Number(named[3]), month, Number(named[1])) : null;
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  return null;
};

export const financialYearOf = (dateLike) => {
  const date = new Date(dateLike);
  const month = date.getUTCMonth();
  const year = date.getUTCFullYear();
  return month >= 3 ? year : year - 1;
};

export const financialYearRange = (startYear) => ({
  start_year: startYear,
  label: `FY ${startYear}-${String(startYear + 1).slice(-2)}`,
  start_date: `${startYear}-04-01`,
  end_date: `${startYear + 1}-03-31`,
});
