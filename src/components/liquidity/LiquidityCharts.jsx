import ReactECharts from "../../ReactECharts.jsx";
import { fmtM } from "../../utils.js";
import { CHART_PALETTE, NEUTRAL } from "../../chartColors.js";
import { ecTheme } from "../../echartsTheme.js";
import { buildLiquiditySummary, buildLiquidityByBank, buildLiquidityByCurrency, buildLiquidityTrend } from "../../data/liquidityModel.js";

const SECTION_LABELS = {
  alternatives: "Alternatius",
  "real-estate": "Real Estate",
  "mercats-publics": "Mercats Públics",
};

function EmptyState({ tc, label = "Sense dades" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, color: tc.textLight, fontSize: 13 }}>
      {label}
    </div>
  );
}

function ChartCard({ tc, title, children }) {
  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "18px 20px", boxShadow: tc.shadows?.card ?? "0 2px 12px rgba(0,0,0,.06)" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.11em", color: tc.textLight, textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>{title}</div>
      {children}
    </div>
  );
}

function DonutChart({ data, total, tc }) {
  const t = ecTheme(tc);
  return (
    <ReactECharts
      style={{ width: "100%", height: 260 }}
      opts={{ renderer: "canvas" }}
      option={{
        tooltip: {
          ...t.tooltip, trigger: "item",
          formatter: (p) => `<b>${p.name}</b><br/>${fmtM(p.value)}<br/>${p.percent}%`,
        },
        legend: { show: false },
        graphic: [{
          type: "group", left: "center", top: "middle",
          children: [
            { type: "text", style: { text: fmtM(total), x: 0, y: -7, textAlign: "center", fill: tc.navy, fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" } },
            { type: "text", style: { text: "Total", x: 0, y: 10, textAlign: "center", fill: tc.textLight, fontSize: 9 } },
          ],
        }],
        series: [{
          type: "pie", radius: ["48%", "76%"], center: ["50%", "50%"],
          selectedMode: false, labelLine: { show: false },
          label: {
            show: true,
            formatter: (p) => (p.percent < 5 ? "" : `${p.name} ${Math.round(p.percent)}%`),
            fontSize: 11, color: tc.textMid,
          },
          data: data.map((row, i) => ({
            name: row.name, value: row.value,
            itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] },
          })),
        }],
      }}
    />
  );
}

export function LiquiditySectionDonut({ accounts, tc }) {
  const { total, bySection } = buildLiquiditySummary(accounts);
  const data = Object.entries(bySection)
    .filter(([, value]) => value > 0)
    .map(([section, value]) => ({ name: SECTION_LABELS[section] ?? section, value }));

  return (
    <ChartCard tc={tc} title="Per Secció">
      {data.length === 0 ? <EmptyState tc={tc} /> : <DonutChart data={data} total={total} tc={tc} />}
    </ChartCard>
  );
}

export function LiquidityCurrencyDonut({ accounts, tc }) {
  const byCurrency = buildLiquidityByCurrency(accounts);
  const total = byCurrency.reduce((sum, row) => sum + row.total, 0);
  const data = byCurrency
    .filter((row) => row.total > 0)
    .map((row) => ({ name: row.divisa, value: row.total }));

  return (
    <ChartCard tc={tc} title="Per Divisa (EUR eq.)">
      {data.length === 0 ? <EmptyState tc={tc} /> : <DonutChart data={data} total={total} tc={tc} />}
    </ChartCard>
  );
}

export function LiquidityBankBar({ accounts, tc }) {
  const byBank = buildLiquidityByBank(accounts).filter((row) => row.total > 0);
  const t = ecTheme(tc);

  return (
    <ChartCard tc={tc} title="Per Banc">
      {byBank.length === 0 ? (
        <EmptyState tc={tc} />
      ) : (
        <ReactECharts
          style={{ width: "100%", height: 260 }}
          opts={{ renderer: "canvas" }}
          option={{
            grid: { top: 12, right: 20, bottom: 12, left: 12, containLabel: true },
            tooltip: {
              ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" },
              formatter: (params) => {
                const item = params?.[0];
                if (!item) return "";
                return `<b>${item.axisValue}</b><br/>${item.marker}${fmtM(item.value)}`;
              },
            },
            xAxis: {
              type: "value", axisLine: { show: false }, axisTick: { show: false },
              axisLabel: { color: tc.textLight, fontSize: 10, formatter: (v) => fmtM(v) },
              splitLine: { lineStyle: { color: tc.border } },
            },
            yAxis: {
              type: "category", data: [...byBank].reverse().map((row) => row.banc),
              axisLine: { show: false }, axisTick: { show: false },
              axisLabel: { color: tc.textLight, fontSize: 10 },
            },
            series: [{
              type: "bar",
              data: [...byBank].reverse().map((row, i) => ({
                value: row.total,
                itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] ?? NEUTRAL, borderRadius: [0, 4, 4, 0] },
              })),
              barMaxWidth: 26,
              label: { show: true, position: "right", color: tc.textMid, fontSize: 10, formatter: ({ value }) => fmtM(value) },
            }],
          }}
        />
      )}
    </ChartCard>
  );
}

export function LiquidityTrendChart({ registry, balances, tc }) {
  const { months, series } = buildLiquidityTrend(registry, balances);
  const t = ecTheme(tc);

  return (
    <ChartCard tc={tc} title="Evolució de la Liquiditat">
      {months.length === 0 ? (
        <EmptyState tc={tc} />
      ) : (
        <ReactECharts
          style={{ width: "100%", height: 300 }}
          opts={{ renderer: "canvas" }}
          option={{
            grid: { top: 16, right: 20, bottom: 24, left: 12, containLabel: true },
            tooltip: {
              ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" },
              formatter: (params) => {
                if (!params?.length) return "";
                const rows = params
                  .map((p) => `${p.marker}${p.seriesName}: ${fmtM(p.value)}`)
                  .join("<br/>");
                return `<b>${params[0].axisValue}</b><br/>${rows}`;
              },
            },
            legend: {
              show: true, bottom: 0, textStyle: { color: tc.textMid, fontSize: 10 },
              data: series.map((s) => SECTION_LABELS[s.section] ?? s.section),
            },
            xAxis: {
              type: "category", data: months, boundaryGap: false,
              axisLine: { lineStyle: { color: tc.border } }, axisTick: { show: false },
              axisLabel: { color: tc.textLight, fontSize: 10 },
            },
            yAxis: {
              type: "value", axisLine: { show: false }, axisTick: { show: false },
              axisLabel: { color: tc.textLight, fontSize: 10, formatter: (v) => fmtM(v) },
              splitLine: { lineStyle: { color: tc.border } },
            },
            series: series.map((s, i) => ({
              name: SECTION_LABELS[s.section] ?? s.section,
              type: "line", stack: "total", areaStyle: { opacity: 0.75 },
              smooth: false, showSymbol: false,
              lineStyle: { width: 1.5 },
              itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] ?? NEUTRAL },
              data: s.values,
            })),
          }}
        />
      )}
    </ChartCard>
  );
}

export function LiquidityCharts({ accounts, tc }) {
  return (
    <>
      <LiquiditySectionDonut accounts={accounts} tc={tc} />
      <LiquidityBankBar accounts={accounts} tc={tc} />
      <LiquidityCurrencyDonut accounts={accounts} tc={tc} />
    </>
  );
}
