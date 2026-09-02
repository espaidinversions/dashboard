import { fmtM } from "../../utils.js";

// Builds the ECharts option for a pipeline donut/pie chart. All inputs are
// passed in verbatim from the closure state so behavior matches the inline
// config exactly.
export function buildPipelinePieOption({ data, colors, type, t, TC, chartF, isHl }) {
  return {
    tooltip: {
      ...t.tooltip,
      trigger: "item",
      formatter: p => `<b>${p.name}</b><br/>${fmtM(p.value)} · ${p.percent.toFixed(1)}%`,
    },
    legend: { show: false },
    graphic: [{
      type: "group",
      left: "center",
      top: "middle",
      children: [
        { type: "text", style: { text: fmtM(data.reduce((s, r) => s + r.value, 0)), x: 0, y: -7, textAlign: "center", fill: TC.navy, fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace" } },
        { type: "text", style: { text: "Total", x: 0, y: 9, textAlign: "center", fill: TC.textLight, fontSize: 9 } },
      ],
    }],
    series: [{
      type: "pie",
      radius: ["46%", "72%"],
      center: ["50%", "50%"],
      labelLine: { show: false },
      label: {
        show: true,
        formatter: p => (p.percent >= 6 ? `${p.name} ${p.percent.toFixed(0)}%` : ""),
        color: TC.textMid,
        fontSize: 10,
      },
      data: data.map(e => ({
        name: e.name,
        value: e.value,
        itemStyle: {
          color: colors[e.name] || TC.navyLight,
          opacity: isHl(type, e.name) ? 1 : 0.3,
          borderColor: chartF?.type === type && chartF?.value === e.name ? "#fff" : "transparent",
          borderWidth: 2,
        },
      })),
    }],
  };
}

// Builds the ECharts option for the "Per Sector" horizontal bar chart.
export function buildPipelineSectorBarOption({ bySec, t, TC, SECCOL, isHl }) {
  return {
    grid: { top: 8, right: 14, bottom: 8, left: 0, containLabel: true },
    tooltip: {
      ...t.tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: params => {
        const p = params?.[0];
        if (!p) return "";
        return `<b>${p.name}</b><br/>${fmtM(p.value)}`;
      },
    },
    xAxis: {
      type: "value",
      axisLabel: { ...t.axisLabel, fontSize: 10 },
      splitLine: { show: false },
      axisLine: t.axisLine,
      axisTick: t.axisTick,
    },
    yAxis: {
      type: "category",
      data: bySec.map(d => d.name),
      axisLabel: { ...t.axisLabel, fontSize: 10 },
      axisLine: t.axisLine,
      axisTick: t.axisTick,
    },
    series: [{
      type: "bar",
      data: bySec.map(d => ({
        value: d.value,
        itemStyle: { color: SECCOL[d.name] || TC.navy, opacity: isHl("sec", d.name) ? 1 : 0.3, borderRadius: [0, 4, 4, 0] },
      })),
      barMaxWidth: 22,
    }],
  };
}
