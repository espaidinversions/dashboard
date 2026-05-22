import { FUND_PRICES } from "../generated/prices/fundPrices.js";
import { ESTIMATED_BOND_PRICES } from "./estimatedBondPrices.js";
// Keep "price bridges" in src/ so production builds don't depend on ignored raw-data/ inputs.
import PRICE_BRIDGES from "./price-bridges.json" with { type: "json" };

function mergeMonthlySeries(primary = [], secondary = []) {
  const map = new Map((primary ?? []).map(([month, value]) => [month, value]));
  (secondary ?? []).forEach(([month, value]) => {
    if (!map.has(month) && value != null) map.set(month, value);
  });
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export const ALL_PRICE_SERIES = {};

for (const [isin, series] of Object.entries(FUND_PRICES)) {
  ALL_PRICE_SERIES[isin] = mergeMonthlySeries(series, PRICE_BRIDGES[isin]);
}

for (const [isin, series] of Object.entries(ESTIMATED_BOND_PRICES)) {
  ALL_PRICE_SERIES[isin] = mergeMonthlySeries(ALL_PRICE_SERIES[isin], series);
}

for (const [isin, series] of Object.entries(PRICE_BRIDGES)) {
  if (!ALL_PRICE_SERIES[isin]) ALL_PRICE_SERIES[isin] = mergeMonthlySeries([], series);
}

export const ESTIMATED_PRICE_ISINS = new Set(Object.keys(ESTIMATED_BOND_PRICES));
