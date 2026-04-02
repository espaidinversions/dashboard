import React, { useMemo } from "react";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { useTheme } from "../theme.js";
import { fmtM, fmtMonthKey } from "../utils.js";
import { PM_POSITIONS } from "../data/publicMarkets.js";
import { START_MONTH_2019, buildMonthGrid, forwardFillMonthValues, toMonthKey } from "../chartSeries.js";

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

    // Accumulate monthly net flows per group key
    const monthMap = {};
    (transactions ?? []).forEach(t => {
      if (!t.date || !(t.valueEur > 0)) return;
      const month = toMonthKey(t.date);
      if (!monthMap[month]) monthMap[month] = {};
      let key;
      if      (groupBy === "assetType") key = t.tipus ?? "—";
      else if (groupBy === "manager")   key = custodianToMgr(t.custodian, t.isin);
      else if (groupBy === "position")  key = topIsinSet.has(t.isin) ? t.isin : "altres";
      else                               key = "total";
      monthMap[month][key] = (monthMap[month][key] ?? 0) + (t.action === "sell" ? -t.valueEur : t.valueEur);
    });

    const txMonths = Object.keys(monthMap).sort();
    const valMonths = (valuesSeries ?? []).map(({ date }) => toMonthKey(date)).filter(Boolean).sort();
    const lastMonth = [txMonths.at(-1), valMonths.at(-1), START_MONTH_2019].filter(Boolean).sort().at(-1);
    if (!lastMonth) return { chartData: [], keys: [], colorMap: {}, nameMap: {} };

    const allMonths = buildMonthGrid({ startMonth: START_MONTH_2019, months: [lastMonth] });

    // Build cumulative running totals across full range
    const running = {};
    const rows = allMonths.map(month => {
      const row = { month };
      if (monthMap[month]) {
        Object.entries(monthMap[month]).forEach(([k, v]) => {
          running[k] = (running[k] ?? 0) + v;
        });
      }
      // Emit current running total for every known key (forward-fill)
      Object.entries(running).forEach(([k, v]) => { row[k] = v; });
      return row;
    });

    // Merge portfolio value (forward-fill missing months)
    const valByMonth = {};
    (valuesSeries ?? []).forEach(({ date, value }) => {
      const month = toMonthKey(date);
      if (month) valByMonth[month] = value;
    });
    forwardFillMonthValues(rows, valByMonth, "portfolioValue");

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
      colorMap["altres"] = "#BAB0AC";
      nameMap["altres"]  = "Altres";
    } else {
      colorMap["total"] = "#2B5070";
      nameMap["total"]  = "Capital invertit";
    }

    return { chartData: rows, keys: allKeys, colorMap, nameMap };
  }, [transactions, valuesSeries, groupBy, topN]);

  if (chartData.length === 0) {
    return (
      <p style={{ fontSize: 11, color: "#8A9BAC", padding: "12px 0", fontStyle: "italic" }}>
        Sense dades de fluxos disponibles.
      </p>
    );
  }

  const isStacked        = groupBy !== "total";
  const hasPortfolioValue = chartData.some(r => r.portfolioValue != null);

  const t = ecTheme(tc);

  const option = {
    grid: { top: 32, right: hasPortfolioValue ? 68 : 8, bottom: isStacked ? 48 : 32, left: 0, containLabel: true },
    legend: isStacked
      ? { bottom: 0, textStyle: { fontSize: 9, color: tc.textLight }, formatter: n => nameMap[n] ?? n }
      : { show: false },
    tooltip: {
      ...t.tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        const label = fmtMonthKey(params[0]?.axisValue ?? "");
        let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
        params.forEach(p => {
          if (p.value == null) return;
          const name = nameMap[p.seriesName] ?? p.seriesName;
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
        itemStyle: { color: colorMap[k] ?? "#BAB0AC", opacity: 0.72, borderRadius: isStacked ? undefined : [3, 3, 0, 0] },
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
