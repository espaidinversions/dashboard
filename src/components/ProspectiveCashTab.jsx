import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../theme.js";
import { usePersistedState } from "../utils.js";
import { fetchProspectiveCashForecasts, saveProspectiveCashForecasts, fetchCommittedOverrides, saveCommittedOverrides } from "../db.js";
import { makeFundRouteId } from "../data/fundDetailModel.js";
import { FUND_NAME_MAP } from "../data/fundNameMap.js";
import { normalizeCapitalCallTipus } from "../data/capitalCallTipusModel.js";
import { PROSPECTIVE_CASH_USD_FUNDS } from "../data/prospectiveCashUsdFunds.js";
import {
  buildReFundMatcher,
  deriveProspectiveCashRows,
  editorDataToForecastRows,
  forecastRowsToEditorData,
  preloadStaticCapitalCallData,
} from "../data/prospectiveCashModel.js";
import { TURTLE_FONS_MODEL } from "../data/turtleFonsModel.js";
import {
  modeValue, fmtK, pct, signed, aggregateByYear, aggregateByFund,
  buildTable, selectStyle, buttonStyle,
} from "./prospective/prospectiveUtils.js";
import { Kpi, ChartCard, Toolbar, ToolbarLabel, Segmented, PeriodPill } from "./prospective/ProspectivePrimitives.jsx";
import { MainChart, CumulativeChart, DeviationChart, FundDeviationChart } from "./prospective/ProspectiveCharts.jsx";
import { CashTable } from "./prospective/CashTable.jsx";
import { EditorPanel } from "./prospective/EditorPanel.jsx";

// Kick off static data preload as soon as this module loads (behind React.lazy).
preloadStaticCapitalCallData();

const EXCLUDED_CASH_MODEL_TIPUS = new Set([
  "Transferència Participacions",
  "Conversió Participacions",
]);

const MODES = [
  { id: "calls", label: "Aportacions" },
  { id: "dist", label: "Distribucions" },
  { id: "net", label: "Net CF" },
];

const PERIODS = [
  { id: "closed", label: "Tancat <=2025", color: "green" },
  { id: "current", label: "En curs 2026", color: "yellow" },
  { id: "fwd", label: "Projeccio >2026", color: "muted" },
];

function periodOf(year) {
  if (year <= 2025) return "closed";
  if (year === 2026) return "current";
  return "fwd";
}

function colorFor(tc, color) {
  if (color === "green") return tc.green;
  if (color === "yellow") return tc.warning;
  return tc.textLight;
}

export function ProspectiveCashTab({ rawCapitalCalls = [], forceScope }) {
  const { tc, dark } = useTheme();
  const [editorData, setEditorData] = useState({ years: [], funds: {} });
  const [vehicleIds, setVehicleIds] = useState({});
  const fetchedRef = useRef({ years: [], funds: {} });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [_entityScope, setEntityScope] = usePersistedState("ui_cash_model_scope", "funds");
  const entityScope = forceScope ?? _entityScope;
  const [view, setView] = useState("dashboard");
  const [mode, setMode] = useState("net");
  const [tableType, setTableType] = useState("net");
  const [fund, setFund] = useState("all");
  const [periods, setPeriods] = useState({ closed: true, current: true, fwd: true });
  const [yearFilters, setYearFilters] = useState(new Set());
  const [vintageFilter, setVintageFilter] = useState(null);
  const [sort, setSort] = useState({ key: "devAbs", dir: "desc" });
  const [devMetric, setDevMetric] = useState("eur");
  const [editorType, setEditorType] = useState("calls");
  const [editorSearch, setEditorSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editorInputMode, setEditorInputMode] = useState("eur");
  const [committedOverrides, setCommittedOverrides] = useState({});

  const entityText = useMemo(() => {
    if (entityScope === "all") {
      return {
        singular: "vehicle",
        plural: "vehicles",
        selectLabel: "Vehicles",
        allLabel: "Tots els vehicles",
        searchPlaceholder: "Cercar vehicle...",
      };
    }
    if (entityScope === "companies") {
      return {
        singular: "companyia",
        plural: "companyies",
        selectLabel: "Companyies",
        allLabel: "Totes les companyies",
        searchPlaceholder: "Cercar companyia...",
      };
    }
    if (entityScope === "re") {
      return {
        singular: "fons RE",
        plural: "fons RE",
        selectLabel: "Real Estate",
        allLabel: "Tots els fons RE",
        searchPlaceholder: "Cercar fons RE...",
      };
    }
    return {
      singular: "fons",
      plural: "fons",
      selectLabel: "Fons",
      allLabel: "Tots els fons",
      searchPlaceholder: "Cercar fons...",
    };
  }, [entityScope]);

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
        const vcpe = String(row?.vehicleTipus ?? "").trim();
        const est = String(row?.est ?? "").trim();
        const isCompany = vcpe === "PC" || vcpe === "SF" || est === "Participada (Altres)" || est.startsWith("Search Fund");
        const isRE = vcpe === "RE" || est === "Fons Real Estate";
        if (isCompany) kindByNameLower[key] = "companies";
        else if (isRE) kindByNameLower[key] = "re";
        else if (!kindByNameLower[key]) kindByNameLower[key] = "funds";
      }
      const vehicleTipus = row?.vehicleTipus ? String(row.vehicleTipus) : null;
      const id = row?.id ? String(row.id) : null;
      if (id && vehicleTipus) {
        if (!entityMetaByName[raw]) entityMetaByName[raw] = { id, vehicleTipus };
        if (!entityMetaByName[canonical]) entityMetaByName[canonical] = { id, vehicleTipus };
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
      const vcpe = String(row?.vehicleTipus ?? "").trim();
      const est = String(row?.est ?? "").trim();
      const isCompany = vcpe === "PC" || vcpe === "SF" || est === "Participada (Altres)" || est.startsWith("Search Fund");
      const isRE = vcpe === "RE" || est === "Fons Real Estate";
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
        const { editorData: derived, vehicleIds: ids } = forecastRowsToEditorData(data);
        // When Supabase has no saved rows, use the static turtle model as the starting point.
        const resolved = Object.keys(derived.funds ?? {}).length > 0 ? derived : TURTLE_FONS_MODEL;
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

  const table = useMemo(() => buildTable({
    rows: cashData.rows,
    committed: mergedCommitted,
    firstCall: cashData.firstCall,
    fund, tableType, visibleYears, yearFilters, vintageFilter, sort,
  }), [cashData.rows, cashData.firstCall, fund, mergedCommitted, sort, tableType, visibleYears, vintageFilter, yearFilters]);

  useEffect(() => {
    if (loading || dirty) return;
    if (!Array.isArray(rawCapitalCalls) || rawCapitalCalls.length === 0) return;

    const flowCats = new Set(["Capital Call", "Distribució", "Retorn Capital"]);
    const actualYears = [];
    const fundToVehicleId = {};
    for (const row of rawCapitalCalls) {
      const rawFund = String(row?.fons ?? "").trim();
      const fund = FUND_NAME_MAP[rawFund] ?? rawFund;
      const vcpe = String(row?.vehicleTipus ?? "").trim();
      const est = String(row?.est ?? "").trim();
      const isCompanyRow = vcpe === "PC" || vcpe === "SF" || est === "Participada (Altres)" || est.startsWith("Search Fund");
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

  const text = {
    model: mode === "calls" ? "Aportacions" : mode === "dist" ? "Distribucions" : "Net Cash Flow",
    table: tableType === "calls" ? "Calls" : tableType === "dist" ? "Distribucions" : "Net CF",
  };

  if (loading) return (
    <div className="tab-panel" style={{ padding: 32, color: tc.textLight, fontSize: 14 }}>
      Carregant previsions...
    </div>
  );
  if (fetchError) return (
    <div className="tab-panel" style={{ padding: 32, color: "#c00", fontSize: 14 }}>
      Error carregant previsions: {fetchError}
    </div>
  );

  return (
    <div className="tab-panel" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 260 }}>
          <div style={{ fontSize: 18, fontWeight: 750, color: tc.navyDark }}>Model prospectiu de caixa</div>
          <div style={{ fontSize: 12, color: tc.textLight, marginTop: 2 }}>Model vs real per fons, any i tipus de flux</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Segmented tc={tc} value={view} onChange={setView} options={[{ id: "dashboard", label: "Dashboard" }, { id: "editor", label: "Editor" }]} />
          {dirty && (
            <button onClick={saveAndApply} disabled={saving} style={buttonStyle(tc, dirty && !saving)}>
              {saving ? "Desant..." : "Aplica i desa"}
            </button>
          )}
          {saveError && <div style={{ color: "#c00", fontSize: 12, alignSelf: "center" }}>{saveError}</div>}
        </div>
      </div>

      {view === "dashboard" ? (
        <>
          <Toolbar tc={tc}>
            {!forceScope && (
              <>
                <ToolbarLabel tc={tc}>Entitats</ToolbarLabel>
                <Segmented tc={tc} value={entityScope} onChange={setEntityScope} options={[{ id: "all", label: "Tots" }, { id: "funds", label: "Fons" }, { id: "re", label: "Real Estate" }, { id: "companies", label: "Companyies" }]} />
              </>
            )}
            <ToolbarLabel tc={tc}>Vista</ToolbarLabel>
            <Segmented tc={tc} value={mode} onChange={setMode} options={MODES} />
            <ToolbarLabel tc={tc}>Periodes</ToolbarLabel>
            {PERIODS.map((period) => (
              <PeriodPill
                key={period.id}
                tc={tc}
                active={periods[period.id]}
                color={period.color}
                label={period.label}
                onClick={() => setPeriods((current) => ({ ...current, [period.id]: !current[period.id] }))}
              />
            ))}
            <ToolbarLabel tc={tc}>{entityText.selectLabel}</ToolbarLabel>
            <select value={fund} onChange={(event) => setFund(event.target.value)} style={selectStyle(tc)}>
              <option value="all">{entityText.allLabel}</option>
              {fundOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </Toolbar>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "stretch" }}>
            <div style={{ flex: 1, minWidth: 560 }}>
              <div className="grid-4" style={{ gap: 10 }}>
                <Kpi tc={tc} label="Compromis" value={fmtK(capitalSummary.committed)} color={tc.navy} />
                <Kpi tc={tc} label="Capital cridat" value={fmtK(capitalSummary.called)} color={tc.navyDark} sub="Aportacions (real)" />
                <Kpi tc={tc} label="Pendent de cridar" value={fmtK(capitalSummary.pending)} color={capitalSummary.pending > 0 ? tc.warning : tc.textLight} />
                <Kpi tc={tc} label="% utilitzat" value={capitalSummary.utilPct == null ? "--" : `${capitalSummary.utilPct.toFixed(1)}%`} color={capitalSummary.utilPct != null && capitalSummary.utilPct >= 98 ? tc.warning : tc.textMid} sub={capitalSummary.utilPct != null ? `${entityText.plural} amb calls visibles` : undefined} />
                <Kpi tc={tc} label="Net CF real" value={signed(kpis.netReal)} color={kpis.netReal >= 0 ? tc.green : tc.red} sub="Dist - Calls" />
                <Kpi tc={tc} label="Desviacio" value={signed(kpis.diff)} color={kpis.diff >= 0 ? tc.green : tc.red} sub={`${pct(kpis.realTotal, kpis.modelTotal)} vs model`} />
                <Kpi tc={tc} label={`Real ${text.model}`} value={fmtK(kpis.realTotal)} color={mode === "dist" ? tc.green : tc.navy} />
                <Kpi tc={tc} label={`Model ${text.model}`} value={fmtK(kpis.modelTotal)} muted />
                <Kpi tc={tc} label="Cobertura model" value={coverage.pct == null ? "--" : `${coverage.pct.toFixed(0)}%`} color={tc.navy} sub={`${coverage.modeled}/${coverage.total} ${entityText.plural}`} />
                <Kpi tc={tc} label="Sense model" value={String(coverage.unmodeled)} color={coverage.unmodeled ? tc.warning : tc.textLight} />
                <Kpi tc={tc} label="Total Calls" value={fmtK(kpis.totalCalls)} color={tc.navy} />
                <Kpi tc={tc} label="Total Dist" value={fmtK(kpis.totalDist)} color={tc.green} />
              </div>
            </div>

            <div style={{ flex: 0, minWidth: 320, maxWidth: 420 }}>
              <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8, overflow: "hidden", boxShadow: tc.shadows?.card }}>
                <div style={{ padding: "11px 14px", borderBottom: `1px solid ${tc.border}`, background: tc.bgAlt, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: tc.textLight, fontWeight: 750 }}>
                  Periodes
                </div>
                <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {periodBanner.map((period) => (
                    <div key={period.id} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, opacity: periods[period.id] ? 1 : 0.55 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ fontSize: 11, fontWeight: 750, color: colorFor(tc, period.color) }}>{period.label}</div>
                        <div style={{ fontSize: 10, color: tc.textLight }}>Model {fmtK(period.model, 0)} | Real {fmtK(period.real, 0)}</div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: period.diff >= 0 ? tc.green : tc.red }} title={pct(period.real, period.model)}>
                        {signed(period.diff)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ChartCard tc={tc} title={`${text.model} - Model vs Real`} wide>
              <MainChart rows={yearAgg} mode={mode} tc={tc} dark={dark} />
            </ChartCard>

            <CashTable
              tc={tc}
              table={table}
              tableType={tableType}
              setTableType={setTableType}
              allYears={allYears}
              visibleYears={visibleYears}
              yearFilters={yearFilters}
              setYearFilters={setYearFilters}
              vintageFilter={vintageFilter}
              setVintageFilter={setVintageFilter}
              sort={sort}
              setSort={setSort}
              fundRouteIds={fundRouteIds}
              entityScope={entityScope}
              entityText={entityText}
              entityMetaByName={entityMetaByName}
            />

            <div className="grid-2" style={{ gap: 12 }}>
              <ChartCard tc={tc} title="Acumulat">
                <CumulativeChart rows={yearAgg} mode={mode} tc={tc} dark={dark} />
              </ChartCard>
              <ChartCard tc={tc} title="Desviacio % per any">
                <DeviationChart rows={yearAgg} mode={mode} tc={tc} dark={dark} />
              </ChartCard>
              <ChartCard tc={tc} title="Top 25 fons - desviacio total" wide>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                  <Segmented tc={tc} value={devMetric} onChange={setDevMetric} options={[{ id: "eur", label: "€" }, { id: "pct", label: "%" }]} />
                </div>
                <FundDeviationChart rows={fundAgg} mode={mode} tc={tc} dark={dark} metric={devMetric} />
              </ChartCard>
            </div>
          </div>
        </>
      ) : (
        <EditorPanel
          tc={tc}
          editorData={editorData}
          committedByFund={mergedCommitted}
          committedOverrides={committedOverrides}
          paidInByFund={paidInByFund}
          actualsByFundYear={actualsByFundYear}
          fundNames={editorFundNames}
          editorType={editorType}
          setEditorType={setEditorType}
          editorSearch={editorSearch}
          setEditorSearch={setEditorSearch}
          updateFundValue={updateFundValue}
          updateCommittedOverride={updateCommittedOverride}
          saveAndApply={saveAndApply}
          exportEditorCsv={exportEditorCsv}
          resetDraft={resetDraft}
          dirty={dirty}
          saving={saving}
          editorInputMode={editorInputMode}
          setEditorInputMode={setEditorInputMode}
          fundRouteIds={fundRouteIds}
          entityScope={entityScope}
          setEntityScope={setEntityScope}
          entityText={entityText}
          entityMetaByName={entityMetaByName}
        />
      )}
    </div>
  );
}
