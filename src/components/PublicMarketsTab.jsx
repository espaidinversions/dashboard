import React, { useState, useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import { useTheme } from "../theme.js";
import { fmtM, cagr, fmtMonth, yearsHeld } from "../utils.js";
import { Badge } from "./SharedComponents.jsx";
import { PM_MONTHLY, PM_MANAGERS, PM_POSITIONS } from "../data/publicMarkets.js";
import { Link } from "react-router-dom";
import { PM_VALUES } from "../data/portfolioValues.js";
import { PM_TRANSACTIONS } from "../data/pmTransactions.js";

// ── Constants ──────────────────────────────────────────────
const ABEL_RV_SPLIT = 0.7516;
const ABEL_RF_SPLIT = 0.1868;

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
const andbankVal = PM_MANAGERS.find(m => m.id === "andbank").valorActual;

// Monthly Andbank lookup: "YYYY-MM" → andbank value
const ANDBANK_BY_MONTH = new Map(PM_MONTHLY.map(d => [d.date, d.andbank]));

// Map mgrId → default tipus filter for expand
const DEFAULT_EXPAND_TIPUS = {
  "caixa": "all", "ubs": "all",
  "abel": "all", "andbank": null,
};

// Static lookups derived from PM_POSITIONS (imported data never changes at runtime)
const ISIN_TIPUS = Object.fromEntries(PM_POSITIONS.map(p => [p.isin, p.tipus]));
const ABEL_ISINS = new Set(PM_POSITIONS.filter(p => p.gestor === "Abel Font").map(p => p.isin));

// Get PM_POSITIONS for a manager row (only Bankinter/Abel has individual position tracking)
function getMgrPositions(mgrId, tipusFilter) {
  if (mgrId !== "abel") return null;
  let rows = PM_POSITIONS.filter(p => p.gestor === "Abel Font");
  if (tipusFilter && tipusFilter !== "all") rows = rows.filter(p => p.tipus === tipusFilter);
  return rows.sort((a, b) => b.valorMercat - a.valorMercat);
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
export function PublicMarketsTab() {
  const { tc, dark } = useTheme();
  const [chartView, setChartView] = useState("total");
  const [expanded, setExpanded] = useState(new Set());
  const [expandTipus, setExpandTipus] = useState({});

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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

  // Build monthly chart data from PM_VALUES mark-to-market (falls back to null if empty)
  const mvData = useMemo(() => {
    if (Object.keys(PM_VALUES).length === 0) return null;

    // Aggregate value per date × custodian group
    const byDate = {};
    for (const [isin, custodians] of Object.entries(PM_VALUES)) {
      const tipus = ISIN_TIPUS[isin] ?? null;
      for (const [custodian, series] of Object.entries(custodians)) {
        // CaixaBank custodian covers both direct Caixa positions and Abel Font positions
        const gestorGroup =
          (custodian === "Abel Font" || custodian === "Bankinter")  ? "abel" :
          (custodian === "CaixaBank" && ABEL_ISINS.has(isin))       ? "abel" :
          (custodian === "CaixaBank")                               ? "caixa" :
          (custodian === "UBS" || custodian === "Credit Suisse")    ? "ubs" :
          "caixa"; // fallback (JPMorgan, etc.)

        for (const { date, value } of series) {
          if (!byDate[date]) byDate[date] = { total: 0, caixa: 0, ubs: 0, abel: 0, rv: 0, rf: 0 };
          byDate[date].total += value;
          byDate[date][gestorGroup] += value;
          if (tipus === "RV") byDate[date].rv += value;
          else               byDate[date].rf += value;
        }
      }
    }

    return Object.keys(byDate).sort().map(date => {
      const d = byDate[date];
      const monthKey = date.slice(0, 7);
      const andbank = ANDBANK_BY_MONTH.get(monthKey) ?? andbankVal;
      return {
        label:   fmtMonth(date),
        total:   d.total + andbank,
        rv:      d.rv,
        rf:      d.rf,
        caixa:   d.caixa,
        ubs:     d.ubs,
        abel:    d.abel,
        andbank,
      };
    });
  }, []);

  // ── Evolution chart data ────────────────────────────────
  const chartData = useMemo(() => {
    // Prefer PM_VALUES mark-to-market for total + gestor views.
    // Actiu (RV/RF split) always uses PM_MONTHLY — UBS/Caixa positions lack individual ISIN
    // type data in PM_VALUES, so their value would land in RF by default, inflating that bucket.
    if (mvData && chartView !== "actiu") {
      if (chartView === "total") return mvData.map(d => ({ label: d.label, total: d.total }));
      return mvData.map(d => ({
        label:   d.label,
        caixa:   d.caixa,
        ubs:     d.ubs,
        abel:    d.abel,
        andbank: d.andbank,
      }));
    }
    // PM_MONTHLY for actiu view (correct RV/RF split) and fallback for all views
    return PM_MONTHLY.map(d => {
      if (chartView === "total") return {
        label: d.label,
        total: d.caixaRV + d.caixaRF + d.ubsRV + d.ubsRF + (d.abelBK ?? 0) + d.andbank,
      };
      if (chartView === "actiu") return {
        label: d.label,
        rv: d.caixaRV + d.ubsRV + (d.abelBK != null ? d.abelBK * ABEL_RV_SPLIT : 0),
        rf: d.caixaRF + d.ubsRF + (d.abelBK != null ? d.abelBK * ABEL_RF_SPLIT : 0) + d.andbank,
      };
      return {
        label:   d.label,
        caixa:   d.caixaRV + d.caixaRF,
        ubs:     d.ubsRV + d.ubsRF,
        abel:    d.abelBK ?? 0,
        andbank: d.andbank,
      };
    });
  }, [chartView, mvData]);

  // ── Inflow data (from transaction log) ──────────────────
  // cumulativeCost: running sum of buy valueEur, keyed by bi-weekly bucket date
  // topInflows: top-5 largest single buy events (for reference lines)
  const { cumulativeCostByLabel, topInflowLabels, topInflows } = useMemo(() => {
    const buys = PM_TRANSACTIONS.filter(t => t.action === "buy" && t.date && t.valueEur);
    // Aggregate by bi-weekly bucket
    const byBucket = {};
    buys.forEach(t => {
      const [y, mo, d] = t.date.split("-");
      const anchor = +d < 15 ? "01" : "15";
      const bucket = `${y}-${mo}-${anchor}`;
      byBucket[bucket] = (byBucket[bucket] ?? 0) + t.valueEur;
    });
    // Cumulative sum by bucket
    const sortedBuckets = Object.keys(byBucket).sort();
    let running = 0;
    const cumByBucket = {};
    sortedBuckets.forEach(b => { running += byBucket[b]; cumByBucket[b] = running; });
    // Map bucket → chart label for lookup
    const cumByLabel = {};
    sortedBuckets.forEach(b => { cumByLabel[fmtMonth(b)] = cumByBucket[b]; });
    // Top-5 largest single-day inflows for markers
    const top5 = sortedBuckets
      .map(b => ({ label: fmtMonth(b), value: byBucket[b] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    return { cumulativeCostByLabel: cumByLabel, topInflowLabels: new Set(top5.map(t => t.label)), topInflows: top5 };
  }, []);

  // Attach cumulativeCost to each chartData point — forward-filled so it's a continuous step
  const chartDataWithCost = useMemo(() => {
    let lastCost = null;
    return chartData.map(d => {
      const cost = cumulativeCostByLabel[d.label] ?? lastCost;
      if (cost != null) lastCost = cost;
      return { ...d, costBasis: cost };
    });
  }, [chartData, cumulativeCostByLabel]);

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
            <LineChart data={providerData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: tc.textLight }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => v.toFixed(1) + "%"} tick={{ fontSize: 10, fill: tc.textLight }} axisLine={false} tickLine={false} width={44} />
              <ReferenceLine y={0} stroke={tc.border} strokeDasharray="4 2" />
              <Tooltip
                {...tooltipStyle}
                formatter={(v, name) => [pctFmt(v), name]}
              />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              {activeMgrs.map(m => (
                <Line
                  key={m.id}
                  dataKey={m.id}
                  name={m.nom}
                  stroke={MGR_COLORS[m.id]}
                  strokeWidth={2}
                  dot={{ r: 4, fill: MGR_COLORS[m.id] }}
                  connectNulls
                />
              ))}
            </LineChart>
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
          <AreaChart data={chartDataWithCost} stackOffset="none" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {Object.entries(AREA_COLORS).map(([id, color]) => (
                <linearGradient key={id} id={`pm-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.04} />
                </linearGradient>
              ))}
              <linearGradient id="pm-grad-cost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#E8A020" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#E8A020" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: tc.textLight }} />
            <YAxis tickFormatter={fmtM} tick={{ fontSize: 10, fill: tc.textLight }} width={70} />
            <Tooltip
              {...tooltipStyle}
              formatter={(v, name) => [fmtM(v), name.charAt(0).toUpperCase() + name.slice(1)]}
            />
            {chartView === "total" && topInflows.map(inf => (
              <ReferenceLine key={inf.label} x={inf.label}
                stroke={tc.textLight} strokeDasharray="3 3" strokeWidth={1}
                label={{ value: `+${fmtM(inf.value)}`, position: "top", fontSize: 8, fill: tc.textLight }} />
            ))}
            {chartView === "total" && (
              <Area type="monotone" dataKey="costBasis"
                stroke="#E8A020" fill="url(#pm-grad-cost)"
                strokeWidth={1.5} dot={false} name="Capital invertit" connectNulls />
            )}
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
            ? "CaixaBank, UBS, Bankinter i WAM–Andbank mostrats per separat. WAM–Andbank amb sèrie mensual interpolada (anchors anuals)."
            : mvData
              ? "WAM i Andbank inclosos amb interpolació lineal (anchors Dec 2023–Mar 2026). Posicions no confirmades excloses."
              : "Dades de PM_MONTHLY (font manual). WAM i Andbank amb sèrie mensual interpolada."}
        </div>
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

    </div>
  );
}

