import { useMemo } from "react";

// Derives company operating metrics from a quarters array:
// LTM aggregates, annual aggregation, rolling-LTM quarterly series, and CAGRs.
export function useCompanyMetrics(quarters = []) {
  // LTM: last 4 actual quarters
  const ltm = useMemo(() => {
    if (quarters.length === 0) return null;
    const withActuals = quarters.filter(q => q.rev != null || q.ebitda != null || q.dfn != null);
    const last4 = withActuals.slice(-4);
    const sum = key => last4.reduce((s, q) => s + (q[key] ?? 0), 0);
    return { rev: sum("rev"), ebitda: sum("ebitda"), dfn: sum("dfn"), n: last4.length };
  }, [quarters]);

  // Annual aggregation: flows summed, dfn takes last Q (stock)
  const annualData = useMemo(() => {
    if (quarters.length === 0) return [];
    const map = new Map();
    quarters.forEach(q => {
      const year = q.q.split(" ")[1];
      if (!map.has(year)) map.set(year, { q: year });
      const e = map.get(year);
      if (q.rev          != null) e.rev          = (e.rev          ?? 0) + q.rev;
      if (q.ebitda       != null) e.ebitda        = (e.ebitda        ?? 0) + q.ebitda;
      if (q.dfn          != null) e.dfn           = q.dfn;
      if (q.revBudget    != null) e.revBudget     = (e.revBudget     ?? 0) + q.revBudget;
      if (q.ebitdaBudget != null) e.ebitdaBudget  = (e.ebitdaBudget ?? 0) + q.ebitdaBudget;
      if (q.dfnBudget    != null) e.dfnBudget     = q.dfnBudget;
    });
    return Array.from(map.values()).map(e => ({
      ...e,
      ebitdaMarginPct: (e.ebitda != null && e.rev != null && e.rev !== 0)
        ? (e.ebitda / e.rev) * 100 : null,
    }));
  }, [quarters]);

  // Quarterly + rolling LTM + per-period EBITDA margin
  const quarterlyWithLTM = useMemo(() => {
    const actuals = quarters.filter(q => q.rev != null || q.ebitda != null);
    return quarters.map(q => {
      const base = {
        ...q,
        ebitdaMarginPct: (q.ebitda != null && q.rev != null && q.rev !== 0)
          ? (q.ebitda / q.rev) * 100 : null,
      };
      const ai = actuals.findIndex(a => a.q === q.q);
      if (ai < 3) return base;
      const last4 = actuals.slice(ai - 3, ai + 1);
      const sum = key => last4.every(a => a[key] != null) ? last4.reduce((s, a) => s + a[key], 0) : null;
      const ltmRev = sum("rev"), ltmEbitda = sum("ebitda");
      return {
        ...base, ltmRev, ltmEbitda,
        ltmMarginPct: (ltmRev != null && ltmEbitda != null && ltmRev !== 0)
          ? (ltmEbitda / ltmRev) * 100 : null,
      };
    });
  }, [quarters]);

  // CAGR from annual data (requires positive first + last values)
  const { revCAGR, ebitdaCAGR } = useMemo(() => {
    const cagr = (rows, key) => {
      if (rows.length < 2) return null;
      const first = rows[0][key], last = rows[rows.length - 1][key];
      if (!first || !last || first <= 0 || last <= 0) return null;
      return (Math.pow(last / first, 1 / (rows.length - 1)) - 1) * 100;
    };
    return {
      revCAGR:    cagr(annualData.filter(y => y.rev    > 0), "rev"),
      ebitdaCAGR: cagr(annualData.filter(y => y.ebitda > 0), "ebitda"),
    };
  }, [annualData]);

  return { ltm, annualData, quarterlyWithLTM, revCAGR, ebitdaCAGR };
}
