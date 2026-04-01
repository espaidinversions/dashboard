import React, { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import { useTheme } from "../theme.js";
import { fmtM, cagr, fmtMonth, fmtMonthKey, yearsHeld } from "../utils.js";
import { Badge } from "./SharedComponents.jsx";
import { PM_MONTHLY, PM_MANAGERS, PM_POSITIONS } from "../data/publicMarkets.js";
import { Link } from "react-router-dom";
import { PM_TRANSACTIONS } from "../data/pmTransactions.js";
import { CumulativeFlowsChart } from "./CumulativeFlowsChart.jsx";

// ── Constants ──────────────────────────────────────────────
const ABEL_RV_SPLIT = 0.7516;
const ABEL_RF_SPLIT = 1 - ABEL_RV_SPLIT; // remainder so RV+RF sums to 100%

const TIPUS_CFG = {
  "RV":    { color: "#2B5070", bg: "#E6EDF3" },
  "RF":    { color: "#7A6000", bg: "#FFF8E1" },
  "RV+RF": { color: "#28A029", bg: "#E8F8E8" },
};

const AREA_COLORS = {
  total:   "#2B5070",
  rv:      "#2B5070",
  rf:      "#E8A020",
  caixa:   "#2B5070",
  ubs:     "#4E79A7",
  abel:    "#3DC83E",
  andbank: "#6B2E7E",
};

// Color per manager for return charts
const MGR_COLORS = {
  "caixa":   "#2B5070",
  "ubs":     "#4E79A7",
  "andbank": "#6B2E7E",
  "abel":    "#3DC83E",
};

// Periods with return fields
const PERIODS = [
  { field: "r2024", label: "2024" },
  { field: "r2025", label: "2025" },
  { field: "ytd",   label: "YTD '26" },
];

// AUM-weighted return for a given field and optional asset type filter
function weightedReturn(field, tipus = null) {
  const entries = PM_MANAGERS.flatMap(m => {
    if (m[field] == null) return [];
    if (tipus === null) {
      return [{ val: m.valorActual, r: m[field] }];
    }
    if (m.tipus === tipus) {
      return [{ val: m.valorActual, r: m[field] }];
    }
    if (m.tipus === "RV+RF") {
      const split = tipus === "RV" ? ABEL_RV_SPLIT : ABEL_RF_SPLIT;
      return [{ val: m.valorActual * split, r: m[field] }];
    }
    return [];
  });
  const totalVal = entries.reduce((s, e) => s + e.val, 0);
  return totalVal > 0 ? entries.reduce((s, e) => s + e.r * e.val, 0) / totalVal : null;
}

// ── Module-level statics ────────────────────────────────────

// Map mgrId → default tipus filter for expand
const DEFAULT_EXPAND_TIPUS = {
  "caixa": "all", "ubs": "all",
  "abel": "all", "andbank": null,
};

// Static lookup derived from PM_POSITIONS (imported data never changes at runtime)
const ISIN_TO_ID  = Object.fromEntries(PM_POSITIONS.map(p => [p.isin, p.id]));

// Get PM_POSITIONS for a manager row (only Bankinter/Abel has individual position tracking)
function getMgrPositions(mgrId, tipusFilter) {
  if (mgrId !== "abel") return null;
  let rows = PM_POSITIONS.filter(p => p.gestor === "Abel Font");
  if (tipusFilter && tipusFilter !== "all") rows = rows.filter(p => p.tipus === tipusFilter);
  return rows.sort((a, b) => (b.valorMercat ?? 0) - (a.valorMercat ?? 0));
}

// ── Transaction accordion helpers ───────────────────────────
const _TX_MONTH_NAMES = ["Gener","Febrer","Març","Abril","Maig","Juny","Juliol","Agost","Setembre","Octubre","Novembre","Desembre"];
function fmtTxMonth(yyyymm) {
  if (!yyyymm || yyyymm === "????-??") return "Sense data";
  const [y, m] = yyyymm.split("-");
  return `${_TX_MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

// ── Helpers ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, tc, valueColor }) {
  return (
    <div className="kpi-card card-hover" style={{
      background: tc.card, border: `1px solid ${tc.border}`,
      borderRadius: 10, padding: "16px 20px", minWidth: 160, flex: 1,
    }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor ?? tc.navy, fontFamily: "'DM Mono',monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: tc.textLight, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function PctChip({ v, tc }) {
  if (v == null) return <span style={{ fontSize: 11, color: tc.textLight }}>—</span>;
  const pos   = v > 0.005;
  const neg   = v < -0.005;
  const color = pos ? tc.green : neg ? tc.red : tc.textLight;
  const bg    = pos ? "#E8F8E8" : neg ? "#FDECEA" : tc.bgAlt;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 4, padding: "1px 6px", fontFamily: "'DM Mono',monospace" }}>
      {pos ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}

function pctFmt(v) {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

// ── Main component ──────────────────────────────────────────
export function PublicMarketsTab({ setMercatsPublicsTab }) {
  const { tc, dark } = useTheme();
  const [chartView, setChartView] = useState("total");
  const [expanded, setExpanded] = useState(new Set());
  const [expandTipus, setExpandTipus] = useState({});
  const [txActionFilter, setTxActionFilter] = useState("all");
  const [txCustodianFilter, setTxCustodianFilter] = useState("all");
  const [openTxMonths, setOpenTxMonths] = useState(() => new Set());
  const [flowGroupBy, setFlowGroupBy] = useState("total");

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTxMonth = (m) => setOpenTxMonths(prev => {
    const s = new Set(prev);
    s.has(m) ? s.delete(m) : s.add(m);
    return s;
  });

  // ── KPI derivations ─────────────────────────────────────
  const total = useMemo(() => PM_MANAGERS.reduce((s, m) => s + m.valorActual, 0), []);

  const totalRV = useMemo(() =>
    PM_MANAGERS.reduce((s, m) => {
      if (m.tipus === "RV")    return s + m.valorActual;
      if (m.tipus === "RV+RF") return s + m.valorActual * ABEL_RV_SPLIT;
      return s;
    }, 0), []);

  const totalRF = useMemo(() =>
    PM_MANAGERS.reduce((s, m) => {
      if (m.tipus === "RF")    return s + m.valorActual;
      if (m.tipus === "RV+RF") return s + m.valorActual * ABEL_RF_SPLIT;
      return s;
    }, 0), []);

  const ytdWeighted = useMemo(() => weightedReturn("ytd"), []);

  const bestGestor2025 = useMemo(() =>
    [...PM_MANAGERS].filter(m => m.r2025 != null).sort((a, b) => b.r2025 - a.r2025)[0], []);

  // ── Portfolio TWR (chain-linked monthly sub-period returns, Abel injection as external CF) ──
  const portfolioTWR = useMemo(() => {
    let cum = 1;
    for (let i = 1; i < PM_MONTHLY.length; i++) {
      const prev = PM_MONTHLY[i - 1];
      const curr = PM_MONTHLY[i];
      const vPrev = prev.caixaRV + prev.caixaRF + prev.ubsRV + prev.ubsRF + (prev.abelBK ?? 0);
      // External CF: Abel BK injection at the start of the period where it first appears
      const cf    = prev.abelBK == null && curr.abelBK != null ? curr.abelBK : 0;
      const vCurr = curr.caixaRV + curr.caixaRF + curr.ubsRV + curr.ubsRF + (curr.abelBK ?? 0);
      cum *= (1 + (vCurr - vPrev - cf) / (vPrev + cf));
    }
    return (cum - 1) * 100;
  }, []);

  // ── Portfolio MWR (Modified Dietz, Dec 2023 → Mar 2026, Abel injection as primary CF) ──
  const portfolioMWR = useMemo(() => {
    const first      = PM_MONTHLY[0];
    const last       = PM_MONTHLY[PM_MONTHLY.length - 1];
    const vStart     = first.caixaRV + first.caixaRF + first.ubsRV + first.ubsRF;
    const vEnd       = last.caixaRV  + last.caixaRF  + last.ubsRV  + last.ubsRF + (last.abelBK ?? 0);
    const totalMonths = PM_MONTHLY.length - 1; // 27
    const abelIdx    = PM_MONTHLY.findIndex(d => d.abelBK != null);
    if (abelIdx === -1) return null;
    const cf         = PM_MONTHLY[abelIdx].abelBK;
    const w          = (totalMonths - abelIdx) / totalMonths; // time-weighted fraction remaining
    const totalReturn = (vEnd - vStart - cf) / (vStart + cf * w);
    const years      = totalMonths / 12;
    return (Math.pow(1 + totalReturn, 1 / years) - 1) * 100;
  }, []);

  // ── 5 display managers (Caixa = caixa-rv + caixa-rf, UBS = ubs-rv + ubs-rf) ──
  const displayManagers = useMemo(() => {
    const wtd = (ids, field) => {
      const mgrs = ids.map(id => PM_MANAGERS.find(m => m.id === id)).filter(m => m[field] != null);
      if (mgrs.length === 0) return null;
      const wSum = mgrs.reduce((s, m) => s + m[field] * m.valorActual, 0);
      const wTot = mgrs.reduce((s, m) => s + m.valorActual, 0);
      return wSum / wTot;
    };
    const combine = (id, nom, ids) => {
      const val = ids.reduce((s, i) => s + PM_MANAGERS.find(m => m.id === i).valorActual, 0);
      return { id, nom, tipus: "RV+RF", valorActual: val,
        ytd: wtd(ids, "ytd"), r2025: wtd(ids, "r2025"), r2024: wtd(ids, "r2024"), rendPct: wtd(ids, "rendPct") };
    };
    return [
      combine("caixa",   "CaixaBank",   ["caixa-rv", "caixa-rf"]),
      combine("ubs",     "UBS",         ["ubs-rv",   "ubs-rf"  ]),
      { ...PM_MANAGERS.find(m => m.id === "abel"),    id: "abel",    nom: "Bankinter"   },
      { ...PM_MANAGERS.find(m => m.id === "andbank"), id: "andbank", nom: "WAM–Andbank" },
    ];
  }, []);

  // ── Return charts data ───────────────────────────────────

  // Per provider: X = period, one data key per manager
  const providerData = useMemo(() =>
    PERIODS.map(({ field, label }) => {
      const point = { year: label };
      displayManagers.forEach(m => {
        if (m[field] != null) point[m.id] = parseFloat(m[field].toFixed(2));
      });
      return point;
    }), [displayManagers]);

  // Managers that have at least one non-null return across the three periods
  const activeMgrs = useMemo(() =>
    displayManagers.filter(m => PERIODS.some(p => m[p.field] != null)), [displayManagers]);

  // Per strategy: X = period, lines for RV, RF, Total
  const strategyData = useMemo(() =>
    PERIODS.map(({ field, label }) => ({
      year:  label,
      rv:    weightedReturn(field, "RV"),
      rf:    weightedReturn(field, "RF"),
      total: weightedReturn(field),
    })), []);


  // ── Evolution chart data ────────────────────────────────
  const chartData = useMemo(() => {
    const START_MONTH = "2019-01";
    const firstPMMonth = PM_MONTHLY[0].date.slice(0, 7); // "2023-12"

    // Pad from 2019-01 up to (not including) first PM_MONTHLY month
    const padRows = [];
    let cur = START_MONTH;
    while (cur < firstPMMonth) {
      padRows.push({ month: cur });
      const [y, mo] = cur.split("-").map(Number);
      cur = mo === 12
        ? `${y + 1}-01`
        : `${y}-${String(mo + 1).padStart(2, "0")}`;
    }

    // Real data rows from PM_MONTHLY
    const dataRows = PM_MONTHLY.map(d => {
      const month = d.date.slice(0, 7);
      if (chartView === "total") return {
        month,
        total: d.caixaRV + d.caixaRF + d.ubsRV + d.ubsRF + (d.abelBK ?? 0) + d.andbank,
      };
      if (chartView === "actiu") return {
        month,
        rv: d.caixaRV + d.ubsRV + (d.abelBK != null ? d.abelBK * ABEL_RV_SPLIT : 0),
        rf: d.caixaRF + d.ubsRF + (d.abelBK != null ? d.abelBK * ABEL_RF_SPLIT : 0) + d.andbank,
      };
      // gestor view
      return {
        month,
        caixa:   d.caixaRV + d.caixaRF,
        ubs:     d.ubsRV + d.ubsRF,
        abel:    d.abelBK ?? 0,
        andbank: d.andbank,
      };
    });

    return [...padRows, ...dataRows];
  }, [chartView]);

  const totalValueSeries = useMemo(
    () => PM_MONTHLY.map(m => ({
      date: m.date,
      value: m.caixaRV + m.caixaRF + m.ubsRV + m.ubsRF + (m.abelBK ?? 0) + m.andbank,
    })),
    []
  );

  // ── Transaction accordion data ───────────────────────────
  const txCustodians = useMemo(() =>
    [...new Set(PM_TRANSACTIONS.map(t => t.custodian).filter(Boolean))].sort(),
  []);

  const txFiltered = useMemo(() => {
    let rows = PM_TRANSACTIONS;
    if (txActionFilter !== "all") rows = rows.filter(t => t.action === txActionFilter);
    if (txCustodianFilter !== "all") rows = rows.filter(t => t.custodian === txCustodianFilter);
    return rows;
  }, [txActionFilter, txCustodianFilter]);

  const txByMonth = useMemo(() => {
    const map = new Map();
    txFiltered.forEach(t => {
      const key = t.date ? t.date.slice(0, 7) : "????-??";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "????-??") return 1;
      if (b === "????-??") return -1;
      return b.localeCompare(a);
    });
  }, [txFiltered]);

  // ── Shared styles ────────────────────────────────────────
  const card         = { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)" };
  const secLabel     = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600 };
  const tooltipStyle = { contentStyle: { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8 }, labelStyle: { color: tc.text, fontWeight: 600 } };

  const toggleBtn = (id, label) => (
    <button key={id} onClick={() => setChartView(id)} style={{
      padding: "4px 10px", borderRadius: 5,
      border: `1.5px solid ${chartView === id ? tc.green : tc.border}`,
      background: chartView === id ? (dark ? "#0A2010" : "#E8F8E8") : "transparent",
      color: chartView === id ? tc.green : tc.textLight,
      fontSize: 11, cursor: "pointer", fontFamily: "inherit",
      fontWeight: chartView === id ? 700 : 400,
    }}>{label}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── ① KPI cards ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard label="Total Patrimoni"   value={fmtM(total)}   sub="Mercats Públics" tc={tc} />
        <KpiCard label="Renda Variable"    value={fmtM(totalRV)} sub={`${(totalRV / total * 100).toFixed(1)}% del total`} tc={tc} />
        <KpiCard label="Renda Fixa"        value={fmtM(totalRF)} sub={`${(totalRF / total * 100).toFixed(1)}% del total`} tc={tc} />
        <KpiCard label="YTD Global"
          value={pctFmt(ytdWeighted)}
          sub="Ponderat per AUM" tc={tc}
          valueColor={ytdWeighted >= 0 ? tc.green : tc.red} />
        <KpiCard label="TWR Cartera (Des '23)"
          value={pctFmt(portfolioTWR)}
          sub="Retorn acumulat, sense fluxos"
          tc={tc} valueColor={portfolioTWR >= 0 ? tc.green : tc.red} />
        <KpiCard label="MWR Cartera (Des '23)"
          value={pctFmt(portfolioMWR)}
          sub="Anualitzat, Modified Dietz"
          tc={tc} valueColor={portfolioMWR >= 0 ? tc.green : tc.red} />
      </div>

      {/* ── ② Returns: per provider + per strategy ── */}
      <div style={{ display: "flex", gap: 16 }}>

        {/* Per provider */}
        <div style={{ ...card, flex: "1 1 58%" }}>
          <div style={{ ...secLabel, marginBottom: 16 }}>Rendiment TWR per Proveïdor</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={providerData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tc.border} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: tc.textLight }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => v.toFixed(1) + "%"} tick={{ fontSize: 10, fill: tc.textLight }} axisLine={false} tickLine={false} width={44} />
              <ReferenceLine y={0} stroke={tc.border} strokeDasharray="4 2" />
              <Tooltip
                {...tooltipStyle}
                formatter={(v, name) => [v != null ? pctFmt(v) : "—", name]}
              />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              {activeMgrs.map(m => (
                <Bar
                  key={m.id}
                  dataKey={m.id}
                  name={m.nom}
                  fill={MGR_COLORS[m.id]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
            TWR reportat per cada gestor. UBS sense dades 2024–2025.
          </div>
        </div>

        {/* Per strategy */}
        <div style={{ ...card, flex: "1 1 38%" }}>
          <div style={{ ...secLabel, marginBottom: 16 }}>Rendiment ponderat per Estratègia</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={strategyData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: tc.textLight }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => v.toFixed(1) + "%"} tick={{ fontSize: 10, fill: tc.textLight }} axisLine={false} tickLine={false} width={44} />
              <ReferenceLine y={0} stroke={tc.border} strokeDasharray="4 2" />
              <Tooltip
                {...tooltipStyle}
                formatter={(v, name) => [v != null ? pctFmt(v) : "—", name]}
              />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              <Line dataKey="rv"    name="Renda Variable" stroke={tc.navy}  strokeWidth={2} dot={{ r: 5, fill: tc.navy }}  connectNulls />
              <Line dataKey="rf"    name="Renda Fixa"     stroke="#E8A020"  strokeWidth={2} dot={{ r: 5, fill: "#E8A020" }} connectNulls />
              <Line dataKey="total" name="Total"          stroke={tc.green} strokeWidth={2} dot={{ r: 5, fill: tc.green }} strokeDasharray="5 3" connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
            Ponderat per AUM de cada gestor. Gestors sense dades del any exclosos del còmput.
          </div>
        </div>

      </div>

      {/* ── ③ Evolution chart ── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <div style={{ ...secLabel, flex: 1 }}>Evolució del Patrimoni</div>
          <div style={{ display: "flex", gap: 4 }}>
            {toggleBtn("total",  "Total")}
            {toggleBtn("actiu",  "Per Actiu")}
            {toggleBtn("gestor", "Per Gestor")}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} stackOffset="none" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {Object.entries(AREA_COLORS).map(([id, color]) => (
                <linearGradient key={id} id={`pm-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.04} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
            <XAxis
              dataKey="month"
              tickFormatter={fmtMonthKey}
              tick={{ fontSize: 10, fill: tc.textLight }}
              interval={11}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tickFormatter={fmtM} tick={{ fontSize: 10, fill: tc.textLight }} width={70} />
            <Tooltip
              {...tooltipStyle}
              labelFormatter={fmtMonthKey}
              formatter={(v, name) => [fmtM(v), name.charAt(0).toUpperCase() + name.slice(1)]}
            />
            {chartView === "total" && (
              <Area type="monotone" dataKey="total"
                stroke={AREA_COLORS.total} fill={`url(#pm-grad-total)`}
                strokeWidth={2} dot={false} name="Valor cartera" fillOpacity={0.7} />
            )}
            {chartView === "actiu" && <>
              <Area type="monotone" dataKey="rv" stackId="a"
                stroke={AREA_COLORS.rv}  fill={`url(#pm-grad-rv)`}
                strokeWidth={1.5} dot={false} name="Renda Variable" />
              <Area type="monotone" dataKey="rf" stackId="a"
                stroke={AREA_COLORS.rf}  fill={`url(#pm-grad-rf)`}
                strokeWidth={1.5} dot={false} name="Renda Fixa" />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            </>}
            {chartView === "gestor" && <>
              <Area type="monotone" dataKey="andbank" stackId="g" stroke={AREA_COLORS.andbank} fill={`url(#pm-grad-andbank)`} strokeWidth={1.5} dot={false} name="WAM–Andbank" />
              <Area type="monotone" dataKey="abel"    stackId="g" stroke={AREA_COLORS.abel}    fill={`url(#pm-grad-abel)`}    strokeWidth={1.5} dot={false} name="Bankinter" />
              <Area type="monotone" dataKey="ubs"     stackId="g" stroke={AREA_COLORS.ubs}     fill={`url(#pm-grad-ubs)`}     strokeWidth={1.5} dot={false} name="UBS" />
              <Area type="monotone" dataKey="caixa"   stackId="g" stroke={AREA_COLORS.caixa}   fill={`url(#pm-grad-caixa)`}   strokeWidth={1.5} dot={false} name="CaixaBank" />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            </>}
          </AreaChart>
        </ResponsiveContainer>

        <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
          {chartView === "gestor"
            ? "CaixaBank, UBS, Bankinter i WAM–Andbank per separat. WAM–Andbank amb sèrie mensual interpolada."
            : "Dades de PM_MONTHLY (font manual). Dades disponibles des del Desembre 2023."}
        </div>
      </div>

      {/* ── Fluxos acumulats ── */}
      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, flex: 1 }}>
            Fluxos acumulats · entrades de capital
          </div>
          {[
            { id: "total",     label: "Total" },
            { id: "assetType", label: "Per Actiu" },
            { id: "manager",   label: "Per Gestor" },
          ].map(opt => (
            <button key={opt.id} onClick={() => setFlowGroupBy(opt.id)}
              style={{
                padding: "3px 10px", borderRadius: 5, fontSize: 11,
                cursor: "pointer", fontFamily: "inherit",
                border: `1.5px solid ${flowGroupBy === opt.id ? tc.navy : tc.border}`,
                background: flowGroupBy === opt.id ? (dark ? "#0A1A30" : "#E8F0FA") : "transparent",
                color: flowGroupBy === opt.id ? tc.navy : tc.textLight,
                fontWeight: flowGroupBy === opt.id ? 700 : 400,
              }}>
              {opt.label}
            </button>
          ))}
        </div>
        <CumulativeFlowsChart
          transactions={PM_TRANSACTIONS}
          valuesSeries={totalValueSeries}
          groupBy={flowGroupBy}
          height={240}
        />
      </div>

      {/* ── ④ Manager table ── */}
      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflowX: "auto" }}>
        <div style={{ ...secLabel, marginBottom: 16 }}>Banc Custodi</div>
        <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", minWidth: 700 }}>
          <thead>
            <tr>
              {[
                { label: "Banc Custodi",  align: "left"  },
                { label: "Tipus",         align: "left"  },
                { label: "AUM",           align: "right" },
                { label: "YTD",           align: "right" },
                { label: "2025",          align: "right" },
                { label: "2024",          align: "right" },
                { label: "Des d'inici (TWR)", align: "right" },
                { label: "CAGR inici",    align: "right" },
              ].map(({ label, align }) => (
                <th key={label} style={{
                  padding: "8px 12px", fontSize: 10, letterSpacing: "0.09em",
                  color: tc.textLight, textTransform: "uppercase", fontWeight: 600,
                  borderBottom: `2px solid ${tc.border}`, textAlign: align, whiteSpace: "nowrap",
                }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayManagers.map((m, i) => {
              const isExpanded = expanded.has(m.id);
              const zebra = i % 2 === 1;
              const inceptionMonths = m.id === "abel" ? 11 : 27;
              const yrs = inceptionMonths / 12;
              const mgrCagr = m.rendPct != null ? cagr(m.rendPct, yrs) : null;
              const curTipus = expandTipus[m.id] ?? DEFAULT_EXPAND_TIPUS[m.id] ?? "all";
              const subPositions = getMgrPositions(m.id, curTipus);

              const isExpandable = subPositions !== null;
              return (
                <React.Fragment key={m.id}>
                  <tr className="hoverable" style={{
                    background: zebra ? (dark ? tc.bgAlt : "#f8f9fb") : tc.card,
                    borderBottom: `1px solid ${tc.border}`,
                  }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: tc.navy,
                                 cursor: isExpandable ? "pointer" : "default", userSelect: "none" }}
                        onClick={() => isExpandable && toggleExpand(m.id)}>
                      <span style={{ display: "inline-block", width: 14, fontSize: 10, color: tc.textLight }}>
                        {isExpandable ? (isExpanded ? "▾" : "▸") : ""}
                      </span>
                      {m.nom}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <Badge label={m.tipus} cfg={TIPUS_CFG[m.tipus] || {}} />
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 600, color: tc.navy }}>
                      {fmtM(m.valorActual)}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}><PctChip v={m.ytd}   tc={tc} /></td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}><PctChip v={m.r2025} tc={tc} /></td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}><PctChip v={m.r2024} tc={tc} /></td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}><PctChip v={m.rendPct} tc={tc} /></td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}><PctChip v={mgrCagr} tc={tc} /></td>
                  </tr>

                  {isExpanded && isExpandable && (
                    <tr>
                      <td colSpan={8} style={{ padding: 0, background: dark ? "#0C1A28" : "#f0f4f8", borderBottom: `1px solid ${tc.border}` }}>
                        <div style={{ padding: "10px 16px 16px 32px" }}>

                          {/* RV/RF toggle — only for managers with positions */}
                          {subPositions !== null && (
                            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                              {[["all","Tots"],["RV","RV"],["RF","RF"]].map(([id, label]) => (
                                <button key={id}
                                  onClick={() => setExpandTipus(prev => ({ ...prev, [m.id]: id }))}
                                  style={{
                                    padding: "3px 8px", borderRadius: 4, fontSize: 10,
                                    border: `1.5px solid ${curTipus === id ? tc.navy : tc.border}`,
                                    background: curTipus === id ? (dark ? "#0A1A30" : "#E8F0FA") : "transparent",
                                    color: curTipus === id ? tc.navy : tc.textLight,
                                    cursor: "pointer", fontFamily: "inherit",
                                    fontWeight: curTipus === id ? 700 : 400,
                                  }}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Positions sub-table */}
                          {subPositions !== null && subPositions.length === 0 && (
                            <div style={{ fontSize: 11, color: tc.textLight, fontStyle: "italic" }}>Cap posició per al filtre seleccionat.</div>
                          )}

                          {subPositions !== null && subPositions.length > 0 && (
                            <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%", minWidth: 640 }}>
                              <thead>
                                <tr>
                                  {[
                                    { label: "Nom",         align: "left"  },
                                    { label: "Custodi",     align: "left"  },
                                    { label: "Tipus",       align: "left"  },
                                    { label: "YTD",         align: "right" },
                                    { label: "2025",        align: "right" },
                                    { label: "2024",        align: "right" },
                                    { label: "Des d'inici", align: "right" },
                                    { label: "CAGR",        align: "right" },
                                    { label: "Valor mercat",align: "right" },
                                  ].map(({ label, align }) => (
                                    <th key={label} style={{
                                      padding: "5px 8px", fontSize: 9, letterSpacing: "0.08em",
                                      color: tc.textLight, textTransform: "uppercase", fontWeight: 600,
                                      borderBottom: `1px solid ${tc.border}`, textAlign: align,
                                    }}>{label}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {subPositions.map(p => {
                                  const yh = yearsHeld(p.dataCompra);
                                  const pc = cagr(p.rendInici, yh);
                                  return (
                                    <tr key={p.id} style={{ borderBottom: `1px solid ${tc.border}` }}>
                                      <td style={{ padding: "5px 8px", color: tc.navy }}>
                                        <Link to={`/mercats-publics/${p.id}`}
                                          style={{ color: tc.navy, textDecoration: "none", fontWeight: 500 }}>
                                          {p.nom}
                                        </Link>
                                      </td>
                                      <td style={{ padding: "5px 8px", fontSize: 10, color: tc.textLight }}>{p.custodian ?? "—"}</td>
                                      <td style={{ padding: "5px 8px" }}>
                                        <Badge label={p.tipus} cfg={TIPUS_CFG[p.tipus] || {}} />
                                      </td>
                                      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={p.rend2026} tc={tc} /></td>
                                      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={p.rend2025} tc={tc} /></td>
                                      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={p.rend2024} tc={tc} /></td>
                                      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={p.rendInici} tc={tc} /></td>
                                      <td style={{ padding: "5px 8px", textAlign: "right" }}><PctChip v={pc} tc={tc} /></td>
                                      <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 600, color: tc.navy }}>
                                        {fmtM(p.valorMercat)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 10, color: tc.textLight, marginTop: 10, fontStyle: "italic" }}>
          Des d'inici: TWR reportat pels gestors (WAM/Andbank des de creació; UBS YTD; Abel BK des d'abr. 2025). CAGR: retorn anualitzat equivalent.
        </div>
      </div>

      {/* ── ⑦ Moviments mensuals (condensed accordion) ───────── */}
      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>

        {/* Header bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          padding: "18px 20px 14px", borderBottom: `1px solid ${tc.border}` }}>
          <div style={{ fontSize: 11, letterSpacing: "0.13em", color: tc.textLight,
            textTransform: "uppercase", fontWeight: 600, flex: 1 }}>
            Moviments · {txFiltered.length}
          </div>
          <button onClick={() => setMercatsPublicsTab?.("transaccions")} style={{
            padding: "4px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            border: `1.5px solid ${tc.green}`, background: dark ? "#0A2010" : "#E8F8E8",
            color: tc.green, fontWeight: 700,
          }}>+ Nova</button>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["all","Totes"],["buy","Compres"],["sell","Vendes"]].map(([v, lbl]) => {
              const active = txActionFilter === v;
              return (
                <button key={v} onClick={() => setTxActionFilter(v)} style={{
                  padding: "3px 10px", borderRadius: 20, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                  border: `1.5px solid ${active ? tc.green : tc.border}`,
                  background: active ? (dark ? "#0A2010" : "#E8F8E8") : "transparent",
                  color: active ? tc.green : tc.textLight, fontWeight: active ? 700 : 400,
                }}>{lbl}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["all","Tot custodi"], ...txCustodians.map(c => [c, c])].map(([v, lbl]) => {
              const active = txCustodianFilter === v;
              return (
                <button key={v} onClick={() => setTxCustodianFilter(v)} style={{
                  padding: "3px 10px", borderRadius: 20, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                  border: `1.5px solid ${active ? tc.green : tc.border}`,
                  background: active ? (dark ? "#0A2010" : "#E8F8E8") : "transparent",
                  color: active ? tc.green : tc.textLight, fontWeight: active ? 700 : 400,
                }}>{lbl}</button>
              );
            })}
          </div>
        </div>

        {/* Accordion table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", minWidth: 700 }}>
            <tbody>
              {txByMonth.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: "18px 20px", fontStyle: "italic",
                    color: tc.textLight, fontSize: 12 }}>
                    {PM_TRANSACTIONS.length === 0
                      ? "Sense moviments registrats."
                      : "Sense transaccions amb aquest filtre."}
                  </td>
                </tr>
              )}
              {txByMonth.map(([month, rows]) => {
                const isOpen = openTxMonths.has(month);
                const buys      = rows.filter(t => t.action === "buy");
                const sells     = rows.filter(t => t.action === "sell");
                const buyTotal  = buys.reduce((s, t) => s + (t.valueEur ?? 0), 0);
                const sellTotal = sells.reduce((s, t) => s + (t.valueEur ?? 0), 0);
                const net       = buyTotal - sellTotal;
                const isNoDate  = month === "????-??";
                return (
                  <React.Fragment key={month}>
                    {/* Level 1 — Month row */}
                    <tr
                      role="button"
                      aria-expanded={isOpen}
                      tabIndex={0}
                      onClick={() => toggleTxMonth(month)}
                      onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggleTxMonth(month)}
                      style={{
                        cursor: "pointer",
                        borderTop: `1px solid ${tc.border}`,
                        borderBottom: isOpen ? "none" : `1px solid ${tc.border}`,
                        userSelect: "none",
                      }}
                    >
                      <td style={{ padding: "11px 8px 11px 16px", width: 28, fontSize: 13,
                        color: tc.navy, fontWeight: 700 }}>
                        {isOpen ? "▾" : "▸"}
                      </td>
                      <td style={{
                        padding: "11px 10px", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap",
                        color: isNoDate ? tc.textLight : tc.navy,
                        fontStyle: isNoDate ? "italic" : "normal",
                      }}>
                        {fmtTxMonth(month)}
                      </td>
                      <td colSpan={7} style={{ padding: "11px 10px" }}>
                        <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          {buys.length > 0 && (
                            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4,
                              background: "#E8F8E8", color: "#1C6B1D", fontWeight: 600 }}>
                              Compres: {buys.length} · {fmtM(buyTotal)}
                            </span>
                          )}
                          {sells.length > 0 && (
                            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4,
                              background: "#FDECEA", color: "#C62828", fontWeight: 600 }}>
                              Vendes: {sells.length} · {fmtM(sellTotal)}
                            </span>
                          )}
                          {buys.length > 0 && sells.length > 0 && (
                            <span style={{
                              fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 700,
                              fontFamily: "'DM Mono',monospace",
                              background: net > 0 ? "#E8F8E8" : net < 0 ? "#FDECEA" : tc.bgAlt,
                              color: net > 0 ? tc.green : net < 0 ? tc.red : tc.textLight,
                            }}>
                              Net: {net > 0 ? "+" : ""}{fmtM(net)}
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>

                    {/* Level 2 — Transaction rows */}
                    {isOpen && rows.map((t, i) => {
                      const isBuy = t.action === "buy";
                      const rowBg = i % 2 === 0
                        ? (dark ? "#091C0B" : "#F4FBF4")
                        : (dark ? "#071A08" : "#E8F8E8");
                      return (
                        <tr key={t.id} style={{ borderBottom: `1px solid ${tc.border}`, background: rowBg }}>
                          <td />
                          <td style={{ padding: "7px 10px 7px 28px", fontFamily: "'DM Mono',monospace",
                            fontSize: 11, color: tc.textLight, whiteSpace: "nowrap" }}>
                            {t.date ?? "—"}
                          </td>
                          <td style={{ padding: "7px 10px", maxWidth: 220, overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span style={{ color: tc.navy, fontWeight: 600 }}>{t.nom}</span>
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center" }}>
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4,
                              background: t.tipus === "RV" ? "#E6EDF3" : "#FFF8E1",
                              color:      t.tipus === "RV" ? "#2B5070" : "#7A6000" }}>
                              {t.tipus}
                            </span>
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center" }}>
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4,
                              background: isBuy ? "#E8F8E8" : "#FDECEA",
                              color:      isBuy ? "#1C6B1D" : "#C62828", fontWeight: 600 }}>
                              {isBuy ? "Compra" : "Venda"}
                            </span>
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right",
                            fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                            {t.units != null ? t.units.toLocaleString("ca-ES", { maximumFractionDigits: 0 }) : "—"}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right",
                            fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                            {t.nav != null ? t.nav.toFixed(2) : "—"}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right",
                            fontFamily: "'DM Mono',monospace", fontWeight: 700, color: tc.navy }}>
                            {t.valueEur != null ? fmtM(t.valueEur) : "—"}
                          </td>
                          <td style={{ padding: "7px 10px", fontSize: 11, color: tc.textLight }}>
                            {t.custodian}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

