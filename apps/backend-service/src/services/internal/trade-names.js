export const normalizeTradeName = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const matchTradeName = (description, tradeNames = []) => {
  const line = ` ${normalizeTradeName(description)} `;
  if (line.trim() === "") return null;
  let best = null;
  for (const entry of tradeNames) {
    const name = normalizeTradeName(entry.trade_name);
    if (!name || !line.includes(` ${name} `)) continue;
    if (!best || name.length > normalizeTradeName(best.trade_name).length) best = entry;
  }
  return best;
};

const MAX_SUGGESTION_WORDS = 8;

export const suggestTradeNames = (corrections, tradeNames = [], limit = 20) => {
  const groups = new Map();
  for (const correction of corrections) {
    const line = correction.line?.trim();
    if (!line || !correction.material_code) continue;
    if (normalizeTradeName(line).split(" ").length > MAX_SUGGESTION_WORDS) continue;
    if (matchTradeName(line, tradeNames)) continue;
    const key = `${normalizeTradeName(line)}|${correction.material_code}`;
    const group = groups.get(key) || {
      line,
      material_code: correction.material_code,
      cpcb_category: correction.cpcb_category || null,
      times: 0,
      last_corrected_at: null,
    };
    group.times += 1;
    if (!group.last_corrected_at || correction.created_at > group.last_corrected_at) {
      group.last_corrected_at = correction.created_at;
    }
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        b.times - a.times || String(b.last_corrected_at).localeCompare(String(a.last_corrected_at)),
    )
    .slice(0, limit);
};
