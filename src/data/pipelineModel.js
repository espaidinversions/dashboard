import { normalizeCapitalCallStrategy } from "./capitalCallStrategyModel.js";

export const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function genMonthOpts(months = 36) {
  const now = new Date();
  const opts = [""];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    opts.push(`${MON[d.getMonth()]} ${d.getFullYear()}`);
  }
  return opts;
}

export const MONTHS_OPTS = genMonthOpts(36);

export function normalizePipelineStrategy(value) {
  // Reuse the canonical strategy normalizer, but map to the pipeline's labels.
  const canonical = normalizeCapitalCallStrategy(value, "PE", null);
  if (canonical === "Fons Primari") return "Fons primari";
  if (canonical === "Fons Secundari") return "Fons secundaris";
  if (canonical === "Fons de Fons") return "Fons de fons";
  if (canonical === "Fons de Coinversió") return "Coinversions";
  return String(value ?? "").trim() || "";
}
