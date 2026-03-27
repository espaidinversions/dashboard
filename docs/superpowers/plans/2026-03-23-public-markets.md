# Public Markets Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Alternatives" top-level section with "Mercats Públics" and "Real Estate" sub-tabs; implement the Public Markets tab with KPI cards, portfolio evolution chart (3 toggle views), and manager performance section.

**Architecture:** Three files touched. Static historical data in a new `src/data/publicMarkets.js`. New component `PublicMarketsTab.jsx` (KPIs + AreaChart + BarChart). Navigation wired in `Dashboard.jsx` (SUPRA array, `supra` derivation, click handler, keyboard nav, sub-tab bar, render).

**Tech Stack:** React 18, Recharts (AreaChart, BarChart), existing theme (`useTheme`), `fmtM` from utils, `Badge` from SharedComponents.

---

## Task 1: Create the static data file

**Files:**
- Create: `src/data/publicMarkets.js`

- [ ] **Step 1: Create the file with `PM_MONTHLY` and `PM_MANAGERS`**

`src/data/publicMarkets.js`:

```js
// Public Markets static data — extracted from Resum Financer Espai 2026_vClaudeRoberto.xlsx
// and Bankinter/Andbank reports (Mar 2026).
//
// DATA PROVENANCE
// caixaRV  — confirmed monthly from TWR sheets, Dec 2023–Mar 2026, zero interpolation
// caixaRF  — confirmed 2024; held flat 3_992_338 for Jan–Nov 2025 (0.47% monthly vol);
//            Jan–Feb 2026 confirmed; Mar 2026 uses Feb value
// ubsRV    — confirmed Dec 2023–Jun 2024 and Jan–Jun 2025 and Dec 2025–Mar 2026;
//            Jul–Nov 2024 linearly interpolated (7_893_005 → 8_250_234);
//            Jul–Nov 2025 linearly interpolated (8_765_865 → 10_678_097)
// ubsRF    — confirmed Dec 2023–Jun 2024 and Dec 2025–Feb 2026;
//            Jul 2024–Nov 2025 linearly interpolated (2_716_639 → 2_228_738)
//            accounting for known ~986k redemption in Apr 2024;
//            Mar 2026 uses Feb value
// abelBK   — null before Apr 2025; Apr 2025–Mar 2026 confirmed from Bankinter report

export const PM_MONTHLY = [
  // ── Dec 2023 ────────────────────────────────────────────
  { date:"2023-12", label:"Des '23", caixaRV:6_260_222, caixaRF:4_013_654, ubsRV:10_236_736, ubsRF:3_690_362, abelBK:null },
  // ── 2024 ────────────────────────────────────────────────
  { date:"2024-01", label:"Gen '24", caixaRV:6_381_485, caixaRF:4_043_704, ubsRV:10_411_866, ubsRF:3_713_698, abelBK:null },
  { date:"2024-02", label:"Feb '24", caixaRV:5_744_139, caixaRF:4_081_998, ubsRV:8_700_807,  ubsRF:3_752_120, abelBK:null },
  { date:"2024-03", label:"Mar '24", caixaRV:5_918_881, caixaRF:4_053_262, ubsRV:7_814_136,  ubsRF:3_703_334, abelBK:null },
  { date:"2024-04", label:"Abr '24", caixaRV:5_775_461, caixaRF:3_739_274, ubsRV:7_509_165,  ubsRF:2_708_063, abelBK:null },
  { date:"2024-05", label:"Mai '24", caixaRV:6_843_652, caixaRF:3_762_474, ubsRV:7_722_095,  ubsRF:2_724_952, abelBK:null },
  { date:"2024-06", label:"Jun '24", caixaRV:6_946_413, caixaRF:3_775_540, ubsRV:7_893_005,  ubsRF:2_716_639, abelBK:null },
  { date:"2024-07", label:"Jul '24", caixaRV:7_036_117, caixaRF:3_901_727, ubsRV:7_952_543,  ubsRF:2_689_533, abelBK:null }, // ubsRV interp
  { date:"2024-08", label:"Ago '24", caixaRV:7_096_349, caixaRF:3_914_830, ubsRV:8_012_081,  ubsRF:2_662_427, abelBK:null }, // ubsRV interp
  { date:"2024-09", label:"Set '24", caixaRV:7_244_782, caixaRF:3_939_397, ubsRV:8_071_619,  ubsRF:2_635_321, abelBK:null }, // ubsRV interp
  { date:"2024-10", label:"Oct '24", caixaRV:7_216_196, caixaRF:3_980_125, ubsRV:8_131_157,  ubsRF:2_608_215, abelBK:null }, // ubsRV interp
  { date:"2024-11", label:"Nov '24", caixaRV:7_577_969, caixaRF:3_978_907, ubsRV:8_190_695,  ubsRF:2_581_109, abelBK:null }, // ubsRV interp
  { date:"2024-12", label:"Des '24", caixaRV:7_480_556, caixaRF:3_992_338, ubsRV:8_250_234,  ubsRF:2_554_003, abelBK:null },
  // ── 2025 ────────────────────────────────────────────────
  { date:"2025-01", label:"Gen '25", caixaRV:7_768_451, caixaRF:3_992_338, ubsRV:8_541_892,  ubsRF:2_526_897, abelBK:null },
  { date:"2025-02", label:"Feb '25", caixaRV:7_718_892, caixaRF:3_992_338, ubsRV:8_352_934,  ubsRF:2_499_791, abelBK:null },
  { date:"2025-03", label:"Mar '25", caixaRV:7_291_453, caixaRF:3_992_338, ubsRV:7_827_909,  ubsRF:2_472_685, abelBK:null },
  { date:"2025-04", label:"Abr '25", caixaRV:7_467_258, caixaRF:3_992_338, ubsRV:8_088_432,  ubsRF:2_445_579, abelBK:12_550_766 },
  { date:"2025-05", label:"Mai '25", caixaRV:7_838_672, caixaRF:3_992_338, ubsRV:8_530_284,  ubsRF:2_418_473, abelBK:13_072_330 },
  { date:"2025-06", label:"Jun '25", caixaRV:7_934_352, caixaRF:3_992_338, ubsRV:8_765_865,  ubsRF:2_391_367, abelBK:13_213_868 },
  { date:"2025-07", label:"Jul '25", caixaRV:7_874_688, caixaRF:3_992_338, ubsRV:9_084_570,  ubsRF:2_364_261, abelBK:13_024_261 }, // ubsRV interp
  { date:"2025-08", label:"Ago '25", caixaRV:8_059_251, caixaRF:3_992_338, ubsRV:9_403_275,  ubsRF:2_337_155, abelBK:13_032_505 }, // ubsRV interp
  { date:"2025-09", label:"Set '25", caixaRV:8_211_556, caixaRF:3_992_338, ubsRV:9_721_980,  ubsRF:2_310_049, abelBK:13_325_104 }, // ubsRV interp
  { date:"2025-10", label:"Oct '25", caixaRV:8_160_595, caixaRF:3_992_338, ubsRV:10_040_685, ubsRF:2_282_943, abelBK:13_681_568 }, // ubsRV interp
  { date:"2025-11", label:"Nov '25", caixaRV:8_073_468, caixaRF:3_992_338, ubsRV:10_359_390, ubsRF:2_255_837, abelBK:13_587_323 }, // ubsRV interp
  { date:"2025-12", label:"Des '25", caixaRV:8_134_950, caixaRF:3_992_338, ubsRV:10_678_097, ubsRF:2_228_738, abelBK:13_570_385 },
  // ── 2026 ────────────────────────────────────────────────
  { date:"2026-01", label:"Gen '26", caixaRV:8_244_136, caixaRF:4_049_948, ubsRV:10_995_276, ubsRF:2_244_148, abelBK:13_577_708 },
  { date:"2026-02", label:"Feb '26", caixaRV:8_192_127, caixaRF:3_990_758, ubsRV:11_031_708, ubsRF:2_220_845, abelBK:13_544_782 },
  { date:"2026-03", label:"Mar '26", caixaRV:8_037_347, caixaRF:3_990_758, ubsRV:10_704_128, ubsRF:2_220_845, abelBK:16_676_391 },
];

// Current manager snapshots — as of Mar 2026
// rendPct: since-inception TWR for WAM/Andbank; YTD for UBS; null for Abel (multi-sleeve)
//          Not rendered in this version — reserved for future "des de creació" display
// Abel ytd/r2025/r2024: Bankinter sleeve only (€16.7M of €20.9M total)
// Abel valorActual: Bankinter €16,676,391 + IB €4,256,627
export const PM_MANAGERS = [
  { id:"caixa-rv", nom:"Caixa RV",     gestor:"CaixaBank", tipus:"RV",    valorActual:8_037_347,  rendPct:7.44,  ytd:-1.20,  r2025:9.51,  r2024:17.02 },
  { id:"caixa-rf", nom:"Caixa RF",     gestor:"CaixaBank", tipus:"RF",    valorActual:3_990_758,  rendPct:-0.04, ytd:-0.004, r2025:4.96,  r2024:4.96  },
  { id:"ubs-rv",   nom:"UBS RV",       gestor:"UBS",       tipus:"RV",    valorActual:10_704_128, rendPct:0.37,  ytd:0.37,   r2025:null,  r2024:null  },
  { id:"ubs-rf",   nom:"UBS RF",       gestor:"UBS",       tipus:"RF",    valorActual:2_220_845,  rendPct:-0.35, ytd:-0.35,  r2025:null,  r2024:null  },
  { id:"wam",      nom:"WAM (Goyo)",   gestor:"WAM",       tipus:"RF",    valorActual:6_089_314,  rendPct:18.11, ytd:0.48,   r2025:null,  r2024:null  },
  { id:"abel",     nom:"Abel (BK+IB)", gestor:"Abel Font", tipus:"RV+RF", valorActual:20_933_017, rendPct:null,  ytd:-2.68,  r2025:-8.05, r2024:11.44 },
  { id:"andbank",  nom:"Andbank Bons", gestor:"Andbank",   tipus:"RF",    valorActual:6_088_661,  rendPct:17.76, ytd:0.60,   r2025:4.18,  r2024:6.32  },
];
```

- [ ] **Step 2: Verify the file parses without errors**

```bash
cd "C:\Users\EduardGenís\OneDrive - Espai d'Inversions\Documents\Claude\01. Dashboard"
node -e "import('./src/data/publicMarkets.js').then(m => { console.log('PM_MONTHLY length:', m.PM_MONTHLY.length); console.log('PM_MANAGERS length:', m.PM_MANAGERS.length); console.log('First:', JSON.stringify(m.PM_MONTHLY[0])); console.log('Last:', JSON.stringify(m.PM_MONTHLY[m.PM_MONTHLY.length-1])); })"
```

Expected output:
```
PM_MONTHLY length: 28
PM_MANAGERS length: 7
First: {"date":"2023-12","label":"Des '23","caixaRV":6260222,...}
Last:  {"date":"2026-03","label":"Mar '26","caixaRV":8037347,...}
```

- [ ] **Step 3: Commit**

```bash
git add src/data/publicMarkets.js
git commit -m "feat: add public markets static data (PM_MONTHLY + PM_MANAGERS)"
```

---

## Task 2: Create the PublicMarketsTab component

**Files:**
- Create: `src/components/PublicMarketsTab.jsx`

Context:
- `useTheme()` returns `{ tc, dark, toggle }` — `tc` is the color object (tc.card, tc.border, tc.navy, tc.green, tc.red, tc.textLight, tc.textMid, tc.text, tc.bg, tc.bgAlt)
- `fmtM(n)` formats euros: ≥1M → "1.23M€", ≥1k → "123K€"
- `Badge` from SharedComponents accepts `{ label, cfg: { color, bg } }`
- Recharts: import AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid from "recharts"
- No props — reads directly from PM_MONTHLY and PM_MANAGERS

- [ ] **Step 4: Create `src/components/PublicMarketsTab.jsx`**

```jsx
import React, { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useTheme } from "../theme.js";
import { fmtM } from "../utils.js";
import { Badge } from "./SharedComponents.jsx";
import { PM_MONTHLY, PM_MANAGERS } from "../data/publicMarkets.js";

// ── Constants ──────────────────────────────────────────────
const ABEL_RV_SPLIT = 0.7516; // from Bankinter Mar 2026 report
const ABEL_RF_SPLIT = 0.1868; // remaining ~6.16% is cash/liquidity, excluded

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

// ── Local helpers ──────────────────────────────────────────
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
  const pos   = v > 0;
  const neg   = v < 0;
  const color = pos ? tc.green : neg ? tc.red : tc.textLight;
  const bg    = pos ? "#E8F8E8" : neg ? "#FDECEA" : tc.bgAlt;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 4, padding: "1px 6px", fontFamily: "'DM Mono',monospace" }}>
      {pos ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}

// ── Main component ─────────────────────────────────────────
export function PublicMarketsTab() {
  const { tc, dark } = useTheme();
  const [chartView, setChartView] = useState("total");

  // ── KPI derivations ────────────────────────────────────
  const total = useMemo(() =>
    PM_MANAGERS.reduce((s, m) => s + m.valorActual, 0)
  , []);

  const totalRV = useMemo(() =>
    PM_MANAGERS.reduce((s, m) => {
      if (m.tipus === "RV")    return s + m.valorActual;
      if (m.tipus === "RV+RF") return s + m.valorActual * ABEL_RV_SPLIT;
      return s;
    }, 0)
  , []);

  const totalRF = useMemo(() =>
    PM_MANAGERS.reduce((s, m) => {
      if (m.tipus === "RF")    return s + m.valorActual;
      if (m.tipus === "RV+RF") return s + m.valorActual * ABEL_RF_SPLIT;
      return s;
    }, 0)
  , []);

  const ytdWeighted = useMemo(() => {
    const valid  = PM_MANAGERS.filter(m => m.ytd != null);
    const sumVal = valid.reduce((s, m) => s + m.valorActual, 0);
    return valid.reduce((s, m) => s + m.ytd * m.valorActual, 0) / sumVal;
  }, []);

  const bestGestor2025 = useMemo(() =>
    [...PM_MANAGERS].filter(m => m.r2025 != null).sort((a, b) => b.r2025 - a.r2025)[0]
  , []);

  // ── Chart data ─────────────────────────────────────────
  const wamVal     = PM_MANAGERS.find(m => m.id === "wam").valorActual;
  const andbankVal = PM_MANAGERS.find(m => m.id === "andbank").valorActual;

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
    // gestor
    return {
      label:   d.label,
      caixa:   d.caixaRV + d.caixaRF,
      ubs:     d.ubsRV + d.ubsRF,
      abel:    d.abelBK ?? 0,
      wam:     wamVal,
      andbank: andbankVal,
    };
  }), [chartView, wamVal, andbankVal]);

  // ── Performance bar data — null → undefined so Recharts skips bar ──
  const perfData = useMemo(() =>
    PM_MANAGERS
      .filter(m => m.ytd != null || m.r2025 != null || m.r2024 != null)
      .map(m => ({
        nom:   m.nom.replace("(BK+IB)", "").replace("Bons", "").trim(),
        ytd:   m.ytd   ?? undefined,
        r2025: m.r2025 ?? undefined,
        r2024: m.r2024 ?? undefined,
      }))
  , []);

  // ── Shared styles ──────────────────────────────────────
  const card        = { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" };
  const secLabel    = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600 };
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
          value={`${ytdWeighted >= 0 ? "+" : ""}${ytdWeighted.toFixed(2)}%`}
          sub="Ponderat per valor" tc={tc}
          valueColor={ytdWeighted >= 0 ? tc.green : tc.red} />
        <KpiCard label="Millor Gestor '25"
          value={bestGestor2025 ? `+${bestGestor2025.r2025.toFixed(2)}%` : "—"}
          sub={bestGestor2025?.nom} tc={tc} valueColor={tc.green} />
      </div>

      {/* ── ② Evolution chart ── */}
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

        {chartView !== "gestor" && (
          <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
            WAM (€6.1M) i Andbank (€6.1M) no inclosos a la sèrie temporal per manca de dades mensuals.
          </div>
        )}
      </div>

      {/* ── ③ Manager cards ── */}
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
                <span style={{ fontSize: 10, color: tc.textLight }}>YTD</span>
                <PctChip v={m.ytd} tc={tc} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: tc.textLight }}>2025</span>
                <PctChip v={m.r2025} tc={tc} />
                <span style={{ fontSize: 10, color: tc.textLight, marginLeft: 4 }}>2024</span>
                <PctChip v={m.r2024} tc={tc} />
              </div>
              <div style={{ fontSize: 10, color: tc.textLight, marginTop: 6 }}>{m.gestor}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ③b Performance bar chart ── */}
      <div style={card}>
        <div style={{ ...secLabel, marginBottom: 16 }}>Rendiment Comparatiu</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={perfData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="25%" barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
            <XAxis dataKey="nom" tick={{ fontSize: 10, fill: tc.textLight }} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: tc.textLight }} width={44} />
            <Tooltip
              {...tooltipStyle}
              formatter={(v, name) => [v != null ? `${v > 0 ? "+" : ""}${v.toFixed(2)}%` : "—", name]}
            />
            <Bar dataKey="ytd"   name="YTD"  fill="#2B5070" fillOpacity={0.85} />
            <Bar dataKey="r2025" name="2025" fill="#3DC83E" fillOpacity={0.85} />
            <Bar dataKey="r2024" name="2024" fill="#E8A020" fillOpacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/PublicMarketsTab.jsx
git commit -m "feat: add PublicMarketsTab component (KPIs, evolution chart, manager section)"
```

---

## Task 3: Wire navigation in Dashboard.jsx

**Files:**
- Modify: `src/components/Dashboard.jsx`

The current file has these key lines to change (use the Read tool to confirm exact line numbers before editing if needed):
- **Line ~21**: imports block — add `PublicMarketsTab` import
- **Line ~394**: `const SUPRA = [` — add "alternatives" entry
- **Line ~400**: `const supra = ...` — extend with "alternatives" condition
- **Line ~414**: `const supraIds = [...]` — extend array
- **Line ~417**: `setTab(nextSupra === "fons" ...)` — handle "alternatives"
- **Line ~470**: SUPRA button `onClick` — add "alternatives" case
- **Line ~528**: after `{/* ── Sub-tabs (Fons only) ── */}` block — add alternatives sub-tabs block
- **Line ~557**: after inversions tab-panel renders — add mercats-publics and real-estate renders

- [ ] **Step 6: Add import for PublicMarketsTab**

In `src/components/Dashboard.jsx`, find the import block (around line 21). After the `DataLoader` import, add:

```js
import { PublicMarketsTab } from "./PublicMarketsTab.jsx";
```

- [ ] **Step 7: Extend SUPRA array**

Find (around line 394):
```js
  const SUPRA = [
    {id:"fons",       label:"Fons"},
    {id:"searchers",  label:"Searchers"},
    {id:"portfolio",  label:"Participades"},
    {id:"inversions", label:"Detall per Inversió"},
  ];
```

Replace with:
```js
  const SUPRA = [
    {id:"fons",         label:"Fons"},
    {id:"searchers",    label:"Searchers"},
    {id:"portfolio",    label:"Participades"},
    {id:"inversions",   label:"Detall per Inversió"},
    {id:"alternatives", label:"Alternatives"},
  ];
  const ALTERNATIVES_TABS = [
    { id:"mercats-publics", label:"Mercats Públics" },
    { id:"real-estate",     label:"Real Estate" },
  ];
```

- [ ] **Step 8: Extend `supra` derivation**

Find (around line 400):
```js
  const supra = tab==="searchers"?"searchers":tab==="portfolio"?"portfolio":tab==="inversions"?"inversions":"fons";
```

Replace with:
```js
  const supra = tab==="searchers"?"searchers":tab==="portfolio"?"portfolio":tab==="inversions"?"inversions":(tab==="mercats-publics"||tab==="real-estate")?"alternatives":"fons";
```

- [ ] **Step 9: Update keyboard navigation**

Find (around line 414):
```js
        const supraIds = ["fons", "searchers", "portfolio"];
        const idx = supraIds.indexOf(supra);
        const nextSupra = supraIds[(idx + dir + supraIds.length) % supraIds.length];
        setTab(nextSupra === "fons" ? "pipeline" : nextSupra);
```

Replace with:
```js
        const supraIds = ["fons", "searchers", "portfolio", "inversions", "alternatives"];
        const idx = supraIds.indexOf(supra);
        const nextSupra = supraIds[(idx + dir + supraIds.length) % supraIds.length];
        setTab(nextSupra === "fons" ? "pipeline" : nextSupra === "alternatives" ? "mercats-publics" : nextSupra);
```

- [ ] **Step 10: Update SUPRA button onClick handler**

Find (around line 470):
```js
            onClick={()=>{ setTab(s.id==="fons"?"pipeline":s.id==="searchers"?"searchers":s.id==="portfolio"?"portfolio":"inversions"); }}
```

Replace with:
```js
            onClick={()=>{ setTab(s.id==="fons"?"pipeline":s.id==="searchers"?"searchers":s.id==="portfolio"?"portfolio":s.id==="inversions"?"inversions":"mercats-publics"); }}
```

- [ ] **Step 11: Add alternatives sub-tab bar**

Find the block (around line 507):
```jsx
      {/* ── Sub-tabs (Fons only) ── */}
      {supra==="fons"&&(
```

Immediately before that block, insert:
```jsx
      {/* ── Sub-tabs (Alternatives) ── */}
      {supra==="alternatives"&&(
      <div className="tab-bar no-print" style={{background:tc.card,borderBottom:`1px solid ${tc.border}`,padding:"0 32px",display:"flex",gap:0}}>
        {ALTERNATIVES_TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?tc.green:"transparent"}`,padding:"11px 20px",cursor:"pointer",fontSize:12,fontWeight:tab===t.id?600:400,color:tab===t.id?tc.navy:tc.textMid,fontFamily:"inherit",transition:"color 0.15s, border-color 0.15s",whiteSpace:"nowrap",letterSpacing:"0.01em"}}>
            {t.label}
          </button>
        ))}
      </div>
      )}
```

- [ ] **Step 12: Add tab panel renders**

Find (around line 557):
```jsx
        {/* ── DETALL PER INVERSIÓ ── */}
        {tab==="inversions"&&inversionsSubTab==="fons"&&(
```

Immediately before that block, insert:
```jsx
        {/* ── ALTERNATIVES ── */}
        {tab==="mercats-publics"&&<div className="tab-panel"><PublicMarketsTab/></div>}
        {tab==="real-estate"&&(
          <div className="tab-panel" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 0",gap:12}}>
            <div style={{fontSize:32}}>🏗️</div>
            <div style={{fontSize:16,fontWeight:700,color:tc.navy}}>Real Estate</div>
            <div style={{fontSize:13,color:tc.textLight}}>Pròximament</div>
          </div>
        )}
```

- [ ] **Step 13: Run dev server and verify visually**

```bash
npm run dev
```

Check:
1. "Alternatives" appears in the dark navy top nav after "Detall per Inversió"
2. Clicking it shows "Mercats Públics" and "Real Estate" in the white sub-tab bar
3. "Mercats Públics" shows 5 KPI cards, the evolution chart, 7 manager cards, performance bar chart
4. Chart toggle works: Total → Per Actiu → Per Gestor all render without console errors
5. "Real Estate" shows the placeholder with "Pròximament"
6. ArrowLeft/ArrowRight keyboard navigation cycles through Alternatives correctly
7. Dark mode toggle works on all new sections

- [ ] **Step 14: Run build to confirm no TypeScript/ESLint errors**

```bash
npm run build
```

Expected: `✓ built in X.XXs` with no new errors (existing warnings about xlsx chunk size are pre-existing).

- [ ] **Step 15: Commit**

```bash
git add src/components/Dashboard.jsx
git commit -m "feat: add Alternatives SUPRA tab with Mercats Públics and Real Estate"
```
