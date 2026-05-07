import { FUNDS0 as PIPELINE_SEED } from "./pipeline.js";

function normalizeDealName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function mergePipelineDeals(liveDeals = [], fallbackDeals = PIPELINE_SEED) {
  const merged = new Map();

  for (const deal of fallbackDeals) {
    const key = normalizeDealName(deal?.name);
    if (!key) continue;
    merged.set(key, { ...deal });
  }

  for (const deal of liveDeals) {
    const key = normalizeDealName(deal?.name);
    if (!key) continue;
    merged.set(key, { ...(merged.get(key) ?? {}), ...deal });
  }

  return [...merged.values()].sort((a, b) => {
      const idA = Number.isFinite(Number(a?.id)) ? Number(a.id) : Number.MAX_SAFE_INTEGER;
      const idB = Number.isFinite(Number(b?.id)) ? Number(b.id) : Number.MAX_SAFE_INTEGER;
      if (idA !== idB) return idA - idB;
      return String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
    });
}

