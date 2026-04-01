# ECharts Migration — Design Spec

**Date:** 2026-04-01
**Status:** Approved
**Goal:** Replace all Recharts charts with Apache ECharts across the full app. Root issues: stacked bar + dual-axis combo broken in Recharts (bars invisible, lines discontinuous).

---

## Problem

Two specific Recharts failures in Public Markets:
1. **Bars not showing** — Recharts `ComposedChart` with dual `yAxisId` + stacked bars mis-scales the bar axis, rendering bars below the visible range.
2. **Lines not continuous** — `connectNulls` not threading across null-padded months in certain data shapes.

Decision: migrate to ECharts rather than patch, to get Office-quality rendering across the full app.

---

## Architecture

### Library

```
echarts              — core library
echarts-for-react    — React wrapper
```

Each chart renders as:
```jsx
import ReactECharts from "echarts-for-react";
<ReactECharts option={chartOption} style={{ height: 260 }} />
```

### Shared theme helper

New file: `src/echartsTheme.js`

Exports a single function `ecTheme(tc)` that returns reusable ECharts style fragments:

```js
export function ecTheme(tc) {
  return {
    grid:      { top: 32, right: 8, bottom: 40, left: 0, containLabel: true },
    axisLabel: { fontSize: 9, color: tc.textLight },
    axisLine:  { show: false },
    axisTick:  { show: false },
    splitLine: { lineStyle: { color: tc.border } },
    tooltip: {
      backgroundColor: tc.card,
      borderColor: tc.border,
      textStyle: { color: tc.text, fontSize: 11 },
    },
  };
}
```

Charts spread these fragments into their `option` object. No global ECharts theme registration.

### Color constants (unchanged)

```js
// Same as today — defined per-file or imported from shared constants
MGR_COLORS  = { caixa: "#2B5070", ubs: "#4E79A7", abel: "#F28E2B", andbank: "#59A14F" }
AREA_COLORS = { rv: "#2B5070", rf: "#E8A020" }
```

### No wrapper abstraction

Charts build their `option` inline. Three similar chart configs is better than a premature wrapper.

---

## Migration phases

### Phase 1 — Public Markets (priority: fixes broken charts)

**Files:** `PublicMarketsTab.jsx`, `CumulativeFlowsChart.jsx`, `PriceHistoryChart.jsx`, `PMTipusTab.jsx`, `PMTransaccionsTab.jsx`

| Chart | Recharts type | ECharts config |
|-------|--------------|----------------|
| TWR per provider | `BarChart` grouped | `bar` series × 4, no stack, `xAxis` categorical |
| Strategy returns | `LineChart` | `line` series × 3, `connectNulls: true` |
| Portfolio evolution | `AreaChart` stacked, 3 modes | `line` + `areaStyle`, `stack: 'a'` toggled by mode, gradient via `color` |
| Cumulative flows | `ComposedChart` bar+line dual-axis | `bar` stacked + `line`, `yAxis: [{}, { position:'right' }]` |
| Price history | `ComposedChart` bar+2 lines dual-axis | `bar` + 2 `line` series (preBuy dashed, postBuy solid), `connectNulls: true` |
| PM Tipus returns | `LineChart` | `line` series |
| PM Transaccions | `BarChart` | `bar` series, negative values for sells |

**Key ECharts fixes for current bugs:**
- `connectNulls: true` on every line series
- Dual axis: `yAxisIndex: 0 / 1` on each series, `yAxis` as array of two objects
- Stacking: `stack: 'total'` on bar series (ECharts handles dual-axis stacking correctly)

### Phase 2 — Dashboard + main tabs

**Files:** `Dashboard.jsx`, `MensualTab.jsx`, `ResumTab.jsx`, `PortfolioCompaniesTab.jsx`

Straightforward swaps: `BarChart` → ECharts `bar`, `PieChart` → ECharts `pie`. No dual-axis complexity.

### Phase 3 — Detail pages

**Files:** `CompanyDetail.jsx`, `FundDetail.jsx`, `PipelineFY26.jsx`, `SearchersTab.jsx` (PieChart only)

Most complex configs: J-curve ComposedChart (FundDetail), financial bars + margin line (CompanyDetail), 4× pipeline PieCharts (PipelineFY26). Isolated to detail pages — low regression risk.

**Untouched:** Nivo Sankey in `SearchersTab.jsx` — different library, working correctly.

### Cleanup (after Phase 3)

- Remove `recharts` from `package.json`
- Remove dead imports in all migrated files

---

## Data contract (unchanged)

All data preparation logic (`useMemo`, calculations, month padding, cumulative running totals) stays exactly as-is. Only the render layer changes: JSX chart components replaced by ECharts `option` objects.

---

## Success criteria

- [ ] No invisible bars in any chart
- [ ] All lines continuous (no gaps) where data exists
- [ ] Dual-axis charts render both axes correctly
- [ ] Theme (light/dark) applies correctly via `tc` context
- [ ] `recharts` removed from `package.json` after Phase 3
- [ ] Nivo Sankey untouched and still working
