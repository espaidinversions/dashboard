import { useMemo } from "react";

/**
 * Derives the "Asset Allocation Fons" dataset that mirrors the AUM Summary sheet
 * of the Allocation workbook: for each breakdown dimension (Geography, Vertical,
 * Strategy, Vehicle Class) and each metric (Committed / Called / Returned), a
 * CUMULATIVE-by-fiscal-year series, in both 100%-stacked (pct) and absolute (€M
 * via `eur`) shapes.
 *
 * Methodology matches the workbook: each fund's flow is distributed across its
 * geography/sector/strategy weight map (from fund_meta); vehicle class is the
 * categorical `est`. Values are cumulative (a stock "as of" each FY), so FY_n =
 * sum of that metric's flows in every FY ≤ n. Unclassified capital lands in a
 * "Sense classificar" bucket so each FY column still reconciles to the total.
 *
 * Committed uses each fund's stated commitment (fund_meta.committed_override)
 * when present — the fund's Compromís transactions are scaled to that total so
 * the FY ramp is preserved — otherwise the raw Compromís sum. This matches the
 * workbook's committed basis. Real Estate fund vehicles are excluded: they have
 * their own dashboard section and are scoped differently in the workbook.
 */

// The "Fons" universe = PE/VC fund vehicles, matching the AUM Summary scope.
// Excludes Real Estate funds (own section) and Participada / Search Fund vehicles.
const FONS_EST = new Set([
  "Fons Primari",
  "Fons de Fons",
  "Fons de Coinversió",
  "Fons Secundari",
]);

// est (Catalan vehicle type) → AUM Summary "Vehicle Class" label.
const VEHICLE_LABEL = {
  "Fons Primari": "Primaris",
  "Fons de Fons": "FoF",
  "Fons Secundari": "Secundaris",
  "Fons de Coinversió": "Co-inversions",
};

// Display fiscal years, matching the workbook's 21..25 columns.
const DISPLAY_FYS = [2021, 2022, 2023, 2024, 2025];

const UNCLASSIFIED = "Sense classificar";

const METRICS = ["committed", "called", "returned"];

function norm(s) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function fyYear(fy) {
  const m = String(fy ?? "").match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

/**
 * @param {object} params
 * @param {Array} params.TRANSACTIONS flow rows (Capital Call / Distribució / Retorn Capital)
 * @param {Array} params.COMPROMISOS  commitment rows (Compromís)
 * @param {Array} params.fundMeta     fund_meta rows with geography/sector/strategy maps + committedOverride
 * @param {Set<string>} [params.excluded] excluded fund names
 */
export function useAllocationData({ TRANSACTIONS = [], COMPROMISOS = [], fundMeta = [], excluded }) {
  // fons (normalized) → { geography, sector, strategy, committedOverride }.
  const metaByFons = useMemo(() => {
    const m = new Map();
    (fundMeta || []).forEach((fm) => {
      if (fm?.fons) m.set(norm(fm.fons), {
        geography: fm.geography,
        sector: fm.sector,
        strategy: fm.strategy,
        committedOverride: fm.committedOverride != null ? Number(fm.committedOverride) : null,
      });
    });
    return m;
  }, [fundMeta]);

  return useMemo(() => {
    const isFons = (r) => FONS_EST.has(r?.est) && !(excluded && excluded.has(r.fons));

    const flows = { committed: [], called: [], returned: [] };

    // Committed: group Compromís rows per fund, then apply the committed_override
    // (scaled across the fund's rows) when present so the FY ramp is preserved.
    const comprByFund = new Map(); // nk → { fons, est, rows:[{est,year,amount}], sum }
    for (const r of COMPROMISOS) {
      if (r?.cat !== "Compromís" || !isFons(r)) continue;
      const y = fyYear(r.fy);
      if (y == null) continue;
      const nk = norm(r.fons);
      const amount = Math.abs(Number(r.eur) || 0);
      if (!comprByFund.has(nk)) comprByFund.set(nk, { fons: r.fons, est: r.est, rows: [], sum: 0 });
      const g = comprByFund.get(nk);
      g.rows.push({ fons: r.fons, est: r.est, year: y, amount });
      g.sum += amount;
    }
    for (const [nk, g] of comprByFund) {
      const ov = metaByFons.get(nk)?.committedOverride;
      if (ov != null && ov > 0) {
        if (g.sum > 0) {
          const f = ov / g.sum;
          for (const row of g.rows) flows.committed.push({ ...row, amount: row.amount * f });
        } else {
          const yr = g.rows[0]?.year ?? DISPLAY_FYS[0];
          flows.committed.push({ fons: g.fons, est: g.est, year: yr, amount: ov });
        }
      } else {
        for (const row of g.rows) flows.committed.push(row);
      }
    }

    // Called / Returned: straight from the transaction flows.
    for (const r of TRANSACTIONS) {
      if (!isFons(r)) continue;
      const y = fyYear(r.fy);
      if (y == null) continue;
      const amount = Math.abs(Number(r.eur) || 0);
      if (r.cat === "Capital Call") flows.called.push({ fons: r.fons, est: r.est, year: y, amount });
      else if (r.cat === "Distribució" || r.cat === "Retorn Capital") flows.returned.push({ fons: r.fons, est: r.est, year: y, amount });
    }

    // Distribute one flow's amount into an accumulator for a given dimension.
    const DIM_KEY = { geography: "geography", vertical: "sector", strategy: "strategy" };
    const distribute = (acc, dim, flow) => {
      if (dim === "vehicle") {
        const label = VEHICLE_LABEL[flow.est] || UNCLASSIFIED;
        acc[label] = (acc[label] || 0) + flow.amount;
        return;
      }
      const map = metaByFons.get(norm(flow.fons))?.[DIM_KEY[dim]];
      if (!map || typeof map !== "object") {
        acc[UNCLASSIFIED] = (acc[UNCLASSIFIED] || 0) + flow.amount;
        return;
      }
      let any = false;
      for (const [k, frac] of Object.entries(map)) {
        const f = Number(frac);
        if (f > 0) { acc[k] = (acc[k] || 0) + flow.amount * f; any = true; }
      }
      if (!any) acc[UNCLASSIFIED] = (acc[UNCLASSIFIED] || 0) + flow.amount;
    };

    // Build a { series, pct, eur } block: cumulative-by-FY, sorted by grand total.
    const buildBlock = (dim, metric) => {
      const rows = flows[metric];
      const perFy = DISPLAY_FYS.map((yr) => {
        const acc = {};
        for (const flow of rows) if (flow.year <= yr) distribute(acc, dim, flow);
        return acc;
      });
      const totals = {};
      perFy.forEach((acc) => { for (const [k, v] of Object.entries(acc)) totals[k] = (totals[k] || 0) + v; });
      const series = Object.keys(totals).sort((a, b) => {
        if (a === UNCLASSIFIED) return 1;
        if (b === UNCLASSIFIED) return -1;
        return totals[b] - totals[a];
      });
      const pct = {};
      const eur = {};
      series.forEach((s) => {
        eur[s] = perFy.map((acc) => +(acc[s] || 0).toFixed(0));
        pct[s] = perFy.map((acc) => {
          const tot = Object.values(acc).reduce((sum, v) => sum + v, 0);
          return tot > 0 ? +(((acc[s] || 0) / tot) * 100).toFixed(2) : 0;
        });
      });
      const hasData = series.length > 0 && perFy.some((acc) => Object.values(acc).reduce((s, v) => s + v, 0) > 0);
      return { series, pct, eur, hasData };
    };

    const dims = {};
    for (const dim of ["geography", "vertical", "strategy", "vehicle"]) {
      dims[dim] = {};
      for (const metric of METRICS) dims[dim][metric] = buildBlock(dim, metric);
    }

    return { fys: DISPLAY_FYS.map((y) => String(y).slice(2)), dims };
  }, [TRANSACTIONS, COMPROMISOS, metaByFons, excluded]);
}
