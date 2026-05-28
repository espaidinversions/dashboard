import { useMemo } from "react";
import { estSection } from "../../data/capitalCallStrategyModel.js";
import { FY_LIST, MESOS } from "../../config.js";

/**
 * Derives all transaction-level computed values from raw dashboard data +
 * filter state. Extracted from Dashboard.jsx to keep the God Component thin.
 *
 * Inputs mirror the exact memo dependency arrays that existed inline —
 * dep arrays are intentionally unchanged.
 */
export function useTransactionDerivedData({
  TRANSACTIONS,
  COMPROMISOS,
  pcTx,
  pcCompr,
  searcherTx,
  searcherCompr,
  excluded,
  fFy,
  fVcpe,
  fEst,
  fTipus,
  txSearch,
  globalSearch,
  section,
  sortFons,
  sortFonsDir,
  ccChartF,
}) {
  const baseTx = useMemo(
    () => TRANSACTIONS.filter((r) => !excluded.has(r.fons) && estSection(r.est) === "ALT"),
    [TRANSACTIONS, excluded],
  );

  const baseCompr = useMemo(
    () => COMPROMISOS.filter((r) => !excluded.has(r.fons) && estSection(r.est) === "ALT"),
    [COMPROMISOS, excluded],
  );

  // Alternatives (Mercats Privats) should represent fund vehicles (PE/VC).
  // SF/PC have their own dedicated sections and including them here makes
  // "Compromis vs Capital Cridat" look almost fully utilized (misleading).
  const allAltTx = useMemo(
    () => TRANSACTIONS.filter((r) => !excluded.has(r.fons) && estSection(r.est) === "ALT"),
    [TRANSACTIONS, excluded],
  );

  const allAltCompr = useMemo(
    () => COMPROMISOS.filter((r) => !excluded.has(r.fons) && estSection(r.est) === "ALT"),
    [COMPROMISOS, excluded],
  );

  // Company-like private markets rows (PC + active/unacquired SF searchers).
  const altCompanyTx = useMemo(
    () => [...pcTx, ...searcherTx].filter((r) => !excluded.has(r.fons)),
    [pcTx, searcherTx, excluded],
  );

  const altCompanyCompr = useMemo(
    () => [...pcCompr, ...searcherCompr].filter((r) => !excluded.has(r.fons)),
    [pcCompr, searcherCompr, excluded],
  );

  const altAllTx = useMemo(() => [...allAltTx, ...altCompanyTx], [allAltTx, altCompanyTx]);
  const altAllCompr = useMemo(() => [...allAltCompr, ...altCompanyCompr], [allAltCompr, altCompanyCompr]);

  const filtered = useMemo(() => {
    let dat = baseTx;
    if (fFy !== "Tots") dat = dat.filter((r) => r.fy === fFy);
    if (fVcpe.size > 0) dat = dat.filter((r) => fVcpe.has(r.vehicleTipus));
    if (fEst !== "Tots") dat = dat.filter((r) => r.est === fEst);
    if (fTipus !== "Tots") dat = dat.filter((r) => r.tipus === fTipus);
    if (txSearch.trim()) {
      const q = txSearch.trim().toLowerCase();
      dat = dat.filter(
        (r) =>
          (r.fons || "").toLowerCase().includes(q) ||
          (r.tipus || "").toLowerCase().includes(q) ||
          (r.cat || "").toLowerCase().includes(q),
      );
    }
    if (section === "alternatives" && globalSearch.trim()) {
      const q = globalSearch.trim().toLowerCase();
      dat = dat.filter((r) => (r.fons || "").toLowerCase().includes(q));
    }
    return dat;
  }, [baseTx, fFy, fVcpe, fEst, fTipus, txSearch, globalSearch, section]);

  const fCalls = useMemo(
    () => filtered.filter((r) => r.cat === "Capital Call").reduce((s, r) => s + r.eur, 0),
    [filtered],
  );

  const fDist = useMemo(
    () =>
      filtered
        .filter((r) => r.cat === "Distribució" || r.cat === "Retorn Capital")
        .reduce((s, r) => s + Math.abs(r.eur), 0),
    [filtered],
  );

  const byFy = useMemo(
    () =>
      FY_LIST.map((fy) => {
        const rows = filtered.filter((r) => r.fy === fy);
        const calls = rows.filter((r) => r.cat === "Capital Call").reduce((s, r) => s + r.eur, 0);
        const dist = rows.filter((r) => r.cat === "Distribució" || r.cat === "Retorn Capital").reduce((s, r) => s + Math.abs(r.eur), 0);
        return {
          fy: fy.replace("FY ", ""),
          "Capital Call": +calls.toFixed(0),
          "Distribucions": +dist.toFixed(0),
        };
      }).filter((r) => r["Capital Call"] || r["Distribucions"]),
    [filtered],
  );

  const byMes = useMemo(() => {
    const src = fFy !== "Tots" ? filtered : filtered.filter((r) => r.any >= 2023);
    const m = {};
    src.forEach((r) => {
      const k = `${r.any}-${String(r.mes).padStart(2, "0")}`;
      if (!m[k])
        m[k] = {
          mes: k,
          label: `${MESOS[r.mes] || ""} ${r.any}`,
          "Capital Call": 0,
          "Distribucions": 0,
        };
      if (r.cat === "Capital Call") m[k]["Capital Call"] += r.eur;
      if (r.cat === "Distribució" || r.cat === "Retorn Capital") m[k]["Distribucions"] += Math.abs(r.eur);
    });
    return Object.values(m).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [filtered, fFy]);

  const byVcpe = useMemo(() => {
    const m = {};
    filtered.filter((r) => r.cat === "Capital Call").forEach((r) => {
      m[r.vehicleTipus] = (m[r.vehicleTipus] || 0) + r.eur;
    });
    const tot = Object.values(m).reduce((s, v) => s + v, 0);
    return Object.entries(m).map(([name, value]) => ({
      name,
      value: +value.toFixed(0),
      pct: ((value / tot) * 100).toFixed(1),
    }));
  }, [filtered]);

  const byEst = useMemo(() => {
    const m = {};
    filtered
      .filter((r) => r.cat === "Capital Call" && r.est)
      .forEach((r) => {
        m[r.est] = (m[r.est] || 0) + r.eur;
      });
    const tot = Object.values(m).reduce((s, v) => s + v, 0);
    return Object.entries(m).map(([name, value]) => ({
      name,
      value: +value.toFixed(0),
      pct: ((value / tot) * 100).toFixed(1),
    }));
  }, [filtered]);

  const FONS_MAP2 = useMemo(() => {
    const m = {};
    baseCompr.forEach((r) => {
      m[r.id ?? r.fons] = {
        id: r.id ?? null,
        fons: r.fons,
        compr: r.eur,
        vehicleTipus: r.vehicleTipus,
        est: r.est,
        calls: 0,
        dist: 0,
        retorn: 0,
      };
    });
    baseTx.forEach((r) => {
      const key = r.id ?? r.fons;
      if (!m[key])
        m[key] = {
          id: r.id ?? null,
          fons: r.fons,
          compr: 0,
          vehicleTipus: r.vehicleTipus,
          est: r.est,
          calls: 0,
          dist: 0,
          retorn: 0,
        };
      if (r.cat === "Capital Call") m[key].calls += r.eur;
      if (r.cat === "Distribució") m[key].dist += Math.abs(r.eur);
      if (r.cat === "Retorn Capital") m[key].retorn += Math.abs(r.eur);
    });
    return Object.values(m);
  }, [baseCompr, baseTx]);

  const fonsFiltered = useMemo(() => {
    let fl = [...FONS_MAP2];
    if (fVcpe.size > 0) fl = fl.filter((f) => fVcpe.has(f.vehicleTipus));
    if (fEst !== "Tots") fl = fl.filter((f) => f.est === fEst);
    if (ccChartF) {
      if (ccChartF.type === "vcpe") fl = fl.filter((f) => f.vehicleTipus === ccChartF.value);
      if (ccChartF.type === "est") fl = fl.filter((f) => f.est === ccChartF.value);
      if (ccChartF.type === "fy")
        fl = fl.filter(
          (f) =>
            baseTx.filter(
              (r) => r.fons === f.fons && r.fy === "FY " + ccChartF.value && r.cat === "Capital Call",
            ).length > 0,
        );
    }
    const dir = sortFonsDir === "asc" ? 1 : -1;
    return [...fl].sort((a, b) => {
      if (sortFons === "fons") return dir * a.fons.localeCompare(b.fons);
      if (sortFons === "compr") return dir * (a.compr - b.compr);
      if (sortFons === "calls") return dir * (a.calls - b.calls);
      if (sortFons === "pct")
        return dir * ((a.compr > 0 ? a.calls / a.compr : 0) - (b.compr > 0 ? b.calls / b.compr : 0));
      if (sortFons === "dist") return dir * (a.dist - b.dist);
      if (sortFons === "retorn") return dir * (a.retorn - b.retorn);
      if (sortFons === "rebut") return dir * (a.dist + a.retorn - (b.dist + b.retorn));
      if (sortFons === "net")
        return dir * (a.dist + a.retorn - a.calls - (b.dist + b.retorn - b.calls));
      if (sortFons === "vcpe") return dir * (a.vehicleTipus ?? "").localeCompare(b.vehicleTipus ?? "");
      if (sortFons === "est") return dir * a.est.localeCompare(b.est);
      return 0;
    });
  }, [FONS_MAP2, fVcpe, fEst, sortFons, sortFonsDir, ccChartF, baseTx]);

  return {
    baseTx,
    baseCompr,
    allAltTx,
    allAltCompr,
    altCompanyTx,
    altCompanyCompr,
    altAllTx,
    altAllCompr,
    filtered,
    fCalls,
    fDist,
    byFy,
    byMes,
    byVcpe,
    byEst,
    FONS_MAP2,
    fonsFiltered,
  };
}
