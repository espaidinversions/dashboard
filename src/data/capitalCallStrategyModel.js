import {
  SF_STRATEGY_ADQUISICIO,
  SF_STRATEGY_CERCA,
  STRATEGY_PARTICIPADA_ALTRES,
} from "./searchFundSnapshotModel.js";

/** Set by db.js once live searcher + company data is loaded. */
let _snapshotInferrer = null;

/** @param {((ctx: object) => string|null) | null} fn */
export function setSnapshotInferrer(fn) {
  _snapshotInferrer = fn ?? null;
}

function slugifyStrategy(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const CAPITAL_CALL_STRATEGY_OPTIONS = [
  "Fons Primari",
  "Fons Secundari",
  "Fons de Fons",
  "Fons de Coinversió",
  "Search Fund - Cerca",
  "Search Fund - Adquisició/Participada (SF)",
  "Participada (Altres)",
  "Fons Real Estate",
];

const STRATEGY_MAP = new Map([
  ["fons primari", "Fons Primari"],
  ["fons secundari", "Fons Secundari"],
  ["fons de fons", "Fons de Fons"],
  ["fons de coinversio", "Fons de Coinversió"],
  ["coinversio", "Fons de Coinversió"],
  ["coinversions", "Fons de Coinversió"],
  ["search fund cerca", "Search Fund - Cerca"],
  ["search fund adquisicio participada sf", "Search Fund - Adquisició/Participada (SF)"],
  ["participada altres", "Participada (Altres)"],
  ["fons real estate", "Fons Real Estate"],
  ["directe", "Fons Real Estate"],
  ["socimi", "Fons Real Estate"],
]);

export function normalizeCapitalCallStrategy(value, vcpe = null, context = null) {
  const raw = String(value ?? "").trim();
  const key = slugifyStrategy(raw);

  // If the stored value is already a canonical strategy, trust it without re-inference.
  // This preserves per-transaction est values set by the import script (e.g. SF Cerca vs Adquisició).
  if (key && STRATEGY_MAP.has(key)) return STRATEGY_MAP.get(key);

  // For legacy/unset values, fall back to live snapshot inference (set by db.js after loadAll)
  const snapshotStrategy = _snapshotInferrer?.({
    fons: typeof context === "string" ? context : context?.fons,
    vcpe,
  }) ?? null;
  if (snapshotStrategy) return snapshotStrategy;

  if (vcpe === "RE") return "Fons Real Estate";
  if (vcpe === "PC") return STRATEGY_PARTICIPADA_ALTRES;
  if (vcpe === "SF") {
    if (key.includes("adquis") || key.includes("particip")) return SF_STRATEGY_ADQUISICIO;
    if (key.includes("cerca") || !key) return SF_STRATEGY_CERCA;
  }
  if ((vcpe === "PE" || vcpe === "VC") && key.startsWith("search fund")) {
    return raw ? STRATEGY_MAP.get(key) ?? raw : null;
  }

  return raw || null;
}

export function defaultCapitalCallStrategyForVcpe(vcpe) {
  if (vcpe === "RE") return "Fons Real Estate";
  if (vcpe === "SF") return SF_STRATEGY_CERCA;
  if (vcpe === "PC") return STRATEGY_PARTICIPADA_ALTRES;
  return "Fons Primari";
}
