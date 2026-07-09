import { xirr } from "../utils.js";
import { estSection } from "./capitalCallStrategyModel.js";
import { makeFundRouteId, normalizeFundDetailRow } from "./fundDetailModel.js";

// The four Alternatives strategies, in fixed display order. Matches the canonical
// `est` labels produced by normalizeCapitalCallStrategy (estSection === "ALT").
export const ALT_STRATEGIES = [
  "Fons Primari",
  "Fons Secundari",
  "Fons de Fons",
  "Fons de Coinversió",
];

export const ALT_STRATEGY_LABELS = {
  "Fons Primari": "Primari",
  "Fons Secundari": "Secundari",
  "Fons de Fons": "FoF",
  "Fons de Coinversió": "Coinversió",
};

const DIST_CATS = new Set(["Distribució", "Retorn Capital"]);

/** Cash flow rows that feed the money-weighted (XIRR) computation. */
function isFlowCat(cat) {
  return cat === "Capital Call" || DIST_CATS.has(cat);
}

/**
 * Reduce a group of funds to a pooled { moic, irr }, or null when no fund in the
 * group has a TVPI. MOIC is the capital-weighted average of TVPI; IRR is a single
 * XIRR over the union of the funds' dated flows plus one terminal residual value.
 * Mirrors the residual logic in computeFundIrrFromRows so cohort and per-fund
 * numbers stay consistent.
 */
function computeCohort(funds, asOfDate) {
  const withTvpi = funds.filter((f) => f.tvpi != null);
  if (withTvpi.length === 0) return null;

  const sumCalls = withTvpi.reduce((s, f) => s + f.calls, 0);
  const moic = sumCalls > 0
    ? withTvpi.reduce((s, f) => s + f.tvpi * f.calls, 0) / sumCalls
    : null;

  const flows = [];
  let residual = 0;
  for (const f of withTvpi) {
    for (const flow of f.flows) {
      flows.push({ date: flow.data, amount: -Number(flow.eur || 0) });
    }
    residual += Math.max(f.tvpi * f.calls - f.dist, 0);
  }
  if (residual > 0) flows.push({ date: asOfDate, amount: residual });

  return { moic, irr: xirr(flows) };
}

/** Collapse the raw capital-call rows into one summary per Alternatives fund. */
function summarizeAltFunds(rawCC, fundMeta) {
  const source = Array.isArray(rawCC) ? rawCC : [];
  const metaList = Array.isArray(fundMeta) ? fundMeta : [];

  const groups = new Map();
  for (const raw of source) {
    const routeId = makeFundRouteId(raw);
    if (!routeId) continue;
    if (!groups.has(routeId)) groups.set(routeId, []);
    groups.get(routeId).push(normalizeFundDetailRow(raw));
  }

  const funds = [];
  for (const rows of groups.values()) {
    // Single strategy per vehicle: classify by the commitment's declared est
    // (the earliest-dated Compromís row), not the arbitrary first row. Many ALT
    // vehicles carry mixed est across their call/distribution rows.
    const compromisRows = rows
      .filter((r) => r.cat === "Compromís" && r.data)
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
    const est = compromisRows.find((r) => r.est)?.est ?? null;
    if (estSection(est) !== "ALT") continue;

    // Vintage = earliest Compromís year; skip funds with no dated commitment.
    const vintage = compromisRows
      .map((r) => Number(String(r.data).slice(0, 4)))
      .filter((y) => Number.isFinite(y))[0];
    if (vintage == null) continue;

    const calls = rows
      .filter((r) => r.cat === "Capital Call")
      .reduce((s, r) => s + Number(r.eur || 0), 0);
    const dist = rows
      .filter((r) => DIST_CATS.has(r.cat))
      .reduce((s, r) => s + Math.abs(Number(r.eur || 0)), 0);
    const flows = rows.filter((r) => isFlowCat(r.cat) && r.data);

    const id = rows.find((r) => r.id)?.id ?? null;
    const name = rows[0]?.fons ?? null;
    const meta = metaList.find((m) => (id && m.id === id) || m.fons === name);
    const tvpi = meta?.tvpi ?? null;

    funds.push({ est, vintage, calls, dist, tvpi, flows });
  }
  return funds;
}

/**
 * Build the MOIC/IRR cohort matrix for the Alternatives funds.
 * @returns {{ vintages: number[], strategies: string[],
 *   cells: Record<string, {moic:number|null, irr:number|null}|null>,
 *   totals: { byVintage: Record<string, object|null>,
 *             byStrategy: Record<string, object|null>, grand: object|null } }}
 */
export function buildAltCohortMatrix(
  rawCC,
  fundMeta,
  asOfDate = new Date().toISOString().slice(0, 10),
) {
  const funds = summarizeAltFunds(rawCC, fundMeta);
  const vintages = [...new Set(funds.map((f) => f.vintage))].sort((a, b) => a - b);

  const cells = {};
  for (const vintage of vintages) {
    for (const strategy of ALT_STRATEGIES) {
      const inCell = funds.filter((f) => f.vintage === vintage && f.est === strategy);
      cells[`${vintage}|${strategy}`] = inCell.length ? computeCohort(inCell, asOfDate) : null;
    }
  }

  const byVintage = {};
  for (const vintage of vintages) {
    byVintage[vintage] = computeCohort(funds.filter((f) => f.vintage === vintage), asOfDate);
  }
  const byStrategy = {};
  for (const strategy of ALT_STRATEGIES) {
    byStrategy[strategy] = computeCohort(funds.filter((f) => f.est === strategy), asOfDate);
  }
  const grand = computeCohort(funds, asOfDate);

  return {
    vintages,
    strategies: ALT_STRATEGIES,
    cells,
    totals: { byVintage, byStrategy, grand },
  };
}
