import React from "react";
import ReactECharts from "../../ReactECharts.jsx";
import { ecTheme } from "../../echartsTheme.js";
import { TC_LIGHT } from "../../theme.js";
import { SectionHeader } from "../SharedComponents.jsx";

export function ResumTab({
  tc = TC_LIGHT,
  byFy = [],
  byVcpe = [],
  byEst = [],
  vcpeCfg = {},
  estCfg = {},
}) {
  return (
    <>
      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 22px", marginBottom: 18, boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
        <SectionHeader title="Capital Cridat vs. Retornat per Any Fiscal" tc={tc} />
        {(() => {
          const t = ecTheme(tc);
          const option = {
            grid: { top: 8, right: 8, bottom: 40, left: 0, containLabel: true },
            tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
            legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
            xAxis: {
              type: "category",
              data: byFy.map(d => d.fy),
              axisLabel: { ...t.axisLabel, fontSize: 12 },
              axisLine: t.axisLine,
              axisTick: t.axisTick,
            },
            yAxis: {
              type: "value",
              axisLabel: { ...t.axisLabel, formatter: v => fmtS(v) },
              splitLine: t.splitLine,
              axisLine: t.axisLine,
              axisTick: t.axisTick,
            },
            series: [
              { name: "Capital Call",   type: "bar", data: byFy.map(d => d["Capital Call"]),   itemStyle: { color: tc.navy,      borderRadius: [5,5,0,0] }, barMaxWidth: 32 },
              { name: "Distribucions",  type: "bar", data: byFy.map(d => d["Distribucions"]),  itemStyle: { color: tc.green,     borderRadius: [5,5,0,0] }, barMaxWidth: 32 },
            ],
          };
          return <ReactECharts option={option} style={{ width: "100%", height: 280 }} opts={{ renderer: "canvas" }} />;
        })()}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 18 }}>
        {[
          { title: "Capital Cridat per Tipus",      data: byVcpe, colorFn: n => vcpeCfg[n]?.color || tc.navy },
          { title: "Capital Cridat per Estratègia", data: byEst,  colorFn: n => estCfg[n]?.color  || tc.navy },
        ].map((ch, i) => (
          <div key={i} style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "18px 22px", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
            <SectionHeader title={ch.title} tc={tc} />
            {(() => {
              const t = ecTheme(tc);
              const option = {
                tooltip: { ...t.tooltip, trigger: "item", formatter: (p) => `${p.marker}${p.name}: ${p.percent}%` },
                legend: { orient: "vertical", right: 8, top: "center", textStyle: { fontSize: 10, color: tc.textLight } },
                series: [{
                  type: "pie",
                  radius: ["38%", "68%"],
                  center: ["38%", "50%"],
                  data: ch.data.map(d => ({ name: d.name, value: d.value, itemStyle: { color: ch.colorFn(d.name) } })),
                  label: { show: false },
                  emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.15)" } },
                }],
              };
              return <ReactECharts option={option} style={{ width: "100%", height: 220 }} opts={{ renderer: "canvas" }} />;
            })()}
          </div>
        ))}
      </div>
    </>
  );
}

function fmtS(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M€";
  if (a >= 1e3) return (n / 1e3).toFixed(0) + "K€";
  return n.toFixed(0) + "€";
}
