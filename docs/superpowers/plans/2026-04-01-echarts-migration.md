# ECharts Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all Recharts charts with Apache ECharts across 14 files, fixing broken stacked-bar + dual-axis combos in Public Markets and achieving Office-quality rendering app-wide.

**Architecture:** Install `echarts` + `echarts-for-react`. Create a shared `src/echartsTheme.js` helper. Migrate file-by-file in 3 phases: Public Markets (fixes broken charts) → Dashboard + tabs → Detail pages. Remove `recharts` after Phase 3.

**Tech Stack:** `echarts@^5`, `echarts-for-react@^3`, React 18, Vite

---

## Phase 1 — Public Markets (fixes broken charts)

---

### Task 0: Install packages

**Files:**
- Modify: `package.json`

- [ ] **Install echarts packages**

```bash
cd "C:\Users\EduardGenís\OneDrive - Espai d'Inversions\Documents\Claude\01. Dashboard"
npm install echarts echarts-for-react
```

- [ ] **Verify installation**

Check `package.json` contains both `"echarts"` and `"echarts-for-react"` in `dependencies`. Then:

```bash
npm run dev
```

Expected: dev server starts without errors.

- [ ] **Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add echarts + echarts-for-react"
```

---

### Task 1: Create shared theme helper

**Files:**
- Create: `src/echartsTheme.js`

- [ ] **Create the file**

```js
// src/echartsTheme.js
// Returns reusable ECharts style fragments keyed to the active theme context.
// Usage: const t = ecTheme(tc); then spread t.grid, t.tooltip, etc. into option.

export function ecTheme(tc) {
  return {
    grid: { containLabel: true },
    axisLabel: { fontSize: 9, color: tc.textLight ?? "#8A9BAC" },
    axisLine:  { show: false },
    axisTick:  { show: false },
    splitLine: { lineStyle: { color: tc.border ?? "#E5EAF0" } },
    tooltip: {
      backgroundColor: tc.card  ?? "#fff",
      borderColor:     tc.border ?? "#E5EAF0",
      textStyle: { color: tc.text ?? "#1A2B3C", fontSize: 11 },
      extraCssText: "border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.12);",
    },
  };
}
```

- [ ] **Commit**

```bash
git add src/echartsTheme.js
git commit -m "feat: add ecTheme helper for ECharts theming"
```

---

### Task 2: Migrate CumulativeFlowsChart.jsx

**Files:**
- Modify: `src/components/CumulativeFlowsChart.jsx`

This is the most critical chart — fixes invisible bars and broken portfolio value line.

- [ ] **Replace the render section**

Keep all `useMemo` data-prep logic (lines 1–158) unchanged. Only replace the JSX return (lines 163–244).

Replace:
```js
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
```

With:
```js
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
```

- [ ] **Replace the return statement**

Replace the entire `return (` block (from line 163 to end) with:

```jsx
  const t = ecTheme(tc);

  const option = {
    grid: { top: 32, right: hasPortfolioValue ? 68 : 8, bottom: isStacked ? 48 : 32, left: 0, containLabel: true },
    legend: isStacked
      ? { bottom: 0, textStyle: { fontSize: 9, color: tc.textLight }, formatter: n => nameMap[n] ?? n }
      : null,
    tooltip: {
      ...t.tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        const label = fmtMonthKey(params[0]?.axisValue ?? "");
        let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
        params.forEach(p => {
          if (p.value == null) return;
          const name = p.seriesName === "Valor cartera" ? "Valor cartera" : nameMap[p.seriesName] ?? p.seriesName;
          html += `<div>${p.marker}${name}: ${fmtM(p.value)}</div>`;
        });
        return html;
      },
    },
    xAxis: {
      type: "category",
      data: chartData.map(r => r.month),
      axisLabel: { ...t.axisLabel, formatter: fmtMonthKey, hideOverlap: true },
      axisLine: t.axisLine,
      axisTick: t.axisTick,
    },
    yAxis: [
      {
        type: "value",
        axisLabel: { ...t.axisLabel, fontSize: 10, formatter: v => fmtM(v) },
        splitLine: t.splitLine,
        axisLine: t.axisLine,
        axisTick: t.axisTick,
      },
      ...(hasPortfolioValue ? [{
        type: "value",
        position: "right",
        axisLabel: { ...t.axisLabel, formatter: v => fmtM(v) },
        splitLine: { show: false },
        axisLine: t.axisLine,
        axisTick: t.axisTick,
      }] : []),
    ],
    series: [
      ...keys.map(k => ({
        name: nameMap[k] ?? k,
        type: "bar",
        stack: isStacked ? "total" : undefined,
        data: chartData.map(r => r[k] ?? null),
        itemStyle: { color: colorMap[k] ?? "#BAB0AC", opacity: 0.72 },
        barMaxWidth: 32,
      })),
      ...(hasPortfolioValue ? [{
        name: "Valor cartera",
        type: "line",
        yAxisIndex: 1,
        data: chartData.map(r => r.portfolioValue ?? null),
        lineStyle: { color: "#59A14F", width: 2, type: "dashed" },
        itemStyle: { color: "#59A14F" },
        symbol: "none",
        connectNulls: true,
      }] : []),
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ width: "100%", height }}
      opts={{ renderer: "canvas" }}
    />
  );
}
```

- [ ] **Verify in browser**

Open the Public Markets tab → Fluxos acumulats. Toggle between Total / Per Actiu / Per Gestor. Bars should be visible and the green portfolio value line should be continuous.

- [ ] **Commit**

```bash
git add src/components/CumulativeFlowsChart.jsx
git commit -m "feat: migrate CumulativeFlowsChart to ECharts (fixes invisible bars + broken line)"
```

---

### Task 3: Migrate PriceHistoryChart.jsx

**Files:**
- Modify: `src/components/PriceHistoryChart.jsx`

- [ ] **Replace imports**

Replace:
```js
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
```

With:
```js
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
```

- [ ] **Replace the chart JSX inside the return**

Keep the mode toggle buttons and the footnote `<div>` unchanged. Replace only the `<ResponsiveContainer>…</ComposedChart></ResponsiveContainer>` block with:

```jsx
      {(() => {
        const t = ecTheme(tc);
        const months = chartData.map(r => r.month);

        const option = {
          grid: { top: 8, right: 68, bottom: 40, left: 0, containLabel: true },
          tooltip: {
            ...t.tooltip,
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params) => {
              const label = fmtMonthKey(params[0]?.axisValue ?? "");
              let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
              params.forEach(p => {
                if (p.value == null) return;
                let val, name;
                if (p.seriesName === "cumInflow")      { val = fmtM(p.value);           name = "Capital invertit"; }
                else if (p.seriesName === "preBuy")    { val = p.value.toFixed(4);      name = "Preu (sense posició)"; }
                else if (p.seriesName === "postBuy")   { val = p.value.toFixed(4);      name = "Preu (en cartera)"; }
                else if (p.seriesName === "portValue") { val = fmtM(p.value);           name = "Valor cartera teòric"; }
                else                                   { val = p.value; name = p.seriesName; }
                html += `<div>${p.marker}${name}: ${val}</div>`;
              });
              return html;
            },
          },
          xAxis: {
            type: "category",
            data: months,
            axisLabel: { ...t.axisLabel, formatter: fmtMonthKey, hideOverlap: true },
            axisLine: t.axisLine,
            axisTick: t.axisTick,
          },
          yAxis: [
            {
              type: "value",
              name: "Capital (€)",
              nameTextStyle: { fontSize: 9, color: tc.textLight },
              axisLabel: { ...t.axisLabel, fontSize: 10, formatter: v => fmtM(v) },
              splitLine: t.splitLine,
              axisLine: t.axisLine,
              axisTick: t.axisTick,
            },
            {
              type: "value",
              position: "right",
              name: mode === "price" ? "Preu" : "Valor",
              nameTextStyle: { fontSize: 9, color: tc.textLight },
              axisLabel: {
                ...t.axisLabel,
                formatter: v => mode === "price" ? v.toFixed(2) : fmtM(v),
              },
              splitLine: { show: false },
              axisLine: t.axisLine,
              axisTick: t.axisTick,
            },
          ],
          series: [
            // Cumulative inflow bars (always shown if data exists)
            ...(hasBars ? [{
              name: "cumInflow",
              type: "bar",
              yAxisIndex: 0,
              data: chartData.map(r => r.cumInflow ?? null),
              itemStyle: { color: "#4E79A7", opacity: 0.55 },
              barMaxWidth: 32,
              connectNulls: false,
            }] : []),
            // Acquisition date mark line on first series or standalone
            ...(acqMonth ? [{
              name: "_acqMark",
              type: "line",
              yAxisIndex: 0,
              data: months.map(() => null),
              markLine: {
                data: [{ xAxis: acqMonth }],
                lineStyle: { color: tc.green ?? "#59A14F", type: "dashed", width: 1.5 },
                symbol: "none",
                label: { show: true, formatter: "Compra", position: "insideEndTop", fontSize: 9, color: tc.green ?? "#59A14F" },
              },
              silent: true,
            }] : []),
            // Price mode: pre-buy dashed + post-buy solid
            ...(mode === "price" ? [
              {
                name: "preBuy",
                type: "line",
                yAxisIndex: 1,
                data: chartData.map(r => r.preBuy ?? null),
                lineStyle: { color: tc.navy ?? "#2B5070", width: 1.5, type: "dashed", opacity: 0.55 },
                itemStyle: { color: tc.navy ?? "#2B5070" },
                symbol: "none",
                connectNulls: true,
              },
              {
                name: "postBuy",
                type: "line",
                yAxisIndex: 1,
                data: chartData.map(r => r.postBuy ?? null),
                lineStyle: { color: tc.navy ?? "#2B5070", width: 2 },
                itemStyle: { color: tc.navy ?? "#2B5070" },
                symbol: "none",
                connectNulls: true,
              },
            ] : []),
            // Value mode: portfolio value line
            ...(mode === "value" ? [{
              name: "portValue",
              type: "line",
              yAxisIndex: 1,
              data: chartData.map(r => r.portfolioValue ?? null),
              lineStyle: { color: tc.green ?? "#59A14F", width: 2 },
              itemStyle: { color: tc.green ?? "#59A14F" },
              symbol: "none",
              connectNulls: true,
            }] : []),
          ],
        };

        return (
          <ReactECharts
            option={option}
            style={{ width: "100%", height }}
            opts={{ renderer: "canvas" }}
          />
        );
      })()}
```

- [ ] **Verify in browser**

Navigate to a fund detail page that has price history. Toggle between "Preu unitari" and "Valor cartera". Pre-buy line should be dashed and dimmed, post-buy solid. Both should be continuous. Bars should show capital invested.

- [ ] **Commit**

```bash
git add src/components/PriceHistoryChart.jsx
git commit -m "feat: migrate PriceHistoryChart to ECharts (fixes dual-axis + connectNulls)"
```

---

### Task 4: Migrate PublicMarketsTab.jsx (3 inline charts)

**Files:**
- Modify: `src/components/PublicMarketsTab.jsx`

- [ ] **Replace recharts import**

Replace:
```js
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
```

With:
```js
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
```

- [ ] **Replace TWR BarChart** (currently around line 382–408)

The TWR chart uses `providerData` (array of `{ year, caixa?, ubs?, andbank?, abel? }`) and `displayManagers`.

Replace the `<ResponsiveContainer>…</BarChart></ResponsiveContainer>` block with:

```jsx
            {(() => {
              const t = ecTheme(tc);
              const option = {
                grid: { top: 8, right: 16, bottom: 32, left: 0, containLabel: true },
                tooltip: {
                  ...t.tooltip,
                  trigger: "axis",
                  formatter: (params) => {
                    const label = params[0]?.axisValue ?? "";
                    let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
                    params.forEach(p => {
                      if (p.value == null) return;
                      html += `<div>${p.marker}${p.seriesName}: ${p.value != null ? pctFmt(p.value) : "—"}</div>`;
                    });
                    return html;
                  },
                },
                legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
                xAxis: {
                  type: "category",
                  data: providerData.map(d => d.year),
                  axisLabel: { fontSize: 11, color: tc.textLight },
                  axisLine: { show: false },
                  axisTick: { show: false },
                },
                yAxis: {
                  type: "value",
                  axisLabel: { fontSize: 10, color: tc.textLight, formatter: v => v.toFixed(1) + "%" },
                  splitLine: { lineStyle: { color: tc.border } },
                  axisLine: { show: false },
                  axisTick: { show: false },
                },
                series: displayManagers.map(m => ({
                  name: m.nom,
                  type: "bar",
                  data: providerData.map(d => d[m.id] ?? null),
                  itemStyle: { color: MGR_COLORS[m.id] },
                  barMaxWidth: 28,
                  markLine: m === displayManagers[0] ? {
                    data: [{ yAxis: 0 }],
                    lineStyle: { color: tc.border, type: "dashed", width: 1 },
                    symbol: "none",
                    label: { show: false },
                  } : undefined,
                })),
              };
              return <ReactECharts option={option} style={{ width: "100%", height: 240 }} opts={{ renderer: "canvas" }} />;
            })()}
```

- [ ] **Replace Strategy LineChart** (currently around line 413–433)

Replace the `<ResponsiveContainer>…</LineChart></ResponsiveContainer>` block with:

```jsx
            {(() => {
              const t = ecTheme(tc);
              const option = {
                grid: { top: 8, right: 16, bottom: 32, left: 0, containLabel: true },
                tooltip: {
                  ...t.tooltip,
                  trigger: "axis",
                  formatter: (params) => {
                    const label = params[0]?.axisValue ?? "";
                    let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
                    params.forEach(p => {
                      if (p.value == null) return;
                      html += `<div>${p.marker}${p.seriesName}: ${pctFmt(p.value)}</div>`;
                    });
                    return html;
                  },
                },
                legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
                xAxis: {
                  type: "category",
                  data: strategyData.map(d => d.year),
                  axisLabel: { fontSize: 11, color: tc.textLight },
                  axisLine: { show: false },
                  axisTick: { show: false },
                },
                yAxis: {
                  type: "value",
                  axisLabel: { fontSize: 10, color: tc.textLight, formatter: v => v.toFixed(1) + "%" },
                  splitLine: { lineStyle: { color: tc.border } },
                  axisLine: { show: false },
                  axisTick: { show: false },
                },
                series: [
                  {
                    name: "Renda Variable",
                    type: "line",
                    data: strategyData.map(d => d.rv),
                    lineStyle: { color: tc.navy, width: 2 },
                    itemStyle: { color: tc.navy },
                    symbol: "circle", symbolSize: 8,
                    connectNulls: true,
                  },
                  {
                    name: "Renda Fixa",
                    type: "line",
                    data: strategyData.map(d => d.rf),
                    lineStyle: { color: "#E8A020", width: 2 },
                    itemStyle: { color: "#E8A020" },
                    symbol: "circle", symbolSize: 8,
                    connectNulls: true,
                  },
                  {
                    name: "Total",
                    type: "line",
                    data: strategyData.map(d => d.total),
                    lineStyle: { color: tc.green, width: 2, type: "dashed" },
                    itemStyle: { color: tc.green },
                    symbol: "circle", symbolSize: 8,
                    connectNulls: true,
                  },
                ],
              };
              return <ReactECharts option={option} style={{ width: "100%", height: 240 }} opts={{ renderer: "canvas" }} />;
            })()}
```

- [ ] **Replace Evolution AreaChart** (currently around line 447–494)

The evolution chart has 3 modes via `chartView` state ("total" | "actiu" | "gestor"). `chartData` has fields `month` + varying keys per mode.

Replace the entire `<ResponsiveContainer>…</AreaChart></ResponsiveContainer>` block (including the `<defs>` gradient block) with:

```jsx
        {(() => {
          const t = ecTheme(tc);

          // Helper: gradient areaStyle for a color
          const gradArea = (color) => ({
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0,    color: color + "40" },
                { offset: 1,    color: color + "0A" },
              ],
            },
          });

          let series = [];
          if (chartView === "total") {
            series = [{
              name: "Valor cartera",
              type: "line", smooth: false,
              data: chartData.map(r => r.total ?? null),
              lineStyle: { color: AREA_COLORS.total, width: 2 },
              itemStyle: { color: AREA_COLORS.total },
              areaStyle: gradArea(AREA_COLORS.total),
              symbol: "none",
              connectNulls: true,
            }];
          } else if (chartView === "actiu") {
            series = [
              {
                name: "Renda Variable",
                type: "line", smooth: false, stack: "a",
                data: chartData.map(r => r.rv ?? null),
                lineStyle: { color: AREA_COLORS.rv, width: 1.5 },
                itemStyle: { color: AREA_COLORS.rv },
                areaStyle: gradArea(AREA_COLORS.rv),
                symbol: "none", connectNulls: true,
              },
              {
                name: "Renda Fixa",
                type: "line", smooth: false, stack: "a",
                data: chartData.map(r => r.rf ?? null),
                lineStyle: { color: AREA_COLORS.rf, width: 1.5 },
                itemStyle: { color: AREA_COLORS.rf },
                areaStyle: gradArea(AREA_COLORS.rf),
                symbol: "none", connectNulls: true,
              },
            ];
          } else {
            // gestor view — stack order matches original (andbank bottom → caixa top)
            series = [
              { key: "andbank", name: "WAM–Andbank" },
              { key: "abel",    name: "Bankinter" },
              { key: "ubs",     name: "UBS" },
              { key: "caixa",   name: "CaixaBank" },
            ].map(({ key, name }) => ({
              name,
              type: "line", smooth: false, stack: "g",
              data: chartData.map(r => r[key] ?? null),
              lineStyle: { color: AREA_COLORS[key], width: 1.5 },
              itemStyle: { color: AREA_COLORS[key] },
              areaStyle: gradArea(AREA_COLORS[key]),
              symbol: "none", connectNulls: true,
            }));
          }

          const option = {
            grid: { top: 8, right: 8, bottom: chartView !== "total" ? 48 : 32, left: 0, containLabel: true },
            legend: chartView !== "total"
              ? { bottom: 0, textStyle: { fontSize: 11, color: tc.textLight } }
              : null,
            tooltip: {
              ...t.tooltip,
              trigger: "axis",
              formatter: (params) => {
                const label = fmtMonthKey(params[0]?.axisValue ?? "");
                let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
                params.forEach(p => {
                  if (p.value == null) return;
                  html += `<div>${p.marker}${p.seriesName}: ${fmtM(p.value)}</div>`;
                });
                return html;
              },
            },
            xAxis: {
              type: "category",
              data: chartData.map(r => r.month),
              axisLabel: { fontSize: 10, color: tc.textLight, formatter: fmtMonthKey, hideOverlap: true, interval: 11 },
              axisLine: { show: false },
              axisTick: { show: false },
            },
            yAxis: {
              type: "value",
              axisLabel: { fontSize: 10, color: tc.textLight, formatter: fmtM },
              splitLine: { lineStyle: { color: tc.border } },
              axisLine: { show: false },
              axisTick: { show: false },
            },
            series,
          };

          return <ReactECharts option={option} style={{ width: "100%", height: 280 }} opts={{ renderer: "canvas" }} />;
        })()}
```

- [ ] **Verify in browser**

Open Public Markets tab. Check:
1. TWR chart: grouped bars for each manager, visible for all periods with data
2. Strategy line chart: 3 lines with dots, total dashed
3. Evolution chart: toggle Total/Per Actiu/Per Gestor — areas stack and render with gradient fills

- [ ] **Commit**

```bash
git add src/components/PublicMarketsTab.jsx
git commit -m "feat: migrate PublicMarketsTab inline charts to ECharts"
```

---

### Task 5: Migrate PMTipusTab.jsx

**Files:**
- Modify: `src/components/PMTipusTab.jsx`

- [ ] **Replace recharts import**

Find the recharts import in this file and replace it with:
```js
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
```

- [ ] **Replace the LineChart**

The chart shows a single "Cartera" line (dataKey `"portfolio"`) over years `[2023, 2024, 2025, 2026]` with a zero reference line.

Read the current `data` array shape in this file (look for the `useMemo` or static array that feeds the chart). The array has `{ year: number, portfolio: number|null }` entries.

Replace the `<ResponsiveContainer>…</LineChart></ResponsiveContainer>` block with:

```jsx
          {(() => {
            const t = ecTheme(tc);
            const option = {
              grid: { top: 8, right: 8, bottom: 32, left: 0, containLabel: true },
              tooltip: {
                ...t.tooltip,
                trigger: "axis",
                formatter: (params) => {
                  const p = params[0];
                  if (!p || p.value == null) return "";
                  const sign = p.value >= 0 ? "+" : "";
                  return `<div style="font-weight:600">${p.axisValue}</div><div>${p.marker}Cartera: ${sign}${p.value.toFixed(2)}%</div>`;
                },
              },
              xAxis: {
                type: "category",
                data: lineData.map(d => d.year),
                axisLabel: { fontSize: 11, color: tc.textLight },
                axisLine: { show: false },
                axisTick: { show: false },
              },
              yAxis: {
                type: "value",
                axisLabel: { fontSize: 10, color: tc.textLight, formatter: v => v.toFixed(0) + "%" },
                splitLine: { lineStyle: { color: tc.border } },
                axisLine: { show: false },
                axisTick: { show: false },
              },
              series: [{
                name: "Cartera",
                type: "line",
                data: lineData.map(d => d.portfolio),
                lineStyle: { color: tc.navy, width: 2 },
                itemStyle: { color: tc.navy },
                symbol: "circle", symbolSize: 8,
                connectNulls: true,
                markLine: {
                  data: [{ yAxis: 0 }],
                  lineStyle: { color: tc.border, type: "dashed", width: 1 },
                  symbol: "none",
                  label: { show: false },
                },
              }],
            };
            return <ReactECharts option={option} style={{ width: "100%", height: 200 }} opts={{ renderer: "canvas" }} />;
          })()}
```

**Note:** The variable name for the line chart data in this file may differ. Read the file to find the actual variable name (it feeds `<LineChart data={...}>`), then use that variable in the `data:` fields above instead of `lineData`.

- [ ] **Verify in browser**

Navigate to the PM Tipus tab. The portfolio return line should render with dots and a zero reference line. Cumulative flows chart below it (already migrated in Task 2) should also work.

- [ ] **Commit**

```bash
git add src/components/PMTipusTab.jsx
git commit -m "feat: migrate PMTipusTab LineChart to ECharts"
```

---

### Task 6: Migrate PMTransaccionsTab.jsx

**Files:**
- Modify: `src/components/PMTransaccionsTab.jsx`

- [ ] **Replace recharts import**

Replace the recharts import with:
```js
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
```

- [ ] **Replace the BarChart**

The chart shows monthly buy ("Compres") and sell ("Vendes") bars. The data array has `{ label: string, Compres: number, Vendes: number }` entries. X-axis labels are rotated −40°.

Replace the `<ResponsiveContainer>…</BarChart></ResponsiveContainer>` block with:

```jsx
            {(() => {
              const t = ecTheme(tc);
              const option = {
                grid: { top: 8, right: 8, bottom: 56, left: 0, containLabel: true },
                tooltip: {
                  ...t.tooltip,
                  trigger: "axis",
                  axisPointer: { type: "shadow" },
                  formatter: (params) => {
                    const label = params[0]?.axisValue ?? "";
                    let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
                    params.forEach(p => {
                      if (!p.value) return;
                      html += `<div>${p.marker}${p.seriesName}: ${fmtM(p.value)}</div>`;
                    });
                    return html;
                  },
                },
                legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
                xAxis: {
                  type: "category",
                  data: txBarData.map(d => d.label),
                  axisLabel: { fontSize: 9, color: tc.textLight, rotate: -40 },
                  axisLine: { show: false },
                  axisTick: { show: false },
                },
                yAxis: {
                  type: "value",
                  axisLabel: { fontSize: 10, color: tc.textLight, formatter: v => fmtM(v) },
                  splitLine: { lineStyle: { color: tc.border } },
                  axisLine: { show: false },
                  axisTick: { show: false },
                },
                series: [
                  {
                    name: "Compres",
                    type: "bar",
                    data: txBarData.map(d => d.Compres ?? null),
                    itemStyle: { color: tc.navy },
                    barMaxWidth: 28,
                    barGap: "10%",
                  },
                  {
                    name: "Vendes",
                    type: "bar",
                    data: txBarData.map(d => d.Vendes ?? null),
                    itemStyle: { color: tc.green },
                    barMaxWidth: 28,
                  },
                ],
              };
              return <ReactECharts option={option} style={{ width: "100%", height: 260 }} opts={{ renderer: "canvas" }} />;
            })()}
```

**Note:** The actual variable name for the bar chart data in this file may differ from `txBarData`. Read the file to find the variable feeding `<BarChart data={...}>` and use it above.

- [ ] **Verify in browser**

Navigate to PM Transaccions tab. Monthly buy/sell bars should render side-by-side with rotated labels.

- [ ] **Commit**

```bash
git add src/components/PMTransaccionsTab.jsx
git commit -m "feat: migrate PMTransaccionsTab BarChart to ECharts"
```

---

### Task 7: Phase 1 verification

- [ ] **Run the dev server and check all Public Markets charts**

```bash
npm run dev
```

Visit each of these and confirm charts render:
1. Public Markets tab → TWR bars, Strategy line, Evolution area (3 modes), Cumulative flows (3 modes)
2. PM Tipus tab → return line + cumulative flows
3. PM Transaccions tab → buy/sell bars
4. Any fund detail page with price history → price/value toggle

- [ ] **Commit Phase 1 complete marker**

```bash
git commit --allow-empty -m "chore: Phase 1 ECharts migration complete (Public Markets)"
```

---

## Phase 2 — Dashboard + Main Tabs

> For each file in this phase: (1) read the file, (2) identify Recharts chart JSX, (3) apply the patterns below.

### ECharts patterns for Phase 2 chart types

**BarChart → ECharts bar:**
```jsx
// Replace <ResponsiveContainer><BarChart data={DATA}> ... </BarChart></ResponsiveContainer>
{(() => {
  const t = ecTheme(tc);
  const option = {
    grid: { top: 8, right: 8, bottom: 32, left: 0, containLabel: true },
    tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "category", data: DATA.map(d => d.XKEY), axisLabel: { ...t.axisLabel }, axisLine: t.axisLine, axisTick: t.axisTick },
    yAxis: { type: "value", axisLabel: { ...t.axisLabel, formatter: v => FORMATTER(v) }, splitLine: t.splitLine, axisLine: t.axisLine, axisTick: t.axisTick },
    series: SERIES_KEYS.map(k => ({
      name: NAMES[k],
      type: "bar",
      data: DATA.map(d => d[k] ?? null),
      itemStyle: { color: COLORS[k] },
      barMaxWidth: 32,
      stack: STACKED ? "total" : undefined,
    })),
  };
  return <ReactECharts option={option} style={{ width: "100%", height: HEIGHT }} opts={{ renderer: "canvas" }} />;
})()}
```

**PieChart → ECharts pie:**
```jsx
{(() => {
  const t = ecTheme(tc);
  const option = {
    tooltip: { ...t.tooltip, trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { orient: "vertical", right: 8, top: "center", textStyle: { fontSize: 10, color: tc.textLight } },
    series: [{
      type: "pie",
      radius: ["40%", "70%"],  // donut; use ["0%", "60%"] for full pie
      center: ["40%", "50%"],
      data: PIE_DATA.map(d => ({ name: d.name, value: d.value, itemStyle: { color: d.color } })),
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.2)" } },
    }],
  };
  return <ReactECharts option={option} style={{ width: "100%", height: HEIGHT }} opts={{ renderer: "canvas" }} />;
})()}
```

---

### Task 8: Migrate Dashboard.jsx

**Files:**
- Modify: `src/components/Dashboard.jsx`

- [ ] **Read the chart sections**

Read `src/components/Dashboard.jsx` focusing on `<BarChart>` and `<PieChart>` blocks. Note the data variable names, series keys, colors, axis formatters.

- [ ] **Replace recharts import with ECharts**

```js
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
```

- [ ] **Replace BarChart using the BarChart pattern above**

Adapt `DATA`, `XKEY`, `SERIES_KEYS`, `NAMES`, `COLORS`, `FORMATTER`, `HEIGHT`, `STACKED` from what you read.

- [ ] **Replace PieChart(s) using the PieChart pattern above**

Adapt `PIE_DATA` and `HEIGHT` from what you read. Use `radius: ["40%","70%"]` for donut style.

- [ ] **Verify in browser** — Dashboard charts render correctly.

- [ ] **Commit**

```bash
git add src/components/Dashboard.jsx
git commit -m "feat: migrate Dashboard charts to ECharts"
```

---

### Task 9: Migrate MensualTab.jsx

**Files:**
- Modify: `src/components/MensualTab.jsx`

- [ ] **Read the chart section**

Read `src/components/MensualTab.jsx` focusing on the `<BarChart>` block (monthly capital calls, distributions, return of capital).

- [ ] **Replace recharts import with ECharts**

```js
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
```

- [ ] **Replace BarChart** using the BarChart pattern. This chart likely has 3 series (calls, distributions, return of capital) and may be grouped (no stack). Adapt from what you read.

- [ ] **Verify in browser** — Monthly cash flow bars render correctly.

- [ ] **Commit**

```bash
git add src/components/MensualTab.jsx
git commit -m "feat: migrate MensualTab BarChart to ECharts"
```

---

### Task 10: Migrate ResumTab.jsx

**Files:**
- Modify: `src/components/tabs/ResumTab.jsx`

- [ ] **Read the chart sections**

Read `src/components/tabs/ResumTab.jsx` focusing on `<BarChart>` and `<PieChart>` blocks.

- [ ] **Replace recharts import with ECharts**

```js
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
```

- [ ] **Replace BarChart** (capital calls vs. distributions by fiscal year) using the BarChart pattern.

- [ ] **Replace PieChart(s)** (capital by VCPE type and strategy) using the PieChart pattern.

- [ ] **Verify in browser** — Resum tab charts render correctly.

- [ ] **Commit**

```bash
git add src/components/tabs/ResumTab.jsx
git commit -m "feat: migrate ResumTab charts to ECharts"
```

---

### Task 11: Migrate PortfolioCompaniesTab.jsx

**Files:**
- Modify: `src/components/PortfolioCompaniesTab.jsx`

- [ ] **Read the chart sections**

Read `src/components/PortfolioCompaniesTab.jsx` focusing on `<PieChart>` (×2) and `<BarChart>` blocks.

- [ ] **Replace recharts import with ECharts**

```js
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
```

- [ ] **Replace both PieCharts** (geographic allocation, origin allocation) using the PieChart pattern.

- [ ] **Replace BarChart** (TVPI per company) using the BarChart pattern. This likely has a single series with one bar per company.

- [ ] **Verify in browser** — Portfolio Companies tab charts render correctly.

- [ ] **Commit**

```bash
git add src/components/PortfolioCompaniesTab.jsx
git commit -m "feat: migrate PortfolioCompaniesTab charts to ECharts"
```

---

### Task 12: Phase 2 verification

- [ ] **Run dev server and check all Phase 2 sections**

```bash
npm run dev
```

Visit: Dashboard, Mensual tab, Resum tab, Portfolio Companies tab. All charts should render.

- [ ] **Commit Phase 2 complete marker**

```bash
git commit --allow-empty -m "chore: Phase 2 ECharts migration complete (Dashboard + tabs)"
```

---

## Phase 3 — Detail Pages

---

### Task 13: Migrate CompanyDetail.jsx

**Files:**
- Modify: `src/components/CompanyDetail.jsx`

The CompanyDetail chart is a `ComposedChart` showing quarterly/annual revenue, EBITDA, and debt bars with a margin % overlay line.

- [ ] **Read the chart section**

Read `src/components/CompanyDetail.jsx` focusing on the `<ComposedChart>` block. Note: data keys for bars (revenue, EBITDA, debt), the line key (margin %), axis formatters, dual-axis setup.

- [ ] **Replace recharts import with ECharts**

```js
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
```

- [ ] **Replace ComposedChart with ECharts dual-axis config**

Template for bar+line dual-axis (adapt keys and formatters from what you read):

```jsx
{(() => {
  const t = ecTheme(tc);
  const option = {
    grid: { top: 8, right: 56, bottom: 40, left: 0, containLabel: true },
    tooltip: {
      ...t.tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
    xAxis: {
      type: "category",
      data: DATA.map(d => d.XKEY),
      axisLabel: { ...t.axisLabel },
      axisLine: t.axisLine,
      axisTick: t.axisTick,
    },
    yAxis: [
      {
        type: "value",
        axisLabel: { ...t.axisLabel, formatter: v => fmtM(v) },
        splitLine: t.splitLine,
        axisLine: t.axisLine,
        axisTick: t.axisTick,
      },
      {
        type: "value",
        position: "right",
        axisLabel: { ...t.axisLabel, formatter: v => v.toFixed(1) + "%" },
        splitLine: { show: false },
        axisLine: t.axisLine,
        axisTick: t.axisTick,
      },
    ],
    series: [
      // Bar series (left axis):
      { name: "Revenue", type: "bar", yAxisIndex: 0, data: DATA.map(d => d.revenue ?? null), itemStyle: { color: "#2B5070" }, barMaxWidth: 32 },
      { name: "EBITDA",  type: "bar", yAxisIndex: 0, data: DATA.map(d => d.ebitda  ?? null), itemStyle: { color: "#4E79A7" }, barMaxWidth: 32 },
      // Line series (right axis):
      { name: "Marge",   type: "line", yAxisIndex: 1, data: DATA.map(d => d.margin ?? null), lineStyle: { color: "#E8A020", width: 2 }, itemStyle: { color: "#E8A020" }, symbol: "circle", symbolSize: 6, connectNulls: true },
    ],
  };
  return <ReactECharts option={option} style={{ width: "100%", height: HEIGHT }} opts={{ renderer: "canvas" }} />;
})()}
```

Adapt `DATA`, `XKEY`, bar keys, line key, colors, formatters, `HEIGHT` to match the actual code you read.

- [ ] **Verify** — Navigate to a company detail page. Financial chart renders with bars and margin line.

- [ ] **Commit**

```bash
git add src/components/CompanyDetail.jsx
git commit -m "feat: migrate CompanyDetail ComposedChart to ECharts"
```

---

### Task 14: Migrate FundDetail.jsx

**Files:**
- Modify: `src/components/FundDetail.jsx`

The FundDetail chart is a J-curve: capital calls and distributions as bars, cumulative net as a line.

- [ ] **Read the chart section**

Read `src/components/FundDetail.jsx` focusing on the `<ComposedChart>` block. Note: bar keys (calls, distributions), line key (cumulative net), axis formatters, data variable name, period labels.

- [ ] **Replace recharts import with ECharts**

```js
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
```

- [ ] **Replace ComposedChart**

Use the dual-axis bar+line template from Task 13. Key differences for the J-curve:
- Capital calls are typically negative (outflows) — preserve sign in data
- Distributions are positive
- Cumulative net line can cross zero — ensure `yAxis.min` is not clamped

```jsx
{(() => {
  const t = ecTheme(tc);
  const option = {
    grid: { top: 8, right: 56, bottom: 40, left: 0, containLabel: true },
    tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
    xAxis: {
      type: "category",
      data: DATA.map(d => d.XKEY),
      axisLabel: { ...t.axisLabel },
      axisLine: t.axisLine,
      axisTick: t.axisTick,
    },
    yAxis: [
      { type: "value", axisLabel: { ...t.axisLabel, formatter: v => fmtM(v) }, splitLine: t.splitLine, axisLine: t.axisLine, axisTick: t.axisTick },
      { type: "value", position: "right", axisLabel: { ...t.axisLabel, formatter: v => fmtM(v) }, splitLine: { show: false }, axisLine: t.axisLine, axisTick: t.axisTick },
    ],
    series: [
      { name: "Capital calls",   type: "bar",  yAxisIndex: 0, data: DATA.map(d => d.calls ?? null),  itemStyle: { color: "#E15759" }, barMaxWidth: 32 },
      { name: "Distribucions",   type: "bar",  yAxisIndex: 0, data: DATA.map(d => d.distrib ?? null), itemStyle: { color: "#59A14F" }, barMaxWidth: 32 },
      { name: "Net acumulat",    type: "line", yAxisIndex: 1, data: DATA.map(d => d.cumNet ?? null),  lineStyle: { color: "#2B5070", width: 2 }, itemStyle: { color: "#2B5070" }, symbol: "none", connectNulls: true },
    ],
  };
  return <ReactECharts option={option} style={{ width: "100%", height: HEIGHT }} opts={{ renderer: "canvas" }} />;
})()}
```

Adapt keys, colors, formatters, `HEIGHT` to match what you read.

- [ ] **Verify** — Navigate to a fund detail page. J-curve renders with bars and net line.

- [ ] **Commit**

```bash
git add src/components/FundDetail.jsx
git commit -m "feat: migrate FundDetail J-curve chart to ECharts"
```

---

### Task 15: Migrate PipelineFY26.jsx

**Files:**
- Modify: `src/components/PipelineFY26.jsx`

This file has 4× PieCharts and 1× BarChart.

- [ ] **Read the chart sections**

Read `src/components/PipelineFY26.jsx`. Identify each PieChart's data variable and the BarChart data.

- [ ] **Replace recharts import with ECharts**

```js
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
```

- [ ] **Replace all 4 PieCharts** using the PieChart pattern from Task 8. Each pie likely has a different data variable and title. Adapt per chart.

- [ ] **Replace the BarChart** using the BarChart pattern from Task 8.

- [ ] **Verify** — Navigate to PipelineFY26. All 4 pies + bar chart render.

- [ ] **Commit**

```bash
git add src/components/PipelineFY26.jsx
git commit -m "feat: migrate PipelineFY26 charts to ECharts"
```

---

### Task 16: Migrate SearchersTab.jsx (PieChart only)

**Files:**
- Modify: `src/components/SearchersTab.jsx`

**Note:** The Nivo Sankey in this file is NOT touched. Only migrate the Recharts `<PieChart>`.

- [ ] **Read the PieChart section only**

Read `src/components/SearchersTab.jsx`. Find only the `<PieChart>` JSX block (geographic allocation). Note the data variable and colors.

- [ ] **Add ECharts import** (keep Nivo import intact)

```js
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
```

- [ ] **Remove only the recharts import** from this file (keep `@nivo/sankey` import).

- [ ] **Replace the PieChart** using the PieChart pattern from Task 8.

- [ ] **Verify** — SearchersTab renders: Nivo Sankey still works, PieChart renders via ECharts.

- [ ] **Commit**

```bash
git add src/components/SearchersTab.jsx
git commit -m "feat: migrate SearchersTab PieChart to ECharts (keep Nivo Sankey)"
```

---

### Task 17: Remove recharts + PMPositionDetail cleanup

**Files:**
- Modify: `package.json`
- Check: `src/components/PMPositionDetail.jsx` (uses PriceHistoryChart — already migrated)

- [ ] **Verify no recharts imports remain**

```bash
grep -r "from \"recharts\"" src/
```

Expected output: no matches. If any remain, migrate them using the patterns above before continuing.

- [ ] **Remove recharts from package.json**

```bash
npm uninstall recharts
```

- [ ] **Verify the app still builds**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Final smoke test**

```bash
npm run dev
```

Visit: Dashboard, Resum, Public Markets, PM Tipus, PM Transaccions, any Fund/Company detail page. All charts render. Nivo Sankey in SearchersTab still works.

- [ ] **Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove recharts — migration to ECharts complete"
```

---

## Done

All 14 files migrated. `recharts` removed. ECharts is the single chart dependency.
