import { estSection, isCompanyEst } from "./capitalCallStrategyModel.js";
import { normalizeCapitalCallTipus } from "./capitalCallTipusModel.js";

export const PM_TX_MONTHS_SHORT = ["","Gen","Feb","Mar","Abr","Mai","Jun","Jul","Ago","Set","Oct","Nov","Des"];

// Legacy non-cash rows that should not distort "committed vs called" KPIs.
export const EXCLUDED_KPI_TIPUS = new Set([
  "Transferència Participacions",
  "Conversió Participacions",
]);

// Classify by the resolved "Tipus de Vehicle" (est): fons → vehicles,
// participades / search funds → companies. This follows vehicle_est rather
// than the legacy PE/VC vehicle_tipus.
export const isCompanyRow = (row) => isCompanyEst(row?.est);

export const isExcludedKpiRow = (row) => EXCLUDED_KPI_TIPUS.has(normalizeCapitalCallTipus(row?.tipus));
export const isAportacio = (row) => normalizeCapitalCallTipus(row?.tipus) === "Aportació";

// Enforce a single "Tipus de Vehicle" per NIF (= row.id) in the transaction register.
// Search Funds can legitimately change phase (cerca vs participada), so skip SF.
export function computeCanonicalEstByNif(allRows) {
  const countsById = new Map(); // id -> Map(est -> count)
  const lastSeenById = new Map(); // id -> { est, data }

  for (const row of allRows) {
    const est = String(row?.est ?? "").trim();
    if (!est) continue;
    // Search Funds legitimately change phase (cerca vs participada), so leave
    // their est untouched. Unclassified rows are skipped too. Everything else
    // (fons, real estate, participades) is canonicalized to one est per NIF.
    const section = estSection(est);
    if (section === "SF" || section == null) continue;
    const id = String(row?.id ?? "").trim();
    if (!id) continue;

    if (!countsById.has(id)) countsById.set(id, new Map());
    const estCounts = countsById.get(id);
    estCounts.set(est, (estCounts.get(est) ?? 0) + 1);

    const data = String(row?.data ?? "").slice(0, 10);
    const prev = lastSeenById.get(id);
    if (!prev || (data && data >= prev.data)) {
      lastSeenById.set(id, { est, data: data || "" });
    }
  }

  const canonical = new Map();
  for (const [id, estCounts] of countsById.entries()) {
    let best = null;
    let bestCount = -1;
    for (const [est, count] of estCounts.entries()) {
      if (count > bestCount) { best = est; bestCount = count; }
    }
    // Tie-breaker: if counts are equal across strategies, prefer the most recent transaction's est.
    const last = lastSeenById.get(id);
    if (last && last.est) {
      let bestIsTied = false;
      if (best != null) {
        const bestValue = estCounts.get(best) ?? 0;
        for (const [est, count] of estCounts.entries()) {
          if (est !== best && count === bestValue) { bestIsTied = true; break; }
        }
      }
      if (bestIsTied) best = last.est;
    }
    if (best) canonical.set(id, best);
  }
  return canonical;
}

export function buildTxChartData(visibleTx) {
  const map = new Map();
  visibleTx.forEach((row) => {
    const month = String(row?.data ?? "").slice(0, 7);
    const match = month.match(/^(\d{4})-(\d{2})$/);
    if (!match) return;
    if (!map.has(month)) {
      map.set(month, {
        label: `${PM_TX_MONTHS_SHORT[Number(match[2])]} '${match[1].slice(2)}`,
        CapitalCalls: 0,
        Retorns: 0,
      });
    }
    const entry = map.get(month);
    // Strict category accounting: Compromis is not a cash flow and must not be counted as a call.
    if (row.cat === "Capital Call" && isAportacio(row) && !isExcludedKpiRow(row)) entry.CapitalCalls += Math.abs(row.eur ?? 0);
    if (row.cat === "Distribució" || row.cat === "Retorn Capital") entry.Retorns += Math.abs(row.eur ?? 0);
  });
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
}
