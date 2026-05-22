import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { useTheme } from "../theme.js";
import { usePersistedState } from "../utils.js";
import { fetchProspectiveCashForecasts, saveProspectiveCashForecasts, fetchCommittedOverrides, saveCommittedOverrides } from "../db.js";
import { makeFundRouteId } from "../data/fundDetailModel.js";
import { FUND_NAME_MAP } from "../data/fundNameMap.js";
import { normalizeCapitalCallTipus } from "../data/capitalCallTipusModel.js";
import {
  PROSPECTIVE_CASH_USD_FUNDS,
  buildReFundMatcher,
  deriveProspectiveCashRows,
  editorDataToForecastRows,
  forecastRowsToEditorData,
} from "../data/prospectiveCashModel.js";

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

function modeValue(row, mode) {
  if (mode === "calls") return { model: row.mc, real: row.rc };
  if (mode === "dist") return { model: row.md, real: row.rd };
  return { model: row.md - row.mc, real: row.rd - row.rc };
}

function fmtK(value, digits = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  const a = Math.abs(n);
  const dM = digits == null ? 0 : digits;
  const dK = digits == null ? 0 : digits;
  if (a >= 1e6) return `${(n / 1e6).toFixed(dM)}M€`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(dK)}K€`;
  return `${n.toFixed(0)}€`;
}

function fmtC(value) {
  const n = Number(value) || 0;
  if (!n) return "";
  return fmtK(n, 0);
}

function pct(real, model) {
  return model ? `${(((real - model) / Math.abs(model)) * 100).toFixed(1)}%` : "--";
}

function signed(value) {
  return value >= 0 ? `+${fmtK(value)}` : fmtK(value);
}

function signedPct(value) {
  return value >= 0 ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;
}

function numberAtYear(values, year) {
  return Number(values?.[year] ?? values?.[String(year)] ?? 0) || 0;
}

function yearMapValue(values, year, next) {
  const copy = { ...(values ?? {}) };
  const numeric = Number(next) || 0;
  if (numeric > 0) copy[year] = numeric;
  else delete copy[year];
  return copy;
}

export function ProspectiveCashTab({ rawCapitalCalls = [] }) {
  const { tc, dark } = useTheme();
  const [editorData, setEditorData] = useState({ years: [], funds: {} });
  const [vehicleIds, setVehicleIds] = useState({});
  const fetchedRef = useRef({ years: [], funds: {} });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [entityScope, setEntityScope] = usePersistedState("ui_cash_model_scope", "funds"); // "funds" | "companies"
  const [view, setView] = useState("dashboard");
  const [mode, setMode] = useState("net");
  const [tableType, setTableType] = useState("net");
  const [fund, setFund] = useState("all");
  const [periods, setPeriods] = useState({ closed: true, current: true, fwd: true });
  const [yearFilters, setYearFilters] = useState(new Set());
  const [vintageFilter, setVintageFilter] = useState(null);
  const [sort, setSort] = useState({ key: "devAbs", dir: "desc" });
  const [devMetric, setDevMetric] = useState("eur"); // "eur" | "pct"
  const [editorType, setEditorType] = useState("calls");
  const [editorSearch, setEditorSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editorInputMode, setEditorInputMode] = useState("eur"); // "eur" | "pct"
  const [committedOverrides, setCommittedOverrides] = useState({});

  const entityText = useMemo(() => {
    if (entityScope === "companies") {
      return {
        singular: "companyia",
        plural: "companyies",
        selectLabel: "Companyies",
        allLabel: "Totes les companyies",
        searchPlaceholder: "Cercar companyia...",
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

  const kindByNameLower = useMemo(() => {
    const map = {};
    const rows = Array.isArray(rawCapitalCalls) ? rawCapitalCalls : [];
    for (const row of rows) {
      const rawFund = String(row?.fons ?? "").trim();
      const canonical = FUND_NAME_MAP[rawFund] ?? rawFund;
      const key = canonical.trim().toLowerCase();
      if (!key) continue;
      const vcpe = String(row?.vehicleTipus ?? "").trim();
      const isCompany = vcpe === "PC" || vcpe === "SF";
      if (isCompany) map[key] = "companies";
      else if (!map[key]) map[key] = "funds";
    }
    return map;
  }, [rawCapitalCalls]);

  const scopedActualRows = useMemo(() => {
    const rows = Array.isArray(rawCapitalCalls) ? rawCapitalCalls : [];
    return rows.filter((row) => {
      const vcpe = String(row?.vehicleTipus ?? "").trim();
      const isCompany = vcpe === "PC" || vcpe === "SF";
      return entityScope === "companies" ? isCompany : !isCompany;
    });
  }, [entityScope, rawCapitalCalls]);

  const scopedEditorData = useMemo(() => {
    const srcFunds = editorData?.funds && typeof editorData.funds === "object" ? editorData.funds : {};
    const funds = {};
    for (const [name, data] of Object.entries(srcFunds)) {
      const kind = kindByNameLower[String(name ?? "").trim().toLowerCase()] ?? "funds";
      if (entityScope === "companies") {
        if (kind !== "companies") continue;
      } else {
        if (kind === "companies") continue;
      }
      funds[name] = data;
    }
    return { ...editorData, funds };
  }, [editorData, entityScope, kindByNameLower]);

  const cashData = useMemo(() => deriveProspectiveCashRows(scopedEditorData, scopedActualRows), [scopedActualRows, scopedEditorData]);

  const mergedCommitted = useMemo(() => {
    const out = { ...(cashData.committed ?? {}) };
    for (const [k, v] of Object.entries(committedOverrides ?? {})) {
      const num = Number(v);
      if (Number.isFinite(num) && num > 0) out[k] = num;
      else delete out[k]; // null/0/NaN clears override and falls back to computed committed
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
        fetchedRef.current = derived;
        setEditorData(derived);
        setVehicleIds(ids);
        if (!overridesError) setCommittedOverrides(overrides ?? {});
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) { setFetchError(err.message ?? "Error inesperat"); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  const fundOptions = useMemo(() => (
    [...new Set(cashData.rows.map((row) => row.fund))].sort((a, b) => a.localeCompare(b))
  ), [cashData.rows]);

  useEffect(() => {
    if (fund === "all") return;
    if (!fundOptions.includes(fund)) setFund("all");
  }, [entityScope, fund, fundOptions]);

  const periodEnabled = useCallback((year) => periods[periodOf(year)], [periods]);
  const visibleRows = useMemo(() => (
    cashData.rows.filter((row) => periodEnabled(row.year) && (fund === "all" || row.fund === fund))
  ), [cashData.rows, fund, periodEnabled]);

  const yearAgg = useMemo(() => aggregateByYear(visibleRows), [visibleRows]);
  const fundAgg = useMemo(() => aggregateByFund(visibleRows), [visibleRows]);
  const allYears = useMemo(() => (
    [...new Set(cashData.rows.filter((row) => row.model || row.real).map((row) => row.year))].sort((a, b) => a - b)
  ), [cashData.rows]);

  const visibleYears = useMemo(() => {
    if (yearFilters.size) return allYears.filter((year) => yearFilters.has(year));
    return allYears.filter((year) => periodEnabled(year));
  }, [allYears, periodEnabled, yearFilters]);

  const kpis = useMemo(() => {
    let modelTotal = 0;
    let realTotal = 0;
    let totalCalls = 0;
    let totalDist = 0;
    for (const row of yearAgg) {
      const value = modeValue(row, mode);
      modelTotal += value.model;
      realTotal += value.real;
      totalCalls += row.rc;
      totalDist += row.rd;
    }
    const diff = realTotal - modelTotal;
    return {
      modelTotal,
      realTotal,
      diff,
      netReal: totalDist - totalCalls,
      totalCalls,
      totalDist,
      dpi: totalCalls > 0 ? totalDist / totalCalls : null,
      fundCount: new Set(visibleRows.map((row) => row.fund)).size,
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
    let modeled = 0;
    let unmodeled = 0;
    for (const v of byFund.values()) {
      if (!v.real) continue;
      if (!v.model) unmodeled += 1;
      else modeled += 1;
    }
    return {
      modeled,
      unmodeled,
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

  const capitalSummary = useMemo(() => {
    const fundsInView = new Set(visibleRows.map((row) => row.fund));
    let committed = 0;
    for (const f of fundsInView) committed += Number(mergedCommitted?.[f] ?? 0) || 0;
    const called = Number(kpis.totalCalls) || 0;
    const pending = committed > 0 ? Math.max(committed - called, 0) : 0;
    const utilPct = committed > 0 ? (called / committed) * 100 : null;
    return { committed, called, pending, utilPct };
  }, [kpis.totalCalls, mergedCommitted, visibleRows]);

  // NOTE: mergedCommitted defined above (clears null/0 overrides).
  const entityMetaByName = useMemo(() => {
    const map = {};
    if (Array.isArray(rawCapitalCalls)) {
      rawCapitalCalls.forEach((row) => {
        if (!row?.fons) return;
        const raw = String(row.fons);
        const canonical = FUND_NAME_MAP[raw] ?? raw;
        const vehicleTipus = row?.vehicleTipus ? String(row.vehicleTipus) : null;
        const id = row?.id ? String(row.id) : null;
        if (id && vehicleTipus) {
          if (!map[raw]) map[raw] = { id, vehicleTipus };
          if (!map[canonical]) map[canonical] = { id, vehicleTipus };
        }
      });
    }
    return map;
  }, [rawCapitalCalls]);

  const periodBanner = useMemo(() => {
    const totals = {
      closed: { mc: 0, rc: 0, md: 0, rd: 0 },
      current: { mc: 0, rc: 0, md: 0, rd: 0 },
      fwd: { mc: 0, rc: 0, md: 0, rd: 0 },
    };
    for (const row of cashData.rows) {
      if (fund !== "all" && row.fund !== fund) continue;
      const bucket = totals[periodOf(row.year)];
      if (row.type === "calls") {
        bucket.mc += row.model;
        bucket.rc += row.real;
      } else {
        bucket.md += row.model;
        bucket.rd += row.real;
      }
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
     fund,
     tableType,
     visibleYears,
     yearFilters,
     vintageFilter,
     sort,
  }), [cashData.rows, cashData.firstCall, fund, mergedCommitted, sort, tableType, visibleYears, vintageFilter, yearFilters]);

  const isReFund = useMemo(() => buildReFundMatcher(rawCapitalCalls), [rawCapitalCalls]);

  // Add funds that have real flows but no forecast rows yet so they show up as "unmodeled"
  // and can be modeled without first seeding the forecast table manually.
  useEffect(() => {
    if (loading || dirty) return;
    if (!Array.isArray(rawCapitalCalls) || rawCapitalCalls.length === 0) return;

    const flowCats = new Set(["Capital Call", "Distribució", "Retorn Capital"]);
    const actualYears = [];
    const fundToVehicleId = {};
    for (const row of rawCapitalCalls) {
      const rawFund = String(row?.fons ?? "").trim();
      const fund = FUND_NAME_MAP[rawFund] ?? rawFund;
      if (!fund || isReFund(rawFund) || isReFund(fund)) continue;
      if (!flowCats.has(String(row?.cat ?? "").trim())) continue;
      const concept = normalizeCapitalCallTipus(row?.tipus);
      if (EXCLUDED_CASH_MODEL_TIPUS.has(concept)) continue;
      // Keep "unmodeled actuals" consistent with the cash model: calls are Aportació-only.
      // If tipus is missing/null but cat is Capital Call, treat it as Aportació for coverage.
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
        if (!nextFunds[fund]) {
          nextFunds[fund] = { model_calls: {}, model_dist: {} };
          didChange = true;
        }
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
            nextYears = desired;
            didChange = true;
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
        if (!next[fund] && vehicleId) {
          next[fund] = vehicleId;
          changed = true;
        }
      }
      return changed ? next : current;
    });

  }, [dirty, isReFund, loading, rawCapitalCalls]);

  // Map fund canonical name → proper route ID (vcpe:id or slugified fons) for FundDetail links.
  // Built from rawCapitalCalls so the format matches what FundDetail expects.
  const fundRouteIds = useMemo(() => {
    const map = {};
    if (Array.isArray(rawCapitalCalls)) {
      rawCapitalCalls.forEach((row) => {
        if (!row?.fons) return;
        const raw = String(row.fons);
        const canonical = FUND_NAME_MAP[raw] ?? raw;
        if (!map[raw]) map[raw] = makeFundRouteId(row);
        if (!map[canonical]) map[canonical] = makeFundRouteId(row);
      });
    }
    return map;
  }, [rawCapitalCalls]);

  const editorFundNames = useMemo(() => (
    Object.keys(scopedEditorData.funds)
      .filter((name) => !isReFund(name))
      .filter((name) => !editorSearch || name.toLowerCase().includes(editorSearch.toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
  ), [editorSearch, isReFund, scopedEditorData.funds]);

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

  const resetDraft = useCallback(() => {
    setEditorData(fetchedRef.current);
    setDirty(false);
  }, []);

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
      const row = [`"${fundName.replaceAll('"', '""')}"`, data.committed || 0, ...editorData.years.map((year) => numberAtYear(data[key], year))];
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
          <Segmented
            tc={tc}
            value={view}
            onChange={setView}
            options={[
              { id: "dashboard", label: "Dashboard" },
              { id: "editor", label: "Editor" },
            ]}
          />
          {dirty && (
            <button onClick={saveAndApply} disabled={saving} style={buttonStyle(tc, dirty && !saving)}>
              {saving ? "Desant..." : "Aplica i desa"}
            </button>
          )}
          {saveError && (
            <div style={{ color: "#c00", fontSize: 12, alignSelf: "center" }}>{saveError}</div>
          )}
        </div>
      </div>

      {view === "dashboard" ? (
        <>
          <Toolbar tc={tc}>
            <ToolbarLabel tc={tc}>Entitats</ToolbarLabel>
            <Segmented
              tc={tc}
              value={entityScope}
              onChange={setEntityScope}
              options={[
                { id: "funds", label: "Fons" },
                { id: "companies", label: "Companyies" },
              ]}
            />
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
              <ReactECharts option={mainChartOption({ rows: yearAgg, mode, tc, dark })} style={{ height: 300 }} opts={{ renderer: "canvas" }} />
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
                <ReactECharts option={cumulativeChartOption({ rows: yearAgg, mode, tc, dark })} style={{ height: 240 }} opts={{ renderer: "canvas" }} />
              </ChartCard>
              <ChartCard tc={tc} title="Desviacio % per any">
                <ReactECharts option={deviationChartOption({ rows: yearAgg, mode, tc, dark })} style={{ height: 240 }} opts={{ renderer: "canvas" }} />
              </ChartCard>
              <ChartCard tc={tc} title="Top 25 fons - desviacio total" wide>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                  <Segmented tc={tc} value={devMetric} onChange={setDevMetric} options={[{ id: "eur", label: "€" }, { id: "pct", label: "%" }]} />
                </div>
                <ReactECharts option={fundDeviationChartOption({ rows: fundAgg, mode, tc, dark, metric: devMetric })} style={{ height: 320 }} opts={{ renderer: "canvas" }} />
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

function aggregateByYear(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.year)) map.set(row.year, { year: row.year, mc: 0, rc: 0, md: 0, rd: 0 });
    const target = map.get(row.year);
    if (row.type === "calls") {
      target.mc += row.model;
      target.rc += row.real;
    } else {
      target.md += row.model;
      target.rd += row.real;
    }
  });
  return [...map.values()].sort((a, b) => a.year - b.year);
}

function aggregateByFund(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.fund)) map.set(row.fund, { fund: row.fund, mc: 0, rc: 0, md: 0, rd: 0 });
    const target = map.get(row.fund);
    if (row.type === "calls") {
      target.mc += row.model;
      target.rc += row.real;
    } else {
      target.md += row.model;
      target.rd += row.real;
    }
  });
  return [...map.values()];
}

function buildTable({ rows, committed, firstCall, fund, tableType, visibleYears, yearFilters, vintageFilter, sort }) {
  const paidIn = {};
  rows.forEach((row) => {
    if (row.type !== "calls") return;
    if (fund !== "all" && row.fund !== fund) return;
    paidIn[row.fund] = (paidIn[row.fund] ?? 0) + row.real;
  });

  const byFund = new Map();
  rows.forEach((row) => {
    if (tableType !== "net" && row.type !== tableType) return;
    if (fund !== "all" && row.fund !== fund) return;
    if (!byFund.has(row.fund)) byFund.set(row.fund, {});
    const yearData = byFund.get(row.fund);
    if (!yearData[row.year]) yearData[row.year] = { model: 0, real: 0 };
    const sign = tableType === "net" ? (row.type === "dist" ? 1 : -1) : 1;
    yearData[row.year].model += row.model * sign;
    yearData[row.year].real += row.real * sign;
  });

  const selectedYears = [...yearFilters].sort((a, b) => a - b);
  let tableRows = [...byFund.entries()].map(([fundName, yearData]) => {
    let totalModel = 0;
    let totalReal = 0;
    Object.values(yearData).forEach((value) => {
      totalModel += value.model;
      totalReal += value.real;
    });
    const deltaModel = selectedYears.reduce((sum, year) => sum + (yearData[year]?.model ?? 0), 0);
    const deltaReal = selectedYears.reduce((sum, year) => sum + (yearData[year]?.real ?? 0), 0);
    return {
      fund: fundName,
      yearData,
      totalModel,
      totalReal,
      dev: totalReal - totalModel,
      devAbs: Math.abs(totalReal - totalModel),
      committed: committed[fundName] ?? 0,
      paidIn: paidIn[fundName] ?? 0,
      paidInPct: committed[fundName] ? ((paidIn[fundName] ?? 0) / committed[fundName]) * 100 : 0,
      vintage: firstCall[fundName] ?? null,
      deltaReal,
      deltaDev: deltaReal - deltaModel,
    };
  });

  if (vintageFilter != null) tableRows = tableRows.filter((row) => row.vintage === vintageFilter);
  if (selectedYears.length) tableRows = tableRows.filter((row) => selectedYears.some((year) => row.yearData[year]?.model || row.yearData[year]?.real));

  tableRows.sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "fund") return dir * a.fund.localeCompare(b.fund);
    if (/^r\d{4}$/.test(sort.key)) {
      const year = Number(sort.key.slice(1));
      return dir * ((a.yearData[year]?.real ?? 0) - (b.yearData[year]?.real ?? 0));
    }
    return dir * ((a[sort.key] ?? 0) - (b[sort.key] ?? 0));
  });

  const totals = {
    totalModel: 0,
    totalReal: 0,
    committed: 0,
    paidIn: 0,
    deltaReal: 0,
    deltaDev: 0,
    byYear: Object.fromEntries(visibleYears.map((year) => [year, { model: 0, real: 0 }])),
  };
  tableRows.forEach((row) => {
    totals.totalModel += row.totalModel;
    totals.totalReal += row.totalReal;
    totals.committed += row.committed;
    totals.paidIn += row.paidIn;
    totals.deltaReal += row.deltaReal;
    totals.deltaDev += row.deltaDev;
    visibleYears.forEach((year) => {
      totals.byYear[year].model += row.yearData[year]?.model ?? 0;
      totals.byYear[year].real += row.yearData[year]?.real ?? 0;
    });
  });
  totals.dev = totals.totalReal - totals.totalModel;
  totals.paidInPct = totals.committed ? (totals.paidIn / totals.committed) * 100 : null;

  return { rows: tableRows, totals, selectedYears };
}

function mainChartOption({ rows, mode, tc, dark }) {
  const t = ecTheme(tc);
  const years = rows.map((row) => row.year);
  const model = rows.map((row) => modeValue(row, mode).model);
  const real = rows.map((row) => modeValue(row, mode).real);
  return {
    grid: { top: 16, right: 12, bottom: 38, left: 8, containLabel: true },
    tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: fmtK },
    legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
    xAxis: { type: "category", data: years, axisLabel: { ...t.axisLabel, fontSize: 10 }, axisLine: t.axisLine, axisTick: t.axisTick },
    yAxis: { type: "value", axisLabel: { ...t.axisLabel, formatter: (value) => fmtK(value, 0) }, splitLine: t.splitLine },
    series: [
      { name: "Model", type: "bar", data: model, itemStyle: { color: dark ? "rgba(148,163,184,.35)" : "rgba(107,142,166,.28)", borderRadius: [4, 4, 0, 0] }, barMaxWidth: 30 },
      { name: "Real", type: "bar", data: real, itemStyle: { color: (params) => periodColor(tc, years[params.dataIndex]), borderRadius: [4, 4, 0, 0] }, barMaxWidth: 30 },
    ],
  };
}

function cumulativeChartOption({ rows, mode, tc }) {
  const t = ecTheme(tc);
  const years = rows.map((row) => row.year);
  let modelAcc = 0;
  let realAcc = 0;
  const model = [];
  const real = [];
  rows.forEach((row) => {
    const value = modeValue(row, mode);
    modelAcc += value.model;
    realAcc += value.real;
    model.push(modelAcc);
    real.push(realAcc);
  });
  return {
    grid: { top: 16, right: 12, bottom: 38, left: 8, containLabel: true },
    tooltip: { ...t.tooltip, trigger: "axis", valueFormatter: fmtK },
    legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
    xAxis: { type: "category", data: years, axisLabel: t.axisLabel, axisLine: t.axisLine, axisTick: t.axisTick },
    yAxis: { type: "value", axisLabel: { ...t.axisLabel, formatter: (value) => fmtK(value, 0) }, splitLine: t.splitLine },
    series: [
      { name: "Model", type: "line", data: model, smooth: true, showSymbol: false, lineStyle: { color: tc.textLight, type: "dashed", width: 2 } },
      { name: "Real", type: "line", data: real, smooth: true, symbolSize: 6, lineStyle: { color: tc.navy, width: 2.5 }, itemStyle: { color: tc.green } },
    ],
  };
}

function deviationChartOption({ rows, mode, tc }) {
  const t = ecTheme(tc);
  const years = rows.map((row) => row.year);
  const data = rows.map((row) => {
    const value = modeValue(row, mode);
    return value.model ? ((value.real - value.model) / Math.abs(value.model)) * 100 : null;
  });
  return {
    grid: { top: 16, right: 12, bottom: 28, left: 8, containLabel: true },
    tooltip: { ...t.tooltip, trigger: "axis", valueFormatter: (value) => (value == null ? "--" : `${Number(value).toFixed(1)}%`) },
    xAxis: { type: "category", data: years, axisLabel: t.axisLabel, axisLine: t.axisLine, axisTick: t.axisTick },
    yAxis: { type: "value", axisLabel: { ...t.axisLabel, formatter: (value) => `${value}%` }, splitLine: t.splitLine },
    series: [
      { type: "bar", data, itemStyle: { color: (params) => periodOf(years[params.dataIndex]) === "fwd" ? tc.textLight : params.value >= 0 ? tc.green : tc.red, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 32 },
    ],
  };
}

function fundDeviationChartOption({ rows, mode, tc, metric = "eur" }) {
  const t = ecTheme(tc);
  const top = rows
    .map((row) => {
      const devEur = mode === "calls" ? row.rc - row.mc : mode === "dist" ? row.rd - row.md : (row.rd - row.rc) - (row.md - row.mc);
      const modelBase = mode === "calls" ? row.mc : mode === "dist" ? row.md : row.mc + row.md;
      const value = metric === "pct" && modelBase !== 0 ? (devEur / Math.abs(modelBase)) * 100 : devEur;
      return { fund: row.fund, value, devEur };
    })
    .filter((row) => Math.abs(row.devEur) > 100)
    .sort((a, b) => Math.abs(b.devEur) - Math.abs(a.devEur))
    .slice(0, 25)
    .reverse();
  const fmtAxis = metric === "pct" ? (v) => `${v.toFixed(0)}%` : (v) => fmtK(v, 0);
  const fmtTip = metric === "pct" ? (v) => `${v.toFixed(1)}%` : fmtK;
  return {
    grid: { top: 8, right: 14, bottom: 34, left: 210, containLabel: false },
    tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: fmtTip },
    xAxis: { type: "value", axisLabel: { ...t.axisLabel, formatter: fmtAxis }, splitLine: t.splitLine },
    yAxis: { type: "category", data: top.map((row) => row.fund.length > 38 ? `${row.fund.slice(0, 38)}...` : row.fund), axisLabel: { ...t.axisLabel, fontSize: 10 }, axisTick: t.axisTick, axisLine: t.axisLine },
    series: [
      { type: "bar", data: top.map((row) => row.value), itemStyle: { color: (params) => params.value >= 0 ? tc.green : tc.red, borderRadius: [0, 4, 4, 0] }, barMaxWidth: 14 },
    ],
  };
}

function periodColor(tc, year) {
  const period = periodOf(year);
  if (period === "closed") return tc.green;
  if (period === "current") return tc.warning;
  return tc.textLight;
}

function colorFor(tc, color) {
  if (color === "green") return tc.green;
  if (color === "yellow") return tc.warning;
  return tc.textLight;
}

function Kpi({ tc, label, value, color, sub, muted }) {
  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8, padding: "13px 15px", boxShadow: tc.shadows?.card }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: tc.textLight, fontWeight: 700 }}>{label}</div>
      <div className="num" style={{ fontSize: 20, fontWeight: 750, color: muted ? tc.textLight : color ?? tc.navy, marginTop: 5 }}>{value}</div>
      {sub ? <div style={{ fontSize: 10, color: tc.textLight, marginTop: 3 }}>{sub}</div> : null}
    </div>
  );
}

function ChartCard({ tc, title, children, wide = false }) {
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : undefined, background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8, padding: 14, boxShadow: tc.shadows?.card }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: tc.textLight, fontWeight: 750, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Toolbar({ tc, children }) {
  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", boxShadow: tc.shadows?.sm }}>
      {children}
    </div>
  );
}

function ToolbarLabel({ tc, children }) {
  return <span style={{ fontSize: 11, color: tc.textLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{children}</span>;
}

function Segmented({ tc, value, onChange, options }) {
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${tc.border}`, borderRadius: 7, overflow: "hidden", background: tc.bg }}>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            style={{
              border: "none",
              borderRight: option === options[options.length - 1] ? "none" : `1px solid ${tc.border}`,
              background: active ? tc.navy : "transparent",
              color: active ? "#fff" : tc.textMid,
              padding: "6px 11px",
              fontSize: 12,
              fontWeight: active ? 700 : 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PeriodPill({ tc, active, color, label, onClick }) {
  const c = colorFor(tc, color);
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${c}`,
        color: c,
        background: active ? `${c}18` : "transparent",
        opacity: active ? 1 : 0.45,
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

function CashTable({ tc, table, tableType, setTableType, allYears, visibleYears, yearFilters, setYearFilters, vintageFilter, setVintageFilter, sort, setSort, fundRouteIds = {}, entityScope = "funds", entityText = { plural: "fons" }, entityMetaByName = {} }) {
  const hasYearFilter = yearFilters.size > 0;
  const setSortKey = (key) => {
    setSort((current) => ({ key, dir: current.key === key && current.dir === "desc" ? "asc" : "desc" }));
  };
  const toggleYear = (year, multi) => {
    setYearFilters((current) => {
      const next = new Set(multi ? current : []);
      if (current.size === 1 && current.has(year) && !multi) return new Set();
      next.has(year) ? next.delete(year) : next.add(year);
      return next;
    });
  };

  const entityColLabel = entityScope === "companies" ? "Companyia" : "Fons";
  const rowLink = (name) => {
    const meta = entityMetaByName?.[name] ?? null;
    if (entityScope === "companies" && meta?.id) {
      if (meta.vehicleTipus === "PC") return `/company/${encodeURIComponent(meta.id)}`;
      if (meta.vehicleTipus === "SF") return `/searcher/${encodeURIComponent(meta.id)}`;
    }
    if (fundRouteIds?.[name]) return `/fund/${encodeURIComponent(fundRouteIds[name])}`;
    return null;
  };

  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8, overflow: "hidden", boxShadow: tc.shadows?.card }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: `1px solid ${tc.border}`, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: tc.textLight, fontWeight: 750 }}>Detall per {entityText.plural}</div>
        <Segmented tc={tc} value={tableType} onChange={setTableType} options={[{ id: "calls", label: "Calls" }, { id: "dist", label: "Distribucions" }, { id: "net", label: "Net CF" }]} />
        {vintageFilter != null && (
          <button onClick={() => setVintageFilter(null)} style={buttonStyle(tc)}>
            Treure vintage {vintageFilter}
          </button>
        )}
      </div>
      <div style={{ padding: "9px 14px", borderBottom: `1px solid ${tc.border}`, background: tc.bgAlt, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: tc.textLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Anys</span>
        {allYears.map((year) => {
          const active = visibleYears.includes(year);
          const selected = yearFilters.has(year);
          const color = periodColor(tc, year);
          return (
            <button
              key={year}
              onClick={(event) => toggleYear(year, event.ctrlKey || event.metaKey)}
              style={{ border: `1px solid ${selected ? tc.navy : `${color}66`}`, color: selected ? tc.navy : color, background: selected ? `${tc.navy}18` : "transparent", opacity: active ? 1 : 0.35, borderRadius: 999, padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
              title="Clic selecciona; Ctrl/Cmd afegeix a la seleccio"
            >
              {year}
            </button>
          );
        })}
        {hasYearFilter ? <button onClick={() => setYearFilters(new Set())} style={buttonStyle(tc)}>Tots</button> : null}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <Th tc={tc} onClick={() => setSortKey("fund")} active={sort.key === "fund"} dir={sort.dir} align="left">{entityColLabel}</Th>
              <Th tc={tc} onClick={() => setSortKey("committed")} active={sort.key === "committed"} dir={sort.dir}>Comp.</Th>
              {visibleYears.map((year) => <Th key={year} tc={tc} onClick={() => setSortKey(`r${year}`)}>{year}</Th>)}
              {hasYearFilter ? (
                <>
                  <Th tc={tc} onClick={() => setSortKey("deltaReal")} active={sort.key === "deltaReal"} dir={sort.dir}>Real</Th>
                  <Th tc={tc} onClick={() => setSortKey("deltaDev")} active={sort.key === "deltaDev"} dir={sort.dir}>Delta Dev</Th>
                </>
              ) : null}
              <Th tc={tc} onClick={() => setSortKey("totalReal")} active={sort.key === "totalReal"} dir={sort.dir}>Σ Real</Th>
              <Th tc={tc} onClick={() => setSortKey("paidInPct")} active={sort.key === "paidInPct"} dir={sort.dir}>%Comp</Th>
              <Th tc={tc} onClick={() => setSortKey("totalModel")} active={sort.key === "totalModel"} dir={sort.dir}>Σ Model</Th>
              <Th tc={tc} onClick={() => setSortKey("dev")} active={sort.key === "dev"} dir={sort.dir}>Desv.</Th>
            </tr>
          </thead>
          <tbody>
            {table.rows.slice(0, 80).map((row) => (
              <tr key={row.fund} className="hoverable">
                <td style={tdStyle(tc, "left")}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontWeight: 700 }}>
                    {rowLink(row.fund)
                      ? <Link to={rowLink(row.fund)} title={row.fund} style={{ color: tc.navy, textDecoration: "none" }}>{row.fund.length > 32 ? `${row.fund.slice(0, 32)}...` : row.fund}</Link>
                      : <span title={row.fund}>{row.fund.length > 32 ? `${row.fund.slice(0, 32)}...` : row.fund}</span>}
                    {PROSPECTIVE_CASH_USD_FUNDS.has(row.fund) ? <MiniTag tc={tc}>USD</MiniTag> : null}
                    {row.totalReal && !row.totalModel ? <MiniTag tc={tc}>Unmodeled</MiniTag> : null}
                    {row.vintage ? <button onClick={() => setVintageFilter(row.vintage)} style={vintageStyle(tc, row.vintage)}>{row.vintage}</button> : null}
                  </div>
                </td>
                <td style={tdStyle(tc)}>{fmtC(row.committed)}</td>
                {visibleYears.map((year) => {
                  const cell = row.yearData[year] ?? { model: 0, real: 0 };
                  const base = tableType === "calls" ? row.committed : row.paidIn;
                  const pctValue = base && cell.real ? (cell.real / base) * 100 : null;
                  return <YearCell key={year} tc={tc} year={year} model={cell.model} real={cell.real} pctValue={pctValue} />;
                })}
                {hasYearFilter ? (
                  <>
                    <td style={tdStyle(tc)}><strong style={{ color: tc.navy }}>{fmtC(row.deltaReal)}</strong></td>
                    <td style={tdStyle(tc)}><span style={{ color: row.deltaDev >= 0 ? tc.green : tc.red, fontWeight: 700 }}>{signed(row.deltaDev)}</span></td>
                  </>
                ) : null}
                <td style={tdStyle(tc)}><strong style={{ color: tc.green }}>{fmtC(row.totalReal)}</strong></td>
                <td style={tdStyle(tc)}>{row.paidInPct ? `${row.paidInPct.toFixed(1)}%` : ""}</td>
                <td style={tdStyle(tc)}>{fmtC(row.totalModel)}</td>
                <td style={tdStyle(tc)}><span style={{ color: row.dev >= 0 ? tc.green : tc.red, fontWeight: 750 }}>{signed(row.dev)}</span></td>
              </tr>
            ))}
            <tr style={{ background: tc.bgAlt, fontWeight: 750 }}>
              <td style={tdStyle(tc, "left")}>Σ TOTAL ({table.rows.length} {entityText.plural})</td>
              <td style={tdStyle(tc)}>{fmtC(table.totals.committed)}</td>
              {visibleYears.map((year) => {
                const cell = table.totals.byYear[year] ?? { model: 0, real: 0 };
                const base = tableType === "calls" ? table.totals.committed : table.totals.paidIn;
                return <YearCell key={year} tc={tc} year={year} model={cell.model} real={cell.real} pctValue={base && cell.real ? (cell.real / base) * 100 : null} total />;
              })}
              {hasYearFilter ? (
                <>
                  <td style={tdStyle(tc)}><strong style={{ color: tc.navy }}>{fmtC(table.totals.deltaReal)}</strong></td>
                  <td style={tdStyle(tc)}><span style={{ color: table.totals.deltaDev >= 0 ? tc.green : tc.red }}>{signed(table.totals.deltaDev)}</span></td>
                </>
              ) : null}
              <td style={tdStyle(tc)}><strong style={{ color: tc.green }}>{fmtC(table.totals.totalReal)}</strong></td>
              <td style={tdStyle(tc)}>{table.totals.paidInPct ? `${table.totals.paidInPct.toFixed(1)}%` : ""}</td>
              <td style={tdStyle(tc)}>{fmtC(table.totals.totalModel)}</td>
              <td style={tdStyle(tc)}><span style={{ color: table.totals.dev >= 0 ? tc.green : tc.red }}>{signed(table.totals.dev)}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ tc, children, onClick, active, dir, align = "right" }) {
  return (
    <th onClick={onClick} style={{ padding: "9px 10px", textAlign: align, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: active ? tc.navy : tc.textLight, background: tc.bgAlt, borderBottom: `1px solid ${tc.border}`, whiteSpace: "nowrap", cursor: onClick ? "pointer" : "default" }}>
      {children}{active ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}

function YearCell({ tc, year, model, real, pctValue, total = false }) {
  let color = tc.text;
  if (real && model) color = real > model * 1.02 ? tc.green : real < model * 0.98 ? tc.red : tc.text;
  if (real && !model) color = tc.green;
  if (!real && model && periodOf(year) !== "fwd") color = tc.red;
  return (
    <td style={{ ...tdStyle(tc), background: periodBg(tc, year, total) }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <span style={{ fontSize: 10, color: tc.textLight }}>{model ? fmtC(model) : "-"}</span>
        <span style={{ fontSize: 12, fontWeight: 750, color }}>{real ? fmtC(real) : "-"}</span>
        {pctValue != null ? <span style={{ fontSize: 9, color: tc.textLight }}>{pctValue.toFixed(1)}%</span> : null}
      </div>
    </td>
  );
}

function EditorPanel({ tc, editorData, committedByFund, committedOverrides, paidInByFund, fundNames, editorType, setEditorType, editorSearch, setEditorSearch, updateFundValue, updateCommittedOverride, saveAndApply, exportEditorCsv, resetDraft, dirty, saving, editorInputMode, setEditorInputMode, fundRouteIds = {}, entityScope = "funds", setEntityScope = () => {}, entityText = { plural: "fons", searchPlaceholder: "Cercar..." }, entityMetaByName = {} }) {
  const key = `model_${editorType}`;
  const yearCols = editorData.years;
  const committedNorm = useMemo(() => {
    const m = {};
    Object.entries(committedByFund).forEach(([k, v]) => { m[k.trim().toLowerCase()] = v; });
    return m;
  }, [committedByFund]);
  const paidInNorm = useMemo(() => {
    const m = {};
    Object.entries(paidInByFund).forEach(([k, v]) => { m[k.trim().toLowerCase()] = v; });
    return m;
  }, [paidInByFund]);

  const entityColLabel = entityScope === "companies" ? "Companyia" : "Fons";
  const rowLink = (name) => {
    const meta = entityMetaByName?.[name] ?? null;
    if (entityScope === "companies" && meta?.id) {
      if (meta.vehicleTipus === "PC") return `/company/${encodeURIComponent(meta.id)}`;
      if (meta.vehicleTipus === "SF") return `/searcher/${encodeURIComponent(meta.id)}`;
    }
    if (fundRouteIds?.[name]) return `/fund/${encodeURIComponent(fundRouteIds[name])}`;
    return null;
  };

  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8, overflow: "hidden", boxShadow: tc.shadows?.card }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: 12, borderBottom: `1px solid ${tc.border}`, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: tc.textLight, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.07em" }}>Prediccio</span>
        <Segmented
          tc={tc}
          value={entityScope}
          onChange={setEntityScope}
          options={[
            { id: "funds", label: "Fons" },
            { id: "companies", label: "Companyies" },
          ]}
        />
        <Segmented tc={tc} value={editorType} onChange={setEditorType} options={[{ id: "calls", label: "Capital Calls" }, { id: "dist", label: "Distribucions" }]} />
        <Segmented tc={tc} value={editorInputMode} onChange={setEditorInputMode} options={[{ id: "eur", label: "€" }, { id: "pct", label: "%" }]} />
        <input value={editorSearch} onChange={(event) => setEditorSearch(event.target.value)} placeholder={entityText.searchPlaceholder} style={{ ...inputStyle(tc), width: 220 }} />
        <span style={{ fontSize: 11, color: tc.textLight }}>{fundNames.length} {entityText.plural}</span>
        <div style={{ flex: 1 }} />
        <button onClick={exportEditorCsv} style={buttonStyle(tc)}>CSV</button>
        <button onClick={resetDraft} style={buttonStyle(tc)}>Restaurar base</button>
        <button onClick={saveAndApply} disabled={saving} style={buttonStyle(tc, dirty && !saving)}>
          {saving ? "Desant..." : "Aplica i desa"}
        </button>
      </div>
      <div style={{ padding: "8px 12px", borderBottom: `1px solid ${tc.border}`, color: tc.textLight, fontSize: 12 }}>
        Els imports reals i els compromisos venen del model de capital calls del dashboard. Aquesta taula només edita la previsio de calls i distribucions.
      </div>
      <div style={{ overflow: "auto", maxHeight: "70vh" }}>
        <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <Th tc={tc} align="left">{entityColLabel}</Th>
              <Th tc={tc}>Base</Th>
              {yearCols.map((year) => <Th key={year} tc={tc}>{year}</Th>)}
              <Th tc={tc}>Total</Th>
            </tr>
          </thead>
          <tbody>
            {fundNames.map((fundName) => {
              const data = editorData.funds[fundName] ?? {};
              const values = data[key] ?? {};
              const normKey = fundName.trim().toLowerCase();
              const committed = committedByFund[fundName] ?? committedNorm[normKey] ?? data.committed ?? 0;
              const paidIn = paidInByFund[fundName] ?? paidInNorm[normKey] ?? 0;
              const base = editorType === "calls" ? Number(committed) || 0 : Number(paidIn) || 0;
              const inPct = editorInputMode === "pct" && base > 0;
              const total = Object.values(values).reduce((sum, value) => sum + (Number(value) || 0), 0);
              return (
                <tr key={fundName} className="hoverable">
                  <td style={{ ...tdStyle(tc, "left"), position: "sticky", left: 0, background: tc.card, zIndex: 1, fontWeight: 700 }}>
                    {rowLink(fundName)
                      ? <Link to={rowLink(fundName)} title={fundName} style={{ color: tc.navy, textDecoration: "none" }}>{fundName.length > 48 ? `${fundName.slice(0, 48)}...` : fundName}</Link>
                      : (fundName.length > 48 ? `${fundName.slice(0, 48)}...` : fundName)}
                  </td>
                  <td style={tdStyle(tc)}>
                    {editorType === "calls" ? (
                      <input
                        type="number"
                        value={Number(committedOverrides?.[fundName] ?? "") || ""}
                        onChange={(e) => updateCommittedOverride(fundName, e.target.value)}
                        style={{ ...editorNumberStyle(tc), width: 90 }}
                        placeholder="—"
                      />
                    ) : (
                      <span className="num" style={{ color: tc.textLight }}>{fmtC(base)}</span>
                    )}
                  </td>
                  {yearCols.map((year) => {
                    const value = numberAtYear(values, year);
                    const displayValue = inPct ? (value ? ((value / base) * 100).toFixed(1) : "") : (value || "");
                    const hint = inPct
                      ? (value ? fmtC(value) : null)
                      : (value && base ? `${((value / base) * 100).toFixed(1)}%` : null);
                    return (
                      <td key={year} style={{ ...tdStyle(tc), background: periodBg(tc, year) }}>
                        <input
                          type="number"
                          value={displayValue}
                          onChange={(event) => {
                            const raw = Number(event.target.value);
                            const stored = inPct ? (raw / 100) * base : raw;
                            updateFundValue(fundName, (draft) => ({ ...draft, [key]: yearMapValue(draft[key], year, stored || "") }));
                          }}
                          style={editorNumberStyle(tc)}
                        />
                        {hint ? <div style={{ fontSize: 9, color: tc.textLight }}>{hint}</div> : null}
                      </td>
                    );
                  })}
                  <td style={tdStyle(tc)}>
                    <strong>{inPct ? `${((total / base) * 100).toFixed(1)}%` : fmtC(total)}</strong>
                    {inPct && <div style={{ fontSize: 9, color: tc.textLight }}>{fmtC(total)}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniTag({ tc, children }) {
  return <span style={{ fontSize: 9, color: tc.textLight, border: `1px solid ${tc.border}`, background: tc.bgAlt, borderRadius: 4, padding: "1px 4px" }}>{children}</span>;
}

function tdStyle(tc, align = "right") {
  return { padding: "7px 10px", textAlign: align, borderBottom: `1px solid ${tc.border}`, color: tc.text, verticalAlign: "middle", whiteSpace: "nowrap" };
}

function periodBg(tc, year, total = false) {
  const period = periodOf(year);
  const alpha = total ? "22" : "12";
  if (period === "closed") return `${tc.green}${alpha}`;
  if (period === "current") return `${tc.warning}${alpha}`;
  return `${tc.textLight}${total ? "18" : "0D"}`;
}

function vintageStyle(tc, year) {
  const color = year <= 2020 ? tc.textLight : year <= 2022 ? tc.navy : year <= 2024 ? tc.green : tc.warning;
  return { fontSize: 9, fontWeight: 750, color, background: "transparent", border: `1px solid ${color}88`, padding: "1px 5px", borderRadius: 4, cursor: "pointer" };
}

function periodCardStyle(tc, color, active) {
  const c = colorFor(tc, color);
  return { background: tc.card, border: `1px solid ${active ? `${c}88` : tc.border}`, borderRadius: 8, padding: "12px 14px", opacity: active ? 1 : 0.55, boxShadow: tc.shadows?.sm };
}

function selectStyle(tc) {
  return { background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text, borderRadius: 7, padding: "6px 9px", fontSize: 12, fontFamily: "inherit", minWidth: 220 };
}

function inputStyle(tc) {
  return { background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text, borderRadius: 7, padding: "7px 9px", fontSize: 12, fontFamily: "inherit" };
}

function editorNumberStyle(tc) {
  return { ...inputStyle(tc), width: 96, textAlign: "right", padding: "5px 7px" };
}

function buttonStyle(tc, primary = false) {
  return { border: primary ? "none" : `1px solid ${tc.border}`, background: primary ? tc.navy : "transparent", color: primary ? "#fff" : tc.textMid, borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" };
}
