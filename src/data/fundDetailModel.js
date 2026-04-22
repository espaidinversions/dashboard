import { slugify } from "../utils.js";

export function makeFundRouteId(row) {
  return row?.id ?? slugify(row?.fons ?? "");
}

export function findFundRowsByRouteId(rows, routeId) {
  const decodedId = decodeURIComponent(routeId ?? "");
  return (Array.isArray(rows) ? rows : []).filter(
    (row) => (row?.id && row.id === decodedId) || slugify(row?.fons) === decodedId,
  );
}

export function buildFundDetailSnapshot(rawCC, fundMeta, routeId) {
  const txs = findFundRowsByRouteId(rawCC, routeId);
  if (txs.length === 0) return null;

  const fundName = txs[0].fons;
  const fundId = txs[0].id ?? null;
  const vcpe = txs[0].vcpe;
  const est = txs[0].est;

  const compromis = txs.filter((row) => row.cat === "Compromís").reduce((sum, row) => sum + row.eur, 0);
  const calls = txs.filter((row) => row.cat === "Capital Call").reduce((sum, row) => sum + row.eur, 0);
  const dist = txs
    .filter((row) => row.cat === "Distribució" || row.cat === "Retorn Capital")
    .reduce((sum, row) => sum + Math.abs(row.eur), 0);
  const net = dist - calls;
  const utilPct = compromis > 0 ? `${(calls / compromis * 100).toFixed(1)}%` : null;

  const meta = (Array.isArray(fundMeta) ? fundMeta : []).find(
    (row) => (fundId && row.id === fundId) || row.fons === fundName,
  );
  const tvpiFund = meta?.tvpi ?? null;
  const dpiFund = calls > 0 ? dist / calls : 0;
  const rvpiFund = tvpiFund != null ? tvpiFund - dpiFund : null;
  const txLog = [...txs].sort((a, b) => b.data.localeCompare(a.data));

  return {
    txs,
    txLog,
    fundName,
    fundId,
    vcpe,
    est,
    compromis,
    calls,
    dist,
    net,
    utilPct,
    tvpiFund,
    dpiFund,
    rvpiFund,
  };
}
