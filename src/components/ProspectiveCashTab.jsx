import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { useTheme } from "../theme.js";
import { fetchProspectiveCashForecasts, saveProspectiveCashForecasts } from "../db.js";
import {
  PROSPECTIVE_CASH_USD_FUNDS,
  buildReFundMatcher,
  deriveProspectiveCashRows,
  editorDataToForecastRows,
  forecastRowsToEditorData,
} from "../data/prospectiveCashModel.js";

const MODES = [
  { id: "calls", label: "Capital Calls" },
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

function fmtK(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(digits)}M€`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(digits)}K€`;
  return `${n.toFixed(0)}€`;
}

function fmtC(value) {
  const n = Number(value) || 0;
  if (!n) return "";
  return fmtK(n, Math.abs(n) >= 1e6 ? 1 : 0);
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
  const cashData = useMemo(() => deriveProspectiveCashRows(editorData, rawCapitalCalls), [editorData, rawCapitalCalls]);
  const [view, setView] = useState("dashboard");
  const [mode, setMode] = useState("calls");
  const [tableType, setTableType] = useState("calls");
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

  useEffect(() => {
    let cancelled = false;
    fetchProspectiveCashForecasts()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setFetchError(error.message); setLoading(false); return; }
        const { editorData: derived, vehicleIds: ids } = forecastRowsToEditorData(data);
        fetchedRef.current = derived;
        setEditorData(derived);
        setVehicleIds(ids);
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

  const paidInByFund = useMemo(() => {
    const map = {};
    cashData.rows.forEach((row) => {
      if (row.type === "calls") map[row.fund] = (map[row.fund] ?? 0) + row.real;
    });
    return map;
  }, [cashData.rows]);

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
    committed: cashData.committed,
    firstCall: cashData.firstCall,
    fund,
    tableType,
    visibleYears,
    yearFilters,
    vintageFilter,
    sort,
  }), [cashData, fund, sort, tableType, visibleYears, vintageFilter, yearFilters]);

  const isReFund = useMemo(() => buildReFundMatcher(rawCapitalCalls), [rawCapitalCalls]);

  const editorFundNames = useMemo(() => (
    Object.keys(editorData.funds)
      .filter((name) => !isReFund(name))
      .filter((name) => !editorSearch || name.toLowerCase().includes(editorSearch.toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
  ), [editorData.funds, editorSearch, isReFund]);

  const saveAndApply = useCallback(async () => {
    setSaving(true);
    const rows = editorDataToForecastRows(editorData, vehicleIds);
    const { error } = await saveProspectiveCashForecasts(rows, Object.values(vehicleIds));
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    fetchedRef.current = editorData;
    setSaveError(null);
    setDirty(false);
    setView("dashboard");
  }, [editorData, vehicleIds]);

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
    model: mode === "calls" ? "Capital Calls" : mode === "dist" ? "Distribucions" : "Net Cash Flow",
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
            <ToolbarLabel tc={tc}>Fons</ToolbarLabel>
            <select value={fund} onChange={(event) => setFund(event.target.value)} style={selectStyle(tc)}>
              <option value="all">Tots els fons</option>
              {fundOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </Toolbar>

          <div className="grid-3" style={{ gap: 10 }}>
            {periodBanner.map((period) => (
              <div key={period.id} style={periodCardStyle(tc, period.color, periods[period.id])}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: colorFor(tc, period.color), fontWeight: 700 }}>{period.label}</div>
                <div style={{ fontSize: 16, fontWeight: 750, color: tc.text, marginTop: 6 }}>Real: {fmtK(period.real)}</div>
                <div style={{ fontSize: 11, color: tc.textLight, marginTop: 3 }}>
                  Model: {fmtK(period.model)} | Dev: <span style={{ color: period.diff >= 0 ? tc.green : tc.red }}>{signed(period.diff)}</span> ({pct(period.real, period.model)})
                </div>
              </div>
            ))}
          </div>

          <div className="grid-4" style={{ gap: 10 }}>
            <Kpi tc={tc} label={`Model ${text.model}`} value={fmtK(kpis.modelTotal)} muted />
            <Kpi tc={tc} label={`Real ${text.model}`} value={fmtK(kpis.realTotal)} color={mode === "dist" ? tc.green : tc.navy} />
            <Kpi tc={tc} label="Desviacio" value={signed(kpis.diff)} color={kpis.diff >= 0 ? tc.green : tc.red} sub={`${pct(kpis.realTotal, kpis.modelTotal)} vs model`} />
            <Kpi tc={tc} label="Net CF real" value={signed(kpis.netReal)} color={kpis.netReal >= 0 ? tc.green : tc.red} sub="Dist - Calls" />
            <Kpi tc={tc} label="Total Calls" value={fmtK(kpis.totalCalls)} color={tc.navy} />
            <Kpi tc={tc} label="Total Dist" value={fmtK(kpis.totalDist)} color={tc.green} />
            <Kpi tc={tc} label="DPI parcial" value={kpis.dpi == null ? "--" : `${kpis.dpi.toFixed(2)}x`} color={tc.warning} />
            <Kpi tc={tc} label="Fons" value={String(kpis.fundCount)} />
          </div>

          <div className="grid-2" style={{ gap: 12 }}>
            <ChartCard tc={tc} title={`${text.model} - Model vs Real`} wide>
              <ReactECharts option={mainChartOption({ rows: yearAgg, mode, tc, dark })} style={{ height: 290 }} opts={{ renderer: "canvas" }} />
            </ChartCard>
            <ChartCard tc={tc} title="Acumulat">
              <ReactECharts option={cumulativeChartOption({ rows: yearAgg, mode, tc, dark })} style={{ height: 260 }} opts={{ renderer: "canvas" }} />
            </ChartCard>
            <ChartCard tc={tc} title="Desviacio % per any">
              <ReactECharts option={deviationChartOption({ rows: yearAgg, mode, tc, dark })} style={{ height: 260 }} opts={{ renderer: "canvas" }} />
            </ChartCard>
            <ChartCard tc={tc} title="Top 25 fons - desviacio total" wide>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                <Segmented tc={tc} value={devMetric} onChange={setDevMetric} options={[{ id: "eur", label: "€" }, { id: "pct", label: "%" }]} />
              </div>
              <ReactECharts option={fundDeviationChartOption({ rows: fundAgg, mode, tc, dark, metric: devMetric })} style={{ height: 340 }} opts={{ renderer: "canvas" }} />
            </ChartCard>
          </div>

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
          />
        </>
      ) : (
        <EditorPanel
          tc={tc}
          editorData={editorData}
          committedByFund={cashData.committed}
          paidInByFund={paidInByFund}
          fundNames={editorFundNames}
          editorType={editorType}
          setEditorType={setEditorType}
          editorSearch={editorSearch}
          setEditorSearch={setEditorSearch}
          updateFundValue={updateFundValue}
          saveAndApply={saveAndApply}
          exportEditorCsv={exportEditorCsv}
          resetDraft={resetDraft}
          dirty={dirty}
          saving={saving}
          editorInputMode={editorInputMode}
          setEditorInputMode={setEditorInputMode}
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

function CashTable({ tc, table, tableType, setTableType, allYears, visibleYears, yearFilters, setYearFilters, vintageFilter, setVintageFilter, sort, setSort }) {
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
  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8, overflow: "hidden", boxShadow: tc.shadows?.card }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: `1px solid ${tc.border}`, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: tc.textLight, fontWeight: 750 }}>Detall per fons</div>
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
              <Th tc={tc} onClick={() => setSortKey("fund")} active={sort.key === "fund"} dir={sort.dir} align="left">Fons</Th>
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
                    <span title={row.fund}>{row.fund.length > 32 ? `${row.fund.slice(0, 32)}...` : row.fund}</span>
                    {PROSPECTIVE_CASH_USD_FUNDS.has(row.fund) ? <MiniTag tc={tc}>USD</MiniTag> : null}
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
              <td style={tdStyle(tc, "left")}>Σ TOTAL ({table.rows.length} fons)</td>
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

function EditorPanel({ tc, editorData, committedByFund, paidInByFund, fundNames, editorType, setEditorType, editorSearch, setEditorSearch, updateFundValue, saveAndApply, exportEditorCsv, resetDraft, dirty, saving, editorInputMode, setEditorInputMode }) {
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
  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8, overflow: "hidden", boxShadow: tc.shadows?.card }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: 12, borderBottom: `1px solid ${tc.border}`, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: tc.textLight, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.07em" }}>Prediccio</span>
        <Segmented tc={tc} value={editorType} onChange={setEditorType} options={[{ id: "calls", label: "Capital Calls" }, { id: "dist", label: "Distribucions" }]} />
        <Segmented tc={tc} value={editorInputMode} onChange={setEditorInputMode} options={[{ id: "eur", label: "€" }, { id: "pct", label: "%" }]} />
        <input value={editorSearch} onChange={(event) => setEditorSearch(event.target.value)} placeholder="Cercar fons..." style={{ ...inputStyle(tc), width: 220 }} />
        <span style={{ fontSize: 11, color: tc.textLight }}>{fundNames.length} fons</span>
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
              <Th tc={tc} align="left">Fons</Th>
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
                  <td style={{ ...tdStyle(tc, "left"), position: "sticky", left: 0, background: tc.card, zIndex: 1, fontWeight: 700 }}>{fundName.length > 48 ? `${fundName.slice(0, 48)}...` : fundName}</td>
                  <td style={tdStyle(tc)}>
                    <span className="num" style={{ color: tc.textLight }}>{fmtC(base)}</span>
                  </td>
                  {yearCols.map((year) => {
                    const value = numberAtYear(values, year);
                    const displayValue = inPct ? (value ? ((value / base) * 100).toFixed(2) : "") : (value || "");
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
