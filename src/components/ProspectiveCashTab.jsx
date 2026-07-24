import { useTheme } from "../theme.js";
import {
  fmtK,
  pct,
  signed,
  colorFor,
  selectStyle,
  buttonStyle,
} from "./prospective/prospectiveUtils.js";
import { PROSPECTIVE_CASH_MODES as MODES, PROSPECTIVE_CASH_PERIODS as PERIODS } from "./prospective/prospectiveCashConstants.js";
import { useProspectiveCashData } from "./prospective/useProspectiveCashData.js";
import { Kpi, ChartCard, Toolbar, ToolbarLabel, Segmented, PeriodPill } from "./prospective/ProspectivePrimitives.jsx";
import { MainChart, CumulativeChart, DeviationChart, FundDeviationChart } from "./prospective/ProspectiveCharts.jsx";
import { CashTable } from "./prospective/CashTable.jsx";
import { EditorPanel } from "./prospective/EditorPanel.jsx";

export function ProspectiveCashTab({ rawCapitalCalls = [], fundMeta = [], forceScope }) {
  const { tc, dark } = useTheme();
  const {
    editorData,
    loading,
    fetchError,
    saveError,
    saving,
    dirty,
    mergedCommitted,
    fundOptions,
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
    table,
    editorFundNames,
    saveAndApply,
    resetDraft,
    updateFundValue,
    updateCommittedOverride,
    exportEditorCsv,
    fundRouteIds,
    entityMetaByName,
    committedOverrides,
    entityScope,
    setEntityScope,
    entityText,
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
  } = useProspectiveCashData({ rawCapitalCalls, fundMeta, forceScope });

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
                <Segmented tc={tc} value={entityScope} onChange={setEntityScope} options={[{ id: "all", label: "Tots" }, { id: "funds", label: "Vehicles" }, { id: "companies", label: "Companyies" }]} />
              </>
            )}
            <ToolbarLabel tc={tc}>Vista</ToolbarLabel>
            <Segmented tc={tc} value={mode} onChange={(v) => { setMode(v); setTableType(v); }} options={MODES} />
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
              setTableType={(v) => { setTableType(v); setMode(v); }}
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
          showScope={!forceScope}
          entityText={entityText}
          entityMetaByName={entityMetaByName}
        />
      )}
    </div>
  );
}
