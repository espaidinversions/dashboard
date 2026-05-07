import React, { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { VCPE_CFG, EST_CFG } from "../config.js";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, fmtSignedM, readStoredJSON, readStoredFlag, formatMultiple, multipleColor, writeStoredJSON } from "../utils.js";
import { Badge, Logo, KpiCard, AddRowModal, SectionHeader, tableCardStyle } from "./SharedComponents.jsx";
import { loadCapitalCalls, loadFundMeta, updateCapitalCall } from "../db.js";
import { buildFundDetailSnapshot } from "../data/fundDetailModel.js";
import { CAPITAL_CALL_TIPUS_OPTIONS, inferCapitalCallCategoryFromTipus } from "../data/capitalCallTipusModel.js";
import { useAuth } from "../auth.jsx";

function FundDetailInner() {
  const { id } = useParams();
  const { tc, dark, toggle } = useTheme();
  const { canAccessSection, canEdit } = useAuth();
  const navigate = useNavigate();

  // 1. All useState calls — hoisted unconditionally before any return
  const [rawCC, setRawCC] = useState(() => readStoredJSON("tc_rawCC", []));
  const [fundMeta, setFundMeta] = useState(() => readStoredJSON("tc_fundMeta", []));
  const [txFilters, setTxFilters] = useState({ data: "", tipus: "Tots", import: "" });
  const [chartView, setChartView] = useState("quarterly");
  const [editingRow, setEditingRow] = useState(null);

  // 2. All useEffect / useMemo calls — hoisted unconditionally before any return
  useEffect(() => {
    Promise.all([loadCapitalCalls(), loadFundMeta()]).then(([capitalCalls, meta]) => {
      if (Array.isArray(capitalCalls)) {
        setRawCC(capitalCalls);
        writeStoredJSON("tc_rawCC", capitalCalls);
      }
      if (Array.isArray(meta)) {
        setFundMeta(meta);
        writeStoredJSON("tc_fundMeta", meta);
      }
    }).catch((error) => {
      console.error("Fund detail refresh failed:", error);
    });
  }, []);

  const detail = useMemo(() => buildFundDetailSnapshot(rawCC, fundMeta, id), [rawCC, fundMeta, id]);
  const txs = detail?.txs ?? [];

  // Destructure with ?? {} so these are safe before detail loads
  const { fundName, fundId, vcpe, est, compromis, calls, dist, net, utilPct, tvpiFund, dpiFund, rvpiFund, irrFund, txLog, recallablePool } = detail ?? {};

  const filteredTxLog = useMemo(() => (txLog ?? []).filter((r) => {
    if (txFilters.data && !String(r.data ?? "").includes(txFilters.data)) return false;
    if (txFilters.tipus !== "Tots" && r.tipus !== txFilters.tipus) return false;
    if (txFilters.import && !String(r.eur ?? "").includes(txFilters.import)) return false;
    return true;
  }), [txFilters, txLog]);
  const tipusOptions = useMemo(() => {
    const extras = (txLog ?? [])
      .map((row) => row.tipus)
      .filter((value) => value && !CAPITAL_CALL_TIPUS_OPTIONS.includes(value));
    return ["Tots", ...CAPITAL_CALL_TIPUS_OPTIONS, ...Array.from(new Set(extras)).sort()];
  }, [txLog]);

  // J-curve data: grouped by quarter or year; bars = period flows, line = cumulative net
  const jCurveData = useMemo(() => {
    const relevant = txs.filter(r =>
      r.cat === "Capital Call" || r.cat === "Distribució" || r.cat === "Retorn Capital"
    );
    const map = new Map();
    for (const r of relevant) {
      const [y, m] = r.data.split("-").map(Number);
      const key = chartView === "annual"
        ? String(y)
        : `Q${Math.ceil(m / 3)} ${y}`;
      if (!map.has(key)) map.set(key, { period: key, sortKey: chartView === "annual" ? y * 10 : y * 10 + Math.ceil(m / 3), calls: 0, dist: 0 });
      const entry = map.get(key);
      if (r.cat === "Capital Call") entry.calls += r.eur;
      else entry.dist += Math.abs(r.eur);
    }
    const sorted = Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
    let cumNet = 0;
    return sorted.map(p => {
      cumNet += p.dist - p.calls;
      return { period: p.period, calls: -p.calls, dist: p.dist, cumNet };
    });
  }, [txs, chartView]);

  // 3. Conditional returns — all hooks are above this point
  if (txs.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", padding: 32 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: tc.textLight, fontSize: 13, fontFamily: "inherit", padding: 0 }}>← Inversions</button>
        <div style={{ marginTop: 48, textAlign: "center", color: tc.textLight }}>Fons no trobat.</div>
      </div>
    );
  }

  const canAccessFund = vcpe === "RE" ? canAccessSection("real-estate") : canAccessSection("alternatives");
  if (!canAccessFund) {
    return (
      <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", padding: 32 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: tc.textLight, fontSize: 13, fontFamily: "inherit", padding: 0 }}>← Inversions</button>
        <div style={{ marginTop: 48, textAlign: "center", color: tc.textLight }}>No tens accés a aquest vehicle.</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14 }}>
      {/* Top bar */}
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 0 rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.05)" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}><Logo /></Link>
        <div style={{ flex: 1 }} />
        <button onClick={toggle} style={{ background: "transparent", border: `1.5px solid ${tc.border}`, borderRadius: 6, padding: "7px 12px", cursor: "pointer", fontSize: 16, color: tc.textMid, fontFamily: "inherit" }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>
      {/* Entity bar */}
      <div style={{ background: tc.navy, padding: "0 32px", display: "flex", alignItems: "center", gap: 12, minHeight: 48 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit", padding: 0 }}>← Inversions</button>
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>/</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fundName}</span>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {fundId && <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", borderRadius: 4, padding: "2px 8px", fontWeight: 600, fontFamily: "'DM Mono',monospace" }}>{fundId}</span>}
          <Badge label={vcpe} cfg={VCPE_CFG[vcpe] || {}} />
          <Badge label={est}  cfg={EST_CFG[est]   || {}} />
        </div>
      </div>

      <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* KPI cards */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <KpiCard label="Compromís"      value={compromis ? fmtM(compromis) : "—"} tc={tc} hero />
          <KpiCard label="Capital Cridat" value={fmtM(calls)} sub={utilPct ? `${utilPct} del compromís` : null} tc={tc} />
          <KpiCard label="Distribucions"  value={dist ? fmtM(dist) : "—"} tc={tc} />
          <KpiCard label="Net"            value={(net >= 0 ? "+" : "") + fmtM(net)} tc={tc} />
          <KpiCard label="TVPI" value={formatMultiple(tvpiFund)} sub="Inputat manualment" valueColor={multipleColor(tvpiFund, tc)} tc={tc} />
          <KpiCard label="IRR"  value={irrFund != null ? `${irrFund.toFixed(1)}%` : "—"} valueColor={multipleColor(tvpiFund, tc)} tc={tc} />
          <KpiCard label="DPI"  value={formatMultiple(dpiFund)}  valueColor={multipleColor(dpiFund, tc)}  tc={tc} />
          <KpiCard label="RVPI" value={formatMultiple(rvpiFund)} valueColor={multipleColor(rvpiFund, tc)} tc={tc} />
          {recallablePool > 0 && (
            <KpiCard label="Pool Recallable" value={fmtM(recallablePool)} valueColor={tc.green} tc={tc} />
          )}
        </div>

        {/* J-curve */}
        <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div>
            <SectionHeader title="J-curve" tc={tc} />
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {["quarterly", "annual"].map(v => (
                <button key={v} onClick={() => setChartView(v)}
                  style={{ padding: "4px 10px", borderRadius: 4, border: `1.5px solid ${chartView === v ? tc.green : tc.border}`, background: chartView === v ? (dark ? "#0A2010" : "#E8F8E8") : "transparent", color: chartView === v ? tc.green : tc.textLight, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: chartView === v ? 700 : 400 }}>
                  {v === "quarterly" ? "Trimestral" : "Anual"}
                </button>
              ))}
            </div>
          </div>
          {jCurveData.length === 0
            ? <div style={{ textAlign: "center", color: tc.textLight, padding: "32px 0" }}>Encara no hi ha aportacions registrades.</div>
            : (
              (() => {
                const t = ecTheme(tc);
                const option = {
                  grid: { top: 8, right: 16, bottom: 32, left: 0, containLabel: true },
                  tooltip: {
                    ...t.tooltip,
                    trigger: "axis",
                    axisPointer: { type: "shadow" },
                    formatter: params => {
                      const label = params[0]?.axisValue ?? "";
                      let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
                      params.forEach(p => {
                        if (p.value == null) return;
                        const name = p.seriesName === "calls" ? "Capital Cridat" : p.seriesName === "dist" ? "Distribucions" : "Net Acumulat";
                        html += `<div>${p.marker}${name}: ${(p.value < 0 ? "−" : "+") + fmtM(Math.abs(p.value))}</div>`;
                      });
                      return html;
                    },
                  },
                  xAxis: {
                    type: "category",
                    data: jCurveData.map(d => d.period),
                    axisLabel: { ...t.axisLabel, fontSize: 10 },
                    axisLine: t.axisLine,
                    axisTick: t.axisTick,
                  },
                  yAxis: {
                    type: "value",
                    axisLabel: { ...t.axisLabel, formatter: v => `${v < 0 ? "−" : ""}${fmtM(Math.abs(v))}` },
                    splitLine: t.splitLine,
                    axisLine: t.axisLine,
                    axisTick: t.axisTick,
                  },
                  series: [
                    {
                      name: "calls",
                      type: "bar",
                      data: jCurveData.map(d => d.calls),
                      itemStyle: { color: "#2B5070", opacity: 0.8 },
                      barMaxWidth: 28,
                    },
                    {
                      name: "dist",
                      type: "bar",
                      data: jCurveData.map(d => d.dist),
                      itemStyle: { color: "#3DC83E", opacity: 0.8 },
                      barMaxWidth: 28,
                    },
                    {
                      name: "cumNet",
                      type: "line",
                      data: jCurveData.map(d => d.cumNet),
                      lineStyle: { color: "#E8A020", width: 2 },
                      itemStyle: { color: "#E8A020" },
                      symbol: "circle",
                      symbolSize: 6,
                      connectNulls: true,
                      markLine: {
                        symbol: "none",
                        data: [{ yAxis: 0 }],
                        lineStyle: { color: tc.border, width: 1.5 },
                        label: { show: false },
                      },
                    },
                  ],
                };
                return <ReactECharts option={option} style={{ width: "100%", height: 260 }} opts={{ renderer: "canvas" }} />;
              })()
            )
          }
        </div>

        {/* Transaction log */}
        <div style={{ ...tableCardStyle(tc), overflowX: "auto" }}>
          <SectionHeader title={`Transaccions · ${(txLog ?? []).length}`} tc={tc} />
          {editingRow && (
            <AddRowModal
              title="Edita transacció"
              fields={[
                {
                  key: "tipus",
                  label: "Tipus Moviment",
                  type: "combo",
                  options: CAPITAL_CALL_TIPUS_OPTIONS,
                  defaultValue: editingRow.tipus,
                  hint: (values) => values.tipus
                    ? `Categoria: ${inferCapitalCallCategoryFromTipus(values.tipus, values.eur)}`
                    : null,
                },
                { key: "data", label: "Data", type: "date", defaultValue: editingRow.data },
                { key: "eur", label: "Import EUR", type: "number", defaultValue: Math.abs(editingRow.eur ?? 0) },
                { key: "comentaris", label: "Comentaris", type: "textarea", defaultValue: editingRow.comentaris ?? "", placeholder: "Observacions del moviment" },
                {
                  key: "recallable",
                  label: "Recallable (€)",
                  type: "number",
                  defaultValue: editingRow.recallable ?? "",
                  visible: (v) => inferCapitalCallCategoryFromTipus(v.tipus, v.eur) === "Distribució",
                },
                {
                  key: "from_recallable",
                  label: (() => {
                    const existingDraw = editingRow.from_recallable ?? 0;
                    const pool = Math.round(((recallablePool ?? 0) + Number(existingDraw)) * 100) / 100;
                    return `Des de pool recallable (€) — pool disponible: ${fmtM(pool)}`;
                  })(),
                  type: "number",
                  defaultValue: editingRow.from_recallable ?? "",
                  visible: (v) => inferCapitalCallCategoryFromTipus(v.tipus, v.eur) === "Capital Call",
                },
              ]}
              onSave={async (values, setError) => {
                if (!values.tipus) { setError("El tipus de moviment és obligatori."); return; }
                if (!values.data)  { setError("La data és obligatòria."); return; }
                if (!values.eur)   { setError("L'import és obligatori."); return; }
                const cat = inferCapitalCallCategoryFromTipus(values.tipus, values.eur);
                const fields = { tipus: values.tipus, data: values.data, eur: values.eur, comentaris: values.comentaris ?? "", cat };
                if (cat === "Distribució" && values.recallable !== "" && values.recallable != null) {
                  fields.recallable = Number(values.recallable);
                  fields.non_recallable = Math.round((Number(values.eur) - Number(values.recallable)) * 100) / 100;
                }
                if (cat === "Capital Call" && values.from_recallable !== "" && values.from_recallable != null) {
                  fields.from_recallable = Number(values.from_recallable);
                }
                const { error } = await updateCapitalCall(editingRow._rowId, fields);
                if (error) { setError(error.message); return; }
                const fresh = await loadCapitalCalls();
                if (Array.isArray(fresh)) { setRawCC(fresh); writeStoredJSON("tc_rawCC", fresh); }
                setEditingRow(null);
              }}
              onClose={() => setEditingRow(null)}
            />
          )}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: tc.bgAlt }}>
                {["Data", "Tipus", "Import", "Recallable", ...(vcpe === "SF" ? ["Fase"] : []), ...(canEdit ? [""] : [])].map(h => (
                  <th key={h || "_actions"} style={{ padding: "10px 12px", textAlign: h === "Import" || h === "Recallable" ? "right" : "left", fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
              <tr style={{ borderBottom: `1px solid ${tc.border}` }}>
                <th style={{ padding: "6px 12px" }}><input value={txFilters.data} onChange={(e) => setTxFilters((v) => ({ ...v, data: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                <th style={{ padding: "6px 12px" }}><select value={txFilters.tipus} onChange={(e) => setTxFilters((v) => ({ ...v, tipus: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }}>{tipusOptions.map(o => <option key={o} value={o}>{o}</option>)}</select></th>
                <th style={{ padding: "6px 12px" }}><input value={txFilters.import} onChange={(e) => setTxFilters((v) => ({ ...v, import: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                <th style={{ padding: "6px 12px" }} />
                {vcpe === "SF" ? <th style={{ padding: "6px 12px" }} /> : null}
                {canEdit ? <th style={{ padding: "6px 12px" }} /> : null}
              </tr>
            </thead>
            <tbody>
              {filteredTxLog.map((r, i) => {
                const sfPhaseCfg = vcpe === "SF" && r.est ? EST_CFG[r.est] : null;
                const sfPhaseLabel = r.est?.includes("Adquis") || r.est?.includes("Participada")
                  ? "Adquisició" : r.est?.includes("Cerca") ? "Cerca" : null;
                return (
                  <tr key={`${r.data}-${r.cat}-${r.eur}`} className="hoverable" style={{ borderBottom: `1px solid ${tc.border}`, background: i % 2 === 0 ? "transparent" : tc.bgAlt }}>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: tc.textMid }}>{r.data}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: tc.textMid }}>{r.tipus}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: r.eur > 0 ? tc.navy : tc.green }}>
                      {fmtSignedM(r.eur)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11, color: tc.textLight }}>
                      {r.cat === "Distribució" && r.recallable != null
                        ? `${fmtM(r.recallable)} rec / ${r.non_recallable != null ? fmtM(r.non_recallable) : "—"} no rec`
                        : r.cat === "Capital Call" && r.from_recallable
                        ? `${fmtM(r.from_recallable)} del pool`
                        : "—"}
                    </td>
                    {vcpe === "SF" ? (
                      <td style={{ padding: "10px 12px" }}>
                        {sfPhaseLabel && sfPhaseCfg ? (
                          <span style={{ fontSize: 10, fontWeight: 600, borderRadius: 4, padding: "2px 6px", background: sfPhaseCfg.bg, color: sfPhaseCfg.color }}>
                            {sfPhaseLabel}
                          </span>
                        ) : null}
                      </td>
                    ) : null}
                    {canEdit ? (
                      <td style={{ padding: "4px 12px", textAlign: "center" }}>
                        {r._rowId ? (
                          <button
                            onClick={() => setEditingRow(r)}
                            style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}
                          >
                            Edita
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function FundDetail() {
  const [dark, setDark] = useState(() => readStoredFlag("tc_dark"));
  const tc = dark ? TC_DARK : TC_LIGHT;
  return (
    <ThemeContext.Provider value={{ tc, dark, toggle: () => setDark(d => !d) }}>
      <FundDetailInner />
    </ThemeContext.Provider>
  );
}
