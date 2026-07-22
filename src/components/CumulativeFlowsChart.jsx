import { useMemo } from "react";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { useTheme } from "../theme.js";
import { fmtM, fmtMonthKey } from "../utils.js";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { ALL_PRICE_SERIES } from "../data/allPrices.js";
import { START_MONTH_2019, buildMonthGrid, forwardFillMonthValues, getPriceScale, toMonthKey } from "../chartSeries.js";
import { MGR_COLORS, CHART_PALETTE, FLOW_COLORS, ASSET_COLORS, NEUTRAL, PORTFOLIO_VALUE_COLOR } from "../chartColors.js";
import { canonicalPmCustodian } from "../data/pmClassification.js";

const PM_POSITIONS = PM_MODEL.holdings.active;

// Manager routing — mirrors PublicMarketsTab mvData logic
const ABEL_ISINS = new Set(
  PM_POSITIONS.filter(p => p.gestor === "Abel Font").map(p => p.isin)
);

function custodianToMgr(custodian, isin) {
  const c = canonicalPmCustodian(custodian);
  if (c === "Bankinter")           return "bankinter";
  if (c === "Interactive Brokers") return "interactiveBrokers";
  if (c === "UBS")                 return "ubs";
  if (c === "CaixaBank") return ABEL_ISINS.has(isin) ? "bankinter" : "caixa";
  if (c === "Andbank") return "andbank";
  if (c === "JPMorgan") return "jpmorgan";
  return "altres";
}

function custodianToGroup(custodian) {
  const c = canonicalPmCustodian(custodian);
  if (c === "CaixaBank")           return "caixa";
  if (c === "UBS")                 return "ubs";
  if (c === "Bankinter")           return "bankinter";
  if (c === "Interactive Brokers") return "interactiveBrokers";
  if (c === "JPMorgan")            return "jpmorgan";
  if (c === "Andbank")             return "andbank";
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

const MGR_NAMES  = { caixa: "CaixaBank", ubs: "UBS", bankinter: "Bankinter", interactiveBrokers: "Interactive Brokers", andbank: "WAM–Andbank", jpmorgan: "JPMorgan", altres: "Altres" };
const ASSET_NAMES  = { RV: "Renda Variable", RF: "Renda Fixa" };

/**
 * CumulativeFlowsChart
 *
 * Props:
 *   transactions  — array of PM_TRANSACTIONS rows already filtered to scope
 *   valuesSeries  — array of { date: string, value: number } portfolio value time series
 *   groupBy       — "total" | "assetType" | "manager" | "custodian" | "position"
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
        cumulative += flow.inflow - flow.outflow;
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
        colorMap: { ...FLOW_COLORS },
        nameMap: {
          inflow: "Entrades",
          outflow: "Sortides",
          cumulative: "Capital acumulat",
        },
      };
    }

    // Grouped modes show monthly net flow columns instead of running totals.
    const monthMap = {};
    txs.forEach(t => {
      const month = toMonthKey(t.date);
      if (!month) return;
      if (!monthMap[month]) monthMap[month] = {};
      const key = resolveKey(t);
      monthMap[month][key] = (monthMap[month][key] ?? 0) + (t.action === "sell" ? -t._flowValue : t._flowValue);
    });

    const rows = allMonths.map(month => ({ month, ...(monthMap[month] ?? {}) }));

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
        colorMap[k] = MGR_COLORS[k] ?? NEUTRAL;
        nameMap[k]  = MGR_NAMES[k]  ?? k;
      });
      colorMap.altres = colorMap.altres ?? NEUTRAL;
      nameMap.altres = "Altres";
    } else if (groupBy === "assetType") {
      allKeys.forEach(k => {
        colorMap[k] = ASSET_COLORS[k] ?? NEUTRAL;
        nameMap[k]  = ASSET_NAMES[k]  ?? k;
      });
    } else if (groupBy === "position") {
      topIsins.forEach((isin, i) => {
        const pos = PM_POSITIONS.find(p => p.isin === isin);
        colorMap[isin] = CHART_PALETTE[i] ?? NEUTRAL;
        nameMap[isin]  = pos
          ? pos.nom.replace(/\bUCITS ETF\b.*/, "ETF").replace(/\bUCITS\b.*/, "").trim()
          : isin;
      });
      colorMap["altres"] = NEUTRAL;
      nameMap["altres"]  = "Altres";
    } else {
      colorMap["total"] = FLOW_COLORS.cumulative;
      nameMap["total"]  = "Capital invertit";
    }

    return { chartData: rows, keys: allKeys, colorMap, nameMap };
  }, [transactions, valuesSeries, groupBy, topN]);

  if (chartData.length === 0) {
    return (
      <p style={{ fontSize: 11, color: NEUTRAL, padding: "12px 0", fontStyle: "italic" }}>
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
      ...(isTotalMode ? [
        {
          name: nameMap.inflow ?? "Entrades",
          type: "bar",
          data: chartData.map(r => r.inflow ?? null),
          itemStyle: { color: colorMap.inflow ?? FLOW_COLORS.inflow, opacity: 0.8, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 32,
        },
        {
          name: nameMap.outflow ?? "Sortides",
          type: "bar",
          data: chartData.map(r => r.outflow ?? null),
          itemStyle: { color: colorMap.outflow ?? FLOW_COLORS.outflow, opacity: 0.8, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 32,
        },
        {
          name: nameMap.cumulative ?? "Cumulat agregat",
          type: "line",
          data: chartData.map(r => r.cumulative ?? null),
          lineStyle: { color: colorMap.cumulative ?? FLOW_COLORS.cumulative, width: 2 },
          itemStyle: { color: colorMap.cumulative ?? FLOW_COLORS.cumulative },
          symbol: "none",
          connectNulls: true,
        },
      ] : [
        ...keys.map(k => ({
          name: nameMap[k] ?? k,
          type: "bar",
          stack: "flows",
          data: chartData.map(r => r[k] ?? null),
          itemStyle: { color: colorMap[k] ?? NEUTRAL, opacity: 0.85, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 34,
        })),
      ]),
      ...(hasPortfolioValue ? [{
        name: "Valor cartera",
        type: "line",
        yAxisIndex: 1,
        data: chartData.map(r => r.portfolioValue ?? null),
        lineStyle: { color: PORTFOLIO_VALUE_COLOR, width: 2, type: "dashed" },
        itemStyle: { color: PORTFOLIO_VALUE_COLOR },
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
