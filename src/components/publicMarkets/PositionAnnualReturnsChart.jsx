import ReactECharts from "../../ReactECharts.jsx";
import { ecTheme } from "../../echartsTheme.js";
import { SectionHeader } from "../SharedComponents.jsx";

export function PositionAnnualReturnsChart({ returnData, isAbelFont, tc }) {
  if (returnData.length === 0) return null;
  const t = ecTheme(tc);
  return (
    <>
      <SectionHeader title={`Rendiments anuals${isAbelFont ? " · brut vs net TER" : ""}`} tc={tc} />
      <ReactECharts
        style={{ width: "100%", height: 200 }}
        opts={{ renderer: "canvas" }}
        option={{
          grid: { top: 4, right: 16, bottom: 4, left: 0, containLabel: true },
          tooltip: {
            ...t.tooltip,
            trigger: "axis",
            formatter: params => {
              const label = params[0]?.axisValue ?? "";
              let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
              params.forEach(p => {
                if (p.value == null) return;
                html += `<div>${p.marker}${p.seriesName === "brut" ? "Brut" : "Net TER"}: ${(p.value >= 0 ? "+" : "") + p.value.toFixed(2)}%</div>`;
              });
              return html;
            },
          },
          xAxis: {
            type: "category",
            data: returnData.map(d => d.year),
            axisLabel: { ...t.axisLabel, fontSize: 10 },
            axisLine: t.axisLine,
            axisTick: t.axisTick,
          },
          yAxis: {
            type: "value",
            axisLabel: { ...t.axisLabel, formatter: v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` },
            splitLine: t.splitLine,
            axisLine: t.axisLine,
            axisTick: t.axisTick,
          },
          series: [
            {
              name: "brut",
              type: "line",
              data: returnData.map(d => d.brut),
              lineStyle: { color: tc.navy, width: 2 },
              itemStyle: { color: tc.navy },
              symbol: "circle",
              symbolSize: 6,
              connectNulls: true,
            },
            ...(isAbelFont ? [{
              name: "net",
              type: "line",
              data: returnData.map(d => d.net),
              lineStyle: { color: tc.green, width: 2 },
              itemStyle: { color: tc.green },
              symbol: "circle",
              symbolSize: 6,
              connectNulls: true,
            }] : []),
            {
              name: "_zero",
              type: "line",
              data: returnData.map(() => 0),
              symbol: "none",
              silent: true,
              lineStyle: { opacity: 0 },
              markLine: {
                symbol: "none",
                data: [{ yAxis: 0 }],
                lineStyle: { color: tc.border, width: 1 },
                label: { show: false },
              },
            },
          ],
        }}
      />
    </>
  );
}
