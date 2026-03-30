import { useState, useMemo, useCallback } from "react";
import { FY_LIST } from "../config.js";
import { fmtM, fmtS } from "../utils.js";

export function useCapitalCallsFilters() {
  const [fFy,   setFFy]   = useState("Tots");
  const [fEst,  setFEst]  = useState("Tots");
  const [fCat,  setFCat]  = useState("Tots");
  const [fVcpe, setFVcpe] = useState(new Set(["PE", "VC", "RE"]));
  const [txPage, setTxPage] = useState(0);
  const [txSearch, setTxSearch] = useState("");

  const clearFilters = useCallback(() => {
    setFFy("Tots");
    setFEst("Tots");
    setFCat("Tots");
    setFVcpe(new Set(["PE", "VC", "RE"]));
    setTxSearch("");
    setTxPage(0);
  }, []);

  return {
    fFy, setFFy,
    fEst, setFEst,
    fCat, setFCat,
    fVcpe, setFVcpe,
    txPage, setTxPage,
    txSearch, setTxSearch,
    clearFilters,
  };
}

export function useCapitalCallsData(rawCC, excluded, filters, fundMeta) {
  const { fFy, fEst, fCat, fVcpe, txSearch } = filters;

  return useMemo(() => {
    // Base transactions: exclude Compromís, exclude excluded funds
    const baseTx = rawCC.filter(r =>
      r.cat !== "Compromís" && !excluded.has(r.fons)
    );

    // Global KPIs
    const gCompr = rawCC
      .filter(r => r.cat === "Compromís" && !excluded.has(r.fons))
      .reduce((s, r) => s + r.eur, 0);
    const gCalls = baseTx.filter(r => r.cat === "Capital Call").reduce((s, r) => s + r.eur, 0);
    const gDist  = baseTx.filter(r => r.cat === "Distribució" || r.cat === "Retorn Capital").reduce((s, r) => s + Math.abs(r.eur), 0);
    const gNet   = gDist - gCalls;

    // Filtered transactions (used by all tabs)
    const filtered = baseTx.filter(r => {
      if (fFy !== "Tots" && r.fy !== fFy) return false;
      if (fEst !== "Tots" && r.est !== fEst) return false;
      if (fCat !== "Tots" && r.cat !== fCat) return false;
      if (!fVcpe.has(r.vcpe)) return false;
      if (txSearch) {
        const s = txSearch.toLowerCase();
        if (!r.fons.toLowerCase().includes(s) &&
            !r.tipus.toLowerCase().includes(s) &&
            !r.cat.toLowerCase().includes(s)) return false;
      }
      return true;
    });

    // Aggregation helpers
    const fCalls = filtered.filter(r => r.cat === "Capital Call").reduce((s, r) => s + r.eur, 0);
    const fDist  = filtered.filter(r => r.cat === "Distribució" || r.cat === "Retorn Capital").reduce((s, r) => s + Math.abs(r.eur), 0);

    // By FY
    const byFy = FY_LIST.map(fy => {
      const rows = filtered.filter(r => r.fy === fy);
      const calls = rows.filter(r => r.cat === "Capital Call").reduce((s, r) => s + r.eur, 0);
      const dist  = rows.filter(r => r.cat === "Distribució").reduce((s, r) => s + Math.abs(r.eur), 0);
      const retorn = rows.filter(r => r.cat === "Retorn Capital").reduce((s, r) => s + Math.abs(r.eur), 0);
      return { fy, "Capital Call": +calls.toFixed(0), "Distribució": +dist.toFixed(0), "Retorn Capital": +retorn.toFixed(0) };
    }).filter(r => r["Capital Call"] || r["Distribució"] || r["Retorn Capital"]);

    // By VCPE
    const vcpeMap = {};
    filtered.filter(r => r.cat === "Capital Call").forEach(r => {
      vcpeMap[r.vcpe] = (vcpeMap[r.vcpe] || 0) + r.eur;
    });
    const byVcpe = Object.entries(vcpeMap).map(([name, value]) => ({ name, value: +value.toFixed(0) }));

    // By Estructura
    const estMap = {};
    filtered.filter(r => r.cat === "Capital Call" && r.est).forEach(r => {
      estMap[r.est] = (estMap[r.est] || 0) + r.eur;
    });
    const byEst = Object.entries(estMap).map(([name, value]) => ({ name, value: +value.toFixed(0) }));

    // Per-fund data
    const allFons = [...new Set(filtered.map(r => r.fons))].sort();
    const FONS_MAP2 = allFons.map(fons => {
      const rows = filtered.filter(r => r.fons === fons);
      const calls  = rows.filter(r => r.cat === "Capital Call").reduce((s, r) => s + r.eur, 0);
      const dist   = rows.filter(r => r.cat === "Distribució").reduce((s, r) => s + Math.abs(r.eur), 0);
      const retorn = rows.filter(r => r.cat === "Retorn Capital").reduce((s, r) => s + Math.abs(r.eur), 0);
      const compr  = rawCC.filter(r => r.fons === fons && r.cat === "Compromís").reduce((s, r) => s + r.eur, 0);
      const rebut  = calls > 0 ? dist / calls : 0;
      const net    = dist + retorn - calls;
      const vcpe   = rows[0]?.vcpe;
      const est    = rows[0]?.est;
      const meta   = fundMeta?.find(m => m.fons === fons);
      return { fons, compr, calls, dist, retorn, rebut, net, vcpe, est, tvpi: meta?.tvpi };
    });

    return {
      baseTx,
      gCompr, gCalls, gDist, gNet,
      filtered,
      fCalls, fDist,
      byFy, byVcpe, byEst,
      FONS_MAP2,
    };
  }, [rawCC, excluded, fFy, fEst, fCat, fVcpe, txSearch, fundMeta]);
}
