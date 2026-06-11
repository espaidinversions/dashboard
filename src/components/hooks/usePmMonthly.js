import { useEffect, useMemo, useState } from "react";
import { PM_MODEL } from "../../data/publicMarketsModel.js";
import { loadPMMonthlySeries, loadPMManagerOverrides } from "../../db.js";

// Static base: the hand-maintained PM_MONTHLY series exposed through the model.
export const PM_MONTHLY_STATIC = PM_MODEL.series.monthly;

const CA_MONTH_ABBR = ["Gen", "Feb", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Des"];

const MANAGER_OVERRIDE_FIELDS = ["valorActual", "rendPct", "ytd", "r2025", "r2024"];

export function pmMonthLabel(month) {
  const [year, m] = String(month ?? "").split("-");
  const idx = Number(m) - 1;
  if (!year || Number.isNaN(idx) || idx < 0 || idx > 11) return month ?? "";
  return `${CA_MONTH_ABBR[idx]} '${year.slice(2)}`;
}

// DB row (snake_case) → PM_MONTHLY row shape (camelCase).
export function monthlyRowFromDb(row) {
  return {
    date:    row.month,
    label:   pmMonthLabel(row.month),
    caixaRV: row.caixa_rv,
    caixaRF: row.caixa_rf,
    ubsRV:   row.ubs_rv,
    ubsRF:   row.ubs_rf,
    abelBK:  row.abel_bk,
    andbank: row.andbank,
    _source: "live",
  };
}

// Merge semantics: a live row with the same month REPLACES the static row;
// live rows for new months are appended; result sorted ascending by month.
export function mergePmMonthly(staticRows, liveDbRows) {
  const live = (liveDbRows ?? []).map(monthlyRowFromDb);
  const liveByMonth = new Map(live.map(r => [r.date, r]));
  const staticMonths = new Set((staticRows ?? []).map(r => r.date));
  const merged = (staticRows ?? []).map(r => liveByMonth.get(r.date) ?? { ...r, _source: "static" });
  const extras = live.filter(r => !staticMonths.has(r.date));
  return [...merged, ...extras].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// DB rows → map manager_id → override row (camelCase).
export function managerOverridesFromDb(rows) {
  const map = {};
  for (const r of rows ?? []) {
    map[r.manager_id] = {
      valorActual: r.valor_actual,
      rendPct:     r.rend_pct,
      ytd:         r.ytd,
      r2025:       r.r2025,
      r2024:       r.r2024,
      notes:       r.notes,
      updatedAt:   r.updated_at,
    };
  }
  return map;
}

// Apply non-null override fields on top of the static manager templates.
export function applyManagerOverrides(managers, overrides) {
  if (!overrides || Object.keys(overrides).length === 0) return managers;
  return (managers ?? []).map(manager => {
    const override = overrides[manager.id];
    if (!override) return manager;
    const next = { ...manager };
    for (const field of MANAGER_OVERRIDE_FIELDS) {
      if (override[field] != null) next[field] = override[field];
    }
    return next;
  });
}

// Stale-while-revalidate: returns the static series immediately, then merges
// in live Supabase rows once loaded.
export function usePmMonthly() {
  const [liveMonthly, setLiveMonthly] = useState([]);
  const [managerOverrides, setManagerOverrides] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPMMonthlySeries(), loadPMManagerOverrides()])
      .then(([monthlyRows, overrideRows]) => {
        if (cancelled) return;
        setLiveMonthly(monthlyRows ?? []);
        setManagerOverrides(managerOverridesFromDb(overrideRows));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const monthly = useMemo(() => mergePmMonthly(PM_MONTHLY_STATIC, liveMonthly), [liveMonthly]);

  return { monthly, managerOverrides, loading };
}
