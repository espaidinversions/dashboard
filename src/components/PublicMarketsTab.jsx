import React, { useState, useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import { useTheme } from "../theme.js";
import { fmtM } from "../utils.js";
import { Badge } from "./SharedComponents.jsx";
import { PM_MONTHLY, PM_MANAGERS } from "../data/publicMarkets.js";

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
  ubs:     "#E8A020",
  abel:    "#3DC83E",
  wam:     "#6B2E7E",
  andbank: "#7A6000",
};

// Color per manager for return charts
const MGR_COLORS = {
  "caixa-rv": "#2B5070",
  "caixa-rf": "#E8A020",
  "ubs-rv":   "#4E79A7",
  "ubs-rf":   "#76B7B2",
  "wam":      "#6B2E7E",
  "abel":     "#3DC83E",
  "andbank":  "#7A6000",
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
const wamVal     = PM_MANAGERS.find(m => m.id === "wam").valorActual;
const andbankVal = PM_MANAGERS.find(m => m.id === "andbank").valorActual;

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

  // ── Return charts data ───────────────────────────────────

  // Per provider: X = period, one data key per manager
  const providerData = useMemo(() =>
    PERIODS.map(({ field, label }) => {
      const point = { year: label };
      PM_MANAGERS.forEach(m => {
        if (m[field] != null) point[m.id] = parseFloat(m[field].toFixed(2));
      });
      return point;
    }), []);

  // Managers that have at least one non-null return across the three periods
  const activeMgrs = useMemo(() =>
    PM_MANAGERS.filter(m => PERIODS.some(p => m[p.field] != null)), []);

  // Per strategy: X = period, lines for RV, RF, Total
  const strategyData = useMemo(() =>
    PERIODS.map(({ field, label }) => ({
      year:  label,
      rv:    weightedReturn(field, "RV"),
      rf:    weightedReturn(field, "RF"),
      total: weightedReturn(field),
    })), []);

  // ── Evolution chart data ────────────────────────────────
  const chartData = useMemo(() => PM_MONTHLY.map(d => {
    if (chartView === "total") return {
      label: d.label,
      total: d.caixaRV + d.caixaRF + d.ubsRV + d.ubsRF + (d.abelBK ?? 0),
    };
    if (chartView === "actiu") return {
      label: d.label,
      rv: d.caixaRV + d.ubsRV + (d.abelBK != null ? d.abelBK * ABEL_RV_SPLIT : 0),
      rf: d.caixaRF + d.ubsRF + (d.abelBK != null ? d.abelBK * ABEL_RF_SPLIT : 0),
    };
    return {
      label:   d.label,
      caixa:   d.caixaRV + d.caixaRF,
      ubs:     d.ubsRV + d.ubsRF,
      abel:    d.abelBK ?? 0,
      wam:     wamVal,
      andbank: andbankVal,
    };
  }), [chartView]);

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
        <KpiCard label="Millor Gestor '25"
          value={bestGestor2025 ? pctFmt(bestGestor2025.r2025) : "—"}
          sub={bestGestor2025?.nom} tc={tc} valueColor={tc.green} />
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
                  name={m.nom.replace("(BK+IB)", "").replace("(Goyo)", "").replace("Bons", "").trim()}
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
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: tc.textLight }} />
            <YAxis tickFormatter={fmtM} tick={{ fontSize: 10, fill: tc.textLight }} width={70} />
            <Tooltip
              {...tooltipStyle}
              formatter={(v, name) => [fmtM(v), name.charAt(0).toUpperCase() + name.slice(1)]}
            />
            {chartView === "total" && (
              <Area type="monotone" dataKey="total"
                stroke={AREA_COLORS.total} fill={`url(#pm-grad-total)`}
                strokeWidth={2} dot={false} name="Total" />
            )}
            {chartView === "actiu" && <>
              <Area type="monotone" dataKey="rv" stackId="a"
                stroke={AREA_COLORS.rv}  fill={`url(#pm-grad-rv)`}
                strokeWidth={1.5} dot={false} name="Renda Variable" />
              <Area type="monotone" dataKey="rf" stackId="a"
                stroke={AREA_COLORS.rf}  fill={`url(#pm-grad-rf)`}
                strokeWidth={1.5} dot={false} name="Renda Fixa" />
            </>}
            {chartView === "gestor" && <>
              <Area type="monotone" dataKey="andbank" stackId="g" stroke={AREA_COLORS.andbank} fill={`url(#pm-grad-andbank)`} strokeWidth={1.5} dot={false} name="Andbank" />
              <Area type="monotone" dataKey="wam"     stackId="g" stroke={AREA_COLORS.wam}     fill={`url(#pm-grad-wam)`}     strokeWidth={1.5} dot={false} name="WAM" />
              <Area type="monotone" dataKey="abel"    stackId="g" stroke={AREA_COLORS.abel}    fill={`url(#pm-grad-abel)`}    strokeWidth={1.5} dot={false} name="Abel" />
              <Area type="monotone" dataKey="ubs"     stackId="g" stroke={AREA_COLORS.ubs}     fill={`url(#pm-grad-ubs)`}     strokeWidth={1.5} dot={false} name="UBS" />
              <Area type="monotone" dataKey="caixa"   stackId="g" stroke={AREA_COLORS.caixa}   fill={`url(#pm-grad-caixa)`}   strokeWidth={1.5} dot={false} name="Caixa" />
            </>}
          </AreaChart>
        </ResponsiveContainer>

        <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
          {chartView === "gestor"
            ? "WAM i Andbank mostrats com a valor actual (sense sèrie mensual disponible)."
            : "WAM (€6.1M) i Andbank (€6.1M) no inclosos a la sèrie temporal per manca de dades mensuals."}
        </div>
      </div>

      {/* ── ④ Manager cards ── */}
      <div>
        <div style={{ ...secLabel, marginBottom: 12 }}>Gestors</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {PM_MANAGERS.map(m => (
            <div key={m.id} className="kpi-card card-hover" style={{
              background: tc.card, border: `1px solid ${tc.border}`,
              borderRadius: 10, padding: "14px 18px", minWidth: 190, flex: "1 1 190px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: tc.navy }}>{m.nom}</span>
                <Badge label={m.tipus} cfg={TIPUS_CFG[m.tipus] || {}} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: tc.navy, fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>
                {fmtM(m.valorActual)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: tc.textLight, letterSpacing: "0.04em" }}>YTD</span>
                <PctChip v={m.ytd} tc={tc} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: tc.textLight, letterSpacing: "0.04em" }}>2025</span>
                <PctChip v={m.r2025} tc={tc} />
                <span style={{ fontSize: 10, color: tc.textLight, marginLeft: 4, letterSpacing: "0.04em" }}>2024</span>
                <PctChip v={m.r2024} tc={tc} />
              </div>
              <div style={{ fontSize: 10, color: tc.textLight, marginTop: 6 }}>{m.gestor}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
