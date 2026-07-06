import React from "react";
import ReactECharts from "../../ReactECharts.jsx";
import { ecTheme } from "../../echartsTheme.js";
import { fmtM, fmtMonthKey } from "../../utils.js";
import { CumulativeFlowsChart } from "../CumulativeFlowsChart.jsx";
import { FilterPills } from "./PublicMarketsFilters.jsx";
import { AREA_COLORS, KpiCard, MGR_COLORS, pctFmt } from "./PublicMarketsShared.jsx";
import { SectionHeader } from "../SharedComponents.jsx";

const _cy = new Date().getFullYear();

const PERF_YEARS = [2023, 2024, 2025, 2026];

function PerfCell({ v, tc }) {
  if (v == null) return <td style={{ padding: "8px 12px", textAlign: "right", color: tc.textLight, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>—</td>;
  const pos = v > 0.05, neg = v < -0.05;
  const color = pos ? tc.green : neg ? "#B52020" : tc.text;
  const bg    = pos ? (tc.green + "18") : neg ? "#FDECEA" : "transparent";
  return (
    <td style={{ padding: "8px 12px", textAlign: "right" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color, background: bg, borderRadius: 4, padding: "2px 7px", fontFamily: "'DM Mono',monospace" }}>
        {pos ? "+" : ""}{v.toFixed(2)}%
      </span>
    </td>
  );
}

export function PublicMarketsSummarySection({
  tc,
  dark,
  card,
  secLabel,
  total,
  bucketValues = {},
  bucketReturns = [],
  ytdWeighted,
  portfolioTWR,
  portfolioMWR,
  chartView,
  setChartView,
  chartData,
  flowGroupBy,
  setFlowGroupBy,
  totalValueSeries,
  reportStartMonth,
  transactions,
  currentYearMonthlyReturns = [],
}) {
  const pctSub = (v) => total > 0 && v > 0 ? `${(v / total * 100).toFixed(1)}% del total` : "—";
  return (
    <>
      <SectionHeader title="Resum" tc={tc} />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard label="Total Patrimoni" value={fmtM(total)} sub="Mercats Públics" tc={tc} hero />
        <KpiCard label="YTD Global" value={pctFmt(ytdWeighted)} sub="Ponderat per AUM" tc={tc} valueColor={ytdWeighted >= 0 ? tc.green : tc.red} />
        <KpiCard label={`TWR Cartera (${fmtMonthKey(reportStartMonth)})`} value={pctFmt(portfolioTWR)} sub="Retorn acumulat, sense fluxos (excl. Andbank, JPMorgan)" tc={tc} valueColor={portfolioTWR != null ? (portfolioTWR >= 0 ? tc.green : tc.red) : tc.textLight} />
        <KpiCard label={`MWR Cartera (${fmtMonthKey(reportStartMonth)})`} value={pctFmt(portfolioMWR)} sub="Anualitzat, Modified Dietz (excl. Andbank, JPMorgan)" tc={tc} valueColor={portfolioMWR != null ? (portfolioMWR >= 0 ? tc.green : tc.red) : tc.textLight} />
      </div>

      {/* ── Bucket breakdown ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard label="ETFs" value={fmtM(bucketValues.etfs ?? 0)} sub={`${pctSub(bucketValues.etfs ?? 0)} · CaixaBank + Bankinter`} tc={tc} />
        <KpiCard label="Fons Gestió Pròpia CaixaBank" value={fmtM(bucketValues.fgpCaixa ?? 0)} sub={pctSub(bucketValues.fgpCaixa ?? 0)} tc={tc} />
        <KpiCard label="Fons Gestió Pròpia Bankinter" value={fmtM(bucketValues.fgpBankinter ?? 0)} sub={pctSub(bucketValues.fgpBankinter ?? 0)} tc={tc} />
        <KpiCard label="Renda Fixa – WAM" value={fmtM(bucketValues.rfWam ?? 0)} sub={`${pctSub(bucketValues.rfWam ?? 0)} · Andbank`} tc={tc} />
        <KpiCard label="Accions – IB" value={fmtM(bucketValues.accionsIB ?? 0)} sub={`${pctSub(bucketValues.accionsIB ?? 0)} · Interactive Brokers`} tc={tc} />
      </div>

      {/* ── Bucket performance table ──────────────────────────────────────────── */}
      {bucketReturns.length > 0 && (
        <div style={{ ...card, overflowX: "auto" }}>
          <div style={{ ...secLabel, marginBottom: 14 }}>Rendiment per Categoria</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${tc.border}` }}>
                <th style={{ padding: "6px 12px", textAlign: "left", fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600 }}>Categoria</th>
                {PERF_YEARS.map(y => (
                  <th key={y} style={{ padding: "6px 12px", textAlign: "right", fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600 }}>{y}</th>
                ))}
                <th style={{ padding: "6px 12px", textAlign: "right", fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600 }}>Des d&apos;inici</th>
              </tr>
            </thead>
            <tbody>
              {bucketReturns.map((b, i) => (
                <tr key={b.id} style={{ borderBottom: `1px solid ${tc.border}`, background: i % 2 === 1 ? (dark ? tc.bgAlt : "#f8f9fb") : "transparent" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 500, color: tc.text, whiteSpace: "nowrap" }}>{b.label}</td>
                  {PERF_YEARS.map(y => <PerfCell key={y} v={b.years[y]} tc={tc} />)}
                  <PerfCell v={b.inici} tc={tc} />
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
            Retorn anual ponderat per valor de mercat. WAM: retorn acumulat 2026. Des d&apos;inici: retorn total acumulat.
          </div>
        </div>
      )}

      {/* ── Monthly cumulative YTD returns per bucket ────────────────────── */}
      {currentYearMonthlyReturns.length > 0 && (() => {
        const theme = ecTheme(tc);
        const BUCKETS = [
          { key: "etfs", name: "ETFs",    color: "#2B5070" },
          { key: "cb",   name: "Fons CB", color: "#4A90D9" },
          { key: "bk",   name: "Fons BK", color: "#7FB3E0" },
          { key: "wam",  name: "WAM",     color: "#E8A020" },
          { key: "ib",   name: "IB",      color: "#28A029" },
        ];
        const series = [
          ...BUCKETS.map(b => ({
            name: b.name,
            type: "line",
            data: currentYearMonthlyReturns.map(d => d[b.key] ?? null),
            lineStyle: { color: b.color, width: 1.8 },
            itemStyle: { color: b.color },
            symbol: "circle",
            symbolSize: 5,
            connectNulls: false,
          })),
          {
            name: "Total",
            type: "line",
            data: currentYearMonthlyReturns.map(d => d.total ?? null),
            lineStyle: { color: tc.textLight, width: 2.5, type: "dashed" },
            itemStyle: { color: tc.textLight },
            symbol: "circle",
            symbolSize: 6,
            connectNulls: false,
            markLine: {
              data: [{ yAxis: 0 }],
              lineStyle: { color: tc.border, type: "solid", width: 1 },
              symbol: "none",
              label: { show: false },
            },
          },
        ];
        const option = {
          grid: { top: 8, right: 16, bottom: 56, left: 0, containLabel: true },
          tooltip: {
            ...theme.tooltip,
            trigger: "axis",
            formatter: (params) => {
              const p0 = params[0];
              if (!p0) return "";
              let html = `<div style="font-weight:600;margin-bottom:4px">${fmtMonthKey(p0.axisValue)}</div>`;
              params.forEach(p => {
                if (p.value == null) return;
                const sign = p.value >= 0 ? "+" : "";
                html += `<div>${p.marker}${p.seriesName}: ${sign}${p.value.toFixed(2)}%</div>`;
              });
              return html;
            },
          },
          legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
          xAxis: {
            type: "category",
            data: currentYearMonthlyReturns.map(d => d.date),
            axisLabel: { fontSize: 10, color: tc.textLight, formatter: fmtMonthKey },
            axisLine: { show: false },
            axisTick: { show: false },
          },
          yAxis: {
            type: "value",
            axisLabel: { fontSize: 10, color: tc.textLight, formatter: v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` },
            splitLine: { lineStyle: { color: tc.border } },
            axisLine: { show: false },
            axisTick: { show: false },
          },
          series,
        };
        return (
          <div style={card}>
            <div style={{ ...secLabel, marginBottom: 16 }}>Retorn acumulat {_cy} — per mes</div>
            <ReactECharts option={option} style={{ width: "100%", height: 260 }} opts={{ renderer: "canvas" }} />
            <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
              Retorn acumulat des del desembre {_cy - 1}. ETFs/Fons CB/BK: sèries de preus × participacions. WAM i IB: valor agregat mensual (IB ajustat TWR per fluxos).
            </div>
          </div>
        );
      })()}

      {bucketReturns.length > 0 && (() => {
        const BUCKET_COLORS = {
          "etfs":          "#2B5070",
          "fgp-caixa":     "#4A90D9",
          "fgp-bankinter": "#7FB3E0",
          "rf-wam":        "#E8A020",
          "accions-ib":    "#28A029",
        };
        const STRATEGY_COLORS = { rf: "#E8A020", etfs: "#2B5070", accions: "#28A029", fgp: "#4A90D9" };
        const years = PERF_YEARS.map(String);

        const mkBarOpt = (theme, series) => ({
          grid: { top: 8, right: 16, bottom: 40, left: 0, containLabel: true },
          tooltip: {
            ...theme.tooltip, trigger: "axis",
            formatter: (params) => {
              const html = [`<div style="font-weight:600;margin-bottom:4px">${params[0]?.axisValue}</div>`];
              params.forEach(p => { if (p.value != null) html.push(`<div>${p.marker}${p.seriesName}: ${p.value >= 0 ? "+" : ""}${p.value.toFixed(2)}%</div>`); });
              return html.join("");
            },
          },
          legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
          xAxis: { type: "category", data: years, axisLabel: { fontSize: 11, color: tc.textLight }, axisLine: { show: false }, axisTick: { show: false } },
          yAxis: { type: "value", axisLabel: { fontSize: 10, color: tc.textLight, formatter: v => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%` }, splitLine: { lineStyle: { color: tc.border } }, axisLine: { show: false }, axisTick: { show: false } },
          series,
        });

        const catSeries = bucketReturns.map(b => ({
          name: b.label,
          type: "bar",
          data: PERF_YEARS.map(y => b.years[y] ?? null),
          itemStyle: { color: BUCKET_COLORS[b.id], borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 20,
          markLine: b.id === "etfs" ? { data: [{ yAxis: 0 }], lineStyle: { color: tc.border, type: "dashed", width: 1 }, symbol: "none", label: { show: false } } : undefined,
        }));

        const rfB      = bucketReturns.find(b => b.id === "rf-wam");
        const etfB     = bucketReturns.find(b => b.id === "etfs");
        const accionsB = bucketReturns.find(b => b.id === "accions-ib");
        const cbFgpB   = bucketReturns.find(b => b.id === "fgp-caixa");
        const bkFgpB   = bucketReturns.find(b => b.id === "fgp-bankinter");
        const cbW      = bucketValues.fgpCaixa ?? 0;
        const bkW      = bucketValues.fgpBankinter ?? 0;
        const fgpCombB = (cbFgpB || bkFgpB) ? {
          id: "fgp",
          years: Object.fromEntries(PERF_YEARS.map(y => {
            const cbV = cbFgpB?.years[y], bkV = bkFgpB?.years[y];
            if (cbV == null && bkV == null) return [y, null];
            const ew = (cbV != null ? cbW : 0) + (bkV != null ? bkW : 0);
            if (ew === 0) return [y, null];
            return [y, ((cbV ?? 0) * (cbV != null ? cbW : 0) + (bkV ?? 0) * (bkV != null ? bkW : 0)) / ew];
          })),
        } : null;
        const stratSeries = [
          { id: "etfs",    name: "ETFs",               src: etfB },
          { id: "fgp",     name: "Fons Gestió Pròpia", src: fgpCombB },
          { id: "rf",      name: "Renda Fixa (WAM)",   src: rfB },
          { id: "accions", name: "Accions (IB)",        src: accionsB },
        ].filter(s => s.src?.years && Object.values(s.src.years).some(v => v != null)).map(s => ({
          name: s.name,
          type: "bar",
          data: PERF_YEARS.map(y => s.src.years[y] ?? null),
          itemStyle: { color: STRATEGY_COLORS[s.id], borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 28,
          markLine: s.id === "etfs" ? { data: [{ yAxis: 0 }], lineStyle: { color: tc.border, type: "dashed", width: 1 }, symbol: "none", label: { show: false } } : undefined,
        }));

        const theme = ecTheme(tc);
        return (
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ ...card, flex: "1 1 58%" }}>
              <div style={{ ...secLabel, marginBottom: 16 }}>Rendiment per Categoria · anual</div>
              <ReactECharts option={mkBarOpt(theme, catSeries)} style={{ width: "100%", height: 240 }} opts={{ renderer: "canvas" }} />
              <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
                Ponderat per valor de mercat. ETFs inclou CaixaBank i Bankinter. WAM: retorn acumulat 2026.
              </div>
            </div>
            <div style={{ ...card, flex: "1 1 38%" }}>
              <div style={{ ...secLabel, marginBottom: 16 }}>Rendiment per Estratègia · anual</div>
              <ReactECharts option={mkBarOpt(theme, stratSeries)} style={{ width: "100%", height: 240 }} opts={{ renderer: "canvas" }} />
              <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
                ETFs = CaixaBank + Bankinter · FGP = fons gestió pròpia CB+BK (ponderat MV) · RF = WAM · Accions = IB.
              </div>
            </div>
          </div>
        );
      })()}

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
          <div style={{ ...secLabel, flex: 1 }}>Evolució del Patrimoni</div>
          <FilterPills
            options={[
              { id: "total", label: "Total" },
              { id: "estrategia", label: "Per Estratègia" },
              { id: "gestor", label: "Per Custodi" },
            ]}
            value={chartView}
            onChange={setChartView}
            tc={tc}
            dark={dark}
            tone="green"
            rounded={5}
          />
        </div>

        {(() => {
          const theme = ecTheme(tc);
          const gradArea = (color) => ({
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${color}40` },
                { offset: 1, color: `${color}0A` },
              ],
            },
          });

          let series = [];
          if (chartView === "total") {
            series = [{
              name: "Valor cartera",
              type: "line",
              smooth: false,
              data: chartData.map((row) => row.total ?? null),
              lineStyle: { color: AREA_COLORS.total, width: 2 },
              itemStyle: { color: AREA_COLORS.total },
              areaStyle: gradArea(AREA_COLORS.total),
              symbol: "none",
              connectNulls: true,
            }];
          } else if (chartView === "estrategia") {
            const ESTRAT = [
              { key: "etfs", name: "ETFs",               color: "#2B5070" },
              { key: "fgp",  name: "Fons Gestió Pròpia", color: "#4A90D9" },
              { key: "wam",  name: "WAM",                color: "#E8A020" },
              { key: "ib",   name: "IB",                 color: "#28A029" },
            ];
            series = ESTRAT
              .filter(({ key }) => chartData.some(row => (row[key] ?? 0) > 0))
              .map(({ key, name, color }) => ({
                name,
                type: "line",
                smooth: false,
                stack: "e",
                data: chartData.map((row) => row[key] ?? null),
                lineStyle: { color, width: 1.5 },
                itemStyle: { color },
                areaStyle: gradArea(color),
                symbol: "none",
                connectNulls: true,
              }));
          } else {
            series = [
              { key: "andbank",            name: "WAM–Andbank",         color: AREA_COLORS.andbank },
              { key: "interactiveBrokers", name: "Interactive Brokers",  color: AREA_COLORS.interactiveBrokers },
              { key: "bankinter",          name: "Bankinter",            color: AREA_COLORS.bankinter },
              { key: "ubs",                name: "UBS",                  color: AREA_COLORS.ubs },
              { key: "caixa",              name: "CaixaBank",            color: AREA_COLORS.caixa },
              { key: "jpmorgan",           name: "JPMorgan",             color: AREA_COLORS.jpmorgan },
              { key: "altres",             name: "Altres / no assignat", color: AREA_COLORS.altres ?? "#B0B8C4" },
            ]
              .filter(({ key }) => chartData.some((row) => row[key] != null && row[key] > 0))
              .map(({ key, name, color }) => ({
              name,
              type: "line",
              smooth: false,
              stack: "g",
              data: chartData.map((row) => row[key] ?? null),
              lineStyle: { color, width: 1.5 },
              itemStyle: { color },
              areaStyle: gradArea(color),
              symbol: "none",
              connectNulls: true,
            }));
          }

          const option = {
            grid: { top: 8, right: 8, bottom: chartView !== "total" ? 48 : 32, left: 0, containLabel: true },
            legend: chartView !== "total"
              ? { bottom: 0, textStyle: { fontSize: 11, color: tc.textLight } }
              : { show: false },
            tooltip: {
              ...theme.tooltip,
              trigger: "axis",
              formatter: (params) => {
                const label = fmtMonthKey(params[0]?.axisValue ?? "");
                let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
                params.forEach((param) => {
                  if (param.value == null) return;
                  html += `<div>${param.marker}${param.seriesName}: ${fmtM(param.value)}</div>`;
                });
                return html;
              },
            },
            xAxis: {
              type: "category",
              data: chartData.map((row) => row.month),
              axisLabel: { fontSize: 10, color: tc.textLight, formatter: fmtMonthKey, hideOverlap: true, interval: 11 },
              axisLine: { show: false },
              axisTick: { show: false },
            },
            yAxis: {
              type: "value",
              axisLabel: { fontSize: 10, color: tc.textLight, formatter: fmtM },
              splitLine: { lineStyle: { color: tc.border } },
              axisLine: { show: false },
              axisTick: { show: false },
            },
            series,
          };

          return <ReactECharts option={option} notMerge={true} style={{ width: "100%", height: 280 }} opts={{ renderer: "canvas" }} />;
        })()}

        <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
          {chartView === "gestor"
            ? "CaixaBank, UBS, Bankinter, Interactive Brokers (derivat d'abelBK), JPMorgan i WAM–Andbank (PM Monthly) per separat."
            : chartView === "total"
              ? "Sèrie històrica reconstruïda a partir de participacions i NAV històrics, amb fallback a valors importats quan falta preu."
              : chartView === "estrategia"
                ? "ETFs i FGP derivats del pes per MV actual × valor custodi mensual. WAM i IB des de PM Monthly (IB = abelBK − Bankinter)."
                : "Sèries mensuals reconstruïdes des de participacions i NAV històrics, amb residual per a posicions no assignades."}
        </div>
      </div>

      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, flex: 1 }}>
            Fluxos acumulats · entrades i sortides de capital
          </div>
          <FilterPills
            options={[
              { id: "position", label: "Per Posició" },
              { id: "custodian", label: "Per Custodi" },
              { id: "assetType", label: "Per Actiu" },
              { id: "total", label: "Total" },
            ]}
            value={flowGroupBy}
            onChange={setFlowGroupBy}
            tc={tc}
            dark={dark}
            tone="navy"
            rounded={5}
          />
        </div>
        <CumulativeFlowsChart
          transactions={transactions}
          valuesSeries={totalValueSeries}
          startMonth={reportStartMonth}
          groupBy={flowGroupBy}
          topN={20}
          height={260}
        />
        <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
          Capital acumulat brut des de la primera mostra mensual: barres d'entrades i sortides de capital, amb línia de patrimoni mensual i línia agregada de capital. UBS i WAM–Andbank mostren les posicions dels PDFs, però no els moviments individuals.
        </div>
      </div>
    </>
  );
}
