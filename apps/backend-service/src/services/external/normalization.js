export const normalizeQuantity = (item) => {
  const quantity = Number(item?.quantity);

  if (!Number.isFinite(quantity)) {
    return null;
  }

  const unit = String(item?.unit || "kg").trim().toUpperCase();

  if (["MT", "TON", "TONS"].includes(unit)) {
    return quantity * 1000;
  }

  if (["KG", "KGS", "KILOGRAM", "KILOGRAMS"].includes(unit)) {
    return quantity;
  }

  return null;
};

export const normalizeMaterialCode = (materialCode) => {
  const code = String(materialCode || "UNKNOWN").trim().toUpperCase();
  return code === "UNKNOWN" ? null : code;
};

export const buildClassificationText = (item) => {
  const description = item?.description || item?.raw_text || "Unknown material";
  const quantity = item?.quantity
    ? ` ${item.quantity} ${item.unit || "kg"}`
    : "";
  const text = `${description}${quantity}`.trim();

  return text.length >= 10
    ? text
    : `${text} ${item?.raw_text || "material invoice item"}`.trim();
};

const firstNonEmpty = (items) =>
  Array.isArray(items) && items.length > 0 ? items : null;

export const normalizeLineItems = (result) =>
  (
    firstNonEmpty(result?.line_items) ||
    firstNonEmpty(result?.extracted_data?.line_items) ||
    firstNonEmpty(result?.extracted_data?.items) ||
    []
  )
    .map((item) => ({
      description: item.description || item.raw_text || "Unknown item",
      quantity: Number(item.quantity) || 0,
      unit: item.unit || "kg",
    }))
    .filter((item) => item.description && item.quantity >= 0);
