import { ACTIVE_SEARCHERS, ALL_SEARCHERS, PORTFOLIO_COMPANIES } from "./searchers.js";
import { normalizeSearcherName } from "./searcherModel.js";

export const SF_STRATEGY_CERCA = "Search Fund - Cerca";
export const SF_STRATEGY_ADQUISICIO = "Search Fund - Adquisició/Participada (SF)";
export const STRATEGY_PARTICIPADA_ALTRES = "Participada (Altres)";

const activeSearcherNames = new Set(
  ACTIVE_SEARCHERS.map((row) => normalizeSearcherName(row.nom)).filter(Boolean),
);

const searcherStageByName = new Map(
  ALL_SEARCHERS.map((row) => [
    normalizeSearcherName(row.nom),
    String(row.statusScreening ?? "").trim(),
  ]).filter(([name]) => Boolean(name)),
);

const companyTypeByName = new Map(
  PORTFOLIO_COMPANIES.map((row) => [
    normalizeSearcherName(row.nom),
    String(row.tipus ?? "").trim(),
  ]).filter(([name]) => Boolean(name)),
);

export function inferStrategyFromSearchFundSnapshot({ fons, vcpe } = {}) {
  const nameKey = normalizeSearcherName(fons);
  if (!nameKey) return null;

  const companyType = companyTypeByName.get(nameKey);
  if (companyType === "SF") return SF_STRATEGY_ADQUISICIO;
  if (companyType === "PE") return STRATEGY_PARTICIPADA_ALTRES;

  const stage = searcherStageByName.get(nameKey);
  if (stage === "Invertit en fase d'adquisició") return SF_STRATEGY_ADQUISICIO;
  if (stage === "Invertit en fase de cerca") return SF_STRATEGY_CERCA;

  if (activeSearcherNames.has(nameKey)) return SF_STRATEGY_CERCA;
  if (vcpe === "PC") return STRATEGY_PARTICIPADA_ALTRES;
  return null;
}
