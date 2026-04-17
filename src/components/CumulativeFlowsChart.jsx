import React, { useMemo } from "react";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { useTheme } from "../theme.js";
import { fmtM, fmtMonthKey } from "../utils.js";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { ALL_PRICE_SERIES } from "../data/allPrices.js";
import { START_MONTH_2019, buildMonthGrid, forwardFillMonthValues, getPriceScale, toMonthKey } from "../chartSeries.js";

const PM_POSITIONS = PM_MODEL.holdings.active;

// Manager routing — mirrors PublicMarketsTab mvData logic
const ABEL_ISINS = new Set(
  PM_POSITIONS.filter(p => p.gestor === "Abel Font").map(p => p.isin)
);

function custodianToMgr(custodian, isin) {
  if (custodian === "Bankinter")           return "bankinter";
  if (custodian === "Interactive Brokers") return "interactiveBrokers";
  if (custodian === "UBS")                 return "ubs";
  if (custodian === "Credit Suisse")       return "creditSuisse";
  if (custodian === "CaixaBank") return ABEL_ISINS.has(isin) ? "bankinter" : "caixa";
  if (custodian === "Andbank" || custodian === "WAM") return "andbank";
  if (custodian === "JPMorgan") return "jpmorgan";
  return "altres";
}

function custodianToGroup(custodian) {
  if (custodian === "CaixaBank")           return "caixa";
  if (custodian === "UBS")                 return "ubs";
  if (custodian === "Credit Suisse")       return "creditSuisse";
  if (custodian === "Bankinter")           return "bankinter";
  if (custodian === "Interactive Brokers") return "interactiveBrokers";
  if (custodian === "JPMorgan")            return "jpmorgan";
  if (custodian === "Andbank" || custodian === "WAM") return "andbank";
  return "altres";
}

function estimateTxValue(t) {
  if (t?.valueEur != null) return t.valueEur;
  if (t?.action !== "buy" || !t?.isin || !t?.date || t?.units == null) return 0;
  const month = toMonthKey(t.date);
  const series = ALL_PRICE_SERIES[t.isin];
  if (!Array.isArray(series) || !month) return 0;
  const price = series.find(([m]) => m === month)?.[1];
  const scale = getPriceScale(PM_POSITIONS.find(p => p.isin === t.isin) ?? null);
  return price != null ? (price * t.units) / scale : 0;
}

const MGR_COLORS = { caixa: "#2B5070", ubs: "#4E79A7", creditSuisse: "#C46B5A", bankinter: "#3DC83E", interactiveBrokers: "#7BC96F", andbank: "#6B2E7E", jpmorgan: "#8A6D3B", altres: "#BAB0AC" };
const MGR_NAMES  = { caixa: "CaixaBank", ubs: "UBS", creditSuisse: "Credit Suisse", bankinter: "Bankinter", interactiveBrokers: "Interactive Brokers", andbank: "WAM–Andbank", jpmorgan: "JPMorgan", altres: "Altres" };
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
  startMonth = START_MONTH_2019,
  groupBy = "total",
  topN = 5,
  height = 260,
}) {
  const { tc } = useTheme();

  const { chartData, keys, colorMap, nameMap } = useMemo(() => {
    const txs = (transactions ?? [])
      .filter(t => t.date && toMonthKey(t.date) >= startMonth)
      .map(t => ({
        ...t,
        _flowValue: estimateTxValue(t),
      }))
      .filter(t => t._flowValue > 0);
    const buys = txs.filter(t => t.action === "buy");

    // Rank ISINs by total invested (for groupBy="position")
    const isinTotals = {};
    buys.forEach(t => { isinTotals[t.isin] = (isinTotals[t.isin] ?? 0) + t.valueEur; });
    const topIsins = Object.entries(isinTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([k]) => k);
    const topIsinSet = new Set(topIsins);

    const resolveKey = (t) => {
      if      (groupBy === "assetType")  return t.tipus ?? "—";
      else if (groupBy === "manager")    return custodianToMgr(t.custodian, t.isin);
      else if (groupBy === "custodian")  return custodianToGroup(t.custodian);
      else if (groupBy === "position")   return topIsinSet.has(t.isin) ? t.isin : "altres";
      return "total";
    };

    const txMonths = [...new Set(txs.map(t => toMonthKey(t.date)).filter(Boolean))].sort();
    const valMonths = (valuesSeries ?? []).map(({ date }) => toMonthKey(date)).filter(Boolean).sort();
    const lastMonth = [txMonths.at(-1), valMonths.at(-1), startMonth].filter(Boolean).sort().at(-1);
    if (!lastMonth) return { chartData: [], keys: [], colorMap: {}, nameMap: {} };

    const allMonths = buildMonthGrid({ startMonth, months: [lastMonth] });

    if (groupBy === "total") {
      const monthMap = {};
      txs.forEach(t => {
        const month = toMonthKey(t.date);
        if (!monthMap[month]) monthMap[month] = { inflow: 0, outflow: 0 };
        if (t.action === "sell") monthMap[month].outflow += t._flowValue;
        else monthMap[month].inflow += t._flowValue;
      });

      const openingCapital = (valuesSeries ?? []).find(r => r?.value != null)?.value ?? 0;
      let cumulative = openingCapital;
      const rows = allMonths.map(month => {
        const flow = monthMap[month] ?? { inflow: 0, outflow: 0 };
        const row = {
          month,
          inflow: flow.inflow,
          outflow: -flow.outflow,
        };
        cumulative += flow.inflow;
        row.cumulative = cumulative;
        return row;
      });

      const valByMonth = {};
      (valuesSeries ?? []).forEach(({ date, value }) => {
        const month = toMonthKey(date);
        if (month) valByMonth[month] = value;
      });
      forwardFillMonthValues(rows, valByMonth, "portfolioValue");

      return {
        chartData: rows,
        keys: ["inflow", "outflow", "cumulative"],
        colorMap: {
          inflow: "#3DC83E",
          outflow: "#E15759",
          cumulative: "#2B5070",
        },
        nameMap: {
          inflow: "Entrades",
          outflow: "Sortides",
          cumulative: "Capital acumulat",
        },
      };
    }

    // Accumulate monthly cumulative flows per group key
    const monthMap = {};
    txs.forEach(t => {
      if (!monthMap[toMonthKey(t.date)]) monthMap[toMonthKey(t.date)] = {};
      const month = toMonthKey(t.date);
      const key = resolveKey(t);
      monthMap[month][key] = (monthMap[month][key] ?? 0) + (t.action === "sell" ? -t.valueEur : t.valueEur);
    });

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
    if (groupBy === "manager" || groupBy === "custodian") {
      allKeys.forEach(k => {
        colorMap[k] = MGR_COLORS[k] ?? "#BAB0AC";
        nameMap[k]  = MGR_NAMES[k]  ?? k;
      });
      colorMap.altres = colorMap.altres ?? "#BAB0AC";
      nameMap.altres = "Altres";
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

  const isTotalMode = groupBy === "total";
  const hasPortfolioValue = chartData.some(r => r.portfolioValue != null);

  const t = ecTheme(tc);
  const showLegend = true;

  const option = {
    grid: { top: 32, right: hasPortfolioValue ? 68 : 8, bottom: showLegend ? 48 : 32, left: 0, containLabel: true },
    legend: showLegend
      ? { bottom: 0, textStyle: { fontSize: 9, color: tc.textLight }, formatter: n => nameMap[n] ?? n }
      : { show: false },
    tooltip: {
      ...t.tooltip,
      trigger: "axis",
      axisPointer: { type: isTotalMode ? "shadow" : "line" },
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
      ...(isTotalMode ? [
        {
          name: nameMap.inflow ?? "Entrades",
          type: "bar",
          data: chartData.map(r => r.inflow ?? null),
          itemStyle: { color: colorMap.inflow ?? "#3DC83E", opacity: 0.8, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 32,
        },
        {
          name: nameMap.outflow ?? "Sortides",
          type: "bar",
          data: chartData.map(r => r.outflow ?? null),
          itemStyle: { color: colorMap.outflow ?? "#E15759", opacity: 0.8, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 32,
        },
        {
          name: nameMap.cumulative ?? "Cumulat agregat",
          type: "line",
          data: chartData.map(r => r.cumulative ?? null),
          lineStyle: { color: colorMap.cumulative ?? "#2B5070", width: 2 },
          itemStyle: { color: colorMap.cumulative ?? "#2B5070" },
          symbol: "none",
          connectNulls: true,
        },
      ] : [
        ...keys.map(k => ({
          name: nameMap[k] ?? k,
          type: "line",
          data: chartData.map(r => r[k] ?? null),
          lineStyle: { color: colorMap[k] ?? "#BAB0AC", width: 2 },
          itemStyle: { color: colorMap[k] ?? "#BAB0AC" },
          symbol: "none",
          connectNulls: true,
        })),
      ]),
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
