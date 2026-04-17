import React, { useMemo, useState } from "react";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { useTheme } from "../theme.js";
import { fmtM, fmtMonthKey } from "../utils.js";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { ALL_PRICE_SERIES, ESTIMATED_PRICE_ISINS } from "../data/allPrices.js";
import { START_MONTH_2019, buildMonthGrid, getPriceScale, toMonthKey } from "../chartSeries.js";

const PM_POSITIONS = PM_MODEL.holdings.active;

/**
 * PriceHistoryChart
 *
 * Props:
 *   isin        — fund ISIN (used to look up FUND_PRICES)
 *   dataCompra  — acquisition date "YYYY-MM-DD" (splits dotted/solid line)
 *   transactions — PM_TRANSACTIONS rows filtered to this ISIN
 *   valueSeries  — optional { date, value } rows from portfolio history
 *   height      — chart height px (default 280)
 *
 * Returns null if no price data exists for this ISIN (caller renders fallback).
 */
export function PriceHistoryChart({ isin, dataCompra, transactions, valueSeries = [], height = 280 }) {
  const { tc, dark } = useTheme();
  const [mode, setMode] = useState(() => (ALL_PRICE_SERIES[isin]?.length > 0 ? "price" : "value"));
  const priceSeries = ALL_PRICE_SERIES[isin];
  const estimated = ESTIMATED_PRICE_ISINS.has(isin);
  const priceScale = useMemo(
    () => getPriceScale(PM_POSITIONS.find(p => p.isin === isin) ?? null),
    [isin]
  );

  const { chartData, acqMonth } = useMemo(() => {
    if (
      (!priceSeries || priceSeries.length === 0) &&
      (!transactions || transactions.length === 0) &&
      (!valueSeries || valueSeries.length === 0)
    ) {
      return { chartData: null, acqMonth: null };
    }

    const acqMonth = dataCompra ? toMonthKey(dataCompra) : null;
    const priceByMonth = Object.fromEntries((priceSeries ?? []).map(([month, value]) => [month, value]));
    const valueByMonth = Object.fromEntries(
      (valueSeries ?? [])
        .map(r => [toMonthKey(r.date), r.value])
        .filter(([month]) => Boolean(month)),
    );

    const priceMonths = [...new Set([
      ...(priceSeries ?? []).map(([month]) => month).filter(Boolean),
      ...Object.keys(valueByMonth),
    ])].sort();
    const filledPrice = (() => {
      const forward = {};
      let last = null;
      for (const month of priceMonths) {
        const current = priceByMonth[month];
        if (current != null) last = current;
        forward[month] = last;
      }
      const backward = {};
      let next = null;
      for (let i = priceMonths.length - 1; i >= 0; i--) {
        const month = priceMonths[i];
        const current = priceByMonth[month];
        if (current != null) next = current;
        backward[month] = next;
      }
      return month => forward[month] ?? backward[month] ?? null;
    })();

    const flowByMonth = {};
    (transactions ?? [])
      .filter(t => (t.valueEur ?? 0) > 0)
      .forEach(t => {
        const month = toMonthKey(t.date);
        if (!month) return;
        const signed = t.action === "sell" ? -t.valueEur : t.valueEur;
        flowByMonth[month] = (flowByMonth[month] ?? 0) + signed;
      });

    const unitDeltaByMonth = {};
    (transactions ?? []).forEach(t => {
      const month = toMonthKey(t.date);
      if (!month) return;
      const delta = t.action === "buy" ? (t.units ?? 0) : -(t.units ?? 0);
      unitDeltaByMonth[month] = (unitDeltaByMonth[month] ?? 0) + delta;
      });

    const monthSet = new Set([
      ...(priceSeries ?? []).map(([month]) => month),
      ...Object.keys(flowByMonth),
      ...Object.keys(unitDeltaByMonth),
      ...Object.keys(valueByMonth),
    ]);

    let cumInflow = 0;
    let cumUnits = 0;
    const rows = buildMonthGrid({ startMonth: START_MONTH_2019, months: [...monthSet] }).map(month => {
      const price = filledPrice(month);
      const historicalValue = valueByMonth[month] ?? null;
      cumInflow += flowByMonth[month] ?? 0;
      cumUnits += unitDeltaByMonth[month] ?? 0;
      return {
        month,
        navPrice: price,
        portfolioValue: historicalValue ?? (cumUnits > 0 && price != null ? Math.round((cumUnits * price) / priceScale) : null),
        cumInflow: cumInflow !== 0 ? cumInflow : null,
      };
    });

    return { chartData: rows, acqMonth };
  }, [priceSeries, dataCompra, transactions, valueSeries]);

  if (!chartData) return null;

  const hasBars = chartData.some(r => r.cumInflow != null);
  const btnStyle = (id) => ({
    padding: "3px 10px", borderRadius: 5, fontSize: 11,
    cursor: "pointer", fontFamily: "inherit",
    border: `1.5px solid ${mode === id ? tc.navy : tc.border}`,
    background: mode === id ? (dark ? "#0A1A30" : "#E8F0FA") : "transparent",
    color: mode === id ? tc.navy : tc.textLight,
    fontWeight: mode === id ? 700 : 400,
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        <button style={btnStyle("price")} onClick={() => setMode("price")}>Preu unitari</button>
        <button style={btnStyle("value")} onClick={() => setMode("value")}>Valor cartera</button>
      </div>

      {(() => {
        const t = ecTheme(tc);
        const months = chartData.map(r => r.month);

        const option = {
          grid: { top: 8, right: 68, bottom: 40, left: 0, containLabel: true },
          tooltip: {
            ...t.tooltip,
            trigger: "axis",
            axisPointer: { type: "line" },
            formatter: (params) => {
              const label = fmtMonthKey(params[0]?.axisValue ?? "");
              let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
              params.forEach(p => {
                if (p.value == null) return;
                let val, name;
                if (p.seriesName === "cumInflow")      { val = fmtM(p.value);      name = "Flux net acumulat"; }
                else if (p.seriesName === "navPrice")   { val = p.value.toFixed(4); name = estimated ? "Preu unitari estimat" : "Preu unitari importat"; }
                else if (p.seriesName === "portValue")  { val = fmtM(p.value);      name = "Valor cartera teòric"; }
                else                                    { val = p.value;            name = p.seriesName; }
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
              axisLabel: { ...t.axisLabel, formatter: v => mode === "price" ? v.toFixed(2) : fmtM(v) },
              splitLine: { show: false },
              axisLine: t.axisLine,
              axisTick: t.axisTick,
            },
          ],
          series: [
            ...(hasBars ? [{
              name: "cumInflow",
              type: "bar",
              yAxisIndex: 0,
              data: chartData.map(r => r.cumInflow ?? null),
              itemStyle: { color: "#4E79A7", opacity: 0.55, borderRadius: [3, 3, 0, 0] },
              barMaxWidth: 32,
            }] : []),
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
              showInLegend: false,
            }] : []),
            ...(mode === "price" ? [{
              name: "navPrice",
              type: "line",
              yAxisIndex: 1,
              data: chartData.map(r => r.navPrice ?? null),
              lineStyle: { color: tc.navy ?? "#2B5070", width: 2 },
              itemStyle: { color: tc.navy ?? "#2B5070" },
              symbol: "none",
              connectNulls: true,
            }] : []),
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

        return <ReactECharts option={option} notMerge={true} style={{ width: "100%", height }} opts={{ renderer: "canvas" }} />;
      })()}

      <div style={{ fontSize: 10, color: tc.textLight ?? "#8A9BAC", marginTop: 6, fontStyle: "italic" }}>
        {mode === "price"
          ? `${estimated ? "Preu unitari estimat" : "Preu unitari importat"} des del script de descàrrega. La línia mostra la sèrie NAV mensual completa; la compra queda marcada a ${acqMonth ?? "—"}.`
          : "Valor cartera = flux net acumulat i, si existeix, valor històric importat o unitats acumulades × preu."}
      </div>
    </div>
  );
}
