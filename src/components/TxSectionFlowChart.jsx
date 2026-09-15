import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { fmtM } from "../utils.js";

export function TxSectionFlowChart({ tc, chartData, scopeToggle, scope, setScope, vehiclesLabel }) {
  const scopeBtnStyle = (id) => {
    const active = scope === id;
    return {
      border: `1px solid ${tc.border}`,
      background: active ? tc.navy : "transparent",
      color: active ? "#fff" : tc.textMid,
      padding: "6px 10px",
      fontSize: 12,
      fontWeight: active ? 700 : 600,
      cursor: "pointer",
      fontFamily: "inherit",
    };
  };

  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.13em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600 }}>
          Flux Mensual · Mercats Privats
        </div>
        {scopeToggle ? (
          <div style={{ display: "inline-flex", border: `1px solid ${tc.border}`, borderRadius: 8, overflow: "hidden", background: tc.bg }}>
            <button onClick={() => setScope("all")} style={{ ...scopeBtnStyle("all"), borderRight: `1px solid ${tc.border}` }}>All</button>
            <button onClick={() => setScope("vehicles")} style={{ ...scopeBtnStyle("vehicles"), borderRight: `1px solid ${tc.border}` }}>{vehiclesLabel}</button>
            <button onClick={() => setScope("companies")} style={scopeBtnStyle("companies")}>Companies</button>
          </div>
        ) : null}
      </div>
      {chartData.length === 0 ? (
        <div style={{ padding: "24px 0 8px", textAlign: "center", color: tc.textLight, fontSize: 13 }}>Cap transacció</div>
      ) : (() => {
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
              params.forEach((point) => {
                if (!point.value) return;
                html += `<div>${point.marker}${point.seriesName}: ${fmtM(point.value)}</div>`;
              });
              return html;
            },
          },
          legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
          xAxis: {
            type: "category",
            data: chartData.map((row) => row.label),
            axisLabel: { fontSize: 9, color: tc.textLight, rotate: -40 },
            axisLine: { show: false },
            axisTick: { show: false },
          },
          yAxis: {
            type: "value",
            axisLabel: { fontSize: 10, color: tc.textLight, formatter: (value) => fmtM(value) },
            splitLine: { lineStyle: { color: tc.border } },
            axisLine: { show: false },
            axisTick: { show: false },
          },
          series: [
            {
              name: "Capital Calls",
              type: "bar",
              data: chartData.map((row) => row.CapitalCalls ?? null),
              itemStyle: { color: tc.navy, borderRadius: [4, 4, 0, 0] },
              barMaxWidth: 28,
              barGap: "10%",
            },
            {
              name: "Retorns",
              type: "bar",
              data: chartData.map((row) => row.Retorns ?? null),
              itemStyle: { color: tc.green, borderRadius: [4, 4, 0, 0] },
              barMaxWidth: 28,
            },
          ],
        };
        return <ReactECharts option={option} style={{ width: "100%", height: 220 }} opts={{ renderer: "canvas" }} />;
      })()}
    </div>
  );
}
