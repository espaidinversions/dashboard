import React from "react";
import ReactECharts from "../../ReactECharts.jsx";
import { ecTheme } from "../../echartsTheme.js";
import { fmtM, fmtMonthKey } from "../../utils.js";
import { CumulativeFlowsChart } from "../CumulativeFlowsChart.jsx";
import { FilterPills } from "./PublicMarketsFilters.jsx";
import { AREA_COLORS, KpiCard, MGR_COLORS, pctFmt } from "./PublicMarketsShared.jsx";
import { SectionHeader } from "../SharedComponents.jsx";

const _cy = new Date().getFullYear();

export function PublicMarketsSummarySection({
  tc,
  dark,
  card,
  secLabel,
  total,
  bucketValues = {},
  ytdWeighted,
  portfolioTWR,
  portfolioMWR,
  providerData,
  strategyData,
  displayManagers,
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

      {/* ── Monthly cumulative YTD returns ───────────────────────────────── */}
      {currentYearMonthlyReturns.length > 0 && (() => {
        const theme = ecTheme(tc);
        const lastRet = currentYearMonthlyReturns[currentYearMonthlyReturns.length - 1]?.ret;
        const retColor = lastRet == null ? tc.textLight : lastRet >= 0 ? tc.green : "#B52020";
        const option = {
          grid: { top: 8, right: 16, bottom: 32, left: 0, containLabel: true },
          tooltip: {
            ...theme.tooltip,
            trigger: "axis",
            formatter: (params) => {
              const p = params[0];
              if (!p || p.value == null) return "";
              const sign = p.value >= 0 ? "+" : "";
              return `<div style="font-weight:600">${fmtMonthKey(p.axisValue)}</div><div>${p.marker}Cartera: ${sign}${p.value.toFixed(2)}%</div>`;
            },
          },
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
          series: [{
            name: "Retorn acumulat",
            type: "line",
            data: currentYearMonthlyReturns.map(d => d.ret),
            lineStyle: { color: retColor, width: 2.5 },
            itemStyle: { color: retColor },
            areaStyle: {
              color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [{ offset: 0, color: `${retColor}30` }, { offset: 1, color: `${retColor}05` }] },
            },
            symbol: "circle",
            symbolSize: 7,
            markLine: {
              data: [{ yAxis: 0 }],
              lineStyle: { color: tc.border, type: "dashed", width: 1 },
              symbol: "none",
              label: { show: false },
            },
          }],
        };
        return (
          <div style={card}>
            <div style={{ ...secLabel, marginBottom: 16 }}>Retorn acumulat {_cy} — per mes</div>
            <ReactECharts option={option} style={{ width: "100%", height: 200 }} opts={{ renderer: "canvas" }} />
            <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
              Retorn acumulat des del desembre {_cy - 1}. Inclou CaixaBank, UBS i Bankinter+IB (abelBK). Excl. Andbank i JPMorgan.
            </div>
          </div>
        );
      })()}

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ ...card, flex: "1 1 58%" }}>
          <div style={{ ...secLabel, marginBottom: 16 }}>Rendiment MWR per Any i Proveïdor</div>
          {(() => {
            const theme = ecTheme(tc);
            const option = {
              grid: { top: 8, right: 16, bottom: 40, left: 0, containLabel: true },
              tooltip: {
                ...theme.tooltip,
                trigger: "axis",
                formatter: (params) => {
                  const label = params[0]?.axisValue ?? "";
                  let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
                  params.forEach((param) => {
                    if (param.value == null) return;
                    html += `<div>${param.marker}${param.seriesName}: ${pctFmt(param.value)}</div>`;
                  });
                  return html;
                },
              },
              legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
              xAxis: {
                type: "category",
                data: providerData.map((point) => point.year),
                axisLabel: { fontSize: 11, color: tc.textLight },
                axisLine: { show: false },
                axisTick: { show: false },
              },
              yAxis: {
                type: "value",
                axisLabel: { fontSize: 10, color: tc.textLight, formatter: (value) => `${value.toFixed(1)}%` },
                splitLine: { lineStyle: { color: tc.border } },
                axisLine: { show: false },
                axisTick: { show: false },
              },
              series: displayManagers.map((manager, index) => ({
                name: manager.nom,
                type: "bar",
                data: providerData.map((point) => point[manager.id] ?? null),
                itemStyle: { color: MGR_COLORS[manager.id], borderRadius: [3, 3, 0, 0] },
                barMaxWidth: 28,
                markLine: index === 0
                  ? {
                      data: [{ yAxis: 0 }],
                      lineStyle: { color: tc.border, type: "dashed", width: 1 },
                      symbol: "none",
                      label: { show: false },
                    }
                  : undefined,
              })),
            };
            return <ReactECharts option={option} style={{ width: "100%", height: 240 }} opts={{ renderer: "canvas" }} />;
          })()}
          <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
            TWR reportat per cada gestor a partir dels snapshots mensuals del model. Les barres absents indiquen que el gestor no ha reportat rendiment per al període.
          </div>
        </div>

        <div style={{ ...card, flex: "1 1 38%" }}>
          <div style={{ ...secLabel, marginBottom: 16 }}>Rendiment ponderat per Estratègia</div>
          {(() => {
            const theme = ecTheme(tc);
            const option = {
              grid: { top: 8, right: 16, bottom: 40, left: 0, containLabel: true },
              tooltip: {
                ...theme.tooltip,
                trigger: "axis",
                formatter: (params) => {
                  const label = params[0]?.axisValue ?? "";
                  let html = `<div style="font-weight:600;margin-bottom:4px">${label}</div>`;
                  params.forEach((param) => {
                    if (param.value == null) return;
                    html += `<div>${param.marker}${param.seriesName}: ${pctFmt(param.value)}</div>`;
                  });
                  return html;
                },
              },
              legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
              xAxis: {
                type: "category",
                data: strategyData.map((point) => point.year),
                axisLabel: { fontSize: 11, color: tc.textLight },
                axisLine: { show: false },
                axisTick: { show: false },
              },
              yAxis: {
                type: "value",
                axisLabel: { fontSize: 10, color: tc.textLight, formatter: (value) => `${value.toFixed(1)}%` },
                splitLine: { lineStyle: { color: tc.border } },
                axisLine: { show: false },
                axisTick: { show: false },
              },
              series: [
                {
                  name: "Renda Variable",
                  type: "line",
                  data: strategyData.map((point) => point.rv),
                  lineStyle: { color: tc.navy, width: 2 },
                  itemStyle: { color: tc.navy },
                  symbol: "circle",
                  symbolSize: 8,
                  connectNulls: true,
                },
                {
                  name: "Renda Fixa",
                  type: "line",
                  data: strategyData.map((point) => point.rf),
                  lineStyle: { color: "#E8A020", width: 2 },
                  itemStyle: { color: "#E8A020" },
                  symbol: "circle",
                  symbolSize: 8,
                  connectNulls: true,
                },
                {
                  name: "Total",
                  type: "line",
                  data: strategyData.map((point) => point.total),
                  lineStyle: { color: tc.green, width: 2, type: "dashed" },
                  itemStyle: { color: tc.green },
                  symbol: "circle",
                  symbolSize: 8,
                  connectNulls: true,
                },
              ],
            };
            return <ReactECharts option={option} style={{ width: "100%", height: 240 }} opts={{ renderer: "canvas" }} />;
          })()}
          <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
            Ponderat per AUM de cada gestor. Gestors sense dades del any exclosos del còmput.
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
          <div style={{ ...secLabel, flex: 1 }}>Evolució del Patrimoni</div>
          <FilterPills
            options={[
              { id: "total", label: "Total" },
              { id: "actiu", label: "Per Actiu" },
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
          } else if (chartView === "actiu") {
            series = [
              {
                name: "Renda Variable",
                type: "line",
                smooth: false,
                stack: "a",
                data: chartData.map((row) => row.rv ?? null),
                lineStyle: { color: AREA_COLORS.rv, width: 1.5 },
                itemStyle: { color: AREA_COLORS.rv },
                areaStyle: gradArea(AREA_COLORS.rv),
                symbol: "none",
                connectNulls: true,
              },
              {
                name: "Renda Fixa",
                type: "line",
                smooth: false,
                stack: "a",
                data: chartData.map((row) => row.rf ?? null),
                lineStyle: { color: AREA_COLORS.rf, width: 1.5 },
                itemStyle: { color: AREA_COLORS.rf },
                areaStyle: gradArea(AREA_COLORS.rf),
                symbol: "none",
                connectNulls: true,
              },
              {
                name: "Altres / no assignat",
                type: "line",
                smooth: false,
                stack: "a",
                data: chartData.map((row) => row.altres ?? null),
                lineStyle: { color: AREA_COLORS.altres, width: 1.5 },
                itemStyle: { color: AREA_COLORS.altres },
                areaStyle: gradArea(AREA_COLORS.altres),
                symbol: "none",
                connectNulls: true,
              },
            ];
          } else {
            series = [
              { key: "andbank", name: "WAM–Andbank" },
              { key: "interactiveBrokers", name: "Interactive Brokers" },
              { key: "bankinter", name: "Bankinter" },
              { key: "ubs", name: "UBS" },
              { key: "creditSuisse", name: "Credit Suisse" },
              { key: "caixa", name: "CaixaBank" },
              { key: "jpmorgan", name: "JPMorgan" },
              { key: "altres", name: "Altres / no assignat" },
            ]
              .filter(({ key }) => chartData.some((row) => row[key] != null && row[key] > 0))
              .map(({ key, name }) => ({
              name,
              type: "line",
              smooth: false,
              stack: "g",
              data: chartData.map((row) => row[key] ?? null),
              lineStyle: { color: AREA_COLORS[key], width: 1.5 },
              itemStyle: { color: AREA_COLORS[key] },
              areaStyle: gradArea(AREA_COLORS[key]),
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
            ? "CaixaBank, UBS, Bankinter, Interactive Brokers, JPMorgan i WAM–Andbank per separat. Les sèries es reconstrueixen des de participacions i preus històrics."
            : chartView === "total"
              ? "Sèrie històrica reconstruïda a partir de participacions i NAV històrics, amb fallback a valors importats quan falta preu."
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
              { id: "total", label: "Total" },
              { id: "assetType", label: "Per Actiu" },
              { id: "custodian", label: "Per Custodi" },
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
          height={240}
        />
        <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
          Capital acumulat brut des de la primera mostra mensual: barres d'entrades i sortides de capital, amb línia de patrimoni mensual i línia agregada de capital. UBS i WAM–Andbank mostren les posicions dels PDFs, però no els moviments individuals.
        </div>
      </div>
    </>
  );
}
