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
const fmtMonthKey = v => v ? fmtMonth(v.length === 7 ? v + "-01" : v) : "";

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
