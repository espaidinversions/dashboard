import { useLayoutEffect, useRef } from "react";
import { echarts } from "../../echarts.js";
import { ecTheme } from "../../echartsTheme.js";
import { modeValue, fmtK, periodOf } from "./prospectiveUtils.js";

function periodColor(tc, year) {
  const period = periodOf(year);
  if (period === "closed") return tc.green;
  if (period === "current") return tc.warning;
  return tc.textLight;
}

function mainChartOption({ rows, mode, tc, dark }) {
  const t = ecTheme(tc);
  const years = rows.map((row) => row.year);
  const model = rows.map((row) => modeValue(row, mode).model);
  const real = rows.map((row) => modeValue(row, mode).real);
  return {
    grid: { top: 16, right: 12, bottom: 38, left: 8, containLabel: true },
    tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: fmtK },
    legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
    xAxis: { type: "category", data: years, axisLabel: { ...t.axisLabel, fontSize: 10 }, axisLine: t.axisLine, axisTick: t.axisTick },
    yAxis: { type: "value", axisLabel: { ...t.axisLabel, formatter: (value) => fmtK(value, 0) }, splitLine: t.splitLine },
    series: [
      { name: "Model", type: "bar", data: model, itemStyle: { color: dark ? "rgba(148,163,184,.35)" : "rgba(107,142,166,.28)", borderRadius: [4, 4, 0, 0] }, barMaxWidth: 30 },
      { name: "Real", type: "bar", data: real, itemStyle: { color: (params) => periodColor(tc, years[params.dataIndex]), borderRadius: [4, 4, 0, 0] }, barMaxWidth: 30 },
    ],
  };
}

function cumulativeChartOption({ rows, mode, tc }) {
  const t = ecTheme(tc);
  const years = rows.map((row) => row.year);
  let modelAcc = 0;
  let realAcc = 0;
  const model = [];
  const real = [];
  rows.forEach((row) => {
    const value = modeValue(row, mode);
    modelAcc += value.model;
    realAcc += value.real;
    model.push(modelAcc);
    real.push(realAcc);
  });
  return {
    grid: { top: 16, right: 12, bottom: 38, left: 8, containLabel: true },
    tooltip: { ...t.tooltip, trigger: "axis", valueFormatter: fmtK },
    legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
    xAxis: { type: "category", data: years, axisLabel: t.axisLabel, axisLine: t.axisLine, axisTick: t.axisTick },
    yAxis: { type: "value", axisLabel: { ...t.axisLabel, formatter: (value) => fmtK(value, 0) }, splitLine: t.splitLine },
    series: [
      { name: "Model", type: "line", data: model, smooth: true, showSymbol: false, lineStyle: { color: tc.textLight, type: "dashed", width: 2 } },
      { name: "Real", type: "line", data: real, smooth: true, symbolSize: 6, lineStyle: { color: tc.navy, width: 2.5 }, itemStyle: { color: tc.green } },
    ],
  };
}

function deviationChartOption({ rows, mode, tc }) {
  const t = ecTheme(tc);
  const years = rows.map((row) => row.year);
  const data = rows.map((row) => {
    const value = modeValue(row, mode);
    return value.model ? ((value.real - value.model) / Math.abs(value.model)) * 100 : null;
  });
  return {
    grid: { top: 16, right: 12, bottom: 28, left: 8, containLabel: true },
    tooltip: { ...t.tooltip, trigger: "axis", valueFormatter: (value) => (value == null ? "--" : `${Number(value).toFixed(1)}%`) },
    xAxis: { type: "category", data: years, axisLabel: t.axisLabel, axisLine: t.axisLine, axisTick: t.axisTick },
    yAxis: { type: "value", axisLabel: { ...t.axisLabel, formatter: (value) => `${value}%` }, splitLine: t.splitLine },
    series: [
      { type: "bar", data, itemStyle: { color: (params) => periodOf(years[params.dataIndex]) === "fwd" ? tc.textLight : params.value >= 0 ? tc.green : tc.red, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 32 },
    ],
  };
}

function fundDeviationChartOption({ rows, mode, tc, metric = "eur" }) {
  const t = ecTheme(tc);
  const top = rows
    .map((row) => {
      const devEur = mode === "calls" ? row.rc - row.mc : mode === "dist" ? row.rd - row.md : (row.rd - row.rc) - (row.md - row.mc);
      const modelBase = mode === "calls" ? row.mc : mode === "dist" ? row.md : row.mc + row.md;
      const value = metric === "pct" && modelBase !== 0 ? (devEur / Math.abs(modelBase)) * 100 : devEur;
      return { fund: row.fund, value, devEur };
    })
    .filter((row) => Math.abs(row.devEur) > 100)
    .sort((a, b) => Math.abs(b.devEur) - Math.abs(a.devEur))
    .slice(0, 25)
    .reverse();
  const fmtAxis = metric === "pct" ? (v) => `${v.toFixed(0)}%` : (v) => fmtK(v, 0);
  const fmtTip = metric === "pct" ? (v) => `${v.toFixed(1)}%` : fmtK;
  return {
    grid: { top: 8, right: 14, bottom: 34, left: 210, containLabel: false },
    tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: fmtTip },
    xAxis: { type: "value", axisLabel: { ...t.axisLabel, formatter: fmtAxis }, splitLine: t.splitLine },
    yAxis: { type: "category", data: top.map((row) => row.fund.length > 38 ? `${row.fund.slice(0, 38)}...` : row.fund), axisLabel: { ...t.axisLabel, fontSize: 10 }, axisTick: t.axisTick, axisLine: t.axisLine },
    series: [
      { type: "bar", data: top.map((row) => row.value), itemStyle: { color: (params) => params.value >= 0 ? tc.green : tc.red, borderRadius: [0, 4, 4, 0] }, barMaxWidth: 14 },
    ],
  };
}

function useEChart() {
  const divRef = useRef(null);
  const chartRef = useRef(null);

  useLayoutEffect(() => {
    const chart = echarts.init(divRef.current);
    chartRef.current = chart;
    return () => {
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  return { divRef, chartRef };
}

function EChart({ option, style }) {
  const { divRef, chartRef } = useEChart();
  useLayoutEffect(() => {
    chartRef.current?.setOption(option, true);
  });
  return <div ref={divRef} style={style} />;
}

export function MainChart({ rows, mode, tc, dark }) {
  return <EChart option={mainChartOption({ rows, mode, tc, dark })} style={{ height: 300 }} />;
}

export function CumulativeChart({ rows, mode, tc, dark }) {
  return <EChart option={cumulativeChartOption({ rows, mode, tc, dark })} style={{ height: 240 }} />;
}

export function DeviationChart({ rows, mode, tc, dark }) {
  return <EChart option={deviationChartOption({ rows, mode, tc, dark })} style={{ height: 240 }} />;
}

export function FundDeviationChart({ rows, mode, tc, dark, metric }) {
  return <EChart option={fundDeviationChartOption({ rows, mode, tc, dark, metric })} style={{ height: 320 }} />;
}
