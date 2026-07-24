import { normalizeSearcherName } from "./searcherName.js";
import {
  SF_STRATEGY_ADQUISICIO,
  SF_STRATEGY_CERCA,
  STRATEGY_PARTICIPADA_ALTRES,
} from "./capitalCallStrategyConstants.js";

export {
  SF_STRATEGY_ADQUISICIO,
  SF_STRATEGY_CERCA,
  STRATEGY_PARTICIPADA_ALTRES,
} from "./capitalCallStrategyConstants.js";

/**
 * Build a strategy inferrer from live searcher and portfolio company data.
 * @param {{ nom: string, statusScreening?: string|null }[]} searchers
 * @param {{ nom: string, tipus?: string|null }[]} companies
 * @returns {(ctx: { fons?: string|null }) => string|null}
 */
export function buildSearchFundInferrer(searchers = [], companies = []) {
  const stageByName = new Map(
    searchers
      .map((r) => [normalizeSearcherName(r.nom), String(r.statusScreening ?? "").trim()])
      .filter(([name]) => Boolean(name)),
  );

  const typeByName = new Map(
    companies
      .map((r) => [normalizeSearcherName(r.nom), String(r.tipus ?? "").trim()])
      .filter(([name]) => Boolean(name)),
  );

  return function inferStrategy({ fons } = {}) {
    const nameKey = normalizeSearcherName(fons);
    if (!nameKey) return null;

    const companyType = typeByName.get(nameKey);
    if (companyType === "SF") return SF_STRATEGY_ADQUISICIO;
    if (companyType === "PE") return STRATEGY_PARTICIPADA_ALTRES;

    const stage = stageByName.get(nameKey);
    if (stage === "Invertit en fase d'adquisició") return SF_STRATEGY_ADQUISICIO;
    if (stage === "Invertit en fase de cerca") return SF_STRATEGY_CERCA;

    return null;
  };
}
