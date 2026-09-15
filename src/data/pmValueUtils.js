/** @typedef {import("./publicMarketsTypes.js").PMPositionSnapshot} PMPositionSnapshot */
/** @typedef {import("./publicMarketsTypes.js").PMValuesByIsin} PMValuesByIsin */
/** @typedef {import("./publicMarketsTypes.js").PMValuePoint} PMValuePoint */
import { canonicalPmCustodian } from "./pmClassification.js";
import { normalizeIsin } from "./pmIdentity.js";

const VALID_TIPUS = new Set(["RV", "RF"]);

/**
 * @param {PMValuePoint[]} series
 * @returns {number | null}
 */
function latestSeriesValue(series = []) {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const value = Number(series[i]?.value);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

/**
 * @param {PMPositionSnapshot | null} position
 * @returns {"caixa" | "ubs" | "andbank" | "abel" | "jpmorgan" | "altres"}
 */
export function routeManagerFromCustodian(position = null) {
  const custodian = canonicalPmCustodian(position?.custodian);
  if (custodian === "CaixaBank") return "caixa";
  if (custodian === "UBS") return "ubs";
  if (custodian === "Andbank") return "andbank";
  if (custodian === "JPMorgan") return "jpmorgan";
  if (custodian === "Bankinter" || custodian === "Interactive Brokers") return "abel";
  return "altres";
}

/**
 * @param {PMPositionSnapshot[]} positions
 * @returns {{ byKey: Map<string, PMPositionSnapshot>, byIsin: Map<string, PMPositionSnapshot> }}
 */
function buildPositionLookup(positions = []) {
  const byKey = new Map();
  const byIsin = new Map();
  (positions ?? []).forEach(position => {
    const isin = normalizeIsin(position?.isin);
    if (!isin) return;
    const custodian = canonicalPmCustodian(position.custodian);
    byKey.set(`${isin}||${custodian}`, position);
    if (!byIsin.has(isin)) byIsin.set(isin, position);
  });
  return { byKey, byIsin };
}

/**
 * @param {PMValuesByIsin} nestedValues
 * @param {PMPositionSnapshot[]} positions
 * @param {{ managerRouter?: (position: PMPositionSnapshot | { isin?: string | null; custodian?: string | null; tipus?: string | null }, isin?: string) => string | null }} [options]
 * @returns {{ total: number, byManager: Record<string, number>, byType: Record<string, number>, unmappedTotal: number }}
 */
export function summarizeLatestPmValues(
  nestedValues = {},
  positions = [],
  { managerRouter = routeManagerFromCustodian } = {}
) {
  const { byKey, byIsin } = buildPositionLookup(positions);
  const byManager = {};
  const byType = {};
  let total = 0;
  // Two independent reconciliation dimensions — they must NOT share an
  // accumulator (a position can be unrouted by manager AND by type, which would
  // otherwise double-count its value).
  let unmappedByManager = 0;
  let unmappedByType = 0;

  Object.entries(nestedValues ?? {}).forEach(([rawIsin, byCustodian]) => {
    const isin = normalizeIsin(rawIsin);
    Object.entries(byCustodian ?? {}).forEach(([rawCustodian, series]) => {
      const latest = latestSeriesValue(series);
      if (latest == null) return;

      total += latest;

      const custodian = canonicalPmCustodian(rawCustodian);
      const exact = byKey.get(`${isin}||${custodian}`);
      const isinMeta = byIsin.get(isin);
      // Fall back to any position with the same ISIN for tipus/nom, but keep
      // THIS series' custodian so value routes to the correct manager/bank.
      const meta = exact ?? (isinMeta ? { ...isinMeta, custodian } : { isin, custodian });

      const manager = managerRouter(meta, isin);
      if (manager) byManager[manager] = (byManager[manager] ?? 0) + latest;
      else unmappedByManager += latest;

      const tipus = String(meta?.tipus ?? "").trim();
      if (VALID_TIPUS.has(tipus)) byType[tipus] = (byType[tipus] ?? 0) + latest;
      else unmappedByType += latest;
    });
  });

  if (typeof import.meta.env !== "undefined" && import.meta.env.DEV) {
    const classified = (byType.RV ?? 0) + (byType.RF ?? 0);
    const gap = total - classified - unmappedByType;
    if (Math.abs(gap) > 1) {
      console.warn(`[PM] byType gap: ${gap.toFixed(0)}€ unaccounted (total=${total.toFixed(0)}, RV=${(byType.RV ?? 0).toFixed(0)}, RF=${(byType.RF ?? 0).toFixed(0)}, unmappedByType=${unmappedByType.toFixed(0)})`);
    }
  }

  return {
    total,
    byManager,
    byType,
    unmappedByManager,
    unmappedByType,
    // Backwards-compatible alias — the classification (byType) gap.
    unmappedTotal: unmappedByType,
  };
}

/**
 * Latest PM summary including WAM positions (which have no PM_VALUES entries).
 * @param {PMValuesByIsin} nestedValues
 * @param {PMPositionSnapshot[]} positions
 * @param {PMPositionSnapshot[]} [wamPositions]
 * @param {{ managerRouter?: Function }} [options]
 * @returns {{ total: number, byManager: Record<string,number>, byType: Record<string,number>, unmappedTotal: number }}
 */
export function summarizeLatestPmValuesWithWam(nestedValues = {}, positions = [], wamPositions = [], options = {}) {
  const summary = summarizeLatestPmValues(nestedValues, positions, options);
  for (const pos of wamPositions ?? []) {
    const v = pos?.valorMercat ?? 0;
    if (!v) continue;
    summary.total += v;
    summary.byManager.andbank = (summary.byManager.andbank ?? 0) + v;
    const t = String(pos?.tipus ?? "").trim();
    if (t) summary.byType[t] = (summary.byType[t] ?? 0) + v;
  }
  return summary;
}
