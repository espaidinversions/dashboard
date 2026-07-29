import { useState } from "react";
import ReactECharts from "../../ReactECharts.jsx";
import { ecTheme } from "../../echartsTheme.js";
import { TC_LIGHT } from "../../theme.js";
import { SectionHeader } from "../SharedComponents.jsx";

export function ResumTab({
  tc = TC_LIGHT,
  byFy = [],
  byEst = [],
  estCfg = {},
  byGeo = [],
  bySector = [],
  bySectorFy = { fys: [], sectors: [], pct: {}, eur: {} },
  allocationBreakdowns = null,
  geoCfg = {},
  sectorCfg = {},
}) {
  const [allocationMetric, setAllocationMetric] = useState("called");
  const fallbackBreakdowns = {
    called: { byEst, byGeo, bySector, bySectorFy },
  };
  const metricBreakdowns = allocationBreakdowns ?? fallbackBreakdowns;
  const selected = metricBreakdowns[allocationMetric] ?? fallbackBreakdowns.called;
  const metricLabel = METRIC_LABELS[allocationMetric] ?? METRIC_LABELS.called;
  const metricToggle = (
    <div style={{ display: "inline-flex", border: `1px solid ${tc.border}`, borderRadius: 8, overflow: "hidden", background: tc.bg }}>
      {METRIC_OPTIONS.map((option, i) => {
        const active = allocationMetric === option.key;
        return (
          <button
            key={option.key}
            onClick={() => setAllocationMetric(option.key)}
            style={{
              border: "none",
              borderRight: i < METRIC_OPTIONS.length - 1 ? `1px solid ${tc.border}` : "none",
              background: active ? tc.navy : "transparent",
              color: active ? "#fff" : tc.textMid,
              padding: "5px 11px",
              fontSize: 12,
              fontWeight: active ? 700 : 600,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="surface-card" style={{ padding: "20px 22px", marginBottom: 18 }}>
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
      <div className="surface-card" style={{ padding: "18px 22px", marginBottom: 18 }}>
        <SectionHeader title="Distribució per mètrica" tc={tc} action={metricToggle} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {[
            { title: `${metricLabel} per Tipus de Vehicle`, data: selected.byEst, colorFn: n => estCfg[n]?.color || tc.navy },
            { title: `${metricLabel} per Sector`, data: selected.bySector, colorFn: n => sectorCfg[n]?.color || tc.navy },
            { title: `${metricLabel} per Geografia`, data: selected.byGeo, colorFn: n => geoCfg[n]?.color || tc.navy },
          ].filter(ch => ch.data && ch.data.length).map((ch, i) => (
            <div key={i} style={{ minWidth: 0 }}>
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
      </div>
      {selected.bySectorFy?.fys?.length > 0 && selected.bySectorFy?.sectors?.length > 0 && (
        <div className="surface-card" style={{ padding: "20px 22px", marginBottom: 18 }}>
          <SectionHeader title={`Mix de Sector per Any Fiscal · ${metricLabel}`} tc={tc} action={metricToggle} />
          {(() => {
            const t = ecTheme(tc);
            const { fys, sectors, pct, eur } = selected.bySectorFy;
            const option = {
              grid: { top: 8, right: 8, bottom: 40, left: 0, containLabel: true },
              tooltip: {
                ...t.tooltip,
                trigger: "axis",
                axisPointer: { type: "shadow" },
                formatter: (ps) => {
                  const i = ps[0].dataIndex;
                  const lines = ps
                    .filter(p => p.value > 0)
                    .sort((a, b) => b.value - a.value)
                    .map(p => `${p.marker}${p.seriesName}: ${(+p.value).toFixed(1)}% (${fmtS(eur[p.seriesName]?.[i] || 0)})`);
                  return `<strong>FY ${fys[i]}</strong><br/>${lines.join("<br/>")}`;
                },
              },
              legend: { bottom: 0, type: "scroll", textStyle: { fontSize: 10, color: tc.textLight } },
              xAxis: {
                type: "category",
                data: fys,
                axisLabel: { ...t.axisLabel, fontSize: 12 },
                axisLine: t.axisLine,
                axisTick: t.axisTick,
              },
              yAxis: {
                type: "value",
                max: 100,
                axisLabel: { ...t.axisLabel, formatter: v => v + "%" },
                splitLine: t.splitLine,
                axisLine: t.axisLine,
                axisTick: t.axisTick,
              },
              series: sectors.map((s) => ({
                name: s,
                type: "bar",
                stack: "sector",
                data: pct[s],
                itemStyle: { color: sectorCfg[s]?.color || tc.navy },
                barMaxWidth: 40,
                emphasis: { focus: "series" },
              })),
            };
            return <ReactECharts option={option} style={{ width: "100%", height: 300 }} opts={{ renderer: "canvas" }} />;
          })()}
        </div>
      )}
    </>
  );
}

const METRIC_OPTIONS = [
  { key: "committed", label: "Compromès" },
  { key: "called", label: "Cridat" },
  { key: "returned", label: "Retornat" },
];

const METRIC_LABELS = {
  committed: "Capital Compromès",
  called: "Capital Cridat",
  returned: "Capital Retornat",
};

function fmtS(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M€";
  if (a >= 1e3) return (n / 1e3).toFixed(0) + "K€";
  return n.toFixed(0) + "€";
}
