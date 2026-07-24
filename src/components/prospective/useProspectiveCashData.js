import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchProspectiveCashForecasts, saveProspectiveCashForecasts, fetchCommittedOverrides, saveCommittedOverrides } from "../../db.js";
import { makeFundRouteId, computeFundMetricsByName } from "../../data/fundDetailModel.js";
import { FUND_NAME_MAP } from "../../data/fundNameMap.js";
import { normalizeCapitalCallTipus } from "../../data/capitalCallTipusModel.js";
import { isCompanyEst, isReEst, estSection } from "../../data/capitalCallStrategyModel.js";
import {
  buildReFundMatcher,
  deriveProspectiveCashRows,
  editorDataToForecastRows,
  forecastRowsToEditorData,
  preloadStaticCapitalCallData,
} from "../../data/prospectiveCashModel.js";
import { TURTLE_FONS_MODEL } from "../../data/turtleFonsModel.js";
import {
  modeValue,
  aggregateByYear,
  aggregateByFund,
  buildTable,
  periodOf,
} from "./prospectiveUtils.js";
import { EXCLUDED_CASH_MODEL_TIPUS, PROSPECTIVE_CASH_PERIODS } from "./prospectiveCashConstants.js";
import { useProspectiveCashFilters } from "./useProspectiveCashFilters.js";

// Kick off static data preload as soon as the Prospective Cash route is loaded.
preloadStaticCapitalCallData();

function resolveForecastEditorData(rows) {
  const { editorData: derived, vehicleIds } = forecastRowsToEditorData(rows);
  const hasSavedForecasts = Object.keys(derived.funds ?? {}).length > 0;
  return { editorData: hasSavedForecasts ? derived : TURTLE_FONS_MODEL, vehicleIds };
}

export function useProspectiveCashData({ rawCapitalCalls = [], fundMeta = [], forceScope } = {}) {
  const [editorData, setEditorData] = useState({ years: [], funds: {} });
  const [vehicleIds, setVehicleIds] = useState({});
  const fetchedRef = useRef({ years: [], funds: {} });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const filters = useProspectiveCashFilters({ forceScope });
  const {
    entityScope,
    setEntityScope,
    view,
    setView,
    mode,
    setMode,
    tableType,
    setTableType,
    fund,
    setFund,
    periods,
    setPeriods,
    yearFilters,
    setYearFilters,
    vintageFilter,
    setVintageFilter,
    sort,
    setSort,
    devMetric,
    setDevMetric,
    editorType,
    setEditorType,
    editorSearch,
    setEditorSearch,
    editorInputMode,
    setEditorInputMode,
    entityText,
  } = filters;
  const ccMaps = useMemo(() => {
    const kindByNameLower = {};
    const entityMetaByName = {};
    const fundRouteIds = {};
    const rows = Array.isArray(rawCapitalCalls) ? rawCapitalCalls : [];
    for (const row of rows) {
      if (!row?.fons) continue;
      const raw = String(row.fons).trim();
      const canonical = FUND_NAME_MAP[raw] ?? raw;
      const key = canonical.trim().toLowerCase();
      if (key) {
        const isCompany = isCompanyEst(row?.est);
        const isRE = isReEst(row?.est);
        if (isCompany) kindByNameLower[key] = "companies";
        else if (isRE) kindByNameLower[key] = "re";
        else if (!kindByNameLower[key]) kindByNameLower[key] = "funds";
      }
      const section = estSection(row?.est);
      const id = row?.id ? String(row.id) : null;
      if (id && section) {
        if (!entityMetaByName[raw]) entityMetaByName[raw] = { id, section };
        if (!entityMetaByName[canonical]) entityMetaByName[canonical] = { id, section };
      }
      if (!fundRouteIds[raw]) fundRouteIds[raw] = makeFundRouteId(row);
      if (!fundRouteIds[canonical]) fundRouteIds[canonical] = makeFundRouteId(row);
    }
    return { kindByNameLower, entityMetaByName, fundRouteIds };
  }, [rawCapitalCalls]);
  const { kindByNameLower, entityMetaByName, fundRouteIds } = ccMaps;

  const scopedActualRows = useMemo(() => {
    const rows = Array.isArray(rawCapitalCalls) ? rawCapitalCalls : [];
    if (entityScope === "all") return rows;
    return rows.filter((row) => {
      const isCompany = isCompanyEst(row?.est);
      const isRE = isReEst(row?.est);
      if (entityScope === "companies") return isCompany;
      if (entityScope === "re") return isRE;
      return !isCompany && !isRE;
    });
  }, [entityScope, rawCapitalCalls]);

  const scopedEditorData = useMemo(() => {
    const srcFunds = editorData?.funds && typeof editorData.funds === "object" ? editorData.funds : {};
    if (entityScope === "all") return { ...editorData, funds: srcFunds };
    const funds = {};
    for (const [name, data] of Object.entries(srcFunds)) {
      const kind = kindByNameLower[String(name ?? "").trim().toLowerCase()] ?? "funds";
      if (entityScope === "companies") {
        if (kind !== "companies") continue;
      } else if (entityScope === "re") {
        if (kind !== "re") continue;
      } else {
        if (kind === "companies" || kind === "re") continue;
      }
      funds[name] = data;
    }
    return { ...editorData, funds };
  }, [editorData, entityScope, kindByNameLower]);

  const isReFund = useMemo(() => buildReFundMatcher(rawCapitalCalls), [rawCapitalCalls]);

  const cashData = useMemo(
    () => deriveProspectiveCashRows(scopedEditorData, scopedActualRows, {
      reScope: entityScope === "re",
      allScope: entityScope === "all",
      isReFund,
    }),
    [scopedActualRows, scopedEditorData, entityScope, isReFund],
  );

  const mergedCommitted = useMemo(() => {
    const out = { ...(cashData.committed ?? {}) };
    for (const [k, v] of Object.entries(committedOverrides ?? {})) {
      const num = Number(v);
      if (Number.isFinite(num) && num > 0) out[k] = num;
      else delete out[k];
    }
    return out;
  }, [cashData.committed, committedOverrides]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchProspectiveCashForecasts(), fetchCommittedOverrides()])
      .then(([{ data, error }, { data: overrides, error: overridesError }]) => {
        if (cancelled) return;
        if (error) { setFetchError(error.message); setLoading(false); return; }
        const { editorData: resolved, vehicleIds: ids } = resolveForecastEditorData(data);
        fetchedRef.current = resolved;
        setEditorData(resolved);
        setVehicleIds(ids);
        if (!overridesError) setCommittedOverrides(overrides ?? {});
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) { setFetchError(err.message ?? "Error inesperat"); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  const fundOptions = useMemo(
    () => [...new Set(cashData.rows.map((row) => row.fund))].sort((a, b) => a.localeCompare(b)),
    [cashData.rows],
  );

  useEffect(() => {
    if (fund === "all") return;
    if (!fundOptions.includes(fund)) setFund("all");
  }, [entityScope, fund, fundOptions]);

  const periodEnabled = useCallback((year) => periods[periodOf(year)], [periods]);

  const visibleRows = useMemo(
    () => cashData.rows.filter((row) => periodEnabled(row.year) && (fund === "all" || row.fund === fund)),
    [cashData.rows, fund, periodEnabled],
  );

  const yearAgg = useMemo(() => aggregateByYear(visibleRows), [visibleRows]);
  const fundAgg = useMemo(() => aggregateByFund(visibleRows), [visibleRows]);

  const allYears = useMemo(
    () => [...new Set(cashData.rows.filter((row) => row.model || row.real).map((row) => row.year))].sort((a, b) => a - b),
    [cashData.rows],
  );

  const visibleYears = useMemo(() => {
    if (yearFilters.size) return allYears.filter((year) => yearFilters.has(year));
    return allYears.filter((year) => periodEnabled(year));
  }, [allYears, periodEnabled, yearFilters]);

  const kpis = useMemo(() => {
    let modelTotal = 0, realTotal = 0, totalCalls = 0, totalDist = 0;
    for (const row of yearAgg) {
      const value = modeValue(row, mode);
      modelTotal += value.model;
      realTotal += value.real;
      totalCalls += row.rc;
      totalDist += row.rd;
    }
    const diff = realTotal - modelTotal;
    return {
      modelTotal, realTotal, diff,
      netReal: totalDist - totalCalls,
      totalCalls, totalDist,
      dpi: totalCalls > 0 ? totalDist / totalCalls : null,
      fundCount: (() => { const s = new Set(); for (const r of visibleRows) s.add(r.fund); return s.size; })(),
    };
  }, [mode, visibleRows, yearAgg]);

  const coverage = useMemo(() => {
    const byFund = new Map();
    for (const row of visibleRows) {
      const cur = byFund.get(row.fund) ?? { model: 0, real: 0 };
      cur.model += Number(row.model) || 0;
      cur.real += Number(row.real) || 0;
      byFund.set(row.fund, cur);
    }
    let modeled = 0, unmodeled = 0;
    for (const v of byFund.values()) {
      if (!v.real) continue;
      if (!v.model) unmodeled += 1;
      else modeled += 1;
    }
    return {
      modeled, unmodeled,
      total: modeled + unmodeled,
      pct: modeled + unmodeled ? (modeled / (modeled + unmodeled)) * 100 : null,
    };
  }, [visibleRows]);

  const paidInByFund = useMemo(() => {
    const map = {};
    cashData.rows.forEach((row) => {
      if (row.type === "calls") map[row.fund] = (map[row.fund] ?? 0) + row.real;
    });
    return map;
  }, [cashData.rows]);

  const actualsByFundYear = useMemo(() => {
    const out = {};
    for (const row of cashData.rows) {
      if (!row.real) continue;
      if (!out[row.fund]) out[row.fund] = { calls: {}, dist: {} };
      const bucket = out[row.fund][row.type];
      if (!bucket) continue;
      bucket[row.year] = (bucket[row.year] ?? 0) + row.real;
    }
    return out;
  }, [cashData.rows]);

  const capitalSummary = useMemo(() => {
    const fundsInView = new Set(visibleRows.map((row) => row.fund));
    let committed = 0;
    for (const f of fundsInView) committed += Number(mergedCommitted?.[f] ?? 0) || 0;
    const called = Number(kpis.totalCalls) || 0;
    const pending = committed > 0 ? Math.max(committed - called, 0) : 0;
    const utilPct = committed > 0 ? (called / committed) * 100 : null;
    return { committed, called, pending, utilPct };
  }, [kpis.totalCalls, mergedCommitted, visibleRows]);


  const periodBanner = useMemo(() => {
    const totals = {
      closed: { mc: 0, rc: 0, md: 0, rd: 0 },
      current: { mc: 0, rc: 0, md: 0, rd: 0 },
      fwd: { mc: 0, rc: 0, md: 0, rd: 0 },
    };
    for (const row of cashData.rows) {
      if (fund !== "all" && row.fund !== fund) continue;
      const bucket = totals[periodOf(row.year)];
      if (row.type === "calls") { bucket.mc += row.model; bucket.rc += row.real; }
      else { bucket.md += row.model; bucket.rd += row.real; }
    }
    return PERIODS.map((period) => {
      const value = modeValue(totals[period.id], mode);
      return { ...period, ...value, diff: value.real - value.model };
    });
  }, [cashData.rows, fund, mode]);

  // Lifetime DPI/TVPI per fund, sourced the same way as the fund page (fund_meta + capital calls).
  const metricsByFund = useMemo(
    () => computeFundMetricsByName(rawCapitalCalls, fundMeta),
    [rawCapitalCalls, fundMeta],
  );

  const table = useMemo(() => buildTable({
    rows: cashData.rows,
    committed: mergedCommitted,
    firstCall: cashData.firstCall,
    metricsByFund,
    fund, tableType, visibleYears, yearFilters, vintageFilter, sort,
  }), [cashData.rows, cashData.firstCall, metricsByFund, fund, mergedCommitted, sort, tableType, visibleYears, vintageFilter, yearFilters]);

  useEffect(() => {
    if (loading || dirty) return;
    if (!Array.isArray(rawCapitalCalls) || rawCapitalCalls.length === 0) return;

    const flowCats = new Set(["Capital Call", "Distribució", "Retorn Capital"]);
    const actualYears = [];
    const fundToVehicleId = {};
    for (const row of rawCapitalCalls) {
      const rawFund = String(row?.fons ?? "").trim();
      const fund = FUND_NAME_MAP[rawFund] ?? rawFund;
      const isCompanyRow = isCompanyEst(row?.est);
      if (!fund || isCompanyRow) continue;
      if (entityScope !== "re" && (isReFund(rawFund) || isReFund(fund))) continue;
      if (!flowCats.has(String(row?.cat ?? "").trim())) continue;
      const concept = normalizeCapitalCallTipus(row?.tipus);
      if (EXCLUDED_CASH_MODEL_TIPUS.has(concept)) continue;
      if (String(row?.cat ?? "").trim() === "Capital Call" && concept != null && concept !== "Aportació") continue;
      if (!fundToVehicleId[fund] && row?.id) fundToVehicleId[fund] = row.id;
      const y = Number(row?.any ?? row?.year);
      if (Number.isFinite(y) && y > 0) actualYears.push(y);
    }
    const fundsWithActuals = Object.keys(fundToVehicleId);
    if (fundsWithActuals.length === 0) return;

    const minActual = actualYears.length ? Math.min(...actualYears) : null;
    const maxActual = actualYears.length ? Math.max(...actualYears) : null;

    setEditorData((current) => {
      let didChange = false;
      const nextFunds = { ...(current.funds ?? {}) };
      for (const fund of fundsWithActuals) {
        if (!nextFunds[fund]) { nextFunds[fund] = { model_calls: {}, model_dist: {} }; didChange = true; }
      }
      let nextYears = Array.isArray(current.years) ? [...current.years] : [];
      if (minActual != null && maxActual != null) {
        const minExisting = nextYears.length ? Math.min(...nextYears) : Infinity;
        const maxExisting = nextYears.length ? Math.max(...nextYears) : -Infinity;
        const min = Math.min(minExisting, minActual);
        const max = Math.max(maxExisting, maxActual);
        if (min !== Infinity && max !== -Infinity) {
          const desired = Array.from({ length: (max + 3) - min + 1 }, (_, i) => min + i);
          if (desired.length !== nextYears.length || desired[0] !== nextYears[0] || desired.at(-1) !== nextYears.at(-1)) {
            nextYears = desired; didChange = true;
          }
        }
      }
      const next = didChange ? { ...current, years: nextYears, funds: nextFunds } : current;
      if (didChange) fetchedRef.current = next;
      return next;
    });

    setVehicleIds((current) => {
      let changed = false;
      const next = { ...(current ?? {}) };
      for (const [fund, vehicleId] of Object.entries(fundToVehicleId)) {
        if (!next[fund] && vehicleId) { next[fund] = vehicleId; changed = true; }
      }
      return changed ? next : current;
    });
  }, [dirty, isReFund, loading, rawCapitalCalls]);


  const editorFundNames = useMemo(
    () => Object.keys(scopedEditorData.funds)
      .filter((name) => entityScope === "re" || !isReFund(name))
      .filter((name) => !editorSearch || name.toLowerCase().includes(editorSearch.toLowerCase()))
      .sort((a, b) => a.localeCompare(b)),
    [editorSearch, entityScope, isReFund, scopedEditorData.funds],
  );

  const saveAndApply = useCallback(async () => {
    setSaving(true);
    const rows = editorDataToForecastRows(editorData, vehicleIds);
    const [{ error }, { error: overridesError }] = await Promise.all([
      saveProspectiveCashForecasts(rows, Object.values(vehicleIds)),
      saveCommittedOverrides(committedOverrides, vehicleIds),
    ]);
    setSaving(false);
    if (error || overridesError) { setSaveError((error ?? overridesError).message); return; }
    fetchedRef.current = editorData;
    setSaveError(null);
    setDirty(false);
    setView("dashboard");
  }, [committedOverrides, editorData, vehicleIds]);

  const resetDraft = useCallback(() => { setEditorData(fetchedRef.current); setDirty(false); }, []);

  const updateFundValue = useCallback((fundName, updater) => {
    setEditorData((current) => ({
      ...current,
      funds: { ...current.funds, [fundName]: updater({ ...current.funds[fundName] }) },
    }));
    setDirty(true);
  }, []);

  const updateCommittedOverride = useCallback((fundName, value) => {
    const num = Number(value) || 0;
    setCommittedOverrides((prev) => ({ ...prev, [fundName]: num > 0 ? num : null }));
    setDirty(true);
  }, []);

  const exportEditorCsv = useCallback(() => {
    const key = `model_${editorType}`;
    const lines = [["Fons", "Compromes", ...editorData.years].join(",")];
    Object.entries(editorData.funds).sort((a, b) => a[0].localeCompare(b[0])).forEach(([fundName, data]) => {
      const row = [`"${fundName.replaceAll('"', '""')}"`, data.committed || 0, ...editorData.years.map((year) => {
        const v = data[key] ?? {};
        return Number(v?.[year] ?? v?.[String(year)] ?? 0) || 0;
      })];
      lines.push(row.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospective_cash_model_${editorType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editorData, editorType]);


  return {
    ...filters,
    editorData,
    loading,
    fetchError,
    saveError,
    saving,
    dirty,
    cashData,
    mergedCommitted,
    fundOptions,
    visibleRows,
    yearAgg,
    fundAgg,
    allYears,
    visibleYears,
    kpis,
    coverage,
    paidInByFund,
    actualsByFundYear,
    capitalSummary,
    periodBanner,
    metricsByFund,
    table,
    editorFundNames,
    saveAndApply,
    resetDraft,
    updateFundValue,
    updateCommittedOverride,
    exportEditorCsv,
    fundRouteIds,
    entityMetaByName,
  };
}

