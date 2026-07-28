import { useState } from "react";
import ReactECharts from "../../ReactECharts.jsx";
import { ecTheme } from "../../echartsTheme.js";
import { TC_LIGHT } from "../../theme.js";
import { SectionHeader } from "../SharedComponents.jsx";
import { useAllocationData } from "../hooks/useAllocationData.js";

/**
 * Asset Allocation Fons — replicates the AUM Summary view from the Allocation
 * workbook. For each dimension (Geography / Vertical / Strategy / Vehicle Class)
 * shows a 100%-stacked composition and an absolute €M companion, cumulative by
 * fiscal year, with a Committed / Called / Returned metric toggle.
 */

const METRICS = [
  { key: "committed", label: "Compromès" },
  { key: "called", label: "Cridat" },
  { key: "returned", label: "Retornat" },
];

const DIMENSIONS = [
  { key: "geography", title: "Per Geografia" },
  { key: "vertical", title: "Per Vertical" },
  { key: "strategy", title: "Per Estratègia" },
  { key: "vehicle", title: "Per Tipus de Vehicle" },
];

// Color maps for the dimensions the app doesn't already theme (geography/vertical
// reuse the caller's geoCfg/sectorCfg). Ordered to match the workbook's series.
const STRATEGY_CFG = {
  "Small Buyout": "#1E3A5F",
  "Mid Buyout": "#2E6FB0",
  "Large Buyout": "#5B9BD5",
  "Growth": "#3AA76D",
  "VC": "#C9822E",
  "Turnaround": "#9B7CC8",
  "Real Estate & Infraestructure": "#6B7280",
};
const VEHICLE_CFG = {
  "Primaris": "#1E3A5F",
  "FoF": "#2E9C8E",
  "Secundaris": "#C9822E",
  "Co-inversions": "#7A5AA6",
};

function fmtS(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M€";
  if (a >= 1e3) return (n / 1e3).toFixed(0) + "K€";
  return n.toFixed(0) + "€";
}

export function AssetAllocationTab({
  tc = TC_LIGHT,
  TRANSACTIONS = [],
  COMPROMISOS = [],
  fundMeta = [],
  excluded,
  geoCfg = {},
  sectorCfg = {},
}) {
  const [metric, setMetric] = useState("committed");
  const { fys, dims } = useAllocationData({ TRANSACTIONS, COMPROMISOS, fundMeta, excluded });

  const colorFor = (dimKey, name) => {
    if (name === "Sense classificar") return tc.textLight;
    if (dimKey === "geography") return geoCfg[name]?.color || tc.navy;
    if (dimKey === "vertical") return sectorCfg[name]?.color || tc.navy;
    if (dimKey === "strategy") return STRATEGY_CFG[name] || tc.navy;
    if (dimKey === "vehicle") return VEHICLE_CFG[name] || tc.navy;
    return tc.navy;
  };

  const stackedOption = (dimKey, block, mode) => {
    const t = ecTheme(tc);
    const { series, pct, eur } = block;
    const isPct = mode === "pct";
    return {
      grid: { top: 8, right: 8, bottom: 40, left: 0, containLabel: true },
      tooltip: {
        ...t.tooltip,
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (ps) => {
          const i = ps[0].dataIndex;
          const lines = ps
            .filter((p) => p.value > 0)
            .sort((a, b) => b.value - a.value)
            .map((p) =>
              isPct
                ? `${p.marker}${p.seriesName}: ${(+p.value).toFixed(1)}% (${fmtS(eur[p.seriesName]?.[i] || 0)})`
                : `${p.marker}${p.seriesName}: ${fmtS(+p.value)}`,
            );
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
        max: isPct ? 100 : undefined,
        axisLabel: { ...t.axisLabel, formatter: (v) => (isPct ? v + "%" : fmtS(v)) },
        splitLine: t.splitLine,
        axisLine: t.axisLine,
        axisTick: t.axisTick,
      },
      series: series.map((s) => ({
        name: s,
        type: "bar",
        stack: "alloc",
        data: (isPct ? pct : eur)[s],
        itemStyle: { color: colorFor(dimKey, s) },
        barMaxWidth: 40,
        emphasis: { focus: "series" },
      })),
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="surface-card" style={{ padding: "16px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, color: tc.navyDark }}>Asset Allocation dels Fons</div>
          <div style={{ fontSize: 12, color: tc.textLight, marginTop: 2 }}>Composició acumulada per any fiscal · distribució ponderada per fons</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                border: `1.5px solid ${metric === m.key ? tc.navy : tc.border}`,
                background: metric === m.key ? tc.navy : "transparent",
                color: metric === m.key ? "#fff" : tc.textMid,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
        {DIMENSIONS.map((dim) => {
          const block = dims[dim.key]?.[metric];
          if (!block || !block.hasData) {
            return (
              <div key={dim.key} className="surface-card" style={{ padding: "18px 22px" }}>
                <SectionHeader title={dim.title} tc={tc} />
                <div style={{ color: tc.textLight, fontSize: 13, padding: "40px 0", textAlign: "center" }}>Sense dades per aquesta mètrica.</div>
              </div>
            );
          }
          return (
            <div key={dim.key} className="surface-card" style={{ padding: "18px 22px" }}>
              <SectionHeader title={dim.title} tc={tc} />
              <div style={{ fontSize: 11, color: tc.textLight, margin: "2px 0 6px" }}>% del total</div>
              <ReactECharts option={stackedOption(dim.key, block, "pct")} style={{ width: "100%", height: 260 }} opts={{ renderer: "canvas" }} />
              <div style={{ fontSize: 11, color: tc.textLight, margin: "10px 0 6px" }}>Import acumulat (€M)</div>
              <ReactECharts option={stackedOption(dim.key, block, "eur")} style={{ width: "100%", height: 220 }} opts={{ renderer: "canvas" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
