import { slugify, xirr } from "../utils.js";
import {
  inferCapitalCallCategoryFromTipus,
  normalizeCapitalCallSignedAmount,
  normalizeCapitalCallTipus,
} from "./capitalCallTipusModel.js";
import { normalizeCapitalCallStrategy } from "./capitalCallStrategyModel.js";

export function makeFundRouteId(row) {
  if (row?.id && row?.vehicleTipus) return `${row.vehicleTipus}:${row.id}`;
  return row?.id ?? slugify(row?.fons ?? "");
}

export function findFundRowsByRouteId(rows, routeId) {
  const decodedId = decodeURIComponent(routeId ?? "");
  const match = /^([A-Z]{2,3}):(.*)$/u.exec(decodedId);
  const source = Array.isArray(rows) ? rows : [];
  if (match) {
    const [, vehicleTipus, entityId] = match;
    return source.filter((row) => row?.id === entityId && row?.vehicleTipus === vehicleTipus);
  }

  const hits = source.filter(
    (row) => (row?.id && row.id === decodedId) || slugify(row?.fons) === decodedId,
  );
  if (hits.length === 0) return [];

  const nonCompanyHits = hits.filter((row) => row?.vehicleTipus !== "PC");
  return nonCompanyHits.length > 0 ? nonCompanyHits : hits;
}

function normalizeFundDetailRow(row) {
  const tipus = normalizeCapitalCallTipus(row?.tipus);
  const eur = normalizeCapitalCallSignedAmount(tipus, row?.eur);
  return {
    ...row,
    tipus,
    eur,
    cat: row?.cat ?? inferCapitalCallCategoryFromTipus(tipus, eur),
    est: normalizeCapitalCallStrategy(row?.est, row?.vehicleTipus, row),
  };
}

export function computeFundIrrFromRows(txs, tvpi, asOfDate = new Date().toISOString().slice(0, 10)) {
  const sourceRows = (Array.isArray(txs) ? txs : []).map(normalizeFundDetailRow);
  const calls = sourceRows
    .filter((row) => row.cat === "Capital Call")
    .reduce((sum, row) => sum + Number(row.eur || 0), 0);
  const dist = sourceRows
    .filter((row) => row.cat === "Distribució" || row.cat === "Retorn Capital")
    .reduce((sum, row) => sum + Math.abs(Number(row.eur || 0)), 0);
  const residualValue = tvpi != null ? Math.max((tvpi * calls) - dist, 0) : null;
  const irrCashFlows = sourceRows
    .filter((row) => row.cat === "Capital Call" || row.cat === "Distribució" || row.cat === "Retorn Capital")
    .map((row) => ({ date: row.data, amount: -Number(row.eur || 0) }));
  if (residualValue && residualValue > 0) {
    irrCashFlows.push({ date: asOfDate, amount: residualValue });
  }
  return xirr(irrCashFlows);
}

// Per-fund lifetime DPI/TVPI keyed by fund name, using the SAME calls/dist logic
// and fund_meta matching as buildFundDetailSnapshot so table values match the fund page.
export function computeFundMetricsByName(rawCC, fundMeta) {
  const source = Array.isArray(rawCC) ? rawCC : [];
  const byFund = new Map();
  for (const raw of source) {
    const name = raw?.fons;
    if (!name) continue;
    const row = normalizeFundDetailRow(raw);
    if (!byFund.has(name)) byFund.set(name, { calls: 0, dist: 0, id: raw?.id ?? null });
    const m = byFund.get(name);
    if (row.cat === "Capital Call") m.calls += Number(row.eur) || 0;
    else if (row.cat === "Distribució" || row.cat === "Retorn Capital") m.dist += Math.abs(Number(row.eur) || 0);
  }
  const metaList = Array.isArray(fundMeta) ? fundMeta : [];
  const result = {};
  for (const [name, m] of byFund) {
    const meta = metaList.find((r) => (m.id && r.id === m.id) || r.fons === name);
    result[name] = {
      dpi: m.calls > 0 ? m.dist / m.calls : null,
      tvpi: meta?.tvpi ?? null,
    };
  }
  return result;
}

export function buildFundDetailSnapshot(rawCC, fundMeta, routeId) {
  const txs = findFundRowsByRouteId(rawCC, routeId).map(normalizeFundDetailRow);
  if (txs.length === 0) return null;

  const fundName = txs[0].fons;
  const fundId = txs[0].id ?? null;
  const vehicleTipus = txs[0].vehicleTipus;
  const est = txs[0].est;

  const compromis = txs.filter((row) => row.cat === "Compromís").reduce((sum, row) => sum + row.eur, 0);
  const calls = txs.filter((row) => row.cat === "Capital Call").reduce((sum, row) => sum + row.eur, 0);
  const dist = txs
    .filter((row) => row.cat === "Distribució" || row.cat === "Retorn Capital")
    .reduce((sum, row) => sum + Math.abs(row.eur), 0);
  const recallablePool = txs.reduce((sum, row) => {
    if (row.cat === "Distribució" && row.recallable) {
      return sum + Math.abs(Number(row.recallable));
    }
    if (row.cat === "Capital Call" && row.from_recallable) {
      return sum - Math.abs(Number(row.from_recallable));
    }
    return sum;
  }, 0);
  const net = dist - calls;
  const utilPct = compromis > 0 ? `${(calls / compromis * 100).toFixed(1)}%` : null;

  const meta = (Array.isArray(fundMeta) ? fundMeta : []).find(
    (row) => (fundId && row.id === fundId) || row.fons === fundName,
  );
  const tvpiFund = meta?.tvpi ?? null;
  const dpiFund = calls > 0 ? dist / calls : 0;
  const rvpiFund = tvpiFund != null ? tvpiFund - dpiFund : null;
  const irrFund = meta?.irr ?? computeFundIrrFromRows(txs, tvpiFund);
  const txLog = [...txs].sort((a, b) => b.data.localeCompare(a.data));

  return {
    txs,
    txLog,
    fundName,
    fundId,
    vehicleTipus,
    est,
    compromis,
    calls,
    dist,
    net,
    utilPct,
    tvpiFund,
    dpiFund,
    rvpiFund,
    irrFund,
    recallablePool,
  };
}
