/** @typedef {import("./publicMarketsTypes.js").PMPositionSnapshot} PMPositionSnapshot */
/** @typedef {import("./publicMarketsTypes.js").PMValuesByIsin} PMValuesByIsin */
/** @typedef {import("./publicMarketsTypes.js").PMValuePoint} PMValuePoint */

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
 * @returns {"caixa" | "ubs" | "creditSuisse" | "andbank" | "abel" | "jpmorgan" | "altres"}
 */
export function routeManagerFromCustodian(position = null) {
  const custodian = String(position?.custodian ?? "").trim();
  if (custodian === "CaixaBank") return "caixa";
  if (custodian === "UBS") return "ubs";
  if (custodian === "Credit Suisse") return "creditSuisse";
  if (custodian === "Andbank" || custodian === "WAM") return "andbank";
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
    if (!position?.isin) return;
    const isin = String(position.isin).trim();
    const custodian = String(position.custodian ?? "").trim();
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
  let unmappedTotal = 0;

  Object.entries(nestedValues ?? {}).forEach(([isin, byCustodian]) => {
    Object.entries(byCustodian ?? {}).forEach(([custodian, series]) => {
      const latest = latestSeriesValue(series);
      if (latest == null) return;

      total += latest;

      const meta =
        byKey.get(`${isin}||${String(custodian ?? "").trim()}`) ??
        byIsin.get(isin) ??
        { isin, custodian };

      const manager = managerRouter(meta, isin);
      if (manager) byManager[manager] = (byManager[manager] ?? 0) + latest;
      else unmappedTotal += latest;

      const tipus = String(meta?.tipus ?? "").trim();
      if (VALID_TIPUS.has(tipus)) byType[tipus] = (byType[tipus] ?? 0) + latest;
      else if (tipus) unmappedTotal += latest;
    });
  });

  if (import.meta.env.DEV) {
    const classified = (byType.RV ?? 0) + (byType.RF ?? 0);
    const gap = total - classified - unmappedTotal;
    if (Math.abs(gap) > 1) {
      console.warn(`[PM] byType gap: ${gap.toFixed(0)}€ unaccounted (total=${total.toFixed(0)}, RV=${(byType.RV ?? 0).toFixed(0)}, RF=${(byType.RF ?? 0).toFixed(0)}, unmapped=${unmappedTotal.toFixed(0)})`);
    }
  }

  return {
    total,
    byManager,
    byType,
    unmappedTotal,
  };
}
