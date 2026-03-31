# PM Charts Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cumulative money flows bar chart + portfolio value line to summary/RV/RF/vehicle tabs; merge active+discontinued vehicle table; remove transaction page links; write coverage report.

**Architecture:** New shared `CumulativeFlowsChart` component (ComposedChart: stacked bars + line on secondary Y-axis) parameterised by `groupBy` and `transactions`/`valuesSeries` props. All four consumers wire it independently. No global state changes.

**Tech Stack:** React, Recharts (ComposedChart, Bar, Line), existing theme/utils, PM_MONTHLY + PM_TRANSACTIONS + PM_VALUES static data.

**Spec:** `docs/superpowers/specs/2026-03-31-pm-charts-redesign-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `docs/pm-coverage-report.md` | Create | Static markdown coverage report |
| `src/components/CumulativeFlowsChart.jsx` | Create | Shared chart component |
| `src/components/PMTransaccionsTab.jsx` | Modify | Remove fund name links in transaction rows |
| `src/components/PublicMarketsTab.jsx` | Modify | Remove tx accordion links; add "Fluxos acumulats" section with 3-toggle chart |
| `src/components/PMTipusTab.jsx` | Modify | Replace top-12 chart with CumulativeFlowsChart; replace ClosedPositions with merged table |
| `src/components/PMPositionDetail.jsx` | Modify | Replace price evolution ComposedChart with CumulativeFlowsChart |

---

## Task 1: Coverage Report

**Files:**
- Create: `docs/pm-coverage-report.md`

- [ ] **Step 1.1: Write the coverage report**

Create `docs/pm-coverage-report.md` with this exact content:

```markdown
# PM Vehicle Price Data Coverage Report

**Generated:** 2026-03-31
**Script source:** `Mercats Públics/` Python scripts (Morningstar via `mstarpy`)

## Summary

| Category | Total vehicles | With price data | Missing price data |
|----------|---------------|-----------------|-------------------|
| Active positions | 30 | 27 | **3** |
| Closed/discontinued | 139 | 128 | **11** |
| **Total** | **169** | **155** | **14** |

---

## Active Positions Without Price Data (3)

| ISIN | Name | Reason |
|------|------|--------|
| `IE00B3ZW0K19` | iShares S&P 500 EUR Hedged UCITS ETF (Acc) | Purchased 2026-03-19 — too new, Morningstar not yet indexed |
| `LU1681043600` | Amundi MSCI World UCITS ETF - EUR (C) | Morningstar coverage gap |
| `LU1834988519` | Amundi Stoxx Europe 600 Technology UCITS ETF Acc | Morningstar coverage gap |

---

## Closed Positions Without Price Data (11)

| ISIN | Name |
|------|------|
| `FR0013516028` | Carmignac Credit 2025 F EUR Acc |
| `IE00BQN1K787` | iShares Edge MSCI Europe Momentum Factor UCITS ETF |
| `IE00BQN1K788` | iShares Edge MSCI Europe Momentum Factor UCITS ETF (dup) |
| `LU0366534344` | Pictet-Nutrition P EUR |
| `LU0940007262` | Robeco All Strategy Euro Bonds EurHdg |
| `LU1878469862` | Threadneedle (Lux) American Smaller Companies 3EH |
| `LU2004795212` | Schroder ISF QEP Global Emerging Markets K1 Acc EUR |
| `LU2110829848` | Infusive Consumer Alpha Global AA Acc EUR |
| `LU2171257319` | Vontobel Fund Emerging Markets Corporate Bond H EUR Hedged |
| `LU2183143846` | Amundi Funds European Value R (EUR) A |
| `LU2257995980` | Allianz Global Water RT11 EUR Acc |

---

## How to Fix

Add missing ISINs to the Morningstar fetch list in the Python scripts under `Mercats Públics/`.
Re-run the script to populate `fund_prices_combined.csv` and regenerate `portfolioValues.js`.

For `IE00B3ZW0K19`: wait ~1 month for Morningstar to index the new position, then re-run.
```

- [ ] **Step 1.2: Commit**

```bash
git add docs/pm-coverage-report.md
git commit -m "docs: add PM vehicle price data coverage report"
```

---

## Task 2: Remove Transaction Links

**Files:**
- Modify: `src/components/PMTransaccionsTab.jsx`
- Modify: `src/components/PublicMarketsTab.jsx`

- [ ] **Step 2.1: PMTransaccionsTab — remove isinToLink useMemo**

In `src/components/PMTransaccionsTab.jsx`, delete the entire `isinToLink` useMemo block (currently lines ~39–43):

```javascript
// DELETE this block entirely:
const isinToLink = useMemo(() => {
  const map = {};
  PM_POSITIONS.forEach(p => { if (p.isin) map[p.isin] = `/mercats-publics/${p.id}`; });
  return map;
}, []);
```

- [ ] **Step 2.2: PMTransaccionsTab — replace Link with span**

Find the transaction name cell (currently ~line 264–267):

```jsx
// BEFORE:
<td style={{ padding: "8px 10px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
  <Link to={isinToLink[t.isin] ?? `/mercats-publics/${t.isin}`}
    style={{ color: tc.navy, textDecoration: "none", fontWeight: 600 }}>{t.nom}</Link>
</td>
```

Replace with:

```jsx
// AFTER:
<td style={{ padding: "8px 10px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
  <span style={{ color: tc.navy, fontWeight: 600 }}>{t.nom}</span>
</td>
```

- [ ] **Step 2.3: PMTransaccionsTab — clean up unused imports**

Remove `Link` from the react-router-dom import (line 7). Also remove `PM_POSITIONS` from the publicMarkets import if it is now unused (check the file — it was only used by `isinToLink`).

The import line should go from:
```javascript
import { Link } from "react-router-dom";
import { PM_POSITIONS } from "../data/publicMarkets.js";
```
to (remove both, or keep PM_POSITIONS if used elsewhere in the file — verify first):
```javascript
// remove Link import entirely
// remove PM_POSITIONS import if no other reference exists in the file
```

- [ ] **Step 2.4: PublicMarketsTab — replace Link in transaction accordion**

In `src/components/PublicMarketsTab.jsx`, find the transaction accordion name cell (~line 870–876):

```jsx
// BEFORE:
<td style={{ padding: "7px 10px", maxWidth: 220, overflow: "hidden",
  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
  <Link to={`/mercats-publics/${ISIN_TO_ID[t.isin] ?? t.isin}`}
    style={{ color: tc.navy, textDecoration: "none", fontWeight: 600 }}>
    {t.nom}
  </Link>
</td>
```

Replace with:

```jsx
// AFTER:
<td style={{ padding: "7px 10px", maxWidth: 220, overflow: "hidden",
  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
  <span style={{ color: tc.navy, fontWeight: 600 }}>{t.nom}</span>
</td>
```

Note: do NOT remove the `Link` import from PublicMarketsTab — it is still used in the manager positions sub-table (~line 698).

- [ ] **Step 2.5: Commit**

```bash
git add src/components/PMTransaccionsTab.jsx src/components/PublicMarketsTab.jsx
git commit -m "feat: remove vehicle links from transaction movement rows"
```

---

## Task 3: Create CumulativeFlowsChart Component

**Files:**
- Create: `src/components/CumulativeFlowsChart.jsx`

- [ ] **Step 3.1: Write the component**

Create `src/components/CumulativeFlowsChart.jsx`:

```jsx
import React, { useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { useTheme } from "../theme.js";
import { fmtM, fmtMonth } from "../utils.js";
import { PM_POSITIONS } from "../data/publicMarkets.js";

// Manager routing — mirrors PublicMarketsTab mvData logic
const ABEL_ISINS = new Set(
  PM_POSITIONS.filter(p => p.gestor === "Abel Font").map(p => p.isin)
);

function custodianToMgr(custodian, isin) {
  if (custodian === "Bankinter")                          return "abel";
  if (custodian === "UBS" || custodian === "Credit Suisse") return "ubs";
  if (custodian === "CaixaBank") return ABEL_ISINS.has(isin) ? "abel" : "caixa";
  return "andbank"; // WAM / Andbank / fallback
}

const MGR_COLORS = { caixa: "#2B5070", ubs: "#4E79A7", abel: "#F28E2B", andbank: "#59A14F" };
const MGR_NAMES  = { caixa: "CaixaBank", ubs: "UBS", abel: "Bankinter", andbank: "WAM–Andbank" };
const ASSET_COLORS = { RV: "#2B5070", RF: "#F28E2B" };
const ASSET_NAMES  = { RV: "Renda Variable", RF: "Renda Fixa" };
const TOP5_COLORS  = ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F"];

// Normalise any date string to "YYYY-MM" month key
const toMonth = d => (typeof d === "string" ? d : "").slice(0, 7);

// Format month key for axis labels
const fmtMonthKey = v => fmtMonth(v.length === 7 ? v + "-01" : v);

/**
 * CumulativeFlowsChart
 *
 * Props:
 *   transactions  — array of PM_TRANSACTIONS rows already filtered to scope
 *   valuesSeries  — array of { date: string, value: number } portfolio value time series
 *   groupBy       — "total" | "assetType" | "manager" | "position"
 *   topN          — number of top positions to name (rest → "Altres"), default 5
 *   height        — chart height in px, default 260
 */
export function CumulativeFlowsChart({
  transactions,
  valuesSeries,
  groupBy = "total",
  topN = 5,
  height = 260,
}) {
  const { tc } = useTheme();

  const { chartData, keys, colorMap, nameMap } = useMemo(() => {
    const buys = (transactions ?? []).filter(
      t => t.action === "buy" && t.date && t.valueEur > 0
    );

    // Rank ISINs by total invested (for groupBy="position")
    const isinTotals = {};
    buys.forEach(t => { isinTotals[t.isin] = (isinTotals[t.isin] ?? 0) + t.valueEur; });
    const topIsins = Object.entries(isinTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([k]) => k);
    const topIsinSet = new Set(topIsins);

    // Accumulate monthly inflows per group key
    const monthMap = {};
    buys.forEach(t => {
      const month = toMonth(t.date);
      if (!monthMap[month]) monthMap[month] = {};
      let key;
      if      (groupBy === "assetType") key = t.tipus ?? "—";
      else if (groupBy === "manager")   key = custodianToMgr(t.custodian, t.isin);
      else if (groupBy === "position")  key = topIsinSet.has(t.isin) ? t.isin : "altres";
      else                               key = "total";
      monthMap[month][key] = (monthMap[month][key] ?? 0) + t.valueEur;
    });

    const months = Object.keys(monthMap).sort();
    if (months.length === 0) return { chartData: [], keys: [], colorMap: {}, nameMap: {} };

    // Build cumulative running totals
    const running = {};
    const rows = months.map(month => {
      const row = { month };
      Object.entries(monthMap[month]).forEach(([k, v]) => {
        running[k] = (running[k] ?? 0) + v;
      });
      // Emit current running total for every known key (forward-fill zeros)
      Object.entries(running).forEach(([k, v]) => { row[k] = v; });
      return row;
    });

    // Merge portfolio value (forward-fill missing months)
    const valByMonth = {};
    (valuesSeries ?? []).forEach(({ date, value }) => {
      valByMonth[toMonth(date)] = value;
    });
    let lastVal = null;
    rows.forEach(row => {
      const v = valByMonth[row.month] ?? lastVal;
      if (v != null) { row.portfolioValue = v; lastVal = v; }
    });

    // Derive all data keys (exclude axis/value keys)
    const allKeys = [...new Set(
      rows.flatMap(r => Object.keys(r).filter(k => k !== "month" && k !== "portfolioValue"))
    )];

    // Build colorMap and nameMap
    const colorMap = {};
    const nameMap  = {};
    if (groupBy === "manager") {
      allKeys.forEach(k => {
        colorMap[k] = MGR_COLORS[k] ?? "#BAB0AC";
        nameMap[k]  = MGR_NAMES[k]  ?? k;
      });
    } else if (groupBy === "assetType") {
      allKeys.forEach(k => {
        colorMap[k] = ASSET_COLORS[k] ?? "#BAB0AC";
        nameMap[k]  = ASSET_NAMES[k]  ?? k;
      });
    } else if (groupBy === "position") {
      topIsins.forEach((isin, i) => {
        const pos = PM_POSITIONS.find(p => p.isin === isin);
        colorMap[isin] = TOP5_COLORS[i] ?? "#BAB0AC";
        nameMap[isin]  = pos
          ? pos.nom.replace(/\bUCITS ETF\b.*/, "ETF").replace(/\bUCITS\b.*/, "").trim()
          : isin;
      });
      colorMap["altres"] = tc.border ?? "#C8D0D8";
      nameMap["altres"]  = "Altres";
    } else {
      colorMap["total"] = "#2B5070";
      nameMap["total"]  = "Capital invertit";
    }

    return { chartData: rows, keys: allKeys, colorMap, nameMap };
  }, [transactions, valuesSeries, groupBy, topN, tc.border]);

  if (chartData.length === 0) {
    return (
      <p style={{ fontSize: 11, color: "#8A9BAC", padding: "12px 0", fontStyle: "italic" }}>
        Sense dades de fluxos disponibles.
      </p>
    );
  }

  const isStacked        = groupBy !== "total";
  const hasPortfolioValue = chartData.some(r => r.portfolioValue != null);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={chartData}
        margin={{ top: 8, right: hasPortfolioValue ? 64 : 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={tc.border ?? "#E5EAF0"} />
        <XAxis
          dataKey="month"
          tickFormatter={fmtMonthKey}
          tick={{ fontSize: 9, fill: tc.textLight ?? "#8A9BAC" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="left"
          tickFormatter={v => fmtM(v)}
          tick={{ fontSize: 10, fill: tc.textLight ?? "#8A9BAC" }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        {hasPortfolioValue && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={v => fmtM(v)}
            tick={{ fontSize: 9, fill: tc.textLight ?? "#8A9BAC" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
        )}
        <Tooltip
          contentStyle={{
            background: tc.card ?? "#fff",
            border: `1px solid ${tc.border ?? "#E5EAF0"}`,
            borderRadius: 8,
          }}
          labelStyle={{ color: tc.text ?? "#1A2B3C", fontWeight: 600, fontSize: 11 }}
          labelFormatter={v => fmtMonthKey(v)}
          formatter={(v, name) =>
            name === "portfolioValue"
              ? [fmtM(v), "Valor cartera"]
              : [fmtM(v), nameMap[name] ?? name]
          }
        />
        {isStacked && (
          <Legend
            wrapperStyle={{ fontSize: 9, paddingTop: 8 }}
            formatter={n => nameMap[n] ?? n}
          />
        )}
        {keys.map(k => (
          <Bar
            key={k}
            yAxisId="left"
            dataKey={k}
            name={nameMap[k] ?? k}
            stackId={isStacked ? "s" : undefined}
            fill={colorMap[k] ?? "#BAB0AC"}
            maxBarSize={32}
          />
        ))}
        {hasPortfolioValue && (
          <Line
            yAxisId="right"
            dataKey="portfolioValue"
            name="portfolioValue"
            stroke="#59A14F"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            connectNulls
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3.2: Commit**

```bash
git add src/components/CumulativeFlowsChart.jsx
git commit -m "feat: add shared CumulativeFlowsChart component"
```

---

## Task 4: Update PMTipusTab

**Files:**
- Modify: `src/components/PMTipusTab.jsx`

- [ ] **Step 4.1: Update imports**

At the top of `PMTipusTab.jsx`, change:

```javascript
// BEFORE (lines 1-11):
import React, { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import { Link, useNavigate } from "react-router-dom";
import { PM_POSITIONS, PM_CLOSED } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM, fmtMonth, usePersistedState, yearsHeld, cagr } from "../utils.js";
import { PM_VALUES } from "../data/portfolioValues.js";
import { PM_TER } from "../data/pmTer.js";
```

```javascript
// AFTER:
import React, { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import { Link } from "react-router-dom";
import { PM_POSITIONS, PM_CLOSED, PM_MONTHLY } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM, fmtMonth, usePersistedState, yearsHeld, cagr } from "../utils.js";
import { PM_VALUES } from "../data/portfolioValues.js";
import { PM_TER } from "../data/pmTer.js";
import { PM_TRANSACTIONS } from "../data/pmTransactions.js";
import { CumulativeFlowsChart } from "./CumulativeFlowsChart.jsx";
```

Changes: remove `useNavigate`, add `PM_MONTHLY`, `PM_TRANSACTIONS`, `CumulativeFlowsChart`.

- [ ] **Step 4.2: Add ABEL_RV_SPLIT constant**

After the existing constants block (after `YEAR_FIELDS`), add:

```javascript
const ABEL_RV_SPLIT = 0.7516;
const ABEL_RF_SPLIT = 1 - ABEL_RV_SPLIT;
```

- [ ] **Step 4.3: Remove top12 and mvChartData useMemos**

Delete the two useMemo blocks (currently lines ~114–151):

```javascript
// DELETE: top12 useMemo
const top12 = useMemo(() => { ... }, [visible]);

// DELETE: mvChartData useMemo
const mvChartData = useMemo(() => { ... }, [top12]);
```

- [ ] **Step 4.4: Add txs and valueSeries computations**

After the `totalMV` useMemo, add:

```javascript
// Transactions for this asset type
const typeTxs = useMemo(
  () => PM_TRANSACTIONS.filter(t => t.tipus === tipus),
  [tipus]
);

// Monthly portfolio value series for this asset type
const typeValueSeries = useMemo(
  () => PM_MONTHLY.map(m => ({
    date: m.date,
    value: tipus === "RV"
      ? m.caixaRV + m.ubsRV + (m.abelBK != null ? m.abelBK * ABEL_RV_SPLIT : 0)
      : m.caixaRF + m.ubsRF + (m.abelBK != null ? m.abelBK * ABEL_RF_SPLIT : 0) + m.andbank,
  })),
  [tipus]
);
```

- [ ] **Step 4.5: Replace Chart 2 with CumulativeFlowsChart**

Find the existing Chart 2 block (currently lines ~221–262, wrapped in `{mvChartData && (...)}`) and replace it entirely:

```jsx
// BEFORE: the entire {mvChartData && (<div style={card}>...</div>)} block
// AFTER:
<div style={card}>
  <div style={secLabel}>
    Fluxos acumulats · top 5 posicions per inversió
  </div>
  <CumulativeFlowsChart
    transactions={typeTxs}
    valuesSeries={typeValueSeries}
    groupBy="position"
    topN={5}
    height={260}
  />
</div>
```

- [ ] **Step 4.6: Replace ClosedPositions with merged table**

The existing position list (lines ~264–320) shows only active positions and then calls `<ClosedPositions />` at line ~323. Replace both with a single merged table.

Find the existing position list section that starts with:
```jsx
{/* ── Position list ── */}
<div style={{ ...card, overflowX: "auto" }}>
  <div style={secLabel}>Posicions · ordenades per valor de mercat</div>
  ...
```

And replace the entire block (including the `<ClosedPositions ... />` call after it) with:

```jsx
{/* ── Merged position table (active + discontinued) ── */}
<div style={{ ...card, overflowX: "auto" }}>
  <div style={secLabel}>Totes les posicions · actives i discontinuades</div>
  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 760 }}>
    <thead>
      <tr>
        <th style={{ ...th, width: 20 }}></th>
        <th style={{ ...th, textAlign: "left" }}>Nom</th>
        <th style={{ ...th, textAlign: "left" }}>Custodi</th>
        {YEAR_FIELDS.map(({ label }) => (
          <th key={label} style={{ ...th, textAlign: "right" }}>{label}</th>
        ))}
        <th style={{ ...th, textAlign: "right" }}>Des d'inici</th>
        <th style={{ ...th, textAlign: "right" }}>CAGR</th>
        <th style={{ ...th, textAlign: "right" }}>Valor mercat</th>
        <th style={{ ...th, textAlign: "center" }}>Estat</th>
      </tr>
    </thead>
    <tbody>
      {/* Active positions sorted by market value */}
      {visible.map((p, i) => {
        const rendInici = retMode === "net" ? netRendInici(p) : p.rendInici;
        const yh        = yearsHeld(p.dataCompra);
        const mwr       = cagr(rendInici, yh);
        return (
          <tr key={p.id} className="hoverable" style={{ borderBottom: `1px solid ${tc.border}` }}>
            <td style={{ padding: "7px 10px" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: PM_COLORS[i % PM_COLORS.length] }} />
            </td>
            <td style={{ padding: "7px 10px" }}>
              <Link to={`/mercats-publics/${p.id}`}
                style={{ color: tc.navy, textDecoration: "none", fontWeight: 500 }}>
                {p.nom}
              </Link>
            </td>
            <td style={{ padding: "7px 10px", color: tc.textLight, fontSize: 11 }}>{p.custodian}</td>
            {YEAR_FIELDS.map(({ field }) => (
              <td key={field} style={{ padding: "7px 10px", textAlign: "right" }}>
                <PctChip v={retMode === "net" ? netRend(p, field) : p[field]} tc={tc} />
              </td>
            ))}
            <td style={{ padding: "7px 10px", textAlign: "right" }}>
              <PctChip v={rendInici} tc={tc} />
            </td>
            <td style={{ padding: "7px 10px", textAlign: "right" }}>
              <PctChip v={mwr} tc={tc} />
            </td>
            <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: tc.navy, fontWeight: 600, fontSize: 11 }}>
              {fmtM(p.valorMercat)}
            </td>
            <td style={{ padding: "7px 10px", textAlign: "center" }}>
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 700,
                background: "#E8F8E8", color: "#1C6B1D" }}>
                En cartera
              </span>
            </td>
          </tr>
        );
      })}
      {/* Discontinued positions sorted by name */}
      {[...PM_CLOSED.filter(p => p.tipus === tipus)]
        .sort((a, b) => a.nom.localeCompare(b.nom))
        .map(p => (
          <tr key={p.isin} className="hoverable"
            style={{ borderBottom: `1px solid ${tc.border}`, opacity: 0.7 }}>
            <td style={{ padding: "7px 10px" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: tc.border }} />
            </td>
            <td style={{ padding: "7px 10px" }}>
              <Link to={`/mercats-publics/${p.isin}`}
                style={{ color: tc.textMid, textDecoration: "none", fontWeight: 500 }}>
                {p.nom}
              </Link>
            </td>
            <td style={{ padding: "7px 10px", color: tc.textLight, fontSize: 11 }}>{p.custodian ?? "—"}</td>
            {YEAR_FIELDS.map(({ label }) => (
              <td key={label} style={{ padding: "7px 10px", textAlign: "right", color: tc.textLight }}>—</td>
            ))}
            <td style={{ padding: "7px 10px", textAlign: "right", color: tc.textLight }}>—</td>
            <td style={{ padding: "7px 10px", textAlign: "right", color: tc.textLight }}>—</td>
            <td style={{ padding: "7px 10px", textAlign: "right", color: tc.textLight }}>—</td>
            <td style={{ padding: "7px 10px", textAlign: "center" }}>
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 700,
                background: tc.bgAlt, color: tc.textLight, border: `1px solid ${tc.border}` }}>
                Discontinuat
              </span>
            </td>
          </tr>
        ))}
    </tbody>
  </table>
  <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
    Des d'inici: retorn total acumulat. CAGR: retorn anualitzat equivalent.{" "}
    {retMode === "net" ? "Net TER per Abel Font." : "Brut (sense deducció TER)."}
    {" "}Posicions discontinuades sense dades de rendiment.
  </div>
</div>
```

- [ ] **Step 4.7: Delete the ClosedPositions function**

After the closing `}` of `PMTipusTab`, delete the entire `ClosedPositions` function (currently lines ~329–427 in the original file).

- [ ] **Step 4.8: Commit**

```bash
git add src/components/PMTipusTab.jsx
git commit -m "feat: replace top-12 chart with CumulativeFlowsChart; merge active+discontinued vehicle table in PMTipusTab"
```

---

## Task 5: Update PublicMarketsTab — Add Fluxos Acumulats Section

**Files:**
- Modify: `src/components/PublicMarketsTab.jsx`

- [ ] **Step 5.1: Add CumulativeFlowsChart import**

In `src/components/PublicMarketsTab.jsx`, add to the component imports at the top:

```javascript
import { CumulativeFlowsChart } from "./CumulativeFlowsChart.jsx";
```

- [ ] **Step 5.2: Add flowGroupBy state**

Inside `PublicMarketsTab`, after the existing state declarations (`chartView`, `expanded`, etc.), add:

```javascript
const [flowGroupBy, setFlowGroupBy] = useState("total");
```

- [ ] **Step 5.3: Add totalValueSeries useMemo**

After the existing `chartData` useMemo, add:

```javascript
const totalValueSeries = useMemo(
  () => PM_MONTHLY.map(m => ({
    date: m.date,
    value: m.caixaRV + m.caixaRF + m.ubsRV + m.ubsRF + (m.abelBK ?? 0) + m.andbank,
  })),
  []
);
```

- [ ] **Step 5.4: Remove inflow-related useMemos**

Delete the three useMemo blocks that power the old inflow overlay:

```javascript
// DELETE: cumulativeCostByLabel / topInflowLabels / topInflows useMemo (~lines 338-375)
const { cumulativeCostByLabel, topInflowLabels, topInflows } = useMemo(() => { ... }, []);

// DELETE: chartDataWithCost useMemo
const chartDataWithCost = useMemo(() => { ... }, [chartData, cumulativeCostByLabel]);
```

- [ ] **Step 5.5: Update AreaChart to use chartData**

In the AreaChart, change:

```jsx
// BEFORE:
<AreaChart data={chartDataWithCost} ...>

// AFTER:
<AreaChart data={chartData} ...>
```

- [ ] **Step 5.6: Remove inflow overlay from AreaChart**

Inside the AreaChart, remove:
1. The `{chartView === "total" && topInflows.map(...)}` ReferenceLine block
2. The `{chartView === "total" && (<Area ... dataKey="costBasis" .../>)}` Area block
3. The gradient definition `<linearGradient id="pm-grad-cost" ...>` inside `<defs>`

Leave the other Areas (total, rv, rf, gestor breakdown) untouched.

- [ ] **Step 5.7: Add "Fluxos acumulats" section**

After the closing `</div>` of the portfolio evolution chart card, add a new section:

```jsx
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
          background: flowGroupBy === opt.id ? (tc.dark ? "#0A1A30" : "#E8F0FA") : "transparent",
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
```

- [ ] **Step 5.8: Commit**

```bash
git add src/components/PublicMarketsTab.jsx
git commit -m "feat: add Fluxos Acumulats section with 3-toggle chart to PublicMarketsTab; remove old inflow overlay"
```

---

## Task 6: Update PMPositionDetail — Replace Price Evolution Chart

**Files:**
- Modify: `src/components/PMPositionDetail.jsx`

- [ ] **Step 6.1: Add CumulativeFlowsChart import**

In `src/components/PMPositionDetail.jsx`, add to imports at the top:

```javascript
import { CumulativeFlowsChart } from "./CumulativeFlowsChart.jsx";
```

- [ ] **Step 6.2: Add positionTxs and positionValues useMemos**

After the `returnData` useMemo (currently ~line 114), add two new useMemos:

```javascript
const positionTxs = useMemo(
  () => PM_TRANSACTIONS.filter(t => t.isin === isin),
  [isin]
);

const positionValues = useMemo(() => {
  const custodianData = PM_VALUES[isin] ?? (isClosed ? PM_CLOSED_VALUES[isin] : null);
  if (!custodianData) return [];
  const monthMap = new Map();
  Object.values(custodianData).forEach(series =>
    series.forEach(({ date, value }) => {
      const month = date.slice(0, 7);
      monthMap.set(month, (monthMap.get(month) ?? 0) + value);
    })
  );
  return [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ date: month, value }));
}, [isin, isClosed]);
```

- [ ] **Step 6.3: Delete the valueData useMemo**

Remove the entire `valueData` useMemo block (currently lines ~116–174). It is replaced by the two simpler useMemos above.

- [ ] **Step 6.4: Replace the price evolution chart section**

Find the "Valor de mercat · des de la compra" section (currently lines ~256–330):

```jsx
{/* ── Market value over time + inflows ── */}
{valueData && (
  <div style={card}>
    ...
    <ResponsiveContainer ...>
      <ComposedChart ...>
        ... custodian Lines, costLine, inflow ReferenceLines ...
      </ComposedChart>
    </ResponsiveContainer>
  </div>
)}
```

Replace it with:

```jsx
{/* ── Fluxos acumulats i valor de cartera ── */}
<div style={card}>
  <div style={{ fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase",
    color: tc.textLight, fontWeight: 600, marginBottom: 12 }}>
    Fluxos acumulats · valor de cartera
  </div>
  {positionValues.length > 0 || positionTxs.length > 0 ? (
    <CumulativeFlowsChart
      transactions={positionTxs}
      valuesSeries={positionValues}
      groupBy="total"
      height={220}
    />
  ) : (
    <p style={{ fontSize: 11, color: tc.textLight, fontStyle: "italic", padding: "8px 0" }}>
      Sense dades de preus disponibles per a aquesta posició.
    </p>
  )}
</div>
```

- [ ] **Step 6.5: Remove unused ComposedChart imports**

Check whether `ComposedChart` and `ReferenceLine` are still used elsewhere in `PMPositionDetail.jsx` (they appear in the returns chart and PositionTxHistory). If `ComposedChart` is no longer referenced, remove it from the recharts import. `ReferenceLine` is used in the annual returns chart at ~line 361 — keep it.

Verify: search for `ComposedChart` in the file. If the only occurrence was the deleted section, remove it from the import line.

- [ ] **Step 6.6: Commit**

```bash
git add src/components/PMPositionDetail.jsx
git commit -m "feat: replace price evolution chart with CumulativeFlowsChart in PMPositionDetail"
```

---

## Self-Review Checklist

- [ ] All 6 tasks produce a runnable build (`npm run dev` — no JS errors in console)
- [ ] CumulativeFlowsChart renders correctly for groupBy="total", "assetType", "manager", "position"
- [ ] Bars are stacked when groupBy !== "total", single bar when "total"
- [ ] Portfolio value line appears on right Y-axis with dashed stroke
- [ ] RV and RF tabs show the new chart + merged table with "En cartera" / "Discontinuat" badges
- [ ] PublicMarketsTab "Fluxos acumulats" section toggle switches between 3 views
- [ ] Transaction rows in PMTransaccionsTab and PublicMarketsTab accordion no longer have links
- [ ] PMPositionDetail shows cumulative chart or no-data placeholder for the 3 ISINs without price data
- [ ] `docs/pm-coverage-report.md` exists and lists all 14 vehicles correctly
