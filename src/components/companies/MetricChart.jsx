import ReactECharts from "../../ReactECharts.jsx";
import { ecTheme } from "../../echartsTheme.js";
import { fmtM } from "../../utils.js";

export function MetricChart({ title, data, actualKey, budgetKey, ltmKey, color, view, tc, withMargin }) {
  const isLTM = view === "ltm" && ltmKey != null;
  const activeKey = isLTM ? ltmKey : actualKey;
  const hasBudget = !isLTM && data.some(q => q[budgetKey] != null);
  const marginKey = isLTM ? "ltmMarginPct" : "ebitdaMarginPct";
  const hasMarginData = !!withMargin && data.some(q => q[marginKey] != null);
  const hasData = data.some(q => q[activeKey] != null);
  const t = ecTheme(tc);

  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{title}</span>
        {hasMarginData && <span style={{ color: "#E8A020", fontSize: 10, fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>— Marge %</span>}
      </div>
      {!hasData ? (
        <div style={{ border: `2px dashed ${tc.border}`, borderRadius: 10, padding: "40px 0", textAlign: "center", color: tc.textLight, fontSize: 12 }}>
          Sense dades
        </div>
      ) : (
        <ReactECharts
          style={{ width: "100%", height: 210 }}
          opts={{ renderer: "canvas" }}
          option={{
            grid: { top: 18, right: hasMarginData ? 44 : 8, bottom: 0, left: 0, containLabel: true },
            tooltip: {
              ...t.tooltip,
              trigger: "axis",
              axisPointer: { type: "shadow" },
              formatter: params => {
                const label = params[0]?.axisValue ?? "";
                let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
                params.forEach(p => {
                  if (p.value == null) return;
                  if (p.seriesName === "margin") {
                    html += `<div>${p.marker}Marge EBITDA: ${p.value != null ? `${p.value.toFixed(1)}%` : "—"}</div>`;
                  } else if (p.seriesName === "ltm") {
                    html += `<div>${p.marker}LTM: ${fmtM(p.value)}</div>`;
                  } else if (p.seriesName === "budget") {
                    html += `<div>${p.marker}Pressupost: ${fmtM(p.value)}</div>`;
                  } else {
                    html += `<div>${p.marker}Real: ${fmtM(p.value)}</div>`;
                  }
                });
                return html;
              },
            },
            xAxis: {
              type: "category",
              data: data.map(d => d.q),
              axisLabel: { ...t.axisLabel, fontSize: 9 },
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
              ...(hasMarginData ? [{
                type: "value",
                position: "right",
                axisLabel: { ...t.axisLabel, formatter: v => `${v.toFixed(0)}%` },
                splitLine: { show: false },
                axisLine: t.axisLine,
                axisTick: t.axisTick,
              }] : []),
            ],
            series: [
              {
                name: isLTM ? "ltm" : "actual",
                type: "bar",
                yAxisIndex: 0,
                data: data.map(d => d[activeKey] ?? null),
                itemStyle: { color: isLTM ? "#E8A020" : color, opacity: 1 },
                barMaxWidth: 28,
              },
              ...(hasBudget ? [{
                name: "budget",
                type: "bar",
                yAxisIndex: 0,
                data: data.map(d => d[budgetKey] ?? null),
                itemStyle: { color, opacity: 0.3 },
                barMaxWidth: 28,
              }] : []),
              ...(hasMarginData ? [{
                name: "margin",
                type: "line",
                yAxisIndex: 1,
                data: data.map(d => d[marginKey] ?? null),
                lineStyle: { color: "#E8A020", width: 2 },
                itemStyle: { color: "#E8A020" },
                symbol: "circle",
                symbolSize: 5,
                connectNulls: false,
              }] : []),
            ],
          }}
        />
      )}
    </div>
  );
}
