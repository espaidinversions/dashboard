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

// Company strategies (Search Funds + Participades), in fixed display order.
export const COMPANY_STRATEGIES = [
  "Search Fund - Cerca",
  "Search Fund - Participada",
  "Participada (Altres)",
];

export const COMPANY_STRATEGY_LABELS = {
  "Search Fund - Cerca": "Cerca",
  "Search Fund - Participada": "Participada",
  "Participada (Altres)": "Altres",
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

/**
 * Collapse raw capital-call rows into one summary per fund, keeping only funds
 * whose resolved section is in `sections` (e.g. ["ALT"] or ["SF","PC"]).
 * Strategy = earliest-dated Compromís row's est; vintage = earliest Compromís
 * year; funds with no dated commitment are skipped.
 */
function summarizeFundsBySection(rawCC, fundMeta, { sections, vintageFallback = false }) {
  const source = Array.isArray(rawCC) ? rawCC : [];
  const metaList = Array.isArray(fundMeta) ? fundMeta : [];
  const keep = new Set(sections);

  const groups = new Map();
  for (const raw of source) {
    const routeId = makeFundRouteId(raw);
    if (!routeId) continue;
    if (!groups.has(routeId)) groups.set(routeId, []);
    groups.get(routeId).push(normalizeFundDetailRow(raw));
  }

  const funds = [];
  for (const rows of groups.values()) {
    const compromisRows = rows
      .filter((r) => r.cat === "Compromís" && r.data)
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
    let est = compromisRows.find((r) => r.est)?.est ?? null;
    let vintage = compromisRows
      .map((r) => Number(String(r.data).slice(0, 4)))
      .filter((y) => Number.isFinite(y))[0];

    // Companies rarely have a Compromís row — they are funded by a single Capital
    // Call. When enabled, fall back to the earliest dated Capital Call for strategy
    // and vintage so companies are not silently dropped from the matrix. ALT
    // vehicles never enable this, so their Compromís-based behavior is unchanged.
    if (vintageFallback && (est == null || vintage == null)) {
      const callRows = rows
        .filter((r) => r.cat === "Capital Call" && r.data)
        .sort((a, b) => String(a.data).localeCompare(String(b.data)));
      if (est == null) est = callRows.find((r) => r.est)?.est ?? null;
      if (vintage == null) {
        vintage = callRows
          .map((r) => Number(String(r.data).slice(0, 4)))
          .filter((y) => Number.isFinite(y))[0];
      }
    }

    if (!keep.has(estSection(est))) continue;
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

    funds.push({ id, est, vintage, calls, dist, tvpi, flows });
  }
  return funds;
}

/** Build the { vintages, strategies, cells, totals } cross-tab from fund summaries. */
function buildMatrixFromFunds(funds, strategies, asOfDate) {
  const vintages = [...new Set(funds.map((f) => f.vintage))].sort((a, b) => a - b);

  const cells = {};
  for (const vintage of vintages) {
    for (const strategy of strategies) {
      const inCell = funds.filter((f) => f.vintage === vintage && f.est === strategy);
      cells[`${vintage}|${strategy}`] = inCell.length ? computeCohort(inCell, asOfDate) : null;
    }
  }

  const byVintage = {};
  for (const vintage of vintages) {
    byVintage[vintage] = computeCohort(funds.filter((f) => f.vintage === vintage), asOfDate);
  }
  const byStrategy = {};
  for (const strategy of strategies) {
    byStrategy[strategy] = computeCohort(funds.filter((f) => f.est === strategy), asOfDate);
  }
  const grand = computeCohort(funds, asOfDate);

  return { vintages, strategies, cells, totals: { byVintage, byStrategy, grand } };
}

/**
 * Build the MOIC/IRR cohort matrix for the Alternatives (vehicle) funds.
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
  const funds = summarizeFundsBySection(rawCC, fundMeta, { sections: ["ALT"] });
  return buildMatrixFromFunds(funds, ALT_STRATEGIES, asOfDate);
}

/**
 * Build the MOIC/IRR cohort matrix for companies (Search Funds + Participades).
 * `excludeIds` drops acquired search funds from the SF set so they are not
 * counted as both a searcher and a participada (mirrors useDashboardData's
 * sfTx.filter(!actualCompanyIds.has(id))). Same output shape as buildAltCohortMatrix.
 */
export function buildCompanyCohortMatrix(
  rawCC,
  fundMeta,
  { excludeIds = new Set(), asOfDate = new Date().toISOString().slice(0, 10) } = {},
) {
  const all = summarizeFundsBySection(rawCC, fundMeta, { sections: ["SF", "PC"], vintageFallback: true });
  const funds = all.filter((f) => !(estSection(f.est) === "SF" && excludeIds.has(f.id)));
  return buildMatrixFromFunds(funds, COMPANY_STRATEGIES, asOfDate);
}
