import React, { useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
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

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 64, bottom: 0, left: 0 }}
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
          {/* Left axis: cumulative inflows */}
          <YAxis
            yAxisId="left"
            tickFormatter={v => fmtM(v)}
            tick={{ fontSize: 10, fill: tc.textLight ?? "#8A9BAC" }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          {/* Right axis: price or portfolio value */}
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={v => mode === "price" ? v.toFixed(2) : fmtM(v)}
            tick={{ fontSize: 9, fill: tc.textLight ?? "#8A9BAC" }}
            axisLine={false}
            tickLine={false}
            width={60}
          />

          <Tooltip
            contentStyle={{
              background: tc.card ?? "#fff",
              border: `1px solid ${tc.border ?? "#E5EAF0"}`,
              borderRadius: 8,
            }}
            labelStyle={{ color: tc.text ?? "#1A2B3C", fontWeight: 600, fontSize: 11 }}
            labelFormatter={fmtMonthKey}
            formatter={(v, name) => {
              if (name === "cumInflow")      return [fmtM(v),            "Capital invertit"];
              if (name === "preBuy")         return [v.toFixed(4),       "Preu (sense posició)"];
              if (name === "postBuy")        return [v.toFixed(4),       "Preu (en cartera)"];
              if (name === "portfolioValue") return [fmtM(v),            "Valor cartera teòric"];
              return [v, name];
            }}
          />

          {/* Cumulative inflows bars — always shown */}
          {hasBars && (
            <Bar
              yAxisId="left"
              dataKey="cumInflow"
              name="cumInflow"
              fill="#4E79A7"
              fillOpacity={0.55}
              maxBarSize={32}
            />
          )}

          {/* Acquisition date reference line */}
          {acqMonth && (
            <ReferenceLine
              yAxisId="left"
              x={acqMonth}
              stroke={tc.green ?? "#59A14F"}
              strokeDasharray="4 2"
              strokeWidth={1.5}
              label={{ value: "Compra", position: "insideTopRight", fontSize: 9, fill: tc.green ?? "#59A14F" }}
            />
          )}

          {/* Price mode: two lines split at acquisition date */}
          {mode === "price" && (
            <>
              <Line
                yAxisId="right"
                dataKey="preBuy"
                name="preBuy"
                stroke={tc.navy ?? "#2B5070"}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                strokeOpacity={0.55}
                dot={false}
                connectNulls
              />
              <Line
                yAxisId="right"
                dataKey="postBuy"
                name="postBuy"
                stroke={tc.navy ?? "#2B5070"}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </>
          )}

          {/* Value mode: single theoretical value line */}
          {mode === "value" && (
            <Line
              yAxisId="right"
              dataKey="portfolioValue"
              name="portfolioValue"
              stroke={tc.green ?? "#59A14F"}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <div style={{ fontSize: 10, color: tc.textLight ?? "#8A9BAC", marginTop: 6, fontStyle: "italic" }}>
        {mode === "price"
          ? `Preu unitari del fons des de 2019. Línia discontínua: sense posició (fins ${acqMonth ?? "—"}). Línia contínua: posició activa.`
          : "Valor teòric = unitats acumulades × preu unitari. Calculat des de la primera transacció registrada."}
      </div>
    </div>
  );
}
