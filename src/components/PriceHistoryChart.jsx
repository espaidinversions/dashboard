import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
import { useTheme } from "../theme.js";
import { fmtM, fmtMonthKey } from "../utils.js";
import { FUND_PRICES } from "../data/fundPrices.js";

const toMonth = d => (d ?? "").slice(0, 7);

/**
 * PriceHistoryChart
 *
 * Props:
 *   isin        — fund ISIN (used to look up FUND_PRICES)
 *   dataCompra  — acquisition date "YYYY-MM-DD" (splits dotted/solid line)
 *   transactions — PM_TRANSACTIONS rows filtered to this ISIN
 *   height      — chart height px (default 280)
 *
 * Returns null if no price data exists for this ISIN (caller renders fallback).
 */
export function PriceHistoryChart({ isin, dataCompra, transactions, height = 280 }) {
  const { tc, dark } = useTheme();
  const [mode, setMode] = useState("price"); // "price" | "value"

  const priceSeries = FUND_PRICES[isin]; // [["YYYY-MM", price], ...]

  const { chartData, acqMonth } = useMemo(() => {
    if (!priceSeries || priceSeries.length === 0) return { chartData: null, acqMonth: null };

    const acqMonth = dataCompra ? toMonth(dataCompra) : null;

    // Monthly cumulative inflows from buy transactions
    const inflowByMonth = {};
    (transactions ?? [])
      .filter(t => t.action === "buy" && (t.valueEur ?? 0) > 0)
      .forEach(t => {
        const m = toMonth(t.date);
        if (m) inflowByMonth[m] = (inflowByMonth[m] ?? 0) + t.valueEur;
      });

    // Monthly unit changes (buy = +units, sell = −units)
    const unitDeltaByMonth = {};
    (transactions ?? []).forEach(t => {
      const m = toMonth(t.date);
      if (!m) return;
      const delta = t.action === "buy" ? (t.units ?? 0) : -(t.units ?? 0);
      unitDeltaByMonth[m] = (unitDeltaByMonth[m] ?? 0) + delta;
    });

    let cumInflow = 0;
    let cumUnits = 0;

    const rows = priceSeries.map(([month, price]) => {
      cumInflow += inflowByMonth[month] ?? 0;
      cumUnits  += unitDeltaByMonth[month] ?? 0;
      const isAfterAcq = acqMonth != null && month >= acqMonth;
      return {
        month,
        preBuy:         !isAfterAcq ? price : null,
        postBuy:        isAfterAcq  ? price : null,
        portfolioValue: cumUnits > 0 ? Math.round(cumUnits * price) : null,
        cumInflow:      cumInflow > 0 ? cumInflow : null,
      };
    });

    return { chartData: rows, acqMonth };
  }, [priceSeries, dataCompra, transactions]);

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
      {/* Mode toggle */}
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
            }] : []),
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

      <div style={{ fontSize: 10, color: tc.textLight ?? "#8A9BAC", marginTop: 6, fontStyle: "italic" }}>
        {mode === "price"
          ? `Preu unitari del fons des de 2019. Línia discontínua: sense posició (fins ${acqMonth ?? "—"}). Línia contínua: posició activa.`
          : "Valor teòric = unitats acumulades × preu unitari. Calculat des de la primera transacció registrada."}
      </div>
    </div>
  );
}
